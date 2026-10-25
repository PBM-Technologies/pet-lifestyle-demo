import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { FeedingLog, FoodSwitchPlan, Pet, PetFoodItem, SwitchPlanLength } from '../contracts/domain';
import type { Db } from '../data/db';
import { useApp } from '../state';
import { Icon } from '../ui/Icon';
import { Badge, Button, ChoiceGroup, Sheet, TextField } from '../ui/kit';
import { CALORIE_HELP, clockTime, fedSentence, feedingSlots, lastFed, logsForDay, stepCount, treatCount, treatDay } from '../lib/feeding';
import { SWITCH_NOTE, isPlanFinished, mixSentence, planDayNumber, planEndDate, splitPortion, switchSchedule, todaysMix, type SwitchDay } from '../lib/foodSwitch';
import { amountWithUnit } from '../lib/food';
import { addDays, formatDay, isValidDay, newId, nowIso, today } from '../lib/dates';

/* ---------- who is feeding (remembered per viewer) ---------- */

const FEEDER_KEY = 'pla:feeder';
const feederListeners = new Set<() => void>();
function readFeeder(): string {
  try { return globalThis.localStorage?.getItem(FEEDER_KEY) ?? ''; } catch { return ''; }
}
let feederValue = readFeeder();
function setFeeder(v: string) {
  feederValue = v;
  try { globalThis.localStorage?.setItem(FEEDER_KEY, v); } catch { /* per-viewer convenience only */ }
  feederListeners.forEach((l) => l());
}

/** Current "fed by" name, only when it is still a household member. */
export function useFeeder(members: string[]): [string, (v: string) => void] {
  const v = useSyncExternalStore((l) => { feederListeners.add(l); return () => void feederListeners.delete(l); }, () => feederValue, () => '');
  return [members.includes(v) ? v : '', setFeeder];
}

export function FeederPicker() {
  const { data } = useApp();
  const members = data.household?.members ?? [];
  const [who, setWho] = useFeeder(members);
  if (!members.length) return null;
  return (
    <div className="feeder" role="group" aria-label="Who is feeding">
      <span className="small muted">Feeding as</span>
      {members.map((m) => (
        <button key={m} type="button" className={`chip subtle ${who === m ? 'on' : ''}`} aria-pressed={who === m} onClick={() => setWho(who === m ? '' : m)}>{m}</button>
      ))}
    </div>
  );
}

/* ---------- feeding check-off ---------- */

export function FeedingChecks({ pet, food, showPicker = true }: { pet: Pet; food: PetFoodItem; showPicker?: boolean }) {
  const { data, db, toast } = useApp();
  const day = today();
  const slots = feedingSlots(food.timesPerDay);
  const done = useMemo(() => logsForDay(data.feedings, pet.id, day), [data.feedings, pet.id, day]);
  const [who] = useFeeder(data.household?.members ?? []);
  const last = lastFed(done);

  const check = async (slot: number) => {
    const now = nowIso();
    const log: FeedingLog = { id: newId('feed-'), householdId: pet.householdId, petId: pet.id, foodId: food.id, day, slot, fedAt: now, fedBy: who || undefined, createdAt: now, updatedAt: now };
    await db.feedingLogs.upsert(log);
    toast(fedSentence(pet.name, log));
  };
  const undo = async (log: FeedingLog, label: string) => {
    await db.feedingLogs.remove(log.id);
    toast(`${label} unchecked`);
  };

  return (
    <div className="feed-checks">
      {showPicker && <FeederPicker />}
      <div className="feed-slots" role="group" aria-label={`${pet.name}'s feedings today`}>
        {slots.map((label, i) => {
          const log = done.get(i);
          if (log) {
            return (
              <div key={label} className="feed-slot done">
                <span className="feed-box" aria-hidden="true"><Icon name="check" size={16} /></span>
                <span className="grow">{label}<small>{clockTime(log.fedAt)}{log.fedBy ? ` · ${log.fedBy}` : ''}</small></span>
                <button type="button" className="feed-undo" aria-label={`Undo ${label} for ${pet.name}`} onClick={() => undo(log, label)}>Undo</button>
              </div>
            );
          }
          return (
            <button key={label} type="button" className="feed-slot" aria-label={`Mark ${label} fed for ${pet.name}`} onClick={() => check(i)}>
              <span className="feed-box" aria-hidden="true" />
              <span className="grow">{label}<small>Tap when fed</small></span>
            </button>
          );
        })}
      </div>
      {last ? <p className="small feed-status" role="status">{fedSentence(pet.name, last)}</p> : <p className="small muted feed-meta" style={{ margin: '8px 0 0' }}>Not fed yet today. Checks reset each day.</p>}
    </div>
  );
}

