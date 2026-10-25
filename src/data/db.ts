import type {
  BoxPlan, CareEvent, CommunityPost, Expense, ExportBundle, FeedingLog, FoodSwitchPlan, Household, Pet, PetDocument, PetEvent, PetFoodItem, PlaceListing, SavedPlace,
  PetPlate, Sitter, SitterRequest, TreatLog, TripPlan,
} from '../contracts/domain';
import { createKvRepository, type Repository } from './repository';
import { createLocalStorageStore, type KeyValueStore } from './storage';
import { SAMPLE_PLACES, sampleEvents, samplePets } from './samples';
import { nowIso } from '../lib/dates';

type Dismissed = { id: string };

export interface Db {
  store: KeyValueStore;
  households: Repository<Household>;
  pets: Repository<Pet>;
  careEvents: Repository<CareEvent>;
  documents: Repository<PetDocument>;
  places: Repository<PlaceListing>;
  savedPlaces: Repository<SavedPlace>;
  trips: Repository<TripPlan>;
  events: Repository<PetEvent>;
  posts: Repository<CommunityPost>;
  boxPlans: Repository<BoxPlan>;
  petFood: Repository<PetFoodItem>;
  feedingLogs: Repository<FeedingLog>;
  treatLogs: Repository<TreatLog>;
  switchPlans: Repository<FoodSwitchPlan>;
  expenses: Repository<Expense>;
  sitterRequests: Repository<SitterRequest>;
  sitters: Repository<Sitter>;
  plates: Repository<PetPlate>;
  dismissed: Repository<Dismissed>;
}

export const STORAGE_PREFIX = 'pla:v1:';

export function createDb(store: KeyValueStore = createLocalStorageStore(STORAGE_PREFIX)): Db {
  const r = <T extends { id: string }>(n: string) => createKvRepository<T>(store, n);
  return {
    store,
    households: r('households'),
    pets: r('pets'),
    careEvents: r('care_events'),
    documents: r('pet_documents'),
    places: r('places'),
    savedPlaces: r('saved_places'),
    trips: r('trips'),
    events: r('events'),
    posts: r('community_posts'),
    boxPlans: r('box_plans'),
    petFood: r('pet_food'),
    feedingLogs: r('feeding_logs'),
    treatLogs: r('treat_logs'),
    switchPlans: r('food_switch_plans'),
    expenses: r('expenses'),
    sitterRequests: r('sitter_requests'),
    sitters: r('sitters'),
    plates: r('pet_plates'),
    dismissed: r('dismissed_notifications'),
  };
}

/** Every repository, for reset and delete-all. */
export function allRepos(db: Db): Array<Repository<{ id: string }>> {
  return [db.households, db.pets, db.careEvents, db.documents, db.places, db.savedPlaces, db.trips, db.events, db.posts, db.boxPlans, db.petFood,
    db.feedingLogs, db.treatLogs, db.switchPlans, db.expenses, db.sitterRequests, db.sitters, db.plates, db.dismissed] as unknown as Array<Repository<{ id: string }>>;
}

/** Adds sample places and events once (first run). User can still delete them. */
export async function ensureSeeded(db: Db): Promise<void> {
  if (db.store.getItem('meta:seeded') === '1') return;
  const places = await db.places.list();
  if (!places.length) await db.places.replaceAll(SAMPLE_PLACES);
  const events = await db.events.list();
  if (!events.length) await db.events.replaceAll(sampleEvents());
  db.store.setItem('meta:seeded', '1');
}

export async function getHousehold(db: Db): Promise<Household | undefined> {
  return (await db.households.list())[0];
}

export async function loadSamplePets(db: Db, householdId: string): Promise<void> {
  const { pets, care, food, feedings, expenses, plates } = samplePets(householdId);
  for (const p of pets) await db.pets.upsert(p);
  for (const c of care) await db.careEvents.upsert(c);
  for (const f of food) await db.petFood.upsert(f);
  for (const l of feedings) await db.feedingLogs.upsert(l);
  for (const e of expenses) await db.expenses.upsert(e);
  for (const pl of plates) await db.plates.upsert(pl);
}

