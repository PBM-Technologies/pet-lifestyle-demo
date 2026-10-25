import { describe, expect, it } from 'vitest';
import {
  convertPortion, dailyUsage, daysPerPackage, daysSincePurchase, estimateFood, foodAlerts, isTracked, learnedDaysPerBag, learnedSentence, leftSentence,
  logNewPurchase, needsCupsPerLb, partnerForBrand, runOutSentence, unitsCompatible, usageSentence,
} from '../src/lib/food';
import { buildNotifications } from '../src/lib/notifications';
import { samplePets } from '../src/data/samples';
import { createDb, deleteAll, exportAll, importAll, loadSamplePets, petFoodCsv, removePet, removeSamplePets } from '../src/data/db';
import { createMemoryStore } from '../src/data/storage';
import { BRAND } from '../src/config/brand';
import type { Pet, PetFoodItem } from '../src/contracts/domain';

const on = '2026-10-25';
const item = (o: Partial<PetFoodItem> = {}): PetFoodItem => ({
  id: 'f1', householdId: 'h', petId: 'p1', kind: 'food', brand: 'Acme', product: 'Dry food', favorite: false,
  packageSize: 24, packageUnit: 'lb', purchasedOn: '2026-10-11', portionAmount: 2, portionUnit: 'cups', timesPerDay: 2, cupsPerLb: 4,
  purchases: [{ date: '2026-10-11', size: 24, unit: 'lb' }], active: true, createdAt: '', updatedAt: '', ...o,
});
const pet = (o: Partial<Pet> = {}): Pet => ({ id: 'p1', householdId: 'h', name: 'Bailey', species: 'dog', allergies: [], createdAt: '', updatedAt: '', ...o });

describe('unit conversion', () => {
  it('converts cups to weight through cups per pound', () => {
    expect(convertPortion(4, 'cups', 'lb', 4)).toBeCloseTo(1);
    expect(convertPortion(2, 'cups', 'lb', 4)).toBeCloseTo(0.5);
    expect(convertPortion(4, 'cups', 'kg', 4)).toBeCloseTo(0.4536, 3);
    expect(convertPortion(4, 'cups', 'oz', 4)).toBeCloseTo(16);
    expect(convertPortion(1, 'cups', 'lb')).toBeCloseTo(0.25);
  });
  it('converts between weights', () => {
    expect(convertPortion(16, 'oz', 'lb')).toBeCloseTo(1);
    expect(convertPortion(1000, 'g', 'kg')).toBeCloseTo(1);
    expect(convertPortion(453.59237, 'g', 'lb')).toBeCloseTo(1);
    expect(convertPortion(100, 'g', 'oz')).toBeCloseTo(3.527, 2);
  });
  it('counts cans, pouches and pieces 1:1 only when units match', () => {
    expect(convertPortion(1, 'cans', 'cans')).toBe(1);
    expect(convertPortion(2, 'pouches', 'pouches')).toBe(2);
    expect(convertPortion(5, 'pieces', 'count')).toBe(5);
    expect(convertPortion(1, 'cans', 'count')).toBe(1);
  });
  it('returns null when units cannot convert', () => {
    expect(convertPortion(1, 'cups', 'cans')).toBeNull();
    expect(convertPortion(1, 'cans', 'lb')).toBeNull();
    expect(convertPortion(1, 'pieces', 'lb')).toBeNull();
    expect(convertPortion(100, 'g', 'count')).toBeNull();
    expect(convertPortion(1, 'cups', 'lb', 0)).toBeNull();
    expect(unitsCompatible('cups', 'cans')).toBe(false);
    expect(unitsCompatible('cups', 'kg')).toBe(true);
  });
  it('asks for cups per pound only when cups meet a weight', () => {
    expect(needsCupsPerLb('cups', 'lb')).toBe(true);
    expect(needsCupsPerLb('cups', 'cans')).toBe(false);
    expect(needsCupsPerLb('g', 'lb')).toBe(false);
  });
});

