import type { BoxPlan, CommunityPost, Household, SavedPlace, Sitter, SitterRequest, TripPlan } from '../contracts/domain';
import { BRAND } from '../config/brand';
import { FRIEND_FAMILY } from '../lib/sitters';
import { addDays, today } from '../lib/dates';
import { buildPackingList } from '../lib/packing';
import { restrictionsFromAllergies } from '../lib/boxes';
import type { Db } from './db';
import { allRepos, ensureSeeded, loadSamplePets } from './db';
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
  // Household member names exist only in the demo; real households start empty.
  const household: Household = {
    id: HOUSEHOLD_ID, name: 'The Parkers', members: ['Sarah', 'Alex'], memberPhones: { Sarah: '555-0142 (sample)' }, emergencyContact: 'Sarah',
    houseNotes: 'Spare key is with the neighbor at number 12 (sample).\nFood and treats are in the pantry, top shelf.', createdAt: now, updatedAt: now,
  };
  await db.households.upsert(household);
  await loadSamplePets(db, HOUSEHOLD_ID);
  const { pets } = samplePets(HOUSEHOLD_ID, base);
  const bailey = pets.find((p) => p.id === SAMPLE_PET_IDS.bailey)!;
  // Breakfast was checked off by a household member in the demo.
  for (const l of await db.feedingLogs.list((x) => x.petId === bailey.id && !!x.isSample)) await db.feedingLogs.upsert({ ...l, fedBy: 'Sarah' });

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

  // Luna stays home during the Lakeview weekend, so the demo has an open sitter request for those dates.
  const luna = pets.find((p) => p.id === SAMPLE_PET_IDS.luna)!;
  const sitter: Sitter = {
    id: 'demo-sitter-jordan', householdId: HOUSEHOLD_ID, name: 'Jordan (sample)', phone: '555-0199', email: 'jordan@example.com',
    foundVia: BRAND.sitterProviders.find((p) => p.id === 'rover')?.id ?? FRIEND_FAMILY, rating: 5, petIds: [luna.id],
    notes: 'Did drop-ins for Luna last spring. Great with shy cats.', isSample: true, createdAt: now, updatedAt: now,
  };
  await db.sitters.upsert(sitter);
  const request: SitterRequest = {
    id: 'demo-sitter-request-lakeview', householdId: HOUSEHOLD_ID, petIds: [luna.id], services: ['drop_in'], startsOn: trip.startsOn as string, endsOn: trip.endsOn as string,
    location: 'Sampleton', notes: 'Two visits a day while we are at the lake.', tripId: trip.id, status: 'open', isSample: true, createdAt: now, updatedAt: now,
  };
  await db.sitterRequests.upsert(request);
}

/** Wipes demo storage and loads the demo again. */
export async function resetDemo(db: Db): Promise<void> {
  for (const r of allRepos(db)) await r.replaceAll([]);
  db.store.removeItem('meta:seeded');
  await seedDemo(db);
}
