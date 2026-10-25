import type { OtherKind, PlateUnit } from '../contracts/domain';

/**
 * Original, mainstream general guidance about kinds of pet food, used by the
 * Create a plate builder. Food TYPES only: no product names, brands or prices.
 * This is general information, not veterinary advice; the UI says so.
 */

export type FoodSpecies = 'dog' | 'cat' | OtherKind;
/** base: can carry the meal. addon: smaller extra. treat: counts toward the 10 percent treat cap. supplement: not part of the calorie split. */
export type FoodRole = 'base' | 'addon' | 'treat' | 'supplement';
export type GoodFor = 'young' | 'adult' | 'senior' | 'weight_control' | 'picky_eater' | 'sensitive_stomach' | 'active' | 'hydration' | 'dental';

export interface FoodType {
  id: string;
  species: FoodSpecies;
  name: string;
  /** What it is, one or two plain sentences. */
  what: string;
  pros: string[];
  watchOuts: string[];
  role: FoodRole;
  /** Base-role types can be the base or a smaller mixed-in part. */
  /** Percent used when added as an add-on (bases use the remainder). */
  defaultShare: number;
  /** How it usually fits on the plate, in words. */
  typicalShare: string;
  goodFor: GoodFor[];
  unit: PlateUnit;
  /** Common shelf foods that most pet food makers sell. */
  common?: boolean;
  safetyNote?: string;
  askVet?: boolean;
}

export const GOOD_FOR_LABEL: Record<GoodFor, string> = {
  young: 'Puppy or kitten',
  adult: 'Adult',
  senior: 'Senior',
  weight_control: 'Weight control',
  picky_eater: 'Picky eater',
  sensitive_stomach: 'Sensitive stomach',
  active: 'Active',
  hydration: 'Hydration',
  dental: 'Dental',
};

export const ROLE_LABEL: Record<FoodRole, string> = { base: 'Base foods', addon: 'Add-ons', treat: 'Treats', supplement: 'Supplements' };

const RAW_SAFETY =
  'Raw food can carry germs such as Salmonella and Listeria that can make pets and people sick. Handle it like raw meat: separate surfaces, wash hands and bowls, and keep it cold. Talk with your vet first, especially if young children, older adults or anyone with a weakened immune system live with you.';

const ASK_VET = 'Ask your vet before starting a supplement, and tell them about anything your pet already takes.';

export const SPECIES_NOTE: Record<FoodSpecies, string> = {
  dog: 'Most dogs do well on a complete and balanced base food, with add-ons kept small so the base still does its job.',
  cat: 'Cats need a meat based diet; they cannot thrive on plant based food. Wet food helps them get enough water, since many cats do not drink much.',
  rabbit: 'Hay should make up most of what a rabbit eats. It keeps the gut moving and wears down teeth that never stop growing.',
  guinea_pig: 'Guinea pigs cannot make their own vitamin C, so it has to come from food every day. Hay comes first.',
  bird: 'Seed-only diets are a common cause of poor health in pet birds. A pellet base with fresh vegetables is a better everyday mix.',
  reptile: 'Reptile diets differ a lot by species: some eat insects, some eat plants, some eat both. Ask an exotics vet what yours needs.',
};

export const OTHER_KINDS: Array<{ id: OtherKind; label: string }> = [
  { id: 'rabbit', label: 'Rabbit' },
  { id: 'guinea_pig', label: 'Guinea pig' },
  { id: 'bird', label: 'Bird' },
  { id: 'reptile', label: 'Reptile' },
];

const t = (o: FoodType): FoodType => o;

