import { useEffect, useState } from 'react';
import type { BoxPlan, BoxSize, BoxTheme } from '../contracts/domain';
import { useApp } from '../state';
import { Link, navigate } from '../router';
import { Icon } from '../ui/Icon';
import { Badge, Button, Card, ChoiceGroup, Confirm, EmptyState, IconButton, PageHeader, PetAvatar, Toggle } from '../ui/kit';
import { BOX_SIZES, BOX_THEMES, CADENCES, normalizeRestriction, restrictionsFromAllergies, suggestBoxSize } from '../lib/boxes';
import { newId, nowIso } from '../lib/dates';

const themeName = (t: string) => BOX_THEMES.find((x) => x.id === t)?.name ?? t;
const cadenceName = (c: string) => CADENCES.find((x) => x.id === c)?.name ?? c;
const sizeName = (s: string) => BOX_SIZES.find((x) => x.id === s)?.name ?? s;

function ComingSoon() {
  return (
    <div className="coming-soon">
      <Button disabled aria-describedby="checkout-note">Checkout</Button>
      <p id="checkout-note" className="small muted"><strong>Coming soon.</strong> Box ordering and pricing are not available yet. Your plan is saved so it is ready when they are.</p>
    </div>
  );
}

export function BoxesPage() {
  const { data, db, toast } = useApp();
  const [confirm, setConfirm] = useState<BoxPlan | null>(null);
  const pets = new Map(data.pets.map((p) => [p.id, p]));
  return (
    <div className="page">
      <PageHeader title="Mystery boxes" subtitle="Themed surprises tuned to each pet" backTo="/more" actions={<Link to="/boxes/build" className="btn btn-primary"><Icon name="plus" size={20} /><span>Build a box</span></Link>} />
      {data.boxPlans.length === 0 ? (
        <EmptyState icon="gift" title="No box plans yet" action={<Link to="/boxes/build" className="btn btn-primary">Build your first box</Link>}>
          Pick a pet, a theme and how often. We fill in restrictions from their allergies.
        </EmptyState>
      ) : (
        <ul className="box-list">
          {data.boxPlans.map((b) => {
            const pet = pets.get(b.petId);
            return (
              <li key={b.id}>
                <Card as="article" className={`box-card theme-${b.theme}`}>
                  <div className="box-top">
                    {pet && <PetAvatar pet={pet} size={48} />}
                    <div className="grow">
                      <h2>{themeName(b.theme)}</h2>
                      <p className="muted small">For {pet?.name ?? 'a removed pet'}</p>
                    </div>
                    <Badge tone="accent">Saved plan</Badge>
                  </div>
                  <dl className="facts compact">
                    <div><dt>Cadence</dt><dd>{cadenceName(b.cadence)}</dd></div>
                    <div><dt>Size</dt><dd>{sizeName(b.size)}</dd></div>
                    <div><dt>Contents</dt><dd>{b.toysOnly ? 'Toys only, no edibles' : 'Toys and treats'}</dd></div>
                    <div><dt>Restrictions</dt><dd>{b.restrictions.length ? b.restrictions.map((r) => `No ${r.toLowerCase()}`).join(', ') : 'None'}</dd></div>
                  </dl>
                  <ComingSoon />
                  <div className="row-actions">
                    <Link to={`/boxes/build?plan=${b.id}`} className="btn btn-ghost"><Icon name="edit" size={20} /><span>Edit</span></Link>
                    <Button variant="ghost" icon="trash" onClick={() => setConfirm(b)}>Delete</Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Confirm open={!!confirm} title="Delete this box plan?" onCancel={() => setConfirm(null)} onConfirm={async () => { if (confirm) await db.boxPlans.remove(confirm.id); setConfirm(null); toast('Box plan deleted'); }} />
    </div>
  );
}

export function BoxBuilderPage({ query }: { query: URLSearchParams }) {
  const { data, db, toast } = useApp();
  const existing = data.boxPlans.find((b) => b.id === query.get('plan'));
  const [petId, setPetId] = useState<string>(existing?.petId ?? query.get('pet') ?? data.pets[0]?.id ?? '');
  const [theme, setTheme] = useState<BoxTheme>((existing?.theme as BoxTheme) ?? 'spoiled_rotten');
  const [cadence, setCadence] = useState<BoxPlan['cadence']>(existing?.cadence ?? 'monthly');
  const pet = data.pets.find((p) => p.id === petId);
  const [size, setSize] = useState<BoxSize>(existing?.size ?? suggestBoxSize(pet));
  const [toysOnly, setToysOnly] = useState(existing?.toysOnly ?? false);
  const [restrictions, setRestrictions] = useState<string[]>(existing?.restrictions ?? restrictionsFromAllergies(pet));
  const [newR, setNewR] = useState('');
  const [err, setErr] = useState<string>();

  useEffect(() => {
    if (existing && existing.petId === petId) return;
    setRestrictions(restrictionsFromAllergies(pet));
    setSize(suggestBoxSize(pet));
  }, [petId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data.pets.length) {
    return (
      <div className="page">
        <PageHeader title="Build a box" backTo="/boxes" />
        <EmptyState icon="gift" title="Add a pet first" action={<Link to="/pets?add=1" className="btn btn-primary">Add a pet</Link>}>Boxes are built around a pet profile so we can match size and allergies.</EmptyState>
      </div>
    );
  }

  const addR = () => {
    const r = normalizeRestriction(newR);
    if (r && !restrictions.some((x) => x.toLowerCase() === r.toLowerCase())) setRestrictions([...restrictions, r]);
    setNewR('');
  };

  const save = async () => {
    if (!pet) return setErr('Choose a pet.');
    const now = nowIso();
    const plan: BoxPlan = {
      ...(existing ?? { id: newId('box-'), createdAt: now }),
      householdId: pet.householdId,
      petId: pet.id,
      theme,
      cadence,
      size,
      toysOnly,
      restrictions,
      status: 'saved',
      updatedAt: now,
    } as BoxPlan;
    await db.boxPlans.upsert(plan);
    toast('Box plan saved');
    navigate('/boxes');
  };

  return (
    <div className="page">
      <PageHeader title={existing ? 'Edit box' : 'Build a box'} subtitle="Four quick choices" backTo="/boxes" />
      <Card>
        <h2 className="step-title"><span className="step-num">1</span>Who is it for?</h2>
        <div className="pet-chips" role="radiogroup" aria-label="Pet">
          {data.pets.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={petId === p.id} className={`pet-chip ${petId === p.id ? 'on' : ''}`} onClick={() => { setPetId(p.id); setErr(undefined); }}>
              <PetAvatar pet={p} size={30} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
        {err && <p className="field-error" role="alert">{err}</p>}
      </Card>
      <Card>
        <h2 className="step-title"><span className="step-num">2</span>Pick a theme</h2>
        <div className="theme-grid" role="radiogroup" aria-label="Theme">
          {BOX_THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} className={`theme-tile theme-${t.id} ${theme === t.id ? 'on' : ''}`} onClick={() => setTheme(t.id)}>
              <strong>{t.name}</strong>
              <span className="small">{t.blurb}</span>
              {theme === t.id && <span className="tick"><Icon name="check" size={16} /></span>}
            </button>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="step-title"><span className="step-num">3</span>How often and how big?</h2>
        <ChoiceGroup<BoxPlan['cadence']> label="Cadence" value={cadence} onChange={setCadence} columns={3} options={CADENCES.map((c) => ({ value: c.id, label: c.name }))} />
        <ChoiceGroup<BoxSize> label="Size" value={size} onChange={setSize} columns={3} options={BOX_SIZES.map((s) => ({ value: s.id, label: s.name, hint: s.hint }))} />
      </Card>
      <Card>
        <h2 className="step-title"><span className="step-num">4</span>Contents and restrictions</h2>
        <Toggle label="Toys only" hint="No treats or chews, nothing edible" checked={toysOnly} onChange={setToysOnly} />
        <div className="field">
          <span className="label">Restrictions</span>
          <p className="hint">{pet?.allergies.length ? `Prefilled from ${pet.name}'s allergies. Edit as needed.` : `No allergies on ${pet?.name ?? 'this pet'}'s profile. Add any you want us to avoid.`}</p>
          <div className="chip-row">
            {restrictions.length === 0 && <span className="muted small">None</span>}
            {restrictions.map((r) => (
              <span key={r} className="chip on removable">
                No {r.toLowerCase()}
                <IconButton icon="x" label={`Remove ${r}`} onClick={() => setRestrictions(restrictions.filter((x) => x !== r))} className="chip-x" />
              </span>
            ))}
          </div>
          <div className="inline-add">
            <label htmlFor="new-restriction" className="visually-hidden">Add a restriction</label>
            <input id="new-restriction" value={newR} onChange={(e) => setNewR(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addR(); } }} placeholder="Beef, grain, squeakers" maxLength={40} />
            <Button variant="secondary" icon="plus" onClick={addR}>Add</Button>
          </div>
        </div>
      </Card>
      <Card className="summary">
        <h2>Your box</h2>
        <p><strong>{themeName(theme)}</strong> for {pet?.name ?? 'your pet'} · {cadenceName(cadence)} · {sizeName(size)} · {toysOnly ? 'toys only' : 'toys and treats'}{restrictions.length ? ` · avoiding ${restrictions.join(', ').toLowerCase()}` : ''}</p>
        <div className="row-actions">
          <Button onClick={save} icon="check">Save box plan</Button>
        </div>
        <ComingSoon />
      </Card>
    </div>
  );
}
