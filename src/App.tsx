import { useState } from 'react';
import { IS_DEMO, resetDemo } from './data/demo';
import { useEffect, type ReactNode } from 'react';
import { BRAND } from './config/brand';
import { matchPattern, useHashPath, Link } from './router';
import { useApp } from './state';
import { Icon } from './ui/Icon';
import { ErrorState, Loading } from './ui/kit';
import { buildNotifications } from './lib/notifications';
import { Onboarding } from './pages/Onboarding';
import { HomePage } from './pages/Home';
import { PetsPage, PetDetailPage } from './pages/Pets';
import { CarePage } from './pages/Care';
import { ExplorePage, PlaceDetailPage } from './pages/Explore';
import { TravelPage, TripDetailPage } from './pages/Travel';
import { EventsPage } from './pages/Events';
import { CommunityPage } from './pages/Community';
import { BoxesPage, BoxBuilderPage } from './pages/Boxes';
import { ShopPage } from './pages/Shop';
import { AccountPage } from './pages/Account';
import { MorePage } from './pages/More';
import { NotificationsPage } from './pages/Notifications';
import { SpendingPage } from './pages/Spending';
import { IdentifyPage } from './pages/Identify';
import { HealthCheckPage } from './pages/HealthCheck';
import { BreedDetailPage, BreedMatchPage, BreedsPage } from './pages/Breeds';
import { CareSheetPage, SitterRequestPage, SittersPage } from './pages/Sitters';

type Render = (p: Record<string, string>, q: URLSearchParams) => ReactNode;

/** Route inventory from FRAMEWORK.md, plus /more and /notifications for the mobile shell. */
export const ROUTES: Array<{ pattern: string; title: string; tab: Tab; render: Render }> = [
  { pattern: '/', title: 'Home', tab: 'home', render: () => <HomePage /> },
  { pattern: '/explore', title: 'Explore', tab: 'explore', render: (_p, q) => <ExplorePage query={q} /> },
  { pattern: '/explore/:placeId', title: 'Place', tab: 'explore', render: (p) => <PlaceDetailPage placeId={p.placeId} /> },
  { pattern: '/travel', title: 'Travel', tab: 'travel', render: () => <TravelPage /> },
  { pattern: '/travel/:tripId', title: 'Trip', tab: 'travel', render: (p) => <TripDetailPage tripId={p.tripId} /> },
  { pattern: '/pets', title: 'Pets', tab: 'pets', render: () => <PetsPage /> },
  { pattern: '/pets/:petId', title: 'Pet', tab: 'pets', render: (p) => <PetDetailPage petId={p.petId} /> },
  { pattern: '/care', title: 'Care', tab: 'pets', render: () => <CarePage /> },
  { pattern: '/community', title: 'Community', tab: 'more', render: () => <CommunityPage /> },
  { pattern: '/events', title: 'Events', tab: 'more', render: () => <EventsPage /> },
  { pattern: '/boxes', title: 'Mystery boxes', tab: 'more', render: () => <BoxesPage /> },
  { pattern: '/boxes/build', title: 'Build a box', tab: 'more', render: (_p, q) => <BoxBuilderPage query={q} /> },
  { pattern: '/shop', title: 'Shop', tab: 'more', render: () => <ShopPage /> },
  { pattern: '/account', title: 'Account', tab: 'more', render: () => <AccountPage /> },
  { pattern: '/identify', title: 'Identify breed', tab: 'pets', render: (_p, q) => <IdentifyPage query={q} /> },
  { pattern: '/health-check', title: 'Photo health check', tab: 'pets', render: (_p, q) => <HealthCheckPage query={q} /> },
  { pattern: '/breeds', title: 'Breed guide', tab: 'more', render: () => <BreedsPage /> },
  { pattern: '/breeds/match', title: 'Find your match', tab: 'more', render: () => <BreedMatchPage /> },
  { pattern: '/breeds/:slug', title: 'Breed', tab: 'more', render: (p) => <BreedDetailPage slug={p.slug} /> },
  { pattern: '/spending', title: 'Spending', tab: 'more', render: () => <SpendingPage /> },
  { pattern: '/sitters', title: 'Find a sitter', tab: 'more', render: () => <SittersPage /> },
  { pattern: '/sitters/new', title: 'Sitter request', tab: 'more', render: (_p, q) => <SitterRequestPage query={q} /> },
  { pattern: '/sitters/care-sheet', title: 'Sitter care sheet', tab: 'more', render: (_p, q) => <CareSheetPage query={q} /> },
  { pattern: '/more', title: 'More', tab: 'more', render: () => <MorePage /> },
  { pattern: '/notifications', title: 'Notifications', tab: 'home', render: () => <NotificationsPage /> },
];

