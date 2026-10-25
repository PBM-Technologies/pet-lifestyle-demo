import type { CareEvent, CareEventType, Pet } from '../contracts/domain';
import { addDays, daysBetween, isValidDay, today } from './dates';

export const CARE_TYPE_LABEL: Record<CareEventType, string> = {
  vaccine: 'Vaccine',
  medication: 'Medication',
  flea_tick: 'Flea and tick',
  heartworm: 'Heartworm',
  vet_visit: 'Vet visit',
  grooming: 'Grooming',
  weight: 'Weight',
  note: 'Journal note',
};

/** Types that carry a next-due date and appear in reminders. */
export const SCHEDULED_TYPES: CareEventType[] = ['vaccine', 'medication', 'flea_tick', 'heartworm', 'vet_visit', 'grooming'];

export const DUE_SOON_DAYS = 30;

export type DueStatus = 'overdue' | 'due_soon' | 'upcoming' | 'none' | 'done';

export function dueStatus(e: Pick<CareEvent, 'dueDate' | 'completedAt'>, on: string = today(), windowDays = DUE_SOON_DAYS): DueStatus {
  if (!isValidDay(e.dueDate)) return 'none';
  if (e.completedAt) return 'done';
  const n = daysBetween(on, e.dueDate);
  if (n < 0) return 'overdue';
  if (n <= windowDays) return 'due_soon';
  return 'upcoming';
}

export interface DueItem {
  event: CareEvent;
  pet?: Pet;
  status: 'overdue' | 'due_soon';
  daysUntil: number;
}

/** Open care items that are overdue or due within the window, soonest first. */
export function dueSoon(events: CareEvent[], pets: Pet[], on: string = today(), windowDays = DUE_SOON_DAYS): DueItem[] {
  const byId = new Map(pets.map((p) => [p.id, p]));
  return events
    .filter((e) => SCHEDULED_TYPES.includes(e.type))
    .map((e) => ({ e, s: dueStatus(e, on, windowDays) }))
    .filter((x): x is { e: CareEvent; s: 'overdue' | 'due_soon' } => x.s === 'overdue' || x.s === 'due_soon')
    .map(({ e, s }) => ({ event: e, pet: byId.get(e.petId), status: s, daysUntil: daysBetween(on, e.dueDate as string) }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * Marks a scheduled item done. For repeating items, returns the next
 * occurrence to create (given today, due again after repeatDays).
 */
export function completeCareEvent(e: CareEvent, on: string = today(), nowIso = new Date().toISOString()): { done: CareEvent; next?: CareEvent } {
  const done: CareEvent = { ...e, completedAt: nowIso, updatedAt: nowIso };
  if (e.repeatDays && e.repeatDays > 0) {
    const next: CareEvent = {
      ...e,
      id: e.id + '-n' + Date.now().toString(36),
      date: on,
      dueDate: addDays(on, e.repeatDays),
      completedAt: undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
      isSample: false,
    };
    return { done, next };
  }
  return { done };
}

/** Weight series for the chart, oldest first. Includes the pet's current weight only if there is no history. */
export function weightSeries(events: CareEvent[], petId: string): Array<{ date: string; value: number }> {
  return events
    .filter((e) => e.petId === petId && e.type === 'weight' && typeof e.value === 'number' && isValidDay(e.date))
    .map((e) => ({ date: e.date, value: e.value as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
