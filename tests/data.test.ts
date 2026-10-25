import { describe, expect, it, beforeEach } from 'vitest';
import { createKvRepository } from '../src/data/repository';
import { createLocalStorageStore, createMemoryStore } from '../src/data/storage';
import { careEventsCsv, createDb, deleteAll, ensureSeeded, exportAll, importAll, ImportError, loadSamplePets, removePet, removeSamplePets } from '../src/data/db';
import { SAMPLE_PLACES } from '../src/data/samples';
import type { TripPlan } from '../src/contracts/domain';

describe('storage adapters', () => {
  beforeEach(() => localStorage.clear());

  it('persists through localStorage with a prefix', () => {
    const s = createLocalStorageStore('t:');
    s.setItem('a', '1');
    expect(localStorage.getItem('t:a')).toBe('1');
    expect(createLocalStorageStore('t:').getItem('a')).toBe('1');
    expect(s.keys()).toEqual(['a']);
    expect(s.volatile).toBe(false);
  });

  it('falls back to memory when storage throws', () => {
    const broken = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
      removeItem() { throw new Error('denied'); },
      key() { return null; },
      clear() {},
      length: 0,
    } as unknown as Storage;
    const s = createLocalStorageStore('x:', broken);
    expect(s.volatile).toBe(true);
    s.setItem('k', 'v');
    expect(s.getItem('k')).toBe('v');
    s.removeItem('k');
    expect(s.getItem('k')).toBeNull();
  });

  it('falls back to memory when a write fails later (quota)', () => {
    let fail = false;
    const map = new Map<string, string>();
    const flaky = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { if (fail && !k.endsWith('__probe')) throw new Error('quota'); map.set(k, v); },
      removeItem: (k: string) => void map.delete(k),
      key: () => null, clear() {}, get length() { return 0; },
    } as unknown as Storage;
    const s = createLocalStorageStore('q:', flaky);
    fail = true;
    s.setItem('big', 'data');
    expect(s.getItem('big')).toBe('data');
    expect(s.volatile).toBe(true);
  });

  it('works when no storage exists', () => {
    const s = createLocalStorageStore('n:', null);
    s.setItem('a', 'b');
    expect(s.getItem('a')).toBe('b');
  });
});

describe('kv repository', () => {
  it('list/get/upsert/remove/replaceAll and notifies', async () => {
    const repo = createKvRepository<{ id: string; n: number }>(createMemoryStore(), 'things');
    let calls = 0;
    const un = repo.subscribe(() => calls++);
    await repo.upsert({ id: 'a', n: 1 });
    await repo.upsert({ id: 'b', n: 2 });
    await repo.upsert({ id: 'a', n: 3 });
    expect(await repo.list()).toEqual([{ id: 'a', n: 3 }, { id: 'b', n: 2 }]);
    expect(await repo.get('b')).toEqual({ id: 'b', n: 2 });
    expect(await repo.list((x) => x.n > 2)).toHaveLength(1);
    await repo.remove('a');
    expect(await repo.get('a')).toBeUndefined();
    await repo.replaceAll([]);
    expect(await repo.list()).toEqual([]);
    expect(calls).toBe(5);
    un();
    await repo.upsert({ id: 'c', n: 1 });
    expect(calls).toBe(5);
  });

  it('survives corrupt JSON', async () => {
    const store = createMemoryStore({ 'col:x': '{not json' });
    const repo = createKvRepository<{ id: string }>(store, 'x');
    expect(await repo.list()).toEqual([]);
  });

  it('returns copies from list so callers cannot mutate the cache', async () => {
    const repo = createKvRepository<{ id: string }>(createMemoryStore(), 'x');
    await repo.upsert({ id: 'a' });
    const l = await repo.list();
    l.push({ id: 'zzz' });
    expect(await repo.list()).toHaveLength(1);
  });
});