export const FOOD_TYPES: FoodType[] = [
  /* ---------- dog ---------- */
  t({
    id: 'dog-dry', species: 'dog', name: 'Dry kibble', role: 'base', defaultShare: 30, unit: 'cup', common: true,
    what: 'Baked or extruded dry food. Look for "complete and balanced" for your dog\'s life stage on the bag.',
    pros: ['Easy to measure, store and travel with', 'Usually the most budget friendly per calorie', 'Works in puzzle feeders and for training'],
    watchOuts: ['Calorie dense, so measure with a real cup', 'Low in moisture; keep fresh water out'],
    typicalShare: 'Often the base, 70 to 100 percent of the plate', goodFor: ['young', 'adult', 'senior', 'weight_control', 'active'],
  }),
  t({
    id: 'dog-wet', species: 'dog', name: 'Wet or canned', role: 'base', defaultShare: 20, unit: 'can', common: true,
    what: 'Cooked food sealed in cans, trays or pouches. Can be a full meal or a smaller mixer.',
    pros: ['Soft and easy to chew', 'Adds water to the diet', 'Very appealing to most dogs'],
    watchOuts: ['Refrigerate leftovers and use within a few days', 'Costs more per calorie than kibble'],
    typicalShare: 'A full base, or a 10 to 30 percent mixer', goodFor: ['senior', 'picky_eater', 'hydration'],
  }),
  t({
    id: 'dog-fresh', species: 'dog', name: 'Fresh-cooked (refrigerated)', role: 'base', defaultShare: 15, unit: 'cup',
    what: 'Gently cooked meals kept in the fridge or freezer. Some are complete diets, others are meant as toppers.',
    pros: ['Moist and very tasty to most dogs', 'Easy to add a little on top of kibble'],
    watchOuts: ['Needs fridge space and a short use-by window', 'Check that it is complete and balanced if it is the whole meal'],
    typicalShare: 'Often a 10 to 25 percent topper, or a full base', goodFor: ['picky_eater', 'sensitive_stomach', 'senior', 'hydration'],
  }),
  t({
    id: 'dog-freeze-dried', species: 'dog', name: 'Freeze-dried or air-dried', role: 'base', defaultShare: 10, unit: 'cup',
    what: 'Meat based food with the water removed, sold as nuggets, crumbles or chunks. Many are raw before drying.',
    pros: ['Light and shelf stable', 'Strong smell that tempts picky eaters'],
    watchOuts: ['Very calorie dense for its size', 'If it is raw before drying, handle it like raw meat'],
    typicalShare: 'Usually a 5 to 15 percent topper', goodFor: ['picky_eater', 'active'],
  }),
  t({
    id: 'dog-raw', species: 'dog', name: 'Raw', role: 'base', defaultShare: 15, unit: 'oz', safetyNote: RAW_SAFETY,
    what: 'Uncooked meat, organs and bone, sold frozen or made at home.',
    pros: ['Some dogs find it very appealing'],
    watchOuts: ['Germ risk for pets and people in the home', 'Homemade raw is hard to balance without a vet nutritionist'],
    typicalShare: 'A full base or a topper; talk with your vet first', goodFor: ['adult', 'active'],
  }),
  t({
    id: 'dog-toppers', species: 'dog', name: 'Toppers and mixers', role: 'addon', defaultShare: 10, unit: 'serving',
    what: 'Sprinkles, sauces and small mix-ins made to go on top of a main food.',
    pros: ['Adds variety without changing the base food', 'Helps picky eaters finish the bowl'],
    watchOuts: ['Calories add up; cut the base a little to make room', 'Most are not complete on their own'],
    typicalShare: 'Around 5 to 10 percent', goodFor: ['picky_eater', 'adult', 'senior'],
  }),
  t({
    id: 'dog-broth', species: 'dog', name: 'Broths', role: 'addon', defaultShare: 5, unit: 'cup',
    what: 'Pet-safe broths poured over food or offered as a drink.',
    pros: ['Adds water and smell to dry food', 'Low in calories'],
    watchOuts: ['Skip human broth with onion, garlic or lots of salt'],
    typicalShare: 'A splash, about 5 percent', goodFor: ['hydration', 'picky_eater', 'senior'],
  }),
  t({
    id: 'dog-treats', species: 'dog', name: 'Treats and chews', role: 'treat', defaultShare: 10, unit: 'piece', common: true,
    what: 'Training bites, biscuits and longer lasting chews.',
    pros: ['Great for training and bonding', 'Chews can keep a dog busy'],
    watchOuts: ['Keep all treats to about 10 percent of daily calories', 'Watch your dog with hard chews and toss small leftover pieces'],
    typicalShare: 'Up to 10 percent', goodFor: ['young', 'adult', 'senior', 'active'],
  }),
  t({
    id: 'dog-dental', species: 'dog', name: 'Dental chews', role: 'treat', defaultShare: 5, unit: 'piece',
    what: 'Chews shaped to scrape teeth as your dog chews. They count as treats.',
    pros: ['Can help with plaque between dental cleanings'],
    watchOuts: ['Pick the right size for your dog', 'They help but do not replace brushing or vet cleanings'],
    typicalShare: 'About 5 percent, inside the treat budget', goodFor: ['dental', 'adult', 'senior'],
  }),
  t({
    id: 'dog-supp-joint', species: 'dog', name: 'Joint supplement', role: 'supplement', defaultShare: 0, unit: 'serving', askVet: true,
    what: 'Chews, powders or liquids aimed at joint comfort and mobility.',
    pros: ['Often suggested for older, large or very active dogs'],
    watchOuts: [ASK_VET],
    typicalShare: 'Not part of the plate split', goodFor: ['senior', 'active'],
  }),
  t({
    id: 'dog-supp-skin', species: 'dog', name: 'Skin and coat supplement', role: 'supplement', defaultShare: 0, unit: 'serving', askVet: true,
    what: 'Usually fish oil based, aimed at skin and coat.',
    pros: ['Sometimes suggested for dry skin or a dull coat'],
    watchOuts: [ASK_VET, 'Fish oil can upset some stomachs; start small'],
    typicalShare: 'Not part of the plate split', goodFor: ['adult', 'senior'],
  }),
  t({
    id: 'dog-supp-probiotic', species: 'dog', name: 'Probiotic', role: 'supplement', defaultShare: 0, unit: 'serving', askVet: true,
    what: 'Friendly bacteria for the gut, often a powder or chew.',
    pros: ['Sometimes suggested during food changes or after stomach upsets'],
    watchOuts: [ASK_VET],
    typicalShare: 'Not part of the plate split', goodFor: ['sensitive_stomach'],
  }),

  /* ---------- cat ---------- */
  t({
    id: 'cat-dry', species: 'cat', name: 'Dry food', role: 'base', defaultShare: 30, unit: 'cup', common: true,
    what: 'Dry kibble for cats. Look for "complete and balanced" for your cat\'s life stage.',
    pros: ['Easy to measure and leave out for a timed or puzzle feeder', 'Budget friendly'],
    watchOuts: ['Very low in moisture; pair with wet food or a fountain', 'Easy to overfeed; measure it'],
    typicalShare: 'Often 20 to 40 percent alongside wet food, or a base', goodFor: ['young', 'adult', 'active'],
  }),
  t({
    id: 'cat-wet-pate', species: 'cat', name: 'Wet pate', role: 'base', defaultShare: 30, unit: 'can', common: true,
    what: 'Smooth, loaf style wet food in cans or trays.',
    pros: ['Adds a lot of water to the diet', 'Smooth texture suits seniors and kittens'],
    watchOuts: ['Refrigerate leftovers and use within a couple of days', 'Some cats prefer chunks; try both'],
    typicalShare: 'A great base, 50 to 100 percent', goodFor: ['young', 'senior', 'hydration', 'weight_control'],
  }),
  t({
    id: 'cat-wet-chunks', species: 'cat', name: 'Wet chunks or shreds', role: 'base', defaultShare: 25, unit: 'pouch', common: true,
    what: 'Pieces or shreds in gravy or broth, in cans or pouches.',
    pros: ['Adds water', 'Many cats love the gravy'],
    watchOuts: ['Some cats lick the gravy and leave the pieces'],
    typicalShare: 'A base or a 20 to 40 percent mix', goodFor: ['picky_eater', 'hydration', 'adult'],
  }),
  t({
    id: 'cat-fresh', species: 'cat', name: 'Fresh-cooked', role: 'base', defaultShare: 15, unit: 'oz',
    what: 'Gently cooked, refrigerated meals for cats.',
    pros: ['Moist and very tasty to most cats'],
    watchOuts: ['Short fridge life', 'Make sure it is complete and balanced if it is the whole meal'],
    typicalShare: 'A 10 to 20 percent topper, or a base', goodFor: ['picky_eater', 'sensitive_stomach', 'hydration'],
  }),
  t({
    id: 'cat-freeze-dried', species: 'cat', name: 'Freeze-dried', role: 'base', defaultShare: 10, unit: 'serving',
    what: 'Meat with the water removed, as nuggets or crumbles. Often raw before drying.',
    pros: ['Strong smell that tempts picky cats', 'Shelf stable'],
    watchOuts: ['Calorie dense', 'If it is raw before drying, handle it like raw meat'],
    typicalShare: 'About 5 to 10 percent as a topper', goodFor: ['picky_eater'],
  }),
  t({
    id: 'cat-raw', species: 'cat', name: 'Raw', role: 'base', defaultShare: 15, unit: 'oz', safetyNote: RAW_SAFETY,
    what: 'Uncooked meat based food, usually sold frozen.',
    pros: ['Some cats find it very appealing'],
    watchOuts: ['Germ risk for pets and people in the home', 'Homemade raw is hard to balance; cats need taurine'],
    typicalShare: 'A base or topper; talk with your vet first', goodFor: ['adult'],
  }),
  t({
    id: 'cat-toppers', species: 'cat', name: 'Toppers', role: 'addon', defaultShare: 5, unit: 'serving',
    what: 'Small mix-ins and sprinkles to make a main food more interesting.',
    pros: ['Adds variety without changing the main food'],
    watchOuts: ['Not complete on their own; keep them small'],
    typicalShare: 'Around 5 percent', goodFor: ['picky_eater', 'senior'],
  }),
  t({
    id: 'cat-broth', species: 'cat', name: 'Broths', role: 'addon', defaultShare: 5, unit: 'serving',
    what: 'Cat-safe broths to pour over food or serve on the side.',
    pros: ['Easy way to add water', 'Low in calories'],
    watchOuts: ['Skip human broth with onion, garlic or lots of salt'],
    typicalShare: 'A splash, about 5 percent', goodFor: ['hydration', 'senior', 'picky_eater'],
  }),
  t({
    id: 'cat-lickable', species: 'cat', name: 'Lickable treats', role: 'treat', defaultShare: 10, unit: 'piece',
    what: 'Squeeze tubes and purees served from the tube or on a spoon.',
    pros: ['Adds a little water', 'Handy for pilling and bonding'],
    watchOuts: ['Count them toward the 10 percent treat budget'],
    typicalShare: 'Up to 10 percent', goodFor: ['hydration', 'senior', 'picky_eater'],
  }),
  t({
    id: 'cat-crunchy-treats', species: 'cat', name: 'Crunchy treats', role: 'treat', defaultShare: 5, unit: 'piece', common: true,
    what: 'Small crunchy bites for rewards and play.',
    pros: ['Easy to use for training and games'],
    watchOuts: ['Easy to overdo; count pieces'],
    typicalShare: 'About 5 percent', goodFor: ['young', 'adult', 'active'],
  }),
  t({
    id: 'cat-dental', species: 'cat', name: 'Dental treats', role: 'treat', defaultShare: 5, unit: 'piece',
    what: 'Treats with a texture meant to help clean teeth as cats chew.',
    pros: ['Can help with plaque between vet cleanings'],
    watchOuts: ['They count as treats', 'They do not replace brushing or cleanings'],
    typicalShare: 'About 5 percent, inside the treat budget', goodFor: ['dental', 'adult', 'senior'],
  }),
  t({
    id: 'cat-supp-joint', species: 'cat', name: 'Joint supplement', role: 'supplement', defaultShare: 0, unit: 'serving', askVet: true,
    what: 'Powders, chews or liquids aimed at mobility in older cats.',
    pros: ['Sometimes suggested for older cats who jump less'],
    watchOuts: [ASK_VET],
    typicalShare: 'Not part of the plate split', goodFor: ['senior'],
  }),
  t({
    id: 'cat-supp-skin', species: 'cat', name: 'Skin and coat supplement', role: 'supplement', defaultShare: 0, unit: 'serving', askVet: true,
    what: 'Usually fish oil based, aimed at skin and coat.',
    pros: ['Sometimes suggested for dry skin or a dull coat'],
    watchOuts: [ASK_VET],
    typicalShare: 'Not part of the plate split', goodFor: ['adult', 'senior'],
  }),
  t({
    id: 'cat-supp-probiotic', species: 'cat', name: 'Probiotic', role: 'supplement', defaultShare: 0, unit: 'serving', askVet: true,
    what: 'Friendly bacteria for the gut, often a powder sprinkled on food.',
    pros: ['Sometimes suggested during food changes or after stomach upsets'],
    watchOuts: [ASK_VET],
    typicalShare: 'Not part of the plate split', goodFor: ['sensitive_stomach'],
  }),

  /* ---------- rabbit ---------- */
  t({
    id: 'rabbit-hay', species: 'rabbit', name: 'Unlimited grass hay', role: 'base', defaultShare: 80, unit: 'serving',
    what: 'Timothy, orchard or meadow grass hay, available all day.',
    pros: ['Keeps the gut moving', 'Wears down teeth that keep growing'],
    watchOuts: ['Alfalfa hay is rich; it is usually for young rabbits only'],
    typicalShare: 'Most of the diet, about 80 percent or more', goodFor: ['young', 'adult', 'senior', 'dental'],
  }),
  t({
    id: 'rabbit-greens', species: 'rabbit', name: 'Leafy greens', role: 'addon', defaultShare: 10, unit: 'cup',
    what: 'A daily mix of fresh leafy greens and herbs, washed.',
    pros: ['Adds water and variety'],
    watchOuts: ['Add new greens one at a time', 'Ask your vet which greens to limit'],
    typicalShare: 'About 10 to 15 percent', goodFor: ['adult', 'senior', 'hydration'],
  }),
  t({
    id: 'rabbit-pellets', species: 'rabbit', name: 'Limited pellets', role: 'addon', defaultShare: 5, unit: 'cup',
    what: 'Plain, hay based pellets without seeds or colored bits.',
    pros: ['Fills nutrient gaps'],
    watchOuts: ['Too many pellets crowd out hay; keep the amount small'],
    typicalShare: 'About 5 percent', goodFor: ['young', 'adult'],
  }),
  t({
    id: 'rabbit-fruit', species: 'rabbit', name: 'Small fruit treats', role: 'treat', defaultShare: 5, unit: 'piece',
    what: 'A small piece of fruit now and then.',
    pros: ['Good for bonding and training'],
    watchOuts: ['Sugary; a tiny piece is plenty'],
    typicalShare: 'A tiny amount, 5 percent or less', goodFor: ['adult'],
  }),

  /* ---------- guinea pig ---------- */
  t({
    id: 'gp-hay', species: 'guinea_pig', name: 'Unlimited grass hay', role: 'base', defaultShare: 75, unit: 'serving',
    what: 'Timothy or other grass hay, available all day.',
    pros: ['Keeps teeth and gut healthy'],
    watchOuts: ['Keep it fresh and dry'],
    typicalShare: 'Most of the diet, about 75 percent or more', goodFor: ['young', 'adult', 'senior', 'dental'],
  }),
  t({
    id: 'gp-veggies', species: 'guinea_pig', name: 'Vitamin C rich vegetables', role: 'addon', defaultShare: 15, unit: 'cup',
    what: 'Daily fresh vegetables such as bell pepper and leafy greens.',
    pros: ['A daily source of vitamin C', 'Adds water'],
    watchOuts: ['Add new vegetables slowly', 'Ask your vet which ones to limit'],
    typicalShare: 'About 15 percent', goodFor: ['adult', 'senior', 'hydration'],
  }),
  t({
    id: 'gp-pellets', species: 'guinea_pig', name: 'Guinea pig pellets', role: 'addon', defaultShare: 10, unit: 'cup',
    what: 'Plain pellets made for guinea pigs, with added vitamin C.',
    pros: ['Fills nutrient gaps'],
    watchOuts: ['Vitamin C in pellets fades over time; check the date', 'Keep the amount small'],
    typicalShare: 'About 10 percent', goodFor: ['young', 'adult'],
  }),

  /* ---------- bird ---------- */
  t({
    id: 'bird-pellets', species: 'bird', name: 'Pellets', role: 'base', defaultShare: 70, unit: 'serving',
    what: 'Formulated pellets sized for your bird.',
    pros: ['Balanced nutrition in every bite'],
    watchOuts: ['Switching from seed takes patience; go slowly and watch they are eating'],
    typicalShare: 'Most of the diet, about 60 to 80 percent', goodFor: ['adult', 'senior'],
  }),
  t({
    id: 'bird-veggies', species: 'bird', name: 'Fresh vegetables', role: 'addon', defaultShare: 20, unit: 'serving',
    what: 'Washed, chopped vegetables offered daily.',
    pros: ['Variety and enrichment'],
    watchOuts: ['Never feed avocado; ask your vet about other foods to avoid'],
    typicalShare: 'About 20 percent', goodFor: ['adult', 'hydration'],
  }),
  t({
    id: 'bird-seed', species: 'bird', name: 'Limited seed', role: 'treat', defaultShare: 10, unit: 'serving',
    what: 'Seeds and nuts as a small part of the diet or as rewards.',
    pros: ['Great for training and foraging games'],
    watchOuts: ['High in fat; seed-heavy diets cause problems'],
    typicalShare: 'A small amount, about 10 percent', goodFor: ['adult', 'active'],
  }),

  /* ---------- reptile ---------- */
  t({
    id: 'reptile-diet', species: 'reptile', name: 'Species-specific diet', role: 'base', defaultShare: 90, unit: 'serving', askVet: true,
    what: 'Insects, greens, whole prey or a mix, depending on the species.',
    pros: ['Matching the natural diet keeps reptiles healthy'],
    watchOuts: ['Ask an exotics vet what and how often to feed', 'Heat and light matter as much as food for digestion'],
    typicalShare: 'Depends on the species', goodFor: ['adult'],
  }),
  t({
    id: 'reptile-calcium', species: 'reptile', name: 'Calcium and vitamin dusting', role: 'supplement', defaultShare: 0, unit: 'serving', askVet: true,
    what: 'Powder dusted on insects or greens.',
    pros: ['Many reptiles need extra calcium'],
    watchOuts: ['Ask an exotics vet how often; too much can also cause problems'],
    typicalShare: 'Not part of the plate split', goodFor: ['adult', 'young'],
  }),
];

export const FOOD_TYPE_BY_ID = new Map(FOOD_TYPES.map((x) => [x.id, x]));

export function foodTypesFor(species: FoodSpecies): FoodType[] {
  return FOOD_TYPES.filter((x) => x.species === species);
}
