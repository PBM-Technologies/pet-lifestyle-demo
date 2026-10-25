import { describe, expect, it } from 'vitest';
import { cleanMembers, clockTime, fedSentence, feedingSlots, lastFed, logsForDay, mainFood, stepCount, treatAllowance, treatDay } from '../src/lib/feeding';
import { isPlanFinished, mixSentence, planDayNumber, splitPortion, switchSchedule, todaysMix } from '../src/lib/foodSwitch';
import {
  averagePerPet, byCategory, byPet, inMonth, monthLabel, monthTrend, parseAmount, shiftMonth, spendEntries, spendingCsv, sum,
} from '../src/lib/spending';
import { createDb, deleteAll, exportAll, importAll, loadSamplePets, removePet, removeSamplePets } from '../src/data/db';
import { createMemoryStore } from '../src/data/storage';
import { samplePets, SAMPLE_CALORIE_TARGET } from '../src/data/samples';
import type { Expense, FeedingLog, FoodSwitchPlan, PetFoodItem, TreatLog } from '../src/contracts/domain';

const day = '2026-10-25';
const food = (o: Partial<PetFoodItem> = {}): PetFoodItem => ({
  id: 'f1', householdId: 'h', petId: 'p1', kind: 'food', brand: 'Acme', product: 'Dry food', favorite: false, portionAmount: 2, portionUnit: 'cups', timesPerDay: 2,
  purchases: [], active: true, createdAt: '2026-01-01', updatedAt: '', ...o,
});
const log = (o: Partial<FeedingLog> = {}): FeedingLog => ({ id: 'l' + Math.random(), householdId: 'h', petId: 'p1', day, slot: 0, fedAt: new Date(2026, 9, 25, 7, 40).toISOString(), createdAt: '', updatedAt: '', ...o });

describe('feeding check-off', () => {
  it('labels slots by feedings per day', () => {
    expect(feedingSlots(2)).toEqual(['Breakfast', 'Dinner']);
    expect(feedingSlots(3)).toEqual(['Breakfast', 'Lunch', 'Dinner']);
    expect(feedingSlots(4)).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Late']);
    expect(feedingSlots(1)).toEqual(['Meal']);
    expect(feedingSlots(undefined)).toHaveLength(2);
    expect(feedingSlots(9)).toHaveLength(4);
  });
  it('only counts logs from the same day, so it resets daily', () => {
    const logs = [log(), log({ slot: 1, day: '2026-10-24' }), log({ petId: 'p2' })];
    const m = logsForDay(logs, 'p1', day);
    expect([...m.keys()]).toEqual([0]);
    expect(logsForDay(logs, 'p1', '2026-10-26').size).toBe(0);
  });
  it('writes the fed sentence with optional name', () => {
    expect(clockTime(new Date(2026, 9, 25, 7, 40).toISOString())).toBe('7:40 AM');
    expect(clockTime(new Date(2026, 9, 25, 18, 5).toISOString())).toBe('6:05 PM');
    expect(fedSentence('Bailey', log())).toBe('Bailey was fed at 7:40 AM');
    expect(fedSentence('Bailey', log({ fedBy: 'Sarah' }))).toBe('Bailey was fed at 7:40 AM by Sarah');
    const m = logsForDay([log(), log({ slot: 1, fedAt: new Date(2026, 9, 25, 18, 0).toISOString() })], 'p1', day);
    expect(lastFed(m)?.slot).toBe(1);
  });
  it('follows the old food during a switch plan', () => {
    const a = food({ id: 'a', createdAt: '2026-01-01' });
    const b = food({ id: 'b', createdAt: '2026-02-01' });
    expect(mainFood([b, a], 'p1')?.id).toBe('a');
    const plan = { id: 's', petId: 'p1', oldFoodId: 'b', newFoodId: 'a', status: 'active' } as FoodSwitchPlan;
    expect(mainFood([a, b], 'p1', [plan])?.id).toBe('b');
    expect(mainFood([food({ active: false })], 'p1')).toBeUndefined();
  });
  it('cleans household member names', () => {
    expect(cleanMembers([' Sarah ', 'alex', 'Alex', '', '  '])).toEqual(['Sarah', 'alex']);
  });
});

