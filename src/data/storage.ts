/**
 * Key/value storage adapters. The localStorage adapter wraps every read and
 * write in try/catch and silently falls back to memory when storage throws
 * (private mode, blocked site data, quota exceeded, sandboxed previews).
 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
  /** True when writes are only kept in memory for this session. */
  readonly volatile: boolean;
}

export function createMemoryStore(seed: Record<string, string> = {}): KeyValueStore {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    volatile: true,
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    keys: () => [...map.keys()],
  };
}

export function createLocalStorageStore(prefix: string, storage?: Storage | null): KeyValueStore {
  const memory = createMemoryStore();
  let ls: Storage | null = null;
  try {
    ls = storage === undefined ? globalThis.localStorage ?? null : storage;
    if (ls) {
      const probe = prefix + '__probe';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
    }
  } catch {
    ls = null;
  }
  let failed = !ls;
  const full = (k: string) => prefix + k;
  return {
    get volatile() {
      return failed;
    },
    getItem(k) {
      if (!failed && ls) {
        try {
          const v = ls.getItem(full(k));
          if (v !== null) return v;
        } catch {
          failed = true;
        }
      }
      return memory.getItem(k);
    },
    setItem(k, v) {
      memory.setItem(k, v);
      if (!failed && ls) {
        try {
          ls.setItem(full(k), v);
        } catch {
          failed = true;
        }
      }
    },
    removeItem(k) {
      memory.removeItem(k);
      if (!failed && ls) {
        try {
          ls.removeItem(full(k));
        } catch {
          failed = true;
        }
      }
    },
    keys() {
      const out = new Set(memory.keys());
      if (!failed && ls) {
        try {
          for (let i = 0; i < ls.length; i++) {
            const k = ls.key(i);
            if (k && k.startsWith(prefix) && !k.endsWith('__probe')) out.add(k.slice(prefix.length));
          }
        } catch {
          failed = true;
        }
      }
      return [...out];
    },
  };
}
