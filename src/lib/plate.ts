import type { PartnerBrand } from '../config/brand';
import type { FoodSwitchPlan, OtherKind, Pet, PetFoodItem, PetPlate, PlateItem, PlateUnit, PortionUnit, Species } from '../contracts/domain';
import { FOOD_TYPE_BY_ID, foodTypesFor, type FoodSpecies, type FoodType } from '../content/foodTypes';
import { ageOn, isValidDay, today } from './dates';
import { formatAmount, timesWord, unitsCompatible } from './food';
import { mainFood } from './feeding';

/* ---------- pet facts ---------- */

export type LifeStage = 'young' | 'adult' | 'senior';

/** Giant breeds age faster, so they count as senior from 5. */
const GIANT_BREEDS = ['great dane', 'mastiff', 'saint bernard', 'st. bernard', 'newfoundland', 'irish wolfhound', 'bernese mountain', 'leonberger', 'great pyrenees', 'scottish deerhound', 'cane corso'];

export function isGiantBreed(breed?: string): boolean {
  const b = (breed ?? '').toLowerCase();
  return GIANT_BREEDS.some((g) => b.includes(g));
}

export function ageInMonths(birthDate: string | undefined, on: string = today()): number | null {
  if (!isValidDay(birthDate)) return null;
  const a = ageOn(birthDate, on);
  return a ? a.years * 12 + a.months : null;
}

/** Puppy or kitten under 1 year; senior dog from 7 (giant breeds from 5); senior cat from 10. */
export function lifeStage(species: Species, birthDate: string | undefined, breed?: string, on: string = today()): LifeStage | null {
  const m = ageInMonths(birthDate, on);
  if (m === null || species === 'other') return null;
  if (m < 12) return 'young';
  const seniorAt = species === 'cat' ? 10 : isGiantBreed(breed) ? 5 : 7;
  return m / 12 >= seniorAt ? 'senior' : 'adult';
}

export const STAGE_LABEL: Record<Species, Record<LifeStage, string>> = {
  dog: { young: 'Puppy', adult: 'Adult', senior: 'Senior' },
  cat: { young: 'Kitten', adult: 'Adult', senior: 'Senior' },
  other: { young: 'Young', adult: 'Adult', senior: 'Senior' },
};

export function weightKg(weight: number | undefined, unit: 'lb' | 'kg' = 'lb'): number | null {
  if (!weight || !(weight > 0)) return null;
  return unit === 'kg' ? weight : weight / 2.20462262;
}

/** Guesses the kind of "other" pet from the breed text. */
export function otherKindFor(breed?: string): OtherKind | undefined {
  const b = (breed ?? '').toLowerCase();
  if (/rabbit|bunny/.test(b)) return 'rabbit';
  if (/guinea|cavy/.test(b)) return 'guinea_pig';
  if (/bird|parrot|parakeet|budgie|cockatiel|finch|canary|conure|lovebird|macaw|cockatoo/.test(b)) return 'bird';
  if (/reptile|lizard|gecko|snake|python|turtle|tortoise|dragon|iguana|skink|chameleon/.test(b)) return 'reptile';
  return undefined;
}

export function plateSpecies(species: Species, otherKind?: OtherKind): FoodSpecies | null {
  if (species === 'dog' || species === 'cat') return species;
  return otherKind ?? null;
}

/* ---------- calories ---------- */

export const CALORIE_NOTE = 'This is a starting estimate. Your vet can give you a target for your pet.';

/** Resting energy requirement: 70 x (body weight in kg ^ 0.75). */
export function restingEnergy(kg: number): number {
  return 70 * Math.pow(kg, 0.75);
}

export interface CalorieFactorInput {
  species: Species;
  months: number | null;
  stage: LifeStage | null;
  activity?: Pet['activity'];
  bodyCondition?: Pet['bodyCondition'];
  neutered?: boolean;
}

