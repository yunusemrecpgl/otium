import { BOOKMARK_IMPORT_LIMITS, BOOKMARK_IMPORT_TOO_LARGE } from '../constants/bookmarkImport';
import type { BookmarkImportRequest, ImportedBookmarkNode } from '../domain/importedBookmarks';
import { assertBookmarkCounts, boundBookmarkTitle, fingerprintBookmarkSource, normalizeImportedBookmark, yieldBookmarkImport } from './bookmarkImportSafety';

interface BrowserBookmarkNode {
  title: string;
  url?: string;
  children?: BrowserBookmarkNode[];
  folderType?: string;
  unmodifiable?: 'managed';
}

export async function readBrowserBookmarks(): Promise<BookmarkImportRequest> {
  const api = (globalThis as typeof globalThis & {
    chrome?: { bookmarks?: { getTree(): Promise<BrowserBookmarkNode[]> } };
  }).chrome?.bookmarks;
  let tree: BrowserBookmarkNode[];
  try {
    if (!api) throw new Error();
    tree = await api.getTree();
  } catch { throw new Error('Browser bookmarks could not be read.'); }

  const nodes: ImportedBookmarkNode[] = [];
  const pending: { node: BrowserBookmarkNode; target: ImportedBookmarkNode[]; depth: number }[] = [];
  const summary = { bookmarks: 0, folders: 0 };
  let visited = 0;
  function enqueue(source: BrowserBookmarkNode[], target: ImportedBookmarkNode[], depth: number) {
    if (visited + pending.length + source.length > BOOKMARK_IMPORT_LIMITS.sourceEntries) throw new Error(BOOKMARK_IMPORT_TOO_LARGE);
    for (let index = source.length - 1; index >= 0; index--) pending.push({ node: source[index], target, depth });
  }
  enqueue(tree, nodes, 0);
  while (pending.length) {
    const { node, target, depth } = pending.pop()!;
    if (++visited % BOOKMARK_IMPORT_LIMITS.batchSize === 0) await yieldBookmarkImport();
    if (node.url !== undefined) {
      const bookmark = normalizeImportedBookmark(node.title, node.url);
      if (bookmark) { summary.bookmarks++; assertBookmarkCounts(summary); target.push(bookmark); }
      continue;
    }
    // Chromium's root only contains browser-owned buckets. Keep managed
    // groups named and preserve every user folder below the ordinary buckets.
    const wrapper = depth === 0 || (depth === 1 && node.folderType !== 'managed' && node.unmodifiable !== 'managed');
    const children = wrapper ? target : [];
    if (!wrapper) {
      summary.folders++; assertBookmarkCounts(summary);
      target.push({ type: 'folder', title: boundBookmarkTitle(node.title), children });
    }
    enqueue(node.children ?? [], children, depth + 1);
  }
  if (!summary.bookmarks) throw new Error('No bookmarks were found.');

  // Fingerprint normalized content and order, independent of Chrome IDs and
  // timestamps. An iterative encoding also handles deeply nested folders.
  const entries: Array<[string, string, number | string]> = [];
  const stack = [...nodes].reverse();
  while (stack.length) {
    const node = stack.pop()!;
    if (node.type === 'bookmark') entries.push([node.type, node.title, node.url]);
    else {
      entries.push([node.type, node.title, node.children.length]);
      for (let index = node.children.length - 1; index >= 0; index--) stack.push(node.children[index]);
    }
  }
  return { nodes, fingerprint: await fingerprintBookmarkSource(`browser:${JSON.stringify(entries)}`) };
}
