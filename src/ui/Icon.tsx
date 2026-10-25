import type { SVGProps } from 'react';

const PATHS: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm3.5 5.5-2 5-5 2 2-5z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 0v14m6-12v14',
  paw: 'M12 13c-3 0-5.5 2.6-5.5 4.8 0 1.5 1.3 2.2 2.6 2.2 1.1 0 1.9-.6 2.9-.6s1.8.6 2.9.6c1.3 0 2.6-.7 2.6-2.2C17.5 15.6 15 13 12 13zM6.5 7.5a2 2.5 0 1 0 0 .01zM10 4.5a2 2.5 0 1 0 0 .01zM14 4.5a2 2.5 0 1 0 0 .01zM17.5 7.5a2 2.5 0 1 0 0 .01z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zm4 3a2 2 0 0 0 4 0',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  trash: 'M5 7h14M10 7V4h4v3m-7 0 1 13h8l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-6 9c0-3.3 2.7-6 6-6s6 2.7 6 6m1-9a3 3 0 1 0 0-6m2 15c0-2.4-1.2-4.4-3-5.4',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zm9 0v13M12 7c-1-3-5-3-5-1s3 1 5 1zm0 0c1-3 5-3 5-1s-3 1-5 1z',
  bag: 'M5 8h14l-1 12H6zm4 0V6a3 3 0 0 1 6 0v2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8c0-3.9 3.1-7 7-7s7 3.1 7 7',
  pin: 'M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  syringe: 'M15 3l6 6m-3-3-9 9-3 1 1-3 9-9m-6 6 3 3M4 20l3-3',
  pill: 'M8.5 15.5l7-7a3.5 3.5 0 0 0-5-5l-7 7a3.5 3.5 0 0 0 5 5zM7 7l5 5',
  scale: 'M5 20h14l-2-12H7zM9 8a3 3 0 0 1 6 0',
  note: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h4',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z',
  download: 'M12 4v11m-5-5 5 5 5-5M5 20h14',
  upload: 'M12 20V9m-5 5 5-5 5 5M5 4h14',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z',
  info: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  alert: 'M12 4 2.5 20h19zM12 10v4m0 3h.01',
  external: 'M14 4h6v6m0-6-9 9M18 14v6H4V6h6',
  cross: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-13v5l3 2',
  suitcase: 'M4 8h16v12H4zM9 8V5h6v3M4 13h16',
  copy: 'M9 9h10v11H9zM15 9V4H5v11h4',
  share: 'M12 3v12M8 7l4-4 4 4M5 12v8h14v-8',
  phone: 'M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  plate: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z',
  sitter: 'M3 11.5 12 4l9 7.5M5 10v10h14V10M12 13.5c-1.6 0-3 1.3-3 2.6 0 .8.7 1.2 1.4 1.2.6 0 1-.3 1.6-.3s1 .3 1.6.3c.7 0 1.4-.4 1.4-1.2 0-1.3-1.4-2.6-3-2.6z',
};

export function Icon({ name, size = 22, ...rest }: { name: keyof typeof PATHS | string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      <path d={PATHS[name] ?? PATHS.paw} />
    </svg>
  );
}

/** Small species glyphs drawn as SVG so they render consistently and avoid emoji. */
export function SpeciesGlyph({ species, size = 28 }: { species: 'dog' | 'cat' | 'other'; size?: number }) {
  if (species === 'cat')
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <path d="M7 6l5 5h8l5-5v12a9 9 0 0 1-18 0z" fill="currentColor" opacity=".9" />
        <circle cx="12.5" cy="17" r="1.6" fill="var(--c-surface)" />
        <circle cx="19.5" cy="17" r="1.6" fill="var(--c-surface)" />
        <path d="M14.5 21.5h3l-1.5 1.5z" fill="var(--c-surface)" />
      </svg>
    );
  if (species === 'dog')
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <path d="M9 9c0-2 2-3 4-3h6c2 0 4 1 4 3v10a7 7 0 0 1-14 0z" fill="currentColor" opacity=".9" />
        <path d="M9 9 4 12c-1 3 1 7 4 7zM23 9l5 3c1 3-1 7-4 7z" fill="currentColor" />
        <circle cx="13" cy="15" r="1.5" fill="var(--c-surface)" />
        <circle cx="19" cy="15" r="1.5" fill="var(--c-surface)" />
        <ellipse cx="16" cy="20" rx="2.2" ry="1.6" fill="var(--c-surface)" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS.paw} fill="currentColor" />
    </svg>
  );
}