export async function removeSamplePets(db: Db): Promise<void> {
  const pets = await db.pets.list((p) => !!p.isSample);
  const ids = new Set(pets.map((p) => p.id));
  for (const p of pets) await removePet(db, p.id);
  await db.petFood.replaceAll(await db.petFood.list((f) => !f.isSample));
  await db.feedingLogs.replaceAll(await db.feedingLogs.list((l) => !l.isSample));
  await db.treatLogs.replaceAll(await db.treatLogs.list((l) => !l.isSample));
  await db.switchPlans.replaceAll(await db.switchPlans.list((p) => !p.isSample));
  await db.expenses.replaceAll(await db.expenses.list((e) => !e.isSample));
  await db.sitterRequests.replaceAll(await db.sitterRequests.list((r) => !r.isSample));
  await db.sitters.replaceAll(await db.sitters.list((x) => !x.isSample));
  await db.plates.replaceAll(await db.plates.list((x) => !x.isSample));
  // detach sample pets from trips, events, posts, box plans
  const trips = await db.trips.list();
  for (const t of trips) if (t.petIds.some((id) => ids.has(id))) await db.trips.upsert({ ...t, petIds: t.petIds.filter((id) => !ids.has(id)), packing: t.packing.filter((i) => !i.petId || !ids.has(i.petId)) });
}

/** Deletes a pet and everything that belongs only to it. */
export async function removePet(db: Db, petId: string): Promise<void> {
  await db.pets.remove(petId);
  await db.careEvents.replaceAll(await db.careEvents.list((c) => c.petId !== petId));
  await db.documents.replaceAll(await db.documents.list((d) => d.petId !== petId));
  await db.boxPlans.replaceAll(await db.boxPlans.list((b) => b.petId !== petId));
  await db.petFood.replaceAll(await db.petFood.list((f) => f.petId !== petId));
  await db.feedingLogs.replaceAll(await db.feedingLogs.list((l) => l.petId !== petId));
  await db.treatLogs.replaceAll(await db.treatLogs.list((l) => l.petId !== petId));
  await db.switchPlans.replaceAll(await db.switchPlans.list((p) => p.petId !== petId));
  await db.plates.replaceAll(await db.plates.list((p) => p.petId !== petId));
  // money already spent stays in the totals, just no longer tagged to the pet
  const expenses = await db.expenses.list();
  if (expenses.some((e) => e.petId === petId)) await db.expenses.replaceAll(expenses.map((e) => (e.petId === petId ? { ...e, petId: undefined } : e)));
  const events = await db.events.list();
  for (const e of events) if (e.petIds.includes(petId)) await db.events.upsert({ ...e, petIds: e.petIds.filter((x) => x !== petId) });
  const posts = await db.posts.list();
  for (const p of posts) if (p.petIds.includes(petId)) await db.posts.upsert({ ...p, petIds: p.petIds.filter((x) => x !== petId) });
  // a request only for this pet goes away; shared ones just drop the pet
  const requests = await db.sitterRequests.list();
  if (requests.some((r) => r.petIds.includes(petId))) {
    await db.sitterRequests.replaceAll(requests.filter((r) => !(r.petIds.length === 1 && r.petIds[0] === petId)).map((r) => (r.petIds.includes(petId) ? { ...r, petIds: r.petIds.filter((x) => x !== petId) } : r)));
  }
  const sitters = await db.sitters.list();
  if (sitters.some((x) => x.petIds.includes(petId))) await db.sitters.replaceAll(sitters.map((x) => (x.petIds.includes(petId) ? { ...x, petIds: x.petIds.filter((id) => id !== petId) } : x)));
}

export async function removePlace(db: Db, placeId: string): Promise<void> {
  await db.places.remove(placeId);
  await db.savedPlaces.replaceAll(await db.savedPlaces.list((s) => s.placeId !== placeId));
}

export async function exportAll(db: Db, appName: string): Promise<ExportBundle> {
  return {
    app: appName,
    version: 1,
    exportedAt: nowIso(),
    household: (await getHousehold(db)) ?? null,
    pets: await db.pets.list(),
    careEvents: await db.careEvents.list(),
    documents: await db.documents.list(),
    places: await db.places.list(),
    savedPlaces: await db.savedPlaces.list(),
    trips: await db.trips.list(),
    events: await db.events.list(),
    posts: await db.posts.list(),
    boxPlans: await db.boxPlans.list(),
    petFood: await db.petFood.list(),
    feedingLogs: await db.feedingLogs.list(),
    treatLogs: await db.treatLogs.list(),
    switchPlans: await db.switchPlans.list(),
    expenses: await db.expenses.list(),
    sitterRequests: await db.sitterRequests.list(),
    sitters: await db.sitters.list(),
    plates: await db.plates.list(),
    dismissedNotifications: (await db.dismissed.list()).map((d) => d.id),
  };
}

