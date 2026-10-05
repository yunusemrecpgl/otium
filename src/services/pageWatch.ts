import { externalGet } from './externalSources';
import { normalizeWatchedText } from '../domain/pageWatch';
import { resolveJsonDotPath } from './webData';
import { EXTERNAL_RESPONSE_LIMITS, EXTERNAL_TEXT_LIMIT } from '../constants/externalSources';
import { readJsonWithLimit, readTextWithLimit } from './boundedResponse';

export interface PageWatchRead { value?: string; error?: string }
function selectText(document: Document, selector: string): PageWatchRead {
  if (!selector.trim()) return { error: 'Enter a CSS selector.' };
  let element: Element | null;
  try { element = document.querySelector(selector.trim()); }
  catch { return { error: 'Invalid CSS selector.' }; }
  if (!element) return { error: 'Selector not found in the returned HTML.' };
  const value = normalizeWatchedText(element.textContent ?? '');
  return value ? { value } : { error: 'Selected element has no text.' };
}

export async function fetchPageWatch(url: string, selector: string, signal: AbortSignal): Promise<string> {
  const [result] = await fetchPageWatchFields(url, [selector], signal);
  if (result.error) throw new Error(result.error);
  return result.value!;
}
export async function fetchPageWatchFields(url: string, selectors: string[], signal: AbortSignal): Promise<PageWatchRead[]> {
  const response = await externalGet(url, signal);
  const html = await readTextWithLimit(response, EXTERNAL_RESPONSE_LIMITS.html, signal, EXTERNAL_TEXT_LIMIT);
  if (!html.trim()) throw new Error('Page returned an empty response.');
  // Detached, inert document: never attach remote nodes to the application.
  const document = new DOMParser().parseFromString(html, 'text/html');
  return selectors.map(selector => selectText(document, selector));
}
export async function fetchPageWatchDirectFields(url: string, paths: string[], signal: AbortSignal, onResponse?: (json: unknown) => void): Promise<PageWatchRead[]> {
  const response = await externalGet(url, signal, 'error');
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (type && type !== 'application/json' && !type.endsWith('+json')) throw new Error('Endpoint must return JSON.');
  const json = await readJsonWithLimit(response, EXTERNAL_RESPONSE_LIMITS.json, signal, EXTERNAL_TEXT_LIMIT);
  onResponse?.(json);
  return paths.map(path => {
    try {
      const value = resolveJsonDotPath(json, path);
      return { value: normalizeWatchedText(typeof value === 'string' ? value : JSON.stringify(value) ?? 'null') };
    }
    catch (cause) { return { error: cause instanceof Error ? cause.message : 'JSON path could not be read.' }; }
  });
}
