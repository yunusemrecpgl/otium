import { externalGet } from './externalSources';
import { normalizeUrl } from '../utils/url';
import { normalizeWatchedText } from '../domain/pageWatch';
import { EXTERNAL_RESPONSE_LIMITS, PAGE_WATCH_DISCOVERY_LIMITS } from '../constants/externalSources';
import { readTextWithLimit } from './boundedResponse';

export interface SourceCandidate {
  url: string; score: number; safeGet: boolean; verified?: boolean;
  path?: string; value?: string; matched?: boolean;
  suggestedPaths?: { path: string; value: string }[];
}
const MAX_SCRIPTS = PAGE_WATCH_DISCOVERY_LIMITS.scripts, MAX_CANDIDATES = PAGE_WATCH_DISCOVERY_LIMITS.candidates;
const tracking = /(?:analytics|tracking|telemetry|doubleclick|googletag|adsbygoogle|\/ads?\/)/i;
const dangerous = /(?:^|[\/_.-])(?:delete|remove|logout|signout|unsubscribe|purchase|checkout|submit|update|mutate|create)(?:$|[\/_.-])/i;
function candidateUrl(raw: string, base: string): string | null {
  if (!raw || raw.length > 500 || /[\s\\{}<>`]/.test(raw) || raw.includes('${')) return null;
  try {
    const normalized = normalizeUrl(new URL(raw, base).href);
    if (!normalized) return null;
    const url = new URL(normalized);
    if (tracking.test(url.href) || dangerous.test(url.pathname) ||
        [...url.searchParams.keys()].some(key => /token|secret|auth|password|api.?key|signature|session/i.test(key))) return null;
    url.hash = ''; return url.href;
  } catch { return null; }
}
async function boundedText(url: string, maxBytes: number, signal: AbortSignal): Promise<string> {
  if (!normalizeUrl(url)) throw new Error('Only HTTP/HTTPS sources are supported.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  const timeout = setTimeout(cancel, PAGE_WATCH_DISCOVERY_LIMITS.timeoutMs);
  try {
    const response = await externalGet(url, controller.signal, 'error');
    if (!response.body) throw new Error('Source response is empty.');
    return await readTextWithLimit(response, maxBytes, controller.signal);
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', cancel); }
}
function numericValue(text: string): number | null {
  if (text.length > 200) return null;
  const match = /^([+-]?\d[\d.,\s]*)(?:\s*[\p{L}€$£₺%]{0,12})$/u.exec(normalizeWatchedText(text));
  if (!match) return null;
  let number = match[1].replace(/\s/g, '');
  if (/^[+-]?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?$/.test(number)) {
    const last = number.match(/[.,](\d{1,2})$/);
    number = last ? number.slice(0, -last[0].length).replace(/[.,]/g, '') + '.' + last[1] : number.replace(/[.,]/g, '');
  } else if (/^[+-]?\d+(?:[.,]\d+)?$/.test(number)) number = number.replace(',', '.');
  else return null;
  const value = Number(number); return Number.isFinite(value) ? value : null;
}
function primitiveValues(value: unknown): { path: string; value: string }[] {
  const results: { path: string; value: string }[] = []; let visited = 0;
  function visit(value: unknown, path: string, depth: number) {
    if (++visited > 150 || depth > 4) return;
    if (['string', 'number', 'boolean'].includes(typeof value) || value === null) {
      const text = String(value);
      if (text.length <= 200) results.push({ path, value: text });
    } else if (value && typeof value === 'object') {
      for (const key of Object.keys(value).slice(0, 30)) {
        if (!/^[a-zA-Z0-9_$-]+$/.test(key) || ['__proto__', 'prototype', 'constructor'].includes(key)) continue;
        visit((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key, depth + 1);
      }
    }
  }
  visit(value, '', 0); return results;
}
export async function discoverPageWatchSources(input: string, selector: string, currentValue: string | undefined, signal: AbortSignal): Promise<SourceCandidate[]> {
  const normalized = normalizeUrl(input);
  if (!normalized) throw new Error('Enter a public HTTP/HTTPS page URL.');
  const pageUrl: string = normalized;
  const origin = new URL(pageUrl).origin;
  const html = await boundedText(pageUrl, EXTERNAL_RESPONSE_LIMITS.discoveryHtml, signal);
  // Scan HTML as text, so remote images/frames/scripts are never instantiated.
  const scripts: string[] = [], inlineScripts: string[] = [];
  const lowerHtml = html.toLowerCase();
  for (const tag of html.matchAll(/<script\b([^>]{0,2000})>/gi)) {
    const src = /\bsrc\s*=\s*(?:"([^"\r\n]{1,500})"|'([^'\r\n]{1,500})'|([^\s>]{1,500}))/i.exec(tag[1]);
    if (src) {
      const url = candidateUrl((src[1] ?? src[2] ?? src[3]).replace(/&amp;/gi, '&'), pageUrl);
      if (url && new URL(url).origin === origin && scripts.length < MAX_SCRIPTS && !scripts.includes(url)) scripts.push(url);
    } else if (inlineScripts.length < 5) {
      const start = tag.index! + tag[0].length;
      const end = lowerHtml.indexOf('</script', start);
      if (end !== -1) inlineScripts.push(html.slice(start, Math.min(end, start + 100_000)));
    }
  }
  const candidates = new Map<string, SourceCandidate>();
  const blockedUrls = new Set<string>();
  const selectorWords = selector.slice(0, 2000).toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g)?.filter(word => !['div', 'nth-child', 'span'].includes(word)).slice(0, 20) ?? [];
  function scan(script: string, pageSpecific: boolean) {
    const blocked = new Set<string>();
    const found: { raw: string; index: number; safe: boolean }[] = [];
    const literal = String.raw`["']([^"'\r\n\\]{1,500})["']`;
    const fetchCalls = new RegExp(String.raw`\bfetch\s*\(\s*${literal}\s*([,)])`, 'g');
    for (const match of script.matchAll(fetchCalls)) {
      const tail = script.slice(match.index! + match[0].length, match.index! + match[0].length + 1000);
      // Default GET only with no options, or a simple literal options object.
      const options = match[2] === ',' ? /^\s*\{([^{}]{0,900})\}\s*\)/.exec(tail) : null;
      const method = options?.[1].match(/\bmethod["']?\s*:\s*["']([a-z]+)["']/i)?.[1];
      const safe = match[2] === ')' || Boolean(options && /^\s*(?:["']?method["']?\s*:\s*["']GET["']\s*,?)?\s*$/i.test(options[1]) && (!method || method.toUpperCase() === 'GET'));
      found.push({ raw: match[1], index: match.index!, safe });
      if (!safe) blocked.add(match[1]);
    }
    for (const match of script.matchAll(new RegExp(String.raw`(?:\baxios\.get|\$\.get|\b\w+\.open\s*\(\s*["']GET["']\s*,)\s*\(?\s*${literal}`, 'gi'))) {
      found.push({ raw: match[1], index: match.index!, safe: true });
    }
    for (const match of script.matchAll(/\$\.ajax\s*\(\s*\{([^{}]{0,1500})\}/g)) {
      const url = new RegExp(String.raw`\burl["']?\s*:\s*${literal}`).exec(match[1]);
      if (!url) continue;
      const method = match[1].match(/\b(?:method|type)["']?\s*:\s*["']([a-z]+)["']/i)?.[1];
      const safe = (!/\b(?:method|type)["']?\s*:/i.test(match[1]) || method?.toUpperCase() === 'GET') && !/\b(?:data|headers|xhrFields)["']?\s*:/i.test(match[1]);
      found.push({ raw: url[1], index: match.index!, safe });
      if (!safe) blocked.add(url[1]);
    }
    // Exclude mutation calls even from the lower-confidence string scan.
    for (const match of script.matchAll(new RegExp(String.raw`(?:\baxios\.(?:post|put|patch|delete)|\$\.post)\s*\(\s*${literal}`, 'gi'))) blocked.add(match[1]);
    for (const match of script.matchAll(new RegExp(String.raw`\b\w+\.open\s*\(\s*["'](?:POST|PUT|PATCH|DELETE)["']\s*,\s*${literal}`, 'gi'))) blocked.add(match[1]);
    for (const match of script.matchAll(new RegExp(literal, 'g'))) {
      if (/(?:\/(?:api|data|prices?|rates?|feeds?)\/|\.json(?:[?#]|$))/i.test(match[1])) found.push({ raw: match[1], index: match.index!, safe: false });
    }
    for (const raw of blocked) {
      const url = candidateUrl(raw, pageUrl);
      if (url) { blockedUrls.add(url); candidates.delete(url); }
    }
    for (const match of found) {
      if (blocked.has(match.raw)) continue;
      const url = candidateUrl(match.raw, pageUrl);
      if (!url || blockedUrls.has(url) || (candidates.size >= MAX_CANDIDATES && !candidates.has(url))) continue;
      const sameOrigin = new URL(url).origin === origin;
      const context = script.slice(Math.max(0, match.index - 150), match.index + 250).toLowerCase();
      const score = (sameOrigin ? 10 : 0) + (match.safe ? 8 : 0) + (pageSpecific ? 3 : 0) +
        (/api|data|price|rate|feed/i.test(new URL(url).pathname) ? 6 : 0) + (/\.json$/i.test(new URL(url).pathname) ? 5 : 0) +
        (selectorWords.some(word => context.includes(word)) ? 5 : 0);
      const previous = candidates.get(url);
      candidates.set(url, { url, score: Math.max(previous?.score ?? 0, score), safeGet: Boolean(previous?.safeGet || match.safe) });
    }
  }
  const unique = [...new Set(scripts)].slice(0, MAX_SCRIPTS);
  let budget: number = PAGE_WATCH_DISCOVERY_LIMITS.scriptBytes;
  for (const url of unique) {
    if (signal.aborted) throw new Error('Discovery cancelled.');
    if (budget <= 0) break;
    try {
      const allowance = Math.min(EXTERNAL_RESPONSE_LIMITS.discoveryScript, budget);
      budget -= allowance;
      const script = await boundedText(url, allowance, signal);
      scan(script, !/(?:vendor|bundle|runtime|polyfill|jquery|framework)/i.test(new URL(url).pathname));
    } catch { if (signal.aborted) throw new Error('Discovery cancelled.'); }
  }
  for (const script of inlineScripts) scan(script, true);
  const ranked = [...candidates.values()].sort((a, b) => b.score - a.score);
  const watched = currentValue === undefined ? undefined : normalizeWatchedText(currentValue);
  for (const candidate of ranked.filter(candidate => candidate.safeGet && new URL(candidate.url).origin === origin).slice(0, 3)) {
    if (signal.aborted) throw new Error('Discovery cancelled.');
    try {
      const json: unknown = JSON.parse(await boundedText(candidate.url, EXTERNAL_RESPONSE_LIMITS.discoveryJson, signal));
      const values = primitiveValues(json);
      const numeric = watched ? numericValue(watched) : null;
      const matched = values.find(entry => watched !== undefined && (normalizeWatchedText(entry.value) === watched ||
        (numeric !== null && numericValue(entry.value) === numeric)));
      const useful = matched ?? values.find(entry => /price|rate|value|amount|total/i.test(entry.path)) ?? values[0];
      candidate.verified = true; candidate.score += 15;
      if (useful) { candidate.path = useful.path; candidate.value = useful.value; }
      candidate.suggestedPaths = [...(matched ? [matched] : []), ...values.filter(entry => /price|rate|value|amount|total/i.test(entry.path))]
        .filter((entry, index, entries) => entries.findIndex(other => other.path === entry.path) === index).slice(0, 3);
      if (matched) { candidate.matched = true; candidate.score += 40; }
    } catch { if (signal.aborted) throw new Error('Discovery cancelled.'); }
  }
  return ranked.sort((a, b) => b.score - a.score).slice(0, 3);
}
