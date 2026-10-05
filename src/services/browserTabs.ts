import type { Project } from '../domain/project';
import type { Link } from '../domain/link';
import { resolveProjectLinks } from '../utils/projectLinks';
import { normalizeUrl } from '../utils/url';

export interface BrowserTabs {
  create(options: { url: string; active: boolean }): Promise<unknown>;
}

function chromeTabs(): BrowserTabs {
  const api = (globalThis as typeof globalThis & { chrome?: { tabs?: BrowserTabs } }).chrome;
  if (!api?.tabs?.create) throw new Error('Tab opening is unavailable. Open Otium as an extension.');
  return api.tabs;
}

// Sequential background creation preserves order and keeps the Otium tab open.
// Concurrent activations of the same project share the in-flight sequence.
export function createBrowserTabsService(getTabs: () => BrowserTabs = chromeTabs) {
  const opening = new Map<string, Promise<void>>();
  return {
    async openLink(input: string): Promise<void> {
      const url = normalizeUrl(input);
      if (!url) throw new Error('This website URL is unavailable.');
      await getTabs().create({ url, active: true });
    },
    openProject(project: Project, links: Link[]): Promise<void> {
      const pending = opening.get(project.id);
      if (pending) return pending;
      const urls = resolveProjectLinks(project, links).flatMap((link) => {
        const url = normalizeUrl(link.url);
        return url ? [url] : [];
      });
      if (!urls.length) return Promise.resolve();
      const operation = (async () => {
        const tabs = getTabs();
        for (const url of urls) await tabs.create({ url, active: false });
      })();
      opening.set(project.id, operation);
      void operation.finally(() => opening.delete(project.id)).catch(() => {});
      return operation;
    },
  };
}

export const browserTabsService = createBrowserTabsService();