export class ImportError extends Error {}

const arr = (v: unknown, name: string): unknown[] => {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new ImportError(`"${name}" should be a list.`);
  return v;
};
const hasId = (x: unknown): x is { id: string } => typeof x === 'object' && x !== null && typeof (x as { id?: unknown }).id === 'string';

/** Validates the export shape and replaces all data. Throws ImportError with a friendly message. */
export async function importAll(db: Db, raw: unknown): Promise<{ pets: number; places: number; trips: number }> {
  if (typeof raw !== 'object' || raw === null) throw new ImportError('That file is not a valid export.');
  const b = raw as Partial<ExportBundle>;
  if (b.version !== 1) throw new ImportError('Unsupported export version.');
  const lists = {
    pets: arr(b.pets, 'pets'),
    careEvents: arr(b.careEvents, 'careEvents'),
    documents: arr(b.documents, 'documents'),
    places: arr(b.places, 'places'),
    savedPlaces: arr(b.savedPlaces, 'savedPlaces'),
    trips: arr(b.trips, 'trips'),
    events: arr(b.events, 'events'),
    posts: arr(b.posts, 'posts'),
    boxPlans: arr(b.boxPlans, 'boxPlans'),
    petFood: arr(b.petFood, 'petFood'),
    feedingLogs: arr(b.feedingLogs, 'feedingLogs'),
    treatLogs: arr(b.treatLogs, 'treatLogs'),
    switchPlans: arr(b.switchPlans, 'switchPlans'),
    expenses: arr(b.expenses, 'expenses'),
    sitterRequests: arr(b.sitterRequests, 'sitterRequests'),
    sitters: arr(b.sitters, 'sitters'),
    plates: arr(b.plates, 'plates'),
  };
  for (const [k, v] of Object.entries(lists)) if (!v.every(hasId)) throw new ImportError(`Some "${k}" records are missing an id.`);
  const pets = (lists.pets as Pet[]).map((p) => ({ ...p, allergies: Array.isArray(p.allergies) ? p.allergies : [] }));
  if (pets.some((p) => typeof p.name !== 'string' || !['dog', 'cat', 'other'].includes(p.species))) throw new ImportError('Some pets have an invalid name or species.');
  const household = b.household && hasId(b.household) ? (b.household as Household) : null;
  if (household && household.members !== undefined && !Array.isArray(household.members)) household.members = [];
  if (household && (typeof household.memberPhones !== 'object' || household.memberPhones === null || Array.isArray(household.memberPhones))) delete household.memberPhones;
  await db.households.replaceAll(household ? [{ ...household, members: household.members?.filter((m) => typeof m === 'string') }] : []);
  await db.pets.replaceAll(pets);
  await db.careEvents.replaceAll(lists.careEvents as CareEvent[]);
  await db.documents.replaceAll(lists.documents as PetDocument[]);
  await db.places.replaceAll(lists.places as PlaceListing[]);
  await db.savedPlaces.replaceAll(lists.savedPlaces as SavedPlace[]);
  await db.trips.replaceAll((lists.trips as TripPlan[]).map((t) => ({ ...t, petIds: t.petIds ?? [], stops: t.stops ?? [], packing: t.packing ?? [] })));
  await db.events.replaceAll((lists.events as PetEvent[]).map((e) => ({ ...e, petIds: e.petIds ?? [] })));
  await db.posts.replaceAll(lists.posts as CommunityPost[]);
  await db.boxPlans.replaceAll(lists.boxPlans as BoxPlan[]);
  await db.petFood.replaceAll((lists.petFood as PetFoodItem[]).map((f) => ({ ...f, purchases: Array.isArray(f.purchases) ? f.purchases : [], favorite: !!f.favorite, active: f.active !== false })));
  await db.feedingLogs.replaceAll((lists.feedingLogs as FeedingLog[]).filter((l) => typeof l.petId === 'string' && typeof l.day === 'string' && Number.isInteger(l.slot)));
  await db.treatLogs.replaceAll((lists.treatLogs as TreatLog[]).filter((l) => typeof l.foodId === 'string' && typeof l.day === 'string').map((l) => ({ ...l, count: Math.max(0, Number(l.count) || 0) })));
  await db.switchPlans.replaceAll((lists.switchPlans as FoodSwitchPlan[]).filter((p) => p.days === 7 || p.days === 10));
  await db.expenses.replaceAll((lists.expenses as Expense[]).filter((e) => typeof e.amount === 'number' && e.amount >= 0 && typeof e.date === 'string'));
  const isDay = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  await db.sitterRequests.replaceAll((lists.sitterRequests as SitterRequest[]).filter((r) => isDay(r.startsOn) && isDay(r.endsOn))
    .map((r) => ({ ...r, petIds: Array.isArray(r.petIds) ? r.petIds : [], services: Array.isArray(r.services) ? r.services : [], status: ['open', 'booked', 'cancelled'].includes(r.status) ? r.status : 'open' })));
  await db.sitters.replaceAll((lists.sitters as Sitter[]).filter((x) => typeof x.name === 'string' && x.name.trim() !== '')
    .map((x) => ({ ...x, petIds: Array.isArray(x.petIds) ? x.petIds : [], foundVia: typeof x.foundVia === 'string' ? x.foundVia : 'friend_family' })));
  await db.plates.replaceAll((lists.plates as PetPlate[]).filter((x) => typeof x.petId === 'string' && Array.isArray(x.items))
    .map((x) => ({ ...x, items: x.items.filter((i) => i && typeof i.typeId === 'string' && typeof i.share === 'number'), kcalSource: ['vet', 'estimate', 'none'].includes(x.kcalSource) ? x.kcalSource : 'none' })));
  await db.dismissed.replaceAll((Array.isArray(b.dismissedNotifications) ? b.dismissedNotifications : []).filter((x): x is string => typeof x === 'string').map((id) => ({ id })));
  db.store.setItem('meta:seeded', '1');
  return { pets: pets.length, places: lists.places.length, trips: lists.trips.length };
}

