import { useState } from 'react';
import { useApp } from '../state';
import { Button, Card, Confirm, EmptyState, PageHeader, PetAvatar, PetMultiSelect, PhotoInput, Sheet, TextField } from '../ui/kit';
import { formatDay, newId, nowIso, toDay } from '../lib/dates';
import { Icon } from '../ui/Icon';

export function CommunityPage() {
  const { data, db, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const posts = [...data.posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const petsById = new Map(data.pets.map((p) => [p.id, p]));

  return (
    <div className="page">
      <PageHeader title="Community" subtitle="Your pet feed" backTo="/more" actions={<Button icon="plus" onClick={() => setOpen(true)}>New post</Button>} />
      <p className="notice small"><Icon name="info" size={18} /> This feed is private to this device for now. Sharing with friends and local pet people comes with accounts.</p>
      {posts.length === 0 ? (
        <EmptyState icon="camera" title="No posts yet" action={<Button icon="plus" onClick={() => setOpen(true)}>Share a moment</Button>}>Snap a nap, a zoomie or a first swim and keep it here.</EmptyState>
      ) : (
        <ul className="feed">
          {posts.map((p) => (
            <li key={p.id}>
              <Card as="article" className="post">
                {p.photo && <img src={p.photo} alt={p.caption ? `Photo: ${p.caption}` : 'Pet photo'} className="post-img" />}
                <div className="post-body">
                  <div className="post-pets">
                    {p.petIds.map((id) => petsById.get(id)).filter(Boolean).map((pet) => pet && <span key={pet.id} className="pet-inline-item small"><PetAvatar pet={pet} size={24} />{pet.name}</span>)}
                    <span className="muted small">{formatDay(toDay(new Date(p.createdAt)))}</span>
                  </div>
                  {p.caption && <p>{p.caption}</p>}
                  <Button variant="ghost" icon="trash" onClick={() => setConfirm(p.id)}>Delete</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {open && <PostSheet onClose={() => setOpen(false)} />}
      <Confirm open={!!confirm} title="Delete this post?" onCancel={() => setConfirm(null)} onConfirm={async () => { if (confirm) await db.posts.remove(confirm); setConfirm(null); toast('Post deleted'); }} />
    </div>
  );
}

function PostSheet({ onClose }: { onClose: () => void }) {
  const { db, data, toast } = useApp();
  const [photo, setPhoto] = useState<string>();
  const [caption, setCaption] = useState('');
  const [petIds, setPetIds] = useState<string[]>(data.pets.length === 1 ? [data.pets[0].id] : []);
  const [err, setErr] = useState<string>();
  const save = async () => {
    if (!photo && !caption.trim()) return setErr('Add a photo or a caption.');
    const now = nowIso();
    try {
      await db.posts.upsert({ id: newId('post-'), householdId: data.household?.id ?? '', petIds, caption: caption.trim(), photo, createdAt: now, updatedAt: now });
      toast('Posted to your feed');
      onClose();
    } catch {
      setErr('Could not save. Storage may be full.');
    }
  };
  return (
    <Sheet open title="New post" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Post</Button></>}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <PhotoInput label="Photo" value={photo} onChange={(v) => { setPhoto(v); setErr(undefined); }} maxSide={1000} />
        <TextField label="Caption" value={caption} onChange={(v) => { setCaption(v); setErr(undefined); }} multiline maxLength={500} />
        <PetMultiSelect label="Who is in it" pets={data.pets} value={petIds} onChange={setPetIds} />
        {err && <p className="field-error" role="alert">{err}</p>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
