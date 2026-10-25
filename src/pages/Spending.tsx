import { useMemo, useState } from 'react';
import type { Expense, ExpenseCategory } from '../contracts/domain';
import { BRAND } from '../config/brand';
import { useApp } from '../state';
import { Link } from '../router';
import { Icon } from '../ui/Icon';
import { Badge, Button, Card, Confirm, EmptyState, IconButton, PageHeader, PetAvatar, SampleBadge, Sheet, TextField, downloadFile } from '../ui/kit';
import {
  EXPENSE_CATEGORIES, EXPENSE_LABEL, averagePerPet, byCategory, byPet, currentMonth, formatMoney, inMonth, monthLabel, monthTrend, parseAmount, shiftMonth,
  spendEntries, spendingCsv, sum,
} from '../lib/spending';
import { addDays, formatDay, isValidDay, newId, nowIso, today } from '../lib/dates';

function CategoryBars({ rows }: { rows: Array<{ category: ExpenseCategory; total: number }> }) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <ul className="cat-bars">
      {rows.map((r) => (
        <li key={r.category}>
          <div className="cat-bar-top"><span>{EXPENSE_LABEL[r.category]}</span><span className="money">{formatMoney(r.total)}</span></div>
          <svg viewBox="0 0 300 10" preserveAspectRatio="none" role="img" aria-label={`${EXPENSE_LABEL[r.category]}: ${formatMoney(r.total)}`} height="10">
            <rect className="bar-track" x="0" y="0" width="300" height="10" rx="5" />
            <rect className="bar-fill" x="0" y="0" width={Math.max(6, (r.total / max) * 300)} height="10" rx="5" />
          </svg>
        </li>
      ))}
    </ul>
  );
}

