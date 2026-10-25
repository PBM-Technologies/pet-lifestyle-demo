import { useRef, useState } from 'react';
import { BRAND } from '../config/brand';
import { useApp } from '../state';
import { Link, navigate } from '../router';
import { Button, Card, Confirm, PageHeader, PetAvatar, TextField, downloadFile } from '../ui/kit';
import { careEventsCsv, deleteAll, ensureSeeded, exportAll, importAll, ImportError, loadSamplePets, removeSamplePets } from '../data/db';
import { nowIso, today } from '../lib/dates';
import { Icon } from '../ui/Icon';

export function AccountPage() {
  const { data, db, toast } = useApp();
  const [name, setName] = useState(data.household?.name ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmImport, setConfirmImport] = useState<unknown>(null);
  const [importErr, setImportErr] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const slug = BRAND.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <div className="page">
      <PageHeader title="Account" subtitle="Your household and data" backTo="/more" />
      <Card>
        <h2>Household</h2>
        <form className="form" onSubmit={async (e) => { e.preventDefault(); if (!data.household || !name.trim()) return; await db.households.upsert({ ...data.household, name: name.trim(), updatedAt: nowIso() }); toast('Household saved'); }}>
          <TextField label="Household name" value={name} onChange={setName} maxLength={60} />
          <Button type="submit" variant="secondary">Save</Button>
        </form>
        <p className="muted small">Profile stored on this device only.{db.store.volatile ? ' Storage is unavailable in this browser, so changes last only until you close the tab.' : ''} Sign in and sync across devices are coming.</p>
      </Card>
      <Card>
        <div className="section-head"><h2>Pets</h2><Link to="/pets?add=1" className="text-link">Add pet</Link></div>
        {data.pets.length === 0 ? <p className="muted">No pets yet.</p> : (
          <ul className="list">
            {data.pets.map((p) => <li key={p.id}><Link to={`/pets/${p.id}`} className="list-row"><PetAvatar pet={p} size={40} /><span className="grow"><strong>{p.name}</strong>{p.isSample && <span className="muted small"> (sample)</span>}</span><Icon name="chevron" size={18} /></Link></li>)}
          </ul>
        )}
        <div className="row-actions">
          {data.pets.some((p) => p.isSample)
            ? <Button variant="secondary" onClick={async () => { await removeSamplePets(db); toast('Sample pets removed'); }}>Remove sample pets</Button>
            : <Button variant="secondary" onClick={async () => { if (data.household) { await loadSamplePets(db, data.household.id); toast('Sample pets loaded'); } }}>Load sample pets</Button>}
        </div>
      </Card>
      <Card>
        <h2>Your data</h2>
        <p className="muted small">Download a copy any time. JSON includes everything; CSV has care records for your vet or a spreadsheet.</p>
        <div className="stack">
          <Button variant="secondary" icon="download" onClick={async () => { const b = await exportAll(db, BRAND.name); downloadFile(`${slug}-export-${today()}.json`, JSON.stringify(b, null, 2), 'application/json'); toast('Export downloaded'); }}>Export all data (JSON)</Button>
          <Button variant="secondary" icon="download" onClick={() => { downloadFile(`${slug}-care-records-${today()}.csv`, careEventsCsv(data.care, data.pets), 'text/csv'); toast('CSV downloaded'); }}>Export care records (CSV)</Button>
          <Button variant="secondary" icon="upload" onClick={() => fileRef.current?.click()}>Import from JSON</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="visually-hidden" aria-label="Choose export file to import"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setImportErr(undefined);
              try { setConfirmImport(JSON.parse(await f.text())); } catch { setImportErr('That file is not valid JSON.'); }
            }} />
          {importErr && <p className="field-error" role="alert">{importErr}</p>}
        </div>
      </Card>
      <Card className="danger-zone">
        <h2>Delete all data</h2>
        <p className="muted small">Removes your household, pets, records, places, trips, events, posts and box plans from this device. Export first if you want a copy.</p>
        <Button variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>Delete everything</Button>
      </Card>
      <Confirm open={!!confirmImport} title="Replace your data?" confirmLabel="Import" body="Importing replaces everything currently on this device with the file's contents." onCancel={() => setConfirmImport(null)}
        onConfirm={async () => {
          try { const r = await importAll(db, confirmImport); toast(`Imported ${r.pets} pet${r.pets === 1 ? '' : 's'}, ${r.places} place${r.places === 1 ? '' : 's'}, ${r.trips} trip${r.trips === 1 ? '' : 's'}`); setConfirmImport(null); navigate('/', true); }
          catch (x) { setImportErr(x instanceof ImportError ? x.message : 'Import failed.'); setConfirmImport(null); }
        }} />
      <Confirm open={confirmDelete} title="Delete all data?" confirmLabel="Delete everything" body="This cannot be undone." onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => { await deleteAll(db); await ensureSeeded(db); setConfirmDelete(false); navigate('/', true); }} />
    </div>
  );
}
