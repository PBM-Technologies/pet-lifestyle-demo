import type { CareEvent, Expense, FeedingLog, PetEvent, Pet, PetFoodItem, PlaceListing } from '../contracts/domain';
import { addDays, addYears, parseDay, today } from '../lib/dates';
import { BRAND } from '../config/brand';

/**
 * Fictional sample content. Every record is flagged isSample and labeled in
 * the UI. No live places data exists yet; these are not real businesses.
 */
const T0 = '2026-01-01T00:00:00.000Z';

const p = (
  id: string,
  name: string,
  category: PlaceListing['category'],
  city: string,
  description: string,
  policy: Partial<PlaceListing['policy']>,
): PlaceListing => ({
  id: 'sample-place-' + id,
  name,
  category,
  city,
  address: 'Sample listing, no real address',
  description,
  policy: { dogsAllowed: null, catsAllowed: null, leashRule: 'unknown', ...policy },
  isSample: true,
  createdAt: T0,
  updatedAt: T0,
});

export const SAMPLE_PLACES: PlaceListing[] = [
  p('riverside', 'Riverside Dog Park', 'dog_park', 'Sampleton', 'Fenced off-leash area with a separate small dog section and water station.', {
    dogsAllowed: true, catsAllowed: false, leashRule: 'off_leash_area', petFee: 'None listed',
  }),
  p('whisker', 'Whisker Lounge Cat Cafe', 'cat_cafe', 'Sampleton', 'Coffee and adoptable resident cats. Visiting pets usually stay home.', {
    dogsAllowed: false, catsAllowed: false, leashRule: 'not_applicable',
  }),
  p('pawsstay', 'Paws and Stay Hotel', 'hotel', 'Lakeview', 'Pet-friendly rooms on the ground floor with a small relief area.', {
    dogsAllowed: true, catsAllowed: true, sizeLimit: 'Up to 2 pets, 80 lb combined', petFee: 'Per-night fee, ask at booking', leashRule: 'required',
  }),
  p('pinetrail', 'Pine Trail Campground', 'campground', 'Pine Hollow', 'Wooded sites near a creek. Pets must be attended at all times.', {
    dogsAllowed: true, catsAllowed: true, leashRule: 'required', sizeLimit: 'Leash 6 ft max',
  }),
  p('patio', 'Corner Bistro Patio', 'restaurant_patio', 'Lakeview', 'Shaded patio seating with water bowls on request.', {
    dogsAllowed: true, catsAllowed: false, leashRule: 'required',
  }),
  p('market', 'The Friendly Market', 'store', 'Sampleton', 'Neighborhood pet supply store. Leashed pets welcome inside.', {
    dogsAllowed: true, catsAllowed: true, leashRule: 'required',
  }),
  p('vet', 'Maple Street Animal Clinic', 'vet', 'Sampleton', 'General practice for dogs and cats. Separate cat waiting area.', {
    dogsAllowed: true, catsAllowed: true, leashRule: 'required',
  }),
  p('groom', 'Suds and Snips Grooming', 'groomer', 'Lakeview', 'Bath, trim and nail care. Cat grooming by appointment.', {
    dogsAllowed: true, catsAllowed: true, leashRule: 'required',
  }),
];

export function sampleEvents(base: string = today()): PetEvent[] {
  const e = (id: string, title: string, kind: PetEvent['kind'], offset: number, time: string, placeId: string | undefined, locationText: string, description: string): PetEvent => ({
    id: 'sample-event-' + id,
    title,
    kind,
    date: addDays(base, offset),
    time,
    placeId,
    locationText,
    description,
    petIds: [],
    rsvp: null,
    isSample: true,
    createdAt: T0,
    updatedAt: T0,
  });
  return [
    e('walk', 'Saturday Walk Club', 'walk_club', 6, '09:00', 'sample-place-riverside', 'Riverside Dog Park', 'Easy loop around the park. Leashes on until the off-leash gate.'),
    e('adopt', 'Adoption Day', 'adoption_event', 13, '11:00', 'sample-place-market', 'The Friendly Market', 'Meet adoptable dogs and cats from a local rescue.'),
    e('cats', 'Indoor Cat Enrichment Meetup', 'other', 20, '18:30', 'sample-place-whisker', 'Whisker Lounge Cat Cafe', 'Swap ideas for keeping indoor cats busy and happy. Humans only.'),
  ];
}

export const SAMPLE_PET_IDS = { bailey: 'sample-pet-bailey', luna: 'sample-pet-luna' };

