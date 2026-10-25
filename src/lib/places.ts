import type { PlaceCategory, PlaceListing, SavedPlace } from '../contracts/domain';

export const PLACE_CATEGORIES: Array<{ id: PlaceCategory; label: string; icon: string }> = [
  { id: 'dog_park', label: 'Dog park', icon: 'tree' },
  { id: 'cat_cafe', label: 'Cat cafe', icon: 'cup' },
  { id: 'hotel', label: 'Hotel', icon: 'bed' },
  { id: 'campground', label: 'Campground', icon: 'tent' },
  { id: 'restaurant_patio', label: 'Restaurant patio', icon: 'fork' },
  { id: 'store', label: 'Store', icon: 'bag' },
  { id: 'vet', label: 'Vet', icon: 'cross' },
  { id: 'groomer', label: 'Groomer', icon: 'scissors' },
];

export const categoryLabel = (c: PlaceCategory) => PLACE_CATEGORIES.find((x) => x.id === c)?.label ?? c;

export interface PlaceFilter {
  query?: string;
  category?: PlaceCategory | 'all' | 'saved';
  species?: 'dog' | 'cat' | 'any';
}

/** Search, category and species filtering. Saved favorites float to the top, then name order. */
export function filterPlaces(places: PlaceListing[], saved: SavedPlace[], f: PlaceFilter): PlaceListing[] {
  const fav = new Set(saved.filter((s) => s.favorite).map((s) => s.placeId));
  const q = (f.query ?? '').trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];
  return places
    .filter((p) => {
      if (f.category === 'saved') {
        if (!fav.has(p.id)) return false;
      } else if (f.category && f.category !== 'all' && p.category !== f.category) return false;
      if (f.species === 'dog' && p.policy.dogsAllowed === false) return false;
      if (f.species === 'cat' && p.policy.catsAllowed === false) return false;
      if (terms.length) {
        const hay = [p.name, categoryLabel(p.category), p.address, p.city, p.description].join(' ').toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return false;
      }
      return true;
    })
    .sort((a, b) => Number(fav.has(b.id)) - Number(fav.has(a.id)) || a.name.localeCompare(b.name));
}

/** Policy verification label. Only the user can verify; the app never claims it. */
export function verificationLabel(place: PlaceListing, saved: SavedPlace | undefined, fmt: (d: string) => string): { verified: boolean; text: string } {
  const at = place.isSample ? saved?.verifiedAt : place.policy.verifiedAt ?? saved?.verifiedAt;
  if (at) return { verified: true, text: `Verified on ${fmt(at)} by you` };
  return { verified: false, text: 'Unverified, call ahead' };
}

export function yesNoUnknown(v: boolean | null | undefined): string {
  return v === true ? 'Yes' : v === false ? 'No' : 'Unknown';
}
