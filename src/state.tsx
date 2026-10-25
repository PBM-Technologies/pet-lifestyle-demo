import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BoxPlan, CareEvent, CommunityPost, Expense, FeedingLog, FoodSwitchPlan, Household, Pet, PetDocument, PetEvent, PetFoodItem, PlaceListing, SavedPlace, TreatLog, TripPlan } from './contracts/domain';
import { allRepos, createDb, ensureSeeded, type Db } from './data/db';
import { createLocalStorageStore } from './data/storage';
import { DEMO_STORAGE_PREFIX, IS_DEMO, seedDemo } from './data/demo';

export interface Snapshot {
  household: Household | null;
  pets: Pet[];
  care: CareEvent[];
  documents: PetDocument[];
  places: PlaceListing[];
  saved: SavedPlace[];
  trips: TripPlan[];
  events: PetEvent[];
  posts: CommunityPost[];
  boxPlans: BoxPlan[];
  food: PetFoodItem[];
  feedings: FeedingLog[];
  treatLogs: TreatLog[];
  switchPlans: FoodSwitchPlan[];
  expenses: Expense[];
  dismissed: Set<string>;
}

interface AppState {
  db: Db;
  data: Snapshot;
  status: 'loading' | 'ready' | 'error';
  error?: string;
  reload: () => Promise<void>;
  toast: (msg: string) => void;
  toastMessage: string | null;
}

const Ctx = createContext<AppState | null>(null);

const EMPTY: Snapshot = {
  household: null, pets: [], care: [], documents: [], places: [], saved: [], trips: [], events: [], posts: [], boxPlans: [], food: [], feedings: [], treatLogs: [], switchPlans: [], expenses: [], dismissed: new Set(),
};

async function loadSnapshot(db: Db): Promise<Snapshot> {
  const [households, pets, care, documents, places, saved, trips, events, posts, boxPlans, food, feedings, treatLogs, switchPlans, expenses, dismissed] = await Promise.all([
    db.households.list(), db.pets.list(), db.careEvents.list(), db.documents.list(), db.places.list(), db.savedPlaces.list(),
    db.trips.list(), db.events.list(), db.posts.list(), db.boxPlans.list(), db.petFood.list(),
    db.feedingLogs.list(), db.treatLogs.list(), db.switchPlans.list(), db.expenses.list(), db.dismissed.list(),
  ]);
  return {
    household: households[0] ?? null,
    pets: [...pets].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    care, documents, places, saved, trips, events, posts, boxPlans, food, feedings, treatLogs, switchPlans, expenses,
    dismissed: new Set(dismissed.map((d) => d.id)),
  };
}

export function AppProvider({ children, db: injected }: { children: ReactNode; db?: Db }) {
  const db = useMemo(() => injected ?? (IS_DEMO ? createDb(createLocalStorageStore(DEMO_STORAGE_PREFIX)) : createDb()), [injected]);
  const [data, setData] = useState<Snapshot>(EMPTY);
  const [status, setStatus] = useState<AppState['status']>('loading');
  const [error, setError] = useState<string>();
  const [toastMessage, setToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await loadSnapshot(db));
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your data.');
      setStatus('error');
    }
  }, [db]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (IS_DEMO) await seedDemo(db);
        else await ensureSeeded(db);
      } catch {
        /* seeding is best effort */
      }
      if (alive) await reload();
    })();
    const repos = allRepos(db);
    let queued = false;
    const onChange = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        void reload();
      });
    };
    const unsubs = repos.map((r) => r.subscribe(onChange));
    return () => {
      alive = false;
      unsubs.forEach((u) => u());
    };
  }, [db, reload]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const value = useMemo<AppState>(() => ({ db, data, status, error, reload, toast: setToast, toastMessage }), [db, data, status, error, reload, toastMessage]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
