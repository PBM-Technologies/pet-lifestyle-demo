import { useMemo, useState } from 'react';
import type { FoodKind, FoodPurchase, PackageUnit, Pet, PetFoodItem, PortionUnit } from '../contracts/domain';
import { BRAND } from '../config/brand';
import { useApp } from '../state';
import { Icon } from '../ui/Icon';
import { Badge, Button, Card, ChoiceGroup, Confirm, SampleBadge, Sheet, SheetPicker, Stepper, TextField, Toggle } from '../ui/kit';
import {
  CUPS_PER_LB_HINT, DEFAULT_CUPS_PER_LB, DEFAULT_REORDER_LEAD_DAYS, FOOD_STATUS_LABEL, PACKAGE_UNITS, PACKAGE_UNIT_LABEL, PORTION_UNITS, PORTION_UNIT_LABEL,
  amountWithUnit, estimateFood, learnedSentence, leftSentence, logNewPurchase, needsCupsPerLb, partnerForBrand, timesWord, unitsCompatible, usageSentence,
  type FoodEstimate, type FoodStatus,
} from '../lib/food';
import { addDays, formatDay, isValidDay, newId, nowIso, today } from '../lib/dates';
import { activePlan, mainFood } from '../lib/feeding';
import { FeedingChecks, SwitchPlanSheet, SwitchStatus, TreatBudget } from './FoodExtras';
import { PlateMini } from './Plate';

const STATUS_TONE: Record<FoodStatus, 'success' | 'warning' | 'danger'> = { ok: 'success', reorder_soon: 'warning', out: 'danger' };

const PACKAGE_OPTIONS = PACKAGE_UNITS.map((u) => ({ value: u, label: PACKAGE_UNIT_LABEL[u] }));
const PORTION_OPTIONS = PORTION_UNITS.map((u) => ({ value: u, label: PORTION_UNIT_LABEL[u] }));
const LEAD_OPTIONS = ['3', '5', '7', '10', '14'].map((d) => ({ value: d, label: `${d} days` }));

