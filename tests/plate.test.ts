import { describe, expect, it } from 'vitest';
import { FOOD_TYPES, FOOD_TYPE_BY_ID, foodTypesFor } from '../src/content/foodTypes';
import {
  BASE_MIN, TREAT_CAP, allergyNotes, calorieFactor, canStep, dailyAmount, dailyCalories, lifeStage, makeBase, otherKindFor, partnersForType, planUseOfPlate, plateSummary,
  rebalance, restingEnergy, stepShare, suggestPlate, toggleType, treatTotal,
} from '../src/lib/plate';
import { samplePets, SAMPLE_PET_IDS } from '../src/data/samples';
import { createDb, exportAll, importAll, loadSamplePets, removePet, removeSamplePets } from '../src/data/db';
import { createMemoryStore } from '../src/data/storage';
import type { PetFoodItem, PlateItem } from '../src/contracts/domain';

const on = '2026-10-25';
const sum = (items: PlateItem[]) => items.reduce((a, i) => a + i.share, 0);

describe('food type content', () => {
  it('covers every species with original, complete entries and no em dashes', () => {
    for (const sp of ['dog', 'cat', 'rabbit', 'guinea_pig', 'bird', 'reptile'] as const) expect(foodTypesFor(sp).some((t) => t.role === 'base')).toBe(true);
    for (const t of FOOD_TYPES) {
      expect(t.name && t.what && t.typicalShare).toBeTruthy();
      expect(t.pros.length).toBeGreaterThan(0);
      expect(t.watchOuts.length).toBeGreaterThan(0);
      expect(JSON.stringify(t)).not.toContain('—');
      if (t.role === 'supplement') expect(t.defaultShare).toBe(0);
    }
    expect(FOOD_TYPE_BY_ID.get('dog-raw')?.safetyNote).toMatch(/Salmonella/);
    expect(FOOD_TYPE_BY_ID.get('cat-raw')?.safetyNote).toBeTruthy();
    expect(FOOD_TYPES.filter((t) => t.id.includes('supp')).every((t) => t.askVet)).toBe(true);
  });
});

describe('pet facts and calories', () => {
  it('works out life stage with earlier senior years for giant dogs', () => {
    expect(lifeStage('dog', '2026-03-01', undefined, on)).toBe('young');
    expect(lifeStage('dog', '2020-01-01', 'Labrador', on)).toBe('adult');
    expect(lifeStage('dog', '2019-01-01', 'Labrador', on)).toBe('senior');
    expect(lifeStage('dog', '2021-01-01', 'Great Dane', on)).toBe('senior');
    expect(lifeStage('cat', '2018-01-01', undefined, on)).toBe('adult');
    expect(lifeStage('cat', '2016-01-01', undefined, on)).toBe('senior');
    expect(lifeStage('dog', undefined)).toBeNull();
  });
  it('uses RER = 70 x kg^0.75 and the common multipliers', () => {
    expect(restingEnergy(10)).toBeCloseTo(393.6, 1);
    const f = (o: Partial<Parameters<typeof calorieFactor>[0]>) => calorieFactor({ species: 'dog', months: 36, stage: 'adult', ...o })!.factor;
    expect(f({})).toBe(1.6);
    expect(f({ neutered: true })).toBe(1.6);
    expect(f({ neutered: false })).toBe(1.8);
    expect(f({ bodyCondition: 'over' })).toBe(1.0);
    expect(f({ months: 3, stage: 'young' })).toBe(3.0);
    expect(f({ months: 8, stage: 'young' })).toBe(2.0);
    expect(f({ stage: 'senior' })).toBe(1.4);
    expect(f({ activity: 'high' })).toBe(2.0);
    const c = (o: Partial<Parameters<typeof calorieFactor>[0]>) => calorieFactor({ species: 'cat', months: 36, stage: 'adult', ...o })!.factor;
    expect([c({}), c({ neutered: false }), c({ bodyCondition: 'over' }), c({ stage: 'young' }), c({ stage: 'senior' })]).toEqual([1.2, 1.4, 0.8, 2.5, 1.1]);
    expect(calorieFactor({ species: 'other', months: 12, stage: null })).toBeNull();
  });
  it('estimates daily calories, or uses the pet target when there is one', () => {
    // 22 lb = 9.98 kg -> RER about 393, x1.6 -> about 630
    const est = dailyCalories({ species: 'dog', weight: 22, weightUnit: 'lb', birthDate: '2022-01-01', neutered: true }, on)!;
    expect(est.source).toBe('estimate');
    expect(est.kcal).toBe(630);
    expect(est.factor).toBe(1.6);
    expect(dailyCalories({ species: 'cat', weight: 4, weightUnit: 'kg', birthDate: '2022-01-01' }, on)!.kcal).toBe(240);
    expect(dailyCalories({ species: 'dog', weight: 22, dailyCalorieTarget: 700 }, on)).toEqual({ kcal: 700, source: 'vet' });
    expect(dailyCalories({ species: 'dog' }, on)).toBeNull();
    expect(dailyCalories({ species: 'other', weight: 3 }, on)).toBeNull();
  });
  it('guesses other pet kinds from the breed text', () => {
    expect(otherKindFor('Holland Lop rabbit')).toBe('rabbit');
    expect(otherKindFor('Budgie')).toBe('bird');
    expect(otherKindFor('Leopard gecko')).toBe('reptile');
    expect(otherKindFor('Guinea pig')).toBe('guinea_pig');
    expect(otherKindFor('')).toBeUndefined();
  });
});

