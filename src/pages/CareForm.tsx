import { useState } from 'react';
import type { CareEvent, CareEventType, Pet } from '../contracts/domain';
import { CARE_TYPE_LABEL } from '../lib/care';
import { addDays, addYears, isValidDay, newId, nowIso, today } from '../lib/dates';
import { useApp } from '../state';
import { Button, ChoiceGroup, SheetPicker, Sheet, TextField } from '../ui/kit';

const TYPE_OPTIONS = (Object.keys(CARE_TYPE_LABEL) as CareEventType[]).map((t) => ({ value: t, label: CARE_TYPE_LABEL[t] }));

const DEFAULT_TITLE: Partial<Record<CareEventType, string>> = {
  flea_tick: 'Flea and tick preventive',
  heartworm: 'Heartworm preventive',
  vet_visit: 'Checkup',
  grooming: 'Grooming',
  weight: 'Weight',
};

const REPEAT_OPTIONS = [
  { value: '0', label: 'Does not repeat' },
  { value: '30', label: 'Monthly' },
  { value: '90', label: 'Every 3 months' },
  { value: '365', label: 'Yearly' },
];

export function CareFormSheet({ open, onClose, pet, initialType = 'vaccine', event }: { open: boolean; onClose: () => void; pet: Pet; initialType?: CareEventType; event?: CareEvent }) {
  const { db, toast } = useApp();
  const [type, setType] = useState<CareEventType>(event?.type ?? initialType);
  const [title, setTitle] = useState(event?.title ?? DEFAULT_TITLE[initialType] ?? '');
  const [date, setDate] = useState(event?.date ?? today());
  const [dueDate, setDueDate] = useState(event?.dueDate ?? '');
  const [repeat, setRepeat] = useState(String(event?.repeatDays ?? (initialType === 'flea_tick' || initialType === 'heartworm' ? 30 : 0)));
  const [value, setValue] = useState(event?.value !== undefined ? String(event.value) : '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const scheduled = ['vaccine', 'medication', 'flea_tick', 'heartworm', 'vet_visit', 'grooming'].includes(type);

  const save = async () => {
    const e: Record<string, string> = {};
    const t = type === 'weight' ? 'Weight' : title.trim();
    if (!t) e.title = 'Add a short title.';
    if (!isValidDay(date)) e.date = 'Pick a date.';
    if (dueDate && !isValidDay(dueDate)) e.dueDate = 'Pick a valid due date.';
    if (dueDate && isValidDay(date) && dueDate < date) e.dueDate = 'Due date should be after the date given.';
    const v = value.trim() ? Number(value) : undefined;
    if (type === 'weight' && (v === undefined || !Number.isFinite(v) || v <= 0 || v > 400)) e.value = 'Enter a weight.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const now = nowIso();
    const rd = Number(repeat) || undefined;
    const rec: CareEvent = {
      ...(event ?? { id: newId('care-'), createdAt: now }),
      householdId: pet.householdId,
      petId: pet.id,
      type,
      title: t,
      date,
      // follow-up dates on notes (from a saved photo check) are kept when the note is edited
      dueDate: scheduled ? (dueDate || (rd ? addDays(date, rd) : undefined)) : type === 'note' ? event?.dueDate : undefined,
      repeatDays: scheduled ? rd : undefined,
      value: type === 'weight' ? v : undefined,
      notes: notes.trim() || undefined,
      updatedAt: now,
    } as CareEvent;
    await db.careEvents.upsert(rec);
    if (type === 'weight' && v !== undefined) {
      const latest = (await db.careEvents.list((c) => c.petId === pet.id && c.type === 'weight')).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (latest?.id === rec.id) await db.pets.upsert({ ...pet, weight: v, updatedAt: now });
    }
    toast(event ? 'Record updated' : `${CARE_TYPE_LABEL[type]} saved`);
    onClose();
  };

  return (
    <Sheet open={open} title={event ? 'Edit record' : `Add care for ${pet.name}`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <form className="form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
        <SheetPicker<CareEventType> label="Type" value={type} options={TYPE_OPTIONS} onChange={(t) => { setType(t); if (!title || Object.values(DEFAULT_TITLE).includes(title)) setTitle(DEFAULT_TITLE[t] ?? ''); if (t === 'flea_tick' || t === 'heartworm') setRepeat('30'); }} />
        {type !== 'weight' && (
          <TextField label={type === 'vaccine' ? 'Vaccine' : type === 'note' ? 'Title' : 'Name'} value={title} onChange={setTitle} error={errors.title}
            placeholder={type === 'vaccine' ? (pet.species === 'cat' ? 'Rabies, FVRCP' : 'Rabies, DHPP, Bordetella') : type === 'medication' ? 'Name and dose' : ''} />
        )}
        {type === 'weight' && <TextField label={`Weight (${pet.weightUnit ?? 'lb'})`} value={value} onChange={setValue} inputMode="decimal" error={errors.value} />}
        <TextField label={type === 'note' ? 'Date' : 'Date given or done'} type="date" value={date} onChange={setDate} error={errors.date} />
        {scheduled && (
          <>
            <ChoiceGroup label="Repeats" value={repeat} onChange={setRepeat} columns={2} options={REPEAT_OPTIONS} />
            <TextField label="Next due date" type="date" value={dueDate} onChange={setDueDate} error={errors.dueDate} hint={Number(repeat) ? 'Leave blank to calculate from the repeat.' : 'Optional. Used for reminders.'} />
            {type === 'vaccine' && !dueDate && (
              <div className="chip-row">
                <button type="button" className="chip" onClick={() => setDueDate(addYears(date, 1))}>Due in 1 year</button>
                <button type="button" className="chip" onClick={() => setDueDate(addYears(date, 3))}>Due in 3 years</button>
              </div>
            )}
          </>
        )}
        <TextField label="Notes" value={notes} onChange={setNotes} multiline />
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
