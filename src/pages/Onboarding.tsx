import { useState } from 'react';
import { BRAND } from '../config/brand';
import type { Pet, Species } from '../contracts/domain';
import { newId, nowIso } from '../lib/dates';
import { useApp } from '../state';
import { Button, ChoiceGroup, TextField } from '../ui/kit';
import { navigate } from '../router';

export function Onboarding() {
  const { db, toast } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
  const [household, setHousehold] = useState('');
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('dog');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const finish = async (withPet: boolean) => {
    if (withPet && !name.trim()) {
      setErrors({ name: 'Give your pet a name, or skip for now.' });
      return;
    }
    setBusy(true);
    const now = nowIso();
    const hid = newId('hh-');
    try {
      if (withPet) {
        const pet: Pet = { id: newId('pet-'), householdId: hid, name: name.trim(), species, allergies: [], weightUnit: 'lb', createdAt: now, updatedAt: now };
        await db.pets.upsert(pet);
      }
      await db.households.upsert({ id: hid, name: household.trim() || 'My household', createdAt: now, updatedAt: now });
      toast(`Welcome to ${BRAND.name}`);
      navigate('/', true);
    } catch {
      setErrors({ form: 'Could not save. Please try again.' });
      setBusy(false);
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding-hero">
        <img className="full-logo" src={BRAND.fullLogoDataUri} alt="" width={320} height={230} />
        <h1 className="sr-only">{BRAND.name}</h1>
        <p className="sr-only">{BRAND.tagline}</p>
      </div>
      <div className="card onboarding-card">
        <p className="step-label">Step {step} of 2</p>
        {step === 1 ? (
          <form onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
            <h2>What should we call your household?</h2>
            <p className="muted">Your profile lives on this device. No password needed.</p>
            <TextField label="Household name" value={household} onChange={setHousehold} placeholder="The Parkers" autoFocus maxLength={60} />
            <Button type="submit" className="block">Continue</Button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void finish(true); }}>
            <h2>Add your first pet</h2>
            <TextField label="Pet name" value={name} onChange={(v) => { setName(v); setErrors({}); }} placeholder="Bailey" autoFocus error={errors.name} maxLength={40} />
            <ChoiceGroup<Species> label="Species" value={species} onChange={setSpecies} columns={3} options={[{ value: 'dog', label: 'Dog' }, { value: 'cat', label: 'Cat' }, { value: 'other', label: 'Other' }]} />
            {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
            <div className="row-actions">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button variant="secondary" onClick={() => void finish(false)} disabled={busy}>Skip for now</Button>
              <Button type="submit" disabled={busy}>Get started</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
