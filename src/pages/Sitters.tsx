import { useMemo, useState } from 'react';
import type { Pet, Sitter, SitterRequest, SitterService } from '../contracts/domain';
import { BRAND } from '../config/brand';
import { useApp } from '../state';
import { Link, navigate } from '../router';
import { Icon } from '../ui/Icon';
import { Badge, Button, Card, ChoiceGroup, Confirm, CopyValue, EmptyState, PageHeader, PetAvatar, PetMultiSelect, SampleBadge, Sheet, TextField, Toggle, copyText, shareOrCopy } from '../ui/kit';
import {
  FRIEND_FAMILY, SERVICE_HINT, SERVICE_LABEL, buildCareSheet, careSheetText, cleanPhone, dateRange, isEmail, providerHref, providersFor, servicesForSpecies, sitterNeededLine,
  sourceLabel, speciesOf, validateRequest,
} from '../lib/sitters';
import { isValidDay, newId, nowIso, today } from '../lib/dates';

const PROVIDERS = BRAND.sitterProviders;

function petNames(pets: Pet[], ids: string[]): string {
  return pets.filter((p) => ids.includes(p.id)).map((p) => p.name).join(', ') || 'No pets';
}

function Stars({ rating }: { rating?: number }) {
  if (!rating) return null;
  return (
    <span className="stars-read" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => <Icon key={n} name="star" size={16} className={n <= rating ? 'on' : ''} />)}
    </span>
  );
}

/* ---------- /sitters ---------- */

