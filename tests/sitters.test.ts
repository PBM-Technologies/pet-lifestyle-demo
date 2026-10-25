import { describe, expect, it } from 'vitest';
import { BRAND } from '../src/config/brand';
import {
  buildCareSheet, careSheetText, cleanPhone, dateRange, dueDatesIn, providerHref, providersFor, servicesForSpecies, sitterNeededLine, sourceLabel, validateRequest,
} from '../src/lib/sitters';
import { createDb, exportAll, importAll, loadSamplePets, removePet, removeSamplePets } from '../src/data/db';
import { createMemoryStore } from '../src/data/storage';
import { samplePets, SAMPLE_PET_IDS } from '../src/data/samples';
import { seedDemo } from '../src/data/demo';
import type { CareEvent, FoodSwitchPlan, Household, Sitter, SitterRequest } from '../src/contracts/domain';

const P = [
  { id: 'a', services: ['boarding', 'house_sitting', 'drop_in', 'dog_walking'], species: ['dog', 'cat'], url: 'https://a.example' },
  { id: 'b', services: ['dog_walking', 'drop_in'], species: ['dog'], url: 'https://b.example' },
  { id: 'c', services: ['house_sitting'], species: ['dog', 'cat', 'other'], url: 'https://c.example' },
] as const;
const prov = P.map((p) => ({ ...p, services: [...p.services], species: [...p.species] }));

