import { useMemo, useState } from 'react';
import { useApp } from '../state';
import { Link } from '../router';
import { Icon } from '../ui/Icon';
import { Card, ChoiceGroup, EmptyState, PageHeader, PetAvatar } from '../ui/kit';
import { Meter } from '../ui/photo';
import { BREEDS, SIZE_LABEL, breedBySlug, findBreed, type BreedInfo, type Level } from '../content/breeds';
import { DEFAULT_PREFS, recommendBreeds, type MatchPrefs } from '../lib/recommend';

export const SHELTER_NOTE = 'Shelters and rescues have every breed and mixes; adoption is a great place to start.';

type Filter = 'apartment' | 'kids' | 'pets' | 'low_shed' | 'low_groom' | 'calm';
const FILTERS: Array<{ id: Filter; label: string; test: (b: BreedInfo) => boolean }> = [
  { id: 'apartment', label: 'Apartment friendly', test: (b) => b.apartment },
  { id: 'kids', label: 'Good with kids', test: (b) => b.goodWithKids },
  { id: 'pets', label: 'Good with other pets', test: (b) => b.goodWithPets },
  { id: 'low_shed', label: 'Low shedding', test: (b) => b.shedding === 1 },
  { id: 'low_groom', label: 'Easy grooming', test: (b) => b.grooming === 1 },
  { id: 'calm', label: 'Calm', test: (b) => b.energy === 1 },
];

const weight = (b: BreedInfo) => `${b.weightLb[0]} to ${b.weightLb[1]} lb`;

