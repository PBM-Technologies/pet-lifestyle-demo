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
  /**
   * Food type ids (src/content/foodTypes.ts) to show a Shop link under in Create a plate.
   * Leave out to show it only under the common shelf types (dry, wet and treats).
   */
  foodTypes?: string[];
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
import type { SitterProvider } from '../lib/sitters';

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
  /** Shown as real text under the full logo, so it always matches this file. */
  tagline: 'Patching it all together for pet parents.',
  description:
    'One place for your pet\'s whole life: care records, pet-friendly places, trips, events and treat boxes. For dog and cat people alike.',
  logoSvg: LOGO_SVG,
  /** Square dog and cat mark for headers and icons. */
  logoDataUri: MARK_WEBP,
  /** Full logo with the wordmark. The tagline is rendered as text below it (see BrandLogo). */
  fullLogoDataUri: FULL_LOGO_WEBP,
  colors: {
    light: {
      primary: '#1f3a63',
      primaryStrong: '#152a4a',
      onPrimary: '#ffffff',
      accent: '#e8907c',
      accentSoft: '#fbe6df',
      onAccent: '#3a1d16',
      background: '#fdfcf8',
      surface: '#ffffff',
      surfaceAlt: '#e8edf5',
      text: '#1c2a3f',
      textMuted: '#5a6678',
      border: '#d9dfe9',
      danger: '#b3261e',
      warning: '#8a5a00',
      success: '#2e6b4f',
    },
    dark: {
      primary: '#a9c1e8',
      primaryStrong: '#c3d4f0',
      onPrimary: '#0d1a2e',
      accent: '#f0a594',
      accentSoft: '#3b2722',
      onAccent: '#2a140e',
      background: '#0f141d',
      surface: '#18202c',
      surfaceAlt: '#202b3b',
      text: '#e7ecf4',
      textMuted: '#a3afc2',
      border: '#33405a',
      danger: '#ffb4ab',
      warning: '#f2c56b',
      success: '#8fc7ae',
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
  /**
   * Pet sitter services linked from Find a sitter. Home pages only: none of
   * them has a public booking API, so the app links out and the user books on
   * their site. Services and species are a rough guide for which buttons to
   * show; check each site for what is offered nearby. See src/lib/sitters.ts
   * for where a real search or booking integration would plug in.
   */
  sitterProviders: [
    {
      id: 'rover',
      name: 'Rover',
      services: ['boarding', 'house_sitting', 'drop_in', 'dog_walking', 'day_care'],
      species: ['dog', 'cat'],
      url: 'https://www.rover.com',
    },
    {
      id: 'wag',
      name: 'Wag!',
      services: ['dog_walking', 'drop_in', 'house_sitting', 'boarding'],
      species: ['dog'],
      url: 'https://wagwalking.com',
    },
    {
      id: 'care-com',
      name: 'Care.com pet care',
      services: ['house_sitting', 'drop_in', 'dog_walking', 'boarding'],
      species: ['dog', 'cat', 'other'],
      url: 'https://www.care.com/pet-care',
    },
  ] as SitterProvider[],
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
