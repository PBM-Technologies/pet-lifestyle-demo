import type { PackingItem, Pet, Species } from '../contracts/domain';

interface Template {
  key: string;
  label: (name: string) => string;
  species: Species[] | 'all';
  /** Only when the pet has this property. */
  when?: (p: Pet) => boolean;
}

const TEMPLATES: Template[] = [
  { key: 'food', label: (n) => `Food for ${n} (plus a couple extra days)`, species: 'all' },
  { key: 'bowls', label: (n) => `Food and water bowls for ${n}`, species: 'all' },
  { key: 'water', label: () => 'Travel water bottle', species: ['dog'] },
  { key: 'meds', label: (n) => `Medications and preventives for ${n}`, species: 'all' },
  { key: 'records', label: (n) => `Vaccine records for ${n}`, species: 'all' },
  { key: 'leash', label: (n) => `Leash and harness for ${n}`, species: ['dog'] },
  { key: 'carrier', label: (n) => `Carrier for ${n}`, species: ['cat', 'other'] },
  { key: 'litter', label: (n) => `Litter, litter box and scoop for ${n}`, species: ['cat'] },
  { key: 'bags', label: () => 'Waste bags', species: ['dog'] },
  { key: 'bed', label: (n) => `Bed or blanket for ${n}`, species: 'all' },
  { key: 'toys', label: (n) => `Favorite toys for ${n}`, species: 'all' },
  { key: 'treats', label: (n) => `Treats for ${n}`, species: ['dog', 'cat'] },
  { key: 'id', label: (n) => `ID tag with your phone number on ${n}`, species: ['dog', 'cat'] },
  { key: 'diet', label: (n) => `Allergy-safe food only for ${n}`, species: 'all', when: (p) => p.allergies.length > 0 },
];

const SHARED: Array<{ key: string; label: string }> = [
  { key: 'firstaid', label: 'Pet first aid kit' },
  { key: 'vetinfo', label: 'Vet phone number and an emergency vet near your destination' },
  { key: 'cleanup', label: 'Paper towels and enzyme cleaner' },
];

/** Builds the default packing list for the pets on a trip. Stable ids so regenerating keeps checks. */
export function buildPackingList(pets: Pet[]): PackingItem[] {
  const items: PackingItem[] = [];
  for (const p of pets) {
    for (const t of TEMPLATES) {
      if (t.species !== 'all' && !t.species.includes(p.species)) continue;
      if (t.when && !t.when(p)) continue;
      items.push({ id: `${t.key}:${p.id}`, label: t.label(p.name), checked: false, petId: p.id });
    }
  }
  if (pets.length > 0) for (const s of SHARED) items.push({ id: `shared:${s.key}`, label: s.label, checked: false });
  return items;
}

/** Merge a regenerated default list with the existing one: keep checks and custom items, drop items for pets no longer coming. */
export function mergePackingList(existing: PackingItem[], pets: Pet[]): PackingItem[] {
  const fresh = buildPackingList(pets);
  const prev = new Map(existing.map((i) => [i.id, i]));
  const merged = fresh.map((i) => (prev.has(i.id) ? { ...i, checked: (prev.get(i.id) as PackingItem).checked, label: (prev.get(i.id) as PackingItem).label } : i));
  const custom = existing.filter((i) => i.custom);
  return [...merged, ...custom];
}

export function packingProgress(items: PackingItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.checked).length, total: items.length };
}

/** Reminders shown on the trip page. */
export function travelReminders(pets: Pet[], hasHotelStop: boolean): string[] {
  const out: string[] = [];
  if (pets.length) out.push('Bring vaccine records (paper or photo) for every pet coming along.');
  if (pets.some((p) => !p.microchip)) out.push('Some pets have no microchip number saved. Add it on their profile in case you get separated.');
  if (hasHotelStop) out.push('Call your hotel ahead to confirm their current pet policy, fees and size limits.');
  if (pets.some((p) => p.species === 'cat')) out.push('Cats travel best in a covered carrier. Set up a litter spot as soon as you arrive.');
  if (pets.some((p) => p.allergies.length)) out.push('Pack enough of the usual food. Allergy-safe options can be hard to find on the road.');
  return out;
}
