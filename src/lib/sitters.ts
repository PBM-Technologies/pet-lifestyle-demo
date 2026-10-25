import type { CareEvent, FoodSwitchPlan, Household, Pet, PetFoodItem, SitterService, SitterSource, Species } from '../contracts/domain';
import { addDays, isValidDay, today } from './dates';
import { amountWithUnit, shortDay, timesWord } from './food';
import { feedingSlots, mainFood, activePlan, treatAllowance } from './feeding';
import { mixSentence, todaysMix } from './foodSwitch';

/**
 * Sitter provider adapter.
 *
 * Today a provider is only a link out: none of the big sitter marketplaces
 * offer a public booking API, so the app never pretends to search or book.
 * Real in-app search and booking need a partner agreement or API access;
 * when that exists, implement buildSearchUrl (or a richer search method) on
 * the provider here and the request flow picks it up without UI changes.
 * The provider list itself is configured in src/config/brand.ts.
 */
export interface SitterProvider {
  id: string;
  name: string;
  services: SitterService[];
  species: Species[];
  /** Home page. Only verified home pages are used; no guessed deep links. */
  url: string;
  /** Optional deep link for a search, once a provider documents one. */
  buildSearchUrl?: (q: SitterQuery) => string;
}

export interface SitterQuery {
  services: SitterService[];
  species: Species[];
  startsOn?: string;
  endsOn?: string;
  location?: string;
}

export const FRIEND_FAMILY: SitterSource = 'friend_family';

export const SERVICES: SitterService[] = ['drop_in', 'house_sitting', 'boarding', 'dog_walking', 'day_care'];

export const SERVICE_LABEL: Record<SitterService, string> = {
  boarding: 'Boarding',
  house_sitting: 'House sitting',
  drop_in: 'Drop-in visits',
  dog_walking: 'Dog walking',
  day_care: 'Day care',
};

export const SERVICE_HINT: Record<SitterService, string> = {
  boarding: "Stays at the sitter's home",
  house_sitting: 'Sitter stays at your home',
  drop_in: 'Short visits to feed and check in',
  dog_walking: 'Walks while you are out',
  day_care: 'Daytime care, home by evening',
};

/** Services that make sense for the chosen pets (dog walking only with a dog). */
export function servicesForSpecies(species: Species[]): SitterService[] {
  return SERVICES.filter((s) => (s === 'dog_walking' || s === 'day_care' ? species.length === 0 || species.includes('dog') : true));
}

export function speciesOf(pets: Array<Pick<Pet, 'species'>>): Species[] {
  return [...new Set(pets.map((p) => p.species))];
}

/**
 * Providers that offer at least one of the chosen services and take every
 * chosen species. With no service chosen, any service matches.
 */
export function providersFor<P extends Pick<SitterProvider, 'services' | 'species'>>(providers: readonly P[], services: SitterService[], species: Species[]): P[] {
  return providers.filter((p) => (services.length === 0 || services.some((s) => p.services.includes(s))) && species.every((sp) => p.species.includes(sp)));
}

/** Where a "Search on" button goes: the provider's own search link if it has one, otherwise its home page. */
export function providerHref(p: Pick<SitterProvider, 'url' | 'buildSearchUrl'>, q: SitterQuery): string {
  return p.buildSearchUrl ? p.buildSearchUrl(q) : p.url;
}

export function sourceLabel(source: SitterSource, providers: readonly Pick<SitterProvider, 'id' | 'name'>[]): string {
  if (source === FRIEND_FAMILY) return 'Friend or family';
  return providers.find((p) => p.id === source)?.name ?? 'Other';
}

/** "Nov 3", "Nov 3 to 5" or "Oct 30 to Nov 1". */
export function dateRange(start: string, end?: string): string {
  if (!isValidDay(start)) return '';
  if (!end || !isValidDay(end) || end === start) return shortDay(start);
  const a = shortDay(start), b = shortDay(end);
  return a.split(' ')[0] === b.split(' ')[0] ? `${a} to ${b.split(' ')[1]}` : `${a} to ${b}`;
}

/** "Sitter needed Nov 3 to 5" */
export function sitterNeededLine(r: { startsOn: string; endsOn: string }): string {
  return `Sitter needed ${dateRange(r.startsOn, r.endsOn)}`;
}