export function BreedsPage() {
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return BREEDS.filter((b) => b.species === species)
      .filter((b) => !t || b.name.toLowerCase().includes(t) || (b.aliases ?? []).some((a) => a.toLowerCase().includes(t)))
      .filter((b) => filters.every((f) => FILTERS.find((x) => x.id === f)!.test(b)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [species, q, filters]);

  return (
    <div className="page">
      <PageHeader title="Breed guide" subtitle="Dogs and cats, in plain words" backTo="/more" />
      <Card className="breed-cta">
        <div className="mini-head"><Icon name="heart" /><h2>Find your match</h2></div>
        <p className="small muted">Answer a few taps about your home and routine to see breeds that fit.</p>
        <div className="row-actions" style={{ marginTop: 4 }}>
          <Link to="/breeds/match" className="btn btn-primary"><span>Find your match</span><Icon name="chevron" size={18} /></Link>
          <Link to="/identify" className="btn btn-secondary"><Icon name="camera" size={20} /><span>Identify from a photo</span></Link>
        </div>
      </Card>
      <div className="seg" role="tablist" aria-label="Species">
        {(['dog', 'cat'] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={species === s} className={species === s ? 'on' : ''} onClick={() => setSpecies(s)}>
            {s === 'dog' ? `Dogs (${BREEDS.filter((b) => b.species === 'dog').length})` : `Cats (${BREEDS.filter((b) => b.species === 'cat').length})`}
          </button>
        ))}
      </div>
      <label className="search">
        <Icon name="search" size={20} />
        <input aria-label="Search breeds" placeholder={species === 'dog' ? 'Search dog breeds' : 'Search cat breeds'} value={q} onChange={(e) => setQ(e.target.value)} type="search" />
      </label>
      <div className="chip-scroll" role="group" aria-label="Filter breeds">
        {FILTERS.map((f) => {
          const on = filters.includes(f.id);
          return <button key={f.id} type="button" className={`chip subtle ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setFilters(on ? filters.filter((x) => x !== f.id) : [...filters, f.id])}>{f.label}</button>;
        })}
      </div>
      {list.length === 0 ? (
        <EmptyState icon="search" title="No breeds match">Try fewer filters or a different search.</EmptyState>
      ) : (
        <ul className="menu card breed-list" aria-label={`${list.length} breeds`}>
          {list.map((b) => (
            <li key={b.slug}>
              <Link to={`/breeds/${b.slug}`} className="menu-row">
                <span className={`menu-icon ${b.species === 'cat' ? 'cat' : ''}`}><Icon name="paw" /></span>
                <span className="grow">
                  <strong>{b.name}</strong>
                  <span className="muted small block">{SIZE_LABEL[b.size]} · {weight(b)} · energy {['low', 'medium', 'high'][b.energy - 1]}</span>
                </span>
                <Icon name="chevron" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">{SHELTER_NOTE}</p>
    </div>
  );
}

function YesNo({ v, yes = 'Usually', no = 'Needs care' }: { v: boolean; yes?: string; no?: string }) {
  return <span className={`yn ${v ? 'yes' : 'no'}`}><Icon name={v ? 'check' : 'info'} size={16} />{v ? yes : no}</span>;
}

export function BreedDetailPage({ slug }: { slug: string }) {
  const { data } = useApp();
  const b = breedBySlug(slug);
  if (!b) return <div className="page"><PageHeader title="Breed not found" backTo="/breeds" /><EmptyState title="We do not have that breed yet"><Link to="/breeds" className="text-link">Back to the breed guide</Link></EmptyState></div>;
  const mine = data.pets.filter((p) => findBreed(p.breed, p.species)?.slug === b.slug);
  const lvl = (label: string, v: Level, words?: [string, string, string]) => <div><dt>{label}</dt><dd><Meter value={v} label={label} words={words} /></dd></div>;
  return (
    <div className="page">
      <PageHeader title={b.name} subtitle={`${b.species === 'dog' ? 'Dog' : 'Cat'} · ${SIZE_LABEL[b.size]}`} backTo="/breeds" />
      <Card>
        <p style={{ margin: 0 }}>{b.description}</p>
      </Card>
      <Card>
        <h2>At a glance</h2>
        <dl className="facts breed-facts">
          <div><dt>Size</dt><dd>{SIZE_LABEL[b.size]}</dd></div>
          <div><dt>Typical weight</dt><dd>{weight(b)}</dd></div>
          {lvl('Energy', b.energy)}
          {lvl('Shedding', b.shedding)}
          {lvl('Grooming', b.grooming)}
          {b.trainability && lvl('Trainability', b.trainability, ['Independent', 'Moderate', 'Eager'])}
          {lvl('Vocal', b.vocal, ['Quiet', 'Some', 'Chatty'])}
          <div><dt>Good with kids</dt><dd><YesNo v={b.goodWithKids} no="Best with older kids" /></dd></div>
          <div><dt>Good with other pets</dt><dd><YesNo v={b.goodWithPets} no="Slow intros" /></dd></div>
          <div><dt>Apartment friendly</dt><dd><YesNo v={b.apartment} yes="Yes" no="Better with space" /></dd></div>
        </dl>
      </Card>
      <Card>
        <div className="mini-head"><Icon name="cross" /><h2>Health watch-outs</h2></div>
        <ul className="bullets small">{b.health.map((h) => <li key={h}>{h}</li>)}</ul>
        <p className="muted small" style={{ margin: '8px 0 0' }}>General breed tendencies, not a prediction for any one pet. Ask your vet what to watch for.</p>
      </Card>
      <Card>
        <div className="mini-head"><Icon name="info" /><h2>Good to know</h2></div>
        <ul className="bullets small">{b.goodToKnow.map((g) => <li key={g}>{g}</li>)}</ul>
      </Card>
      <Card>
        <h2>Your pets of this breed</h2>
        {mine.length === 0 ? <p className="muted small" style={{ margin: 0 }}>None of your pets are listed as {b.name}.</p> : (
          <ul className="list">
            {mine.map((p) => <li key={p.id}><Link to={`/pets/${p.id}`} className="list-row"><PetAvatar pet={p} size={40} /><span className="grow"><strong>{p.name}</strong></span><Icon name="chevron" size={18} /></Link></li>)}
          </ul>
        )}
      </Card>
      <div className="row-actions">
        <Link to="/breeds/match" className="btn btn-secondary"><Icon name="heart" size={20} /><span>Find your match</span></Link>
        <Link to="/identify" className="btn btn-secondary"><Icon name="camera" size={20} /><span>Identify from a photo</span></Link>
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>{SHELTER_NOTE}</p>
    </div>
  );
}

export function BreedMatchPage() {
  const [p, setP] = useState<MatchPrefs>(DEFAULT_PREFS);
  const set = <K extends keyof MatchPrefs>(k: K, v: MatchPrefs[K]) => setP((cur) => ({ ...cur, [k]: v }));
  const yn = (v: boolean) => (v ? 'yes' : 'no');
  const results = recommendBreeds(p);
  return (
    <div className="page">
      <PageHeader title="Find your match" subtitle="Breeds that fit your home and routine" backTo="/breeds" />
      <Card>
        <ChoiceGroup<MatchPrefs['species']> label="Looking for" value={p.species} columns={3} onChange={(v) => set('species', v)}
          options={[{ value: 'dog', label: 'Dog' }, { value: 'cat', label: 'Cat' }, { value: 'either', label: 'Either' }]} />
        <ChoiceGroup<MatchPrefs['home']> label="Home" value={p.home} columns={2} onChange={(v) => set('home', v)}
          options={[{ value: 'apartment', label: 'Apartment' }, { value: 'house', label: 'House with yard' }]} />
        <ChoiceGroup<'1' | '2' | '3'> label="Your activity level" value={String(p.activity) as '1' | '2' | '3'} columns={3} onChange={(v) => set('activity', Number(v) as Level)}
          options={[{ value: '1', label: 'Relaxed' }, { value: '2', label: 'Moderate' }, { value: '3', label: 'Very active' }]} />
        <ChoiceGroup<'yes' | 'no'> label="Kids at home" value={yn(p.kids)} columns={2} onChange={(v) => set('kids', v === 'yes')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
        <ChoiceGroup<'yes' | 'no'> label="Other pets" value={yn(p.otherPets)} columns={2} onChange={(v) => set('otherPets', v === 'yes')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
        <ChoiceGroup<'1' | '2' | '3'> label="Grooming you are up for" value={String(p.grooming) as '1' | '2' | '3'} columns={3} onChange={(v) => set('grooming', Number(v) as Level)}
          options={[{ value: '1', label: 'Minimal' }, { value: '2', label: 'Some' }, { value: '3', label: 'Lots' }]} />
        <ChoiceGroup<'yes' | 'no'> label="Allergies (prefer low shedding)" value={yn(p.lowShedding)} columns={2} onChange={(v) => set('lowShedding', v === 'yes')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
        {p.lowShedding && <p className="hint" style={{ marginTop: -4 }}>No dog or cat is fully allergy free. Spend time with a breed before deciding.</p>}
      </Card>
      <h2 className="list-title" id="matches">Your top {results.length}</h2>
      <ol className="match-list" aria-labelledby="matches">
        {results.map((r, i) => (
          <li key={r.breed.slug}>
            <Card as="div" className="match-card">
              <div className="section-head">
                <h3 style={{ margin: 0 }}><span className="step-num" aria-hidden="true">{i + 1}</span> {r.breed.name}</h3>
                <span className="muted small">{r.breed.species === 'dog' ? 'Dog' : 'Cat'} · {SIZE_LABEL[r.breed.size]}</span>
              </div>
              <h4>Why this fits you</h4>
              <ul className="bullets small">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
              <Link to={`/breeds/${r.breed.slug}`} className="btn btn-ghost" aria-label={`See ${r.breed.name} details`}><span>See details</span><Icon name="chevron" size={18} /></Link>
            </Card>
          </li>
        ))}
      </ol>
      <p className="notice" role="note"><Icon name="heart" size={18} /> <span>{SHELTER_NOTE}</span></p>
    </div>
  );
}