export async function deleteAll(db: Db): Promise<void> {
  for (const repo of allRepos(db)) await repo.replaceAll([]);
  db.store.removeItem('meta:seeded');
}

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function careEventsCsv(events: CareEvent[], pets: Pet[]): string {
  const names = new Map(pets.map((p) => [p.id, p.name]));
  const header = ['pet', 'type', 'title', 'date', 'due_date', 'repeat_days', 'value', 'completed_at', 'notes'];
  const rows = [...events]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => [names.get(e.petId) ?? e.petId, e.type, e.title, e.date, e.dueDate, e.repeatDays, e.value, e.completedAt, e.notes].map(csvCell).join(','));
  return [header.join(','), ...rows].join('\n');
}

export function petFoodCsv(items: PetFoodItem[], pets: Pet[]): string {
  const names = new Map(pets.map((p) => [p.id, p.name]));
  const header = ['pet', 'kind', 'brand', 'product', 'flavor', 'favorite', 'package_size', 'package_unit', 'purchased_on', 'portion', 'portion_unit', 'times_per_day', 'cups_per_lb', 'reorder_lead_days', 'where_bought', 'purchases', 'active', 'notes'];
  const rows = [...items]
    .sort((a, b) => (names.get(a.petId) ?? '').localeCompare(names.get(b.petId) ?? '') || a.kind.localeCompare(b.kind))
    .map((f) => [
      names.get(f.petId) ?? f.petId, f.kind, f.brand, f.product, f.flavor, f.favorite ? 'yes' : 'no', f.packageSize, f.packageUnit, f.purchasedOn,
      f.portionAmount, f.portionUnit, f.timesPerDay, f.cupsPerLb, f.reorderLeadDays, f.whereBought, f.purchases.map((p) => `${p.date} ${p.size} ${p.unit}`).join('; '),
      f.active ? 'yes' : 'no', f.notes,
    ].map(csvCell).join(','));
  return [header.join(','), ...rows].join('\n');
}