describe('plate suggestions', () => {
  const { pets, food } = samplePets('h', on);
  const bailey = pets.find((p) => p.id === SAMPLE_PET_IDS.bailey)!;
  const luna = pets.find((p) => p.id === SAMPLE_PET_IDS.luna)!;

  it('suggests a kibble base, a fresh topper and treats for Bailey, with his chicken allergy', () => {
    const s = suggestPlate({ ...bailey, currentFoods: food.filter((f) => f.petId === bailey.id), on });
    expect(s.base?.typeId).toBe('dog-dry');
    expect(s.base?.reasons).toContain('Allergic to chicken: pick a fish or lamb based recipe, and check treats too');
    expect(s.addOns.map((a) => a.typeId)).toEqual(['dog-fresh', 'dog-treats']);
    expect(s.addOns[0].reasons[0]).toMatch(/^Sensitive stomach/);
    expect(s.items.map((i) => [i.typeId, i.share])).toEqual([['dog-dry', 75], ['dog-fresh', 15], ['dog-treats', 10]]);
    expect(s.calories).toEqual({ kcal: 1300, source: 'vet' });
  });
  it('suggests wet pate, some dry and lickable treats for Luna', () => {
    const s = suggestPlate({ ...luna, currentFoods: food.filter((f) => f.petId === luna.id), on });
    expect(s.base).toEqual({ typeId: 'cat-wet-pate', reasons: ['Wet food adds water, good for cats'] });
    expect(s.items.map((i) => [i.typeId, i.share])).toEqual([['cat-wet-pate', 60], ['cat-dry', 30], ['cat-lickable', 10]]);
    expect(s.calories?.source).toBe('estimate');
  });
  it('adapts to seniors, weight and picky eaters', () => {
    const senior = suggestPlate({ species: 'dog', birthDate: '2015-01-01', on });
    expect(senior.base?.reasons[0]).toMatch(/^Senior/);
    expect(senior.addOns.map((a) => a.typeId)).toEqual(['dog-wet', 'dog-treats', 'dog-supp-joint']);
    expect(senior.items.find((i) => i.typeId === 'dog-supp-joint')?.share).toBe(0);
    const heavyCat = suggestPlate({ species: 'cat', birthDate: '2020-01-01', bodyCondition: 'over', on });
    expect(heavyCat.addOns.map((a) => a.typeId)).not.toContain('cat-dry');
    expect(heavyCat.notes.join(' ')).toMatch(/Watching weight/);
    const picky = suggestPlate({ species: 'cat', dietaryNotes: 'Very picky', on });
    expect(picky.base?.typeId).toBe('cat-wet-chunks');
    const dryCat = suggestPlate({ species: 'cat', currentFoods: [{ kind: 'food', brand: 'X', product: 'Dry food', portionUnit: 'cups', active: true }], on });
    expect(dryCat.base?.typeId).toBe('cat-dry');
    expect(dryCat.addOns[0]).toEqual({ typeId: 'cat-wet-pate', reasons: ['Wet food adds water, good for cats'] });
  });
  it('gives hay-first plates for small pets and asks for the kind of other pet', () => {
    expect(suggestPlate({ species: 'other', otherKind: 'rabbit' }).items.map((i) => [i.typeId, i.share])).toEqual([['rabbit-hay', 80], ['rabbit-greens', 10], ['rabbit-pellets', 5], ['rabbit-fruit', 5]]);
    expect(suggestPlate({ species: 'other', otherKind: 'guinea_pig' }).items[0]).toEqual({ typeId: 'gp-hay', share: 75, base: true });
    expect(suggestPlate({ species: 'other', otherKind: 'bird' }).items.map((i) => i.share)).toEqual([70, 20, 10]);
    expect(suggestPlate({ species: 'other', otherKind: 'reptile' }).items.map((i) => [i.typeId, i.share])).toEqual([['reptile-diet', 100], ['reptile-calcium', 0]]);
    const none = suggestPlate({ species: 'other' });
    expect(none.base).toBeNull();
    expect(none.items).toEqual([]);
  });
  it('writes allergy guidance', () => {
    expect(allergyNotes(['Beef', 'wheat', 'pollen'])).toEqual([
      'Allergic to beef: pick a fish, turkey or lamb based recipe',
      'Sensitive to wheat: read labels and pick a recipe without it',
      'Allergic to pollen: check the ingredient list on every food and treat',
    ]);
  });
});