describe('treat budget', () => {
  const treats = [food({ id: 't1', kind: 'treat', kcalPerPiece: 4 }), food({ id: 't2', kind: 'treat' })];
  const tl = (foodId: string, count: number, d = day): TreatLog => ({ id: foodId + d, householdId: 'h', petId: 'p1', foodId, day: d, count, createdAt: '', updatedAt: '' });
  it('allows about 10 percent of the daily target', () => {
    expect(treatAllowance(1300)).toBe(130);
    expect(treatAllowance(undefined)).toBeNull();
    expect(treatAllowance(0)).toBeNull();
  });
  it('totals treat calories for today and flags over budget', () => {
    const s = treatDay([tl('t1', 5), tl('t2', 2), tl('t1', 9, '2026-10-24')], treats, 'p1', 1300, day);
    expect(s).toMatchObject({ kcal: 20, pieces: 7, uncounted: 2, allowance: 130, over: false });
    expect(treatDay([tl('t1', 40)], treats, 'p1', 1300, day).over).toBe(true);
    expect(treatDay([tl('t1', 3)], treats, 'p1', undefined, day)).toMatchObject({ kcal: 12, allowance: null, fraction: null, over: false });
  });
  it('steps counts between 0 and 99', () => {
    expect(stepCount(0, -1)).toBe(0);
    expect(stepCount(3, 1)).toBe(4);
    expect(stepCount(99, 1)).toBe(99);
  });
});

describe('food switch plan', () => {
  it('builds the 7 day schedule', () => {
    expect(switchSchedule(7).map((d) => d.newPct)).toEqual([25, 25, 50, 50, 75, 75, 100]);
    expect(switchSchedule(7).every((d) => d.oldPct + d.newPct === 100)).toBe(true);
  });
  it('builds the 10 day schedule', () => {
    expect(switchSchedule(10).map((d) => d.newPct)).toEqual([25, 25, 25, 50, 50, 50, 75, 75, 75, 100]);
  });
  it('finds today in the plan', () => {
    const plan = { startDate: '2026-10-23', days: 7 as const };
    expect(planDayNumber(plan, day)).toBe(3);
    expect(todaysMix(plan, day)).toEqual({ day: 3, oldPct: 50, newPct: 50 });
    expect(todaysMix(plan, '2026-10-22')).toBeNull();
    expect(todaysMix(plan, '2026-10-29')?.newPct).toBe(100);
    expect(isPlanFinished(plan, '2026-10-29')).toBe(false);
    expect(isPlanFinished(plan, '2026-10-30')).toBe(true);
  });
  it('splits one feeding using the portion', () => {
    expect(splitPortion(2, 'cups', { oldPct: 75, newPct: 25 })).toEqual({ old: 1.5, next: 0.5 });
    expect(splitPortion(2, 'cups', { oldPct: 50, newPct: 50 })).toEqual({ old: 1, next: 1 });
    expect(splitPortion(85, 'g', { oldPct: 75, newPct: 25 })).toEqual({ old: 64, next: 21 });
    expect(splitPortion(1, 'cans', { oldPct: 25, newPct: 75 })).toEqual({ old: 0.25, next: 0.75 });
    expect(mixSentence(food(), { day: 1, oldPct: 75, newPct: 25 })).toBe('1.5 cups old + 0.5 cups new per feeding');
    expect(mixSentence(food(), { day: 7, oldPct: 0, newPct: 100 })).toBe('2 cups of the new food per feeding');
    expect(mixSentence(food({ portionAmount: undefined }), { day: 1, oldPct: 75, newPct: 25 })).toBeNull();
  });
});

describe('spending', () => {
  const ex = (id: string, date: string, amount: number, category: Expense['category'], petId?: string): Expense => ({ id, householdId: 'h', date, amount, category, petId, createdAt: '', updatedAt: '' });
  const expenses = [ex('a', '2026-10-02', 50, 'vet', 'p1'), ex('b', '2026-10-10', 20, 'toys', 'p2'), ex('c', '2026-09-15', 30, 'grooming'), ex('d', '2026-07-01', 10, 'other', 'p1')];
  const priced = food({ purchases: [{ date: '2026-10-05', size: 24, unit: 'lb', price: 45.5 }, { date: '2026-09-05', size: 24, unit: 'lb' }] });
  const treat = food({ id: 't', kind: 'treat', purchases: [{ date: '2026-10-06', size: 1, unit: 'count', price: 8 }] });
  const entries = spendEntries(expenses, [priced, treat]);

  it('merges expenses with priced food purchases only', () => {
    expect(entries).toHaveLength(6);
    expect(entries.filter((e) => e.source === 'purchase').map((e) => e.category).sort()).toEqual(['food', 'treats']);
  });
  it('totals a month by category and pet', () => {
    const oct = inMonth(entries, '2026-10');
    expect(sum(oct)).toBe(123.5);
    expect(byCategory(oct)[0]).toEqual({ category: 'vet', total: 50 });
    expect(byPet(oct)).toEqual([{ petId: 'p1', total: 103.5 }, { petId: 'p2', total: 20 }]);
  });
  it('builds a 6 month trend oldest first', () => {
    const t = monthTrend(entries, '2026-10', 6);
    expect(t.map((x) => x.key)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(t.map((x) => x.total)).toEqual([0, 0, 10, 0, 30, 123.5]);
  });
  it('averages per pet over months with spending, splitting shared costs', () => {
    const avg = averagePerPet(entries, [{ id: 'p1' }, { id: 'p2' }], '2026-10', 6);
    // 3 months with spending; p1 own 113.5, p2 own 20, shared 30 split 15 each
    expect(avg).toEqual([{ petId: 'p1', average: 42.83 }, { petId: 'p2', average: 11.67 }]);
    expect(averagePerPet(entries, [], '2026-10')).toEqual([]);
  });
  it('shifts months and labels them', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(monthLabel('2026-10', true)).toBe('Oct');
  });
  it('parses amounts and exports CSV', () => {
    expect(parseAmount('$1,234.50')).toBe(1234.5);
    expect(parseAmount('12')).toBe(12);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1.234')).toBeNull();
    expect(parseAmount('')).toBeNull();
    const csv = spendingCsv(entries, [{ id: 'p1', name: 'Bailey' }]);
    expect(csv.split('\n')[0]).toBe('date,amount,category,pet,source,note');
    expect(csv).toContain('2026-10-05,45.50,Food,Bailey,food purchase,Acme Dry food');
  });
});