function StatusPill({ status }: { status: FoodStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{FOOD_STATUS_LABEL[status]}</Badge>;
}

function Gauge({ estimate, label }: { estimate: FoodEstimate; label: string }) {
  const pct = Math.round(estimate.fractionLeft * 100);
  return (
    <div className={`gauge ${estimate.status}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${label}: about ${pct} percent left`}>
      <div className="gauge-fill" style={{ width: `${Math.max(pct, estimate.status === 'out' ? 0 : 3)}%` }} />
      <div className="gauge-ticks" aria-hidden="true"><span /><span /><span /></div>
    </div>
  );
}

function PartnerLink({ brand }: { brand: string }) {
  const partner = partnerForBrand(brand, BRAND.partners);
  if (!partner) return null;
  return (
    <a className="btn btn-secondary" href={partner.url} target="_blank" rel="noopener noreferrer" aria-label={`Reorder from ${partner.name} (opens in a new tab)`}>
      <span>Reorder from {partner.name}</span><Icon name="external" size={18} />
    </a>
  );
}

/** "Food and treats" card shown near the top of a pet's page. */
export function FoodCard({ pet }: { pet: Pet }) {
  const { data, db, toast } = useApp();
  const items = useMemo(() => data.food.filter((f) => f.petId === pet.id && f.active), [data.food, pet.id]);
  const foods = items.filter((f) => f.kind === 'food').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const treats = items.filter((f) => f.kind === 'treat').sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.product.localeCompare(b.product));
  const [form, setForm] = useState<{ item?: PetFoodItem; kind: FoodKind } | null>(null);
  const [justBought, setJustBought] = useState<string | null>(null);
  const [editPurchase, setEditPurchase] = useState<PetFoodItem | null>(null);
  const [switchFrom, setSwitchFrom] = useState<PetFoodItem | null>(null);
  const plan = activePlan(data.switchPlans, pet.id);
  const main = mainFood(data.food, pet.id, data.switchPlans);

  const boughtNew = async (item: PetFoodItem) => {
    const next = logNewPurchase(item, today(), nowIso());
    await db.petFood.upsert(next);
    setJustBought(item.id);
    toast(`Logged a new ${item.packageSize ? amountWithUnit(item.packageSize, item.packageUnit ?? 'lb') + ' ' : ''}bag`);
  };

  return (
    <Card className="food-card">
      <div className="section-head">
        <div className="mini-head"><Icon name="bag" /><h2>Food and treats</h2></div>
        <Button variant="ghost" icon="plus" aria-label={`Add food or treat for ${pet.name}`} onClick={() => setForm({ kind: foods.length ? 'treat' : 'food' })}>Add</Button>
      </div>
      <PlateMini pet={pet} />

      {items.length === 0 && (
        <p className="muted small">Add {pet.name}'s food and favorite treats. Tell us the bag size and how much {pet.name} eats, and we will estimate how much is left and when to reorder.</p>
      )}

      {foods.map((item) => {
        const e = estimateFood(item);
        const learned = learnedSentence(item.purchases);
        const latest = item.purchases[item.purchases.length - 1];
        return (
          <div key={item.id} className="food-main">
            <div className="food-title">
              <button type="button" className="food-edit" onClick={() => setForm({ item, kind: item.kind })} aria-label={`Edit ${item.brand} ${item.product}`}>
                <span className="muted small block">Food</span>
                <strong>{item.brand}</strong>
                <span className="small block">{item.product}{item.flavor ? `, ${item.flavor}` : ''}</span>
              </button>
              <span className="badges">{e && <StatusPill status={e.status} />}{item.isSample && <SampleBadge />}</span>
            </div>
            {e ? (
              <>
                <Gauge estimate={e} label={`${item.brand} ${item.product}`} />
                <p className="food-line">{leftSentence(item, e)}</p>
                <p className="muted small food-meta">
                  {amountWithUnit(item.portionAmount as number, item.portionUnit as PortionUnit, 'portion')} {timesWord(item.timesPerDay as number)} · bought {formatDay(item.purchasedOn)}
                </p>
                {learned && <p className="muted small food-meta">{learned}</p>}
              </>
            ) : (
              <p className="muted small">Add the bag size, date bought and portions to see how much is left. <button type="button" className="text-link" onClick={() => setForm({ item, kind: item.kind })}>Add details</button></p>
            )}
            {main?.id === item.id && <FeedingChecks pet={pet} food={item} />}
            {plan?.oldFoodId === item.id && <SwitchStatus plan={plan} oldFood={item} />}
            {plan?.newFoodId === item.id && <p className="small food-meta"><Badge tone="accent">New food in the switch plan</Badge></p>}
            <div className="food-actions">
              {item.packageSize ? <Button icon="bag" onClick={() => boughtNew(item)}>I bought a new bag</Button> : null}
              {!plan && main?.id === item.id && <Button variant="secondary" icon="clock" onClick={() => setSwitchFrom(item)}>Switch to a new food</Button>}
              <PartnerLink brand={item.brand} />
            </div>
            {justBought === item.id && latest && (
              <p className="small food-meta" role="status">
                Logged {amountWithUnit(latest.size, latest.unit)} on {formatDay(latest.date)}. <button type="button" className="text-link" onClick={() => setEditPurchase(item)}>Change size or date</button>
              </p>
            )}
          </div>
        );
      })}

      {treats.length > 0 && (
        <>
          <h3 className="small muted" style={{ margin: '4px 0 0' }}>{treats.some((t) => t.favorite) ? 'Favorite treats' : 'Treats'}</h3>
          <div className="treat-chips">
            {treats.map((t) => {
              const e = estimateFood(t);
              return (
                <button key={t.id} type="button" className={`treat-chip ${e ? e.status : ''}`} onClick={() => setForm({ item: t, kind: 'treat' })} aria-label={`Edit treat ${t.product}${e ? `, ${FOOD_STATUS_LABEL[e.status]}` : ''}`}>
                  {t.favorite && <Icon name="star" size={16} className="star" />}
                  <span>
                    {t.product}
                    {e && <small>{e.status === 'out' ? 'Probably out' : `About ${amountWithUnit(e.left, t.packageUnit as PackageUnit)} left`}{e.status === 'reorder_soon' ? ', reorder soon' : ''}</small>}
                  </span>
                </button>
              );
            })}
          </div>
          <TreatBudget pet={pet} treats={treats} />
        </>
      )}

      {switchFrom && <SwitchPlanSheet pet={pet} oldFood={switchFrom} onClose={() => setSwitchFrom(null)} />}
      {form && <FoodFormSheet pet={pet} item={form.item} initialKind={form.kind} onClose={() => setForm(null)} />}
      {editPurchase && <PurchaseSheet item={data.food.find((f) => f.id === editPurchase.id) ?? editPurchase} onClose={() => setEditPurchase(null)} />}
    </Card>
  );
}

