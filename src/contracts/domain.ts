export type ID = string;
export type HouseholdRole = 'owner' | 'admin' | 'member' | 'viewer';
export interface Actor { userId: ID; householdId: ID; role: HouseholdRole }
export interface Page<T> { items: T[]; nextCursor?: string }
export interface ApiError { code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'UNAVAILABLE'; message: string }
export interface AuditFields { id: ID; createdAt: string; updatedAt: string }
export interface PetProfile extends AuditFields { householdId: ID; name: string; species: 'dog' | 'cat' | 'other'; breed?: string; birthDate?: string; dietaryNotes?: string }
export interface Place extends AuditFields { name: string; category: string; latitude: number; longitude: number; policyVerifiedAt?: string; policySource?: string }
export interface Trip extends AuditFields { householdId: ID; title: string; startsOn?: string; endsOn?: string }
export interface MysteryBoxPreference { householdId: ID; petId: ID; theme: string; cadence: 'one_time' | 'monthly' | 'quarterly'; toysOnly: boolean; restrictions: string[] }
export interface BirdProfile extends AuditFields { householdId: ID; flockId: ID; name: string; breed?: string; hatchDate?: string; status: 'active' | 'rehomed' | 'deceased' }
export interface EggCollection extends AuditFields { householdId: ID; flockId: ID; collectedOn: string; count: number; notes?: string }
export interface ChoreOccurrence extends AuditFields { householdId: ID; title: string; dueAt: string; completedAt?: string; assignedTo?: ID }

// ---------------------------------------------------------------------------
// Consumer app domain (phase 1, local-first). Every household-scoped record
// carries householdId so a server adapter can enforce tenancy later.
// ---------------------------------------------------------------------------

export type Species = 'dog' | 'cat' | 'other';

export interface Household extends AuditFields {
  name: string;
  /** First names of people in the household, used for "fed by". Names only, no accounts yet. */
  members?: string[];
  /** Optional phone per member name, for the sitter care sheet emergency contact. */
  memberPhones?: Record<string, string>;
  /** Member name to list as the emergency contact on sitter care sheets. */
  emergencyContact?: string;
  /** Door codes, where things are, house rules. Shown on sitter care sheets. */
  houseNotes?: string;
}

/** Full pet record used by the app. Extends the original PetProfile contract. */
export interface Pet extends PetProfile {
  /** Current weight in weightUnit. */
  weight?: number;
  weightUnit?: 'lb' | 'kg';
  /** Compressed JPEG data URL. */
  photo?: string;
  allergies: string[];
  microchip?: string;
  vetName?: string;
  vetPhone?: string;
  /** Daily calories from the vet. Only ever entered by the user. */
  dailyCalorieTarget?: number;
  /** Habits, fears and quirks a sitter should know. */
  quirks?: string;
  /** Everyday activity, used for the calorie starting estimate. */
  activity?: 'low' | 'normal' | 'high';
  /** Owner's read of body shape. "over" uses the weight loss factor. */
  bodyCondition?: 'under' | 'ideal' | 'over';
  /** Spayed or neutered. Unknown when unset. */
  neutered?: boolean;
  isSample?: boolean;
}

export type CareEventType =
  | 'vaccine'
  | 'medication'
  | 'flea_tick'
  | 'heartworm'
  | 'vet_visit'
  | 'grooming'
  | 'weight'
  | 'note';

export interface CareEvent extends AuditFields {
  householdId: ID;
  petId: ID;
  type: CareEventType;
  title: string;
  /** Date the event happened or was given (YYYY-MM-DD). */
  date: string;
  /** Next due date (YYYY-MM-DD) for vaccines, meds and preventives. */
  dueDate?: string;
  /** Repeat interval in days for recurring meds and preventives. */
  repeatDays?: number;
  /** Weight entries store the value in the pet's unit. */
  value?: number;
  notes?: string;
  completedAt?: string;
  isSample?: boolean;
}

export interface PetDocument extends AuditFields {
  householdId: ID;
  petId: ID;
  name: string;
  /** Optional compressed image data URL. */
  image?: string;
  isSample?: boolean;
}

export type PlaceCategory =
  | 'dog_park'
  | 'cat_cafe'
  | 'hotel'
  | 'campground'
  | 'restaurant_patio'
  | 'store'
  | 'vet'
  | 'groomer';

export type LeashRule = 'required' | 'off_leash_area' | 'not_applicable' | 'unknown';

export interface PlacePolicy {
  dogsAllowed: boolean | null;
  catsAllowed: boolean | null;
  sizeLimit?: string;
  petFee?: string;
  leashRule: LeashRule;
  /** Set only when the user marks the policy verified. Never set by the app. */
  verifiedAt?: string;
  verifiedBy?: 'you';
}

