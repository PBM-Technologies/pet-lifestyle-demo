/**
 * Photo checks adapter. There is no backend yet, so this picks
 * the first available way to ask a vision model:
 *   a) the claude.ai artifact runtime (window.claude.use("sample")) when it can send images,
 *   b) a future endpoint set with VITE_AI_ENDPOINT,
 *   c) nothing: the UI shows a calm "needs the online version" note.
 * Finding the adapter never spends usage; only askJson does, and only on a user tap.
 */

export interface VisionAI {
  readonly kind: 'claude' | 'endpoint';
  askJson<T>(prompt: string, images: Blob[], signal?: AbortSignal): Promise<T>;
}

/** Plain error shape thrown by askJson. `message` is friendly viewer copy. */
export interface VisionError { code: string; message: string }

export const NO_AI_NOTE = 'Photo checks need the online version of the app. Everything else works offline.';
export const MAX_PHOTOS = 3;

const OFF = 'Photo checks are turned off for this view';
const COPY: Record<string, string> = {
  not_granted: OFF,
  sampling_disabled: OFF,
  images_unavailable: OFF,
  not_declared: OFF,
  capability_disabled: OFF,
  capability_removed: OFF,
  rate_limited: 'Too many checks in a row. Try again in a bit.',
  image_rejected: 'That photo could not be read. Try a different one.',
  refused: 'That photo could not be checked. Try a clearer photo of your pet.',
  session_expired: 'Your session expired. Sign in again, then try once more.',
};
const GENERIC = 'Something went wrong. Try again.';

/** Maps a runtime error code to viewer copy. Returns null for cancelled (stay silent). */
export function friendlyError(code: string | undefined): string | null {
  if (code === 'cancelled') return null;
  return (code && COPY[code]) || GENERIC;
}

/** Codes that mean photo checks cannot work in this view at all. */
export function isPermanentOff(code: string | undefined): boolean {
  return !!code && COPY[code] === OFF;
}

function toVisionError(e: unknown): VisionError {
  const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'upstream_error';
  return { code, message: friendlyError(code) ?? '' };
}

interface SampleNs {
  json<T>(input: string, opts: { images: Blob[]; modelTier: 'default'; signal?: AbortSignal }): Promise<T>;
  limits(): Promise<{ images?: { maxCount: number; maxInputBytes: number; mediaTypes: string[] } }>;
}
type ClaudeWindow = { claude?: { use?: (name: string) => Promise<unknown> } };

async function fromArtifactRuntime(): Promise<VisionAI | null> {
  const w = (typeof window !== 'undefined' ? window : undefined) as unknown as ClaudeWindow | undefined;
  if (!w?.claude || typeof w.claude.use !== 'function') return null;
  let sample: SampleNs | null = null;
  try { sample = (await w.claude.use('sample')) as SampleNs | null; } catch { return null; }
  if (!sample) return null;
  const lim = await sample.limits().catch(() => null);
  if (!lim?.images) return null;
  const s = sample;
  return {
    kind: 'claude',
    async askJson<T>(prompt: string, images: Blob[], signal?: AbortSignal): Promise<T> {
      try {
        return await s.json<T>(prompt, { images, modelTier: 'default', signal });
      } catch (e) {
        throw toVisionError(e);
      }
    },
  };
}

function fromEndpoint(endpoint: string | undefined): VisionAI | null {
  if (!endpoint) return null;
  return {
    kind: 'endpoint',
    async askJson<T>(prompt: string, images: Blob[], signal?: AbortSignal): Promise<T> {
      const body = new FormData();
      body.append('prompt', prompt);
      images.forEach((img, i) => body.append('images[]', img, `photo-${i + 1}.jpg`));
      let res: Response;
      try {
        res = await fetch(endpoint, { method: 'POST', body, signal });
      } catch (e) {
        throw toVisionError((e as { name?: string })?.name === 'AbortError' ? { code: 'cancelled' } : e);
      }
      if (!res.ok) throw toVisionError({ code: res.status === 429 ? 'rate_limited' : res.status === 415 || res.status === 413 ? 'image_rejected' : 'upstream_error' });
      try {
        return (await res.json()) as T;
      } catch {
        throw toVisionError({ code: 'invalid_json' });
      }
    },
  };
}

let cached: Promise<VisionAI | null> | null = null;

/** Finds the best available vision adapter. Memoized; does not spend usage. */
export function getVisionAI(): Promise<VisionAI | null> {
  if (!cached) {
    cached = (async () => (await fromArtifactRuntime()) ?? fromEndpoint(import.meta.env.VITE_AI_ENDPOINT as string | undefined))();
  }
  return cached;
}

/** Test hook: forget the memoized adapter. */
export function resetVisionAI() { cached = null; }

/** Internal, exported for tests. */
export const _internal = { fromEndpoint };