/** Edits the most recent purchase (size, unit, date, optional price). */
function PurchaseSheet({ item, onClose }: { item: PetFoodItem; onClose: () => void }) {
  const { db, toast } = useApp();
  const latest = item.purchases[item.purchases.length - 1];
  const [size, setSize] = useState(String(latest?.size ?? item.packageSize ?? ''));
  const [unit, setUnit] = useState<PackageUnit>(latest?.unit ?? item.packageUnit ?? 'lb');
  const [date, setDate] = useState(latest?.date ?? today());
  const [price, setPrice] = useState(latest?.price !== undefined ? String(latest.price) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = async () => {
    const e: Record<string, string> = {};
    const n = Number(size);
    if (!(n > 0)) e.size = 'Enter the bag size.';
    if (!isValidDay(date) || date > today()) e.date = 'Pick a date on or before today.';
    const pr = price.trim() ? Number(price) : undefined;
    if (pr !== undefined && !(pr >= 0)) e.price = 'Enter a price or leave it blank.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const p: FoodPurchase = { date, size: n, unit, ...(pr !== undefined ? { price: pr } : {}) };
    const purchases = [...item.purchases.slice(0, -1), p].sort((a, b) => a.date.localeCompare(b.date));
    const last = purchases[purchases.length - 1];
    await db.petFood.upsert({ ...item, purchases, packageSize: last.size, packageUnit: last.unit, purchasedOn: last.date, updatedAt: nowIso() });
    toast('Purchase updated');
    onClose();
  };
  return (
    <Sheet open title="Edit purchase" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <form className="form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
        <div className="unit-row">
          <TextField label="Size" value={size} onChange={setSize} inputMode="decimal" error={errors.size} />
          <SheetPicker<PackageUnit> label="Unit" value={unit} options={PACKAGE_OPTIONS} onChange={setUnit} />
        </div>
        <TextField label="Date bought" type="date" value={date} onChange={setDate} error={errors.date} />
        <TextField label="Price you paid (optional)" value={price} onChange={setPrice} inputMode="decimal" error={errors.price} hint="Only for your records." />
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

const DATE_CHIPS = [
  { label: 'Today', days: 0 },
  { label: '1 week ago', days: 7 },
  { label: '2 weeks ago', days: 14 },
  { label: '1 month ago', days: 30 },
];

export function FoodFormSheet({ pet, item, initialKind = 'food', onClose }: { pet: Pet; item?: PetFoodItem; initialKind?: FoodKind; onClose: () => void }) {
  const { db, toast } = useApp();
  const t0 = today();
  const [kind, setKind] = useState<FoodKind>(item?.kind ?? initialKind);
  const [brand, setBrand] = useState(item?.brand ?? '');
  const [product, setProduct] = useState(item?.product ?? '');
  const [flavor, setFlavor] = useState(item?.flavor ?? '');
  const [favorite, setFavorite] = useState(item?.favorite ?? initialKind === 'treat');
  const [size, setSize] = useState(item?.packageSize !== undefined ? String(item.packageSize) : '');
  const [packageUnit, setPackageUnit] = useState<PackageUnit>(item?.packageUnit ?? (initialKind === 'treat' ? 'count' : pet.species === 'cat' ? 'cans' : 'lb'));
  const [purchasedOn, setPurchasedOn] = useState(item?.purchasedOn ?? t0);
  const [portion, setPortion] = useState(item?.portionAmount !== undefined ? String(item.portionAmount) : '');
  const [portionUnit, setPortionUnit] = useState<PortionUnit>(item?.portionUnit ?? (initialKind === 'treat' ? 'pieces' : pet.species === 'cat' ? 'cans' : 'cups'));
  const [timesPerDay, setTimesPerDay] = useState(item?.timesPerDay ?? 2);
  const [cupsPerLb, setCupsPerLb] = useState(String(item?.cupsPerLb ?? DEFAULT_CUPS_PER_LB));
  const [lead, setLead] = useState(String(item?.reorderLeadDays ?? DEFAULT_REORDER_LEAD_DAYS));
  const [whereBought, setWhereBought] = useState(item?.whereBought ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [active, setActive] = useState(item?.active ?? true);
  const [kcal, setKcal] = useState(item?.kcalPerPiece !== undefined ? String(item.kcalPerPiece) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const num = (s: string) => (s.trim() ? Number(s) : undefined);
  const sizeN = num(size);
  const portionN = num(portion);
  const cplN = num(cupsPerLb);
  const showCpl = needsCupsPerLb(portionUnit, packageUnit);
  const compatible = unitsCompatible(portionUnit, packageUnit);
  const draft = {
    packageSize: sizeN, packageUnit, purchasedOn, portionAmount: portionN, portionUnit, timesPerDay,
    cupsPerLb: showCpl ? cplN : undefined, reorderLeadDays: Number(lead),
  };
  const sentence = compatible ? usageSentence(draft) : null;
  const est = compatible ? estimateFood(draft) : null;
  const anyTracking = !!(size.trim() || portion.trim());

  const save = async () => {
    const e: Record<string, string> = {};
    if (!brand.trim()) e.brand = 'Add the brand.';
    if (!product.trim()) e.product = kind === 'food' ? 'Add the food name, like "Adult dry food".' : 'Add the treat name.';
    if (sizeN !== undefined && !(sizeN > 0 && sizeN < 100000)) e.size = 'Enter the bag size.';
    if (portionN !== undefined && !(portionN > 0 && portionN < 10000)) e.portion = 'Enter how much per feeding.';
    if (kind === 'food' && sizeN === undefined) e.size = 'Enter the bag size so we can estimate what is left.';
    if (kind === 'food' && portionN === undefined) e.portion = 'Enter how much per feeding.';
    if (!isValidDay(purchasedOn) || purchasedOn > t0) e.purchasedOn = 'Pick a date on or before today.';
    if (showCpl && !(cplN !== undefined && cplN > 0 && cplN <= 20)) e.cupsPerLb = 'Enter cups per pound from your bag.';
    const kcalN = num(kcal);
    if (kind === 'treat' && kcalN !== undefined && !(kcalN > 0 && kcalN <= 2000)) e.kcal = 'Enter calories per piece from the package, or leave it blank.';
    if (anyTracking && sizeN !== undefined && portionN !== undefined && !compatible) e.portionUnit = 'These units do not convert. Pick matching units.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const now = nowIso();
    const tracked = sizeN !== undefined;
    let purchases = item?.purchases ?? [];
    if (tracked) {
      const last = purchases[purchases.length - 1];
      if (!last) purchases = [{ date: purchasedOn, size: sizeN as number, unit: packageUnit }];
      else if (last.date !== purchasedOn && !purchases.some((p) => p.date === purchasedOn) && purchasedOn > last.date) purchases = [...purchases, { date: purchasedOn, size: sizeN as number, unit: packageUnit }];
      else purchases = purchases.map((p, i) => (i === purchases.length - 1 ? { ...p, date: purchasedOn, size: sizeN as number, unit: packageUnit } : p)).sort((a, b) => a.date.localeCompare(b.date));
    }
    const rec: PetFoodItem = {
      ...(item ?? { id: newId('food-'), createdAt: now }),
      householdId: pet.householdId,
      petId: pet.id,
      kind,
      brand: brand.trim(),
      product: product.trim(),
      flavor: flavor.trim() || undefined,
      favorite: kind === 'treat' ? favorite : false,
      packageSize: tracked ? sizeN : undefined,
      packageUnit: tracked ? packageUnit : undefined,
      purchasedOn: tracked ? purchasedOn : undefined,
      portionAmount: portionN,
      portionUnit: portionN !== undefined ? portionUnit : undefined,
      timesPerDay: portionN !== undefined ? timesPerDay : undefined,
      cupsPerLb: showCpl ? cplN : undefined,
      reorderLeadDays: Number(lead) || DEFAULT_REORDER_LEAD_DAYS,
      whereBought: whereBought.trim() || undefined,
      notes: notes.trim() || undefined,
      kcalPerPiece: kind === 'treat' ? num(kcal) : undefined,
      purchases,
      active,
      updatedAt: now,
    } as PetFoodItem;
    await db.petFood.upsert(rec);
    toast(item ? 'Saved' : kind === 'food' ? 'Food added' : 'Treat added');
    onClose();
  };

  return (
    <>
      <Sheet open={!confirmDelete} title={item ? `Edit ${kind === 'food' ? 'food' : 'treat'}` : `Add food or treat for ${pet.name}`} onClose={onClose}
        footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        <form className="form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
          <ChoiceGroup<FoodKind> label="What is it?" value={kind} columns={2} options={[{ value: 'food', label: 'Food' }, { value: 'treat', label: 'Treat' }]}
            onChange={(k) => { setKind(k); if (k === 'treat' && !item) { setFavorite(true); if (packageUnit === 'lb' && !size) setPackageUnit('count'); if (portionUnit === 'cups' && !portion) setPortionUnit('pieces'); } }} />
          <TextField label="Brand" value={brand} onChange={setBrand} error={errors.brand} maxLength={80} />
          <TextField label={kind === 'food' ? 'Food name' : 'Treat name'} value={product} onChange={setProduct} error={errors.product} maxLength={120}
            placeholder={kind === 'food' ? (pet.species === 'cat' ? 'Adult wet food' : 'Adult dry food') : 'Training bites'} />
          <TextField label="Flavor or formula (optional)" value={flavor} onChange={setFlavor} maxLength={80} />
          {kind === 'treat' && <Toggle label="Favorite" hint={`Show as one of ${pet.name}'s favorites`} checked={favorite} onChange={setFavorite} />}
          {kind === 'treat' && <TextField label="Calories per piece (optional)" value={kcal} onChange={setKcal} inputMode="decimal" error={errors.kcal} hint="From the package. Used for the daily treat budget." />}

          <h3 className="form-section">{kind === 'food' ? 'Bag and feeding' : 'Track how much is left (optional)'}</h3>
          <div className="unit-row">
            <TextField label={kind === 'food' ? 'Bag size' : 'Package size'} value={size} onChange={setSize} inputMode="decimal" error={errors.size} placeholder={packageUnit === 'lb' ? '24' : ''} />
            <SheetPicker<PackageUnit> label="Package unit" value={packageUnit} options={PACKAGE_OPTIONS} onChange={setPackageUnit} />
          </div>
          <TextField label="Date bought" type="date" value={purchasedOn} onChange={setPurchasedOn} error={errors.purchasedOn} />
          <div className="chip-row" role="group" aria-label="Quick dates">
            {DATE_CHIPS.map((c) => {
              const d = addDays(t0, -c.days);
              return <button key={c.label} type="button" className={`chip ${purchasedOn === d ? 'on' : ''}`} aria-pressed={purchasedOn === d} onClick={() => setPurchasedOn(d)}>{c.label}</button>;
            })}
          </div>
          <div className="unit-row">
            <TextField label="Per feeding" value={portion} onChange={setPortion} inputMode="decimal" error={errors.portion} placeholder={portionUnit === 'cups' ? '2' : '1'} />
            <SheetPicker<PortionUnit> label="Portion unit" value={portionUnit} options={PORTION_OPTIONS} onChange={setPortionUnit} />
          </div>
          {errors.portionUnit && <p className="field-error" role="alert">{errors.portionUnit}</p>}
          <Stepper label="Feedings per day" value={timesPerDay} min={1} max={4} onChange={setTimesPerDay} format={(v) => timesWord(v)} />
          {showCpl && <TextField label="Cups per pound" value={cupsPerLb} onChange={setCupsPerLb} inputMode="decimal" error={errors.cupsPerLb} hint={CUPS_PER_LB_HINT} />}

          {anyTracking && !compatible && (
            <p className="estimate warn" role="status"><Icon name="info" size={18} /> {PORTION_UNIT_LABEL[portionUnit]} and {PACKAGE_UNIT_LABEL[packageUnit]} do not convert. Pick a portion unit that matches the package, like cups or grams for a bag by weight, or cans for a case of cans.</p>
          )}
          {sentence && (
            <p className="estimate" role="status" aria-live="polite"><Icon name="clock" size={18} /> <span>{sentence}{est ? `. ${est.status === 'out' ? 'This bag is probably empty by now.' : `About ${amountWithUnit(est.left, packageUnit)} left today.`}` : ''}</span></p>
          )}

          <ChoiceGroup label="Remind me before it runs out" value={lead} onChange={setLead} columns={5} options={LEAD_OPTIONS.map((o) => ({ ...o, label: o.value }))} />
          <p className="hint" style={{ marginTop: -8, marginBottom: 12 }}>Days ahead</p>
          <TextField label="Where you buy it (optional)" value={whereBought} onChange={setWhereBought} maxLength={120} />
          <TextField label="Notes" value={notes} onChange={setNotes} multiline />
          {item && <Toggle label="Still feeding this" checked={active} onChange={setActive} hint="Turn off to hide it without deleting the history." />}
          {item && <div className="row-actions"><Button variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>Delete</Button></div>}
          <button type="submit" hidden />
        </form>
      </Sheet>
      <Confirm open={confirmDelete} title={`Delete ${product || 'this item'}?`} body="This removes it and its purchase history from this device." onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => { if (item) await db.petFood.remove(item.id); toast('Deleted'); onClose(); }} />
    </>
  );
}
