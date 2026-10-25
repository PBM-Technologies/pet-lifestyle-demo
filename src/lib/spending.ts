import type { Expense, ExpenseCategory, Pet, PetFoodItem } from '../contracts/domain';
import { isValidDay, parseDay, today } from './dates';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['food', 'treats', 'toys', 'meds', 'vet', 'grooming', 'boarding', 'supplies', 'other'];

export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  food: 'Food',
  treats: 'Treats',
  toys: 'Toys',
  meds: 'Meds and preventives',
  vet: 'Vet',
  grooming: 'Grooming',
  boarding: 'Boarding and sitting',
  supplies: 'Supplies',
  other: 'Other',
};

/** One line of spending, from a manual expense or a food purchase with a price. */
export interface SpendEntry {
  id: string;
  source: 'expense' | 'purchase';
  date: string;
  amount: number;
  category: ExpenseCategory;
  petId?: string;
  label: string;
  /** Expense id or food item id. */
  refId: string;
  isSample?: boolean;
}

/** Turns expenses and priced food purchases into one list. Purchases without a price are skipped. */
export function spendEntries(expenses: Expense[], food: PetFoodItem[]): SpendEntry[] {
  const out: SpendEntry[] = [];
  for (const e of expenses) {
    if (!(e.amount >= 0) || !isValidDay(e.date)) continue;
    out.push({ id: 'e:' + e.id, source: 'expense', date: e.date, amount: e.amount, category: e.category, petId: e.petId, label: e.note || EXPENSE_LABEL[e.category], refId: e.id, isSample: e.isSample });
  }
  for (const f of food) {
    f.purchases.forEach((p, i) => {
      if (p.price === undefined || !(p.price >= 0) || !isValidDay(p.date)) return;
      out.push({ id: `p:${f.id}:${i}`, source: 'purchase', date: p.date, amount: p.price, category: f.kind === 'treat' ? 'treats' : 'food', petId: f.petId, label: `${f.brand} ${f.product}`, refId: f.id, isSample: f.isSample });
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);
}

/** "2026-10" */
export function monthKey(day: string): string {
  return day.slice(0, 7);
}

export function shiftMonth(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function monthLabel(key: string, short = false): string {
  const [y, m] = key.split('-').map(Number);
  const name = MONTHS[(m || 1) - 1];
  return short ? name.slice(0, 3) : `${name} ${y}`;
}

export const sum = (xs: SpendEntry[]) => Math.round(xs.reduce((a, x) => a + x.amount, 0) * 100) / 100;

export function inMonth(entries: SpendEntry[], key: string): SpendEntry[] {
  return entries.filter((e) => monthKey(e.date) === key);
}

/** Category totals, largest first, zero categories left out. */
export function byCategory(entries: SpendEntry[]): Array<{ category: ExpenseCategory; total: number }> {
  const m = new Map<ExpenseCategory, number>();
  for (const e of entries) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
  return [...m.entries()].map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 })).sort((a, b) => b.total - a.total);
}

/** Totals per pet id; untagged spending is under the key "" (shared). */
export function byPet(entries: SpendEntry[]): Array<{ petId: string; total: number }> {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.petId ?? '', (m.get(e.petId ?? '') ?? 0) + e.amount);
  return [...m.entries()].map(([petId, total]) => ({ petId, total: Math.round(total * 100) / 100 })).sort((a, b) => b.total - a.total);
}

/** Totals for the `n` months ending with `endKey`, oldest first. */
export function monthTrend(entries: SpendEntry[], endKey: string, n = 6): Array<{ key: string; total: number }> {
  const out: Array<{ key: string; total: number }> = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = shiftMonth(endKey, -i);
    out.push({ key, total: sum(inMonth(entries, key)) });
  }
  return out;
}

/**
 * Average monthly cost per pet over the `n` months ending with `endKey`.
 * Divides by the months in that window that have any spending (at least 1),
 * so a new household is not averaged against empty months. Shared spending
 * (no pet tagged) is split evenly across pets.
 */
export function averagePerPet(entries: SpendEntry[], pets: Pick<Pet, 'id'>[], endKey: string, n = 6): Array<{ petId: string; average: number }> {
  if (!pets.length) return [];
  const window = new Set(monthTrend(entries, endKey, n).map((t) => t.key));
  const inWin = entries.filter((e) => window.has(monthKey(e.date)));
  const months = Math.max(1, new Set(inWin.map((e) => monthKey(e.date))).size);
  const ids = new Set(pets.map((p) => p.id));
  const shared = inWin.filter((e) => !e.petId || !ids.has(e.petId)).reduce((a, e) => a + e.amount, 0) / pets.length;
  return pets.map((p) => {
    const own = inWin.filter((e) => e.petId === p.id).reduce((a, e) => a + e.amount, 0);
    return { petId: p.id, average: Math.round(((own + shared) / months) * 100) / 100 };
  });
}

export function formatMoney(n: number): string {
  const v = Math.round(n * 100) / 100;
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
}

/** Parses "$12.50", "12.5" or "12". Null when empty or invalid. */
export function parseAmount(s: string): number | null {
  const t = s.replace(/[$,\s]/g, '');
  if (!t || !/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n < 1_000_000 ? n : null;
}

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function spendingCsv(entries: SpendEntry[], pets: Pick<Pet, 'id' | 'name'>[]): string {
  const names = new Map(pets.map((p) => [p.id, p.name]));
  const header = ['date', 'amount', 'category', 'pet', 'source', 'note'];
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date)).map((e) =>
    [e.date, e.amount.toFixed(2), EXPENSE_LABEL[e.category], e.petId ? names.get(e.petId) ?? '' : '', e.source === 'purchase' ? 'food purchase' : 'expense', e.label].map(csvCell).join(','));
  return [header.join(','), ...rows].join('\n');
}

export function currentMonth(on: string = today()): string {
  return monthKey(isValidDay(on) ? on : today());
}

/** Keeps a month key inside sane bounds for the month switcher. */
export function isMonthKey(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}$/.test(s) && !Number.isNaN(parseDay(s + '-01').getTime());
}
