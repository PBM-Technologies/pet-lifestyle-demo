import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

/** Tiny hash router so the app runs from any static host or a single local file. */

export interface RouteMatch {
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
}

export function currentPath(): string {
  const h = (typeof location !== 'undefined' ? location.hash : '') || '#/';
  const p = h.replace(/^#/, '') || '/';
  return p.startsWith('/') ? p : '/' + p;
}

function split(full: string): { path: string; query: URLSearchParams } {
  const [path, q] = full.split('?');
  return { path: path.replace(/\/+$/, '') || '/', query: new URLSearchParams(q ?? '') };
}

/** Matches "/pets/:petId" style patterns. */
export function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) {
      try {
        params[a[i].slice(1)] = decodeURIComponent(b[i]);
      } catch {
        return null;
      }
    } else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function useHashPath(): { path: string; query: URLSearchParams } {
  const [full, setFull] = useState(currentPath);
  useEffect(() => {
    const on = () => setFull(currentPath());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return split(full);
}

export function navigate(to: string, replace = false): void {
  const hash = '#' + (to.startsWith('/') ? to : '/' + to);
  if (replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}

export function back(fallback: string): void {
  if (history.length > 1 && document.referrer !== undefined && sessionStorageSafeHasNav()) history.back();
  else navigate(fallback);
}

let navCount = 0;
if (typeof window !== 'undefined') window.addEventListener('hashchange', () => (navCount += 1));
function sessionStorageSafeHasNav(): boolean {
  return navCount > 0;
}

export function href(to: string): string {
  return '#' + (to.startsWith('/') ? to : '/' + to);
}

export function Link({ to, children, ...rest }: { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={href(to)} {...rest}>
      {children}
    </a>
  );
}
