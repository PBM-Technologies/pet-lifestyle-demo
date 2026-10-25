import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND, brandTokensCss, buildManifest } from '../src/config/brand';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('brand config', () => {
  it('is the only source file that names the product, tagline or partners', () => {
    const files = [...walk('src'), 'index.html', 'vite.config.ts'].filter((f) => !f.endsWith(join('config', 'brand.ts')));
    for (const f of files) {
      const s = readFileSync(f, 'utf8');
      expect(s.includes(BRAND.name), `${f} hardcodes the name`).toBe(false);
      expect(s.includes(BRAND.tagline), `${f} hardcodes the tagline`).toBe(false);
      for (const p of BRAND.partners) expect(s.includes(p.name), `${f} hardcodes ${p.name}`).toBe(false);
      for (const p of BRAND.sitterProviders) expect(s.includes(p.name), `${f} hardcodes ${p.name}`).toBe(false);
    }
  });
  it('has no em dashes in UI source', () => {
    for (const f of walk('src')) expect(readFileSync(f, 'utf8').includes('—'), f).toBe(false);
  });
  it('builds tokens and manifest from config', () => {
    expect(brandTokensCss()).toContain(`--c-primary:${BRAND.colors.light.primary}`);
    expect(brandTokensCss()).toContain('prefers-color-scheme: dark');
    expect(buildManifest().name).toBe(BRAND.name);
  });
  it('links sitter providers to their home pages only', () => {
    expect(BRAND.sitterProviders.map((p) => p.url)).toEqual(['https://www.rover.com', 'https://wagwalking.com', 'https://www.care.com/pet-care']);
    for (const p of BRAND.sitterProviders) expect(p.buildSearchUrl).toBeUndefined();
  });
  it('lists the two optional partners with real sites only', () => {
    expect(BRAND.partners.map((p) => p.url)).toEqual(['https://healthextension.com', 'https://snugarooz.com']);
  });
});
