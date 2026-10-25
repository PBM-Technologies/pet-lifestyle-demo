/**
 * Service worker registration. Only runs when served over http(s) and the
 * sw.js file exists next to the page (GitHub Pages / static host). Opening the
 * single-file build from disk (file://) skips it entirely.
 */
export function registerServiceWorker(): void {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) return;
    if (import.meta.env.DEV) return;
    window.addEventListener('load', async () => {
      try {
        const res = await fetch('./sw.js', { method: 'HEAD', cache: 'no-store' });
        if (!res.ok) return;
        await navigator.serviceWorker.register('./sw.js', { scope: './' });
      } catch {
        /* offline support is optional */
      }
    });
  } catch {
    /* ignore */
  }
}
