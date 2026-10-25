import { useState } from 'react';
import type { PackingItem, TripPlan, TripStop } from '../contracts/domain';
import { useApp } from '../state';
import { Link, navigate } from '../router';
import { Icon } from '../ui/Icon';
import { Badge, Button, Card, Confirm, EmptyState, IconButton, PageHeader, PetAvatar, PetMultiSelect, Sheet, SheetPicker, TextField } from '../ui/kit';
import { buildPackingList, mergePackingList, packingProgress, travelReminders } from '../lib/packing';
import { addDays, daysBetween, formatDay, formatTime, isValidDay, newId, nowIso, relativeDay, today } from '../lib/dates';
import { categoryLabel } from '../lib/places';

function tripStatus(t: TripPlan, on = today()): 'upcoming' | 'now' | 'past' | 'undated' {
  if (!t.startsOn) return 'undated';
  const end = t.endsOn ?? t.startsOn;
  if (end < on) return 'past';
  if (t.startsOn <= on) return 'now';
  return 'upcoming';
}

export function TravelPage() {
  const { data } = useApp();
  const params = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const [adding, setAdding] = useState(params.get('add') === '1');
  const initialPlace = params.get('place') ?? undefined;
  const trips = [...data.trips].sort((a, b) => (a.startsOn ?? '9999').localeCompare(b.startsOn ?? '9999'));
  const active = trips.filter((t) => tripStatus(t) !== 'past');
  const past = trips.filter((t) => tripStatus(t) === 'past').reverse();
  const close = () => { setAdding(false); if (location.hash.includes('?')) navigate('/travel', true); };

  const row = (t: TripPlan) => {
    const prog = packingProgress(t.packing);
    const st = tripStatus(t);
    const pets = data.pets.filter((p) => t.petIds.includes(p.id));
    return (
      <li key={t.id}>
        <Link to={`/travel/${t.id}`} className="card trip-card">
          <span className="grow">
            <strong>{t.title}</strong>
            <span className="muted small block">{t.destination ? `${t.destination} · ` : ''}{t.startsOn ? `${formatDay(t.startsOn)}${t.endsOn && t.endsOn !== t.startsOn ? ` to ${formatDay(t.endsOn)}` : ''}` : 'No dates yet'}</span>
            <span className="trip-meta">
              {st === 'now' && <Badge tone="accent">Happening now</Badge>}
              {st === 'upcoming' && t.startsOn && <Badge>{relativeDay(t.startsOn)}</Badge>}
              <span className="small muted">{t.stops.length} stop{t.stops.length === 1 ? '' : 's'} · packed {prog.done}/{prog.total}</span>
            </span>
          </span>
          <span className="avatar-stack">{pets.slice(0, 3).map((p) => <PetAvatar key={p.id} pet={p} size={32} />)}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className="page">
      <PageHeader title="Travel" subtitle="Trips, stops and packing for every pet" actions={<Button icon="plus" onClick={() => setAdding(true)}>New trip</Button>} />
      {trips.length === 0 ? (
        <EmptyState icon="suitcase" title="No trips yet" action={<Button icon="plus" onClick={() => setAdding(true)}>Plan a trip</Button>}>
          Plan a getaway, link the pet-friendly places you saved, and get a packing list made for your dog, cat or both.
        </EmptyState>
      ) : (
        <>
          {active.length > 0 && <ul className="trip-list">{active.map(row)}</ul>}
          {past.length > 0 && (<><h2 className="list-title">Past trips</h2><ul className="trip-list past">{past.map(row)}</ul></>)}
        </>
      )}
      {adding && <TripFormSheet onClose={close} initialPlaceId={initialPlace} onSaved={(id) => navigate(`/travel/${id}`, true)} />}
    </div>
  );
}

function TripFormSheet({ onClose, trip, onSaved, initialPlaceId }: { onClose: () => void; trip?: TripPlan; onSaved?: (id: string) => void; initialPlaceId?: string }) {
  const { db, data, toast } = useApp();
  const [title, setTitle] = useState(trip?.title ?? '');
  const [destination, setDestination] = useState(trip?.destination ?? '');
  const [startsOn, setStartsOn] = useState(trip?.startsOn ?? '');
  const [endsOn, setEndsOn] = useState(trip?.endsOn ?? '');
  const [petIds, setPetIds] = useState<string[]>(trip?.petIds ?? data.pets.map((p) => p.id));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Give the trip a name.';
    if (startsOn && !isValidDay(startsOn)) e.startsOn = 'Pick a valid date.';
    if (endsOn && startsOn && endsOn < startsOn) e.endsOn = 'End date must be on or after the start.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const now = nowIso();
    const pets = data.pets.filter((p) => petIds.includes(p.id));
    let stops = trip?.stops ?? [];
    const place = initialPlaceId ? data.places.find((p) => p.id === initialPlaceId) : undefined;
    if (!trip && place) stops = [{ id: newId('stop-'), placeId: place.id, label: place.name, day: startsOn || today() }];
    const rec: TripPlan = {
      ...(trip ?? { id: newId('trip-'), createdAt: now, householdId: data.household?.id ?? '', notes: undefined }),
      title: title.trim(),
      destination: destination.trim() || undefined,
      startsOn: startsOn || undefined,
      endsOn: endsOn || startsOn || undefined,
      petIds,
      stops,
      packing: trip ? mergePackingList(trip.packing, pets) : buildPackingList(pets),
      updatedAt: now,
    } as TripPlan;
    await db.trips.upsert(rec);
    toast(trip ? 'Trip updated' : 'Trip created');
    onSaved?.(rec.id);
    onClose();
  };

  return (
    <Sheet open title={trip ? 'Edit trip' : 'New trip'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>{trip ? 'Save' : 'Create trip'}</Button></>}>
      <form className="form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
        <TextField label="Trip name" value={title} onChange={setTitle} error={errors.title} placeholder="Lake weekend" />
        <TextField label="Destination" value={destination} onChange={setDestination} placeholder="City or area" />
        <div className="field-row">
          <TextField label="Start date" type="date" value={startsOn} onChange={(v) => { setStartsOn(v); if (!endsOn && isValidDay(v)) setEndsOn(addDays(v, 2)); }} error={errors.startsOn} />
          <TextField label="End date" type="date" value={endsOn} onChange={setEndsOn} error={errors.endsOn} />
        </div>
        <PetMultiSelect label="Pets coming" pets={data.pets} value={petIds} onChange={setPetIds} />
        {trip && <p className="hint">Changing pets updates the packing list and keeps your checks and custom items.</p>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

function StopSheet({ trip, stop, onClose }: { trip: TripPlan; stop?: TripStop; onClose: () => void }) {
  const { db, data, toast } = useApp();
  const [mode, setMode] = useState<'saved' | 'text'>(stop && !stop.placeId ? 'text' : 'saved');
  const [placeId, setPlaceId] = useState(stop?.placeId ?? '');
  const [label, setLabel] = useState(stop && !stop.placeId ? stop.label : '');
  const [day, setDay] = useState(stop?.day ?? trip.startsOn ?? today());
  const [time, setTime] = useState(stop?.time ?? '');
  const [notes, setNotes] = useState(stop?.notes ?? '');
  const [err, setErr] = useState<string>();
  const favs = new Set(data.saved.filter((s) => s.favorite).map((s) => s.placeId));
  const placeOptions = [...data.places].sort((a, b) => Number(favs.has(b.id)) - Number(favs.has(a.id)) || a.name.localeCompare(b.name))
    .map((p) => ({ value: p.id, label: p.name, hint: `${favs.has(p.id) ? 'Saved · ' : ''}${categoryLabel(p.category)}` }));

  const save = async () => {
    const place = data.places.find((p) => p.id === placeId);
    const name = mode === 'saved' ? place?.name : label.trim();
    if (!name) return setErr(mode === 'saved' ? 'Choose a place.' : 'Describe the stop.');
    if (!isValidDay(day)) return setErr('Pick a day.');
    const rec: TripStop = { id: stop?.id ?? newId('stop-'), placeId: mode === 'saved' ? placeId : undefined, label: name, day, time: time || undefined, notes: notes.trim() || undefined };
    const stops = stop ? trip.stops.map((s) => (s.id === stop.id ? rec : s)) : [...trip.stops, rec];
    await db.trips.upsert({ ...trip, stops, updatedAt: nowIso() });
    toast(stop ? 'Stop updated' : 'Stop added');
    onClose();
  };

  return (
    <Sheet open title={stop ? 'Edit stop' : 'Add a stop'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save stop</Button></>}>
      <form className="form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
        <div className="seg" role="tablist" aria-label="Stop type">
          <button type="button" role="tab" aria-selected={mode === 'saved'} className={mode === 'saved' ? 'on' : ''} onClick={() => setMode('saved')}>From places</button>
          <button type="button" role="tab" aria-selected={mode === 'text'} className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}>Free text</button>
        </div>
        {mode === 'saved' ? (
          placeOptions.length ? <SheetPicker label="Place" value={placeId} onChange={(v) => { setPlaceId(v); setErr(undefined); }} options={placeOptions} placeholder="Choose a place" /> : <p className="muted">No places yet. <Link to="/explore" className="text-link">Add some in Explore</Link>.</p>
        ) : (
          <TextField label="Stop" value={label} onChange={(v) => { setLabel(v); setErr(undefined); }} placeholder="Rest stop with grass area" />
        )}
        <div className="field-row">
          <TextField label="Day" type="date" value={day} onChange={setDay} />
          <TextField label="Time" type="time" value={time} onChange={setTime} />
        </div>
        <TextField label="Notes" value={notes} onChange={setNotes} multiline />
        {err && <p className="field-error" role="alert">{err}</p>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

export function TripDetailPage({ tripId }: { tripId: string }) {
  const { data, db, toast } = useApp();
  const trip = data.trips.find((t) => t.id === tripId);
  const [editing, setEditing] = useState(false);
  const [stopSheet, setStopSheet] = useState<{ stop?: TripStop } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [newItem, setNewItem] = useState('');

  if (!trip) return <div className="page"><PageHeader title="Trip not found" backTo="/travel" /><EmptyState icon="suitcase" title="This trip is not here">It may have been deleted. <Link to="/travel" className="text-link">Back to trips</Link></EmptyState></div>;

  const pets = data.pets.filter((p) => trip.petIds.includes(p.id));
  const placesById = new Map(data.places.map((p) => [p.id, p]));
  const hasHotel = trip.stops.some((s) => s.placeId && placesById.get(s.placeId)?.category === 'hotel');
  const reminders = travelReminders(pets, hasHotel);
  const prog = packingProgress(trip.packing);
  const save = (patch: Partial<TripPlan>) => db.trips.upsert({ ...trip, ...patch, updatedAt: nowIso() });
  const days = [...new Set(trip.stops.map((s) => s.day))].sort();

  const toggleItem = (i: PackingItem) => save({ packing: trip.packing.map((x) => (x.id === i.id ? { ...x, checked: !x.checked } : x)) });

  return (
    <div className="page">
      <PageHeader title={trip.title} backTo="/travel" subtitle={[trip.destination, trip.startsOn ? `${formatDay(trip.startsOn)}${trip.endsOn && trip.endsOn !== trip.startsOn ? ` to ${formatDay(trip.endsOn)}` : ''}` : 'No dates yet'].filter(Boolean).join(' · ')}
        actions={<Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>Edit</Button>} />
      <Card className="trip-pets">
        <h2 className="visually-hidden">Pets coming</h2>
        {pets.length ? (
          <div className="pet-inline">
            {pets.map((p) => <span key={p.id} className="pet-inline-item"><PetAvatar pet={p} size={36} />{p.name}</span>)}
          </div>
        ) : <p className="muted small">No pets added to this trip yet.</p>}
        {trip.startsOn && daysBetween(today(), trip.startsOn) >= 0 && <Badge tone="accent">Starts {relativeDay(trip.startsOn)}</Badge>}
      </Card>

      {reminders.length > 0 && (
        <Card className="reminders">
          <div className="mini-head"><Icon name="bell" /><h2>Travel reminders</h2></div>
          <ul className="bullets">{reminders.map((r) => <li key={r}>{r}</li>)}</ul>
        </Card>
      )}

      <Card>
        <div className="section-head"><h2>Itinerary</h2><Button variant="secondary" icon="plus" onClick={() => setStopSheet({})}>Add stop</Button></div>
        {trip.stops.length === 0 ? <p className="muted">No stops yet. Add saved places like a dog park or hotel, or type your own.</p> : days.map((d) => (
          <div key={d} className="day">
            <h3>{formatDay(d, true)}</h3>
            <ol className="stops">
              {trip.stops.filter((s) => s.day === d).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99')).map((s) => {
                const pl = s.placeId ? placesById.get(s.placeId) : undefined;
                return (
                  <li key={s.id} className="stop">
                    <span className="stop-time">{formatTime(s.time) || 'Any time'}</span>
                    <span className="grow">
                      {pl ? <Link to={`/explore/${pl.id}`} className="text-link strong">{s.label}</Link> : <strong>{s.label}</strong>}
                      {pl && <span className="muted small block">{categoryLabel(pl.category)}</span>}
                      {s.placeId && !pl && <span className="muted small block">Place was removed</span>}
                      {s.notes && <span className="small block">{s.notes}</span>}
                    </span>
                    <IconButton icon="edit" label={`Edit ${s.label}`} onClick={() => setStopSheet({ stop: s })} />
                    <IconButton icon="trash" label={`Remove ${s.label}`} onClick={async () => { await save({ stops: trip.stops.filter((x) => x.id !== s.id) }); toast('Stop removed'); }} />
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </Card>

      <Card>
        <div className="section-head">
          <h2>Packing list</h2>
          <span className="small muted">{prog.done} of {prog.total} packed</span>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.done} aria-label="Packing progress"><span style={{ width: prog.total ? `${(prog.done / prog.total) * 100}%` : '0%' }} /></div>
        {trip.packing.length === 0 ? <p className="muted">Add pets to this trip to get a packing list, or add your own items.</p> : (
          <ul className="checklist">
            {trip.packing.map((i) => (
              <li key={i.id}>
                <label className={`check ${i.checked ? 'done' : ''}`}>
                  <input type="checkbox" checked={i.checked} onChange={() => toggleItem(i)} />
                  <span className="box" aria-hidden="true"><Icon name="check" size={16} /></span>
                  <span className="grow">{i.label}</span>
                </label>
                <IconButton icon="x" label={`Remove ${i.label}`} onClick={() => save({ packing: trip.packing.filter((x) => x.id !== i.id) })} />
              </li>
            ))}
          </ul>
        )}
        <form className="inline-add" onSubmit={async (e) => { e.preventDefault(); const l = newItem.trim(); if (!l) return; await save({ packing: [...trip.packing, { id: newId('pk-'), label: l, checked: false, custom: true }] }); setNewItem(''); }}>
          <label htmlFor="new-pack" className="visually-hidden">Add packing item</label>
          <input id="new-pack" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add an item" maxLength={120} />
          <Button type="submit" variant="secondary" icon="plus" aria-label="Add item">Add</Button>
        </form>
        <div className="row-actions">
          <Button variant="ghost" onClick={() => save({ packing: trip.packing.map((x) => ({ ...x, checked: false })) })}>Uncheck all</Button>
          <Button variant="ghost" onClick={() => { void save({ packing: mergePackingList(trip.packing, pets) }); toast('Packing list refreshed'); }}>Restore suggested items</Button>
        </div>
      </Card>

      <div className="row-actions">
        <Button variant="danger" icon="trash" onClick={() => setConfirm(true)}>Delete trip</Button>
      </div>
      {editing && <TripFormSheet trip={trip} onClose={() => setEditing(false)} />}
      {stopSheet && <StopSheet trip={trip} stop={stopSheet.stop} onClose={() => setStopSheet(null)} />}
      <Confirm open={confirm} title="Delete this trip?" onCancel={() => setConfirm(false)} onConfirm={async () => { await db.trips.remove(trip.id); setConfirm(false); toast('Trip deleted'); navigate('/travel', true); }} />
    </div>
  );
}
