export const BOOKMARK_IMPORT_LIMITS = {
  fileBytes: 5 * 1024 * 1024,
  folders: 500,
  bookmarks: 2_000,
  nodes: 2_500,
  htmlElements: 25_000,
  titleCharacters: 1_024,
  urlCharacters: 8_192,
  batchSize: 128,
} as const;

export const BOOKMARK_IMPORT_TOO_LARGE = 'Bookmark import has too many entries.';