describe('db helpers', () => {
  it('seeds sample places and events once, then respects deletions', async () => {
    const db = createDb(createMemoryStore());
    await ensureSeeded(db);
    expect((await db.places.list()).length).toBe(SAMPLE_PLACES.length);
    expect((await db.events.list()).every((e) => e.isSample)).toBe(true);
    await db.places.replaceAll([]);
    await ensureSeeded(db);
    expect(await db.places.list()).toHaveLength(0);
    expect(await db.pets.list()).toHaveLength(0);
  });

  it('loads and removes sample pets, detaching them from trips', async () => {
    const db = createDb(createMemoryStore());
    await loadSamplePets(db, 'hh');
    const pets = await db.pets.list();
    expect(pets.map((p) => p.name)).toEqual(['Bailey', 'Luna']);
    expect((await db.careEvents.list()).length).toBeGreaterThan(3);
    const trip: TripPlan = { id: 't', householdId: 'hh', title: 'x', petIds: pets.map((p) => p.id), stops: [], packing: [{ id: 'food:sample-pet-bailey', label: 'f', checked: false, petId: 'sample-pet-bailey' }, { id: 'c', label: 'custom', checked: false, custom: true }], createdAt: '', updatedAt: '' };
    await db.trips.upsert(trip);
    await removeSamplePets(db);
    expect(await db.pets.list()).toHaveLength(0);
    expect(await db.careEvents.list()).toHaveLength(0);
    const t = await db.trips.get('t');
    expect(t?.petIds).toEqual([]);
    expect(t?.packing.map((i) => i.id)).toEqual(['c']);
  });

  it('removePet cascades to care, documents and box plans', async () => {
    const db = createDb(createMemoryStore());
    await loadSamplePets(db, 'hh');
    await db.documents.upsert({ id: 'd', householdId: 'hh', petId: 'sample-pet-luna', name: 'cert', createdAt: '', updatedAt: '' });
    await db.boxPlans.upsert({ id: 'b', householdId: 'hh', petId: 'sample-pet-luna', theme: 'new_kid', cadence: 'monthly', toysOnly: true, restrictions: [], size: 'small', status: 'saved', createdAt: '', updatedAt: '' });
    await removePet(db, 'sample-pet-luna');
    expect((await db.careEvents.list()).every((c) => c.petId !== 'sample-pet-luna')).toBe(true);
    expect(await db.documents.list()).toHaveLength(0);
    expect(await db.boxPlans.list()).toHaveLength(0);
    expect(await db.pets.list()).toHaveLength(1);
  });

  it('round-trips export and import', async () => {
    const a = createDb(createMemoryStore());
    await ensureSeeded(a);
    await a.households.upsert({ id: 'hh', name: 'Home', createdAt: '', updatedAt: '' });
    await loadSamplePets(a, 'hh');
    const bundle = await exportAll(a, 'TestApp');
    expect(bundle.app).toBe('TestApp');
    const b = createDb(createMemoryStore());
    const r = await importAll(b, JSON.parse(JSON.stringify(bundle)));
    expect(r.pets).toBe(2);
    expect((await b.households.list())[0].name).toBe('Home');
    expect(await b.careEvents.list()).toHaveLength(bundle.careEvents.length);
    expect(await b.places.list()).toHaveLength(bundle.places.length);
  });

  it('rejects invalid imports with friendly errors', async () => {
    const db = createDb(createMemoryStore());
    await expect(importAll(db, null)).rejects.toBeInstanceOf(ImportError);
    await expect(importAll(db, { version: 2 })).rejects.toThrow(/version/);
    await expect(importAll(db, { version: 1, pets: 'nope' })).rejects.toThrow(/list/);
    await expect(importAll(db, { version: 1, pets: [{ name: 'x' }] })).rejects.toThrow(/id/);
    await expect(importAll(db, { version: 1, pets: [{ id: '1', name: 'x', species: 'horse' }] })).rejects.toThrow(/species/);
  });

  it('deleteAll empties every collection', async () => {
    const db = createDb(createMemoryStore());
    await ensureSeeded(db);
    await loadSamplePets(db, 'hh');
    await deleteAll(db);
    expect(await db.places.list()).toHaveLength(0);
    expect(await db.pets.list()).toHaveLength(0);
    expect(db.store.getItem('meta:seeded')).toBeNull();
  });

  it('builds a CSV of care records with escaping', () => {
    const csv = careEventsCsv(
      [{ id: '1', householdId: 'h', petId: 'p', type: 'note', title: 'Said "hi", then slept', date: '2026-01-02', createdAt: '', updatedAt: '' }],
      [{ id: 'p', householdId: 'h', name: 'Bo', species: 'dog', allergies: [], createdAt: '', updatedAt: '' }],
    );
    const lines = csv.split('\n');
    expect(lines[0]).toBe('pet,type,title,date,due_date,repeat_days,value,completed_at,notes');
    expect(lines[1]).toBe('Bo,note,"Said ""hi"", then slept",2026-01-02,,,,,');
  });
});
