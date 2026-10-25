/**
 * Single source of truth for product identity.
 *
 * The product name is not final. Every occurrence of the name, tagline,
 * colors, logo and partner list lives in this file. The page title, meta
 * tags, design tokens, web app manifest and in-app copy all read from here
 * (vite.config.ts injects the HTML and manifest pieces at build time), so a
 * rename is a one-file change.
 */

export interface PartnerBrand {
  id: string;
  name: string;
  /** Plain description of what the partner makes. No product names, no prices. */
  description: string;
  url: string;
  /** Which kinds of pets the partner is relevant to. */
  species: Array<'dog' | 'cat' | 'other'>;
  category: 'food_and_treats' | 'toys';
}

export interface ColorSet {
  primary: string;
  primaryStrong: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  warning: string;
  success: string;
}

const PAW_LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" rx="16" fill="#244b40"/>' +
  '<g fill="#f6f5f1">' +
  '<ellipse cx="32" cy="41" rx="11" ry="9.5"/>' +
  '<ellipse cx="19" cy="29" rx="4.6" ry="6" transform="rotate(-18 19 29)"/>' +
  '<ellipse cx="27.5" cy="21" rx="4.6" ry="6.2" transform="rotate(-6 27.5 21)"/>' +
  '<ellipse cx="36.5" cy="21" rx="4.6" ry="6.2" transform="rotate(6 36.5 21)"/>' +
  '<ellipse cx="45" cy="29" rx="4.6" ry="6" transform="rotate(18 45 29)"/>' +
  '</g>' +
  '<circle cx="48" cy="48" r="6" fill="#e9895c"/>' +
  '</svg>';

export const BRAND = {
  /** Working product name. Not final. */
  name: 'Wanderpaw',
  /** Short name for the home screen icon label. */
  shortName: 'Wanderpaw',
  tagline: 'Life with your pets, mapped out.',
  description:
    'One place for your pet\'s whole life: care records, pet-friendly places, trips, events and treat boxes. For dog and cat people alike.',
  logoSvg: PAW_LOGO_SVG,
  logoDataUri: 'data:image/svg+xml,' + encodeURIComponent(PAW_LOGO_SVG),
  colors: {
    light: {
      primary: '#244b40',
      primaryStrong: '#1a382f',
      onPrimary: '#ffffff',
      accent: '#e9895c',
      accentSoft: '#fbe7dc',
      onAccent: '#2a1a12',
      background: '#f6f5f1',
      surface: '#ffffff',
      surfaceAlt: '#eaf0e8',
      text: '#22302a',
      textMuted: '#5d6e64',
      border: '#d9ddd5',
      danger: '#b3261e',
      warning: '#8a5a00',
      success: '#2e6b4f',
    },
    dark: {
      primary: '#8cc7ae',
      primaryStrong: '#a8d8c2',
      onPrimary: '#0f241d',
      accent: '#f0a07a',
      accentSoft: '#3a2a22',
      onAccent: '#24140c',
      background: '#121815',
      surface: '#1b2420',
      surfaceAlt: '#22312a',
      text: '#e8ede9',
      textMuted: '#a5b3aa',
      border: '#33423b',
      danger: '#ffb4ab',
      warning: '#f2c56b',
      success: '#8cc7ae',
    },
  } satisfies { light: ColorSet; dark: ColorSet },
  /** Optional shop partners. Linked out only; the app identity stays brand-neutral. */
  partners: [
    {
      id: 'health-extension',
      name: 'Health Extension',
      description: 'Premium natural pet food and treats.',
      url: 'https://healthextension.com',
      species: ['dog', 'cat'],
      category: 'food_and_treats',
    },
    {
      id: 'snugarooz',
      name: 'SnugArooz',
      description: 'Plush pet toys.',
      url: 'https://snugarooz.com',
      species: ['dog', 'cat'],
      category: 'toys',
    },
  ] as PartnerBrand[],
} as const;

/** Builds the CSS custom properties for both themes from BRAND.colors. */
export function brandTokensCss(): string {
  const toVars = (set: ColorSet) =>
    Object.entries(set)
      .map(([k, v]) => `--c-${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v};`)
      .join('');
  return (
    `:root{${toVars(BRAND.colors.light)}color-scheme:light;}` +
    `@media (prefers-color-scheme: dark){:root{${toVars(BRAND.colors.dark)}color-scheme:dark;}}`
  );
}

/** Web app manifest, written to dist at build time. */
export function buildManifest() {
  return {
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: BRAND.tagline,
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: BRAND.colors.light.background,
    theme_color: BRAND.colors.light.primary,
    icons: [
      { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