export interface SampleBundle { pets: Pet[]; care: CareEvent[]; food: PetFoodItem[]; feedings: FeedingLog[]; expenses: Expense[] }

/** Calories shown for sample data are placeholders, labeled "Sample value" in the UI. Not advice. */
export const SAMPLE_CALORIE_TARGET = 1300;
export const SAMPLE_KCAL_PER_BITE = 4;

export function samplePets(householdId: string, base: string = today()): SampleBundle {
  const now = new Date().toISOString();
  const bailey: Pet = {
    id: SAMPLE_PET_IDS.bailey,
    householdId,
    name: 'Bailey',
    species: 'dog',
    breed: 'Golden Retriever',
    birthDate: addDays(addYears(base, -4), -40),
    weight: 68,
    weightUnit: 'lb',
    allergies: ['Chicken'],
    dietaryNotes: 'Sensitive stomach. Fish based food.',
    vetName: 'Sample Vet Clinic',
    quirks: 'Rinse his ears after swimming. Pulls toward squirrels on walks.',
    dailyCalorieTarget: SAMPLE_CALORIE_TARGET,
    isSample: true,
    createdAt: now,
    updatedAt: now,
  };
  const luna: Pet = {
    id: SAMPLE_PET_IDS.luna,
    householdId,
    name: 'Luna',
    species: 'cat',
    breed: 'Domestic Shorthair',
    birthDate: addDays(addYears(base, -2), -75),
    weight: 9.5,
    weightUnit: 'lb',
    allergies: [],
    dietaryNotes: 'Wet food twice a day.',
    vetName: 'Sample Vet Clinic',
    quirks: 'Hides under the bed when the doorbell rings. Give her a few minutes and she will come say hi.',
    isSample: true,
    createdAt: now,
    updatedAt: now,
  };
  const c = (id: string, petId: string, type: CareEvent['type'], title: string, dateOffset: number, dueOffset?: number, extra: Partial<CareEvent> = {}): CareEvent => ({
    id: 'sample-care-' + id,
    householdId,
    petId,
    type,
    title,
    date: addDays(base, dateOffset),
    dueDate: dueOffset === undefined ? undefined : addDays(base, dueOffset),
    isSample: true,
    createdAt: now,
    updatedAt: now,
    ...extra,
  });
  const care: CareEvent[] = [
    c('b-rabies', bailey.id, 'vaccine', 'Rabies', -350, 15),
    c('b-dhpp', bailey.id, 'vaccine', 'DHPP', -200, 165),
    c('b-heart', bailey.id, 'heartworm', 'Heartworm preventive', -27, 3, { repeatDays: 30 }),
    c('b-flea', bailey.id, 'flea_tick', 'Flea and tick chew', -40, -10, { repeatDays: 30 }),
    c('b-w1', bailey.id, 'weight', 'Weight', -270, undefined, { value: 64 }),
    c('b-w2', bailey.id, 'weight', 'Weight', -150, undefined, { value: 66.5 }),
    c('b-w3', bailey.id, 'weight', 'Weight', -20, undefined, { value: 68 }),
    c('b-note', bailey.id, 'note', 'Loved the lake today', -3, undefined, { notes: 'Swam for 20 minutes. Rinse ears after swimming.' }),
    c('l-fvrcp', luna.id, 'vaccine', 'FVRCP', -330, 35),
    c('l-groom', luna.id, 'grooming', 'Nail trim', -25, 5, { repeatDays: 30 }),
    c('l-w1', luna.id, 'weight', 'Weight', -200, undefined, { value: 8.9 }),
    c('l-w2', luna.id, 'weight', 'Weight', -30, undefined, { value: 9.5 }),
  ];
  // Food and treats. Brand names other than the partner are fictional and
  // product names are generic placeholders; nothing here is a real listing.
  // Bailey: 2 cups twice a day at 4 cups per lb is 1 lb a day, so a 24 lb bag
  // lasts about 24 days. Bought 19 days ago, it lands at "reorder soon".
  const f = (id: string, petId: string, o: Omit<PetFoodItem, 'id' | 'householdId' | 'petId' | 'createdAt' | 'updatedAt' | 'isSample' | 'active'>): PetFoodItem => ({
    id: 'sample-food-' + id, householdId, petId, active: true, isSample: true, createdAt: now, updatedAt: now, ...o,
  });
  const food: PetFoodItem[] = [
    f('b-food', bailey.id, {
      kind: 'food', brand: BRAND.partners.find((x) => x.category === 'food_and_treats')?.name ?? 'Sample Pet Foods', product: 'Dry dog food (sample)', favorite: false,
      packageSize: 24, packageUnit: 'lb', purchasedOn: addDays(base, -19), portionAmount: 2, portionUnit: 'cups', timesPerDay: 2, cupsPerLb: 4, reorderLeadDays: 7,
      purchases: [{ date: addDays(base, -43), size: 24, unit: 'lb' }, { date: addDays(base, -19), size: 24, unit: 'lb' }],
    }),
    f('b-bites', bailey.id, {
      kind: 'treat', brand: 'Sample Treat Co', product: 'Salmon training bites (sample)', favorite: true,
      packageSize: 100, packageUnit: 'count', purchasedOn: addDays(base, -10), portionAmount: 5, portionUnit: 'pieces', timesPerDay: 1, kcalPerPiece: SAMPLE_KCAL_PER_BITE,
      purchases: [{ date: addDays(base, -10), size: 100, unit: 'count' }],
    }),
    f('b-biscuits', bailey.id, { kind: 'treat', brand: 'Sample Treat Co', product: 'Peanut butter biscuits (sample)', favorite: true, purchases: [] }),
    f('l-food', luna.id, {
      kind: 'food', brand: 'Sample Cat Kitchen', product: 'Pate cans (sample)', favorite: false,
      packageSize: 24, packageUnit: 'cans', purchasedOn: addDays(base, -9), portionAmount: 1, portionUnit: 'cans', timesPerDay: 2, reorderLeadDays: 7,
      purchases: [{ date: addDays(base, -9), size: 24, unit: 'cans' }],
    }),
  ];
  // Breakfast already checked off today for Bailey.
  const [y, m, d] = base.split('-').map(Number);
  const feedings: FeedingLog[] = [{
    id: 'sample-feed-b-breakfast', householdId, petId: bailey.id, foodId: 'sample-food-b-food', day: base, slot: 0,
    fedAt: new Date(y, m - 1, d, 7, 40).toISOString(), isSample: true, createdAt: now, updatedAt: now,
  }];
  return { pets: [bailey, luna], care, food, feedings, expenses: sampleExpenses(householdId, base, now) };
}

