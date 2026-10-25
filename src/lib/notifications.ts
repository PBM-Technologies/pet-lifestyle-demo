import type { AppNotification, CareEvent, Pet, PetEvent, TripPlan } from '../contracts/domain';
import { dueSoon } from './care';
import { daysBetween, formatDay, relativeDay, today } from './dates';

export const TRIP_WINDOW_DAYS = 14;
export const EVENT_WINDOW_DAYS = 7;

/** Derived in-app notifications. Dismissal is stored by id. */
export function buildNotifications(input: { pets: Pet[]; care: CareEvent[]; trips: TripPlan[]; events: PetEvent[] }, on: string = today()): AppNotification[] {
  const out: AppNotification[] = [];
  for (const d of dueSoon(input.care, input.pets, on)) {
    const name = d.pet?.name ?? 'Your pet';
    out.push({
      id: `care:${d.event.id}:${d.event.dueDate}`,
      kind: d.status === 'overdue' ? 'care_overdue' : 'care_due',
      title: `${name}: ${d.event.title} ${d.status === 'overdue' ? 'overdue' : 'due ' + relativeDay(d.event.dueDate as string, on)}`,
      body: `Due ${formatDay(d.event.dueDate)}`,
      date: d.event.dueDate as string,
      href: `#/pets/${d.event.petId}`,
      severity: d.status === 'overdue' ? 'danger' : d.daysUntil <= 7 ? 'warning' : 'info',
    });
  }
  for (const t of input.trips) {
    if (!t.startsOn) continue;
    const n = daysBetween(on, t.startsOn);
    if (n >= 0 && n <= TRIP_WINDOW_DAYS) {
      out.push({
        id: `trip:${t.id}:${t.startsOn}`,
        kind: 'trip_upcoming',
        title: `${t.title} starts ${relativeDay(t.startsOn, on)}`,
        body: 'Check your packing list and bring vaccine records.',
        date: t.startsOn,
        href: `#/travel/${t.id}`,
        severity: n <= 2 ? 'warning' : 'info',
      });
    }
  }
  for (const e of input.events) {
    const n = daysBetween(on, e.date);
    if (n >= 0 && n <= EVENT_WINDOW_DAYS && (e.rsvp === 'going' || e.rsvp === 'maybe' || !e.isSample)) {
      out.push({
        id: `event:${e.id}:${e.date}`,
        kind: 'event_upcoming',
        title: `${e.title} ${relativeDay(e.date, on)}`,
        body: e.locationText || 'Event',
        date: e.date,
        href: '#/events',
        severity: 'info',
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
