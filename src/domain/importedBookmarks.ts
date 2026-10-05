export type ImportedBookmarkNode =
  | { type: 'folder'; title: string; children: ImportedBookmarkNode[] }
  | { type: 'bookmark'; title: string; url: string };

export interface BookmarkImportSummary { bookmarks: number; folders: number }

export interface BookmarkImportMetadata extends BookmarkImportSummary {
  fingerprint: string;
  importedAt: number;
}

export interface BookmarkImportRequest {
  nodes: readonly ImportedBookmarkNode[];
  fingerprint: string;
  allowRepeat?: boolean;
}
