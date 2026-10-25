import { BREEDS, type BreedInfo, type Level } from '../content/breeds';

export interface MatchPrefs {
  species: 'dog' | 'cat' | 'either';
  home: 'apartment' | 'house';
  activity: Level;
  kids: boolean;
  otherPets: boolean;
  /** How much grooming the person is happy to do. */
  grooming: Level;
  /** Wants a lower shedding breed because of allergies. */
  lowShedding: boolean;
}

export interface MatchResult {
  breed: BreedInfo;
  score: number;
  reasons: string[];
}

export const DEFAULT_PREFS: MatchPrefs = { species: 'either', home: 'house', activity: 2, kids: false, otherPets: false, grooming: 2, lowShedding: false };

const ACTIVITY_WORD: Record<Level, string> = { 1: 'relaxed', 2: 'moderate', 3: 'very active' };

/** Scores one breed against the preferences. Higher is better; reasons explain the positives. */
export function scoreBreed(b: BreedInfo, p: MatchPrefs): MatchResult {
  let score = 10;
  const reasons: string[] = [];
  const energyGap = Math.abs(b.energy - p.activity);
  score -= energyGap * 4;
  if (energyGap === 0) reasons.push(`Energy level fits a ${ACTIVITY_WORD[p.activity]} lifestyle`);

  if (p.home === 'apartment') {
    if (b.apartment) { score += 2; reasons.push('Usually does well in an apartment'); }
    else score -= 5;
    if (b.size === 'giant') score -= 3;
  } else if (b.species === 'dog' && b.energy === 3) {
    score += 1;
    reasons.push('Will enjoy a yard to run in');
  }

  if (p.kids) {
    if (b.goodWithKids) { score += 2; reasons.push('Usually good with kids'); }
    else score -= 6;
  }
  if (p.otherPets) {
    if (b.goodWithPets) { score += 2; reasons.push('Usually gets along with other pets'); }
    else score -= 5;
  }

  if (b.grooming > p.grooming) score -= (b.grooming - p.grooming) * 3;
  else reasons.push(b.grooming === 1 ? 'Very little grooming' : 'Grooming fits what you are up for');

  if (p.lowShedding) {
    if (b.shedding === 1) { score += 4; reasons.push('Low shedding, which some people with allergies find easier'); }
    else if (b.shedding === 2) score -= 2;
    else score -= 6;
  }

  if (b.species === 'dog' && b.trainability === 3 && p.kids) reasons.push('Eager to learn, which helps with family routines');
  if (!reasons.length) reasons.push('A reasonable all round fit');
  return { breed: b, score, reasons: reasons.slice(0, 4) };
}

/**
 * Top matches for the preferences. Mixed breed dogs are left out because
 * their traits depend on the mix; the UI points people to shelters instead.
 */
export function recommendBreeds(p: MatchPrefs, breeds: BreedInfo[] = BREEDS, n = 5): MatchResult[] {
  return breeds
    .filter((b) => b.slug !== 'mixed-breed-dog')
    .filter((b) => p.species === 'either' || b.species === p.species)
    .map((b) => scoreBreed(b, p))
    .sort((a, b) => b.score - a.score || a.breed.name.localeCompare(b.breed.name))
    .slice(0, n);
}
