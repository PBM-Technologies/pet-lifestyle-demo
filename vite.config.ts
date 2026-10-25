import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { BRAND, buildManifest } from './src/config/brand';

/**
 * Injects brand values from src/config/brand.ts into index.html and emits
 * manifest.webmanifest + icon.svg, so identity lives in one file.
 * The manifest is also inlined as a data URI so the single-file build works
 * from disk; on a static host the emitted files are used.
 */
function brandPlugin(): Plugin {
  const manifestJson = JSON.stringify(buildManifest(), null, 2);
  const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return {
    name: 'brand',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
      const values: Record<string, string> = {
        BRAND_TITLE: `${BRAND.name}: ${BRAND.tagline}`,
        BRAND_NAME: BRAND.name,
        BRAND_SHORT: BRAND.shortName,
        BRAND_DESCRIPTION: BRAND.description,
        BRAND_THEME: BRAND.colors.light.primary,
        BRAND_THEME_DARK: BRAND.colors.dark.background,
        BRAND_ICON: BRAND.logoDataUri,
        BRAND_MANIFEST: 'manifest.webmanifest',
      };
      return html.replace(/%(BRAND_[A-Z_]+)%/g, (m, k: string) => (k in values ? escapeAttr(values[k]) : m));
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifestJson });
      this.emitFile({ type: 'asset', fileName: 'icon.svg', source: BRAND.logoSvg });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith('/manifest.webmanifest')) {
          res.setHeader('Content-Type', 'application/manifest+json');
          res.end(manifestJson);
          return;
        }
        if (req.url?.endsWith('/icon.svg')) {
          res.setHeader('Content-Type', 'image/svg+xml');
          res.end(BRAND.logoSvg);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), brandPlugin(), viteSingleFile({ removeViteModuleLoader: true })],
  build: { target: 'es2020', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 2000 },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'] },
});
