import { useMemo, useState } from 'react';
import type { OtherKind, Pet, PetPlate, PlateItem, PlateUnit, Species } from '../contracts/domain';
import { BRAND } from '../config/brand';
import { useApp } from '../state';
import { Link, navigate } from '../router';
import { Icon } from '../ui/Icon';
import { Badge, Button, Card, ChoiceGroup, EmptyState, PageHeader, PetAvatar, SampleBadge, TextField } from '../ui/kit';
import { FOOD_TYPE_BY_ID, GOOD_FOR_LABEL, OTHER_KINDS, ROLE_LABEL, SPECIES_NOTE, foodTypesFor, type FoodRole, type FoodType } from '../content/foodTypes';
import {
  BASE_MIN, CALORIE_NOTE, PLATE_UNITS, STAGE_LABEL, TREAT_CAP, UNIT_WORDS, baseOf, canStep, dailyAmount, dailyCalories, makeBase, orderedItems, otherKindFor, partnersForType,
  planUseOfPlate, plateSpecies, plateSummary, stepShare, suggestPlate, toggleType, treatTotal, unitAmount, type PlateChange,
} from '../lib/plate';
import { mainFood } from '../lib/feeding';
import { timesWord } from '../lib/food';
import { formatAge, formatDay, newId, nowIso } from '../lib/dates';

/** Segment colors, all from theme tokens so light and dark both work. */
const SEG_COLORS = [
  'var(--c-primary)',
  'var(--c-accent)',
  'var(--c-success)',
  'var(--c-warning)',
  'color-mix(in srgb, var(--c-primary) 45%, var(--c-surface))',
  'color-mix(in srgb, var(--c-accent) 50%, var(--c-surface))',
  'var(--c-text-muted)',
];

const typeName = (id: string) => FOOD_TYPE_BY_ID.get(id)?.name ?? id;

function colorMap(items: PlateItem[]): Map<string, string> {
  return new Map(orderedItems(items).filter((i) => i.share > 0).map((i, k) => [i.typeId, SEG_COLORS[k % SEG_COLORS.length]]));
}

/** The plate: a donut split into colored segments by share. */
export function PlateChart({ items, size = 200, center }: { items: PlateItem[]; size?: number; center?: string }) {
  const r = 70, C = 2 * Math.PI * r;
  const colors = colorMap(items);
  const segs = orderedItems(items).filter((i) => i.share > 0);
  let cum = 0;
  return (
    <svg className="plate-svg" viewBox="0 0 200 200" width={size} height={size} role="img"
      aria-label={`Daily plate: ${segs.map((s) => `${typeName(s.typeId)} ${s.share} percent`).join(', ') || 'empty'}`}>
      <circle cx="100" cy="100" r="97" className="plate-rim" />
      <circle cx="100" cy="100" r="89" className="plate-dish" />
      <circle cx="100" cy="100" r={r} className="plate-track" />
      {segs.map((s) => {
        const len = (C * s.share) / 100;
        const el = (
          <circle key={s.typeId} className="plate-seg" data-type={s.typeId} data-share={s.share} cx="100" cy="100" r={r}
            style={{ stroke: colors.get(s.typeId) }} strokeDasharray={`${Math.max(0, len - (segs.length > 1 ? 2 : 0))} ${C}`} strokeDashoffset={-((C * cum) / 100)} transform="rotate(-90 100 100)" />
        );
        cum += s.share;
        return el;
      })}
      {center && <text x="100" y="106" textAnchor="middle" className="plate-center">{center}</text>}
    </svg>
  );
}

/* ---------- /plate ---------- */

