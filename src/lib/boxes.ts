import type { BoxSize, BoxTheme, Pet } from '../contracts/domain';

export const BOX_THEMES: Array<{ id: BoxTheme; name: string; blurb: string }> = [
  { id: 'spoiled_rotten', name: 'Spoiled Rotten', blurb: 'Plush comfort, cozy extras and a little luxury.' },
  { id: 'busy_body', name: 'Busy Body', blurb: 'Puzzles, chews and enrichment for active minds.' },
  { id: 'chaos_coordinator', name: 'Chaos Coordinator', blurb: 'Tough toys for the household tornado.' },
  { id: 'new_kid', name: 'New Kid', blurb: 'Starter picks for a new puppy, kitten or rescue.' },
];

export const BOX_SIZES: Array<{ id: BoxSize; name: string; hint: string }> = [
  { id: 'small', name: 'Small', hint: 'Cats, toy breeds, small pets' },
  { id: 'medium', name: 'Medium', hint: 'Most dogs up to about 50 lb' },
  { id: 'large', name: 'Large', hint: 'Big dogs and heavy chewers' },
];

export const CADENCES = [
  { id: 'one_time', name: 'One time' },
  { id: 'monthly', name: 'Monthly' },
  { id: 'quarterly', name: 'Quarterly' },
] as const;

/** Normalizes free-text allergies into tidy restriction labels. */
export function normalizeRestriction(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  const lower = t.toLowerCase().replace(/^no\s+/, '').replace(/\s+free$/, '').replace(/^allergic to\s+/, '');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Restrictions for a box, prefilled from the pet's allergies. Unique, case-insensitive. */
export function restrictionsFromAllergies(pet: Pick<Pet, 'allergies' | 'dietaryNotes'> | undefined): string[] {
  if (!pet) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of pet.allergies) {
    const n = normalizeRestriction(a);
    if (n && !seen.has(n.toLowerCase())) {
      seen.add(n.toLowerCase());
      out.push(n);
    }
  }
  return out;
}

export function suggestBoxSize(pet: Pick<Pet, 'species' | 'weight' | 'weightUnit'> | undefined): BoxSize {
  if (!pet || pet.species !== 'dog' || !pet.weight) return pet?.species === 'dog' ? 'medium' : 'small';
  const lb = pet.weightUnit === 'kg' ? pet.weight * 2.2046 : pet.weight;
  if (lb < 20) return 'small';
  if (lb <= 50) return 'medium';
  return 'large';
}

/** Splits a comma separated allergy string. */
export function parseList(s: string): string[] {
  return s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}
