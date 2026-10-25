import type { ID } from '../contracts/domain';
import type { KeyValueStore } from './storage';

/**
 * Per-domain repository contract. Async so a Firebase or Postgres (HTTP)
 * adapter can implement the same interface without touching the UI.
 */
export interface Repository<T extends { id: ID }> {
  readonly name: string;
  list(filter?: (item: T) => boolean): Promise<T[]>;
  get(id: ID): Promise<T | undefined>;
  upsert(item: T): Promise<T>;
  remove(id: ID): Promise<void>;
  /** Replaces the whole collection (import, reset). */
  replaceAll(items: T[]): Promise<void>;
  subscribe(listener: () => void): () => void;
}

type Listener = () => void;

/** Collection stored as a JSON array under one key. */
export function createKvRepository<T extends { id: ID; updatedAt?: string }>(
  store: KeyValueStore,
  name: string,
): Repository<T> {
  const key = 'col:' + name;
  const listeners = new Set<Listener>();
  let cache: T[] | null = null;

  const read = (): T[] => {
    if (cache) return cache;
    const raw = store.getItem(key);
    if (!raw) return (cache = []);
    try {
      const parsed: unknown = JSON.parse(raw);
      cache = Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      cache = [];
    }
    return cache;
  };
  const write = (items: T[]) => {
    cache = items;
    try {
      store.setItem(key, JSON.stringify(items));
    } catch {
      // store adapters already fall back to memory; nothing else to do
    }
    listeners.forEach((l) => l());
  };

  return {
    name,
    async list(filter) {
      const items = read();
      return filter ? items.filter(filter) : [...items];
    },
    async get(id) {
      return read().find((i) => i.id === id);
    },
    async upsert(item) {
      const items = read();
      const idx = items.findIndex((i) => i.id === item.id);
      const next = [...items];
      if (idx >= 0) next[idx] = item;
      else next.push(item);
      write(next);
      return item;
    },
    async remove(id) {
      write(read().filter((i) => i.id !== id));
    },
    async replaceAll(items) {
      write([...items]);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
