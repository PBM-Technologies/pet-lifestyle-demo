import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { friendlyError, getVisionAI, isPermanentOff, MAX_PHOTOS, NO_AI_NOTE, resetVisionAI, _internal } from '../src/ai/vision';
import { breedPrompt, cleanBreedId, cleanHealth, healthPrompt, symptomsFor } from '../src/ai/prompts';

const IMG_LIMITS = { images: { maxCount: 3, maxInputBytes: 20_000_000, mediaTypes: ['image/jpeg', 'image/png'] } };
type W = { claude?: unknown };
const w = window as unknown as W;

function fakeSample(opts: { limits?: unknown; limitsThrows?: boolean; json?: (...a: unknown[]) => Promise<unknown> } = {}) {
  return {
    limits: vi.fn(() => (opts.limitsThrows ? Promise.reject(new Error('x')) : Promise.resolve(opts.limits ?? IMG_LIMITS))),
    json: vi.fn(opts.json ?? (() => Promise.resolve({ ok: true }))),
  };
}

describe('getVisionAI adapter selection', () => {
  beforeEach(() => { resetVisionAI(); delete w.claude; vi.unstubAllEnvs(); });
  afterEach(() => { delete w.claude; resetVisionAI(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('returns null with no runtime and no endpoint', async () => {
    expect(await getVisionAI()).toBeNull();
  });
  it('uses the artifact runtime when sample has image limits, and does not call json on load', async () => {
    const s = fakeSample();
    const use = vi.fn(async (n: string) => (n === 'sample' ? s : null));
    w.claude = { use };
    const ai = await getVisionAI();
    expect(ai?.kind).toBe('claude');
    expect(use).toHaveBeenCalledWith('sample');
    expect(s.limits).toHaveBeenCalledTimes(1);
    expect(s.json).not.toHaveBeenCalled();
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    const ctl = new AbortController();
    await ai!.askJson('prompt', [blob], ctl.signal);
    expect(s.json).toHaveBeenCalledWith('prompt', { images: [blob], modelTier: 'default', signal: ctl.signal });
  });
  it('falls through when use("sample") is null, limits lack images, or limits rejects', async () => {
    w.claude = { use: async () => null };
    expect(await getVisionAI()).toBeNull();
    resetVisionAI();
    w.claude = { use: async () => fakeSample({ limits: { maxInputBytes: 1 } }) };
    expect(await getVisionAI()).toBeNull();
    resetVisionAI();
    w.claude = { use: async () => fakeSample({ limitsThrows: true }) };
    expect(await getVisionAI()).toBeNull();
    resetVisionAI();
    w.claude = { use: async () => { throw new Error('boom'); } };
    expect(await getVisionAI()).toBeNull();
  });
  it('uses the endpoint when VITE_AI_ENDPOINT is set and no runtime images are available', async () => {
    vi.stubEnv('VITE_AI_ENDPOINT', 'https://api.example.test/vision');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ a: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const ai = await getVisionAI();
    expect(ai?.kind).toBe('endpoint');
    expect(await ai!.askJson('p', [new Blob(['x'])])).toEqual({ a: 1 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.test/vision');
    const fd = init.body as FormData;
    expect(fd.get('prompt')).toBe('p');
    expect(fd.getAll('images[]')).toHaveLength(1);
  });
  it('prefers the runtime over the endpoint', async () => {
    vi.stubEnv('VITE_AI_ENDPOINT', 'https://api.example.test/vision');
    w.claude = { use: async () => fakeSample() };
    expect((await getVisionAI())?.kind).toBe('claude');
  });
  it('maps endpoint HTTP failures to friendly errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })));
    await expect(_internal.fromEndpoint('https://x.test')!.askJson('p', [])).rejects.toEqual({ code: 'rate_limited', message: 'Too many checks in a row. Try again in a bit.' });
  });
  it('turns sample rejections into friendly errors without retrying', async () => {
    const s = fakeSample({ json: () => Promise.reject({ code: 'image_rejected', message: 'dev text' }) });
    w.claude = { use: async () => s };
    const ai = await getVisionAI();
    await expect(ai!.askJson('p', [])).rejects.toEqual({ code: 'image_rejected', message: 'That photo could not be read. Try a different one.' });
    expect(s.json).toHaveBeenCalledTimes(1);
  });
});

describe('friendlyError', () => {
  it('maps every documented code', () => {
    for (const c of ['not_granted', 'sampling_disabled', 'images_unavailable', 'not_declared', 'capability_disabled']) {
      expect(friendlyError(c)).toBe('Photo checks are turned off for this view');
      expect(isPermanentOff(c)).toBe(true);
    }
    expect(friendlyError('rate_limited')).toBe('Too many checks in a row. Try again in a bit.');
    expect(friendlyError('image_rejected')).toBe('That photo could not be read. Try a different one.');
    expect(friendlyError('refused')).toBe('That photo could not be checked. Try a clearer photo of your pet.');
    for (const c of ['invalid_json', 'empty_completion', 'upstream_error', 'something_new', undefined]) expect(friendlyError(c)).toBe('Something went wrong. Try again.');
    expect(friendlyError('cancelled')).toBeNull();
    expect(isPermanentOff('rate_limited')).toBe(false);
  });
  it('never uses em dashes in copy', () => {
    for (const c of ['not_granted', 'rate_limited', 'image_rejected', 'refused', 'x']) expect(friendlyError(c)).not.toMatch(/—/);
  });
});

describe('pet prompts and sanitizers', () => {
  it('keeps the shared constants', () => {
    expect(MAX_PHOTOS).toBe(3);
    expect(NO_AI_NOTE).toBe('Photo checks need the online version of the app. Everything else works offline.');
  });
  it('breed prompt passes our breed names and honesty rules', () => {
    const p = breedPrompt(2);
    expect(p).toContain('Labrador Retriever');
    expect(p).toContain('Maine Coon');
    expect(p).toContain('"mixedLikely": boolean');
    expect(p).toMatch(/Never claim certainty/);
    expect(p).toMatch(/2 photos/);
  });
  it('health prompt has the safety rules', () => {
    const h = healthPrompt(1, 'cat', ['Straining in the litter box'], 'Domestic Shorthair, 2 yrs old');
    for (const re of [/fleas/, /ear mites/, /ringworm/, /lipoma/, /Never give a definite diagnosis/, /human medicines/, /call a vet before giving any medicine/i,
      /straining to urinate \(especially male cats\)/, /bloated belly with retching in dogs/, /ASPCA Animal Poison Control Center/, /Do not include phone numbers/]) expect(h).toMatch(re);
    expect(h).toContain('Straining in the litter box');
    expect(h).toContain('Domestic Shorthair');
    expect(h).not.toMatch(/\d{3}[) .-]+\d{3}/);
  });
  it('symptom chips depend on species', () => {
    expect(symptomsFor('dog')).toContain('Bloated belly or retching');
    expect(symptomsFor('cat')).toContain('Straining in the litter box');
    expect(symptomsFor('cat')).not.toContain('Scooting');
    for (const s of ['Itching or scratching', 'Hair loss or hot spots', 'Ear shaking or odor', 'Red or goopy eyes', 'Limping', 'Lump or bump', 'Bad breath or tartar', 'Vomiting or diarrhea', 'Not eating', 'Lethargic', 'Wound', 'Swelling']) {
      expect(symptomsFor('dog')).toContain(s);
    }
  });
  it('coerces junk breed output into safe shapes', () => {
    const b = cleanBreedId({ species: 'dog', topMatches: [{ breed: 'Beagle', confidence: 'certain' }, { nope: 1 }, { breed: 'A' }, { breed: 'B' }, { breed: 'C' }], mixedLikely: 'yes', sizeGuess: 5 });
    expect(b.topMatches).toHaveLength(3);
    expect(b.topMatches[0]).toEqual({ breed: 'Beagle', confidence: 'low', why: '' });
    expect(b.mixedLikely).toBe(false);
    expect(b.sizeGuess).toBe('');
    expect(cleanBreedId({ species: 'parrot', topMatches: [{ breed: 'X' }] })).toMatchObject({ species: 'other', topMatches: [] });
    expect(cleanBreedId(null).species).toBe('other');
  });
  it('coerces junk health output into safe shapes', () => {
    const h = cleanHealth({ urgency: 'now', possibleIssues: [{ name: 'Fleas', likelihood: 'likely', checkAtHome: ['a', 3, ''], careSteps: 'no' }, {}, { name: 'B' }, { name: 'C' }, { name: 'D' }] });
    expect(h.urgency).toBe('soon');
    expect(h.possibleIssues).toHaveLength(3);
    expect(h.possibleIssues[0].checkAtHome).toEqual(['a']);
    expect(h.possibleIssues[0].careSteps).toEqual([]);
    expect(h.possibleIssues[1].likelihood).toBe('possible');
    expect(cleanHealth(null)).toMatchObject({ possibleIssues: [], photoUsable: true, seeVetIf: [] });
    expect(cleanHealth({ photoUsable: false }).photoUsable).toBe(false);
  });
});
