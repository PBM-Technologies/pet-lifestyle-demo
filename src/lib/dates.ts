/** Date helpers that work on local calendar days (YYYY-MM-DD). */

export function newId(prefix = ''): string {
  try {
    if (globalThis.crypto && 'randomUUID' in globalThis.crypto) return prefix + globalThis.crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function toDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return toDay(new Date());
}

export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

export function addYears(day: string, n: number): string {
  const d = parseDay(day);
  d.setFullYear(d.getFullYear() + n);
  return toDay(d);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const a = parseDay(from);
  const b = parseDay(to);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function isValidDay(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseDay(s);
  return toDay(d) === s;
}

export interface Age {
  years: number;
  months: number;
}

export function ageOn(birthDate: string, on: string = today()): Age | null {
  if (!isValidDay(birthDate) || !isValidDay(on)) return null;
  const b = parseDay(birthDate);
  const t = parseDay(on);
  if (t < b) return null;
  let months = (t.getFullYear() - b.getFullYear()) * 12 + (t.getMonth() - b.getMonth());
  if (t.getDate() < b.getDate()) months -= 1;
  return { years: Math.floor(months / 12), months: months % 12 };
}

export function formatAge(birthDate: string | undefined, on: string = today()): string {
  if (!birthDate) return 'Age unknown';
  const a = ageOn(birthDate, on);
  if (!a) return 'Age unknown';
  if (a.years === 0 && a.months === 0) return 'Under 1 month';
  if (a.years === 0) return `${a.months} mo`;
  if (a.years < 2 && a.months > 0) return `${a.years} yr ${a.months} mo`;
  return `${a.years} yr${a.years === 1 ? '' : 's'}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDay(day: string | undefined, withWeekday = false): string {
  if (!isValidDay(day)) return '';
  const d = parseDay(day);
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  return withWeekday ? `${WEEKDAYS[d.getDay()]}, ${base}` : base;
}

export function formatTime(t: string | undefined): string {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return '';
  const [h, m] = t.split(':').map(Number);
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Friendly relative label: "today", "in 3 days", "5 days ago". */
export function relativeDay(day: string, from: string = today()): string {
  const n = daysBetween(from, day);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
