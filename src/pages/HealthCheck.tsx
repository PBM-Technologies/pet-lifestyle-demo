import { useState } from 'react';
import type { CareEvent, Pet, PetHealthResult, Species, Urgency } from '../contracts/domain';
import { useApp } from '../state';
import { Link } from '../router';
import { Icon } from '../ui/Icon';
import { Badge, Button, Card, ChoiceGroup, PageHeader, PetAvatar, TextField, Toggle } from '../ui/kit';
import { NoAiNote, PhotoPicker, Thinking, useCheck, useVisionAI, type Photo } from '../ui/photo';
import { cleanHealth, healthPrompt, symptomsFor } from '../ai/prompts';
import { addDays, formatAge, formatDay, isValidDay, newId, nowIso, today } from '../lib/dates';

export const HEALTH_DISCLAIMER = 'This is a photo check, not a diagnosis. When in doubt, call your vet.';

const URGENCY: Record<Urgency, { title: string; body: string; icon: string }> = {
  urgent: { title: 'Urgent: call your vet or an emergency clinic now', body: 'Some signs here can get worse quickly. Do not wait to see if it passes.', icon: 'alert' },
  soon: { title: 'Worth a vet call soon', body: 'Keep a close eye and plan to check in with your vet in the next day or two.', icon: 'clock' },
  routine: { title: 'Looks routine', body: 'Nothing here looks pressing. Keep watching and mention it at the next checkup.', icon: 'check' },
};
const LIKELY_TONE = { likely: 'warning', possible: 'accent', 'less likely': 'neutral' } as const;
const LIKELY_LABEL = { likely: 'Likely', possible: 'Possible', 'less likely': 'Less likely' } as const;

