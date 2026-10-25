import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, SpeciesGlyph } from './Icon';
import type { Pet } from '../contracts/domain';
import { back } from '../router';
import { BRAND } from '../config/brand';

export function Button({ variant = 'primary', icon, children, className = '', ...rest }: { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'; icon?: string; children?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`btn btn-${variant} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={20} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function IconButton({ icon, label, onClick, className = '', pressed }: { icon: string; label: string; onClick?: () => void; className?: string; pressed?: boolean }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} onClick={onClick} aria-pressed={pressed}>
      <Icon name={icon} />
    </button>
  );
}

export function PageHeader({ title, subtitle, backTo, actions }: { title: string; subtitle?: ReactNode; backTo?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      {backTo && <IconButton icon="back" label="Back" onClick={() => back(backTo)} className="back-btn" />}
      <div className="page-header-text">
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export function Card({ children, className = '', as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' | 'li' }) {
  return <As className={`card ${className}`}>{children}</As>;
}

export function EmptyState({ icon = 'paw', title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty" role="status">
      <div className="empty-icon">
        <Icon name={icon} size={30} />
      </div>
      <h2>{title}</h2>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <Icon name="alert" />
      <p>{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warning' | 'danger' | 'success' | 'sample' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function SampleBadge() {
  return <Badge tone="sample">Sample</Badge>;
}

export function PetAvatar({ pet, size = 48 }: { pet: Pick<Pet, 'name' | 'species' | 'photo'>; size?: number }) {
  return (
    <span className={`avatar avatar-${pet.species}`} style={{ width: size, height: size }}>
      {pet.photo ? <img src={pet.photo} alt="" /> : <SpeciesGlyph species={pet.species} size={Math.round(size * 0.6)} />}
    </span>
  );
}

/** Full logo with the tagline as live text under it, so the words always match brand.ts. */
export function BrandLogo({ className = '', width, decorative = false }: { className?: string; width: number; decorative?: boolean }) {
  return (
    <div className={`brand-logo ${className}`}>
      <img src={BRAND.fullLogoDataUri} alt={decorative ? '' : BRAND.name} width={width} height={Math.round(width * 488 / 720)} />
      <p className="brand-tagline" data-testid="brand-tagline">{BRAND.tagline}</p>
    </div>
  );
}

/* ---------- form fields ---------- */

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({ label, value, onChange, hint, error, type = 'text', placeholder, required, inputMode, autoFocus, multiline, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; error?: string; type?: string; placeholder?: string; required?: boolean;
  inputMode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'email' | 'search'; autoFocus?: boolean; multiline?: boolean; maxLength?: number;
}) {
  const id = useId();
  return (
    <Field label={label + (required ? '' : '')} hint={hint} error={error} htmlFor={id}>
      {multiline ? (
        <textarea id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} rows={3} maxLength={maxLength ?? 2000} aria-invalid={!!error} />
      ) : (
        <input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} required={required} inputMode={inputMode} autoFocus={autoFocus} aria-invalid={!!error} maxLength={maxLength ?? 200} />
      )}
    </Field>
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** Tap-friendly segmented chooser used instead of native selects. */
export function ChoiceGroup<T extends string>({ label, value, options, onChange, columns }: { label: string; value: T | null; options: Option<T>[]; onChange: (v: T) => void; columns?: number }) {
  const id = useId();
  return (
    <div className="field">
      <span className="label" id={id}>{label}</span>
      <div className="choices" role="radiogroup" aria-labelledby={id} style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` } : undefined}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={`choice ${value === o.value ? 'on' : ''}`} onClick={() => onChange(o.value)}>
            <span className="choice-label">{o.label}</span>
            {o.hint && <span className="choice-hint">{o.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Picker that opens a bottom sheet list. Good for longer option sets. */
export function SheetPicker<T extends string>({ label, value, options, onChange, placeholder = 'Choose' }: { label: string; value: T | ''; options: Option<T>[]; onChange: (v: T) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div className="field">
      <span className="label">{label}</span>
      <button type="button" className="picker-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className={current ? '' : 'muted'}>{current?.label ?? placeholder}</span>
        <Icon name="chevron" size={18} />
      </button>
      <Sheet open={open} title={label} onClose={() => setOpen(false)}>
        <ul className="sheet-list" role="listbox" aria-label={label}>
          {options.map((o) => (
            <li key={o.value}>
              <button type="button" role="option" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => { onChange(o.value); setOpen(false); }}>
                <span>
                  {o.label}
                  {o.hint && <small className="muted"> {o.hint}</small>}
                </span>
                {o.value === value && <Icon name="check" size={18} />}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="toggle-row">
      <label htmlFor={id}>
        <span>{label}</span>
        {hint && <small className="muted">{hint}</small>}
      </label>
      <button id={id} type="button" role="switch" aria-checked={checked} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
        <span className="knob" />
      </button>
    </div>
  );
}

export function TriState({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  const v = value === true ? 'yes' : value === false ? 'no' : 'unknown';
  return (
    <ChoiceGroup
      label={label}
      value={v}
      columns={3}
      options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unknown', label: 'Unknown' }]}
      onChange={(x) => onChange(x === 'yes' ? true : x === 'no' ? false : null)}
    />
  );
}

export function PetMultiSelect({ label, pets, value, onChange }: { label: string; pets: Pet[]; value: string[]; onChange: (v: string[]) => void }) {
  const id = useId();
  if (!pets.length) return <p className="muted small">Add a pet first to tag them here.</p>;
  return (
    <div className="field">
      <span className="label" id={id}>{label}</span>
      <div className="pet-chips" role="group" aria-labelledby={id}>
        {pets.map((p) => {
          const on = value.includes(p.id);
          return (
            <button key={p.id} type="button" className={`pet-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])}>
              <PetAvatar pet={p} size={30} />
              <span>{p.name}</span>
              {on && <Icon name="check" size={16} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- overlays ---------- */

export function Sheet({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>('[autofocus], input, textarea, button:not(.sheet-close)');
      (el ?? ref.current)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <IconButton icon="x" label="Close" onClick={onClose} className="sheet-close" />
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, title, body, confirmLabel = 'Delete', onConfirm, onCancel, danger = true }: { open: boolean; title: string; body?: ReactNode; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  return (
    <Sheet
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      {body && <p>{body}</p>}
    </Sheet>
  );
}

/* ---------- media ---------- */

/** Reads an image file, downsizes it on a canvas and returns a JPEG data URL. */
export async function compressImage(file: File, maxSide = 720, quality = 0.78): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read that image.'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is not available.');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoInput({ label, value, onChange, maxSide }: { label: string; value?: string; onChange: (v: string | undefined) => void; maxSide?: number }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="photo-input">
        {value ? <img src={value} alt="Selected preview" className="photo-preview" /> : <div className="photo-placeholder"><Icon name="camera" size={28} /></div>}
        <div className="photo-actions">
          <label htmlFor={id} className="btn btn-secondary">
            <Icon name="camera" size={20} />
            <span>{busy ? 'Processing' : value ? 'Change photo' : 'Add photo'}</span>
          </label>
          <input
            id={id}
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setBusy(true);
              setErr(undefined);
              try {
                onChange(await compressImage(f, maxSide));
              } catch (x) {
                setErr(x instanceof Error ? x.message : 'Could not use that photo.');
              } finally {
                setBusy(false);
              }
            }}
          />
          {value && <Button variant="ghost" onClick={() => onChange(undefined)}>Remove</Button>}
        </div>
      </div>
      {err && <p className="field-error" role="alert">{err}</p>}
    </div>
  );
}

/* ---------- chart ---------- */

export function LineChart({ points, unit, label }: { points: Array<{ date: string; value: number }>; unit: string; label: string }) {
  if (points.length < 2) return <p className="muted small">Add at least two weights to see a trend.</p>;
  const W = 320, H = 140, P = 28;
  const vals = points.map((p) => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 1) { min -= 1; max += 1; }
  const t0 = new Date(points[0].date).getTime();
  const t1 = new Date(points[points.length - 1].date).getTime() || t0 + 1;
  const x = (d: string) => P + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - P * 2);
  const y = (v: number) => H - P + 6 - ((v - min) / (max - min)) * (H - P * 2);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: from ${points[0].value} to ${last.value} ${unit} over ${points.length} entries`}>
        <line x1={P} x2={W - P} y1={y(min)} y2={y(min)} className="chart-grid" />
        <line x1={P} x2={W - P} y1={y(max)} y2={y(max)} className="chart-grid" />
        <text x={4} y={y(max) + 4} className="chart-label">{max.toFixed(1)}</text>
        <text x={4} y={y(min) + 4} className="chart-label">{min.toFixed(1)}</text>
        <path d={path} className="chart-line" />
        {points.map((p) => (
          <circle key={p.date + p.value} cx={x(p.date)} cy={y(p.value)} r={3.5} className="chart-dot" />
        ))}
      </svg>
      <figcaption className="muted small">Latest {last.value} {unit}</figcaption>
    </figure>
  );
}

export function downloadFile(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Tap-friendly number stepper with 44px minus and plus buttons. */
export function Stepper({ label, value, min, max, onChange, format }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const id = useId();
  return (
    <div className="field">
      <span className="label" id={id}>{label}</span>
      <div className="stepper" role="group" aria-labelledby={id}>
        <button type="button" className="stepper-btn" aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}><span aria-hidden="true">-</span></button>
        <output className="stepper-value" aria-live="polite">{format ? format(value) : value}</output>
        <button type="button" className="stepper-btn" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Icon name="plus" size={20} /></button>
      </div>
    </div>
  );
}
