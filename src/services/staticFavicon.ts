import { hasOriginAccess } from './externalSources';
import { getBrowserFaviconUrl } from './permissions';
import { getFaviconUrl } from '../utils/favicon';
import { normalizeUrl } from '../utils/url';
import { EXTERNAL_RESPONSE_LIMITS } from '../constants/externalSources';
import { readBytesWithLimit } from './boundedResponse';

type CachedIcon = { result: string | null; promise: Promise<string | null>; expires: number };
const icons = new Map<string, CachedIcon>();
const limit = 256;
let accessRevision = -1;
export function refreshFaviconAccess(revision: number) {
  if (revision === accessRevision) return;
  accessRevision = revision;
  // A permission change permits one retry; retain successful static snapshots.
  for (const [source, entry] of icons) {
    if (!entry.result && entry.expires !== Infinity) icons.delete(source);
  }
}

// Image decoding disables SVG scripting; only the canvas-generated PNG is displayed.
function snapshot(source: string): Promise<string | null> {
  return new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = 'anonymous'; image.referrerPolicy = 'no-referrer';
    const finish = (result: string | null) => {
      clearTimeout(timeout); image.onload = null; image.onerror = null; image.src = ''; resolve(result);
    };
    const timeout = setTimeout(() => finish(null), 8000);
    image.onerror = () => finish(null);
    image.onload = () => {
      try {
        if (!image.naturalWidth || !image.naturalHeight) { finish(null); return; }
        const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
        const context = canvas.getContext('2d');
        if (!context) { finish(null); return; }
        const ratio = Math.min(32 / image.naturalWidth, 32 / image.naturalHeight);
        const width = image.naturalWidth * ratio, height = image.naturalHeight * ratio;
        context.drawImage(image, (32 - width) / 2, (32 - height) / 2, width, height);
        finish(canvas.toDataURL('image/png'));
      } catch { finish(null); }
    };
    image.src = source;
  });
}
async function sourceSnapshot(source: string): Promise<string | null> {
  // Browser favicon images and same-origin images can be decoded locally.
  if (new URL(source).origin === location.origin) return snapshot(source);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let local: string | undefined;
  try {
    const response = await fetch(source, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', mode: 'cors' });
    if (!response.ok) return null;
    const type = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!type.startsWith('image/')) { await response.body?.cancel().catch(() => {}); return null; }
    const blob = new Blob([await readBytesWithLimit(response, EXTERNAL_RESPONSE_LIMITS.favicon, controller.signal)], { type });
    local = URL.createObjectURL(blob);
    return await snapshot(local);
  } catch { return null; }
  finally { clearTimeout(timeout); if (local) URL.revokeObjectURL(local); }
}
function cachedSnapshot(source: string): Promise<string | null> {
  const cached = icons.get(source);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const entry: CachedIcon = { result: null, promise: Promise.resolve(null), expires: Infinity };
  entry.promise = sourceSnapshot(source).then(result => {
    entry.result = result; entry.expires = Date.now() + (result ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000); return result;
  });
  icons.delete(source); icons.set(source, entry);
  if (icons.size > limit) icons.delete(icons.keys().next().value!);
  return entry.promise;
}
export async function resolveStaticFavicon(input: string, faviconUrl?: string): Promise<string | null> {
  const page = normalizeUrl(input);
  if (!page) return null;
  const sources = [...new Set([getBrowserFaviconUrl(page), normalizeUrl(faviconUrl ?? ''), getFaviconUrl(page)]
    .filter((source): source is string => !!source))];
  const allowed: string[] = [];
  for (const source of sources) {
    const sourceUrl = new URL(source);
    if (sourceUrl.origin === location.origin ||
      (['https:', 'http:'].includes(sourceUrl.protocol) && await hasOriginAccess(source))) allowed.push(source);
  }
  for (const source of allowed) {
    const cached = icons.get(source);
    if (cached?.result && cached.expires > Date.now()) return cached.result;
  }
  for (const source of allowed) {
    const result = await cachedSnapshot(source);
    if (result) return result;
  }
  return null;
}
