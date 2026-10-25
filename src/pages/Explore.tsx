import { useMemo, useState } from 'react';
import type { LeashRule, PlaceCategory, PlaceListing, SavedPlace } from '../contracts/domain';
import { useApp } from '../state';
import { Link, navigate } from '../router';
import { Icon } from '../ui/Icon';
import { Badge, Button, Card, ChoiceGroup, Confirm, EmptyState, IconButton, PageHeader, SampleBadge, Sheet, SheetPicker, TextField, TriState } from '../ui/kit';
import { PLACE_CATEGORIES, categoryLabel, filterPlaces, verificationLabel, yesNoUnknown } from '../lib/places';
import { formatDay, newId, nowIso, today } from '../lib/dates';
import { removePlace } from '../data/db';

const LEASH: Array<{ value: LeashRule; label: string }> = [
  { value: 'required', label: 'Leash required' },
  { value: 'off_leash_area', label: 'Off-leash area' },
  { value: 'not_applicable', label: 'Not applicable' },
  { value: 'unknown', label: 'Unknown' },
];
const leashLabel = (r: LeashRule) => LEASH.find((l) => l.value === r)?.label ?? 'Unknown';

async function toggleFavorite(db: ReturnType<typeof useApp>['db'], householdId: string, placeId: string, saved: SavedPlace | undefined) {
  const now = nowIso();
  const next: SavedPlace = saved ? { ...saved, favorite: !saved.favorite, updatedAt: now } : { id: newId('sp-'), householdId, placeId, favorite: true, createdAt: now, updatedAt: now };
  await db.savedPlaces.upsert(next);
  return next.favorite;
}

export function ExplorePage({ query }: { query: URLSearchParams }) {
  const { data, db, toast } = useApp();
  const [q, setQ] = useState(query.get('q') ?? '');
  const [cat, setCat] = useState<PlaceCategory | 'all' | 'saved'>((query.get('c') as PlaceCategory | 'saved') || 'all');
  const [species, setSpecies] = useState<'any' | 'dog' | 'cat'>('any');
  const [adding, setAdding] = useState(false);
  const savedBy = useMemo(() => new Map(data.saved.map((s) => [s.placeId, s])), [data.saved]);
  const list = filterPlaces(data.places, data.saved, { query: q, category: cat, species });

  return (
    <div className="page">
      <PageHeader title="Explore" subtitle="Pet-friendly places you know and love" actions={<Button icon="plus" onClick={() => setAdding(true)}>Add place</Button>} />
      <div className="search">
        <Icon name="search" />
        <label htmlFor="place-search" className="visually-hidden">Search places</label>
        <input id="place-search" type="search" placeholder="Search name, city or type" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <IconButton icon="x" label="Clear search" onClick={() => setQ('')} />}
      </div>
      <div className="chip-scroll" role="group" aria-label="Filter by category">
        {[{ id: 'all', label: 'All' }, { id: 'saved', label: 'Saved' }, ...PLACE_CATEGORIES].map((c) => (
          <button key={c.id} type="button" className={`chip ${cat === c.id ? 'on' : ''}`} aria-pressed={cat === c.id} onClick={() => setCat(c.id as PlaceCategory | 'all' | 'saved')}>
            {c.id === 'saved' && <Icon name="heart" size={16} />}{c.label}
          </button>
        ))}
      </div>
      <div className="chip-row" role="group" aria-label="Filter by pet">
        {(['any', 'dog', 'cat'] as const).map((s) => (
          <button key={s} type="button" className={`chip subtle ${species === s ? 'on' : ''}`} aria-pressed={species === s} onClick={() => setSpecies(s)}>
            {s === 'any' ? 'Any pet' : s === 'dog' ? 'Dogs allowed' : 'Cats allowed'}
          </button>
        ))}
      </div>
      <p className="notice"><Icon name="info" size={18} /> Live listings are coming. For now you will find a few labeled samples plus any places you add. Always call ahead to confirm pet policies.</p>

      {list.length === 0 ? (
        <EmptyState icon="pin" title={cat === 'saved' ? 'No saved places yet' : 'No places match'} action={<Button icon="plus" onClick={() => setAdding(true)}>Add a place</Button>}>
          {cat === 'saved' ? 'Tap the heart on any place to save it here.' : 'Try a different search or category, or add a place you know.'}
        </EmptyState>
      ) : (
        <ul className="place-list">
          {list.map((p) => {
            const s = savedBy.get(p.id);
            const v = verificationLabel(p, s, formatDay);
            return (
              <li key={p.id} className="card place-card">
                <Link to={`/explore/${p.id}`} className="place-main">
                  <span className={`cat-icon cat-${p.category}`}><Icon name="pin" /></span>
                  <span className="grow">
                    <strong>{p.name}</strong>
                    <span className="muted small block">{categoryLabel(p.category)}{p.city ? ` · ${p.city}` : ''}</span>
                    <span className="policy-mini">
                      <span>Dogs: {yesNoUnknown(p.policy.dogsAllowed)}</span>
                      <span>Cats: {yesNoUnknown(p.policy.catsAllowed)}</span>
                    </span>
                    <span className="badges">
                      {p.isSample ? <SampleBadge /> : <Badge tone="accent">Added by you</Badge>}
                      <Badge tone={v.verified ? 'success' : 'neutral'}>{v.verified ? 'Verified by you' : 'Unverified'}</Badge>
                    </span>
                  </span>
                </Link>
                <IconButton icon="heart" label={s?.favorite ? `Unsave ${p.name}` : `Save ${p.name}`} pressed={!!s?.favorite} className={`fav ${s?.favorite ? 'on' : ''}`}
                  onClick={async () => { if (!data.household) return; const on = await toggleFavorite(db, data.household.id, p.id, s); toast(on ? 'Saved' : 'Removed from saved'); }} />
              </li>
            );
          })}
        </ul>
      )}
      {adding && <PlaceFormSheet onClose={() => setAdding(false)} onSaved={(id) => navigate(`/explore/${id}`)} />}
    </div>
  );
}

