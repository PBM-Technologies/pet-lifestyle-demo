import type { PartnerBrand } from '../config/brand';
import type { FoodPurchase, PackageUnit, PetFoodItem, PortionUnit } from '../contracts/domain';
import { addDays, daysBetween, isValidDay, parseDay, today } from './dates';

/** Most kibble is 3.5 to 5 cups per pound; 4 is a middle-of-the-road default. */
export const DEFAULT_CUPS_PER_LB = 4;
export const DEFAULT_REORDER_LEAD_DAYS = 7;
export const CUPS_PER_LB_HINT = 'Check the feeding chart on your bag; most kibble is 3.5 to 5 cups per pound';

export const PACKAGE_UNITS: PackageUnit[] = ['lb', 'kg', 'oz', 'g', 'cans', 'pouches', 'count'];
export const PORTION_UNITS: PortionUnit[] = ['cups', 'g', 'oz', 'cans', 'pouches', 'pieces'];

export const PACKAGE_UNIT_LABEL: Record<PackageUnit, string> = { lb: 'lb', kg: 'kg', oz: 'oz', g: 'g', cans: 'cans', pouches: 'pouches', count: 'pieces' };
export const PORTION_UNIT_LABEL: Record<PortionUnit, string> = { cups: 'cups', g: 'g', oz: 'oz', cans: 'cans', pouches: 'pouches', pieces: 'pieces' };

const GRAMS: Partial<Record<PackageUnit | PortionUnit, number>> = { lb: 453.59237, kg: 1000, oz: 28.349523125, g: 1 };
const isWeight = (u: string) => GRAMS[u as PackageUnit] !== undefined;

/** Portion units that count whole things, and the package units they match 1:1. */
const COUNT_MATCH: Partial<Record<PortionUnit, PackageUnit[]>> = {
  cans: ['cans', 'count'],
  pouches: ['pouches', 'count'],
  pieces: ['count'],
};

/** True when a cups portion is measured against a bag sold by weight. */
export function needsCupsPerLb(portionUnit: PortionUnit | undefined, packageUnit: PackageUnit | undefined): boolean {
  return portionUnit === 'cups' && !!packageUnit && isWeight(packageUnit);
}

/**
 * Converts a portion into package units. Returns null when the two units
 * cannot be related (for example cups against a case of cans).
 */
export function convertPortion(amount: number, portionUnit: PortionUnit, packageUnit: PackageUnit, cupsPerLb: number = DEFAULT_CUPS_PER_LB): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (portionUnit === 'cups') {
    if (!isWeight(packageUnit) || !(cupsPerLb > 0)) return null;
    const lb = amount / cupsPerLb;
    return (lb * (GRAMS.lb as number)) / (GRAMS[packageUnit] as number);
  }
  if (isWeight(portionUnit)) {
    if (!isWeight(packageUnit)) return null;
    return (amount * (GRAMS[portionUnit] as number)) / (GRAMS[packageUnit] as number);
  }
  return COUNT_MATCH[portionUnit]?.includes(packageUnit) ? amount : null;
}

export function unitsCompatible(portionUnit: PortionUnit, packageUnit: PackageUnit): boolean {
  return convertPortion(1, portionUnit, packageUnit, DEFAULT_CUPS_PER_LB) !== null;
}

export type FoodStatus = 'ok' | 'reorder_soon' | 'out';

export const FOOD_STATUS_LABEL: Record<FoodStatus, string> = { ok: 'Plenty', reorder_soon: 'Reorder soon', out: 'Probably out' };

export interface FoodEstimate {
  /** Package units used per day. */
  dailyUse: number;
  /** Days a full package lasts at this rate. */
  daysPerBag: number;
  daysSincePurchase: number;
  /** Estimated amount left in package units, never below 0. */
  left: number;
  /** 0 to 1. */
  fractionLeft: number;
  /** Day the package runs out (YYYY-MM-DD). */
  runOutDate: string;
  /** Whole days until runOutDate (negative when past). */
  daysLeft: number;
  status: FoodStatus;
}

