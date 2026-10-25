import { describe, expect, it } from 'vitest';
import { addDays, ageOn, daysBetween, formatAge, isValidDay, relativeDay } from '../src/lib/dates';
import { completeCareEvent, dueSoon, dueStatus, weightSeries } from '../src/lib/care';
import { buildPackingList, mergePackingList, packingProgress, travelReminders } from '../src/lib/packing';
import { normalizeRestriction, parseList, restrictionsFromAllergies, suggestBoxSize } from '../src/lib/boxes';
import { filterPlaces, verificationLabel } from '../src/lib/places';
import { buildNotifications } from '../src/lib/notifications';
import { SAMPLE_PLACES, samplePets } from '../src/data/samples';
import type { CareEvent, Pet, SavedPlace, TripPlan } from '../src/contracts/domain';
import { matchPattern } from '../src/router';

const pet = (o: Partial<Pet>): Pet => ({ id: 'p1', householdId: 'h', name: 'Bo', species: 'dog', allergies: [], createdAt: '', updatedAt: '', ...o });
const care = (o: Partial<CareEvent>): CareEvent => ({ id: Math.random().toString(36), householdId: 'h', petId: 'p1', type: 'vaccine', title: 'Rabies', date: '2026-01-01', createdAt: '', updatedAt: '', ...o });

describe('dates and age', () => {
  it('computes age in years and months', () => {
    expect(ageOn('2022-10-25', '2026-10-25')).toEqual({ years: 4, months: 0 });
    expect(ageOn('2022-10-26', '2026-10-25')).toEqual({ years: 3, months: 11 });
    expect(ageOn('2026-08-10', '2026-10-25')).toEqual({ years: 0, months: 2 });
    expect(ageOn('2027-01-01', '2026-10-25')).toBeNull();
    expect(ageOn('nope', '2026-10-25')).toBeNull();
  });
  it('handles leap day birthdays', () => {
    expect(ageOn('2024-02-29', '2025-02-28')).toEqual({ years: 0, months: 11 });
    expect(ageOn('2024-02-29', '2025-03-01')).toEqual({ years: 1, months: 0 });
  });
  it('formats ages', () => {
    expect(formatAge('2022-10-25', '2026-10-25')).toBe('4 yrs');
    expect(formatAge('2025-08-25', '2026-10-25')).toBe('1 yr 2 mo');
    expect(formatAge('2026-08-10', '2026-10-25')).toBe('2 mo');
    expect(formatAge('2026-10-20', '2026-10-25')).toBe('Under 1 month');
    expect(formatAge(undefined)).toBe('Age unknown');
  });
  it('validates and diffs days', () => {
    expect(isValidDay('2026-02-30')).toBe(false);
    expect(isValidDay('2026-02-28')).toBe(true);
    expect(daysBetween('2026-10-25', '2026-11-04')).toBe(10);
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(relativeDay('2026-10-26', '2026-10-25')).toBe('tomorrow');
    expect(relativeDay('2026-10-20', '2026-10-25')).toBe('5 days ago');
  });
});