/** Common starting multipliers on resting energy. "High" activity is capped at 2.0. */
export function calorieFactor(p: CalorieFactorInput): { factor: number; label: string } | null {
  if (p.species === 'dog') {
    if (p.months !== null && p.months < 4) return { factor: 3.0, label: 'puppy under 4 months' };
    if (p.stage === 'young') return { factor: 2.0, label: 'puppy 4 to 12 months' };
    if (p.bodyCondition === 'over') return { factor: 1.0, label: 'weight loss' };
    if (p.stage === 'senior') return { factor: 1.4, label: 'senior' };
    if (p.activity === 'high') return { factor: 2.0, label: 'active adult' };
    if (p.activity === 'low') return { factor: 1.4, label: 'less active adult' };
    if (p.neutered === false) return { factor: 1.8, label: 'intact adult' };
    return { factor: 1.6, label: p.neutered ? 'spayed or neutered adult' : 'adult' };
  }
  if (p.species === 'cat') {
    if (p.stage === 'young') return { factor: 2.5, label: 'kitten' };
    if (p.bodyCondition === 'over') return { factor: 0.8, label: 'weight loss' };
    if (p.stage === 'senior') return { factor: 1.1, label: 'senior' };
    if (p.activity === 'high') return { factor: 1.4, label: 'active adult' };
    if (p.activity === 'low') return { factor: 1.0, label: 'less active adult' };
    if (p.neutered === false) return { factor: 1.4, label: 'intact adult' };
    return { factor: 1.2, label: p.neutered ? 'spayed or neutered adult' : 'adult' };
  }
  return null;
}

export interface CalorieInfo {
  kcal: number;
  source: 'vet' | 'estimate';
  rer?: number;
  factor?: number;
  factorLabel?: string;
}

type CalorieInput = Pick<Pet, 'species' | 'birthDate' | 'breed' | 'weight' | 'weightUnit' | 'activity' | 'bodyCondition' | 'neutered' | 'dailyCalorieTarget'>;

/** The pet's own calorie target when set, else a rounded starting estimate (dogs and cats with a weight). */
export function dailyCalories(p: CalorieInput, on: string = today()): CalorieInfo | null {
  if (p.dailyCalorieTarget && p.dailyCalorieTarget > 0) return { kcal: Math.round(p.dailyCalorieTarget), source: 'vet' };
  const kg = weightKg(p.weight, p.weightUnit);
  if (!kg || (p.species !== 'dog' && p.species !== 'cat')) return null;
  const months = ageInMonths(p.birthDate, on);
  const f = calorieFactor({ species: p.species, months, stage: lifeStage(p.species, p.birthDate, p.breed, on), activity: p.activity, bodyCondition: p.bodyCondition, neutered: p.neutered });
  if (!f) return null;
  const rer = restingEnergy(kg);
  return { kcal: Math.round((rer * f.factor) / 10) * 10, source: 'estimate', rer: Math.round(rer), factor: f.factor, factorLabel: f.label };
}

/* ---------- suggestions ---------- */

export const BASE_MIN = 50;
export const TREAT_CAP = 10;
export const STEP = 5;

export interface Suggestion { typeId: string; reasons: string[] }

export interface PlateInput extends Partial<CalorieInput> {
  species: Species;
  otherKind?: OtherKind;
  allergies?: string[];
  dietaryNotes?: string;
  currentFoods?: Array<Pick<PetFoodItem, 'kind' | 'brand' | 'product' | 'portionUnit' | 'active'> & { flavor?: string; notes?: string }>;
  on?: string;
}

export interface PlateSuggestion {
  species: FoodSpecies | null;
  stage: LifeStage | null;
  base: Suggestion | null;
  addOns: Suggestion[];
  /** Base plus add-ons with shares that add up to 100 (supplements at 0). */
  items: PlateItem[];
  notes: string[];
  calories: CalorieInfo | null;
}

const ALLERGY_RULES: Array<{ match: RegExp; note: (x: string) => string }> = [
  { match: /chicken|poultry/, note: () => 'Allergic to chicken: pick a fish or lamb based recipe, and check treats too' },
  { match: /beef/, note: () => 'Allergic to beef: pick a fish, turkey or lamb based recipe' },
  { match: /fish|salmon|tuna/, note: () => 'Allergic to fish: pick a chicken, turkey or lamb based recipe' },
  { match: /dairy|milk|cheese|lactose/, note: () => 'Allergic to dairy: skip cheese and milk based treats' },
  { match: /grain|wheat|corn|soy|gluten/, note: (x) => `Sensitive to ${x}: read labels and pick a recipe without it` },
];

export function allergyNotes(allergies: string[] = []): string[] {
  return allergies.map((a) => a.trim()).filter(Boolean).map((a) => {
    const l = a.toLowerCase();
    const rule = ALLERGY_RULES.find((r) => r.match.test(l));
    return rule ? rule.note(l) : `Allergic to ${l}: check the ingredient list on every food and treat`;
  });
}