/** Place listing. `householdId` is absent for shared sample listings. */
export interface PlaceListing extends AuditFields {
  householdId?: ID;
  name: string;
  category: PlaceCategory;
  address?: string;
  city?: string;
  description?: string;
  policy: PlacePolicy;
  isSample: boolean;
}

/** Household-private overlay on any place: favorite, notes, rating. */
export interface SavedPlace extends AuditFields {
  householdId: ID;
  placeId: ID;
  favorite: boolean;
  notes?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  /** Household-local policy verification for sample listings. */
  verifiedAt?: string;
}

export interface TripStop {
  id: ID;
  placeId?: ID;
  label: string;
  day: string;
  time?: string;
  notes?: string;
}

export interface PackingItem {
  id: ID;
  label: string;
  checked: boolean;
  /** Pet the item is for, when specific. */
  petId?: ID;
  custom?: boolean;
}

export interface TripPlan extends Trip {
  destination?: string;
  petIds: ID[];
  stops: TripStop[];
  packing: PackingItem[];
  notes?: string;
}

export type EventKind = 'walk_club' | 'playdate' | 'pet_birthday' | 'adoption_event' | 'other';

export interface PetEvent extends AuditFields {
  householdId?: ID;
  title: string;
  kind: EventKind;
  date: string;
  time?: string;
  placeId?: ID;
  locationText?: string;
  description?: string;
  petIds: ID[];
  rsvp: 'going' | 'maybe' | 'not_going' | null;
  isSample: boolean;
}

export interface CommunityPost extends AuditFields {
  householdId: ID;
  petIds: ID[];
  caption: string;
  photo?: string;
}

export type BoxTheme = 'spoiled_rotten' | 'busy_body' | 'chaos_coordinator' | 'new_kid';
export type BoxSize = 'small' | 'medium' | 'large';

export interface BoxPlan extends AuditFields, MysteryBoxPreference {
  size: BoxSize;
  status: 'draft' | 'saved';
}

export type FoodKind = 'food' | 'treat';
/** Unit the package is sold in. */
export type PackageUnit = 'lb' | 'kg' | 'oz' | 'g' | 'cans' | 'pouches' | 'count';
/** Unit one serving is measured in. */
export type PortionUnit = 'cups' | 'g' | 'oz' | 'cans' | 'pouches' | 'pieces';

export interface FoodPurchase {
  /** YYYY-MM-DD */
  date: string;
  size: number;
  unit: PackageUnit;
  /** Only ever entered by the user. The app never supplies prices. */
  price?: number;
}

/** A food or treat one pet eats, with what is needed to estimate how much is left. */
export interface PetFoodItem extends AuditFields {
  householdId: ID;
  petId: ID;
  kind: FoodKind;
  brand: string;
  product: string;
  flavor?: string;
  /** Mostly used for treats. */
  favorite: boolean;
  /** Size of the current bag, box or case. Optional for untracked treats. */
  packageSize?: number;
  packageUnit?: PackageUnit;
  /** Date the current package was bought (YYYY-MM-DD). */
  purchasedOn?: string;
  portionAmount?: number;
  portionUnit?: PortionUnit;
  timesPerDay?: number;
  /** Cups of kibble per pound, from the bag's feeding chart. Defaults to 4. */
  cupsPerLb?: number;
  /** Days before running out to start nudging. Defaults to 7. */
  reorderLeadDays?: number;
  notes?: string;
  /** Calories in one treat piece, from the package. User-entered only. */
  kcalPerPiece?: number;
  whereBought?: string;
  /** Purchase history, oldest first. The last entry is the current package. */
  purchases: FoodPurchase[];
  active: boolean;
  /** Food type id from a saved plate that created or last updated this item. */
  fromPlate?: string;
  isSample?: boolean;
}

/** One checked-off feeding. Logs are per calendar day, so the checklist resets each day. */
export interface FeedingLog extends AuditFields {
  householdId: ID;
  petId: ID;
  foodId?: ID;
  /** YYYY-MM-DD the feeding belongs to. */
  day: string;
  /** 0-based slot: Breakfast, Lunch, Dinner, Late depending on feedings per day. */
  slot: number;
  /** ISO time the feeding was checked off. */
  fedAt: string;
  /** Household member name, optional. */
  fedBy?: string;
  isSample?: boolean;
}

/** Treat pieces given on one day for one treat. */
export interface TreatLog extends AuditFields {
  householdId: ID;
  petId: ID;
  foodId: ID;
  day: string;
  count: number;
  isSample?: boolean;
}

export type SwitchPlanLength = 7 | 10;

/** Gradual change from one food to another. */
export interface FoodSwitchPlan extends AuditFields {
  householdId: ID;
  petId: ID;
  oldFoodId: ID;
  newFoodId: ID;
  days: SwitchPlanLength;
  /** YYYY-MM-DD of day 1. */
  startDate: string;
  status: 'active' | 'done' | 'stopped';
  isSample?: boolean;
}

