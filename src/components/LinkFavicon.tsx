import { useState } from 'react';
import { getTitleInitial } from '../utils/favicon';
import { useStaticFavicon } from '../hooks/useStaticFavicon';
import { normalizeUrl } from '../utils/url';

export function LinkFavicon({ title, url }: { title: string; url?: string }) {
  const page = normalizeUrl(url ?? '');
  const source = useStaticFavicon(page ?? undefined);
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const initial = page ? new URL(page).hostname.replace(/^www\./i, '') : title;
  const resolved = !!source && source !== failed && loaded === source;
  return <span className="link-icon icon-content-slot" data-resolved={resolved} aria-hidden="true">
    <span className="icon-fallback">{getTitleInitial(initial)}</span>
    {source && source !== failed && <img key={source} className="icon-resolved" src={source} alt="" draggable={false}
      onLoad={() => setLoaded(source)} onError={() => setFailed(source)} />}
  </span>;
}
