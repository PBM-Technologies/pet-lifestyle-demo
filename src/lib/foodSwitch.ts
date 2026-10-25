import type { FoodSwitchPlan, PetFoodItem, PortionUnit, SwitchPlanLength } from '../contracts/domain';
import { addDays, daysBetween, today } from './dates';
import { amountWithUnit } from './food';

export interface SwitchDay {
  /** 1-based day number. */
  day: number;
  oldPct: number;
  newPct: number;
}

export const SWITCH_NOTE = 'Slow down if you see an upset stomach and ask your vet.';

/**
 * Day by day mix of old and new food.
 * 7 days: 75/25 on days 1-2, 50/50 on 3-4, 25/75 on 5-6, all new on day 7.
 * 10 days: 75/25 on days 1-3, 50/50 on 4-6, 25/75 on 7-9, all new on day 10.
 */
export function switchSchedule(days: SwitchPlanLength): SwitchDay[] {
  const per = days === 7 ? 2 : 3;
  const out: SwitchDay[] = [];
  for (let d = 1; d <= days; d++) {
    const stage = d === days ? 3 : Math.floor((d - 1) / per);
    const newPct = [25, 50, 75, 100][stage];
    out.push({ day: d, oldPct: 100 - newPct, newPct });
  }
  return out;
}

/** 1-based plan day for `on`, 0 before the start, > days after the end. */
export function planDayNumber(plan: Pick<FoodSwitchPlan, 'startDate'>, on: string = today()): number {
  return daysBetween(plan.startDate, on) + 1;
}

export function planEndDate(plan: Pick<FoodSwitchPlan, 'startDate' | 'days'>): string {
  return addDays(plan.startDate, plan.days - 1);
}

/** Today's mix, or null before the plan starts or after it ends. */
export function todaysMix(plan: Pick<FoodSwitchPlan, 'startDate' | 'days'>, on: string = today()): SwitchDay | null {
  const n = planDayNumber(plan, on);
  if (n < 1 || n > plan.days) return null;
  return switchSchedule(plan.days)[n - 1];
}

/** True once the last day has passed, so the old food can be marked inactive. */
export function isPlanFinished(plan: Pick<FoodSwitchPlan, 'startDate' | 'days'>, on: string = today()): boolean {
  return planDayNumber(plan, on) > plan.days;
}

/** Splits one feeding into old and new amounts in the portion's unit. Rounded to the nearest 0.05 (or whole grams). */
export function splitPortion(portion: number, unit: PortionUnit, mix: Pick<SwitchDay, 'oldPct' | 'newPct'>): { old: number; next: number } {
  const step = unit === 'g' ? 1 : unit === 'pieces' ? 1 : 0.05;
  const round = (n: number) => Math.round(n / step) * step;
  const next = round((portion * mix.newPct) / 100);
  const old = Math.max(0, round(portion - next));
  return { old: Number(old.toFixed(2)), next: Number(next.toFixed(2)) };
}

/** "1.5 cups old food + 0.5 cups new food" for one feeding. */
export function mixSentence(oldFood: Pick<PetFoodItem, 'portionAmount' | 'portionUnit'>, mix: SwitchDay): string | null {
  if (!oldFood.portionAmount || !oldFood.portionUnit) return null;
  const { old, next } = splitPortion(oldFood.portionAmount, oldFood.portionUnit, mix);
  const u = oldFood.portionUnit;
  if (mix.newPct === 100) return `${amountWithUnit(next, u, 'portion')} of the new food per feeding`;
  return `${amountWithUnit(old, u, 'portion')} old + ${amountWithUnit(next, u, 'portion')} new per feeding`;
}
