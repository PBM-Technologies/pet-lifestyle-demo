import { useApp } from '../state';
import { Link } from '../router';
import { Badge, Card, EmptyState, PageHeader, PetAvatar } from '../ui/kit';
import { CARE_TYPE_LABEL, hasFollowUp, dueStatus } from '../lib/care';
import { Icon } from '../ui/Icon';
import { formatDay, relativeDay } from '../lib/dates';

/** Household-wide care schedule across all pets. */
export function CarePage() {
  const { data } = useApp();
  const byPet = new Map(data.pets.map((p) => [p.id, p]));
  const open = data.care
    .filter((c) => hasFollowUp(c) && c.dueDate && !c.completedAt)
    .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string));
  const recent = [...data.care].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

  return (
    <div className="page">
      <PageHeader title="Care" subtitle="Everything due, for every pet" backTo="/pets" />
      {data.pets.length === 0 ? (
        <EmptyState title="No pets yet" action={<Link to="/pets?add=1" className="btn btn-primary">Add a pet</Link>}>Care schedules appear once you add a pet.</EmptyState>
      ) : (
        <>
          <Card className="breed-cta">
            <div className="mini-head"><Icon name="camera" /><h2>Photo health check</h2></div>
            <p className="small muted">Worried about a spot, an ear or a limp? Snap a photo for a calm first look, then save it to the care record.</p>
            <Link to="/health-check" className="btn btn-primary"><Icon name="camera" size={20} /><span>Check with a photo</span></Link>
          </Card>
          <Card>
            <h2>Schedule</h2>
            {open.length === 0 ? <p className="muted">No upcoming due dates. Add vaccines, meds or preventives from a pet profile.</p> : (
              <ul className="list">
                {open.map((c) => {
                  const pet = byPet.get(c.petId);
                  const s = dueStatus(c);
                  return (
                    <li key={c.id}>
                      <Link to={`/pets/${c.petId}`} className="list-row">
                        {pet && <PetAvatar pet={pet} size={40} />}
                        <span className="grow"><strong>{c.title}</strong><span className="muted small block">{pet?.name} · {CARE_TYPE_LABEL[c.type]} · {formatDay(c.dueDate)}</span></span>
                        <Badge tone={s === 'overdue' ? 'danger' : s === 'due_soon' ? 'warning' : 'neutral'}>{s === 'overdue' ? 'Overdue' : relativeDay(c.dueDate as string)}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card>
            <h2>Recent activity</h2>
            {recent.length === 0 ? <p className="muted">Nothing logged yet.</p> : (
              <ul className="list">
                {recent.map((c) => (
                  <li key={c.id}>
                    <Link to={`/pets/${c.petId}`} className="list-row">
                      <span className="grow"><strong>{c.type === 'weight' ? `Weight ${c.value}` : c.title}</strong><span className="muted small block">{byPet.get(c.petId)?.name} · {CARE_TYPE_LABEL[c.type]} · {formatDay(c.date)}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
