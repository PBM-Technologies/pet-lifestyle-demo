import { describe, expect, it } from 'vitest';
import { BREEDS, breedBySlug, findBreed } from '../src/content/breeds';
import { DEFAULT_PREFS, recommendBreeds, scoreBreed } from '../src/lib/recommend';

const dogs = BREEDS.filter((b) => b.species === 'dog');
const cats = BREEDS.filter((b) => b.species === 'cat');

describe('breed content', () => {
  it('has 40+ dogs and 15+ cats with unique slugs', () => {
    expect(dogs.length).toBeGreaterThanOrEqual(40);
    expect(cats.length).toBeGreaterThanOrEqual(15);
    expect(new Set(BREEDS.map((b) => b.slug)).size).toBe(BREEDS.length);
  });
  it('includes the popular US breeds', () => {
    const names = new Set(BREEDS.map((b) => b.name));
    for (const n of ['Labrador Retriever', 'Golden Retriever', 'German Shepherd', 'French Bulldog', 'Bulldog', 'Poodle (Standard)', 'Poodle (Miniature)', 'Poodle (Toy)', 'Beagle',
      'Rottweiler', 'Dachshund', 'German Shorthaired Pointer', 'Pembroke Welsh Corgi', 'Australian Shepherd', 'Yorkshire Terrier', 'Boxer', 'Cavalier King Charles Spaniel',
      'Doberman Pinscher', 'Great Dane', 'Miniature Schnauzer', 'Siberian Husky', 'Bernese Mountain Dog', 'Shih Tzu', 'Boston Terrier', 'Havanese', 'Shetland Sheepdog',
      'Border Collie', 'Pomeranian', 'Chihuahua', 'Cocker Spaniel', 'Maltese', 'Pug', 'Bichon Frise', 'Australian Cattle Dog', 'Labradoodle', 'Goldendoodle', 'Pit Bull type',
      'Mixed breed dog', 'Domestic Shorthair', 'Domestic Longhair', 'Maine Coon', 'Ragdoll', 'Siamese', 'Persian', 'British Shorthair', 'Bengal', 'Sphynx', 'Abyssinian',
      'Scottish Fold', 'Russian Blue', 'Devon Rex', 'Norwegian Forest Cat', 'American Shorthair', 'Birman', 'Exotic Shorthair']) expect(names.has(n), n).toBe(true);
  });
  it('every entry is complete and in range', () => {
    for (const b of BREEDS) {
      for (const v of [b.energy, b.shedding, b.grooming, b.vocal]) expect([1, 2, 3]).toContain(v);
      if (b.species === 'dog') expect([1, 2, 3]).toContain(b.trainability);
      else expect(b.trainability).toBeUndefined();
      expect(b.weightLb[0]).toBeLessThan(b.weightLb[1]);
      expect(b.health.length).toBeGreaterThan(0);
      expect(b.goodToKnow.length).toBeGreaterThanOrEqual(2);
      const sentences = b.description.split(/[.!?](\s|$)/).filter((s) => s.trim().length > 3).length;
      expect(sentences, b.name).toBeGreaterThanOrEqual(2);
      expect(sentences, b.name).toBeLessThanOrEqual(3);
      expect(JSON.stringify(b)).not.toMatch(/—/);
    }
  });
  it('flags short faced breeds for breathing issues and big dogs for hips', () => {
    for (const s of ['french-bulldog', 'bulldog', 'pug', 'persian', 'shih-tzu']) expect(breedBySlug(s)!.health.join(' ')).toMatch(/Brachycephalic/);
    for (const s of ['labrador-retriever', 'german-shepherd', 'rottweiler', 'bernese-mountain-dog']) expect(breedBySlug(s)!.health.join(' ')).toMatch(/[Hh]ip/);
  });
  it('finds breeds from free text names and aliases', () => {
    expect(findBreed('golden retriever')?.slug).toBe('golden-retriever');
    expect(findBreed('Lab', 'dog')?.slug).toBe('labrador-retriever');
    expect(findBreed('DSH', 'cat')?.slug).toBe('domestic-shorthair');
    expect(findBreed('Lab', 'cat')).toBeUndefined();
    expect(findBreed('')).toBeUndefined();
    expect(findBreed('Shiba Inu')?.slug).toBe('shiba-inu');
  });
});

describe('find your match', () => {
  it('returns the top 5 with reasons, never the generic mixed breed entry', () => {
    const r = recommendBreeds(DEFAULT_PREFS);
    expect(r).toHaveLength(5);
    expect(r.every((m) => m.reasons.length > 0)).toBe(true);
    expect(r.some((m) => m.breed.slug === 'mixed-breed-dog')).toBe(false);
    expect([...r].sort((a, b) => b.score - a.score)).toEqual(r);
  });
  it('respects species', () => {
    expect(recommendBreeds({ ...DEFAULT_PREFS, species: 'cat' }).every((m) => m.breed.species === 'cat')).toBe(true);
    expect(recommendBreeds({ ...DEFAULT_PREFS, species: 'dog' }).every((m) => m.breed.species === 'dog')).toBe(true);
  });
  it('apartment, relaxed, kids and allergies favors calm, apartment friendly, low shedding breeds', () => {
    const r = recommendBreeds({ species: 'dog', home: 'apartment', activity: 1, kids: true, otherPets: true, grooming: 3, lowShedding: true });
    for (const m of r) {
      expect(m.breed.apartment).toBe(true);
      expect(m.breed.goodWithKids).toBe(true);
      expect(m.breed.shedding).toBe(1);
    }
    expect(r[0].reasons).toEqual(expect.arrayContaining(['Usually does well in an apartment', 'Usually good with kids']));
  });
  it('very active house with yard favors high energy dogs', () => {
    const r = recommendBreeds({ species: 'dog', home: 'house', activity: 3, kids: false, otherPets: false, grooming: 1, lowShedding: false });
    expect(r.every((m) => m.breed.energy === 3)).toBe(true);
    expect(r.every((m) => m.breed.grooming === 1)).toBe(true);
  });
  it('penalizes mismatches', () => {
    const husky = breedBySlug('siberian-husky')!;
    const calm = scoreBreed(husky, { ...DEFAULT_PREFS, home: 'apartment', activity: 1, lowShedding: true });
    const fit = scoreBreed(husky, { ...DEFAULT_PREFS, home: 'house', activity: 3 });
    expect(fit.score).toBeGreaterThan(calm.score);
    expect(fit.reasons).toContain('Energy level fits a very active lifestyle');
  });
});