describe('due soon logic', () => {
  const on = '2026-10-25';
  it('classifies due status', () => {
    expect(dueStatus({ dueDate: '2026-10-20' }, on)).toBe('overdue');
    expect(dueStatus({ dueDate: '2026-10-25' }, on)).toBe('due_soon');
    expect(dueStatus({ dueDate: '2026-11-24' }, on)).toBe('due_soon');
    expect(dueStatus({ dueDate: '2026-11-25' }, on)).toBe('upcoming');
    expect(dueStatus({}, on)).toBe('none');
    expect(dueStatus({ dueDate: '2026-10-20', completedAt: 'x' }, on)).toBe('done');
  });
  it('lists overdue and due soon items sorted, skipping done, notes and far future', () => {
    const items = dueSoon([
      care({ id: 'a', dueDate: '2026-11-10' }),
      care({ id: 'b', dueDate: '2026-10-01' }),
      care({ id: 'c', dueDate: '2027-05-01' }),
      care({ id: 'd', dueDate: '2026-10-28', completedAt: 'x' }),
      care({ id: 'e', type: 'note', dueDate: '2026-10-26' }),
    ], [pet({})], on);
    expect(items.map((i) => i.event.id)).toEqual(['b', 'a']);
    expect(items[0].status).toBe('overdue');
    expect(items[0].pet?.name).toBe('Bo');
  });
  it('completing a repeating item schedules the next one', () => {
    const { done, next } = completeCareEvent(care({ type: 'heartworm', dueDate: '2026-10-25', repeatDays: 30 }), on, 'NOW');
    expect(done.completedAt).toBe('NOW');
    expect(next?.dueDate).toBe('2026-11-24');
    expect(next?.completedAt).toBeUndefined();
    expect(completeCareEvent(care({ dueDate: '2026-10-25' }), on).next).toBeUndefined();
  });
  it('builds weight series oldest first', () => {
    const s = weightSeries([care({ type: 'weight', date: '2026-05-01', value: 10 }), care({ type: 'weight', date: '2026-01-01', value: 9 }), care({ type: 'weight', petId: 'other', date: '2026-02-01', value: 50 })], 'p1');
    expect(s).toEqual([{ date: '2026-01-01', value: 9 }, { date: '2026-05-01', value: 10 }]);
  });
  it('sample pets have due-soon care so the demo shows reminders', () => {
    const { pets, care: c } = samplePets('h', on);
    expect(formatAge(pets[0].birthDate, on)).toBe('4 yrs');
    expect(formatAge(pets[1].birthDate, on)).toBe('2 yrs');
    expect(dueSoon(c, pets, on).length).toBeGreaterThan(0);
  });
});

describe('packing list by species', () => {
  const dog = pet({ id: 'd', name: 'Rex', species: 'dog' });
  const cat = pet({ id: 'c', name: 'Mia', species: 'cat', allergies: ['fish'] });
  it('gives dogs leash and bags, cats carrier and litter', () => {
    const d = buildPackingList([dog]).map((i) => i.id);
    expect(d).toContain('leash:d');
    expect(d).toContain('bags:d');
    expect(d).not.toContain('litter:d');
    const c = buildPackingList([cat]).map((i) => i.id);
    expect(c).toContain('litter:c');
    expect(c).toContain('carrier:c');
    expect(c).not.toContain('leash:c');
    expect(c).toContain('diet:c');
    expect(c).toContain('records:c');
    expect(c).toContain('meds:c');
  });
  it('is empty with no pets and includes shared items once', () => {
    expect(buildPackingList([])).toEqual([]);
    const both = buildPackingList([dog, cat]);
    expect(both.filter((i) => i.id === 'shared:firstaid')).toHaveLength(1);
  });
  it('merges keeping checks and custom items, dropping pets not coming', () => {
    const list = buildPackingList([dog, cat]).map((i) => (i.id === 'food:d' ? { ...i, checked: true } : i));
    list.push({ id: 'x', label: 'Camera', checked: true, custom: true });
    const merged = mergePackingList(list, [dog]);
    expect(merged.find((i) => i.id === 'food:d')?.checked).toBe(true);
    expect(merged.some((i) => i.id === 'litter:c')).toBe(false);
    expect(merged.some((i) => i.id === 'x')).toBe(true);
    expect(packingProgress(merged).done).toBe(2);
  });
  it('reminds to bring vaccine records', () => {
    expect(travelReminders([dog], false)[0]).toMatch(/vaccine records/i);
    expect(travelReminders([dog], true).some((r) => /hotel/i.test(r))).toBe(true);
    expect(travelReminders([], false)).toEqual([]);
  });
});

