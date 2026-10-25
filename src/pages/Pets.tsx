import { useMemo, useState } from 'react';
import type { CareEvent, CareEventType, Pet } from '../contracts/domain';
import { useApp } from '../state';
import { Link, navigate } from '../router';
import { Icon } from '../ui/Icon';
import { Badge, Button, Card, Confirm, EmptyState, LineChart, PageHeader, PetAvatar, PhotoInput, SampleBadge, Sheet, TextField } from '../ui/kit';
import { CARE_TYPE_LABEL, completeCareEvent, dueStatus, weightSeries } from '../lib/care';
import { formatAge, formatDay, newId, nowIso, relativeDay } from '../lib/dates';
import { loadSamplePets, removePet } from '../data/db';
import { PetFormSheet } from './PetForm';
import { CareFormSheet } from './CareForm';
import { FoodCard } from './Food';

const SPECIES_LABEL = { dog: 'Dog', cat: 'Cat', other: 'Pet' } as const;

export function PetsPage() {
  const { data, db, toast } = useApp();
  const [adding, setAdding] = useState(() => location.hash.includes('add=1'));
  const close = () => { setAdding(false); if (location.hash.includes('add=1')) navigate('/pets', true); };
  return (
    <div className="page">
      <PageHeader title="Pets" subtitle="Profiles, care and records" actions={<Button icon="plus" onClick={() => setAdding(true)}>Add pet</Button>} />
      {data.pets.length === 0 ? (
        <EmptyState title="No pets yet" action={<div className="row-actions center"><Button icon="plus" onClick={() => setAdding(true)}>Add a pet</Button><Button variant="secondary" onClick={async () => { if (data.household) { await loadSamplePets(db, data.household.id); toast('Sample pets loaded'); } }}>Load sample pets</Button></div>}>
          Dogs, cats and every other kind of companion are welcome.
        </EmptyState>
      ) : (
        <ul className="pet-list">
          {data.pets.map((p) => {
            const open = data.care.filter((c) => c.petId === p.id && ['overdue', 'due_soon'].includes(dueStatus(c)));
            return (
              <li key={p.id}>
                <Link to={`/pets/${p.id}`} className="card pet-card">
                  <PetAvatar pet={p} size={64} />
                  <span className="grow">
                    <strong className="pet-name">{p.name} {p.isSample && <SampleBadge />}</strong>
                    <span className="muted small block">{[p.breed || SPECIES_LABEL[p.species], formatAge(p.birthDate), p.weight ? `${p.weight} ${p.weightUnit ?? 'lb'}` : ''].filter(Boolean).join(' · ')}</span>
                    {open.length > 0 && <Badge tone={open.some((c) => dueStatus(c) === 'overdue') ? 'danger' : 'warning'}>{open.length} due soon</Badge>}
                  </span>
                  <Icon name="chevron" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="small"><Link to="/care" className="text-link">See care schedule for all pets</Link></p>
      {adding && <PetFormSheet open onClose={close} onSaved={(p) => navigate(`/pets/${p.id}`, true)} />}
    </div>
  );
}

const SECTIONS: Array<{ id: string; label: string; types: CareEventType[]; icon: string }> = [
  { id: 'vaccines', label: 'Vaccines', types: ['vaccine'], icon: 'syringe' },
  { id: 'meds', label: 'Meds and preventives', types: ['medication', 'flea_tick', 'heartworm'], icon: 'pill' },
  { id: 'visits', label: 'Vet visits and grooming', types: ['vet_visit', 'grooming'], icon: 'cross' },
  { id: 'journal', label: 'Care journal', types: ['note'], icon: 'note' },
];

export function PetDetailPage({ petId }: { petId: string }) {
  const { data, db, toast } = useApp();
  const pet = data.pets.find((p) => p.id === petId);
  const [editing, setEditing] = useState(false);
  const [careType, setCareType] = useState<CareEventType | null>(null);
  const [editEvent, setEditEvent] = useState<CareEvent | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [tab, setTab] = useState<'care' | 'profile' | 'docs'>('care');

  const care = useMemo(() => data.care.filter((c) => c.petId === petId), [data.care, petId]);
  const docs = data.documents.filter((d) => d.petId === petId);

  if (!pet) return <div className="page"><PageHeader title="Pet not found" backTo="/pets" /><EmptyState title="This pet is not here">It may have been removed. <Link to="/pets" className="text-link">Back to pets</Link></EmptyState></div>;

  const weights = weightSeries(care, pet.id);
  const upcoming = care.filter((c) => ['overdue', 'due_soon'].includes(dueStatus(c))).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

  const markDone = async (e: CareEvent) => {
    const { done, next } = completeCareEvent(e);
    await db.careEvents.upsert(done);
    if (next) await db.careEvents.upsert({ ...next, id: newId('care-') });
    toast(next ? `Done. Next due ${formatDay(next.dueDate)}` : 'Marked done');
  };

  return (
    <div className="page">
      <PageHeader title={pet.name} backTo="/pets" actions={<Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>Edit</Button>} />
      <Card className="pet-hero">
        <PetAvatar pet={pet} size={96} />
        <div>
          <p className="pet-hero-line">{pet.breed || SPECIES_LABEL[pet.species]} {pet.isSample && <SampleBadge />}</p>
          <p className="muted">{formatAge(pet.birthDate)}{pet.birthDate ? ` · born ${formatDay(pet.birthDate)}` : ''}</p>
          {pet.weight && <p className="muted">{pet.weight} {pet.weightUnit ?? 'lb'}</p>}
          {pet.allergies.length > 0 && <p className="allergy"><Icon name="alert" size={16} /> Allergies: {pet.allergies.join(', ')}</p>}
        </div>
      </Card>

      <FoodCard pet={pet} />

      <div className="seg" role="tablist" aria-label="Pet sections">
        {(['care', 'profile', 'docs'] as const).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'care' ? 'Care' : t === 'profile' ? 'Profile' : `Documents${docs.length ? ` (${docs.length})` : ''}`}
          </button>
        ))}
      </div>

      {tab === 'care' && (
        <>
          <div className="chip-row add-care">
            {(['vaccine', 'medication', 'flea_tick', 'vet_visit', 'grooming', 'weight', 'note'] as CareEventType[]).map((t) => (
              <button key={t} type="button" className="chip" onClick={() => setCareType(t)}><Icon name="plus" size={16} />{CARE_TYPE_LABEL[t]}</button>
            ))}
          </div>

          {upcoming.length > 0 && (
            <Card className="due-card">
              <h2>Due soon</h2>
              <ul className="list">
                {upcoming.map((e) => {
                  const s = dueStatus(e);
                  return (
                    <li key={e.id} className="list-row">
                      <span className="grow">
                        <strong>{e.title}</strong>
                        <span className="muted small block">{CARE_TYPE_LABEL[e.type]} · due {formatDay(e.dueDate)}</span>
                      </span>
                      <Badge tone={s === 'overdue' ? 'danger' : 'warning'}>{s === 'overdue' ? 'Overdue' : relativeDay(e.dueDate as string)}</Badge>
                      <Button variant="secondary" icon="check" onClick={() => markDone(e)} aria-label={`Mark ${e.title} done`}>Done</Button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {SECTIONS.map((s) => {
            const items = care.filter((c) => s.types.includes(c.type)).sort((a, b) => b.date.localeCompare(a.date));
            return (
              <Card key={s.id}>
                <div className="mini-head"><Icon name={s.icon} /><h2>{s.label}</h2></div>
                {items.length === 0 ? (
                  <p className="muted small">None recorded yet.</p>
                ) : (
                  <ul className="list">
                    {items.map((e) => {
                      const st = dueStatus(e);
                      return (
                        <li key={e.id}>
                          <button type="button" className="list-row as-button" onClick={() => setEditEvent(e)}>
                            <span className="grow">
                              <strong>{e.title}</strong>
                              <span className="muted small block">
                                {formatDay(e.date)}
                                {e.dueDate ? ` · next due ${formatDay(e.dueDate)}` : ''}
                                {e.repeatDays ? ` · every ${e.repeatDays} days` : ''}
                              </span>
                              {e.notes && <span className="small block">{e.notes}</span>}
                            </span>
                            {st === 'done' && <Badge tone="success">Done</Badge>}
                            {st === 'overdue' && <Badge tone="danger">Overdue</Badge>}
                            {st === 'due_soon' && <Badge tone="warning">Due soon</Badge>}
                            {e.isSample && <SampleBadge />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
          })}

          <Card>
            <div className="mini-head"><Icon name="scale" /><h2>Weight history</h2></div>
            <LineChart points={weights} unit={pet.weightUnit ?? 'lb'} label={`${pet.name} weight`} />
            {weights.length > 0 && (
              <ul className="list compact">
                {[...care.filter((c) => c.type === 'weight')].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((w) => (
                  <li key={w.id}><button type="button" className="list-row as-button" onClick={() => setEditEvent(w)}><span className="grow">{formatDay(w.date)}</span><strong>{w.value} {pet.weightUnit ?? 'lb'}</strong></button></li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {tab === 'profile' && (
        <Card>
          <dl className="facts">
            <div><dt>Species</dt><dd>{SPECIES_LABEL[pet.species]}</dd></div>
            <div><dt>Breed</dt><dd>{pet.breed || 'Not set'}</dd></div>
            <div><dt>Birth date</dt><dd>{pet.birthDate ? formatDay(pet.birthDate) : 'Not set'}</dd></div>
            <div><dt>Weight</dt><dd>{pet.weight ? `${pet.weight} ${pet.weightUnit ?? 'lb'}` : 'Not set'}</dd></div>
            <div><dt>Allergies</dt><dd>{pet.allergies.length ? pet.allergies.join(', ') : 'None listed'}</dd></div>
            <div><dt>Diet notes</dt><dd>{pet.dietaryNotes || 'None'}</dd></div>
            <div><dt>Microchip</dt><dd>{pet.microchip || 'Not saved'}</dd></div>
            <div><dt>Vet</dt><dd>{pet.vetName || 'Not set'}{pet.vetPhone && <> · <a href={`tel:${pet.vetPhone.replace(/[^0-9+]/g, '')}`} className="text-link">{pet.vetPhone}</a></>}</dd></div>
          </dl>
          <div className="row-actions">
            <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>Edit profile</Button>
            <Link to={`/boxes/build?pet=${pet.id}`} className="btn btn-secondary"><Icon name="gift" size={20} /><span>Build a box</span></Link>
            <Button variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>Delete pet</Button>
          </div>
        </Card>
      )}

      {tab === 'docs' && (
        <Card>
          <div className="section-head"><h2>Documents</h2><Button icon="plus" variant="secondary" onClick={() => setDocOpen(true)}>Add</Button></div>
          <p className="muted small">Keep photos of vaccine certificates, adoption papers or insurance cards. Stored only on this device.</p>
          {docs.length === 0 ? <p className="muted">No documents yet.</p> : (
            <ul className="doc-grid">
              {docs.map((d) => (
                <li key={d.id} className="doc">
                  {d.image ? <img src={d.image} alt={d.name} /> : <div className="doc-ph"><Icon name="doc" size={28} /></div>}
                  <span className="small">{d.name}</span>
                  <button type="button" className="icon-btn small-btn" aria-label={`Delete ${d.name}`} onClick={async () => { await db.documents.remove(d.id); toast('Document removed'); }}><Icon name="trash" size={18} /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {editing && <PetFormSheet open pet={pet} onClose={() => setEditing(false)} />}
      {careType && <CareFormSheet open pet={pet} initialType={careType} onClose={() => setCareType(null)} />}
      {editEvent && <CareEditSheet event={editEvent} pet={pet} onClose={() => setEditEvent(null)} />}
      {docOpen && <DocSheet pet={pet} onClose={() => setDocOpen(false)} />}
      <Confirm open={confirmDelete} title={`Delete ${pet.name}?`} body="This removes the profile, care records, food and treats, documents and box plans for this pet from this device." onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => { await removePet(db, pet.id); setConfirmDelete(false); toast(`${pet.name} deleted`); navigate('/pets', true); }} />
    </div>
  );
}

function CareEditSheet({ event, pet, onClose }: { event: CareEvent; pet: Pet; onClose: () => void }) {
  const { db, toast } = useApp();
  const [mode, setMode] = useState<'menu' | 'edit' | 'confirm'>('menu');
  if (mode === 'edit') return <CareFormSheet open pet={pet} event={event} onClose={onClose} />;
  return (
    <>
      <Sheet open={mode === 'menu'} title={event.title} onClose={onClose}>
        <p className="muted">{CARE_TYPE_LABEL[event.type]} · {formatDay(event.date)}{event.dueDate ? ` · next due ${formatDay(event.dueDate)}` : ''}</p>
        {event.notes && <p>{event.notes}</p>}
        <div className="stack">
          <Button variant="secondary" icon="edit" onClick={() => setMode('edit')}>Edit</Button>
          {event.dueDate && !event.completedAt && <Button variant="secondary" icon="check" onClick={async () => { const { done, next } = completeCareEvent(event); await db.careEvents.upsert(done); if (next) await db.careEvents.upsert({ ...next, id: newId('care-') }); toast('Marked done'); onClose(); }}>Mark done</Button>}
          <Button variant="danger" icon="trash" onClick={() => setMode('confirm')}>Delete</Button>
        </div>
      </Sheet>
      <Confirm open={mode === 'confirm'} title="Delete this record?" onCancel={() => setMode('menu')} onConfirm={async () => { await db.careEvents.remove(event.id); toast('Record deleted'); onClose(); }} />
    </>
  );
}

function DocSheet({ pet, onClose }: { pet: Pet; onClose: () => void }) {
  const { db, toast } = useApp();
  const [name, setName] = useState('');
  const [image, setImage] = useState<string>();
  const [err, setErr] = useState<string>();
  const save = async () => {
    if (!name.trim()) return setErr('Give the document a name.');
    const now = nowIso();
    try {
      await db.documents.upsert({ id: newId('doc-'), householdId: pet.householdId, petId: pet.id, name: name.trim(), image, createdAt: now, updatedAt: now });
      toast('Document saved');
      onClose();
    } catch {
      setErr('Could not save. Storage may be full.');
    }
  };
  return (
    <Sheet open title="Add document" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <TextField label="Name" value={name} onChange={(v) => { setName(v); setErr(undefined); }} placeholder="Rabies certificate 2026" error={err} />
        <PhotoInput label="Image (optional)" value={image} onChange={setImage} maxSide={1200} />
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
