import type { FeedingLog, FoodSwitchPlan, PetFoodItem, TreatLog } from '../contracts/domain';
import { today } from './dates';

/* ---------- feeding check-off ---------- */

const SLOT_SETS: Record<number, string[]> = {
  1: ['Meal'],
  2: ['Breakfast', 'Dinner'],
  3: ['Breakfast', 'Lunch', 'Dinner'],
  4: ['Breakfast', 'Lunch', 'Dinner', 'Late'],
};

/** Labels for each scheduled feeding, from feedings per day (1 to 4). */
export function feedingSlots(timesPerDay: number | undefined): string[] {
  const n = Math.min(4, Math.max(1, Math.round(timesPerDay ?? 2)));
  return SLOT_SETS[n];
}

/**
 * The food a pet's checklist follows: the old food of an active switch plan,
 * otherwise the oldest active food.
 */
export function mainFood(items: PetFoodItem[], petId: string, plans: FoodSwitchPlan[] = []): PetFoodItem | undefined {
  const foods = items.filter((f) => f.petId === petId && f.kind === 'food' && f.active).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const plan = activePlan(plans, petId);
  return (plan && foods.find((f) => f.id === plan.oldFoodId)) || foods[0];
}

export function activePlan(plans: FoodSwitchPlan[], petId: string): FoodSwitchPlan | undefined {
  return plans.find((p) => p.petId === petId && p.status === 'active');
}

/** Today's logs for one pet, keyed by slot. Only logs from `day` count, so the list resets daily. */
export function logsForDay(logs: FeedingLog[], petId: string, day: string = today()): Map<number, FeedingLog> {
  const out = new Map<number, FeedingLog>();
  for (const l of logs) {
    if (l.petId !== petId || l.day !== day) continue;
    const prev = out.get(l.slot);
    if (!prev || prev.fedAt < l.fedAt) out.set(l.slot, l);
  }
  return out;
}

/** "7:40 AM" in local time from an ISO timestamp. */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Bailey was fed at 7:40 AM by Sarah" */
export function fedSentence(petName: string, log: Pick<FeedingLog, 'fedAt' | 'fedBy'>): string {
  return `${petName} was fed at ${clockTime(log.fedAt)}${log.fedBy ? ` by ${log.fedBy}` : ''}`;
}

/** Latest feeding of the day, or undefined. */
export function lastFed(byslot: Map<number, FeedingLog>): FeedingLog | undefined {
  return [...byslot.values()].sort((a, b) => b.fedAt.localeCompare(a.fedAt))[0];
}

/** Cleans a typed name list: trimmed, no blanks, no duplicates (case-insensitive), max 12. */
export function cleanMembers(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const n = raw.trim().replace(/\s+/g, ' ').slice(0, 30);
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
  }
  return out.slice(0, 12);
}

/* ---------- treat budget ---------- */

/** Common guideline: treats at no more than about 10 percent of daily calories. */
export const TREAT_SHARE = 0.1;
export const CALORIE_HELP = "Ask your vet for your pet's daily calories; a common guideline is treats at no more than about 10 percent of daily calories";

export function treatAllowance(dailyTarget: number | undefined): number | null {
  if (!dailyTarget || !(dailyTarget > 0)) return null;
  return Math.round(dailyTarget * TREAT_SHARE);
}

export interface TreatDay {
  /** Calories from treats with a known kcal per piece. */
  kcal: number;
  pieces: number;
  /** Pieces given of treats that have no kcal set. */
  uncounted: number;
  allowance: number | null;
  /** kcal / allowance, or null without a target. */
  fraction: number | null;
  over: boolean;
}

export function treatCount(logs: TreatLog[], foodId: string, day: string = today()): number {
  return logs.filter((l) => l.foodId === foodId && l.day === day).reduce((a, l) => a + l.count, 0);
}

export function treatDay(logs: TreatLog[], treats: PetFoodItem[], petId: string, dailyTarget: number | undefined, day: string = today()): TreatDay {
  const byId = new Map(treats.map((t) => [t.id, t]));
  let kcal = 0, pieces = 0, uncounted = 0;
  for (const l of logs) {
    if (l.petId !== petId || l.day !== day || l.count <= 0) continue;
    pieces += l.count;
    const k = byId.get(l.foodId)?.kcalPerPiece;
    if (k && k > 0) kcal += k * l.count;
    else uncounted += l.count;
  }
  const allowance = treatAllowance(dailyTarget);
  const fraction = allowance ? kcal / allowance : null;
  return { kcal: Math.round(kcal), pieces, uncounted, allowance, fraction, over: fraction !== null && fraction > 1 };
}

/** Next count after a +1 or -1 tap, never below 0 or above 99. */
export function stepCount(count: number, delta: 1 | -1): number {
  return Math.max(0, Math.min(99, count + delta));
}
