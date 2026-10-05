import { normalizeUrl } from '../utils/url';

interface OriginPermissions {
  contains(details: { origins: string[] }): Promise<boolean>;
  request(details: { origins: string[] }): Promise<boolean>;
  onRemoved: {
    addListener(listener: (details: { origins?: string[] }) => void): void;
    removeListener(listener: (details: { origins?: string[] }) => void): void;
  };
}
function permissions(): OriginPermissions | undefined {
  const chrome = (globalThis as typeof globalThis & {
    chrome?: { runtime?: { id?: string }; permissions?: OriginPermissions };
  }).chrome;
  return chrome?.runtime?.id ? chrome.permissions : undefined;
}
function originPattern(input: string): string | null {
  const normalized = normalizeUrl(input);
  if (!normalized) return null;
  return `${new URL(normalized).origin}/*`;
}
export async function hasOriginAccess(url: string): Promise<boolean> {
  const origin = originPattern(url), api = permissions();
  if (!origin || !api) return false;
  try { return await api.contains({ origins: [origin] }); } catch { return false; }
}
// Invoke directly from a click handler: do not await anything before request().
export function requestOriginAccess(url: string): Promise<boolean> {
  const origin = originPattern(url), api = permissions();
  if (!origin || !api) return Promise.resolve(false);
  try { return api.request({ origins: [origin] }).catch(() => false); }
  catch { return Promise.resolve(false); }
}
export class OriginAccessRequiredError extends Error {
  readonly url: string;
  constructor(url: string) {
    super(`Access required for ${new URL(url).hostname}`);
    this.url = url;
    this.name = 'OriginAccessRequiredError';
  }
}
export function subscribeOriginAccessRemoved(url: string, retry: () => void): () => void {
  const api = permissions();
  let active = true;
  const removed = (details: { origins?: string[] }) => {
    if (!details.origins?.length) return;
    void hasOriginAccess(url).then(granted => { if (active && !granted) retry(); });
  };
  api?.onRemoved.addListener(removed);
  return () => { active = false; api?.onRemoved.removeListener(removed); };
}
export async function externalGet(url: string, signal: AbortSignal, redirect: RequestRedirect = 'follow'): Promise<Response> {
  const normalized = normalizeUrl(url);
  if (!normalized) throw new Error('Enter a public HTTP/HTTPS source URL.');
  let response: Response;
  try {
    response = await fetch(normalized, { signal, credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors', redirect });
  } catch {
    if (signal.aborted) throw new Error('Request cancelled or timed out.');
    if (permissions() && !await hasOriginAccess(normalized)) throw new OriginAccessRequiredError(normalized);
    throw new Error('Source unavailable. Check the URL and network; the source may block access.');
  }
  if (!response.ok) throw new Error(`Source unavailable (HTTP ${response.status}).`);
  return response;
}
