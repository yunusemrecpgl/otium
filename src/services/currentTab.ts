import { normalizeUrl } from '../utils/url';

export interface CurrentPage {
  title: string;
  url: string;
  width: number;
  height: number;
}
interface TabMetadata { title?: string; url?: string; width?: number; height?: number }

export const currentTabService = {
  async read(): Promise<CurrentPage> {
    const chrome = (globalThis as typeof globalThis & {
      chrome?: { tabs?: { query(query: { active: boolean; currentWindow: boolean }): Promise<TabMetadata[]> } };
    }).chrome;
    if (!chrome?.tabs) throw new Error('Open Otium from the browser toolbar to save a page.');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = normalizeUrl(tab?.url ?? '');
    if (!url) throw new Error('This page cannot be saved. Open a normal website and try again.');
    return {
      title: tab.title?.trim() || new URL(url).hostname, url,
      width: tab.width ?? screen.availWidth, height: tab.height ?? screen.availHeight,
    };
  },
};
