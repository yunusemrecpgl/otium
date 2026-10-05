import { externalGet } from './externalSources';
import { normalizeUrl } from '../utils/url';
import { EXTERNAL_RESPONSE_LIMITS, EXTERNAL_TEXT_LIMIT } from '../constants/externalSources';
import { readTextWithLimit } from './boundedResponse';

export interface FeedArticle { title: string; url: string | null; date?: string }
const child = (element: Element, name: string) => Array.from(element.children).find(node => node.localName === name);
const content = (element: Element, name: string) => child(element, name)?.textContent?.trim() ?? '';
function baseUrl(element: Element, parent: string): string {
  try { return new URL(element.getAttribute('xml:base') || parent, parent).href; } catch { return parent; }
}
function articleUrl(value: string, base: string): string | null {
  try { return value.trim() ? normalizeUrl(new URL(value.trim(), base).href) : null; } catch { return null; }
}
export function parsePublicFeed(xml: string, sourceUrl: string): FeedArticle[] {
  if (xml.length > EXTERNAL_TEXT_LIMIT || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Feed XML is unsupported or too large.');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('Feed XML could not be parsed.');
  const root = document.documentElement;
  const atom = root.localName === 'feed';
  const channel = root.localName === 'rss' ? child(root, 'channel') : undefined;
  if (!atom && !channel) throw new Error('Expected an RSS 2.0 or Atom feed.');
  const container = channel ?? root;
  const rootBase = baseUrl(root, sourceUrl);
  const base = container === root ? rootBase : baseUrl(container, rootBase);
  return Array.from(container.children).filter(node => node.localName === (atom ? 'entry' : 'item')).map(entry => {
    const link = atom ? Array.from(entry.children).find(node => node.localName === 'link' && (!node.getAttribute('rel') || node.getAttribute('rel') === 'alternate'))?.getAttribute('href') ?? ''
      : content(entry, 'link');
    const date = atom ? content(entry, 'published') || content(entry, 'updated') : content(entry, 'pubDate');
    return { title: content(entry, 'title') || 'Untitled article', url: articleUrl(link, baseUrl(entry, base)),
      ...(date && Number.isFinite(Date.parse(date)) ? { date } : {}) };
  });
}
export async function fetchPublicFeed(url: string, signal: AbortSignal): Promise<FeedArticle[]> {
  const response = await externalGet(url, signal);
  return parsePublicFeed(await readTextWithLimit(response, EXTERNAL_RESPONSE_LIMITS.rss, signal, EXTERNAL_TEXT_LIMIT), response.url || url);
}