/** Lays out shares: add-ons keep their default share (treats capped), the base gets the rest. */
export function splitFor(base: string | null, addOns: string[]): PlateItem[] {
  const items: PlateItem[] = [];
  if (base) items.push({ typeId: base, share: 100, base: true });
  let treats = 0;
  for (const id of addOns) {
    const t = FOOD_TYPE_BY_ID.get(id);
    if (!t) continue;
    let share = t.role === 'supplement' ? 0 : t.defaultShare;
    if (t.role === 'treat') { share = Math.min(share, TREAT_CAP - treats); treats += share; }
    items.push({ typeId: id, share });
  }
  return rebalance(items);
}

export function suggestPlate(input: PlateInput): PlateSuggestion {
  const on = input.on ?? today();
  const species = plateSpecies(input.species, input.otherKind);
  const stage = lifeStage(input.species, input.birthDate, input.breed, on);
  const calories = dailyCalories({ species: input.species, birthDate: input.birthDate, breed: input.breed, weight: input.weight, weightUnit: input.weightUnit, activity: input.activity, bodyCondition: input.bodyCondition, neutered: input.neutered, dailyCalorieTarget: input.dailyCalorieTarget }, on);
  const allergy = allergyNotes(input.allergies);
  const notes: string[] = [];
  if (!species) return { species, stage, base: null, addOns: [], items: [], notes: ['Pick what kind of pet this is to see suggestions.'], calories: null };

  const foods = (input.currentFoods ?? []).filter((f) => f.active !== false && f.kind === 'food');
  const text = [input.dietaryNotes, ...foods.map((f) => `${f.brand} ${f.product} ${f.flavor ?? ''} ${f.notes ?? ''}`)].join(' ').toLowerCase();
  const picky = /picky|fussy|finicky/.test(text);
  const sensitive = /sensitive|stomach|digest/.test(text);
  const wetPref = /\bwet\b|canned|\bcans?\b|pate|pouch/.test(text) || foods.some((f) => f.portionUnit === 'cans' || f.portionUnit === 'pouches');
  const dryPref = /\bdry\b|kibble/.test(text) || foods.some((f) => f.portionUnit === 'cups');
  const over = input.bodyCondition === 'over';

  let base: Suggestion;
  const addOns: Suggestion[] = [];
  const add = (typeId: string, reason: string) => { if (typeId !== base.typeId && !addOns.some((a) => a.typeId === typeId)) addOns.push({ typeId, reasons: [reason] }); };

  if (species === 'dog') {
    if (wetPref && !dryPref) base = { typeId: 'dog-wet', reasons: ['Already eats wet food, so it stays the base'] };
    else base = {
      typeId: 'dog-dry',
      reasons: [stage === 'young' ? 'Puppy: pick a kibble made for growth or all life stages'
        : stage === 'senior' ? 'Senior: a senior kibble, softened with warm water if chewing is hard'
        : over ? 'Watching weight: a measured kibble base makes portions easy'
        : 'Complete and balanced base that is easy to measure'],
    };
    if (stage === 'senior' && base.typeId !== 'dog-wet') add('dog-wet', 'Senior: soft wet food is easier to chew');
    if (sensitive) add('dog-fresh', 'Sensitive stomach: gently cooked food is often easy to digest; add it slowly');
    else if (picky) add('dog-fresh', 'Picky eater: a fresh-cooked topper makes the bowl more tempting');
    else if (!over && stage !== 'senior') add('dog-fresh', 'A fresh-cooked topper adds variety and moisture');
    add('dog-treats', over ? 'Watching weight: count every treat inside the 10 percent cap' : stage === 'young' ? 'Puppy: small soft treats for training, kept to 10 percent' : 'Treats are fine at up to about 10 percent of calories');
    if (stage === 'senior' || (isGiantBreed(input.breed) && stage === 'adult') || input.activity === 'high') add('dog-supp-joint', stage === 'senior' ? 'Senior: ask your vet whether a joint supplement makes sense' : 'Big or busy dog: ask your vet about joint support');
    if (over) notes.push('Watching weight: measure every meal and ask your vet for a target weight.');
  } else if (species === 'cat') {
    if (dryPref && !wetPref) {
      base = { typeId: 'cat-dry', reasons: ['Already eats dry food, so it stays the base for now'] };
      add('cat-wet-pate', 'Wet food adds water, good for cats');
    } else if (picky) {
      base = { typeId: 'cat-wet-chunks', reasons: ['Picky eater: chunks in gravy are a favorite for many cats', 'Wet food adds water, good for cats'] };
    } else {
      base = { typeId: 'cat-wet-pate', reasons: [stage === 'senior' ? 'Senior: smooth pate is easy to eat and adds water' : stage === 'young' ? 'Kitten: a kitten or all life stages wet food supports growth' : 'Wet food adds water, good for cats'] };
    }
    if (base.typeId !== 'cat-dry' && !over) add('cat-dry', 'A little dry food works for puzzle feeders and grazing');
    if (stage === 'senior') add('cat-broth', 'Senior: broth adds water, which older cats often need');
    if (picky && base.typeId !== 'cat-wet-chunks') add('cat-toppers', 'Picky eater: a small topper can win them over');
    add('cat-lickable', 'Lickable treats add a little water; keep treats under 10 percent');
    if (over) notes.push('Watching weight: skip free-fed dry food and measure meals. Ask your vet for a target weight.');
  } else {
    const types = foodTypesFor(species);
    const b = types.find((t) => t.role === 'base')!;
    base = { typeId: b.id, reasons: [b.typicalShare] };
    for (const t of types.filter((x) => x.id !== b.id)) add(t.id, t.askVet ? 'Ask an exotics vet' : t.typicalShare);
  }
  if (allergy.length) base.reasons.push(...allergy);
  const chosen = addOns.slice(0, 3);
  return { species, stage, base, addOns: chosen, items: splitFor(base.typeId, chosen.map((a) => a.typeId)), notes: [...allergy, ...notes], calories };
}

