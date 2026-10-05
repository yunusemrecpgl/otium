import { normalizeUrl } from './url';

export function buildTextFragmentUrl(sourceUrl: string, text: string, prefix?: string, suffix?: string): string | undefined {
  try {
    const source = normalizeUrl(sourceUrl);
    const selected = text.replace(/\s+/g, ' ').trim();
    if (!source || !selected) return undefined;
    // Hyphens are syntax in fragment directives, unlike ordinary URI encoding.
    const encode = (value: string) => encodeURIComponent(value).replace(/-/g, '%2D');
    const words = selected.split(' ');
    const range = selected.length > 240 && words.length > 16;
    const start = range ? words.slice(0, 8).join(' ') : selected;
    const end = range ? `,${encode(words.slice(-8).join(' '))}` : '';
    const before = prefix?.replace(/\s+/g, ' ').trim();
    const after = suffix?.replace(/\s+/g, ' ').trim();
    const directive = `${before ? `${encode(before)}-,` : ''}${encode(start)}${end}${after ? `,-${encode(after)}` : ''}`;
    const url = new URL(source);
    // Preserve any ordinary anchor; replace existing fragment directives.
    const anchor = url.hash.split(':~:')[0];
    url.hash = `${anchor}:~:text=${directive}`;
    return url.href;
  } catch { return undefined; }
}

export function clipSourceUrl(sourceUrl: string, textFragmentUrl?: string): string | null {
  const source = normalizeUrl(sourceUrl);
  if (!source) return null;
  const fragment = textFragmentUrl && normalizeUrl(textFragmentUrl);
  if (!fragment) return source;
  const base = new URL(source), target = new URL(fragment);
  return base.origin === target.origin && base.pathname === target.pathname && base.search === target.search &&
    target.hash.includes(':~:text=') ? fragment : source;
}
