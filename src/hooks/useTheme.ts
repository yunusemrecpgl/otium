import { useEffect, useLayoutEffect, useState } from 'react';
import type { Theme, ThemePreference } from '../domain/settings';

export function useTheme(preference?: ThemePreference) {
  const [cachedPreference] = useState<ThemePreference>(() => {
    try {
      const cached = localStorage.getItem('otium:first-paint-theme');
      if (cached === 'light' || cached === 'dark' || cached === 'system') return cached;
    } catch { /* The cache is optional. */ }
    return 'system';
  });
  const [systemTheme, setSystemTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemTheme(media.matches ? 'dark' : 'light');
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const effectivePreference = preference ?? cachedPreference;
  const theme = effectivePreference === 'system' ? systemTheme : effectivePreference;
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (preference !== undefined) {
      try { localStorage.setItem('otium:first-paint-theme', preference); } catch { /* Optional first-paint hint. */ }
    }
  }, [preference, theme]);
  return theme;
}