/* ---------- builder rules ---------- */

const typeOf = (id: string): FoodType | undefined => FOOD_TYPE_BY_ID.get(id);
const roleOf = (id: string) => typeOf(id)?.role;
const round5 = (n: number) => Math.floor(n / STEP) * STEP;

export function baseOf(items: PlateItem[]): PlateItem | undefined {
  return items.find((i) => i.base);
}

export function treatTotal(items: PlateItem[]): number {
  return items.filter((i) => roleOf(i.typeId) === 'treat').reduce((a, i) => a + i.share, 0);
}

/** Base gets whatever the add-ons leave. Trims the newest add-ons if the base would drop under 50. */
export function rebalance(items: PlateItem[]): PlateItem[] {
  const next = items.map((i) => ({ ...i, share: roleOf(i.typeId) === 'supplement' ? 0 : i.share }));
  const base = next.find((i) => i.base);
  if (!base) return next;
  const room = 100 - BASE_MIN;
  for (let k = next.length - 1; k >= 0 && next.filter((i) => !i.base).reduce((a, i) => a + i.share, 0) > room; k--) {
    const it = next[k];
    if (it.base) continue;
    const over = next.filter((i) => !i.base).reduce((a, i) => a + i.share, 0) - room;
    it.share = Math.max(0, it.share - Math.ceil(over / STEP) * STEP);
  }
  const kept = next.filter((i) => i.base || i.share > 0 || roleOf(i.typeId) === 'supplement');
  const addOnTotal = kept.filter((i) => !i.base).reduce((a, i) => a + i.share, 0);
  return kept.map((i) => (i.base ? { ...i, share: 100 - addOnTotal } : i));
}

export interface PlateEdit { items: PlateItem[]; message?: string }

/** Adds or removes a food type, keeping the base at 50 percent or more and treats at 10 percent or less. */
export function toggleType(items: PlateItem[], typeId: string): PlateEdit {
  const t = typeOf(typeId);
  if (!t) return { items };
  const existing = items.find((i) => i.typeId === typeId);
  if (existing) {
    let rest = items.filter((i) => i.typeId !== typeId);
    if (existing.base) {
      const promote = [...rest].filter((i) => roleOf(i.typeId) === 'base').sort((a, b) => b.share - a.share)[0];
      if (promote) rest = rest.map((i) => (i.typeId === promote.typeId ? { ...i, base: true } : i));
    }
    return { items: rebalance(rest) };
  }
  if (t.role === 'supplement') return { items: [...items, { typeId, share: 0 }] };
  const base = baseOf(items);
  if (!base) {
    if (t.role === 'base') return { items: rebalance([{ typeId, share: 100, base: true }, ...items]) };
    return { items, message: 'Pick a base food first.' };
  }
  let share = t.defaultShare;
  if (t.role === 'treat') share = Math.min(share, TREAT_CAP - treatTotal(items));
  share = round5(Math.min(share, base.share - BASE_MIN));
  if (share < STEP) return { items, message: t.role === 'treat' && treatTotal(items) >= TREAT_CAP ? 'Treats are already at the 10 percent cap.' : 'No room left: the base stays at 50 percent or more. Lower another item first.' };
  return { items: rebalance([...items, { typeId, share }]) };
}

