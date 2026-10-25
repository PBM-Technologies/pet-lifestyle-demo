import { useState } from 'react';
import type { BreedIdResult, Confidence, Pet, Species } from '../contracts/domain';
import { useApp } from '../state';
import { Link, navigate } from '../router';
import { Icon } from '../ui/Icon';
import { Badge, Button, Card, PageHeader, PetAvatar, Sheet } from '../ui/kit';
import { NoAiNote, PhotoPicker, Thinking, useCheck, useVisionAI, type Photo } from '../ui/photo';
import { breedPrompt, cleanBreedId } from '../ai/prompts';
import { findBreed } from '../content/breeds';
import { nowIso } from '../lib/dates';

export const ID_DISCLAIMER = 'Photo ID is a best guess from looks alone. Mixed breeds are common, and a DNA test is the only sure way to know a dog or cat\'s breed.';
const CONF_LABEL: Record<Confidence, string> = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' };
const CONF_TONE: Record<Confidence, 'success' | 'accent' | 'neutral'> = { high: 'success', medium: 'accent', low: 'neutral' };
const SPECIES_WORD: Record<Species, string> = { dog: 'a dog', cat: 'a cat', other: 'not a dog or cat' };

/** Photo breed ID flow. Used on #/identify and inside the pet form. */
export function IdentifyPanel({ onUse, useLabel = 'Use this breed', compact }: { onUse?: (breed: string, species: Species) => void; useLabel?: string; compact?: boolean }) {
  const { ai, state, markOff } = useVisionAI();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const check = useCheck<BreedIdResult>(ai, markOff);
  const noAi = state === 'none';

  return (
    <div>
      {noAi && <NoAiNote />}
      <div className={compact ? '' : 'card'}>
        <p className="small muted">{ID_DISCLAIMER}</p>
        <PhotoPicker photos={photos} onChange={(p) => { setPhotos(p); check.clear(); }} disabled={noAi || state === 'checking' || check.thinking}
          hint="Up to 3 photos of the same pet. A side view and a face shot in daylight work best." />
        <Button className="block" icon="search" disabled={noAi || state !== 'ready' || photos.length === 0 || check.thinking}
          onClick={() => void check.run(breedPrompt(photos.length), photos.map((p) => p.blob), cleanBreedId)}>Identify breed</Button>
      </div>
      {check.thinking && <Thinking onCancel={check.cancel} />}
      {check.error && <p className="notice" role="alert"><Icon name="alert" size={18} /> <span>{check.error}</span></p>}
      {check.result && <BreedResults r={check.result} onUse={onUse} useLabel={useLabel} />}
    </div>
  );
}

function BreedResults({ r, onUse, useLabel }: { r: BreedIdResult; onUse?: (breed: string, species: Species) => void; useLabel: string }) {
  return (
    <section aria-label="Breed results" className="id-results">
      <p className="id-species"><Icon name="paw" size={18} /> <span>Looks like <strong>{SPECIES_WORD[r.species]}</strong></span></p>
      {r.species === 'other' ? (
        <Card><p style={{ margin: 0 }}>{r.notes || 'This photo does not look like a dog or cat. Try a clear photo of your pet.'}</p></Card>
      ) : (
        <>
          {r.mixedLikely && <p className="notice" role="note"><Icon name="heart" size={18} /> <span>Looks like a mix. Lots of pets are, and that is part of their charm.</span></p>}
          {r.topMatches.map((m, i) => {
            const guide = findBreed(m.breed, r.species);
            return (
              <Card key={i} as="article" className="match-card">
                <div className="section-head">
                  <h3 style={{ margin: 0 }}>{m.breed}</h3>
                  <Badge tone={CONF_TONE[m.confidence]}>{CONF_LABEL[m.confidence]}</Badge>
                </div>
                {m.why && <p className="small">{m.why}</p>}
                <div className="row-actions" style={{ marginTop: 4 }}>
                  {onUse && <Button variant={i === 0 ? 'primary' : 'secondary'} icon="check" onClick={() => onUse(guide?.name ?? m.breed, r.species)} aria-label={`${useLabel}: ${m.breed}`}>{useLabel}</Button>}
                  {guide && <Link to={`/breeds/${guide.slug}`} className="btn btn-ghost"><span>Breed guide</span><Icon name="chevron" size={18} /></Link>}
                </div>
              </Card>
            );
          })}
          {(r.sizeGuess || r.coatNotes) && (
            <Card>
              <dl className="facts compact">
                {r.sizeGuess && <div><dt>Size guess</dt><dd>{r.sizeGuess}</dd></div>}
                {r.coatNotes && <div><dt>Coat</dt><dd>{r.coatNotes}</dd></div>}
              </dl>
            </Card>
          )}
          {r.notes && <p className="small">{r.notes}</p>}
        </>
      )}
      <p className="muted small" role="note">{ID_DISCLAIMER}</p>
    </section>
  );
}

export function IdentifyPage({ query }: { query: URLSearchParams }) {
  const { data, db, toast } = useApp();
  const pet = data.pets.find((p) => p.id === query.get('pet'));
  const [choose, setChoose] = useState<{ breed: string; species: Species } | null>(null);

  const saveTo = async (p: Pet, breed: string) => {
    await db.pets.upsert({ ...p, breed, updatedAt: nowIso() });
    toast(`${p.name}'s breed set to ${breed}`);
    navigate(`/pets/${p.id}`);
  };
  const candidates = choose ? data.pets.filter((p) => p.species === choose.species || p.species === 'other') : [];

  return (
    <div className="page">
      <PageHeader title="Identify breed" subtitle={pet ? `From a photo of ${pet.name}` : 'From a photo of a dog or cat'} backTo={pet ? `/pets/${pet.id}` : '/more'} />
      <IdentifyPanel useLabel={pet ? `Use for ${pet.name}` : 'Use this breed'} onUse={data.pets.length ? (breed, species) => (pet ? void saveTo(pet, breed) : setChoose({ breed, species })) : undefined} />
      <p className="small"><Link to="/breeds" className="text-link">Browse the breed guide</Link></p>
      {choose && (
        <Sheet open title={`Save ${choose.breed} to`} onClose={() => setChoose(null)}>
          {candidates.length === 0 ? <p className="muted">None of your pets are {SPECIES_WORD[choose.species]}.</p> : (
            <ul className="sheet-list">
              {candidates.map((p) => (
                <li key={p.id}><button type="button" onClick={() => saveTo(p, choose.breed)}><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><PetAvatar pet={p} size={32} />{p.name}</span><Icon name="chevron" size={18} /></button></li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </div>
  );
}
