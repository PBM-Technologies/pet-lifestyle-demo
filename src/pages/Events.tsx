import { useState } from 'react';
import type { EventKind, PetEvent } from '../contracts/domain';
import { useApp } from '../state';
import { Badge, Button, Card, ChoiceGroup, Confirm, EmptyState, PageHeader, PetAvatar, PetMultiSelect, SampleBadge, Sheet, SheetPicker, TextField } from '../ui/kit';
import { formatDay, formatTime, isValidDay, newId, nowIso, relativeDay, today } from '../lib/dates';
import { Link } from '../router';

export const EVENT_KINDS: Array<{ value: EventKind; label: string }> = [
  { value: 'walk_club', label: 'Walk club' },
  { value: 'playdate', label: 'Playdate' },
  { value: 'pet_birthday', label: 'Pet birthday' },
  { value: 'adoption_event', label: 'Adoption event' },
  { value: 'other', label: 'Other' },
];
const kindLabel = (k: EventKind) => EVENT_KINDS.find((x) => x.value === k)?.label ?? 'Event';

export function EventsPage() {
  const { data, db, toast } = useApp();
  const [editing, setEditing] = useState<PetEvent | 'new' | null>(null);
  const [confirm, setConfirm] = useState<PetEvent | null>(null);
  const [showPast, setShowPast] = useState(false);
  const t = today();
  const sorted = [...data.events].sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
  const upcoming = sorted.filter((e) => e.date >= t);
  const past = sorted.filter((e) => e.date < t).reverse();
  const places = new Map(data.places.map((p) => [p.id, p]));

  const rsvp = async (e: PetEvent, r: PetEvent['rsvp']) => {
    await db.events.upsert({ ...e, rsvp: e.rsvp === r ? null : r, updatedAt: nowIso() });
    toast(e.rsvp === r ? 'RSVP cleared' : r === 'going' ? 'You are going' : r === 'maybe' ? 'Marked maybe' : 'Marked not going');
  };

  const card = (e: PetEvent) => {
    const pl = e.placeId ? places.get(e.placeId) : undefined;
    const pets = data.pets.filter((p) => e.petIds.includes(p.id));
    return (
      <li key={e.id}>
        <Card as="article" className="event-card">
          <div className="event-date" aria-hidden="true">
            <span>{formatDay(e.date).split(' ')[0]}</span>
            <strong>{Number(e.date.slice(8, 10))}</strong>
          </div>
          <div className="grow">
            <h2 className="event-title">{e.title}</h2>
            <p className="muted small">{formatDay(e.date, true)}{e.time ? ` · ${formatTime(e.time)}` : ''} · {relativeDay(e.date)}</p>
            <p className="small">{pl ? <Link to={`/explore/${pl.id}`} className="text-link">{pl.name}</Link> : e.locationText || 'Location to be decided'}</p>
            {e.description && <p className="small">{e.description}</p>}
            <div className="badges">
              <Badge>{kindLabel(e.kind)}</Badge>
              {e.isSample ? <SampleBadge /> : <Badge tone="accent">Your event</Badge>}
              {pets.map((p) => <span key={p.id} className="pet-inline-item small"><PetAvatar pet={p} size={22} />{p.name}</span>)}
            </div>
            <div className="rsvp" role="group" aria-label={`RSVP for ${e.title}`}>
              {(['going', 'maybe', 'not_going'] as const).map((r) => (
                <button key={r} type="button" className={`chip ${e.rsvp === r ? 'on' : ''}`} aria-pressed={e.rsvp === r} onClick={() => rsvp(e, r)}>
                  {r === 'going' ? 'Going' : r === 'maybe' ? 'Maybe' : 'Not going'}
                </button>
              ))}
            </div>
            <div className="row-actions">
              {!e.isSample && <Button variant="ghost" icon="edit" onClick={() => setEditing(e)}>Edit</Button>}
              <Button variant="ghost" icon="trash" onClick={() => setConfirm(e)}>{e.isSample ? 'Hide' : 'Delete'}</Button>
            </div>
          </div>
        </Card>
      </li>
    );
  };

  return (
    <div className="page">
      <PageHeader title="Events" subtitle="Walks, playdates, birthdays and adoption days" backTo="/more" actions={<Button icon="plus" onClick={() => setEditing('new')}>New event</Button>} />
      <p className="notice small">Events you create stay on this device for now. Inviting other people comes with accounts. Sample events are fictional.</p>
      {upcoming.length === 0 ? (
        <EmptyState icon="calendar" title="Nothing coming up" action={<Button icon="plus" onClick={() => setEditing('new')}>Create an event</Button>}>Plan a walk club, a playdate or a pet birthday party.</EmptyState>
      ) : <ul className="event-list">{upcoming.map(card)}</ul>}
      {past.length > 0 && (
        <>
          <Button variant="ghost" onClick={() => setShowPast(!showPast)} aria-expanded={showPast}>{showPast ? 'Hide' : 'Show'} past events ({past.length})</Button>
          {showPast && <ul className="event-list past">{past.map(card)}</ul>}
        </>
      )}
      {editing && <EventSheet event={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <Confirm open={!!confirm} title={confirm?.isSample ? 'Hide this sample event?' : 'Delete this event?'} onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm) await db.events.remove(confirm.id); setConfirm(null); toast('Event removed'); }} />
    </div>
  );
}