/** Validates a request draft. Returns field errors. */
export function validateRequest(d: { petIds: string[]; services: SitterService[]; startsOn: string; endsOn: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.petIds.length) e.pets = 'Pick at least one pet.';
  if (!d.services.length) e.services = 'Pick the kind of care you need.';
  if (!isValidDay(d.startsOn)) e.startsOn = 'Pick a start date.';
  if (!isValidDay(d.endsOn)) e.endsOn = 'Pick an end date.';
  else if (isValidDay(d.startsOn) && d.endsOn < d.startsOn) e.endsOn = 'End date must be on or after the start.';
  return e;
}

/** Copy-friendly phone: keeps digits, plus and common separators. */
export function cleanPhone(s: string): string {
  return s.replace(/[^0-9+()\-.\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
}

export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/* ---------- care sheet ---------- */

export interface CareSheetInput {
  pets: Pet[];
  food: PetFoodItem[];
  switchPlans: FoodSwitchPlan[];
  care: CareEvent[];
  household: Household | null;
  startsOn?: string;
  endsOn?: string;
  /** Today, for the switch plan mix and undated sheets. */
  on?: string;
}

export interface SheetSection { title: string; lines: string[] }
export interface PetSheet { petId: string; name: string; subtitle: string; sections: SheetSection[] }
export interface CareSheet { title: string; dates: string; pets: PetSheet[]; household: SheetSection[] }

const MED_TYPES: CareEvent['type'][] = ['medication', 'flea_tick', 'heartworm'];
const SPECIES_WORD: Record<Species, string> = { dog: 'Dog', cat: 'Cat', other: 'Pet' };

function foodName(f: PetFoodItem): string {
  return [f.brand, f.product].filter(Boolean).join(' ') + (f.flavor ? `, ${f.flavor}` : '');
}

function portionLine(f: PetFoodItem): string | null {
  if (!f.portionAmount || !f.portionUnit) return null;
  return `${amountWithUnit(f.portionAmount, f.portionUnit, 'portion')} ${timesWord(f.timesPerDay ?? 1)}`;
}

/** Due dates of a med or preventive inside [from, to], following its repeat interval. */
export function dueDatesIn(e: CareEvent, from: string, to: string): string[] {
  if (!e.dueDate || e.completedAt || !isValidDay(e.dueDate)) return [];
  const out: string[] = [];
  let d = e.dueDate;
  if (e.repeatDays && e.repeatDays > 0) {
    let guard = 0;
    while (d < from && guard++ < 400) d = addDays(d, e.repeatDays);
    while (d <= to && guard++ < 800) { out.push(d); d = addDays(d, e.repeatDays); }
  } else if (d >= from && d <= to) out.push(d);
  return out;
}

function list(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Builds a sitter care sheet from data already in the app. Pure. */
export function buildCareSheet(input: CareSheetInput): CareSheet {
  const on = input.on ?? today();
  const hasDates = isValidDay(input.startsOn) && isValidDay(input.endsOn);
  const from = hasDates ? (input.startsOn as string) : on;
  const to = hasDates ? (input.endsOn as string) : addDays(on, 14);
  const pets: PetSheet[] = input.pets.map((pet) => {
    const sections: SheetSection[] = [];
    const items = input.food.filter((f) => f.petId === pet.id && f.active);
    const main = mainFood(input.food, pet.id, input.switchPlans);
    const plan = activePlan(input.switchPlans, pet.id);

    const feeding: string[] = [];
    if (main) {
      const portion = portionLine(main);
      feeding.push(`Food: ${foodName(main)}${portion ? `, ${portion}` : ''}`);
      feeding.push(`Feedings: ${list(feedingSlots(main.timesPerDay))}`);
      const mix = plan && plan.oldFoodId === main.id ? todaysMix(plan, on) : null;
      if (plan && mix) {
        const next = input.food.find((f) => f.id === plan.newFoodId);
        const m = mixSentence(main, mix);
        feeding.push(`Switching to ${next ? foodName(next) : 'a new food'}. Today's mix: ${m ?? `${mix.oldPct}% old, ${mix.newPct}% new`}`);
      }
    }
    for (const f of items.filter((x) => x.kind === 'food' && x.id !== main?.id && x.id !== plan?.newFoodId)) {
      const portion = portionLine(f);
      feeding.push(`Also: ${foodName(f)}${portion ? `, ${portion}` : ''}`);
    }
    if (!feeding.length) feeding.push('No food saved yet. Ask before feeding.');
    if (pet.dietaryNotes) feeding.push(`Diet notes: ${pet.dietaryNotes}`);
    sections.push({ title: 'Feeding', lines: feeding });

    const treats = items.filter((f) => f.kind === 'treat');
    const treatLines: string[] = treats.map((t) => `${foodName(t)}${t.kcalPerPiece ? ` (${t.kcalPerPiece} kcal each)` : ''}`);
    const allowance = treatAllowance(pet.dailyCalorieTarget);
    if (allowance) {
      treatLines.push(`Limit: about ${allowance} kcal of treats a day`);
      for (const t of treats) if (t.kcalPerPiece && t.kcalPerPiece > 0) treatLines.push(`That is about ${Math.max(1, Math.floor(allowance / t.kcalPerPiece))} pieces of ${t.product} if it is the only treat`);
    }
    if (!treats.length) treatLines.unshift('No treats listed. Ask first.');
    sections.push({ title: 'Treats and limits', lines: treatLines });

    const meds = input.care
      .filter((c) => c.petId === pet.id && MED_TYPES.includes(c.type))
      .flatMap((c) => dueDatesIn(c, from, to).map((d) => ({ d, line: `${c.title}: due ${shortDay(d)}${c.notes ? `. ${c.notes}` : ''}` })))
      .sort((a, b) => a.d.localeCompare(b.d))
      .map((x) => x.line);
    sections.push({ title: hasDates ? 'Meds and preventives due during your stay' : 'Meds and preventives due in the next 2 weeks', lines: meds.length ? meds : ['Nothing due.'] });

    sections.push({ title: 'Allergies', lines: [pet.allergies.length ? pet.allergies.join(', ') : 'None known'] });
    sections.push({ title: 'Vet', lines: [pet.vetName || pet.vetPhone ? [pet.vetName, pet.vetPhone].filter(Boolean).join(', ') : 'Not saved'] });
    sections.push({ title: 'Microchip', lines: [pet.microchip || 'Not saved'] });
    if (pet.quirks) sections.push({ title: 'Good to know', lines: pet.quirks.split(/\n+/).map((l) => l.trim()).filter(Boolean) });
    return { petId: pet.id, name: pet.name, subtitle: [SPECIES_WORD[pet.species], pet.breed].filter(Boolean).join(', '), sections };
  });

  const h = input.household;
  const contact = h?.emergencyContact && h.members?.includes(h.emergencyContact) ? h.emergencyContact : h?.members?.find((m) => h.memberPhones?.[m]) ?? h?.members?.[0];
  const phone = contact ? h?.memberPhones?.[contact] : undefined;
  const household: SheetSection[] = [
    { title: 'Emergency contact', lines: [contact ? `${contact}${phone ? `, ${phone}` : ''}` : 'Not set'] },
  ];
  if (h?.houseNotes?.trim()) household.push({ title: 'House notes', lines: h.houseNotes.split(/\n+/).map((l) => l.trim()).filter(Boolean) });
  return {
    title: input.pets.length ? `Care sheet for ${list(input.pets.map((p) => p.name))}` : 'Care sheet',
    dates: hasDates ? dateRange(from, to) : '',
    pets,
    household,
  };
}

/** Plain text version for copy and share. */
export function careSheetText(sheet: CareSheet, appName?: string): string {
  const out: string[] = [sheet.title];
  if (sheet.dates) out.push(sheet.dates);
  for (const p of sheet.pets) {
    out.push('', `${p.name.toUpperCase()}${p.subtitle ? ` (${p.subtitle})` : ''}`);
    for (const s of p.sections) {
      out.push(`${s.title}:`);
      for (const l of s.lines) out.push(`- ${l}`);
    }
  }
  out.push('');
  for (const s of sheet.household) {
    out.push(`${s.title}:`);
    for (const l of s.lines) out.push(`- ${l}`);
  }
  if (appName) out.push('', `Made with ${appName}`);
  return out.join('\n');
}