export function canStep(items: PlateItem[], typeId: string, delta: number): boolean {
  const it = items.find((i) => i.typeId === typeId);
  const base = baseOf(items);
  if (!it || it.base || !base || roleOf(typeId) === 'supplement') return false;
  if (delta > 0) return base.share - STEP >= BASE_MIN && (roleOf(typeId) !== 'treat' || treatTotal(items) + STEP <= TREAT_CAP);
  return it.share - STEP >= STEP;
}

/** Moves one add-on up or down 5 percent; the base takes up the difference. */
export function stepShare(items: PlateItem[], typeId: string, delta: 5 | -5): PlateEdit {
  if (!canStep(items, typeId, delta)) {
    const it = items.find((i) => i.typeId === typeId);
    if (delta > 0 && it && roleOf(typeId) === 'treat' && treatTotal(items) + STEP > TREAT_CAP) return { items, message: 'Treats stay at 10 percent or less.' };
    if (delta > 0) return { items, message: 'The base stays at 50 percent or more.' };
    return { items };
  }
  return { items: rebalance(items.map((i) => (i.typeId === typeId ? { ...i, share: i.share + delta } : i))) };
}

/** Makes an add-on the base; the old base takes its place and share. */
export function makeBase(items: PlateItem[], typeId: string): PlateItem[] {
  const it = items.find((i) => i.typeId === typeId);
  const old = baseOf(items);
  if (!it || it.base || roleOf(typeId) !== 'base') return items;
  return rebalance(items.map((i) => (i.typeId === typeId ? { ...i, base: true, share: 100 } : i === old ? { ...i, base: false, share: Math.min(it.share, 100 - BASE_MIN) } : i)));
}

/** Base first, then add-ons by share, supplements last. */
export function orderedItems(items: PlateItem[]): PlateItem[] {
  return [...items].sort((a, b) => Number(!!b.base) - Number(!!a.base) || b.share - a.share);
}

/* ---------- amounts ---------- */

export const UNIT_WORDS: Record<PlateUnit, [string, string]> = {
  cup: ['cup', 'cups'], can: ['can', 'cans'], pouch: ['pouch', 'pouches'], oz: ['oz', 'oz'], piece: ['piece', 'pieces'], serving: ['serving', 'servings'],
};
export const PLATE_UNITS: PlateUnit[] = ['cup', 'can', 'pouch', 'oz', 'piece', 'serving'];
const TO_PORTION: Record<PlateUnit, PortionUnit | undefined> = { cup: 'cups', can: 'cans', pouch: 'pouches', oz: 'oz', piece: 'pieces', serving: undefined };

export function unitAmount(n: number, unit: PlateUnit): string {
  const v = unit === 'piece' ? Math.max(0, Math.round(n)) : n;
  return `${formatAmount(v)} ${UNIT_WORDS[unit][v === 1 ? 0 : 1]}`;
}

export interface DailyAmount { kcal: number; perDay: number; perFeeding: number }

/** Calories, amount per day and per feeding for one item. Null without a calorie target or kcal per unit. */
export function dailyAmount(item: PlateItem, kcalTarget: number | undefined, timesPerDay = 2): DailyAmount | null {
  if (!kcalTarget || !(item.kcalPerUnit && item.kcalPerUnit > 0) || item.share <= 0) return null;
  const kcal = (kcalTarget * item.share) / 100;
  const perDay = kcal / item.kcalPerUnit;
  const per = perDay / Math.max(1, timesPerDay);
  const r = (n: number) => Math.round(n * 20) / 20;
  return { kcal: Math.round(kcal), perDay: r(perDay), perFeeding: r(per) };
}

/* ---------- partners ---------- */

/** Food partners whose products fit a food type. Without an explicit list, only the common shelf types qualify. */
export function partnersForType<P extends Pick<PartnerBrand, 'category' | 'species'> & { foodTypes?: string[] }>(type: FoodType, partners: readonly P[]): P[] {
  if (type.species !== 'dog' && type.species !== 'cat') return [];
  const sp = type.species;
  return partners.filter((p) => p.category === 'food_and_treats' && p.species.includes(sp) && (p.foodTypes ? p.foodTypes.includes(type.id) : !!type.common));
}

