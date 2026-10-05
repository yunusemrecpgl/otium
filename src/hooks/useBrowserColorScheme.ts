import { useEffect, useState } from 'react';
import type { Theme } from '../domain/settings';

// Browser preference is independent of Otium's saved workspace theme.
export function useBrowserColorScheme(): Theme {
  const [scheme, setScheme] = useState<Theme>(() => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      const next = media.matches ? 'dark' : 'light';
      setScheme(next);
      const action = (globalThis as typeof globalThis & { chrome?: {
        action?: { setIcon(details: { path: Record<number, string> }): Promise<void> };
      } }).chrome?.action;
      if (!action) return;
      const tone = next === 'dark' ? 'white' : 'black';
      void action.setIcon({ path: { 16: `otium-action-${tone}-16.png`, 32: `otium-action-${tone}-32.png` } })
        .catch(cause => console.warn('Browser action icon could not be updated.', cause));
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return scheme;
}
