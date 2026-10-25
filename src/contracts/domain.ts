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
