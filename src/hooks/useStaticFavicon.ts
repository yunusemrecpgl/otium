import { useEffect, useState, useSyncExternalStore } from 'react';
import { faviconPermission } from '../services/permissions';
import { refreshFaviconAccess, resolveStaticFavicon } from '../services/staticFavicon';

export function useStaticFavicon(pageUrl?: string, sourceUrl?: string): string | null {
  const access = useSyncExternalStore(faviconPermission.subscribe, faviconPermission.getAccessSnapshot);
  const key = `${pageUrl ?? ''}|${sourceUrl ?? ''}|${access}`;
  const [result, setResult] = useState<{ key: string; url: string | null } | null>(null);
  useEffect(() => {
    let active = true;
    refreshFaviconAccess(access);
    if (pageUrl) void resolveStaticFavicon(pageUrl, sourceUrl).then(url => {
      if (active) setResult({ key, url });
    }).catch(() => { if (active) setResult({ key, url: null }); });
    return () => { active = false; };
  }, [pageUrl, sourceUrl, key, access]);
  return result?.key === key ? result.url : null;
}
