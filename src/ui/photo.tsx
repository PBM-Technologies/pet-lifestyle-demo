import { useEffect, useId, useRef, useState } from 'react';
import { getVisionAI, isPermanentOff, MAX_PHOTOS, NO_AI_NOTE, type VisionAI, type VisionError } from '../ai/vision';
import { Icon } from './Icon';
import { Button } from './kit';

export type AiState = 'checking' | 'ready' | 'none';

/** Resolves the vision adapter once on mount. Never spends usage. */
export function useVisionAI(): { ai: VisionAI | null; state: AiState; markOff(): void } {
  const [ai, setAi] = useState<VisionAI | null>(null);
  const [state, setState] = useState<AiState>('checking');
  useEffect(() => {
    let live = true;
    void getVisionAI().then((v) => { if (live) { setAi(v); setState(v ? 'ready' : 'none'); } }).catch(() => { if (live) setState('none'); });
    return () => { live = false; };
  }, []);
  return { ai, state, markOff: () => { setAi(null); setState('none'); } };
}

/** Reads an image file and returns a JPEG Blob no larger than maxSide on its long edge. */
export async function compressImageBlob(file: File, maxSide = 1280, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That photo format is not supported.'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process that photo.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process that photo.'))), 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface Photo { id: string; blob: Blob; url: string }

/** Camera and library pickers plus thumbnails. Up to MAX_PHOTOS photos, resized to 1280px JPEG. */
export function PhotoPicker({ photos, onChange, disabled, hint }: { photos: Photo[]; onChange(p: Photo[]): void; disabled?: boolean; hint?: string }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const camId = useId();
  const libId = useId();
  const full = photos.length >= MAX_PHOTOS;

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr('');
    const next = [...photos];
    try {
      for (const f of Array.from(files)) {
        if (next.length >= MAX_PHOTOS) break;
        const blob = await compressImageBlob(f);
        next.push({ id: Math.random().toString(36).slice(2), blob, url: URL.createObjectURL(blob) });
      }
      onChange(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not use that photo.');
    } finally {
      setBusy(false);
    }
  }
  function removeAt(id: string) {
    const p = photos.find((x) => x.id === id);
    if (p) URL.revokeObjectURL(p.url);
    onChange(photos.filter((x) => x.id !== id));
  }

  const off = disabled || full || busy;
  return (
    <div className="field">
      {photos.length > 0 && (
        <ul className="photo-strip" aria-label="Photos to check">
          {photos.map((p, i) => (
            <li key={p.id}>
              <img src={p.url} alt={`Photo ${i + 1}`} />
              <button type="button" className="photo-x" aria-label={`Remove photo ${i + 1}`} onClick={() => removeAt(p.id)}><Icon name="x" size={18} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="photo-actions">
        <label htmlFor={camId} className={`btn btn-primary ${off ? 'is-disabled' : ''}`} aria-disabled={off || undefined}>
          <Icon name="camera" size={20} /><span>{photos.length ? 'Take another' : 'Take a photo'}</span>
        </label>
        <input id={camId} type="file" accept="image/*" capture="environment" className="visually-hidden" disabled={off} aria-label="Take a photo" onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
        <label htmlFor={libId} className={`btn btn-secondary ${off ? 'is-disabled' : ''}`} aria-disabled={off || undefined}>
          <Icon name="upload" size={20} /><span>Choose photos</span>
        </label>
        <input id={libId} type="file" accept="image/*" multiple className="visually-hidden" disabled={off} aria-label="Choose from library" onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
      </div>
      <p className="hint">{busy ? 'Preparing photo...' : full ? `That is the most photos for one check (${MAX_PHOTOS}).` : hint ?? `Up to ${MAX_PHOTOS} photos. Good light and a close, sharp shot help most.`}</p>
      {err && <p className="field-error" role="alert">{err}</p>}
    </div>
  );
}

export function NoAiNote() {
  return <p className="notice" role="note"><Icon name="info" size={18} /> <span>{NO_AI_NOTE}</span></p>;
}

/** Runs one check with a Cancel button. Never retries on its own. */
export function useCheck<T>(ai: VisionAI | null, onOff: () => void) {
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<T | null>(null);
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => () => ctl.current?.abort(), []);

  async function run(prompt: string, images: Blob[], clean: (raw: unknown) => T) {
    if (!ai || thinking) return;
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setThinking(true);
    setError('');
    setResult(null);
    try {
      const raw = await ai.askJson<unknown>(prompt, images, c.signal);
      if (!c.signal.aborted) setResult(clean(raw));
    } catch (e) {
      const ve = e as VisionError;
      if (ve?.code !== 'cancelled' && !c.signal.aborted) {
        setError(ve?.message || 'Something went wrong. Try again.');
        if (isPermanentOff(ve?.code)) onOff();
      }
    } finally {
      if (ctl.current === c) { ctl.current = null; setThinking(false); }
    }
  }
  function cancel() { ctl.current?.abort(); ctl.current = null; setThinking(false); }
  function clear() { setResult(null); setError(''); }
  return { thinking, error, result, run, cancel, clear };
}

export function Thinking({ onCancel, label = 'Thinking...' }: { onCancel(): void; label?: string }) {
  return (
    <div className="card thinking" role="status" aria-live="polite">
      <div className="thinking-row"><span className="spinner" aria-hidden="true" /><strong>{label}</strong></div>
      <p className="small muted">This usually takes a few seconds.</p>
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

/** 1 to 3 dots meter. */
export function Meter({ value, label, words = ['Low', 'Medium', 'High'] }: { value: 1 | 2 | 3; label: string; words?: [string, string, string] }) {
  return (
    <span className="meter" role="img" aria-label={`${label}: ${words[value - 1]}`}>
      {[1, 2, 3].map((i) => <span key={i} className={`meter-dot ${i <= value ? 'on' : ''}`} />)}
      <span className="meter-word">{words[value - 1]}</span>
    </span>
  );
}