describe('sitter providers', () => {
  it('keeps providers that offer a chosen service and take every chosen species', () => {
    expect(providersFor(prov, ['dog_walking'], ['dog']).map((p) => p.id)).toEqual(['a', 'b']);
    expect(providersFor(prov, ['drop_in'], ['cat']).map((p) => p.id)).toEqual(['a']);
    expect(providersFor(prov, ['drop_in'], ['dog', 'cat']).map((p) => p.id)).toEqual(['a']);
    expect(providersFor(prov, ['house_sitting'], ['other']).map((p) => p.id)).toEqual(['c']);
    expect(providersFor(prov, ['boarding', 'house_sitting'], ['cat']).map((p) => p.id)).toEqual(['a', 'c']);
    expect(providersFor(prov, [], ['dog']).map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(providersFor(prov, ['day_care'], ['dog'])).toEqual([]);
  });
  it('links to home pages unless a provider defines a search link', () => {
    expect(providerHref(prov[0], { services: [], species: [] })).toBe('https://a.example');
    expect(providerHref({ url: 'x', buildSearchUrl: (q) => `x?zip=${q.location}` }, { services: [], species: [], location: '12345' })).toBe('x?zip=12345');
  });
  it('filters the configured providers sensibly', () => {
    const cat = providersFor(BRAND.sitterProviders, ['drop_in'], ['cat']).map((p) => p.id);
    expect(cat).toContain('rover');
    expect(cat).not.toContain('wag');
    for (const p of BRAND.sitterProviders) expect(p.url.startsWith('https://')).toBe(true);
  });
  it('only offers dog walking and day care when a dog is in the request', () => {
    expect(servicesForSpecies(['cat'])).not.toContain('dog_walking');
    expect(servicesForSpecies(['cat', 'dog'])).toContain('dog_walking');
    expect(servicesForSpecies(['other'])).toEqual(['drop_in', 'house_sitting', 'boarding']);
  });
  it('labels where a sitter was found', () => {
    expect(sourceLabel('friend_family', prov.map((p) => ({ ...p, name: p.id.toUpperCase() })))).toBe('Friend or family');
    expect(sourceLabel('b', prov.map((p) => ({ ...p, name: p.id.toUpperCase() })))).toBe('B');
    expect(sourceLabel('zzz', [])).toBe('Other');
  });
});

describe('sitter requests', () => {
  it('formats short date ranges', () => {
    expect(dateRange('2026-11-03', '2026-11-05')).toBe('Nov 3 to 5');
    expect(dateRange('2026-10-30', '2026-11-01')).toBe('Oct 30 to Nov 1');
    expect(dateRange('2026-11-03', '2026-11-03')).toBe('Nov 3');
    expect(sitterNeededLine({ startsOn: '2026-11-03', endsOn: '2026-11-05' })).toBe('Sitter needed Nov 3 to 5');
  });
  it('validates a request', () => {
    expect(validateRequest({ petIds: [], services: [], startsOn: '', endsOn: '' })).toMatchObject({ pets: expect.any(String), services: expect.any(String), startsOn: expect.any(String) });
    expect(validateRequest({ petIds: ['a'], services: ['drop_in'], startsOn: '2026-11-05', endsOn: '2026-11-03' }).endsOn).toMatch(/after the start/);
    expect(validateRequest({ petIds: ['a'], services: ['drop_in'], startsOn: '2026-11-03', endsOn: '2026-11-05' })).toEqual({});
  });
  it('cleans phone numbers', () => {
    expect(cleanPhone(' (555) 010-0199 <b> ')).toBe('(555) 010-0199');
  });
});

describe('care sheet', () => {
  const base = '2026-10-25';
  const { pets, food, care } = samplePets('h', base);
  const household: Household = { id: 'h', name: 'H', members: ['Sarah', 'Alex'], memberPhones: { Alex: '555-0100' }, houseNotes: 'Key under the mat\nLeash by the door', createdAt: '', updatedAt: '' };

  it('follows repeat intervals for meds due during the stay', () => {
    const e = { dueDate: '2026-10-01', repeatDays: 30 } as CareEvent;
    expect(dueDatesIn(e, '2026-10-29', '2026-11-03')).toEqual(['2026-10-31']);
    expect(dueDatesIn({ dueDate: '2026-11-02' } as CareEvent, '2026-11-01', '2026-11-03')).toEqual(['2026-11-02']);
    expect(dueDatesIn({ dueDate: '2026-11-02', completedAt: 'x' } as CareEvent, '2026-11-01', '2026-11-03')).toEqual([]);
  });

  it('builds feeding, treats, meds, allergies, vet and contact from app data', () => {
    const bailey = pets.find((p) => p.id === SAMPLE_PET_IDS.bailey)!;
    // heartworm is due base+3 every 30 days
    const sheet = buildCareSheet({ pets: [{ ...bailey, vetPhone: '555-0123', microchip: '985112003456789', quirks: 'Afraid of thunder' }], food, switchPlans: [], care, household, startsOn: '2026-10-27', endsOn: '2026-10-30', on: base });
    expect(sheet.title).toBe('Care sheet for Bailey');
    expect(sheet.dates).toBe('Oct 27 to 30');
    const text = careSheetText(sheet, 'App');
    expect(text).toContain('Food: ');
    expect(text).toContain('Dry dog food (sample), 2 cups twice a day');
    expect(text).toContain('Feedings: Breakfast and Dinner');
    expect(text).toContain('Salmon training bites (sample) (4 kcal each)');
    expect(text).toContain('Limit: about 130 kcal of treats a day');
    expect(text).toContain('Heartworm preventive: due Oct 28');
    expect(text).toContain('Allergies:\n- Chicken');
    expect(text).toContain('Sample Vet Clinic, 555-0123');
    expect(text).toContain('985112003456789');
    expect(text).toContain('- Afraid of thunder');
    // Alex is the first member with a phone
    expect(text).toContain('Emergency contact:\n- Alex, 555-0100');
    expect(text).toContain('- Key under the mat\n- Leash by the door');
    expect(text.endsWith('Made with App')).toBe(true);
  });

  it('shows the switch plan mix for today and handles pets with no food', () => {
    const bailey = pets.find((p) => p.id === SAMPLE_PET_IDS.bailey)!;
    const luna = pets.find((p) => p.id === SAMPLE_PET_IDS.luna)!;
    const plan: FoodSwitchPlan = { id: 's', householdId: 'h', petId: bailey.id, oldFoodId: 'sample-food-b-food', newFoodId: 'new', days: 7, startDate: base, status: 'active', createdAt: '', updatedAt: '' };
    const sheet = buildCareSheet({ pets: [bailey, { ...luna, id: 'nofood' }], food: [...food, { ...food[0], id: 'new', brand: 'New Co', product: 'Fish kibble' }], switchPlans: [plan], care, household: { ...household, emergencyContact: 'Sarah' }, on: base });
    const text = careSheetText(sheet);
    expect(text).toContain("Switching to New Co Fish kibble. Today's mix: 1.5 cups old + 0.5 cups new per feeding");
    expect(text).not.toContain('Also: New Co');
    expect(text).toContain('No food saved yet. Ask before feeding.');
    expect(text).toContain('Emergency contact:\n- Sarah');
    expect(sheet.title).toBe('Care sheet for Bailey and Luna');
    expect(sheet.dates).toBe('');
  });
});

describe('sitter data', () => {
  const now = '2026-10-25T00:00:00.000Z';
  const req = (o: Partial<SitterRequest>): SitterRequest => ({ id: 'r', householdId: 'h', petIds: [], services: ['drop_in'], startsOn: '2026-11-03', endsOn: '2026-11-05', status: 'open', createdAt: now, updatedAt: now, ...o });
  const sitter = (o: Partial<Sitter>): Sitter => ({ id: 's', householdId: 'h', name: 'Jo', foundVia: 'friend_family', petIds: [], createdAt: now, updatedAt: now, ...o });

  it('removePet drops single-pet requests and detaches the pet elsewhere', async () => {
    const db = createDb(createMemoryStore());
    await loadSamplePets(db, 'h');
    const { bailey, luna } = SAMPLE_PET_IDS;
    await db.sitterRequests.replaceAll([req({ id: 'only', petIds: [luna] }), req({ id: 'both', petIds: [bailey, luna] })]);
    await db.sitters.upsert(sitter({ petIds: [luna, bailey] }));
    await removePet(db, luna);
    expect((await db.sitterRequests.list()).map((r) => [r.id, r.petIds])).toEqual([['both', [bailey]]]);
    expect((await db.sitters.get('s'))?.petIds).toEqual([bailey]);
  });

  it('exports, imports and clears sitters and requests', async () => {
    const db = createDb(createMemoryStore());
    await db.households.upsert({ id: 'h', name: 'H', members: ['A'], memberPhones: { A: '1' }, createdAt: now, updatedAt: now });
    await db.sitterRequests.upsert(req({ petIds: ['p'] }));
    await db.sitters.upsert(sitter({}));
    const bundle = await exportAll(db, 'App');
    expect(bundle.sitterRequests).toHaveLength(1);
    expect(bundle.sitters).toHaveLength(1);
    const db2 = createDb(createMemoryStore());
    await importAll(db2, JSON.parse(JSON.stringify({ ...bundle, sitterRequests: [...bundle.sitterRequests!, { id: 'bad', startsOn: 'nope' }] })));
    expect(await db2.sitterRequests.list()).toHaveLength(1);
    expect((await db2.sitters.list())[0].name).toBe('Jo');
    expect((await db2.households.list())[0].memberPhones).toEqual({ A: '1' });
    // older exports without the new lists still import
    const { sitterRequests: _a, sitters: _b, ...old } = bundle;
    await importAll(db2, old);
    expect(await db2.sitters.list()).toEqual([]);
  });

  it('demo seeds a sample sitter found via a provider id and an open request for the trip dates', async () => {
    const db = createDb(createMemoryStore());
    await seedDemo(db, '2026-10-25');
    const [s] = await db.sitters.list();
    expect(s.name).toBe('Jordan (sample)');
    expect(BRAND.sitterProviders.map((p) => p.id)).toContain(s.foundVia);
    const [r] = await db.sitterRequests.list();
    const trip = await db.trips.get('demo-trip-lakeview');
    expect([r.status, r.startsOn, r.endsOn, r.tripId]).toEqual(['open', trip!.startsOn, trip!.endsOn, trip!.id]);
    expect(r.petIds).toEqual([SAMPLE_PET_IDS.luna]);
    await removeSamplePets(db);
    expect(await db.sitters.list()).toEqual([]);
    expect(await db.sitterRequests.list()).toEqual([]);
  });
});
