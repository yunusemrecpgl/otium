import { BOOKMARK_IMPORT_LIMITS, BOOKMARK_IMPORT_TOO_LARGE } from '../constants/bookmarkImport';
import type { BookmarkImportSummary } from '../domain/importedBookmarks';

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

export function yieldBookmarkImport() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}

export async function fingerprintBookmarkHtml(html: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(html));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
