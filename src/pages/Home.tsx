import { BRAND } from '../config/brand';
import { useApp } from '../state';
import { Link } from '../router';
import { Icon } from '../ui/Icon';
import { Badge, Button, Card, PetAvatar } from '../ui/kit';
import { dueSoon } from '../lib/care';
import { formatAge, formatDay, relativeDay, today, daysBetween } from '../lib/dates';
import { loadSamplePets, removeSamplePets } from '../data/db';
import { buildNotifications } from '../lib/notifications';
import { FOOD_STATUS_LABEL, foodAlerts, runOutSentence, shortDay } from '../lib/food';
import { mainFood } from '../lib/feeding';
import { FeedingChecks, FeederPicker } from './FoodExtras';

export function HomePage() {
  const { data, db, toast } = useApp();
  const due = dueSoon(data.care, data.pets).slice(0, 4);
  const t = today();
  const nextTrip = [...data.trips].filter((x) => x.startsOn && (x.endsOn ?? x.startsOn) >= t).sort((a, b) => (a.startsOn as string).localeCompare(b.startsOn as string))[0];
  const nextEvent = [...data.events].filter((e) => e.date >= t && (!e.isSample || e.rsvp === 'going')).sort((a, b) => a.date.localeCompare(b.date))[0];
  const favCount = data.saved.filter((s) => s.favorite).length;
  const hasSamplePets = data.pets.some((p) => p.isSample);
  const petById = new Map(data.pets.map((p) => [p.id, p]));
  const lowFood = foodAlerts(data.food).filter((a) => petById.has(a.item.petId)).slice(0, 4);
  const feedPets = data.pets.map((p) => ({ pet: p, food: mainFood(data.food, p.id, data.switchPlans) })).filter((x): x is { pet: typeof x.pet; food: NonNullable<typeof x.food> } => !!x.food);
  const unread = buildNotifications({ pets: data.pets, care: data.care, trips: data.trips, events: data.events, food: data.food }).filter((n) => !data.dismissed.has(n.id)).length;

  return (
    <div className="page home">
      <div className="home-logo">
        <img src={BRAND.fullLogoDataUri} alt={BRAND.name} width={260} height={187} />
      </div>
      <section className="hero">
        <div className="hero-top">
          <div>
            <p className="eyebrow">{data.household?.name}</p>
            <h1>Hi there</h1>
          </div>
          <Link to="/notifications" className="hero-bell" aria-label={`Notifications${unread ? `, ${unread} new` : ''}`}>
            <Icon name="bell" />
            {unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
          </Link>
        </div>
        <div className="quick">
          <Link to="/pets?add=1" className="quick-btn"><Icon name="paw" /><span>Add pet</span></Link>
          <Link to="/explore" className="quick-btn"><Icon name="pin" /><span>Find places</span></Link>
          <Link to="/travel?add=1" className="quick-btn"><Icon name="suitcase" /><span>Plan trip</span></Link>
          <Link to="/boxes/build" className="quick-btn"><Icon name="gift" /><span>Build box</span></Link>
        </div>
      </section>

      {data.pets.length === 0 ? (
        <Card className="welcome-empty">
          <h2>Your pets live here</h2>
          <p className="muted">Add your dog, cat or other companion to track vaccines, meds, weight and more. Want to look around first? Load two sample pets and remove them any time.</p>
          <div className="row-actions">
            <Link to="/pets?add=1" className="btn btn-primary"><Icon name="plus" size={20} /><span>Add a pet</span></Link>
            <Button variant="secondary" onClick={async () => { if (data.household) { await loadSamplePets(db, data.household.id); toast('Sample pets loaded'); } }}>Load sample pets</Button>
          </div>
        </Card>
      ) : (
        <section aria-labelledby="your-pets">
          <div className="section-head">
            <h2 id="your-pets">Your pets</h2>
            <Link to="/pets" className="text-link">See all</Link>
          </div>
          <div className="pet-strip">
            {data.pets.map((p) => (
              <Link key={p.id} to={`/pets/${p.id}`} className="pet-tile">
                <PetAvatar pet={p} size={64} />
                <strong>{p.name}</strong>
                <span className="muted small">{formatAge(p.birthDate)}</span>
              </Link>
            ))}
            <Link to="/pets?add=1" className="pet-tile add"><span className="avatar add-avatar"><Icon name="plus" /></span><strong>Add</strong><span className="small">&nbsp;</span></Link>
          </div>
          {hasSamplePets && (
            <p className="small muted sample-note">
              Showing sample pets. <button type="button" className="text-link" onClick={async () => { await removeSamplePets(db); toast('Sample pets removed'); }}>Remove samples</button>
            </p>
          )}
        </section>
      )}

      {feedPets.length > 0 && (
        <Card className="feed-card">
          <div className="section-head">
            <div className="mini-head"><Icon name="check" /><h2>Today's feedings</h2></div>
          </div>
          <FeederPicker />
          {feedPets.map(({ pet, food }) => (
            <div key={pet.id} className="home-feed">
              <Link to={`/pets/${pet.id}`} className="home-feed-head"><PetAvatar pet={pet} size={36} /><strong>{pet.name}</strong></Link>
              <FeedingChecks pet={pet} food={food} showPicker={false} />
            </div>
          ))}
        </Card>
      )}

      {data.pets.length > 0 && (
        <Card>
          <div className="section-head">
            <h2>Coming up for care</h2>
            <Link to="/care" className="text-link">All care</Link>
          </div>
          {due.length === 0 ? (
            <p className="muted">Nothing due in the next 30 days. Add vaccines and meds with due dates to get reminders.</p>
          ) : (
            <ul className="list">
              {due.map((d) => (
                <li key={d.event.id}>
                  <Link to={`/pets/${d.event.petId}`} className="list-row">
                    {d.pet && <PetAvatar pet={d.pet} size={40} />}
                    <span className="grow">
                      <strong>{d.event.title}</strong>
                      <span className="muted small block">{d.pet?.name} · due {formatDay(d.event.dueDate)}</span>
                    </span>
                    <Badge tone={d.status === 'overdue' ? 'danger' : d.daysUntil <= 7 ? 'warning' : 'neutral'}>{d.status === 'overdue' ? 'Overdue' : relativeDay(d.event.dueDate as string)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {lowFood.length > 0 && (
        <Card>
          <div className="section-head">
            <div className="mini-head"><Icon name="bag" /><h2>Food</h2></div>
          </div>
          <ul className="list">
            {lowFood.map(({ item, estimate }) => {
              const pet = petById.get(item.petId)!;
              return (
                <li key={item.id}>
                  <Link to={`/pets/${pet.id}`} className="list-row">
                    <PetAvatar pet={pet} size={40} />
                    <span className="grow">
                      <strong>{runOutSentence(pet.name, item, estimate)}</strong>
                      <span className="muted small block">{item.brand} · {estimate.status === 'out' ? 'time to restock' : `around ${shortDay(estimate.runOutDate)}`}</span>
                    </span>
                    <Badge tone={estimate.status === 'out' ? 'danger' : 'warning'}>{FOOD_STATUS_LABEL[estimate.status]}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="grid-2">
        <Card>
          <div className="mini-head"><Icon name="suitcase" /><h2>Next trip</h2></div>
          {nextTrip ? (
            <Link to={`/travel/${nextTrip.id}`} className="mini-body">
              <strong>{nextTrip.title}</strong>
              <span className="muted small">{formatDay(nextTrip.startsOn)} · {daysBetween(t, nextTrip.startsOn as string) <= 0 ? 'happening now' : relativeDay(nextTrip.startsOn as string)}</span>
            </Link>
          ) : (
            <p className="muted small">No trips planned. <Link to="/travel?add=1" className="text-link">Plan one</Link></p>
          )}
        </Card>
        <Card>
          <div className="mini-head"><Icon name="calendar" /><h2>Next event</h2></div>
          {nextEvent ? (
            <Link to="/events" className="mini-body">
              <strong>{nextEvent.title}</strong>
              <span className="muted small">{formatDay(nextEvent.date)} · {relativeDay(nextEvent.date)}</span>
            </Link>
          ) : (
            <p className="muted small">Nothing on the calendar. <Link to="/events" className="text-link">Browse events</Link></p>
          )}
        </Card>
        <Card>
          <div className="mini-head"><Icon name="heart" /><h2>Saved places</h2></div>
          <Link to="/explore?c=saved" className="mini-body">
            <strong>{favCount} saved</strong>
            <span className="muted small">Parks, patios, hotels and vets you love</span>
          </Link>
        </Card>
        <Card>
          <div className="mini-head"><Icon name="gift" /><h2>Mystery boxes</h2></div>
          <Link to={data.boxPlans.length ? '/boxes' : '/boxes/build'} className="mini-body">
            <strong>{data.boxPlans.length ? `${data.boxPlans.length} box plan${data.boxPlans.length > 1 ? 's' : ''}` : 'Build a box'}</strong>
            <span className="muted small">Themed toys and treats, tuned to allergies</span>
          </Link>
        </Card>
      </div>
    </div>
  );
}
