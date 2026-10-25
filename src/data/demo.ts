import type { BoxPlan, CommunityPost, Household, SavedPlace, TripPlan } from '../contracts/domain';
import { addDays, today } from '../lib/dates';
import { buildPackingList } from '../lib/packing';
import { restrictionsFromAllergies } from '../lib/boxes';
import type { Db } from './db';
import { ensureSeeded, loadSamplePets } from './db';
import { SAMPLE_PET_IDS, samplePets } from './samples';

/**
 * Demo mode: a build made with VITE_DEMO=1 opens fully loaded with a
 * fictional household so the app can be shown without any setup.
 * Demo data uses its own storage prefix, so it never mixes with real data.
 */
export const IS_DEMO = import.meta.env.VITE_DEMO === '1';
export const DEMO_STORAGE_PREFIX = 'pla:demo:v1:';
const HOUSEHOLD_ID = 'demo-household';

export async function seedDemo(db: Db, base: string = today()): Promise<void> {
  if ((await db.households.list()).length) return;
  await ensureSeeded(db);
  const now = new Date().toISOString();
  const household: Household = { id: HOUSEHOLD_ID, name: 'The Parkers', createdAt: now, updatedAt: now };
  await db.households.upsert(household);
  await loadSamplePets(db, HOUSEHOLD_ID);
  const { pets } = samplePets(HOUSEHOLD_ID, base);
  const bailey = pets.find((p) => p.id === SAMPLE_PET_IDS.bailey)!;

  const saved = (placeId: string, extra: Partial<SavedPlace>): SavedPlace => ({
    id: 'demo-saved-' + placeId, householdId: HOUSEHOLD_ID, placeId, favorite: true, createdAt: now, updatedAt: now, ...extra,
  });
  for (const s of [
    saved('sample-place-riverside', { rating: 5, notes: 'Bailey loves the creek side. Bring a towel.', verifiedAt: addDays(base, -12) }),
    saved('sample-place-pawsstay', { rating: 4, notes: 'Ask for a ground floor room near the side door.' }),
    saved('sample-place-patio', { rating: 4, notes: 'Water bowls by the host stand.' }),
    saved('sample-place-vet', { favorite: false, notes: 'Separate cat waiting room is great for Luna.' }),
  ]) await db.savedPlaces.upsert(s);

  const start = addDays(base, 9);
  const packing = buildPackingList([bailey]).map((item, i) => ({ ...item, checked: i < 3 }));
  const trip: TripPlan = {
    id: 'demo-trip-lakeview',
    householdId: HOUSEHOLD_ID,
    title: 'Lakeview weekend',
    destination: 'Lakeview',
    startsOn: start,
    endsOn: addDays(start, 2),
    petIds: [bailey.id],
    stops: [
      { id: 'demo-stop-1', placeId: 'sample-place-pawsstay', label: 'Paws and Stay Hotel', day: start, time: '15:00', notes: 'Check in. Confirm the pet fee at the desk.' },
      { id: 'demo-stop-2', placeId: 'sample-place-patio', label: 'Corner Bistro Patio', day: start, time: '18:30' },
      { id: 'demo-stop-3', placeId: 'sample-place-riverside', label: 'Riverside Dog Park', day: addDays(start, 1), time: '09:00' },
      { id: 'demo-stop-4', label: 'Lake trail walk', day: addDays(start, 1), time: '14:00', notes: 'Shady loop, about 2 miles.' },
    ],
    packing,
    notes: 'Pack the vaccine records folder.',
    createdAt: now,
    updatedAt: now,
  };
  await db.trips.upsert(trip);

  const box: BoxPlan = {
    id: 'demo-box-bailey',
    householdId: HOUSEHOLD_ID,
    petId: bailey.id,
    theme: 'busy_body',
    cadence: 'monthly',
    size: 'large',
    toysOnly: false,
    restrictions: restrictionsFromAllergies(bailey),
    status: 'saved',
    createdAt: now,
    updatedAt: now,
  };
  await db.boxPlans.upsert(box);

  const walk = await db.events.get('sample-event-walk');
  if (walk) await db.events.upsert({ ...walk, rsvp: 'going', petIds: [bailey.id] });

  const post: CommunityPost = {
    id: 'demo-post-1', householdId: HOUSEHOLD_ID, petIds: [bailey.id], caption: 'First swim of the season. Ears rinsed, zero regrets.', createdAt: now, updatedAt: now,
  };
  await db.posts.upsert(post);
}

/** Wipes demo storage and loads the demo again. */
export async function resetDemo(db: Db): Promise<void> {
  const repos = [db.households, db.pets, db.careEvents, db.documents, db.places, db.savedPlaces, db.trips, db.events, db.posts, db.boxPlans, db.petFood, db.dismissed];
  for (const r of repos) await r.replaceAll([]);
  db.store.removeItem('meta:seeded');
  await seedDemo(db);
}
