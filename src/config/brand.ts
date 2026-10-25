/**
 * Single source of truth for product identity.
 *
 * Every occurrence of the name, tagline,
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

import { FULL_LOGO_WEBP, MARK_PNG_B64, MARK_WEBP } from './brandAssets';

/** App icon: the dog and cat mark on cream, wrapped in SVG so icon.svg keeps working. */
const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">' +
  '<rect width="256" height="256" rx="56" fill="#fdfcf8"/>' +
  '<image width="256" height="256" href="data:image/png;base64,' + MARK_PNG_B64 + '"/>' +
  '</svg>';

export const BRAND = {
  /** Product name. */
  name: 'Patches',
  /** Short name for the home screen icon label. */
  shortName: 'Patches',
  tagline: "Your pet's world, all in one place.",
  description:
    'One place for your pet\'s whole life: care records, pet-friendly places, trips, events and treat boxes. For dog and cat people alike.',
  logoSvg: LOGO_SVG,
  /** Square dog and cat mark for headers and icons. */
  logoDataUri: MARK_WEBP,
  /** Full logo with wordmark and tagline. */
  fullLogoDataUri: FULL_LOGO_WEBP,
  colors: {
    light: {
      primary: '#44787a',
      primaryStrong: '#2f5f62',
      onPrimary: '#ffffff',
      accent: '#e8907c',
      accentSoft: '#fbe6df',
      onAccent: '#3a1d16',
      background: '#fdfcf8',
      surface: '#ffffff',
      surfaceAlt: '#e7f1ee',
      text: '#22393a',
      textMuted: '#5c7273',
      border: '#d8e4e0',
      danger: '#b3261e',
      warning: '#8a5a00',
      success: '#2e6b5f',
    },
    dark: {
      primary: '#8fc6c2',
      primaryStrong: '#acd8d4',
      onPrimary: '#0f2425',
      accent: '#f0a594',
      accentSoft: '#3b2722',
      onAccent: '#2a140e',
      background: '#111818',
      surface: '#1a2323',
      surfaceAlt: '#213030',
      text: '#e8efee',
      textMuted: '#a3b4b3',
      border: '#334443',
      danger: '#ffb4ab',
      warning: '#f2c56b',
      success: '#8fc6c2',
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
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}