/* ---------- use this plate ---------- */

export interface PlateChange { action: 'update' | 'create' | 'skip'; text: string; item?: PetFoodItem }

const norm = (s?: string) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Works out the food tracker changes for a plate: the base becomes (or
 * updates) the active food with a computed portion, add-ons become extra
 * active foods or treats. Pure; the page shows these lines before applying.
 */
export function planUseOfPlate(args: {
  plate: Pick<PetPlate, 'items' | 'kcalTarget'>;
  pet: Pick<Pet, 'id' | 'householdId'>;
  foods: PetFoodItem[];
  plans?: FoodSwitchPlan[];
  now: string;
  makeId: () => string;
}): PlateChange[] {
  const { plate, pet, now, makeId } = args;
  const foods = args.foods.filter((f) => f.petId === pet.id);
  const main = mainFood(foods, pet.id, args.plans ?? []);
  const times = main?.timesPerDay ?? 2;
  const t0 = Date.parse(now);
  let k = 0;
  const out: PlateChange[] = [];
  for (const item of orderedItems(plate.items)) {
    const type = typeOf(item.typeId);
    if (!type) continue;
    if (type.role === 'supplement') { out.push({ action: 'skip', text: `${type.name}: supplements stay off the food tracker. Ask your vet first.` }); continue; }
    const kind = type.role === 'treat' ? 'treat' : 'food';
    const unit = item.unit ?? type.unit;
    const amt = dailyAmount(item, plate.kcalTarget, times);
    const portionUnit = TO_PORTION[unit];
    const typed = !!(item.brand?.trim() || item.product?.trim());
    const match =
      foods.find((f) => f.fromPlate === item.typeId && f.kind === kind) ??
      (typed ? foods.find((f) => f.kind === kind && norm(f.brand) === norm(item.brand || type.name) && norm(f.product) === norm(item.product || f.product)) : undefined) ??
      (item.base && !typed && main?.kind === 'food' ? main : undefined);
    const stamp = new Date((Number.isFinite(t0) ? t0 : Date.now()) + k++).toISOString();
    const amountWords = amt ? (kind === 'treat' ? `about ${unitAmount(amt.perDay, unit)} a day` : `${unitAmount(amt.perFeeding, unit)} ${timesWord(times)}`) : '';
    if (match) {
      const next: PetFoodItem = { ...match, active: true, fromPlate: item.typeId, updatedAt: now };
      let note = '';
      if (kind === 'food' && amt && portionUnit) {
        if (match.packageUnit && !unitsCompatible(portionUnit, match.packageUnit)) note = ' (portion unchanged: the plate unit does not match the bag)';
        else Object.assign(next, { portionAmount: amt.perFeeding, portionUnit, timesPerDay: times });
      }
      if (kind === 'treat' && unit === 'piece' && item.kcalPerUnit) next.kcalPerPiece = item.kcalPerUnit;
      out.push({ action: 'update', item: next, text: `Update ${match.brand} ${match.product}${amountWords && !note ? `: ${amountWords}` : ''}${note}` });
      continue;
    }
    const created: PetFoodItem = {
      id: makeId(), householdId: pet.householdId, petId: pet.id, kind,
      brand: item.brand?.trim() || type.name,
      product: item.product?.trim() || (kind === 'treat' ? 'Treats from your plate' : 'From your plate'),
      favorite: kind === 'treat',
      ...(kind === 'food' && amt && portionUnit ? { portionAmount: amt.perFeeding, portionUnit, timesPerDay: times } : {}),
      ...(kind === 'treat' && unit === 'piece' && item.kcalPerUnit ? { kcalPerPiece: item.kcalPerUnit } : {}),
      purchases: [], active: true, fromPlate: item.typeId, createdAt: stamp, updatedAt: now,
    };
    out.push({ action: 'create', item: created, text: `Add ${item.brand?.trim() || type.name} as ${kind === 'treat' ? 'a treat' : item.base ? 'the main food' : 'an extra active food'}${amountWords ? `: ${amountWords}` : ''}` });
  }
  return out;
}

/** "Dry kibble 75%, Fresh-cooked (refrigerated) 15%, Treats and chews 10%" */
export function plateSummary(items: PlateItem[]): string {
  return orderedItems(items).filter((i) => i.share > 0).map((i) => `${typeOf(i.typeId)?.name ?? i.typeId} ${i.share}%`).join(', ');
}