export function PlaceFormSheet({ onClose, place, onSaved }: { onClose: () => void; place?: PlaceListing; onSaved?: (id: string) => void }) {
  const { db, data, toast } = useApp();
  const [name, setName] = useState(place?.name ?? '');
  const [category, setCategory] = useState<PlaceCategory | ''>(place?.category ?? '');
  const [address, setAddress] = useState(place?.address ?? '');
  const [city, setCity] = useState(place?.city ?? '');
  const [description, setDescription] = useState(place?.description ?? '');
  const [dogs, setDogs] = useState<boolean | null>(place?.policy.dogsAllowed ?? null);
  const [cats, setCats] = useState<boolean | null>(place?.policy.catsAllowed ?? null);
  const [sizeLimit, setSizeLimit] = useState(place?.policy.sizeLimit ?? '');
  const [petFee, setPetFee] = useState(place?.policy.petFee ?? '');
  const [leash, setLeash] = useState<LeashRule>(place?.policy.leashRule ?? 'unknown');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required.';
    if (!category) e.category = 'Choose a category.';
    setErrors(e);
    if (Object.keys(e).length || !category) return;
    const now = nowIso();
    const rec: PlaceListing = {
      ...(place ?? { id: newId('place-'), createdAt: now, isSample: false, householdId: data.household?.id }),
      name: name.trim(),
      category,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      description: description.trim() || undefined,
      policy: { ...(place?.policy ?? {}), dogsAllowed: dogs, catsAllowed: cats, sizeLimit: sizeLimit.trim() || undefined, petFee: petFee.trim() || undefined, leashRule: leash },
      updatedAt: now,
    } as PlaceListing;
    await db.places.upsert(rec);
    toast(place ? 'Place updated' : 'Place added');
    onSaved?.(rec.id);
    onClose();
  };

  return (
    <Sheet open title={place ? 'Edit place' : 'Add a place'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save place</Button></>}>
      <form className="form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
        <TextField label="Name" value={name} onChange={setName} error={errors.name} />
        <SheetPicker<PlaceCategory> label="Category" value={category} onChange={setCategory} options={PLACE_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
        {errors.category && <p className="field-error" role="alert">{errors.category}</p>}
        <TextField label="Address" value={address} onChange={setAddress} placeholder="Street, or a description" />
        <TextField label="City" value={city} onChange={setCity} />
        <TextField label="Description" value={description} onChange={setDescription} multiline />
        <h3 className="form-section">Pet policy</h3>
        <TriState label="Dogs allowed" value={dogs} onChange={setDogs} />
        <TriState label="Cats allowed" value={cats} onChange={setCats} />
        <TextField label="Size or weight limit" value={sizeLimit} onChange={setSizeLimit} placeholder="Under 50 lb, 2 pets max" />
        <TextField label="Pet fee" value={petFee} onChange={setPetFee} placeholder="As quoted to you" />
        <ChoiceGroup<LeashRule> label="Leash rule" value={leash} onChange={setLeash} columns={2} options={LEASH} />
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

export function PlaceDetailPage({ placeId }: { placeId: string }) {
  const { data, db, toast } = useApp();
  const place = data.places.find((p) => p.id === placeId);
  const saved = data.saved.find((s) => s.placeId === placeId);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notes, setNotes] = useState(saved?.notes ?? '');

  if (!place) return <div className="page"><PageHeader title="Place not found" backTo="/explore" /><EmptyState icon="pin" title="This place is not here">It may have been removed. <Link to="/explore" className="text-link">Back to Explore</Link></EmptyState></div>;
  const v = verificationLabel(place, saved, formatDay);
  const hid = data.household?.id ?? '';

  const updateSaved = async (patch: Partial<SavedPlace>) => {
    const now = nowIso();
    const base: SavedPlace = saved ?? { id: newId('sp-'), householdId: hid, placeId, favorite: false, createdAt: now, updatedAt: now };
    await db.savedPlaces.upsert({ ...base, ...patch, updatedAt: now });
  };
  const setVerified = async (on: boolean) => {
    const at = on ? today() : undefined;
    if (place.isSample) await updateSaved({ verifiedAt: at });
    else {
      await db.places.upsert({ ...place, policy: { ...place.policy, verifiedAt: at, verifiedBy: on ? 'you' : undefined }, updatedAt: nowIso() });
      if (saved?.verifiedAt) await updateSaved({ verifiedAt: undefined });
    }
    toast(on ? 'Marked verified by you' : 'Verification cleared');
  };

  return (
    <div className="page">
      <PageHeader title={place.name} subtitle={`${categoryLabel(place.category)}${place.city ? ` · ${place.city}` : ''}`} backTo="/explore"
        actions={<IconButton icon="heart" label={saved?.favorite ? 'Unsave place' : 'Save place'} pressed={!!saved?.favorite} className={`fav ${saved?.favorite ? 'on' : ''}`} onClick={async () => { const on = await toggleFavorite(db, hid, placeId, saved); toast(on ? 'Saved' : 'Removed from saved'); }} />} />
      {place.isSample && <p className="notice"><Icon name="info" size={18} /> Fictional sample listing for demonstration. Not a real business.</p>}
      <Card>
        {place.description && <p>{place.description}</p>}
        {place.address && <p className="muted small"><Icon name="pin" size={16} /> {place.address}</p>}
      </Card>
      <Card>
        <div className="section-head">
          <h2>Pet policy</h2>
          <Badge tone={v.verified ? 'success' : 'warning'}>{v.text}</Badge>
        </div>
        <dl className="facts">
          <div><dt>Dogs allowed</dt><dd>{yesNoUnknown(place.policy.dogsAllowed)}</dd></div>
          <div><dt>Cats allowed</dt><dd>{yesNoUnknown(place.policy.catsAllowed)}</dd></div>
          <div><dt>Size or weight limit</dt><dd>{place.policy.sizeLimit || 'Not listed'}</dd></div>
          <div><dt>Pet fee</dt><dd>{place.policy.petFee || 'Not listed'}</dd></div>
          <div><dt>Leash rule</dt><dd>{leashLabel(place.policy.leashRule)}</dd></div>
        </dl>
        <p className="muted small">Policies change. {v.verified ? 'You marked this as checked.' : 'Call ahead before you go.'} {BRANDLESS_NOTE}</p>
        <div className="row-actions">
          {v.verified ? <Button variant="secondary" onClick={() => setVerified(false)}>Clear verification</Button> : <Button variant="secondary" icon="shield" onClick={() => setVerified(true)}>I confirmed this policy today</Button>}
        </div>
      </Card>
      <Card>
        <h2>Your notes and rating</h2>
        <p className="muted small">Private to your household.</p>
        <div className="stars" role="radiogroup" aria-label="Your rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={saved?.rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={`star ${(saved?.rating ?? 0) >= n ? 'on' : ''}`} onClick={() => updateSaved({ rating: n as 1 | 2 | 3 | 4 | 5 })}>
              <Icon name="star" size={28} />
            </button>
          ))}
        </div>
        <TextField label="Notes" value={notes} onChange={setNotes} multiline placeholder="Shady spot by the gate, water bowls inside" />
        <Button variant="secondary" onClick={async () => { await updateSaved({ notes: notes.trim() || undefined }); toast('Notes saved'); }}>Save notes</Button>
      </Card>
      <div className="row-actions">
        <Link to={`/travel?add=1&place=${place.id}`} className="btn btn-secondary"><Icon name="suitcase" size={20} /><span>Add to a new trip</span></Link>
        {!place.isSample && <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>Edit place</Button>}
        <Button variant="danger" icon="trash" onClick={() => setConfirm(true)}>{place.isSample ? 'Hide sample' : 'Delete place'}</Button>
      </div>
      {editing && <PlaceFormSheet place={place} onClose={() => setEditing(false)} />}
      <Confirm open={confirm} title={place.isSample ? 'Hide this sample?' : 'Delete this place?'} body="Your notes and rating for it will also be removed." onCancel={() => setConfirm(false)}
        onConfirm={async () => { await removePlace(db, place.id); setConfirm(false); toast('Place removed'); navigate('/explore', true); }} />
    </div>
  );
}

const BRANDLESS_NOTE = 'We never mark a policy as verified on your behalf.';