describe('estimates', () => {
  it('computes daily use, bag life and days since purchase', () => {
    expect(dailyUsage(item())).toBeCloseTo(1);
    expect(daysPerPackage(item())).toBeCloseTo(24);
    expect(daysSincePurchase('2026-10-11', on)).toBe(14);
    expect(daysSincePurchase('2026-11-01', on)).toBe(0);
  });
  it('estimates amount left, percent and run out date', () => {
    const e = estimateFood(item(), on)!;
    expect(e.left).toBeCloseTo(10);
    expect(e.fractionLeft).toBeCloseTo(10 / 24);
    expect(e.runOutDate).toBe('2026-11-04');
    expect(e.daysLeft).toBe(10);
    expect(e.status).toBe('ok');
  });
  it('flags reorder soon within the lead days and out when empty', () => {
    expect(estimateFood(item({ purchasedOn: '2026-10-06' }), on)!.status).toBe('reorder_soon');
    expect(estimateFood(item({ purchasedOn: '2026-10-06', reorderLeadDays: 3 }), on)!.status).toBe('ok');
    const out = estimateFood(item({ purchasedOn: '2026-09-01' }), on)!;
    expect(out.status).toBe('out');
    expect(out.left).toBe(0);
    expect(out.fractionLeft).toBe(0);
  });
  it('returns null when untracked or units do not convert', () => {
    expect(estimateFood(item({ packageSize: undefined }), on)).toBeNull();
    expect(estimateFood(item({ portionUnit: 'cans' }), on)).toBeNull();
    expect(isTracked({ ...item(), timesPerDay: undefined })).toBe(false);
    const treat = item({ kind: 'treat', packageSize: undefined, packageUnit: undefined, purchasedOn: undefined, portionAmount: undefined, portionUnit: undefined, timesPerDay: undefined, purchases: [] });
    expect(estimateFood(treat, on)).toBeNull();
  });
  it('writes plain sentences', () => {
    expect(usageSentence(item())).toBe('At 2 cups twice a day, a 24 lb bag lasts about 24 days');
    expect(usageSentence(item({ portionAmount: 1, portionUnit: 'cans', packageUnit: 'cans', timesPerDay: 2 }))).toBe('At 1 can twice a day, a 24 cans case lasts about 12 days');
    expect(leftSentence(item(), estimateFood(item(), on)!)).toBe('About 10 lb left of 24 lb, runs out around Nov 4');
    expect(runOutSentence('Bailey', item(), estimateFood(item({ purchasedOn: '2026-10-06' }), on)!)).toBe("Bailey's food runs out in about 5 days");
    for (const s of [usageSentence(item()), leftSentence(item(), estimateFood(item(), on)!)]) expect(s).not.toContain('—');
  });
});

describe('purchase history', () => {
  it('learns average days per bag from 2 or more purchases', () => {
    expect(learnedDaysPerBag([{ date: '2026-10-01', size: 24, unit: 'lb' }])).toBeNull();
    expect(learnedDaysPerBag([{ date: '2026-09-01', size: 24, unit: 'lb' }, { date: '2026-10-01', size: 24, unit: 'lb' }])).toBe(30);
    expect(learnedDaysPerBag([{ date: '2026-10-21', size: 24, unit: 'lb' }, { date: '2026-08-01', size: 24, unit: 'lb' }, { date: '2026-09-11', size: 24, unit: 'lb' }])).toBe(41);
    expect(learnedSentence([{ date: '2026-09-01', size: 24, unit: 'lb' }, { date: '2026-10-01', size: 24, unit: 'lb' }])).toBe('Your last bags lasted about 30 days');
  });
  it('logs a new bag with the same size and resets the estimate', () => {
    const before = item({ purchasedOn: '2026-09-01', purchases: [{ date: '2026-09-01', size: 24, unit: 'lb' }] });
    expect(estimateFood(before, on)!.status).toBe('out');
    const after = logNewPurchase(before, on, 'NOW');
    expect(after.purchases).toHaveLength(2);
    expect(after.purchasedOn).toBe(on);
    expect(after.packageSize).toBe(24);
    expect(after.updatedAt).toBe('NOW');
    expect(estimateFood(after, on)!.left).toBeCloseTo(24);
    const bigger = logNewPurchase(before, on, 'NOW', { size: 30 });
    expect(bigger.packageSize).toBe(30);
  });
});

describe('partner tie-in', () => {
  it('matches partner names case-insensitively and nothing else', () => {
    const name = BRAND.partners[0].name;
    expect(partnerForBrand(name.toUpperCase(), BRAND.partners)?.url).toBe(BRAND.partners[0].url);
    expect(partnerForBrand(`  ${name.toLowerCase()} `, BRAND.partners)).toBeDefined();
    expect(partnerForBrand('Sample Treat Co', BRAND.partners)).toBeUndefined();
    expect(partnerForBrand('', BRAND.partners)).toBeUndefined();
  });
});