type Trackable = Pick<PetFoodItem, 'packageSize' | 'packageUnit' | 'purchasedOn' | 'portionAmount' | 'portionUnit' | 'timesPerDay' | 'cupsPerLb' | 'reorderLeadDays'>;

/** True when every field needed for an estimate is filled in. */
export function isTracked(i: Trackable): boolean {
  return !!(i.packageSize && i.packageSize > 0 && i.packageUnit && isValidDay(i.purchasedOn) && i.portionAmount && i.portionAmount > 0 && i.portionUnit && i.timesPerDay && i.timesPerDay > 0);
}

/** Daily use in package units, or null when untracked or units do not convert. */
export function dailyUsage(i: Trackable): number | null {
  if (!i.portionAmount || !i.portionUnit || !i.packageUnit || !i.timesPerDay) return null;
  const per = convertPortion(i.portionAmount, i.portionUnit, i.packageUnit, i.cupsPerLb ?? DEFAULT_CUPS_PER_LB);
  return per === null ? null : per * i.timesPerDay;
}

/** Days a full package lasts, or null. */
export function daysPerPackage(i: Trackable): number | null {
  const d = dailyUsage(i);
  if (!d || !i.packageSize) return null;
  return i.packageSize / d;
}

export function daysSincePurchase(purchasedOn: string, on: string = today()): number {
  return Math.max(0, daysBetween(purchasedOn, on));
}

export function estimateFood(i: Trackable, on: string = today()): FoodEstimate | null {
  if (!isTracked(i)) return null;
  const dailyUse = dailyUsage(i);
  if (!dailyUse || dailyUse <= 0) return null;
  const size = i.packageSize as number;
  const daysPerBag = size / dailyUse;
  const since = daysSincePurchase(i.purchasedOn as string, on);
  const left = Math.max(0, size - dailyUse * since);
  const runOutDate = addDays(i.purchasedOn as string, Math.floor(daysPerBag));
  const daysLeft = daysBetween(on, runOutDate);
  const lead = i.reorderLeadDays ?? DEFAULT_REORDER_LEAD_DAYS;
  const status: FoodStatus = left <= 0 || daysLeft <= 0 ? 'out' : daysLeft <= lead ? 'reorder_soon' : 'ok';
  return { dailyUse, daysPerBag, daysSincePurchase: since, left, fractionLeft: left / size, runOutDate, daysLeft, status };
}

/** Average days between consecutive purchases, from 2 or more. */
export function learnedDaysPerBag(purchases: FoodPurchase[]): number | null {
  const days = purchases.map((p) => p.date).filter((d) => isValidDay(d)).sort();
  if (days.length < 2) return null;
  const gaps: number[] = [];
  for (let k = 1; k < days.length; k++) gaps.push(daysBetween(days[k - 1], days[k]));
  const useful = gaps.filter((g) => g > 0);
  if (!useful.length) return null;
  return Math.round(useful.reduce((a, b) => a + b, 0) / useful.length);
}

/** Logs a new package bought on `on`, same size unless given, and resets the estimate. */
export function logNewPurchase(item: PetFoodItem, on: string = today(), nowIso: string = new Date().toISOString(), override: Partial<FoodPurchase> = {}): PetFoodItem {
  const size = override.size ?? item.packageSize ?? 0;
  const unit = override.unit ?? item.packageUnit ?? 'lb';
  const purchase: FoodPurchase = { date: override.date ?? on, size, unit, ...(override.price !== undefined ? { price: override.price } : {}) };
  const purchases = [...item.purchases, purchase].sort((a, b) => a.date.localeCompare(b.date));
  const latest = purchases[purchases.length - 1];
  return { ...item, purchases, packageSize: latest.size, packageUnit: latest.unit, purchasedOn: latest.date, updatedAt: nowIso };
}