describe('samples and data for food extras', () => {
  it('samples include a labeled calorie target, kcal per bite, breakfast and 4 months of expenses', () => {
    const s = samplePets('h', day);
    const bailey = s.pets.find((p) => p.name === 'Bailey')!;
    expect(bailey.dailyCalorieTarget).toBe(SAMPLE_CALORIE_TARGET);
    expect(s.food.find((f) => f.id === 'sample-food-b-bites')!.kcalPerPiece).toBeGreaterThan(0);
    expect(s.feedings).toHaveLength(1);
    expect(s.feedings[0]).toMatchObject({ petId: bailey.id, day, slot: 0, isSample: true });
    expect(new Set(s.expenses.map((e) => e.date.slice(0, 7)))).toEqual(new Set(['2026-07', '2026-08', '2026-09', '2026-10']));
    expect(s.expenses.every((e) => e.isSample && e.note?.endsWith('(sample)') && e.date <= day)).toBe(true);
  });
  it('round-trips through export and import and cascades deletes', async () => {
    const db = createDb(createMemoryStore());
    await db.households.upsert({ id: 'hh', name: 'H', members: ['Sarah', 'Alex'], createdAt: '', updatedAt: '' });
    await loadSamplePets(db, 'hh');
    await db.treatLogs.upsert({ id: 't', householdId: 'hh', petId: 'sample-pet-bailey', foodId: 'sample-food-b-bites', day, count: 3, createdAt: '', updatedAt: '' });
    await db.switchPlans.upsert({ id: 's', householdId: 'hh', petId: 'sample-pet-bailey', oldFoodId: 'sample-food-b-food', newFoodId: 'x', days: 7, startDate: day, status: 'active', createdAt: '', updatedAt: '' });
    await db.expenses.upsert({ id: 'mine', householdId: 'hh', category: 'vet', amount: 40, date: day, petId: 'sample-pet-luna', createdAt: '', updatedAt: '' });
    const bundle = await exportAll(db, 'Test');
    expect(bundle.feedingLogs).toHaveLength(1);
    expect(bundle.treatLogs).toHaveLength(1);
    expect(bundle.switchPlans).toHaveLength(1);
    expect(bundle.expenses!.length).toBeGreaterThan(10);
    expect(bundle.household?.members).toEqual(['Sarah', 'Alex']);

    const b = createDb(createMemoryStore());
    await importAll(b, JSON.parse(JSON.stringify(bundle)));
    expect(await b.feedingLogs.list()).toHaveLength(1);
    expect(await b.switchPlans.list()).toHaveLength(1);
    expect((await b.households.list())[0].members).toEqual(['Sarah', 'Alex']);
    expect(await b.expenses.list()).toHaveLength(bundle.expenses!.length);

    await removePet(db, 'sample-pet-luna');
    expect((await db.expenses.get('mine'))?.petId).toBeUndefined();
    await removePet(db, 'sample-pet-bailey');
    expect(await db.feedingLogs.list()).toHaveLength(0);
    expect(await db.treatLogs.list()).toHaveLength(0);
    expect(await db.switchPlans.list()).toHaveLength(0);

    await loadSamplePets(db, 'hh');
    await removeSamplePets(db);
    expect((await db.expenses.list()).map((e) => e.id)).toEqual(['mine']);
    expect(await db.feedingLogs.list()).toHaveLength(0);

    await deleteAll(db);
    expect(await db.expenses.list()).toHaveLength(0);
  });
  it('imports older exports without the new lists', async () => {
    const db = createDb(createMemoryStore());
    await importAll(db, { version: 1, pets: [], household: { id: 'h', name: 'Old', createdAt: '', updatedAt: '' } });
    expect(await db.feedingLogs.list()).toHaveLength(0);
    expect((await db.households.list())[0].members).toBeUndefined();
  });
});
