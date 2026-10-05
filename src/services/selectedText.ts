import { normalizeUrl } from '../utils/url';
import { buildTextFragmentUrl } from '../utils/textFragment';

export interface PageSelection { text: string; sourceUrl: string; sourceTitle: string; prefix?: string; suffix?: string; textFragmentUrl?: string; faviconUrl?: string }

// Opening the action popup is the user's explicit capture interaction. activeTab
// grants access only to that tab; restricted browser pages fail without injection.
export const selectedTextService = {
  async read(): Promise<PageSelection | null> {
    const chrome = (globalThis as typeof globalThis & { chrome?: {
      tabs?: { query(query: { active: boolean; currentWindow: boolean }): Promise<{ id?: number; url?: string; favIconUrl?: string }[]> };
      scripting?: { executeScript(options: { target: { tabId: number }; func: () => PageSelection }): Promise<{ result?: PageSelection }[]> };
    } }).chrome;
    if (!chrome?.tabs || !chrome.scripting) return null;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined || !normalizeUrl(tab.url ?? '')) return null;
      const [capture] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
        const focused = document.activeElement;
        const selected = window.getSelection();
        let text = selected?.toString() ?? '';
        let prefix: string | undefined, suffix: string | undefined;
        if (focused instanceof HTMLTextAreaElement || (focused instanceof HTMLInputElement && ['text', 'search', 'url', 'tel'].includes(focused.type))) {
          if (focused.selectionStart !== null && focused.selectionEnd !== null) text = focused.value.slice(focused.selectionStart, focused.selectionEnd);
        } else if (selected?.rangeCount === 1) {
          try {
            const range = selected.getRangeAt(0);
            // Context is reliable only at text-node, whitespace word boundaries.
            if (range.startContainer.nodeType === Node.TEXT_NODE && range.endContainer.nodeType === Node.TEXT_NODE) {
              const before = (range.startContainer.textContent ?? '').slice(0, range.startOffset);
              const after = (range.endContainer.textContent ?? '').slice(range.endOffset);
              if ((!before || /\s$/.test(before)) && (!after || /^\s/.test(after))) {
                const leading = before.trim().split(/\s+/).slice(-5).join(' ');
                const trailing = after.trim().split(/\s+/).slice(0, 5).join(' ');
                if (leading.length <= 80) prefix = leading || undefined;
                if (trailing.length <= 80) suffix = trailing || undefined;
              }
            }
          } catch { /* Context is optional; plain selected text still captures. */ }
        }
        const favicon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
        return { text, sourceUrl: location.href, sourceTitle: document.title, prefix, suffix, faviconUrl: favicon?.href };
      } });
      const selection = capture?.result;
      return selection && typeof selection.text === 'string' && selection.text.trim() &&
        typeof selection.sourceUrl === 'string' && normalizeUrl(selection.sourceUrl) && typeof selection.sourceTitle === 'string'
        ? { ...selection, faviconUrl: normalizeUrl(tab.favIconUrl ?? '') ?? normalizeUrl(selection.faviconUrl ?? '') ?? undefined,
          textFragmentUrl: buildTextFragmentUrl(selection.sourceUrl, selection.text,
          typeof selection.prefix === 'string' ? selection.prefix : undefined,
          typeof selection.suffix === 'string' ? selection.suffix : undefined) } : null;
    } catch { return null; }
  },
};
