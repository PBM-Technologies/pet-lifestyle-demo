import { useState } from 'react';
import type { Pet, Species } from '../contracts/domain';
import { isValidDay, newId, nowIso, today } from '../lib/dates';
import { parseList } from '../lib/boxes';
import { CALORIE_HELP } from '../lib/feeding';
import { useApp } from '../state';
import { Button, ChoiceGroup, PhotoInput, Sheet, TextField } from '../ui/kit';
import { IdentifyPanel } from './Identify';

export function PetFormSheet({ open, onClose, pet, onSaved }: { open: boolean; onClose: () => void; pet?: Pet; onSaved?: (p: Pet) => void }) {
  const { db, data, toast } = useApp();
  const [name, setName] = useState(pet?.name ?? '');
  const [species, setSpecies] = useState<Species>(pet?.species ?? 'dog');
  const [breed, setBreed] = useState(pet?.breed ?? '');
  const [birthDate, setBirthDate] = useState(pet?.birthDate ?? '');
  const [weight, setWeight] = useState(pet?.weight !== undefined ? String(pet.weight) : '');
  const [unit, setUnit] = useState<'lb' | 'kg'>(pet?.weightUnit ?? 'lb');
  const [photo, setPhoto] = useState<string | undefined>(pet?.photo);
  const [allergies, setAllergies] = useState((pet?.allergies ?? []).join(', '));
  const [diet, setDiet] = useState(pet?.dietaryNotes ?? '');
  const [microchip, setMicrochip] = useState(pet?.microchip ?? '');
  const [vetName, setVetName] = useState(pet?.vetName ?? '');
  const [vetPhone, setVetPhone] = useState(pet?.vetPhone ?? '');
  const [quirks, setQuirks] = useState(pet?.quirks ?? '');
  const [calories, setCalories] = useState(pet?.dailyCalorieTarget !== undefined ? String(pet.dailyCalorieTarget) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [identifying, setIdentifying] = useState(false);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required.';
    if (birthDate && (!isValidDay(birthDate) || birthDate > today())) e.birthDate = 'Pick a real date in the past.';
    const w = weight.trim() ? Number(weight) : undefined;
    if (w !== undefined && (!Number.isFinite(w) || w <= 0 || w > 400)) e.weight = 'Enter a weight between 0 and 400.';
    const kcal = calories.trim() ? Number(calories) : undefined;
    if (kcal !== undefined && !(Number.isFinite(kcal) && kcal >= 50 && kcal <= 10000)) e.calories = 'Enter calories between 50 and 10000, or leave it blank.';
    if (microchip && !/^[0-9A-Za-z\s-]{6,20}$/.test(microchip)) e.microchip = 'Microchip numbers are usually 9 to 15 letters or digits.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const now = nowIso();
    const next: Pet = {
      ...(pet ?? { id: newId('pet-'), createdAt: now, householdId: data.household?.id ?? '' }),
      name: name.trim(),
      species,
      breed: breed.trim() || undefined,
      birthDate: birthDate || undefined,
      weight: w,
      weightUnit: unit,
      photo,
      allergies: parseList(allergies),
      dietaryNotes: diet.trim() || undefined,
      microchip: microchip.trim() || undefined,
      vetName: vetName.trim() || undefined,
      vetPhone: vetPhone.trim() || undefined,
      dailyCalorieTarget: kcal,
      quirks: quirks.trim() || undefined,
      updatedAt: now,
    } as Pet;
    try {
      await db.pets.upsert(next);
      // record weight history when weight changes
      if (w !== undefined && w !== pet?.weight) {
        await db.careEvents.upsert({ id: newId('care-'), householdId: next.householdId, petId: next.id, type: 'weight', title: 'Weight', date: today(), value: w, createdAt: now, updatedAt: now });
      }
      toast(pet ? 'Pet updated' : `${next.name} added`);
      onSaved?.(next);
      onClose();
    } catch {
      setErrors({ form: 'Could not save. Storage may be full; try a smaller photo.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Sheet
      open={open && !identifying}
      title={pet ? `Edit ${pet.name}` : 'Add a pet'}
      onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving' : 'Save pet'}</Button></>}
    >
      <form onSubmit={(ev) => { ev.preventDefault(); void save(); }} className="form">
        <PhotoInput label="Photo" value={photo} onChange={setPhoto} />
        <TextField label="Name" value={name} onChange={setName} error={errors.name} required maxLength={40} />
        <ChoiceGroup<Species> label="Species" value={species} onChange={setSpecies} columns={3} options={[{ value: 'dog', label: 'Dog' }, { value: 'cat', label: 'Cat' }, { value: 'other', label: 'Other' }]} />
        <TextField label="Breed" value={breed} onChange={setBreed} placeholder={species === 'cat' ? 'Domestic Shorthair' : species === 'dog' ? 'Mixed breed' : 'Rabbit, bird, reptile'} />
        {species !== 'other' && <div style={{ marginTop: -6, marginBottom: 10 }}><Button variant="ghost" icon="camera" onClick={() => setIdentifying(true)}>Identify breed from photo</Button></div>}
        <TextField label="Birth date" type="date" value={birthDate} onChange={setBirthDate} error={errors.birthDate} hint="An estimate is fine." />
        <div className="field-row">
          <TextField label="Weight" value={weight} onChange={setWeight} inputMode="decimal" error={errors.weight} />
          <ChoiceGroup<'lb' | 'kg'> label="Unit" value={unit} onChange={setUnit} columns={2} options={[{ value: 'lb', label: 'lb' }, { value: 'kg', label: 'kg' }]} />
        </div>
        <TextField label="Allergies" value={allergies} onChange={setAllergies} placeholder="Chicken, beef" hint="Separate with commas. Used to prefill box restrictions." />
        <TextField label="Diet notes" value={diet} onChange={setDiet} multiline />
        <TextField label="Daily calorie target (optional)" value={calories} onChange={setCalories} inputMode="numeric" error={errors.calories} hint={CALORIE_HELP} />
        <TextField label="Quirks and habits (for sitters)" value={quirks} onChange={setQuirks} multiline maxLength={800} placeholder="Hides under the bed during storms. Pulls toward squirrels." />
        <TextField label="Microchip number" value={microchip} onChange={setMicrochip} error={errors.microchip} inputMode="numeric" />
        <div className="field-row">
          <TextField label="Vet name" value={vetName} onChange={setVetName} />
          <TextField label="Vet phone" type="tel" value={vetPhone} onChange={setVetPhone} inputMode="tel" />
        </div>
        {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
        <button type="submit" hidden />
      </form>
    </Sheet>
    <Sheet open={open && identifying} title="Identify breed from photo" onClose={() => setIdentifying(false)}>
      <IdentifyPanel compact onUse={(b, sp) => { setBreed(b); if (sp !== 'other') setSpecies(sp); setIdentifying(false); }} />
    </Sheet>
    </>
  );
}