/** Four months of clearly labeled sample spending. Amounts are made up for the demo. */
function sampleExpenses(householdId: string, base: string, now: string): Expense[] {
  const b = parseDay(base);
  const dayIn = (monthsBack: number, dom: number): string => {
    const dt = new Date(b.getFullYear(), b.getMonth() - monthsBack, 1);
    const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    const day = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(Math.min(dom, last)).padStart(2, '0')}`;
    return day > base ? base : day;
  };
  const x = (id: string, monthsBack: number, dom: number, category: Expense['category'], amount: number, petId: string | undefined, note: string): Expense => ({
    id: 'sample-exp-' + id, householdId, category, amount, date: dayIn(monthsBack, dom), petId, note: `${note} (sample)`, isSample: true, createdAt: now, updatedAt: now,
  });
  const B = SAMPLE_PET_IDS.bailey, L = SAMPLE_PET_IDS.luna;
  return [
    x('m0-food', 0, 3, 'food', 54, B, 'Dry food bag'),
    x('m0-cat', 0, 4, 'food', 31.5, L, 'Case of cat food'),
    x('m0-toys', 0, 8, 'toys', 16, B, 'Rope toy'),
    x('m0-meds', 0, 2, 'meds', 38, B, 'Flea and tick chew'),
    x('m1-food', 1, 6, 'food', 54, B, 'Dry food bag'),
    x('m1-cat', 1, 9, 'food', 31.5, L, 'Case of cat food'),
    x('m1-vet', 1, 14, 'vet', 95, L, 'Checkup and vaccine'),
    x('m1-litter', 1, 20, 'supplies', 22, L, 'Litter'),
    x('m2-food', 2, 5, 'food', 54, B, 'Dry food bag'),
    x('m2-cat', 2, 11, 'food', 29, L, 'Case of cat food'),
    x('m2-groom', 2, 18, 'grooming', 60, B, 'Bath and brush out'),
    x('m2-treats', 2, 22, 'treats', 12, B, 'Training treats'),
    x('m2-sit', 2, 27, 'boarding', 80, undefined, 'Weekend pet sitter'),
    x('m3-food', 3, 4, 'food', 52, B, 'Dry food bag'),
    x('m3-cat', 3, 12, 'food', 29, L, 'Case of cat food'),
    x('m3-meds', 3, 15, 'meds', 64, B, 'Heartworm preventive'),
    x('m3-toys', 3, 23, 'toys', 9, L, 'Feather wand'),
  ];
}