export type ExpenseCategory = 'food' | 'treats' | 'toys' | 'meds' | 'vet' | 'grooming' | 'boarding' | 'supplies' | 'other';

/** A manual pet expense. Food bag prices come from FoodPurchase.price instead. */
export interface Expense extends AuditFields {
  householdId: ID;
  category: ExpenseCategory;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  petId?: ID;
  note?: string;
  isSample?: boolean;
}

export type NotificationKind = 'care_due' | 'care_overdue' | 'trip_upcoming' | 'event_upcoming' | 'food_low';

export interface AppNotification {
  id: ID;
  kind: NotificationKind;
  title: string;
  body: string;
  date: string;
  href: string;
  severity: 'info' | 'warning' | 'danger';
}

export type SitterService = 'boarding' | 'house_sitting' | 'drop_in' | 'dog_walking' | 'day_care';

/** A request for pet care on some dates. Booking happens on the provider's own site. */
export interface SitterRequest extends AuditFields {
  householdId: ID;
  petIds: ID[];
  services: SitterService[];
  /** YYYY-MM-DD */
  startsOn: string;
  endsOn: string;
  /** Zip code or city to search near. */
  location?: string;
  notes?: string;
  /** Trip the dates came from, when started from Travel. */
  tripId?: ID;
  status: 'open' | 'booked' | 'cancelled';
  /** Who was booked, typed by the user. */
  bookedName?: string;
  bookedSitterId?: ID;
  isSample?: boolean;
}

/** "friend_family" or a provider id from BRAND.sitterProviders. */
export type SitterSource = string;

/** A saved sitter contact. */
export interface Sitter extends AuditFields {
  householdId: ID;
  name: string;
  phone?: string;
  email?: string;
  foundVia: SitterSource;
  notes?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  /** Pets this sitter already knows. */
  petIds: ID[];
  isSample?: boolean;
}

/** Kinds of "other" pets the plate builder has guidance for. */
export type OtherKind = 'rabbit' | 'guinea_pig' | 'bird' | 'reptile';
/** Unit the user gives calories in for one plate item. */
export type PlateUnit = 'cup' | 'can' | 'pouch' | 'oz' | 'piece' | 'serving';

export interface PlateItem {
  /** Id from src/content/foodTypes.ts. */
  typeId: string;
  /** Percent of the daily plate, in 5 percent steps. Supplements are 0. */
  share: number;
  /** Exactly one item is the base. */
  base?: boolean;
  /** Optional, typed by the user. The app never supplies product names. */
  brand?: string;
  product?: string;
  /** Calories per unit, from the package. User-entered only. */
  kcalPerUnit?: number;
  unit?: PlateUnit;
}

/** A pet's planned daily plate. One per pet. */
export interface PetPlate extends AuditFields {
  householdId: ID;
  petId: ID;
  otherKind?: OtherKind;
  items: PlateItem[];
  /** Daily calories the amounts were worked out from, when known. */
  kcalTarget?: number;
  kcalSource: 'vet' | 'estimate' | 'none';
  savedAt: string;
  isSample?: boolean;
}

/** Shape of the JSON export/import file. */
export interface ExportBundle {
  app: string;
  version: 1;
  exportedAt: string;
  household: Household | null;
  pets: Pet[];
  careEvents: CareEvent[];
  documents: PetDocument[];
  places: PlaceListing[];
  savedPlaces: SavedPlace[];
  trips: TripPlan[];
  events: PetEvent[];
  posts: CommunityPost[];
  boxPlans: BoxPlan[];
  /** Added later; older exports may not have it. */
  petFood?: PetFoodItem[];
  feedingLogs?: FeedingLog[];
  treatLogs?: TreatLog[];
  switchPlans?: FoodSwitchPlan[];
  expenses?: Expense[];
  sitterRequests?: SitterRequest[];
  sitters?: Sitter[];
  plates?: PetPlate[];
  dismissedNotifications: ID[];
}

// ---------------------------------------------------------------------------
// Photo checks (vision model output, sanitized before use). Never stored as-is.
// ---------------------------------------------------------------------------

export type Confidence = 'high' | 'medium' | 'low';

export interface BreedMatch { breed: string; confidence: Confidence; why: string }

export interface BreedIdResult {
  species: Species;
  topMatches: BreedMatch[];
  mixedLikely: boolean;
  sizeGuess: string;
  coatNotes: string;
  notes: string;
}

export type Likelihood = 'likely' | 'possible' | 'less likely';
export type Urgency = 'routine' | 'soon' | 'urgent';

export interface PossibleIssue {
  name: string;
  likelihood: Likelihood;
  signsSeen: string;
  checkAtHome: string[];
  careSteps: string[];
}

export interface PetHealthResult {
  photoUsable: boolean;
  possibleIssues: PossibleIssue[];
  urgency: Urgency;
  seeVetIf: string[];
  summary: string;
}