describe('alerts and notifications', () => {
  it('lists reorder soon and out items, most urgent first, skipping inactive', () => {
    const items = [
      item({ id: 'ok' }),
      item({ id: 'soon', purchasedOn: '2026-10-06' }),
      item({ id: 'out', purchasedOn: '2026-09-01' }),
      item({ id: 'off', purchasedOn: '2026-09-01', active: false }),
    ];
    expect(foodAlerts(items, on).map((a) => a.item.id)).toEqual(['out', 'soon']);
  });
  it('adds food_low notifications linking to the pet page', () => {
    const n = buildNotifications({ pets: [pet()], care: [], trips: [], events: [], food: [item({ purchasedOn: '2026-10-06' })] }, on);
    expect(n).toHaveLength(1);
    expect(n[0].kind).toBe('food_low');
    expect(n[0].href).toBe('#/pets/p1');
    expect(n[0].title).toBe("Bailey's food runs out in about 5 days");
    expect(n[0].severity).toBe('warning');
    const out = buildNotifications({ pets: [pet()], care: [], trips: [], events: [], food: [item({ purchasedOn: '2026-09-01' })] }, on);
    expect(out[0].severity).toBe('danger');
    expect(buildNotifications({ pets: [], care: [], trips: [], events: [], food: [item({ purchasedOn: '2026-09-01' })] }, on)).toHaveLength(0);
  });
});

describe('sample food', () => {
  it('puts Bailey and Luna at reorder soon with Bailey on the food partner', () => {
    const { food, pets } = samplePets('h', on);
    expect(food.every((f) => f.isSample)).toBe(true);
    const bFood = food.find((f) => f.id === 'sample-food-b-food')!;
    expect(bFood.brand).toBe(BRAND.partners.find((p) => p.category === 'food_and_treats')!.name);
    expect(bFood.product).toBe('Dry dog food (sample)');
    expect(estimateFood(bFood, on)!.status).toBe('reorder_soon');
    expect(estimateFood(bFood, on)!.daysLeft).toBe(5);
    expect(learnedDaysPerBag(bFood.purchases)).toBe(24);
    expect(estimateFood(food.find((f) => f.id === 'sample-food-l-food')!, on)!.status).toBe('reorder_soon');
    expect(estimateFood(food.find((f) => f.id === 'sample-food-b-bites')!, on)!.status).toBe('ok');
    expect(estimateFood(food.find((f) => f.id === 'sample-food-b-biscuits')!, on)).toBeNull();
    expect(food.filter((f) => f.kind === 'treat' && f.favorite)).toHaveLength(2);
    expect(buildNotifications({ pets, care: [], trips: [], events: [], food }, on).filter((x) => x.kind === 'food_low')).toHaveLength(2);
  });
});

describe('pet_food repository', () => {
  it('loads with samples, cascades on removePet and removeSamplePets', async () => {
    const db = createDb(createMemoryStore());
    await loadSamplePets(db, 'hh');
    expect(await db.petFood.list()).toHaveLength(4);
    await db.petFood.upsert(item({ id: 'mine', petId: 'sample-pet-luna', isSample: false }));
    await removePet(db, 'sample-pet-luna');
    expect((await db.petFood.list()).every((f) => f.petId !== 'sample-pet-luna')).toBe(true);
    await db.petFood.upsert(item({ id: 'keep', petId: 'real-pet' }));
    await removeSamplePets(db);
    expect((await db.petFood.list()).map((f) => f.id)).toEqual(['keep']);
  });
  it('round-trips through export and import, and tolerates a missing list', async () => {
    const a = createDb(createMemoryStore());
    await loadSamplePets(a, 'hh');
    const bundle = await exportAll(a, 'TestApp');
    expect(bundle.petFood).toHaveLength(4);
    const b = createDb(createMemoryStore());
    await importAll(b, JSON.parse(JSON.stringify(bundle)));
    expect(await b.petFood.list()).toHaveLength(4);
    const old = JSON.parse(JSON.stringify(bundle));
    delete old.petFood;
    const c = createDb(createMemoryStore());
    await c.petFood.upsert(item());
    await importAll(c, old);
    expect(await c.petFood.list()).toHaveLength(0);
    await expect(importAll(c, { version: 1, petFood: 'x' })).rejects.toThrow(/list/);
  });
  it('deleteAll empties pet_food', async () => {
    const db = createDb(createMemoryStore());
    await loadSamplePets(db, 'hh');
    await deleteAll(db);
    expect(await db.petFood.list()).toHaveLength(0);
  });
  it('builds a food CSV', () => {
    const csv = petFoodCsv([item({ notes: 'Mix, slowly' })], [pet()]);
    const [head, row] = csv.split('\n');
    expect(head.startsWith('pet,kind,brand,product')).toBe(true);
    expect(row).toContain('Bailey,food,Acme,Dry food');
    expect(row).toContain('2026-10-11 24 lb');
    expect(row.endsWith('"Mix, slowly"')).toBe(true);
  });
});