function EventSheet({ event, onClose }: { event?: PetEvent; onClose: () => void }) {
  const { db, data, toast } = useApp();
  const [title, setTitle] = useState(event?.title ?? '');
  const [kind, setKind] = useState<EventKind>(event?.kind ?? 'walk_club');
  const [date, setDate] = useState(event?.date ?? today());
  const [time, setTime] = useState(event?.time ?? '');
  const [placeId, setPlaceId] = useState(event?.placeId ?? '');
  const [locationText, setLocationText] = useState(event?.locationText ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [petIds, setPetIds] = useState<string[]>(event?.petIds ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Add a title.';
    if (!isValidDay(date)) e.date = 'Pick a date.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const now = nowIso();
    const pl = data.places.find((p) => p.id === placeId);
    await db.events.upsert({
      ...(event ?? { id: newId('ev-'), createdAt: now, rsvp: 'going', isSample: false, householdId: data.household?.id }),
      title: title.trim(), kind, date, time: time || undefined, placeId: pl?.id, locationText: pl ? pl.name : locationText.trim() || undefined,
      description: description.trim() || undefined, petIds, updatedAt: now,
    } as PetEvent);
    toast(event ? 'Event updated' : 'Event created');
    onClose();
  };

  return (
    <Sheet open title={event ? 'Edit event' : 'New event'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save event</Button></>}>
      <form className="form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
        <TextField label="Title" value={title} onChange={setTitle} error={errors.title} placeholder="Luna's 3rd birthday" />
        <ChoiceGroup<EventKind> label="Type" value={kind} onChange={setKind} columns={2} options={EVENT_KINDS} />
        <div className="field-row">
          <TextField label="Date" type="date" value={date} onChange={setDate} error={errors.date} />
          <TextField label="Time" type="time" value={time} onChange={setTime} />
        </div>
        <SheetPicker label="Place (optional)" value={placeId} onChange={setPlaceId} placeholder="Choose from your places" options={[{ value: '', label: 'No linked place' }, ...data.places.map((p) => ({ value: p.id, label: p.name }))]} />
        {!placeId && <TextField label="Or type a location" value={locationText} onChange={setLocationText} placeholder="Backyard, local trail" />}
        <TextField label="Details" value={description} onChange={setDescription} multiline />
        <PetMultiSelect label="Pets coming" pets={data.pets} value={petIds} onChange={setPetIds} />
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