export function SittersPage() {
  const { data, db, toast } = useApp();
  const [booking, setBooking] = useState<SitterRequest | null>(null);
  const [sitterSheet, setSitterSheet] = useState<{ sitter?: Sitter } | null>(null);
  const [cancel, setCancel] = useState<SitterRequest | null>(null);
  const t = today();
  const requests = [...data.sitterRequests].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const open = requests.filter((r) => r.status === 'open' && r.endsOn >= t);
  const booked = requests.filter((r) => r.status === 'booked' && r.endsOn >= t);
  const done = requests.filter((r) => !open.includes(r) && !booked.includes(r));
  const sitters = [...data.sitters].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name));

  const requestCard = (r: SitterRequest) => {
    const pets = data.pets.filter((p) => r.petIds.includes(p.id));
    const trip = r.tripId ? data.trips.find((x) => x.id === r.tripId) : undefined;
    return (
      <li key={r.id} className={`sitter-request ${r.status}`}>
        <div className="sitter-request-top">
          <span className="grow">
            <strong className="block">{r.status === 'booked' ? `Booked ${dateRange(r.startsOn, r.endsOn)}` : sitterNeededLine(r)}</strong>
            <span className="muted small block">{petNames(data.pets, r.petIds)} · {r.services.map((s) => SERVICE_LABEL[s]).join(', ')}{r.location ? ` · near ${r.location}` : ''}</span>
            {trip && <span className="muted small block">While you are away: {trip.title}</span>}
          </span>
          <span className="avatar-stack">{pets.slice(0, 3).map((p) => <PetAvatar key={p.id} pet={p} size={32} />)}</span>
        </div>
        <div className="badges">
          {r.status === 'open' && <Badge tone="warning">Needs a sitter</Badge>}
          {r.status === 'booked' && <Badge tone="success">Booked with {r.bookedName}</Badge>}
          {r.status === 'cancelled' && <Badge>Cancelled</Badge>}
          {r.isSample && <SampleBadge />}
        </div>
        {r.notes && <p className="small sitter-notes">{r.notes}</p>}
        <div className="food-actions">
          {r.status === 'open' && <Button icon="check" onClick={() => setBooking(r)}>Mark booked</Button>}
          {r.status === 'open' && <Link to={`/sitters/new?id=${r.id}`} className="btn btn-secondary"><Icon name="search" size={20} /><span>Search and edit</span></Link>}
          {r.status !== 'cancelled' && <Link to={`/sitters/care-sheet?request=${r.id}`} className="btn btn-secondary"><Icon name="note" size={20} /><span>Care sheet</span></Link>}
          {r.status === 'open' && <Button variant="ghost" onClick={() => setCancel(r)}>Cancel request</Button>}
          {r.status !== 'open' && <Button variant="ghost" icon="trash" aria-label={`Remove request ${dateRange(r.startsOn, r.endsOn)}`} onClick={async () => { await db.sitterRequests.remove(r.id); toast('Request removed'); }}>Remove</Button>}
        </div>
      </li>
    );
  };

  return (
    <div className="page">
      <PageHeader title="Find a sitter" subtitle="Requests, sitters you trust and a care sheet" backTo="/more" actions={<Link to="/sitters/new" className="btn btn-primary"><Icon name="plus" size={20} /><span>New request</span></Link>} />
      <p className="notice"><Icon name="info" size={18} /> <span>{BRAND.name} does not book sitters itself. Say what you need here, then search and book on the sitter site you pick. Your request stays on Home until you mark it booked.</span></p>

      <Card>
        <div className="section-head"><div className="mini-head"><Icon name="calendar" /><h2>Sitter requests</h2></div></div>
        {open.length + booked.length === 0 ? (
          <p className="muted small">No open requests. Going away? <Link to="/sitters/new" className="text-link">Start a request</Link> and it will show on Home until you book.</p>
        ) : (
          <ul className="sitter-requests">{[...open, ...booked].map(requestCard)}</ul>
        )}
        {done.length > 0 && (
          <details className="past-requests">
            <summary>Past and cancelled ({done.length})</summary>
            <ul className="sitter-requests">{done.map(requestCard)}</ul>
          </details>
        )}
      </Card>

      <Card>
        <div className="section-head">
          <div className="mini-head"><Icon name="users" /><h2>My sitters</h2></div>
          <Button variant="ghost" icon="plus" onClick={() => setSitterSheet({})}>Add sitter</Button>
        </div>
        {sitters.length === 0 ? <p className="muted small">Save the sitters you trust, with their phone, email and the pets they know.</p> : (
          <ul className="sitter-list">
            {sitters.map((s) => (
              <li key={s.id} className="sitter">
                <div className="sitter-top">
                  <span className="member-dot" aria-hidden="true">{s.name.slice(0, 1).toUpperCase()}</span>
                  <span className="grow">
                    <strong>{s.name}</strong> {s.isSample && <SampleBadge />}
                    <span className="muted small block">Found via {sourceLabel(s.foundVia, PROVIDERS)}{s.petIds.length ? ` · knows ${petNames(data.pets, s.petIds)}` : ''}</span>
                    <Stars rating={s.rating} />
                  </span>
                  <Button variant="ghost" icon="edit" aria-label={`Edit ${s.name}`} onClick={() => setSitterSheet({ sitter: s })}>Edit</Button>
                </div>
                {s.phone && <CopyValue label="Phone" icon="phone" value={s.phone} onCopied={(ok) => toast(ok ? 'Phone copied' : 'Could not copy. Select the number instead.')} />}
                {s.email && <CopyValue label="Email" icon="mail" value={s.email} onCopied={(ok) => toast(ok ? 'Email copied' : 'Could not copy. Select the email instead.')} />}
                {s.notes && <p className="small sitter-notes">{s.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="sheet-cta">
        <div className="mini-head"><Icon name="note" /><h2>Sitter care sheet</h2></div>
        <p className="muted small">Food, portions, treats, meds due, allergies, vet and emergency contact, filled in from what you already track. Copy it or share it with your sitter.</p>
        <Link to="/sitters/care-sheet" className="btn btn-secondary"><Icon name="note" size={20} /><span>Open care sheet</span></Link>
      </Card>

      {booking && <BookedSheet request={booking} onClose={() => setBooking(null)} />}
      {sitterSheet && <SitterSheet sitter={sitterSheet.sitter} onClose={() => setSitterSheet(null)} />}
      <Confirm open={!!cancel} title="Cancel this request?" body="It will stop showing on Home. You can still find it under past requests." confirmLabel="Cancel request" onCancel={() => setCancel(null)}
        onConfirm={async () => { if (cancel) await db.sitterRequests.upsert({ ...cancel, status: 'cancelled', updatedAt: nowIso() }); setCancel(null); toast('Request cancelled'); }} />
    </div>
  );
}

function BookedSheet({ request, onClose }: { request: SitterRequest; onClose: () => void }) {
  const { data, db, toast } = useApp();
  const [pick, setPick] = useState<string>(data.sitters[0]?.id ?? 'new');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [via, setVia] = useState<string>(FRIEND_FAMILY);
  const [saveSitter, setSaveSitter] = useState(true);
  const [err, setErr] = useState<string>();
  const save = async () => {
    const now = nowIso();
    let sitterId: string | undefined;
    let bookedName: string;
    if (pick !== 'new') {
      const s = data.sitters.find((x) => x.id === pick);
      if (!s) return setErr('Pick a sitter.');
      sitterId = s.id;
      bookedName = s.name;
      const known = [...new Set([...s.petIds, ...request.petIds])];
      if (known.length !== s.petIds.length) await db.sitters.upsert({ ...s, petIds: known, updatedAt: now });
    } else {
      if (!name.trim()) return setErr("Add the sitter's name.");
      bookedName = name.trim();
      if (saveSitter) {
        const s: Sitter = { id: newId('sitter-'), householdId: request.householdId, name: bookedName, phone: cleanPhone(phone) || undefined, foundVia: via, petIds: request.petIds, createdAt: now, updatedAt: now };
        await db.sitters.upsert(s);
        sitterId = s.id;
      }
    }
    await db.sitterRequests.upsert({ ...request, status: 'booked', bookedName, bookedSitterId: sitterId, updatedAt: now });
    toast(`Booked with ${bookedName}`);
    onClose();
  };
  return (
    <Sheet open title="Who did you book?" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Mark booked</Button></>}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className="small muted">{sitterNeededLine(request)} for {petNames(data.pets, request.petIds)}.</p>
        <ChoiceGroup label="Sitter" value={pick} columns={1} onChange={(v) => { setPick(v); setErr(undefined); }}
          options={[...data.sitters.map((s) => ({ value: s.id, label: s.name, hint: sourceLabel(s.foundVia, PROVIDERS) })), { value: 'new', label: 'Someone new' }]} />
        {pick === 'new' && (
          <>
            <TextField label="Sitter name" value={name} onChange={(v) => { setName(v); setErr(undefined); }} maxLength={60} />
            <TextField label="Phone (optional)" value={phone} onChange={setPhone} type="tel" inputMode="tel" maxLength={30} />
            <ChoiceGroup label="Found them on" value={via} columns={2} onChange={setVia} options={[...PROVIDERS.map((p) => ({ value: p.id, label: p.name })), { value: FRIEND_FAMILY, label: 'Friend or family' }]} />
            <Toggle label="Save to My sitters" checked={saveSitter} onChange={setSaveSitter} />
          </>
        )}
        {err && <p className="field-error" role="alert">{err}</p>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

export function SitterSheet({ sitter, onClose }: { sitter?: Sitter; onClose: () => void }) {
  const { data, db, toast } = useApp();
  const [name, setName] = useState(sitter?.name ?? '');
  const [phone, setPhone] = useState(sitter?.phone ?? '');
  const [email, setEmail] = useState(sitter?.email ?? '');
  const [via, setVia] = useState<string>(sitter?.foundVia ?? FRIEND_FAMILY);
  const [rating, setRating] = useState<number>(sitter?.rating ?? 0);
  const [petIds, setPetIds] = useState<string[]>(sitter?.petIds ?? []);
  const [notes, setNotes] = useState(sitter?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const save = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Add a name.';
    if (email.trim() && !isEmail(email)) e.email = 'That email does not look right.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const now = nowIso();
    const rec: Sitter = {
      ...(sitter ?? { id: newId('sitter-'), createdAt: now, householdId: data.household?.id ?? '' }),
      name: name.trim(), phone: cleanPhone(phone) || undefined, email: email.trim() || undefined, foundVia: via,
      rating: rating ? (rating as Sitter['rating']) : undefined, petIds, notes: notes.trim() || undefined, updatedAt: now,
    } as Sitter;
    await db.sitters.upsert(rec);
    toast(sitter ? 'Sitter saved' : `${rec.name} added`);
    onClose();
  };
  return (
    <>
      <Sheet open={!confirm} title={sitter ? `Edit ${sitter.name}` : 'Add a sitter'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save sitter</Button></>}>
        <form className="form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
          <TextField label="Name" value={name} onChange={setName} error={errors.name} maxLength={60} />
          <div className="field-row">
            <TextField label="Phone" value={phone} onChange={setPhone} type="tel" inputMode="tel" maxLength={30} />
            <TextField label="Email" value={email} onChange={setEmail} type="email" inputMode="email" error={errors.email} maxLength={120} />
          </div>
          <ChoiceGroup label="Found them on" value={via} columns={2} onChange={setVia} options={[...PROVIDERS.map((p) => ({ value: p.id, label: p.name })), { value: FRIEND_FAMILY, label: 'Friend or family' }]} />
          <div className="field">
            <span className="label" id="sitter-rating">Your rating</span>
            <div className="stars" role="radiogroup" aria-labelledby="sitter-rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={`star ${rating >= n ? 'on' : ''}`} onClick={() => setRating(rating === n ? 0 : n)}>
                  <Icon name="star" />
                </button>
              ))}
            </div>
          </div>
          <PetMultiSelect label="Pets they know" pets={data.pets} value={petIds} onChange={setPetIds} />
          <TextField label="Notes" value={notes} onChange={setNotes} multiline placeholder="Rates, availability, how the visit went" />
          {sitter && <div className="row-actions"><Button variant="danger" icon="trash" onClick={() => setConfirm(true)}>Delete sitter</Button></div>}
          <button type="submit" hidden />
        </form>
      </Sheet>
      <Confirm open={confirm} title={`Delete ${sitter?.name ?? 'sitter'}?`} onCancel={() => setConfirm(false)} onConfirm={async () => { if (sitter) await db.sitters.remove(sitter.id); toast('Sitter deleted'); onClose(); }} />
    </>
  );
}

/* ---------- /sitters/new ---------- */

export function SitterRequestPage({ query }: { query: URLSearchParams }) {
  const { data, db, toast } = useApp();
  const existing = query.get('id') ? data.sitterRequests.find((r) => r.id === query.get('id')) : undefined;
  const trip = existing?.tripId ? data.trips.find((x) => x.id === existing.tripId) : query.get('trip') ? data.trips.find((x) => x.id === query.get('trip')) : undefined;
  const initialPets = useMemo(() => {
    if (existing) return existing.petIds;
    const pet = query.get('pet');
    if (pet && data.pets.some((p) => p.id === pet)) return [pet];
    if (trip) {
      // pets staying home need the sitter; if everyone travels, start with the trip pets
      const home = data.pets.filter((p) => !trip.petIds.includes(p.id)).map((p) => p.id);
      return home.length ? home : trip.petIds;
    }
    return data.pets.length === 1 ? [data.pets[0].id] : [];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [petIds, setPetIds] = useState<string[]>(initialPets);
  const [services, setServices] = useState<SitterService[]>(existing?.services ?? []);
  const [startsOn, setStartsOn] = useState(existing?.startsOn ?? trip?.startsOn ?? '');
  const [endsOn, setEndsOn] = useState(existing?.endsOn ?? trip?.endsOn ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pets = data.pets.filter((p) => petIds.includes(p.id));
  const species = speciesOf(pets);
  const offered = servicesForSpecies(species);
  const chosen = services.filter((s) => offered.includes(s));
  const matches = providersFor(PROVIDERS, chosen, species);
  const q = { services: chosen, species, startsOn: isValidDay(startsOn) ? startsOn : undefined, endsOn: isValidDay(endsOn) ? endsOn : undefined, location: location.trim() || undefined };

  const toggle = (s: SitterService) => setServices(services.includes(s) ? services.filter((x) => x !== s) : [...services, s]);

  const save = async () => {
    const e = validateRequest({ petIds, services: chosen, startsOn, endsOn });
    setErrors(e);
    if (Object.keys(e).length) { toast('Check the highlighted fields'); return; }
    const now = nowIso();
    const rec: SitterRequest = {
      ...(existing ?? { id: newId('sitreq-'), createdAt: now, householdId: data.household?.id ?? '', status: 'open' as const, tripId: trip?.id }),
      petIds, services: chosen, startsOn, endsOn, location: location.trim() || undefined, notes: notes.trim() || undefined, updatedAt: now,
    } as SitterRequest;
    await db.sitterRequests.upsert(rec);
    toast(existing ? 'Request updated' : 'Request saved. It shows on Home until you book.');
    navigate('/sitters', true);
  };

  if (!data.pets.length) {
    return <div className="page"><PageHeader title="Find a sitter" backTo="/sitters" /><EmptyState icon="paw" title="Add a pet first" action={<Link to="/pets?add=1" className="btn btn-primary"><Icon name="plus" size={20} /><span>Add a pet</span></Link>}>A sitter request is built around your pets and their care.</EmptyState></div>;
  }

  return (
    <div className="page">
      <PageHeader title={existing ? 'Edit sitter request' : 'Find a sitter'} subtitle="Pick what you need, then search on a sitter site" backTo="/sitters" />
      {trip && <p className="notice"><Icon name="suitcase" size={18} /> <span>Dates from your trip <strong>{trip.title}</strong>. Change them if the sitter is needed for different days.</span></p>}
      <form className="form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Card>
          <h2 className="step-title"><span className="step-num">1</span> Who needs care?</h2>
          <PetMultiSelect label="Pets" pets={data.pets} value={petIds} onChange={(v) => { setPetIds(v); setErrors({ ...errors, pets: '' }); }} />
          {errors.pets && <p className="field-error" role="alert">{errors.pets}</p>}
        </Card>
        <Card>
          <h2 className="step-title"><span className="step-num">2</span> What kind of care?</h2>
          <div className="choices service-choices" role="group" aria-label="Kind of care">
            {offered.map((s) => {
              const on = services.includes(s);
              return (
                <button key={s} type="button" className={`choice ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(s)}>
                  <span className="choice-label">{SERVICE_LABEL[s]}</span>
                  <span className="choice-hint">{SERVICE_HINT[s]}</span>
                </button>
              );
            })}
          </div>
          {errors.services && <p className="field-error" role="alert" style={{ marginTop: 8 }}>{errors.services}</p>}
        </Card>
        <Card>
          <h2 className="step-title"><span className="step-num">3</span> When and where?</h2>
          <div className="field-row">
            <TextField label="Start date" type="date" value={startsOn} onChange={setStartsOn} error={errors.startsOn} />
            <TextField label="End date" type="date" value={endsOn} onChange={setEndsOn} error={errors.endsOn} />
          </div>
          <TextField label="Zip code or city" value={location} onChange={setLocation} maxLength={60} placeholder="Where your pets will be" />
          <TextField label="Notes for yourself (optional)" value={notes} onChange={setNotes} multiline maxLength={500} placeholder="Two visits a day, needs meds at dinner" />
        </Card>
        <Card className="search-on">
          <h2 className="step-title"><span className="step-num">4</span> Search for a sitter</h2>
          {matches.length ? (
            <div className="stack">
              {matches.map((p) => (
                <a key={p.id} className="btn btn-secondary provider-btn" href={providerHref(p, q)} target="_blank" rel="noopener noreferrer" aria-label={`Search on ${p.name} (opens in a new tab)`}>
                  <Icon name="external" size={20} /><span>Search on {p.name}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="muted small">None of the linked sites lists this mix of care and pets. Try fewer kinds of care, or ask a friend or family member.</p>
          )}
          <p className="small search-note"><Icon name="info" size={16} /> <span>You will finish booking on their site. Then come back and mark this request booked.</span></p>
        </Card>
        <div className="row-actions sticky-actions">
          <Link to="/sitters" className="btn btn-secondary">Cancel</Link>
          <Button type="submit">{existing ? 'Save request' : 'Save request'}</Button>
        </div>
      </form>
    </div>
  );
}

/* ---------- /sitters/care-sheet ---------- */

export function CareSheetPage({ query }: { query: URLSearchParams }) {
  const { data, db, toast } = useApp();
  const request = query.get('request') ? data.sitterRequests.find((r) => r.id === query.get('request')) : undefined;
  const initialPets = request?.petIds ?? (query.get('pets')?.split(',').filter((id) => data.pets.some((p) => p.id === id)) || data.pets.map((p) => p.id));
  const [petIds, setPetIds] = useState<string[]>(initialPets.length ? initialPets : data.pets.map((p) => p.id));
  const [startsOn, setStartsOn] = useState(request?.startsOn ?? query.get('from') ?? '');
  const [endsOn, setEndsOn] = useState(request?.endsOn ?? query.get('to') ?? '');
  const h = data.household;
  const members = h?.members ?? [];
  const [houseNotes, setHouseNotes] = useState(h?.houseNotes ?? '');
  const [notesOpen, setNotesOpen] = useState(false);
  const pets = data.pets.filter((p) => petIds.includes(p.id));
  const sheet = buildCareSheet({ pets, food: data.food, switchPlans: data.switchPlans, care: data.care, household: h, startsOn, endsOn: endsOn || startsOn });
  const text = careSheetText(sheet, BRAND.name);
  const contact = h?.emergencyContact && members.includes(h.emergencyContact) ? h.emergencyContact : members.find((m) => h?.memberPhones?.[m]) ?? members[0];

  const saveHousehold = async (patch: Partial<NonNullable<typeof h>>, msg: string) => {
    if (!h) return;
    await db.households.upsert({ ...h, ...patch, updatedAt: nowIso() });
    toast(msg);
  };

  return (
    <div className="page">
      <PageHeader title="Sitter care sheet" subtitle="Made from what you already track" backTo="/sitters" />
      <Card className="no-print">
        <PetMultiSelect label="Pets on this sheet" pets={data.pets} value={petIds} onChange={setPetIds} />
        <div className="field-row">
          <TextField label="From" type="date" value={startsOn} onChange={setStartsOn} />
          <TextField label="To" type="date" value={endsOn} onChange={setEndsOn} />
        </div>
        {members.length > 0 ? (
          <div className="field">
            <span className="label" id="ec-label">Emergency contact</span>
            <div className="chip-row" role="group" aria-labelledby="ec-label" style={{ margin: 0 }}>
              {members.map((m) => (
                <button key={m} type="button" className={`chip ${contact === m ? 'on' : ''}`} aria-pressed={contact === m} onClick={() => saveHousehold({ emergencyContact: m }, `${m} is the emergency contact`)}>{m}</button>
              ))}
            </div>
            {contact && !h?.memberPhones?.[contact] && <p className="hint">Add a phone for {contact} in <Link to="/account" className="text-link">Account</Link> so it shows on the sheet.</p>}
          </div>
        ) : <p className="hint">Add household members with phone numbers in <Link to="/account" className="text-link">Account</Link> to list an emergency contact.</p>}
        <div className="food-actions">
          <Button variant="secondary" icon="edit" onClick={() => setNotesOpen(true)}>{h?.houseNotes ? 'Edit house notes' : 'Add house notes'}</Button>
        </div>
      </Card>

      {pets.length === 0 ? <EmptyState icon="paw" title="Pick a pet">Choose at least one pet to build the sheet.</EmptyState> : (
        <article className="care-sheet" aria-labelledby="care-sheet-title" data-testid="care-sheet">
          <header className="care-sheet-head">
            <img src={BRAND.logoDataUri} alt="" width={40} height={40} />
            <div className="grow">
              <h2 id="care-sheet-title">{sheet.title}</h2>
              {sheet.dates && <p className="muted">{sheet.dates}</p>}
            </div>
          </header>
          {sheet.pets.map((p) => {
            const pet = data.pets.find((x) => x.id === p.petId)!;
            return (
              <section key={p.petId} className="care-sheet-pet" aria-label={p.name}>
                <div className="care-sheet-pet-head">
                  <PetAvatar pet={pet} size={44} />
                  <div><h3>{p.name}</h3><p className="muted small">{p.subtitle}</p></div>
                </div>
                <dl className="care-sheet-list">
                  {p.sections.map((s) => (
                    <div key={s.title} className={s.title === 'Allergies' && pet.allergies.length ? 'warn' : ''}>
                      <dt>{s.title}</dt>
                      <dd>{s.lines.length === 1 ? s.lines[0] : <ul>{s.lines.map((l) => <li key={l}>{l}</li>)}</ul>}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
          <section className="care-sheet-house" aria-label="Household">
            <dl className="care-sheet-list">
              {sheet.household.map((s) => (
                <div key={s.title}><dt>{s.title}</dt><dd>{s.lines.length === 1 ? s.lines[0] : <ul>{s.lines.map((l) => <li key={l}>{l}</li>)}</ul>}</dd></div>
              ))}
            </dl>
          </section>
          <p className="muted small care-sheet-foot">Made with {BRAND.name}</p>
        </article>
      )}

      {pets.length > 0 && (
        <div className="row-actions sticky-actions no-print">
          <Button icon="copy" onClick={async () => toast((await copyText(text)) ? 'Care sheet copied' : 'Could not copy on this device')}>Copy all as text</Button>
          <Button variant="secondary" icon="share" onClick={async () => {
            const r = await shareOrCopy(sheet.title, text);
            if (r === 'copied') toast('Copied. Paste it into a message to your sitter.');
            else if (r === 'failed') toast('Could not share on this device');
          }}>Share</Button>
        </div>
      )}

      {notesOpen && (
        <Sheet open title="House notes" onClose={() => setNotesOpen(false)} footer={<><Button variant="secondary" onClick={() => setNotesOpen(false)}>Cancel</Button><Button onClick={async () => { await saveHousehold({ houseNotes: houseNotes.trim() || undefined }, 'House notes saved'); setNotesOpen(false); }}>Save</Button></>}>
          <form className="form" onSubmit={(e) => { e.preventDefault(); }}>
            <TextField label="House notes" value={houseNotes} onChange={setHouseNotes} multiline maxLength={1500} hint="Where the food and leash live, house rules, wifi. Avoid alarm codes if you will share the sheet widely." />
          </form>
        </Sheet>
      )}
    </div>
  );
}