describe('box restrictions from allergies', () => {
  it('normalizes and de-duplicates', () => {
    expect(restrictionsFromAllergies({ allergies: ['chicken', ' Chicken ', 'no beef', 'grain free'], dietaryNotes: '' })).toEqual(['Chicken', 'Beef', 'Grain']);
    expect(restrictionsFromAllergies(undefined)).toEqual([]);
    expect(normalizeRestriction('allergic to   dairy')).toBe('Dairy');
    expect(parseList('a, b;c\n d,,')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('suggests a size', () => {
    expect(suggestBoxSize({ species: 'cat', weight: 10, weightUnit: 'lb' })).toBe('small');
    expect(suggestBoxSize({ species: 'dog', weight: 68, weightUnit: 'lb' })).toBe('large');
    expect(suggestBoxSize({ species: 'dog', weight: 15, weightUnit: 'kg' })).toBe('medium');
    expect(suggestBoxSize({ species: 'dog' })).toBe('medium');
  });
});

describe('place filtering', () => {
  const saved: SavedPlace[] = [{ id: 's', householdId: 'h', placeId: 'sample-place-vet', favorite: true, createdAt: '', updatedAt: '' }];
  it('filters by category, search terms, species and saved', () => {
    expect(filterPlaces(SAMPLE_PLACES, [], { category: 'hotel' }).map((p) => p.name)).toEqual(['Paws and Stay Hotel']);
    expect(filterPlaces(SAMPLE_PLACES, [], { query: 'lakeview patio' }).map((p) => p.name)).toEqual(['Corner Bistro Patio']);
    expect(filterPlaces(SAMPLE_PLACES, [], { query: 'cat cafe' }).map((p) => p.id)).toEqual(['sample-place-whisker']);
    expect(filterPlaces(SAMPLE_PLACES, [], { species: 'cat' }).some((p) => p.id === 'sample-place-riverside')).toBe(false);
    expect(filterPlaces(SAMPLE_PLACES, saved, { category: 'saved' }).map((p) => p.id)).toEqual(['sample-place-vet']);
    expect(filterPlaces(SAMPLE_PLACES, [], { query: 'zzzz' })).toEqual([]);
  });
  it('floats favorites to the top', () => {
    expect(filterPlaces(SAMPLE_PLACES, saved, { category: 'all' })[0].id).toBe('sample-place-vet');
  });
  it('never claims verification unless the user marked it', () => {
    const p = SAMPLE_PLACES[0];
    expect(verificationLabel(p, undefined, (d) => d)).toEqual({ verified: false, text: 'Unverified, call ahead' });
    expect(verificationLabel(p, { ...saved[0], placeId: p.id, verifiedAt: '2026-10-25' }, (d) => d).text).toBe('Verified on 2026-10-25 by you');
    expect(SAMPLE_PLACES.every((x) => !x.policy.verifiedAt)).toBe(true);
  });
});

describe('notifications', () => {
  it('collects care, trips and events in date order', () => {
    const on = '2026-10-25';
    const trip: TripPlan = { id: 't', householdId: 'h', title: 'Lake', startsOn: '2026-10-30', petIds: [], stops: [], packing: [], createdAt: '', updatedAt: '' };
    const far: TripPlan = { ...trip, id: 'f', startsOn: '2027-01-01' };
    const n = buildNotifications({
      pets: [pet({})],
      care: [care({ dueDate: '2026-10-20' })],
      trips: [trip, far],
      events: [{ id: 'e', title: 'Walk', kind: 'walk_club', date: '2026-10-27', petIds: [], rsvp: 'going', isSample: true, createdAt: '', updatedAt: '' },
        { id: 's', title: 'Sample not going', kind: 'walk_club', date: '2026-10-27', petIds: [], rsvp: null, isSample: true, createdAt: '', updatedAt: '' }],
    }, on);
    expect(n.map((x) => x.kind)).toEqual(['care_overdue', 'event_upcoming', 'trip_upcoming']);
    expect(n[0].severity).toBe('danger');
  });
});

describe('router', () => {
  it('matches params', () => {
    expect(matchPattern('/pets/:petId', '/pets/abc')).toEqual({ petId: 'abc' });
    expect(matchPattern('/pets/:petId', '/pets')).toBeNull();
    expect(matchPattern('/boxes/build', '/boxes/build')).toEqual({});
    expect(matchPattern('/explore/:placeId', '/explore/a%20b')).toEqual({ placeId: 'a b' });
  });
});