describe('plate builder rules', () => {
  const start: PlateItem[] = [{ typeId: 'dog-dry', share: 75, base: true }, { typeId: 'dog-fresh', share: 15 }, { typeId: 'dog-treats', share: 10 }];

  it('toggles items, taking room from the base', () => {
    const r = toggleType(start, 'dog-broth');
    expect(r.items.map((i) => [i.typeId, i.share])).toEqual([['dog-dry', 70], ['dog-fresh', 15], ['dog-treats', 10], ['dog-broth', 5]]);
    expect(sum(r.items)).toBe(100);
    const off = toggleType(r.items, 'dog-fresh');
    expect(off.items.find((i) => i.base)?.share).toBe(85);
    expect(sum(off.items)).toBe(100);
  });
  it('caps treats at 10 percent', () => {
    const r = toggleType(start, 'dog-dental');
    expect(r.items).toBe(start);
    expect(r.message).toMatch(/10 percent cap/);
    expect(stepShare(start, 'dog-treats', 5).message).toBe('Treats stay at 10 percent or less.');
    expect(canStep(start, 'dog-treats', 5)).toBe(false);
    const fewer = stepShare(start, 'dog-treats', -5).items;
    expect(treatTotal(fewer)).toBe(5);
    const dental = toggleType(fewer, 'dog-dental').items;
    expect(dental.find((i) => i.typeId === 'dog-dental')?.share).toBe(5);
    expect(treatTotal(dental)).toBe(TREAT_CAP);
  });
  it('keeps the base at 50 percent or more', () => {
    let items = start;
    for (let k = 0; k < 10; k++) items = stepShare(items, 'dog-fresh', 5).items;
    expect(items.find((i) => i.base)?.share).toBe(BASE_MIN);
    expect(items.find((i) => i.typeId === 'dog-fresh')?.share).toBe(40);
    expect(stepShare(items, 'dog-fresh', 5).message).toBe('The base stays at 50 percent or more.');
    expect(toggleType(items, 'dog-wet').message).toMatch(/No room left/);
    expect(canStep(items, 'dog-dry', -5)).toBe(false);
  });
  it('steps in 5 percent amounts and never below 5', () => {
    const r = stepShare(start, 'dog-fresh', -5).items;
    expect(r.find((i) => i.typeId === 'dog-fresh')?.share).toBe(10);
    const low = stepShare(stepShare(r, 'dog-fresh', -5).items, 'dog-fresh', -5).items;
    expect(low.find((i) => i.typeId === 'dog-fresh')?.share).toBe(5);
  });
  it('adds supplements at 0 percent and promotes a new base when the base is removed', () => {
    expect(toggleType(start, 'dog-supp-joint').items.find((i) => i.typeId === 'dog-supp-joint')?.share).toBe(0);
    const r = toggleType(start, 'dog-dry').items;
    expect(r.find((i) => i.base)?.typeId).toBe('dog-fresh');
    expect(sum(r)).toBe(100);
    expect(toggleType([], 'dog-treats').message).toBe('Pick a base food first.');
    expect(toggleType([], 'dog-wet').items).toEqual([{ typeId: 'dog-wet', share: 100, base: true }]);
  });
  it('can make an add-on the base', () => {
    const r = makeBase(start, 'dog-fresh');
    expect(r.find((i) => i.base)?.typeId).toBe('dog-fresh');
    expect(r.find((i) => i.typeId === 'dog-dry')?.share).toBe(15);
    expect(sum(r)).toBe(100);
    expect(makeBase(start, 'dog-treats')).toBe(start);
  });
  it('rebalances an over-full plate', () => {
    const r = rebalance([{ typeId: 'dog-dry', share: 10, base: true }, { typeId: 'dog-fresh', share: 40 }, { typeId: 'dog-wet', share: 30 }]);
    expect(r.find((i) => i.base)?.share).toBe(50);
    expect(sum(r)).toBe(100);
  });
  it('computes daily amounts per item', () => {
    expect(dailyAmount({ typeId: 'dog-dry', share: 75, kcalPerUnit: 350 }, 1300, 2)).toEqual({ kcal: 975, perDay: 2.8, perFeeding: 1.4 });
    expect(dailyAmount({ typeId: 'dog-dry', share: 75 }, 1300)).toBeNull();
    expect(dailyAmount({ typeId: 'dog-dry', share: 75, kcalPerUnit: 350 }, undefined)).toBeNull();
    expect(plateSummary(start)).toBe('Dry kibble 75%, Fresh-cooked (refrigerated) 15%, Treats and chews 10%');
  });
  it('links partners only under food types they make', () => {
    const partners = [{ id: 'p', category: 'food_and_treats' as const, species: ['dog' as const] }, { id: 't', category: 'toys' as const, species: ['dog' as const] }];
    expect(partnersForType(FOOD_TYPE_BY_ID.get('dog-dry')!, partners).map((p) => p.id)).toEqual(['p']);
    expect(partnersForType(FOOD_TYPE_BY_ID.get('dog-raw')!, partners)).toEqual([]);
    expect(partnersForType(FOOD_TYPE_BY_ID.get('cat-dry')!, partners)).toEqual([]);
    expect(partnersForType(FOOD_TYPE_BY_ID.get('dog-raw')!, [{ ...partners[0], foodTypes: ['dog-raw'] }])).toHaveLength(1);
  });
});

