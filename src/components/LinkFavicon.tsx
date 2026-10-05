import { useState } from 'react';
import { getTitleInitial } from '../utils/favicon';
import { useStaticFavicon } from '../hooks/useStaticFavicon';
import { normalizeUrl } from '../utils/url';

export function LinkFavicon({ title, url }: { title: string; url?: string }) {
  const page = normalizeUrl(url ?? '');
  const source = useStaticFavicon(page ?? undefined);
  const [failed, setFailed] = useState<string | null>(null);
  const initial = page ? new URL(page).hostname.replace(/^www\./i, '') : title;
  return <span className="link-icon" aria-hidden="true">
    {source && source !== failed ? <img src={source} alt="" draggable={false} onError={() => setFailed(source)} /> : getTitleInitial(initial)}
  </span>;
}