function TrendChart({ points, selected }: { points: Array<{ key: string; total: number }>; selected: string }) {
  const W = 320, H = 150, top = 18, bottom = 22;
  const max = Math.max(...points.map((p) => p.total), 1);
  const slot = W / points.length;
  const bw = Math.min(34, slot * 0.6);
  return (
    <figure className="trend" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Spending by month: ${points.map((p) => `${monthLabel(p.key, true)} ${formatMoney(p.total)}`).join(', ')}`}>
        <line className="trend-base" x1="0" x2={W} y1={H - bottom} y2={H - bottom} />
        {points.map((p, i) => {
          const h = (p.total / max) * (H - top - bottom);
          const x = i * slot + (slot - bw) / 2;
          return (
            <g key={p.key}>
              <rect className={`bar-fill ${p.key === selected ? 'hi' : ''}`} x={x} y={H - bottom - h} width={bw} height={Math.max(h, p.total > 0 ? 2 : 0)} rx="5" />
              {p.total > 0 && <text className="trend-value" x={x + bw / 2} y={H - bottom - h - 5} textAnchor="middle">{Math.round(p.total)}</text>}
              <text className="trend-label" x={x + bw / 2} y={H - 6} textAnchor="middle">{monthLabel(p.key, true)}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function SpendingPage() {
  const { data, toast } = useApp();
  const thisMonth = currentMonth();
  const [month, setMonth] = useState(thisMonth);
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const entries = useMemo(() => spendEntries(data.expenses, data.food), [data.expenses, data.food]);
  const monthEntries = inMonth(entries, month);
  const total = sum(monthEntries);
  const petById = new Map(data.pets.map((p) => [p.id, p]));
  const cats = byCategory(monthEntries);
  const pets = byPet(monthEntries);
  const trend = monthTrend(entries, month, 6);
  const avg = averagePerPet(entries, data.pets, month, 6);
  const slug = BRAND.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const hasSample = monthEntries.some((e) => e.isSample);

  return (
    <div className="page">
      <PageHeader title="Spending" subtitle="What your pets cost, month by month" backTo="/more" actions={<Button icon="plus" onClick={() => setEditing('new')}>Add expense</Button>} />
      {entries.length === 0 ? (
        <EmptyState icon="bag" title="No spending yet" action={<Button icon="plus" onClick={() => setEditing('new')}>Add an expense</Button>}>
          Add vet bills, toys, grooming and more. Prices you enter on food purchases count here too.
        </EmptyState>
      ) : (
        <>
          <Card>
            <div className="month-switch">
              <IconButton icon="back" label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} />
              <h2 aria-live="polite">{monthLabel(month)}</h2>
              <span style={{ visibility: month >= thisMonth ? 'hidden' : 'visible' }}><IconButton icon="chevron" label="Next month" onClick={() => setMonth(shiftMonth(month, 1))} /></span>
            </div>
            <p className="big-total" data-testid="month-total">{formatMoney(total)}</p>
            <p className="muted small center" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{monthEntries.length} entr{monthEntries.length === 1 ? 'y' : 'ies'} this month</span>{hasSample && <SampleBadge />}
            </p>
          </Card>

          {cats.length > 0 && (
            <Card>
              <h2>By category</h2>
              <CategoryBars rows={cats} />
            </Card>
          )}

          {pets.length > 0 && (
            <Card>
              <h2>By pet</h2>
              <ul className="list">
                {pets.map((r) => {
                  const p = petById.get(r.petId);
                  return (
                    <li key={r.petId || 'shared'} className="list-row">
                      {p ? <PetAvatar pet={p} size={36} /> : <span className="member-dot" aria-hidden="true"><Icon name="users" size={18} /></span>}
                      <span className="grow">{p ? p.name : 'Shared or no pet'}</span>
                      <span className="money">{formatMoney(r.total)}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card>
            <h2>Last 6 months</h2>
            <TrendChart points={trend} selected={month} />
          </Card>

          {avg.length > 0 && (
            <Card>
              <h2>Average monthly cost per pet</h2>
              <ul className="list">
                {avg.map((a) => {
                  const p = petById.get(a.petId)!;
                  return (
                    <li key={a.petId} className="list-row">
                      <PetAvatar pet={p} size={36} />
                      <span className="grow">{p.name}</span>
                      <span className="money">{formatMoney(a.average)}</span><span className="muted small">a month</span>
                    </li>
                  );
                })}
              </ul>
              <p className="muted small" style={{ marginTop: 8 }}>Averaged over the months with spending in the last 6. Shared costs are split evenly between pets.</p>
            </Card>
          )}

          <Card>
            <div className="section-head"><h2>{monthLabel(month)} entries</h2></div>
            {monthEntries.length === 0 ? <p className="muted">Nothing logged this month.</p> : (
              <ul className="list">
                {monthEntries.map((e) => {
                  const p = e.petId ? petById.get(e.petId) : undefined;
                  const body = (
                    <>
                      <span className="grow">
                        <strong>{e.label}</strong>
                        <span className="muted small block">{EXPENSE_LABEL[e.category]} · {formatDay(e.date)}{p ? ` · ${p.name}` : ''}{e.source === 'purchase' ? ' · food purchase' : ''}</span>
                      </span>
                      <span className="money">{formatMoney(e.amount)}</span>
                    </>
                  );
                  return (
                    <li key={e.id}>
                      {e.source === 'expense' ? (
                        <button type="button" className="list-row as-button" onClick={() => setEditing(data.expenses.find((x) => x.id === e.refId) ?? null)}>{body}</button>
                      ) : (
                        <Link to={p ? `/pets/${p.id}` : '/spending'} className="list-row">{body}</Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="row-actions">
            <Button variant="secondary" icon="download" onClick={() => { downloadFile(`${slug}-spending-${today()}.csv`, spendingCsv(entries, data.pets), 'text/csv'); toast('CSV downloaded'); }}>Export spending (CSV)</Button>
          </div>
          <p className="muted small" style={{ marginTop: 12 }}>Totals include expenses you add here and any price you enter on a food purchase. Stored only on this device.</p>
        </>
      )}
      {editing && <ExpenseSheet expense={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(d) => setMonth(d.slice(0, 7))} />}
    </div>
  );
}

function ExpenseSheet({ expense, onClose, onSaved }: { expense?: Expense; onClose: () => void; onSaved: (day: string) => void }) {
  const { data, db, toast } = useApp();
  const t0 = today();
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'vet');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [date, setDate] = useState(expense?.date ?? t0);
  const [petId, setPetId] = useState<string>(expense?.petId ?? '');
  const [note, setNote] = useState(expense?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);

  const save = async () => {
    const e: Record<string, string> = {};
    const n = parseAmount(amount);
    if (n === null) e.amount = 'Enter an amount, like 24.99.';
    if (!isValidDay(date) || date > t0) e.date = 'Pick a date on or before today.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const now = nowIso();
    await db.expenses.upsert({
      ...(expense ?? { id: newId('exp-'), createdAt: now }),
      householdId: data.household?.id ?? '', category, amount: n as number, date, petId: petId || undefined, note: note.trim() || undefined, updatedAt: now,
    } as Expense);
    toast(expense ? 'Expense saved' : 'Expense added');
    onSaved(date);
    onClose();
  };

  return (
    <>
      <Sheet open={!confirm} title={expense ? 'Edit expense' : 'Add expense'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        <form className="form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
          <div className="field">
            <span className="label" id="exp-cat">Category</span>
            <div className="cat-chips" role="group" aria-labelledby="exp-cat">
              {EXPENSE_CATEGORIES.map((c) => (
                <button key={c} type="button" className={`chip ${category === c ? 'on' : ''}`} aria-pressed={category === c} onClick={() => setCategory(c)}>{EXPENSE_LABEL[c]}</button>
              ))}
            </div>
          </div>
          <TextField label="Amount ($)" value={amount} onChange={setAmount} inputMode="decimal" error={errors.amount} placeholder="0.00" />
          <TextField label="Date" type="date" value={date} onChange={setDate} error={errors.date} />
          <div className="chip-row" role="group" aria-label="Quick dates">
            {[{ label: 'Today', d: t0 }, { label: 'Yesterday', d: addDays(t0, -1) }].map((c) => (
              <button key={c.label} type="button" className={`chip ${date === c.d ? 'on' : ''}`} aria-pressed={date === c.d} onClick={() => setDate(c.d)}>{c.label}</button>
            ))}
          </div>
          {data.pets.length > 0 && (
            <div className="field">
              <span className="label" id="exp-pet">Pet (optional)</span>
              <div className="pet-chips" role="group" aria-labelledby="exp-pet">
                <button type="button" className={`pet-chip ${petId === '' ? 'on' : ''}`} aria-pressed={petId === ''} onClick={() => setPetId('')} style={{ paddingLeft: 14 }}>Shared</button>
                {data.pets.map((p) => (
                  <button key={p.id} type="button" className={`pet-chip ${petId === p.id ? 'on' : ''}`} aria-pressed={petId === p.id} onClick={() => setPetId(p.id)}>
                    <PetAvatar pet={p} size={30} /><span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <TextField label="Note (optional)" value={note} onChange={setNote} maxLength={120} placeholder="Annual checkup" />
          {expense?.isSample && <p className="small"><Badge tone="sample">Sample</Badge> This is a sample expense.</p>}
          {expense && <div className="row-actions"><Button variant="danger" icon="trash" onClick={() => setConfirm(true)}>Delete</Button></div>}
          <button type="submit" hidden />
        </form>
      </Sheet>
      <Confirm open={confirm} title="Delete this expense?" onCancel={() => setConfirm(false)} onConfirm={async () => { if (expense) await db.expenses.remove(expense.id); toast('Expense deleted'); onClose(); }} />
    </>
  );
}
