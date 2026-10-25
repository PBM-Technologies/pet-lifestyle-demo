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

export interface Household extends AuditFields { name: string }

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

export type NotificationKind = 'care_due' | 'care_overdue' | 'trip_upcoming' | 'event_upcoming';

export interface AppNotification {
  id: ID;
  kind: NotificationKind;
  title: string;
  body: string;
  date: string;
  href: string;
  severity: 'info' | 'warning' | 'danger';
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
  dismissedNotifications: ID[];
}
