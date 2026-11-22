import { BOOKMARK_IMPORT_LIMITS, BOOKMARK_IMPORT_TOO_LARGE } from '../constants/bookmarkImport';
import type { BookmarkImportSummary, ImportedBookmarkNode } from '../domain/importedBookmarks';
import type { OtiumData } from '../domain/data';
import { normalizeUrl } from '../utils/url';

export class RepeatedBookmarkImportError extends Error {
  constructor() { super('This bookmark file appears to have been imported before. Import it again?'); }
}

export function assertBookmarkCounts(summary: BookmarkImportSummary) {
  if (summary.folders > BOOKMARK_IMPORT_LIMITS.folders || summary.bookmarks > BOOKMARK_IMPORT_LIMITS.bookmarks ||
      summary.folders + summary.bookmarks > BOOKMARK_IMPORT_LIMITS.nodes) throw new Error(BOOKMARK_IMPORT_TOO_LARGE);
}

export function boundBookmarkTitle(value: string) {
  return value.trim().slice(0, BOOKMARK_IMPORT_LIMITS.titleCharacters);
}

export function normalizeImportedBookmark(title: string, href: string): Extract<ImportedBookmarkNode, { type: 'bookmark' }> | null {
  if (href.length > BOOKMARK_IMPORT_LIMITS.urlCharacters) throw new Error('A bookmark URL is too long.');
  const url = normalizeUrl(href);
  if (!url) return null;
  if (url.length > BOOKMARK_IMPORT_LIMITS.urlCharacters) throw new Error('A bookmark URL is too long.');
  return { type: 'bookmark', title: boundBookmarkTitle(title.trim() || url), url };
}

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
    } else summary.bookmarks++;
    assertBookmarkCounts(summary);
  }
  return summary;
}

export function isEmptyBookmarkImportWorkspace(data: OtiumData) {
  return ![data.links, data.projects, data.folders, data.workspaceItems, data.projectCanvasItems, data.projectCanvasStates,
    data.widgetInstances, data.bookmarkImports, data.notebook?.sections, data.notebook?.pages, data.notebook?.templates].some(entries => entries?.length);
}

export function yieldBookmarkImport() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}

export async function fingerprintBookmarkSource(source: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