describe('use this plate', () => {
  const now = '2026-10-25T12:00:00.000Z';
  let n = 0;
  const makeId = () => `new-${++n}`;
  const pet = { id: 'p1', householdId: 'h' };
  const kibble: PetFoodItem = { id: 'k', householdId: 'h', petId: 'p1', kind: 'food', brand: 'Acme', product: 'Dry', favorite: false, packageSize: 24, packageUnit: 'lb', portionAmount: 2, portionUnit: 'cups', timesPerDay: 2, purchases: [], active: true, createdAt: '2026-01-01', updatedAt: '' };
  const plate = { kcalTarget: 1300, items: [
    { typeId: 'dog-dry', share: 75, base: true, kcalPerUnit: 350, unit: 'cup' as const },
    { typeId: 'dog-fresh', share: 15, kcalPerUnit: 260, unit: 'cup' as const },
    { typeId: 'dog-treats', share: 10, kcalPerUnit: 4, unit: 'piece' as const, product: 'Bites' },
    { typeId: 'dog-supp-joint', share: 0 },
  ] };

  it('updates the current food portion, adds add-ons and treats, skips supplements', () => {
    const c = planUseOfPlate({ plate, pet, foods: [kibble], now, makeId });
    expect(c.map((x) => x.action)).toEqual(['update', 'create', 'create', 'skip']);
    expect(c[0].item).toMatchObject({ id: 'k', portionAmount: 1.4, portionUnit: 'cups', timesPerDay: 2, fromPlate: 'dog-dry', active: true });
    expect(c[0].text).toBe('Update Acme Dry: 1.4 cups twice a day');
    expect(c[1].item).toMatchObject({ kind: 'food', brand: 'Fresh-cooked (refrigerated)', product: 'From your plate', portionAmount: 0.4, portionUnit: 'cups', active: true, fromPlate: 'dog-fresh' });
    expect(c[2].item).toMatchObject({ kind: 'treat', product: 'Bites', kcalPerPiece: 4, favorite: true });
    expect(c[2].text).toBe('Add Treats and chews as a treat: about 33 pieces a day');
    expect(c[3].text).toMatch(/Ask your vet/);
    // new items keep the base first for the feeding checklist
    expect(c[1].item!.createdAt < c[2].item!.createdAt).toBe(true);
  });
  it('updates the same items again instead of duplicating them', () => {
    const first = planUseOfPlate({ plate, pet, foods: [kibble], now, makeId }).flatMap((x) => (x.item ? [x.item] : []));
    const again = planUseOfPlate({ plate, pet, foods: first, now, makeId });
    expect(again.filter((x) => x.action === 'create')).toEqual([]);
  });
  it('creates a main food for a pet with none, and leaves portions alone when units do not match', () => {
    const c = planUseOfPlate({ plate: { items: [{ typeId: 'cat-wet-pate', share: 100, base: true }] }, pet, foods: [], now, makeId });
    expect(c[0]).toMatchObject({ action: 'create', text: 'Add Wet pate as the main food' });
    expect(c[0].item?.portionAmount).toBeUndefined();
    const cans = planUseOfPlate({ plate: { kcalTarget: 1000, items: [{ typeId: 'dog-dry', share: 100, base: true, kcalPerUnit: 400, unit: 'can' }] }, pet, foods: [kibble], now, makeId });
    expect(cans[0].text).toMatch(/portion unchanged/);
    expect(cans[0].item?.portionAmount).toBe(2);
  });
});

describe('plate data', () => {
  it('loads sample plates, cleans up with the pet, and round-trips export', async () => {
    const db = createDb(createMemoryStore());
    await loadSamplePets(db, 'h');
    const plates = await db.plates.list();
    expect(plates.map((p) => [p.petId, plateSummary(p.items)])).toEqual([
      [SAMPLE_PET_IDS.bailey, 'Dry kibble 75%, Fresh-cooked (refrigerated) 15%, Treats and chews 10%'],
      [SAMPLE_PET_IDS.luna, 'Wet pate 60%, Dry food 30%, Lickable treats 10%'],
    ]);
    expect(plates.every((p) => p.isSample)).toBe(true);
    const bundle = await exportAll(db, 'App');
    expect(bundle.plates).toHaveLength(2);
    await removePet(db, SAMPLE_PET_IDS.luna);
    expect(await db.plates.list()).toHaveLength(1);
    const db2 = createDb(createMemoryStore());
    await importAll(db2, JSON.parse(JSON.stringify(bundle)));
    expect(await db2.plates.list()).toHaveLength(2);
    await removeSamplePets(db2);
    expect(await db2.plates.list()).toEqual([]);
  });
});