/** Partner whose name matches the brand, ignoring case and extra spaces. */
export function partnerForBrand<P extends Pick<PartnerBrand, 'name'>>(brand: string, partners: readonly P[]): P | undefined {
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const b = norm(brand);
  if (!b) return undefined;
  return partners.find((p) => norm(p.name) === b);
}

/* ---------- copy helpers (plain words, no em dashes) ---------- */

export function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n >= 10) return String(Math.round(n));
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function amountWithUnit(n: number, unit: PackageUnit | PortionUnit, kind: 'package' | 'portion' = 'package'): string {
  const label = kind === 'package' ? PACKAGE_UNIT_LABEL[unit as PackageUnit] : PORTION_UNIT_LABEL[unit as PortionUnit];
  let l = label ?? unit;
  if (n === 1 && (l === 'cups' || l === 'cans' || l === 'pouches' || l === 'pieces')) l = l === 'pouches' ? 'pouch' : l.slice(0, -1);
  return `${formatAmount(n)} ${l}`;
}

export function timesWord(n: number): string {
  return n === 1 ? 'once a day' : n === 2 ? 'twice a day' : `${n} times a day`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function shortDay(day: string): string {
  if (!isValidDay(day)) return '';
  const d = parseDay(day);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "At 2 cups twice a day, a 24 lb bag lasts about 24 days" */
export function usageSentence(i: Trackable & { kind?: PetFoodItem['kind'] }): string | null {
  const days = daysPerPackage(i);
  if (days === null || !i.portionAmount || !i.portionUnit || !i.timesPerDay || !i.packageSize || !i.packageUnit) return null;
  const pkg = i.packageUnit === 'cans' ? 'case' : i.packageUnit === 'pouches' ? 'box' : 'bag';
  const d = Math.max(1, Math.round(days));
  return `At ${amountWithUnit(i.portionAmount, i.portionUnit, 'portion')} ${timesWord(i.timesPerDay)}, a ${amountWithUnit(i.packageSize, i.packageUnit)} ${pkg} lasts about ${d} day${d === 1 ? '' : 's'}`;
}

/** "About 9 lb left of 24 lb, runs out around Nov 18" */
export function leftSentence(i: Trackable, e: FoodEstimate): string {
  const unit = i.packageUnit as PackageUnit;
  if (e.status === 'out') return `Probably ran out around ${shortDay(e.runOutDate)}`;
  return `About ${amountWithUnit(e.left, unit)} left of ${amountWithUnit(i.packageSize as number, unit)}, runs out around ${shortDay(e.runOutDate)}`;
}

/** "Bailey's food runs out in about 5 days" */
export function runOutSentence(petName: string, item: Pick<PetFoodItem, 'kind' | 'product'>, e: FoodEstimate): string {
  const what = item.kind === 'food' ? `${petName}'s food` : `${petName}'s ${item.product}`;
  if (e.status === 'out') return `${what} is probably out`;
  if (e.daysLeft === 1) return `${what} runs out tomorrow`;
  return `${what} runs out in about ${e.daysLeft} days`;
}

export function learnedSentence(purchases: FoodPurchase[]): string | null {
  const n = learnedDaysPerBag(purchases);
  return n === null ? null : `Your last bags lasted about ${n} day${n === 1 ? '' : 's'}`;
}

/** Items that need attention, most urgent first. */
export function foodAlerts<T extends PetFoodItem>(items: T[], on: string = today()): Array<{ item: T; estimate: FoodEstimate }> {
  return items
    .filter((i) => i.active)
    .map((item) => ({ item, estimate: estimateFood(item, on) }))
    .filter((x): x is { item: T; estimate: FoodEstimate } => !!x.estimate && x.estimate.status !== 'ok')
    .sort((a, b) => a.estimate.daysLeft - b.estimate.daysLeft);
}