type Tab = 'home' | 'explore' | 'travel' | 'pets' | 'more';
const TABS: Array<{ id: Tab; label: string; icon: string; to: string }> = [
  { id: 'home', label: 'Home', icon: 'home', to: '/' },
  { id: 'explore', label: 'Explore', icon: 'compass', to: '/explore' },
  { id: 'travel', label: 'Travel', icon: 'map', to: '/travel' },
  { id: 'pets', label: 'Pets', icon: 'paw', to: '/pets' },
  { id: 'more', label: 'More', icon: 'more', to: '/more' },
];

function NotFound() {
  return (
    <div className="page">
      <div className="empty">
        <h1>Page not found</h1>
        <p className="muted">That link does not go anywhere in {BRAND.name}.</p>
        <Link to="/" className="btn btn-primary">Go home</Link>
      </div>
    </div>
  );
}

export function App() {
  const { status, error, reload, data, toastMessage } = useApp();
  const { path, query } = useHashPath();

  let match: { route: (typeof ROUTES)[number]; params: Record<string, string> } | null = null;
  for (const r of ROUTES) {
    const params = matchPattern(r.pattern, path);
    if (params) { match = { route: r, params }; break; }
  }

  useEffect(() => {
    document.title = match ? (match.route.pattern === '/' ? `${BRAND.name}: ${BRAND.tagline}` : `${match.route.title} | ${BRAND.name}`) : BRAND.name;
    window.scrollTo?.(0, 0);
    // move focus to main content for screen readers on route change
    const main = document.getElementById('main');
    main?.focus({ preventScroll: true });
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  const unread = buildNotifications({ pets: data.pets, care: data.care, trips: data.trips, events: data.events, food: data.food }).filter((n) => !data.dismissed.has(n.id)).length;

  if (status === 'loading') return <div className="app"><main id="main" tabIndex={-1}><Loading label={`Opening ${BRAND.name}`} /></main></div>;
  if (status === 'error') return <div className="app"><main id="main" tabIndex={-1} className="page"><ErrorState message={error ?? 'Something went wrong.'} onRetry={reload} /></main></div>;
  if (!data.household) return <div className="app no-tabs"><main id="main" tabIndex={-1}><Onboarding /></main></div>;

  const activeTab = match?.route.tab ?? 'home';
  return (
    <div className="app">
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <aside className="side-brand" aria-hidden="false">
        <Link to="/" className="brand-mark" aria-label={`${BRAND.name} home`}>
          <img src={BRAND.logoDataUri} alt="" width={36} height={36} />
          <span>{BRAND.name}</span>
        </Link>
        <Link to="/notifications" className="bell" aria-label={`Notifications${unread ? `, ${unread} new` : ''}`}>
          <Icon name="bell" />
          {unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
        </Link>
      </aside>
      {IS_DEMO && <DemoBanner />}
      <main id="main" tabIndex={-1} key={path}>
        {match ? match.route.render(match.params, query) : <NotFound />}
      </main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <Link key={t.id} to={t.to} className={`tab ${activeTab === t.id ? 'on' : ''}`} aria-current={activeTab === t.id ? 'page' : undefined}>
            <Icon name={t.icon} size={24} />
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
      <div className="toast-region" aria-live="polite" role="status">
        {toastMessage && <div className="toast">{toastMessage}</div>}
      </div>
    </div>
  );
}

function DemoBanner() {
  const { db, toast } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <div className="demo-banner" role="note">
      <span><strong>Demo</strong> with sample data</span>
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); await resetDemo(db); setBusy(false); location.hash = '#/'; toast('Demo reset'); }}>Reset demo</button>
    </div>
  );
}
