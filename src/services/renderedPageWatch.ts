import type { PageWatchRead } from './pageWatch';
import { normalizeWatchedText } from '../domain/pageWatch';
import { normalizeUrl } from '../utils/url';
import { hasOriginAccess, OriginAccessRequiredError } from './externalSources';
import { widgetCapabilityService } from './widgetCapabilities';
import { BrowserCapabilityRequiredError } from './permissions';

type SelectorResult = { text?: string; error?: 'invalid' | 'missing' | 'empty' | 'navigated' };
interface RenderedPageApi {
  tabs: { query(options: { url: string }): Promise<{ id?: number; url?: string; active?: boolean }[]> };
  scripting: { executeScript(options: {
    target: { tabId: number };
    func: (selectors: string[], expectedUrl: string) => SelectorResult[];
    args: [string[], string];
  }): Promise<{ result?: SelectorResult[] }[]> };
}
export async function readRenderedPageWatchFields(input: string, selectors: string[], signal: AbortSignal): Promise<PageWatchRead[]> {
  const url = normalizeUrl(input);
  if (!url) throw new Error('Enter a public HTTP/HTTPS page URL.');
  if (!await widgetCapabilityService.hasModeAccess('page-watch', 'rendered'))
    throw new BrowserCapabilityRequiredError(widgetCapabilityService.modeRequirements('page-watch', 'rendered'));
  const api = (globalThis as typeof globalThis & { chrome?: Partial<RenderedPageApi> }).chrome;
  if (!api?.tabs?.query || !api.scripting?.executeScript) throw new Error('Rendered mode requires the Otium browser extension.');
  if (!await hasOriginAccess(url)) throw new OriginAccessRequiredError(url);
  const expected = new URL(url); expected.hash = '';
  let results: SelectorResult[] | undefined;
  try {
    const tabs = await api.tabs.query({ url: `${expected.origin}/*` });
    const tab = tabs.filter(tab => {
      if (!tab.url || tab.id === undefined) return false;
      try { const candidate = new URL(tab.url); candidate.hash = ''; return candidate.href === expected.href; }
      catch { return false; }
    }).sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)))[0];
    if (signal.aborted) throw new Error('Request cancelled or timed out.');
    if (tab?.id === undefined) throw new Error('Open this page in a browser tab to read rendered content.');
    const [result] = await api.scripting.executeScript({
      target: { tabId: tab.id }, args: [selectors, expected.href],
      // Chrome serializes this self-contained function into its isolated world.
      func: (cssSelectors, expectedUrl) => {
        const current = new URL(location.href); current.hash = '';
        if (current.href !== expectedUrl) return cssSelectors.map(() => ({ error: 'navigated' }));
        return cssSelectors.map(cssSelector => {
          if (!cssSelector.trim()) return { error: 'invalid' };
          let element: Element | null;
          try { element = document.querySelector(cssSelector); }
          catch { return { error: 'invalid' }; }
          if (!element) return { error: 'missing' };
          const text = element.textContent ?? '';
          return text.trim() ? { text } : { error: 'empty' };
        });
      },
    });
    results = result?.result;
  } catch (cause) {
    if (signal.aborted) throw new Error('Request cancelled or timed out.');
    if (!await widgetCapabilityService.hasModeAccess('page-watch', 'rendered'))
      throw new BrowserCapabilityRequiredError(widgetCapabilityService.modeRequirements('page-watch', 'rendered'));
    if (!await hasOriginAccess(url)) throw new OriginAccessRequiredError(url);
    if (cause instanceof Error && cause.message === 'Open this page in a browser tab to read rendered content.') throw cause;
    throw new Error('Rendered page is unavailable. Open the page and try Refresh.');
  }
  if (signal.aborted) throw new Error('Request cancelled or timed out.');
  if (!results || results.length !== selectors.length || results.some(result => result.error === 'navigated'))
    throw new Error('Rendered page is unavailable. Open the page and try Refresh.');
  return results.map(result => {
    if (result.error === 'invalid') return { error: 'Invalid CSS selector.' };
    if (result.error === 'missing') return { error: 'Selector not found. The page may still be rendering; try Refresh.' };
    if (result.error === 'empty') return { error: 'Selected element has no text.' };
    return result.text === undefined ? { error: 'Rendered value is unavailable.' } : { value: normalizeWatchedText(result.text) };
  });
}
