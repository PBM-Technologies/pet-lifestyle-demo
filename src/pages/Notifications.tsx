import { useApp } from '../state';
import { buildNotifications } from '../lib/notifications';
import { Button, EmptyState, PageHeader } from '../ui/kit';
import { Icon } from '../ui/Icon';

const ICON = { care_due: 'syringe', care_overdue: 'alert', trip_upcoming: 'suitcase', event_upcoming: 'calendar', food_low: 'bag' } as const;

export function NotificationsPage() {
  const { data, db, toast } = useApp();
  const all = buildNotifications({ pets: data.pets, care: data.care, trips: data.trips, events: data.events, food: data.food });
  const active = all.filter((n) => !data.dismissed.has(n.id));
  const dismissed = all.length - active.length;
  return (
    <div className="page">
      <PageHeader title="Notifications" subtitle="Care, food, trips and events" backTo="/"
        actions={active.length > 0 ? <Button variant="secondary" onClick={async () => { for (const n of active) await db.dismissed.upsert({ id: n.id }); toast('All cleared'); }}>Clear all</Button> : undefined} />
      <p className="muted small">In-app only for now. Phone push reminders come later.</p>
      {active.length === 0 ? (
        <EmptyState icon="bell" title="You are all caught up">Vaccines and meds due within 30 days, food running low, trips in the next 2 weeks and events this week show up here.</EmptyState>
      ) : (
        <ul className="notif-list">
          {active.map((n) => (
            <li key={n.id} className={`notif sev-${n.severity}`}>
              <a href={n.href} className="notif-main">
                <span className="notif-icon"><Icon name={ICON[n.kind]} /></span>
                <span className="grow"><strong>{n.title}</strong><span className="muted small block">{n.body}</span></span>
              </a>
              <button type="button" className="icon-btn" aria-label={`Dismiss: ${n.title}`} onClick={() => db.dismissed.upsert({ id: n.id })}><Icon name="x" /></button>
            </li>
          ))}
        </ul>
      )}
      {dismissed > 0 && <Button variant="ghost" onClick={async () => { await db.dismissed.replaceAll([]); toast('Restored'); }}>Show {dismissed} dismissed</Button>}
    </div>
  );
}