export function PlateStartPage() {
  const { data } = useApp();
  const [species, setSpecies] = useState<Species | null>(null);
  return (
    <div className="page">
      <PageHeader title="Create a plate" subtitle="Build a daily plate from food types, with suggestions for your pet" backTo="/more" />
      {data.pets.length > 0 && (
        <Card>
          <h2>Who is it for?</h2>
          <ul className="list">
            {data.pets.map((p) => {
              const saved = data.plates.find((x) => x.petId === p.id);
              return (
                <li key={p.id}>
                  <Link to={`/plate/${p.id}`} className="list-row">
                    <PetAvatar pet={p} size={44} />
                    <span className="grow"><strong>{p.name}</strong><span className="muted small block">{saved ? plateSummary(saved.items) : 'No plate yet'}</span></span>
                    <Icon name="chevron" size={18} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Card>
        <h2>{data.pets.length ? 'Or just explore by species' : 'Explore by species'}</h2>
        <ChoiceGroup<Species> label="Species" value={species} columns={3} onChange={(s) => { setSpecies(s); navigate(`/plate/species/${s}`); }}
          options={[{ value: 'dog', label: 'Dog' }, { value: 'cat', label: 'Cat' }, { value: 'other', label: 'Other' }]} />
        <p className="muted small">Add a pet to save a plate and get calorie estimates.</p>
      </Card>
    </div>
  );
}

export function PlateSpeciesPage({ species }: { species: string }) {
  const sp: Species = species === 'cat' || species === 'other' ? species : 'dog';
  return <PlateBuilder species={sp} />;
}

export function PlatePetPage({ petId }: { petId: string }) {
  const { data } = useApp();
  const pet = data.pets.find((p) => p.id === petId);
  if (!pet) return <div className="page"><PageHeader title="Create a plate" backTo="/plate" /><EmptyState title="This pet is not here">It may have been removed. <Link to="/plate" className="text-link">Pick another pet</Link></EmptyState></div>;
  return <PlateBuilder key={pet.id} pet={pet} species={pet.species} />;
}

/* ---------- builder ---------- */

function PlateBuilder({ pet, species }: { pet?: Pet; species: Species }) {
  const { data, db, toast } = useApp();
  const saved = pet ? data.plates.find((x) => x.petId === pet.id) : undefined;
  const [otherKind, setOtherKind] = useState<OtherKind | undefined>(saved?.otherKind ?? (species === 'other' ? otherKindFor(pet?.breed) : undefined));
  const petFoods = pet ? data.food.filter((f) => f.petId === pet.id) : [];
  const suggestion = useMemo(() => suggestPlate({
    species, otherKind, birthDate: pet?.birthDate, breed: pet?.breed, weight: pet?.weight, weightUnit: pet?.weightUnit, activity: pet?.activity, bodyCondition: pet?.bodyCondition,
    neutered: pet?.neutered, dailyCalorieTarget: pet?.dailyCalorieTarget, allergies: pet?.allergies, dietaryNotes: pet?.dietaryNotes, currentFoods: petFoods,
  }), [species, otherKind, pet, data.food]); // eslint-disable-line react-hooks/exhaustive-deps
  const [items, setItems] = useState<PlateItem[]>(saved?.items ?? suggestion.items);
  const [message, setMessage] = useState<string>();
  const [changes, setChanges] = useState<PlateChange[] | null>(null);
  const [openDetails, setOpenDetails] = useState<string | null>(null);
  const fs = plateSpecies(species, otherKind);
  const types = fs ? foodTypesFor(fs) : [];
  const suggested = new Map([...(suggestion.base ? [suggestion.base] : []), ...suggestion.addOns].map((s) => [s.typeId, s.reasons]));
  const cal = pet ? dailyCalories(pet) : null;
  const main = pet ? mainFood(data.food, pet.id, data.switchPlans) : undefined;
  const times = main?.timesPerDay ?? 2;
  const base = baseOf(items);
  const colors = colorMap(items);
  const treats = treatTotal(items);
  const stage = suggestion.stage;
  const dirty = JSON.stringify(items) !== JSON.stringify(saved?.items ?? null);

  const apply = (r: { items: PlateItem[]; message?: string }) => { setItems(r.items); setMessage(r.message); setChanges(null); };
  const patchItem = (typeId: string, patch: Partial<PlateItem>) => setItems(items.map((i) => (i.typeId === typeId ? { ...i, ...patch } : i)));
  const setPetField = async (patch: Partial<Pet>) => { if (pet) { await db.pets.upsert({ ...pet, ...patch, updatedAt: nowIso() }); } };

  const record = (): PetPlate | null => {
    if (!pet) return null;
    const now = nowIso();
    return {
      ...(saved ?? { id: `plate-${pet.id}`, createdAt: now, householdId: pet.householdId, petId: pet.id }),
      otherKind: species === 'other' ? otherKind : undefined, items, kcalTarget: cal?.kcal, kcalSource: cal ? cal.source : 'none', savedAt: now, updatedAt: now, isSample: false,
    } as PetPlate;
  };
  const save = async () => {
    const rec = record();
    if (!rec) return;
    if (!base) { setMessage('Pick a base food before saving.'); return; }
    await db.plates.upsert(rec);
    toast('Plate saved');
  };
  const review = () => {
    if (!pet) return;
    if (!base) { setMessage('Pick a base food first.'); return; }
    setChanges(planUseOfPlate({ plate: { items, kcalTarget: cal?.kcal }, pet, foods: data.food, plans: data.switchPlans, now: nowIso(), makeId: () => newId('food-') }));
    setTimeout(() => document.getElementById('use-plate')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
  };
  const confirmUse = async () => {
    if (!pet || !changes) return;
    const rec = record();
    if (rec) await db.plates.upsert(rec);
    for (const c of changes) if (c.item) await db.petFood.upsert(c.item);
    const n = changes.filter((c) => c.item).length;
    toast(`Plate saved. ${n} food tracker item${n === 1 ? '' : 's'} updated`);
    navigate(`/pets/${pet.id}`);
  };

  return (
    <div className="page plate-page">
      <PageHeader title="Create a plate" subtitle={pet ? `${pet.name}'s daily plate` : `For a ${species === 'other' ? 'pet' : species}`} backTo={pet ? `/pets/${pet.id}` : '/plate'} />

      <Card className="plate-about">
        <div className="plate-about-head">
          {pet ? <PetAvatar pet={pet} size={48} /> : null}
          <div className="grow">
            <strong>{pet?.name ?? (species === 'dog' ? 'Dog' : species === 'cat' ? 'Cat' : 'Other pet')}</strong> {saved?.isSample && <SampleBadge />}
            <span className="muted small block">
              {[stage ? STAGE_LABEL[species][stage] : null, pet?.birthDate ? formatAge(pet.birthDate) : null, pet?.weight ? `${pet.weight} ${pet.weightUnit ?? 'lb'}` : null, pet?.allergies.length ? `allergic to ${pet.allergies.join(', ').toLowerCase()}` : null].filter(Boolean).join(' · ') || 'Add age and weight on the pet profile for better suggestions'}
            </span>
          </div>
        </div>
        {species === 'other' && (
          <ChoiceGroup<OtherKind> label="What kind of pet?" value={otherKind ?? null} columns={2} onChange={(k) => { setOtherKind(k); const s = suggestPlate({ species, otherKind: k }); setItems(s.items); setMessage(undefined); }}
            options={OTHER_KINDS.map((k) => ({ value: k.id, label: k.label }))} />
        )}
        {pet && (species === 'dog' || species === 'cat') && (
          <div className="plate-facts">
            <ChoiceGroup<NonNullable<Pet['activity']>> label="Activity" value={pet.activity ?? null} columns={3} onChange={(v) => setPetField({ activity: pet.activity === v ? undefined : v })}
              options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }]} />
            <ChoiceGroup<NonNullable<Pet['bodyCondition']>> label="Body shape" value={pet.bodyCondition ?? null} columns={3} onChange={(v) => setPetField({ bodyCondition: pet.bodyCondition === v ? undefined : v })}
              options={[{ value: 'under', label: 'Thin' }, { value: 'ideal', label: 'Just right' }, { value: 'over', label: 'Heavy' }]} />
            <ChoiceGroup<'yes' | 'no'> label="Spayed or neutered" value={pet.neutered === true ? 'yes' : pet.neutered === false ? 'no' : null} columns={2}
              onChange={(v) => setPetField({ neutered: (pet.neutered === true ? 'yes' : pet.neutered === false ? 'no' : null) === v ? undefined : v === 'yes' })}
              options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          </div>
        )}
        {(species === 'dog' || species === 'cat') && (
          <div className="kcal-box" data-testid="kcal-box">
            <Icon name="info" size={18} />
            {cal ? (
              <p>
                <strong>About {cal.kcal.toLocaleString()} calories a day</strong>
                {cal.source === 'vet'
                  ? <span className="block small">Using {pet?.name}'s daily calorie target from the treat budget{pet?.isSample ? ' (sample value)' : ''}.</span>
                  : <span className="block small">{CALORIE_NOTE} <span className="muted">Based on resting energy of about {cal.rer} kcal times {cal.factor} for {/^[aeiou]/.test(cal.factorLabel ?? '') ? 'an' : 'a'} {cal.factorLabel}.</span></span>}
              </p>
            ) : <p className="small">{pet ? `Add ${pet.name}'s weight on the profile to see a daily calorie estimate.` : 'Calorie estimates need a pet with a weight.'}</p>}
          </div>
        )}
        {fs && <p className="muted small" style={{ margin: '10px 0 0' }}>{SPECIES_NOTE[fs]}</p>}
        {suggestion.notes.map((n) => <p key={n} className="allergy small" style={{ margin: '8px 0 0' }}><Icon name="alert" size={16} /> {n}</p>)}
      </Card>

      {fs && (
        <Card className="plate-card">
          <div className="section-head">
            <div className="mini-head"><Icon name="plate" /><h2>Daily plate</h2></div>
            {saved && <span className="small muted">Saved {formatDay(saved.savedAt.slice(0, 10))}</span>}
          </div>
          <div className="plate-visual">
            <PlateChart items={items} center={base ? `${base.share}% base` : 'Pick a base'} />
            <ul className="plate-legend" aria-label="Plate shares">
              {orderedItems(items).filter((i) => i.share > 0).map((i) => (
                <li key={i.typeId}><span className="swatch" style={{ background: colors.get(i.typeId) }} aria-hidden="true" /><span className="grow">{typeName(i.typeId)}</span><strong data-testid={`share-${i.typeId}`}>{i.share}%</strong></li>
              ))}
            </ul>
          </div>
          {treats > 0 && <p className="muted small">Treats: {treats}% of the plate. Keep treats at {TREAT_CAP}% or less of daily calories.</p>}
          {message && <p className="estimate warn small" role="status"><Icon name="info" size={18} /> <span>{message}</span></p>}
          {!base && <p className="estimate warn small" role="status"><Icon name="info" size={18} /> <span>Pick a base food below. It should be at least {BASE_MIN}% of the plate.</span></p>}

          <ul className="plate-items" aria-label="On the plate">
            {orderedItems(items).map((i) => {
              const t = FOOD_TYPE_BY_ID.get(i.typeId);
              if (!t) return null;
              const unit = i.unit ?? t.unit;
              const amt = dailyAmount(i, cal?.kcal, times);
              const open = openDetails === i.typeId;
              return (
                <li key={i.typeId} className="plate-item" data-testid={`plate-item-${i.typeId}`}>
                  <div className="plate-item-top">
                    <span className="swatch" style={{ background: colors.get(i.typeId) ?? 'transparent' }} aria-hidden="true" />
                    <span className="grow">
                      <strong>{t.name}</strong>
                      <span className="badges" style={{ marginTop: 2 }}>
                        {i.base && <Badge tone="accent">Base</Badge>}
                        {t.role === 'treat' && <Badge>Treat</Badge>}
                        {suggested.has(i.typeId) && <Badge tone="success">Suggested</Badge>}
                      </span>
                      {(i.brand || i.product) && <span className="small block">{[i.brand, i.product].filter(Boolean).join(' ')}</span>}
                    </span>
                    <button type="button" className="icon-btn" aria-label={`Remove ${t.name}`} onClick={() => apply(toggleType(items, i.typeId))}><Icon name="x" size={18} /></button>
                  </div>
                  {t.role === 'supplement' ? (
                    <p className="muted small plate-line">Not part of the calorie split. {t.askVet ? 'Ask your vet first.' : ''}</p>
                  ) : i.base ? (
                    <p className="small plate-line"><strong>{i.share}%</strong> <span className="muted">the base gets what the add-ons leave, at least {BASE_MIN}%</span></p>
                  ) : (
                    <div className="plate-step">
                      <div className="stepper" role="group" aria-label={`${t.name} share`}>
                        <button type="button" className="stepper-btn" aria-label={`Less ${t.name}`} disabled={!canStep(items, i.typeId, -5)} onClick={() => apply(stepShare(items, i.typeId, -5))}><span aria-hidden="true">-</span></button>
                        <output className="stepper-value" aria-live="polite">{i.share}%</output>
                        <button type="button" className="stepper-btn" aria-label={`More ${t.name}`} onClick={() => apply(stepShare(items, i.typeId, 5))} aria-disabled={!canStep(items, i.typeId, 5)}><Icon name="plus" size={20} /></button>
                      </div>
                      {t.role === 'base' && <Button variant="ghost" onClick={() => apply({ items: makeBase(items, i.typeId) })}>Make base</Button>}
                    </div>
                  )}
                  {suggested.has(i.typeId) && <p className="small plate-reason">{suggested.get(i.typeId)!.join('. ')}.</p>}
                  {amt && <p className="small plate-amount" data-testid={`amount-${i.typeId}`}><Icon name="clock" size={16} /> About {unitAmount(amt.perDay, unit)} a day{t.role === 'treat' ? '' : `, ${unitAmount(amt.perFeeding, unit)} per feeding (${timesWord(times)})`} · {amt.kcal} kcal</p>}
                  {t.role !== 'supplement' && (
                    <button type="button" className="text-link plate-more" aria-expanded={open} onClick={() => setOpenDetails(open ? null : i.typeId)}>
                      {open ? 'Hide brand and calories' : i.kcalPerUnit ? 'Edit brand and calories' : 'Add brand and calories (optional)'}
                    </button>
                  )}
                  {open && (
                    <div className="plate-fields">
                      <div className="field-row">
                        <TextField label="Brand" value={i.brand ?? ''} onChange={(v) => patchItem(i.typeId, { brand: v || undefined })} maxLength={80} />
                        <TextField label="Product" value={i.product ?? ''} onChange={(v) => patchItem(i.typeId, { product: v || undefined })} maxLength={120} />
                      </div>
                      <ChoiceGroup<PlateUnit> label="Calories are per" value={unit} columns={3} onChange={(u) => patchItem(i.typeId, { unit: u })} options={PLATE_UNITS.map((u) => ({ value: u, label: UNIT_WORDS[u][0] }))} />
                      <TextField label={`Calories per ${UNIT_WORDS[unit][0]} (kcal)`} value={i.kcalPerUnit ? String(i.kcalPerUnit) : ''} inputMode="decimal" maxLength={6}
                        onChange={(v) => { const n = Number(v); patchItem(i.typeId, { kcalPerUnit: v.trim() && n > 0 && n < 10000 ? n : undefined }); }}
                        hint={cal ? 'From the package label. Used to work out daily amounts.' : 'From the package. Daily amounts need a calorie estimate too.'} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {pet ? (
            <div className="row-actions sticky-actions">
              <Button variant="secondary" icon="check" onClick={save} disabled={!base}>{dirty || !saved ? 'Save plate' : 'Saved'}</Button>
              <Button onClick={review} disabled={!base}>Use this plate</Button>
            </div>
          ) : <p className="muted small">Add a pet to save this plate or send it to the food tracker.</p>}
        </Card>
      )}

      {changes && pet && (
        <Card className="use-plate">
          <div id="use-plate" />
          <h2>Use this plate for {pet.name}?</h2>
          <p className="muted small">These changes go to {pet.name}'s food tracker. Nothing is bought or ordered.</p>
          <ul className="bullets" aria-label="Changes">{changes.map((c) => <li key={c.text}>{c.text}</li>)}</ul>
          {main && changes.some((c) => c.action === 'create' && c.item?.kind === 'food' && c.item.fromPlate === base?.typeId) && (
            <p className="small estimate"><Icon name="info" size={18} /> <span>Changing foods? Use Switch to a new food on the food card to move over slowly.</span></p>
          )}
          <div className="row-actions">
            <Button variant="secondary" onClick={() => setChanges(null)}>Not now</Button>
            <Button icon="check" onClick={confirmUse}>Confirm</Button>
          </div>
        </Card>
      )}

      {fs && (['base', 'addon', 'treat', 'supplement'] as FoodRole[]).map((role) => {
        const list = types.filter((t) => t.role === role);
        if (!list.length) return null;
        return (
          <section key={role} className="type-section" aria-labelledby={`role-${role}`}>
            <h2 className="list-title" id={`role-${role}`}>{ROLE_LABEL[role]}{role === 'supplement' ? ' (ask your vet)' : ''}</h2>
            <ul className="type-grid">
              {list.map((t) => <TypeCard key={t.id} type={t} on={items.some((i) => i.typeId === t.id)} reasons={suggested.get(t.id)} young={species === 'cat' ? 'Kitten' : species === 'dog' ? 'Puppy' : 'Young'} onToggle={() => apply(toggleType(items, t.id))} />)}
            </ul>
          </section>
        );
      })}
      <p className="muted small center">General guidance, not veterinary advice. Your vet knows your pet best.</p>
    </div>
  );
}

function TypeCard({ type: t, on, reasons, young, onToggle }: { type: FoodType; on: boolean; reasons?: string[]; young: string; onToggle: () => void }) {
  const partners = partnersForType(t, BRAND.partners);
  return (
    <li className={`type-card ${on ? 'on' : ''}`}>
      <button type="button" className="type-toggle" aria-pressed={on} onClick={onToggle}>
        <span className="type-box" aria-hidden="true">{on && <Icon name="check" size={16} />}</span>
        <span className="grow"><strong>{t.name}</strong><span className="muted small block">{t.typicalShare}</span></span>
        {reasons && <Badge tone="success">Suggested</Badge>}
      </button>
      {reasons && <p className="small plate-reason">{reasons.join('. ')}.</p>}
      <div className="type-tags">{t.goodFor.map((g) => <span key={g} className="tag">{g === 'young' ? young : GOOD_FOR_LABEL[g]}</span>)}</div>
      <details className="type-details">
        <summary>What it is, pros and watch-outs</summary>
        <p className="small">{t.what}</p>
        <p className="small strong" style={{ margin: '6px 0 2px' }}>Pros</p>
        <ul className="bullets small">{t.pros.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="small strong" style={{ margin: '6px 0 2px' }}>Watch-outs</p>
        <ul className="bullets small">{t.watchOuts.map((x) => <li key={x}>{x}</li>)}</ul>
        {t.safetyNote && <p className="small estimate warn"><Icon name="alert" size={18} /> <span>{t.safetyNote}</span></p>}
      </details>
      {partners.map((p) => (
        <a key={p.id} className="text-link type-shop" href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Shop ${p.name} (opens in a new tab)`}>Shop {p.name} <Icon name="external" size={16} /></a>
      ))}
    </li>
  );
}

/** Saved plate summary shown on a pet's Food card. */
export function PlateMini({ pet }: { pet: Pet }) {
  const { data } = useApp();
  const plate = data.plates.find((x) => x.petId === pet.id);
  if (!plate) {
    return (
      <div className="plate-mini empty-plate">
        <span className="muted small grow">Plan {pet.name}'s daily mix of base food, add-ons and treats.</span>
        <Link to={`/plate/${pet.id}`} className="btn btn-secondary"><Icon name="plate" size={20} /><span>Create a plate</span></Link>
      </div>
    );
  }
  return (
    <div className="plate-mini" data-testid="plate-mini">
      <PlateChart items={plate.items} size={56} />
      <span className="grow small">
        <span className="muted block">Daily plate {plate.isSample && <SampleBadge />}</span>
        <strong>{plateSummary(plate.items)}</strong>
      </span>
      <Link to={`/plate/${pet.id}`} className="btn btn-ghost" aria-label={`Edit ${pet.name}'s plate`}><Icon name="edit" size={20} /><span>Edit</span></Link>
    </div>
  );
}
