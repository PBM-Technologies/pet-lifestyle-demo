import type { BreedIdResult, Confidence, Likelihood, PetHealthResult, Species, Urgency } from '../contracts/domain';
import { breedNames } from '../content/breeds';

export function breedPrompt(photoCount: number): string {
  return [
    `You are helping a pet owner guess the breed of a pet from ${photoCount === 1 ? 'a photo' : `${photoCount} photos of the same animal`}.`,
    'First decide whether the animal is a dog, a cat or something else.',
    'Reply with only JSON in exactly this shape:',
    '{"species": "dog"|"cat"|"other", "topMatches": [{"breed": string, "confidence": "high"|"medium"|"low", "why": string}], "mixedLikely": boolean, "sizeGuess": string, "coatNotes": string, "notes": string}',
    'Rules:',
    '- topMatches has at most 3 entries, best first.',
    '- For dogs, use names from this list whenever one fits: ' + breedNames('dog').join(', ') + '.',
    '- For cats, use names from this list whenever one fits: ' + breedNames('cat').join(', ') + '.',
    '- Most cats are Domestic Shorthair or Domestic Longhair, not a pedigree breed. Prefer those unless the features clearly point to a breed.',
    '- Mixed breed dogs are very common. If the dog looks mixed, set mixedLikely true and list the breeds it may carry. "Pit Bull type" describes a group of dogs, not one breed.',
    '- Be honest about uncertainty. Use "low" confidence when the photo is unclear or features are ambiguous. Never claim certainty; a photo cannot confirm a breed.',
    '- "why" is one short sentence naming visible features (ear shape, muzzle, coat type, color pattern, build).',
    '- sizeGuess is a short phrase like "medium, about 30 to 50 lb as an adult" or "small adult cat".',
    '- coatNotes is one short sentence about coat length, texture and pattern.',
    '- If it is not a dog or cat, set species "other", leave topMatches empty and explain kindly in notes.',
    '- Plain everyday language, no dashes as punctuation.',
  ].join('\n');
}

const SHARED_SYMPTOMS = [
  'Itching or scratching', 'Hair loss or hot spots', 'Ear shaking or odor', 'Red or goopy eyes', 'Limping', 'Lump or bump',
  'Bad breath or tartar', 'Vomiting or diarrhea', 'Not eating', 'Lethargic', 'Wound', 'Swelling',
] as const;

/** Symptom chips for each species. */
export function symptomsFor(species: Species): string[] {
  if (species === 'dog') return [...SHARED_SYMPTOMS, 'Scooting', 'Bloated belly or retching'];
  if (species === 'cat') return [...SHARED_SYMPTOMS, 'Straining in the litter box', 'Hiding more than usual'];
  return [...SHARED_SYMPTOMS];
}

export function healthPrompt(photoCount: number, species: Species, symptoms: string[], petContext?: string): string {
  const animal = species === 'cat' ? 'cat' : species === 'dog' ? 'dog' : 'pet';
  return [
    `You are helping a pet owner look over ${photoCount === 1 ? 'a photo' : `${photoCount} photos`} of their ${animal} for possible health problems.`,
    petContext ? `About the pet: ${petContext}.` : '',
    symptoms.length ? `The owner also noticed: ${symptoms.join(', ')}.` : 'The owner did not list any symptoms.',
    'Reply with only JSON in exactly this shape:',
    '{"photoUsable": boolean, "possibleIssues": [{"name": string, "likelihood": "likely"|"possible"|"less likely", "signsSeen": string, "checkAtHome": string[], "careSteps": string[]}], "urgency": "routine"|"soon"|"urgent", "seeVetIf": string[], "summary": string}',
    'Rules:',
    '- Common issues in dogs and cats include fleas, flea allergy dermatitis, hot spots, ear infections or ear mites, conjunctivitis, dental tartar or gum disease, ringworm, lumps (a soft fatty lipoma versus a lump that needs a vet check), cuts and wounds, limping or nail injuries, and being overweight. Consider these first.',
    '- At most 3 possible issues, most likely first. Describe possible issues only. Never give a definite diagnosis.',
    '- careSteps are general care only, like keeping an area clean and dry, stopping licking with a cone, checking for fleas with a flea comb, or resting a sore leg.',
    '- Never give medication names with doses, dosing instructions or human medicines. Say to call a vet before giving any medicine, including over the counter products.',
    '- Use "urgent" for trouble breathing, collapse, a bloated belly with retching in dogs, straining to urinate (especially male cats), an eye injury, heavy bleeding, or suspected poisoning.',
    '- For suspected poisoning, tell the owner to call their vet or an emergency clinic right away and mention the ASPCA Animal Poison Control Center as a resource by name. Do not include phone numbers.',
    '- If the photo is too blurry, dark or far away to judge, set photoUsable false, keep possibleIssues short, and say what kind of photo would help.',
    '- checkAtHome items are short things the owner can safely look at or feel for.',
    '- summary is 1 to 2 calm sentences. Plain everyday language, no dashes as punctuation.',
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Sanitizers: model output is untrusted, so coerce it into the shapes the UI expects.
// ---------------------------------------------------------------------------
const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const strList = (v: unknown, n = 6) => (Array.isArray(v) ? v.map((x) => str(x, 240)).filter(Boolean).slice(0, n) : []);
const oneOf = <T extends string>(v: unknown, opts: readonly T[], fallback: T): T => (opts.includes(v as T) ? (v as T) : fallback);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function cleanBreedId(raw: unknown): BreedIdResult {
  const r = obj(raw);
  const species = oneOf<Species>(r.species, ['dog', 'cat', 'other'], 'other');
  const matches = species === 'other' ? [] : (Array.isArray(r.topMatches) ? r.topMatches : []).map(obj).map((m) => ({
    breed: str(m.breed, 60), confidence: oneOf<Confidence>(m.confidence, ['high', 'medium', 'low'], 'low'), why: str(m.why),
  })).filter((m) => m.breed).slice(0, 3);
  return {
    species,
    topMatches: matches,
    mixedLikely: r.mixedLikely === true,
    sizeGuess: str(r.sizeGuess, 100),
    coatNotes: str(r.coatNotes, 200),
    notes: str(r.notes, 600),
  };
}

export function cleanHealth(raw: unknown): PetHealthResult {
  const r = obj(raw);
  return {
    photoUsable: r.photoUsable !== false,
    possibleIssues: (Array.isArray(r.possibleIssues) ? r.possibleIssues : []).map(obj).map((m) => ({
      name: str(m.name, 80), likelihood: oneOf<Likelihood>(m.likelihood, ['likely', 'possible', 'less likely'], 'possible'),
      signsSeen: str(m.signsSeen), checkAtHome: strList(m.checkAtHome), careSteps: strList(m.careSteps),
    })).filter((m) => m.name).slice(0, 3),
    urgency: oneOf<Urgency>(r.urgency, ['routine', 'soon', 'urgent'], 'soon'),
    seeVetIf: strList(r.seeVetIf, 8),
    summary: str(r.summary, 600),
  };
}