export function HealthCheckPage({ query }: { query: URLSearchParams }) {
  const { data } = useApp();
  const { ai, state, markOff } = useVisionAI();
  const [petId, setPetId] = useState(query.get('pet') ?? '');
  const pet = data.pets.find((p) => p.id === petId);
  const [pickedSpecies, setPickedSpecies] = useState<Species>('dog');
  const species: Species = pet?.species ?? pickedSpecies;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const check = useCheck<PetHealthResult>(ai, markOff);
  const noAi = state === 'none';
  const chips = symptomsFor(species);

  const toggle = (s: string) => { setSymptoms((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s])); check.clear(); };
  const go = () => {
    const ctx = pet ? [pet.breed, pet.birthDate ? `${formatAge(pet.birthDate)} old` : '', pet.weight ? `${pet.weight} ${pet.weightUnit ?? 'lb'}` : '', pet.allergies.length ? `allergies: ${pet.allergies.join(', ')}` : ''].filter(Boolean).join(', ') : '';
    void check.run(healthPrompt(photos.length, species, symptoms.filter((s) => chips.includes(s)), ctx || undefined), photos.map((p) => p.blob), cleanHealth);
  };

  return (
    <div className="page">
      <PageHeader title="Photo health check" subtitle={pet ? `Checking ${pet.name}` : 'Skin, ears, eyes, teeth, lumps and more'} backTo={pet ? `/pets/${pet.id}` : '/care'} />
      {noAi && <NoAiNote />}
      <Card>
        {data.pets.length > 0 && (
          <div className="field">
            <span className="label" id="hc-pet">Which pet?</span>
            <div className="pet-chips" role="group" aria-labelledby="hc-pet">
              {data.pets.map((p) => (
                <button key={p.id} type="button" className={`pet-chip ${petId === p.id ? 'on' : ''}`} aria-pressed={petId === p.id} onClick={() => { setPetId(petId === p.id ? '' : p.id); check.clear(); }}>
                  <PetAvatar pet={p} size={30} /><span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {!pet && (
          <ChoiceGroup<Species> label="Dog or cat?" value={pickedSpecies} columns={2} onChange={(v) => { setPickedSpecies(v); check.clear(); }}
            options={[{ value: 'dog', label: 'Dog' }, { value: 'cat', label: 'Cat' }]} />
        )}
        <PhotoPicker photos={photos} onChange={(p) => { setPhotos(p); check.clear(); }} disabled={noAi || state === 'checking' || check.thinking}
          hint="Up to 3 close photos in good light: the skin, ear, eye, tooth, paw or lump you are worried about." />
        <div className="field">
          <span className="label" id="sym-label">Anything else you noticed? (optional)</span>
          <div className="chip-row" role="group" aria-labelledby="sym-label" style={{ marginBottom: 0 }}>
            {chips.map((s) => (
              <button key={s} type="button" className={`chip ${symptoms.includes(s) ? 'on' : ''}`} aria-pressed={symptoms.includes(s)} onClick={() => toggle(s)}>{s}</button>
            ))}
          </div>
        </div>
        <Button className="block" icon="camera" disabled={noAi || state !== 'ready' || photos.length === 0 || check.thinking} onClick={go}>Check this photo</Button>
      </Card>
      <p className="notice" role="note"><Icon name="alert" size={18} /> <span>Trouble breathing, collapse, heavy bleeding or a possible poisoning? Skip the app and call your vet or an emergency clinic now.</span></p>
      {check.thinking && <Thinking onCancel={check.cancel} />}
      {check.error && <p className="notice" role="alert"><Icon name="alert" size={18} /> <span>{check.error}</span></p>}
      {check.result && <HealthResults r={check.result} pet={pet} />}
      <p className="muted small center" role="note">{HEALTH_DISCLAIMER}</p>
    </div>
  );
}

function HealthResults({ r, pet }: { r: PetHealthResult; pet?: Pet }) {
  const u = URGENCY[r.urgency];
  return (
    <section aria-label="Health check results">
      <div className={`urgency urgency-${r.urgency}`} role="status">
        <Icon name={u.icon} />
        <div>
          <strong>{u.title}</strong>
          <p>{r.summary || u.body}</p>
        </div>
      </div>
      {!r.photoUsable && <p className="notice" role="note"><Icon name="info" size={18} /> <span>The photo was hard to read, so these are rough guesses. A sharper close-up in daylight would help.</span></p>}
      {r.possibleIssues.map((iss, i) => (
        <Card key={i} as="article" className="issue-card">
          <div className="section-head">
            <h3 style={{ margin: 0 }}>{iss.name}</h3>
            <Badge tone={LIKELY_TONE[iss.likelihood]}>{LIKELY_LABEL[iss.likelihood]}</Badge>
          </div>
          {iss.signsSeen && <><h4>What the photo shows</h4><p className="small">{iss.signsSeen}</p></>}
          {iss.checkAtHome.length > 0 && <><h4>Check at home</h4><CheckList items={iss.checkAtHome} /></>}
          {iss.careSteps.length > 0 && <><h4>Care steps</h4><ul className="bullets small">{iss.careSteps.map((s, j) => <li key={j}>{s}</li>)}</ul></>}
        </Card>
      ))}
      {r.seeVetIf.length > 0 && (
        <Card>
          <h2>See a vet if</h2>
          <ul className="bullets small">{r.seeVetIf.map((s, j) => <li key={j}>{s}</li>)}</ul>
          <p className="small muted" style={{ margin: '8px 0 0' }}>Call your vet before giving any medicine, including over the counter or human products. For a possible poisoning, call your vet or an emergency clinic right away; the ASPCA Animal Poison Control Center is another resource.</p>
        </Card>
      )}
      <SaveToCare r={r} pet={pet} />
    </section>
  );
}

function CheckList({ items }: { items: string[] }) {
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  return (
    <ul className="checklist">
      {items.map((t, i) => (
        <li key={i}>
          <button type="button" role="checkbox" aria-checked={done[i]} className={`check as-button ${done[i] ? 'done' : ''}`} onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}>
            <span className="box" aria-hidden="true"><Icon name="check" size={16} /></span>
            <span className="grow small">{t}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SaveToCare({ r, pet }: { r: PetHealthResult; pet?: Pet }) {
  const { db, toast } = useApp();
  const t0 = today();
  const [follow, setFollow] = useState(true);
  const [due, setDue] = useState(addDays(t0, 3));
  const [saved, setSaved] = useState<CareEvent | null>(null);
  const [err, setErr] = useState('');

  if (!pet) return <Card className="summary"><p className="small" style={{ margin: 0 }}>Pick which pet this is at the top to save the result to their care record.</p></Card>;
  if (saved) {
    return (
      <Card className="summary">
        <p style={{ fontWeight: 700, margin: 0 }}>Saved to {pet.name}'s care record{saved.dueDate ? `, follow up ${formatDay(saved.dueDate)}` : ''}.</p>
        <div className="row-actions"><Link to={`/pets/${pet.id}`} className="btn btn-secondary"><span>Open {pet.name}</span><Icon name="chevron" size={18} /></Link></div>
      </Card>
    );
  }
  const save = async () => {
    if (follow && (!isValidDay(due) || due < t0)) return setErr('Pick a follow-up date from today on.');
    const now = nowIso();
    const issues = r.possibleIssues.map((i) => `${i.name} (${LIKELY_LABEL[i.likelihood].toLowerCase()})`).join(', ');
    const notes = [`Photo check, ${URGENCY[r.urgency].title.split(':')[0].toLowerCase()}.`, r.summary, issues ? `Possible: ${issues}.` : '', 'Not a diagnosis.'].filter(Boolean).join(' ').slice(0, 1000);
    const ev: CareEvent = {
      id: newId('care-'), householdId: pet.householdId, petId: pet.id, type: 'note', title: 'Photo health check', date: t0, dueDate: follow ? due : undefined, notes, createdAt: now, updatedAt: now,
    };
    await db.careEvents.upsert(ev);
    setSaved(ev);
    toast('Saved to care record');
  };
  return (
    <Card>
      <h2>Save to care record</h2>
      <p className="small muted">Adds a care note for {pet.name} dated today with this summary.</p>
      <Toggle label="Remind me to follow up" checked={follow} onChange={setFollow} hint="Shows in Coming up for care" />
      {follow && <TextField label="Follow-up date" type="date" value={due} onChange={(v) => { setDue(v); setErr(''); }} error={err || undefined} />}
      <Button icon="note" onClick={save}>Save to care record</Button>
    </Card>
  );
}
