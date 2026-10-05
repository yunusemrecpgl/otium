import type { ImportedBookmarkNode, BookmarkImportSummary } from '../domain/importedBookmarks';
import { normalizeUrl } from '../utils/url';
import { BOOKMARK_IMPORT_LIMITS, BOOKMARK_IMPORT_TOO_LARGE } from '../constants/bookmarkImport';
import { assertBookmarkCounts, boundBookmarkTitle, yieldBookmarkImport } from './bookmarkImportSafety';

const ROOT_NAMES = new Set(['bookmarks bar', 'bookmarks toolbar', 'other bookmarks', 'mobile bookmarks', 'bookmarks menu']);
const ROOT_ATTRIBUTES = ['personal_toolbar_folder', 'unfiled_bookmarks_folder', 'mobile_bookmarks_folder', 'bookmarks_menu'];

export function summarizeBookmarks(nodes: readonly ImportedBookmarkNode[]): BookmarkImportSummary {
  const summary = { bookmarks: 0, folders: 0 };
  if (nodes.length > BOOKMARK_IMPORT_LIMITS.nodes) throw new Error(BOOKMARK_IMPORT_TOO_LARGE);
  const pending = [...nodes];
  const visited = new Set<ImportedBookmarkNode>();
  while (pending.length) {
    const node = pending.pop()!;
    if (visited.has(node)) throw new Error('Invalid bookmark hierarchy.');
    visited.add(node);
    if (node.type === 'folder') {
      summary.folders++;
      if (visited.size + pending.length + node.children.length > BOOKMARK_IMPORT_LIMITS.nodes) throw new Error(BOOKMARK_IMPORT_TOO_LARGE);
      for (const child of node.children) pending.push(child);
    }
    else summary.bookmarks++;
    assertBookmarkCounts(summary);
  }
  return summary;
}

export async function parseBookmarkHtml(html: string): Promise<{ nodes: ImportedBookmarkNode[]; summary: BookmarkImportSummary }> {
  if (new TextEncoder().encode(html).byteLength > BOOKMARK_IMPORT_LIMITS.fileBytes) throw new Error('Bookmark file is too large.');
  // Template content stays inert and is never attached to the page: no scripts,
  // image loads, imported styles or HTML rendering in the application.
  const template = document.createElement('template');
  template.innerHTML = html;
  const root = template.content.querySelector('dl');
  if (!root) throw new Error('Unable to read this bookmark file.');
  // Bound even markup that is ignored by the bookmark traversal. Inspect it in
  // batches before allocating node lists or querying all folder headers.
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  let elements = 0;
  while (walker.nextNode()) {
    if (++elements > BOOKMARK_IMPORT_LIMITS.htmlElements) throw new Error(BOOKMARK_IMPORT_TOO_LARGE);
    if (elements % BOOKMARK_IMPORT_LIMITS.batchSize === 0) await yieldBookmarkImport();
  }
  const headers = [...root.querySelectorAll('h3')].filter(header => header.closest('dl') === root);
  const markedRoot = (header: Element) => ROOT_ATTRIBUTES.some(attribute => ['true', '1'].includes((header.getAttribute(attribute) ?? '').toLowerCase()));
  const hasBrowserRoot = headers.some(markedRoot);
  const structuralRoots = new Set<Element>(headers.filter(header => markedRoot(header) ||
    (hasBrowserRoot && ROOT_NAMES.has((header.textContent ?? '').trim().toLowerCase()))));

  interface Context { nodes: ImportedBookmarkNode[]; pendingChildren: ImportedBookmarkNode[] | null; root: boolean }
  const nodes: ImportedBookmarkNode[] = [];
  const stack: { element: Element; context: Context }[] = [];
  const visited = new Set<Element>();
  const summary = { bookmarks: 0, folders: 0 };
  function enqueue(element: Element, context: Context) {
    for (let index = element.children.length - 1; index >= 0; index--) stack.push({ element: element.children[index], context });
  }
  enqueue(root, { nodes, pendingChildren: null, root: true });
  while (stack.length) {
    const { element, context } = stack.pop()!;
    if (visited.has(element)) continue;
    visited.add(element);
    if (visited.size % BOOKMARK_IMPORT_LIMITS.batchSize === 0) await yieldBookmarkImport();
    switch (element.tagName) {
      case 'H3': {
        const folder: ImportedBookmarkNode = { type: 'folder', title: boundBookmarkTitle(element.textContent ?? ''), children: [] };
        if (context.root && structuralRoots.has(element)) context.pendingChildren = context.nodes;
        else {
          summary.folders++; assertBookmarkCounts(summary);
          context.nodes.push(folder); context.pendingChildren = folder.children;
        }
        break;
      }
      case 'A': {
        const href = element.getAttribute('href') ?? '';
        if (href.length > BOOKMARK_IMPORT_LIMITS.urlCharacters) throw new Error('A bookmark URL is too long.');
        const url = normalizeUrl(href);
        if (url) {
          if (url.length > BOOKMARK_IMPORT_LIMITS.urlCharacters) throw new Error('A bookmark URL is too long.');
          summary.bookmarks++; assertBookmarkCounts(summary);
          context.nodes.push({ type: 'bookmark', title: boundBookmarkTitle((element.textContent ?? '').trim() || url), url });
        }
        context.pendingChildren = null;
        break;
      }
      case 'DL': {
        const children = context.pendingChildren ?? context.nodes;
        context.pendingChildren = null;
        enqueue(element, { nodes: children, pendingChildren: null, root: false });
        break;
      }
      case 'DT': case 'DD': case 'P':
        enqueue(element, context);
        break;
      default: break;
    }
  }
  summarizeBookmarks(nodes);
  if (!summary.bookmarks) throw new Error('No bookmarks were found.');
  return { nodes, summary };
}
