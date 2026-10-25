import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './state';
import { BRAND, brandTokensCss } from './config/brand';
import { registerServiceWorker } from './pwa';
import './styles/app.css';

// Brand tokens come from brand.ts so colors live in one file.
const style = document.createElement('style');
style.id = 'brand-tokens';
style.textContent = brandTokensCss();
document.head.prepend(style);
document.title = `${BRAND.name}: ${BRAND.tagline}`;

// Manifest is a sibling file on static hosts; skip it when opened from disk.
try {
  if (/^https?:$/.test(location.protocol) && !document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'manifest.webmanifest';
    document.head.appendChild(link);
  }
} catch {
  /* ignore */
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <AppProvider>
        <App />
      </AppProvider>
    </StrictMode>,
  );
}

registerServiceWorker();