/* ---------- treat budget ---------- */

export function TreatBudget({ pet, treats }: { pet: Pet; treats: PetFoodItem[] }) {
  const { data, db } = useApp();
  const [targetOpen, setTargetOpen] = useState(false);
  const day = today();
  const shown = treats.some((t) => t.favorite) ? treats.filter((t) => t.favorite) : treats;
  const summary = treatDay(data.treatLogs, treats, pet.id, pet.dailyCalorieTarget, day);
  const hasSampleNumbers = !!pet.isSample && (!!pet.dailyCalorieTarget || shown.some((t) => t.kcalPerPiece));

  const change = async (t: PetFoodItem, delta: 1 | -1) => {
    const existing = data.treatLogs.find((l) => l.foodId === t.id && l.day === day);
    const next = stepCount(existing?.count ?? 0, delta);
    const now = nowIso();
    if (next === 0) { if (existing) await db.treatLogs.remove(existing.id); return; }
    await db.treatLogs.upsert(existing ? { ...existing, count: next, updatedAt: now } : { id: newId('treatlog-'), householdId: pet.householdId, petId: pet.id, foodId: t.id, day, count: next, createdAt: now, updatedAt: now });
  };

  if (!shown.length) return null;
  const pct = summary.fraction === null ? 0 : Math.round(summary.fraction * 100);
  return (
    <div className="treat-budget">
      <div className="section-head">
        <h3 style={{ margin: 0 }}>Treats today</h3>
        {hasSampleNumbers && <Badge tone="sample">Sample values</Badge>}
      </div>
      {shown.map((t) => {
        const n = treatCount(data.treatLogs, t.id, day);
        return (
          <div key={t.id} className="treat-row">
            <span className="grow small"><strong>{t.product}</strong><span className="muted block">{t.kcalPerPiece ? `${t.kcalPerPiece} kcal each` : 'Calories not set'}</span></span>
            <div className="stepper" role="group" aria-label={`${t.product} given today`}>
              <button type="button" className="stepper-btn" aria-label={`One less ${t.product}`} disabled={n <= 0} onClick={() => change(t, -1)}><span aria-hidden="true">-</span></button>
              <output className="stepper-value" aria-live="polite" aria-label={`${n} ${t.product} today`}>{n}</output>
              <button type="button" className="stepper-btn" aria-label={`One more ${t.product}`} onClick={() => change(t, 1)}><Icon name="plus" size={20} /></button>
            </div>
          </div>
        );
      })}
      {summary.allowance !== null ? (
        <>
          <div className={`kcal-meter ${summary.over ? 'over' : pct >= 80 ? 'near' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={summary.allowance} aria-valuenow={summary.kcal}
            aria-label={`Treat calories today: ${summary.kcal} of about ${summary.allowance}`}>
            <div className="kcal-fill" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className="small food-meta"><strong>{summary.kcal} of about {summary.allowance} kcal</strong> <span className="muted">from treats today (10 percent of {pet.dailyCalorieTarget} kcal a day)</span></p>
          {summary.over && <p className="estimate warn small" role="status"><Icon name="info" size={18} /> <span>A bit over the 10 percent guideline today. That happens; maybe skip the next treat or break treats into smaller pieces.</span></p>}
        </>
      ) : (
        <p className="muted small food-meta">
          {summary.kcal > 0 ? `${summary.kcal} kcal from treats today. ` : ''}Add a daily calorie target to see a treat budget.
        </p>
      )}
      {summary.uncounted > 0 && <p className="muted small food-meta">{summary.uncounted} piece{summary.uncounted === 1 ? '' : 's'} not counted. Add calories per piece on the treat to include them.</p>}
      <div className="food-actions"><Button variant="ghost" icon="edit" onClick={() => setTargetOpen(true)}>{summary.allowance !== null ? 'Change calorie target' : 'Set calorie target'}</Button></div>
      {targetOpen && <CalorieTargetSheet pet={pet} onClose={() => setTargetOpen(false)} />}
    </div>
  );
}

export function CalorieTargetSheet({ pet, onClose }: { pet: Pet; onClose: () => void }) {
  const { db, toast } = useApp();
  const [value, setValue] = useState(pet.dailyCalorieTarget ? String(pet.dailyCalorieTarget) : '');
  const [err, setErr] = useState<string>();
  const save = async () => {
    const n = value.trim() ? Number(value) : undefined;
    if (n !== undefined && !(Number.isFinite(n) && n >= 50 && n <= 10000)) return setErr('Enter calories between 50 and 10000, or leave it blank.');
    await db.pets.upsert({ ...pet, dailyCalorieTarget: n, updatedAt: nowIso() });
    toast(n ? 'Calorie target saved' : 'Calorie target cleared');
    onClose();
  };
  return (
    <Sheet open title={`Daily calories for ${pet.name}`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <TextField label="Daily calorie target (kcal)" value={value} onChange={(v) => { setValue(v); setErr(undefined); }} inputMode="numeric" error={err} hint={CALORIE_HELP} />
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

/* ---------- food switch plan ---------- */

export async function finishPlan(db: Db, plan: FoodSwitchPlan, oldFood: PetFoodItem | undefined, newFood: PetFoodItem | undefined): Promise<void> {
  const now = nowIso();
  await db.switchPlans.upsert({ ...plan, status: 'done', updatedAt: now });
  if (oldFood) await db.petFood.upsert({ ...oldFood, active: false, updatedAt: now });
  if (newFood && !newFood.active) await db.petFood.upsert({ ...newFood, active: true, updatedAt: now });
}

const foodName = (f?: PetFoodItem) => (f ? `${f.brand} ${f.product}` : 'the new food');

/** Groups consecutive days with the same mix: "Days 1 to 2". */
function stages(days: SwitchDay[]): Array<{ from: number; to: number; mix: SwitchDay }> {
  const out: Array<{ from: number; to: number; mix: SwitchDay }> = [];
  for (const d of days) {
    const last = out[out.length - 1];
    if (last && last.mix.newPct === d.newPct) last.to = d.day;
    else out.push({ from: d.day, to: d.day, mix: d });
  }
  return out;
}

function ScheduleList({ plan, oldFood }: { plan: Pick<FoodSwitchPlan, 'days' | 'startDate'>; oldFood: PetFoodItem }) {
  const n = planDayNumber(plan);
  return (
    <ul className="schedule" aria-label="Day by day schedule">
      {stages(switchSchedule(plan.days)).map((s) => {
        const isToday = n >= s.from && n <= s.to;
        const amounts = oldFood.portionAmount && oldFood.portionUnit ? splitPortion(oldFood.portionAmount, oldFood.portionUnit, s.mix) : null;
        return (
          <li key={s.from} className={isToday ? 'today' : ''} aria-current={isToday ? 'step' : undefined}>
            <span>
              <strong>{s.from === s.to ? `Day ${s.from}` : `Days ${s.from} to ${s.to}`}</strong>
              <span className="muted small block" style={{ textAlign: 'left' }}>{formatDay(addDays(plan.startDate, s.from - 1))}{s.from !== s.to ? ` to ${formatDay(addDays(plan.startDate, s.to - 1))}` : ''}</span>
            </span>
            <span className="small">
              <strong className="block">{s.mix.newPct === 100 ? 'All new' : `${s.mix.oldPct}% old, ${s.mix.newPct}% new`}</strong>
              {amounts && <span className="muted block">{s.mix.newPct === 100 ? amountWithUnit(amounts.next, oldFood.portionUnit!, 'portion') : `${amountWithUnit(amounts.old, oldFood.portionUnit!, 'portion')} + ${amountWithUnit(amounts.next, oldFood.portionUnit!, 'portion')}`}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Shown on the food card while a switch is running. */
export function SwitchStatus({ plan, oldFood }: { plan: FoodSwitchPlan; oldFood: PetFoodItem }) {
  const { data, db, toast } = useApp();
  const [open, setOpen] = useState(false);
  const newFood = data.food.find((f) => f.id === plan.newFoodId);
  const n = planDayNumber(plan);
  const mix = todaysMix(plan);
  const sentence = mix ? mixSentence(oldFood, mix) : null;

  useEffect(() => {
    if (isPlanFinished(plan)) void finishPlan(db, plan, oldFood, newFood).then(() => toast(`Switch done. Now feeding ${foodName(newFood)}`));
  }, [plan, oldFood, newFood, db, toast]);

  return (
    <div className="switch-box">
      <div className="switch-head">
        <span><span className="muted small block">Switching to</span><strong>{foodName(newFood)}</strong></span>
        <Badge tone="accent">{n < 1 ? `Starts ${formatDay(plan.startDate)}` : `Day ${Math.min(n, plan.days)} of ${plan.days}`}</Badge>
      </div>
      {mix ? (
        <>
          <div className="mix-bar" role="img" aria-label={`Today's mix: ${mix.oldPct} percent old food, ${mix.newPct} percent new food`}>
            {mix.oldPct > 0 && <span className="mix-old" style={{ width: `${mix.oldPct}%` }}>{mix.oldPct}% old</span>}
            <span className="mix-new" style={{ width: `${mix.newPct}%` }}>{mix.newPct}% new</span>
          </div>
          <p className="food-line">Today's mix: {sentence ?? (mix.newPct === 100 ? 'all new food' : `${mix.oldPct}% old, ${mix.newPct}% new`)}</p>
        </>
      ) : (
        <p className="food-line">Day 1 is {formatDay(plan.startDate)}</p>
      )}
      <p className="muted small food-meta">{SWITCH_NOTE}</p>
      <div className="food-actions">
        <Button variant="secondary" icon="calendar" onClick={() => setOpen(true)}>See schedule</Button>
        {n >= plan.days && <Button icon="check" onClick={async () => { await finishPlan(db, plan, oldFood, newFood); toast(`Switch done. Now feeding ${foodName(newFood)}`); }}>Finish switch</Button>}
      </div>
      {open && (
        <Sheet open title="Switch schedule" onClose={() => setOpen(false)} footer={<>
          <Button variant="danger" onClick={async () => { await db.switchPlans.upsert({ ...plan, status: 'stopped', updatedAt: nowIso() }); setOpen(false); toast('Switch plan stopped'); }}>Stop plan</Button>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </>}>
          <p className="small">From <strong>{foodName(oldFood)}</strong> to <strong>{foodName(newFood)}</strong>, {formatDay(plan.startDate)} to {formatDay(planEndDate(plan))}.</p>
          <ScheduleList plan={plan} oldFood={oldFood} />
          <p className="muted small">{SWITCH_NOTE} When the plan ends, the old food is marked as no longer fed. Its history stays.</p>
        </Sheet>
      )}
    </div>
  );
}

export function SwitchPlanSheet({ pet, oldFood, onClose }: { pet: Pet; oldFood: PetFoodItem; onClose: () => void }) {
  const { data, db, toast } = useApp();
  const t0 = today();
  const candidates = data.food.filter((f) => f.petId === pet.id && f.kind === 'food' && f.id !== oldFood.id);
  const [choice, setChoice] = useState<string>(candidates[0]?.id ?? 'new');
  const [brand, setBrand] = useState('');
  const [product, setProduct] = useState('');
  const [days, setDays] = useState<SwitchPlanLength>(7);
  const [start, setStart] = useState(t0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async () => {
    const e: Record<string, string> = {};
    if (choice === 'new' && !brand.trim()) e.brand = 'Add the brand.';
    if (choice === 'new' && !product.trim()) e.product = 'Add the food name.';
    if (!isValidDay(start) || start < addDays(t0, -14) || start > addDays(t0, 60)) e.start = 'Pick a start date within the next 2 months.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const now = nowIso();
    let newId_ = choice;
    if (choice === 'new') {
      const nf: PetFoodItem = {
        id: newId('food-'), householdId: pet.householdId, petId: pet.id, kind: 'food', brand: brand.trim(), product: product.trim(), favorite: false,
        portionAmount: oldFood.portionAmount, portionUnit: oldFood.portionUnit, timesPerDay: oldFood.timesPerDay, cupsPerLb: oldFood.cupsPerLb,
        purchases: [], active: true, createdAt: now, updatedAt: now,
      };
      await db.petFood.upsert(nf);
      newId_ = nf.id;
    } else {
      const nf = data.food.find((f) => f.id === choice);
      if (nf && !nf.active) await db.petFood.upsert({ ...nf, active: true, updatedAt: now });
    }
    for (const p of data.switchPlans.filter((x) => x.petId === pet.id && x.status === 'active')) await db.switchPlans.upsert({ ...p, status: 'stopped', updatedAt: now });
    await db.switchPlans.upsert({ id: newId('switch-'), householdId: pet.householdId, petId: pet.id, oldFoodId: oldFood.id, newFoodId: newId_, days, startDate: start, status: 'active', createdAt: now, updatedAt: now });
    toast(`${days} day switch planned`);
    onClose();
  };

  return (
    <Sheet open title="Switch to a new food" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Start plan</Button></>}>
      <form className="form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
        <p className="small muted">Mixing old and new food over a week or so is gentler on {pet.name}'s stomach than switching all at once. Moving from <strong>{foodName(oldFood)}</strong>.</p>
        <ChoiceGroup label="New food" value={choice} columns={1} onChange={setChoice}
          options={[...candidates.map((c) => ({ value: c.id, label: `${c.brand} ${c.product}`, hint: c.active ? undefined : 'Not fed right now' })), { value: 'new', label: 'Add a new food' }]} />
        {choice === 'new' && (
          <>
            <TextField label="Brand" value={brand} onChange={setBrand} error={errors.brand} maxLength={80} />
            <TextField label="Food name" value={product} onChange={setProduct} error={errors.product} maxLength={120} placeholder={pet.species === 'cat' ? 'Adult wet food' : 'Adult dry food'}
              hint="Uses the same portion as the current food. Add the bag size later to track it." />
          </>
        )}
        <ChoiceGroup<'7' | '10'> label="Plan length" value={String(days) as '7' | '10'} columns={2} onChange={(v) => setDays(Number(v) as SwitchPlanLength)}
          options={[{ value: '7', label: '7 days', hint: 'Most pets' }, { value: '10', label: '10 days', hint: 'Sensitive stomachs' }]} />
        <TextField label="Start date" type="date" value={start} onChange={setStart} error={errors.start} />
        <div className="chip-row" role="group" aria-label="Quick start dates">
          {[{ label: 'Today', d: t0 }, { label: 'Tomorrow', d: addDays(t0, 1) }].map((c) => (
            <button key={c.label} type="button" className={`chip ${start === c.d ? 'on' : ''}`} aria-pressed={start === c.d} onClick={() => setStart(c.d)}>{c.label}</button>
          ))}
        </div>
        <h3 className="form-section">Schedule</h3>
        <ScheduleList plan={{ days, startDate: isValidDay(start) ? start : t0 }} oldFood={oldFood} />
        <p className="estimate small"><Icon name="info" size={18} /> <span>{SWITCH_NOTE}</span></p>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
