import type { OtiumData } from '../domain/data';
import type { BookmarkImportRequest } from '../domain/importedBookmarks';
import type { FolderWorkspaceItem, LinkWorkspaceItem } from '../domain/workspace';
import { GRID_SIZE, ITEM_GAP, WORKSPACE_PADDING, WORKSPACE_ITEM_GAP } from '../constants/grid';
import { BOOKMARK_IMPORT_LIMITS } from '../constants/bookmarkImport';
import { getFolderWidthTier } from '../utils/folderDimensions';
import { getWorkspaceItemDimensions, isValidPosition, toSpatialItems } from '../utils/workspace';
import type { Dimensions, GridPosition, WorkspaceGeometry, SpatialItem } from '../utils/workspace';
import { normalizeUrl } from '../utils/url';
import { summarizeBookmarks } from './bookmarkHtml';
import { boundBookmarkTitle, RepeatedBookmarkImportError, yieldBookmarkImport } from './bookmarkImportSafety';

// Same initial-placement grid/clearance rules, with bounded batches and only
// nearby rows in collision checks. The shared Home spatial engine is unchanged.
async function findImportPosition(items: SpatialItem[], geometry: WorkspaceGeometry, size: Dimensions): Promise<GridPosition> {
  const maxX = Math.floor((geometry.width - 2 * WORKSPACE_PADDING - size.width) / GRID_SIZE);
  const maxY = Math.floor((geometry.height - 2 * WORKSPACE_PADDING - size.height) / GRID_SIZE);
  if (maxX < 0 || maxY < 0) throw new Error('No free space in this workspace. Enlarge the window to import bookmarks.');
  const rowItems = (y: number) => items.filter(item =>
    item.y * GRID_SIZE < y * GRID_SIZE + size.height + WORKSPACE_ITEM_GAP &&
    item.y * GRID_SIZE + item.height + WORKSPACE_ITEM_GAP > y * GRID_SIZE);
  let steps = 0;
  const stepX = Math.ceil((size.width + ITEM_GAP) / GRID_SIZE);
  const stepY = Math.ceil((size.height + ITEM_GAP) / GRID_SIZE);
  for (let y = 0; y <= maxY; y += stepY) {
    const nearby = rowItems(y);
    for (let x = 0; x <= maxX; x += stepX) {
      if (++steps % BOOKMARK_IMPORT_LIMITS.batchSize === 0) await yieldBookmarkImport();
      if (isValidPosition({ x, y }, nearby, geometry, undefined, size)) return { x, y };
    }
  }
  let nearest: GridPosition | null = null, distance = Infinity;
  for (let y = 0; y <= maxY && y * y < distance; y++) {
    const nearby = rowItems(y);
    for (let x = 0; x <= maxX && x * x + y * y < distance; x++) {
      if (++steps % BOOKMARK_IMPORT_LIMITS.batchSize === 0) await yieldBookmarkImport();
      if (isValidPosition({ x, y }, nearby, geometry, undefined, size)) {
        nearest = { x, y }; distance = x * x + y * y;
      }
    }
  }
  if (!nearest) throw new Error('No free space in this workspace. Enlarge the window to import bookmarks.');
  return nearest;
}

export async function importBookmarks(data: OtiumData, request: BookmarkImportRequest, geometry: WorkspaceGeometry) {
  const { nodes, fingerprint, allowRepeat } = request;
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('Unable to identify this bookmark file.');
  if (!allowRepeat && data.bookmarkImports?.some(entry => entry.fingerprint === fingerprint)) throw new RepeatedBookmarkImportError();
  // Build the complete additive snapshot before publishing or persisting it.
  const summary = summarizeBookmarks(nodes);
  if (!summary.bookmarks) throw new Error('No bookmarks were found.');
  const next: OtiumData = { ...data, folders: [...data.folders], links: [...data.links], workspaceItems: [...data.workspaceItems] };
  const occupied = new Map<string, SpatialItem[]>();
  const placements = new Map(data.workspaceItems.map(item => [item.id, item]));
  for (const item of toSpatialItems(data.workspaceItems.filter(item => !item.trashedAt), geometry.itemSize, data.projects, data.folders)) {
    const placement = placements.get(item.id)!;
    const container = occupied.get(placement.containerId) ?? [];
    container.push(item); occupied.set(placement.containerId, container);
  }
  const now = Date.now();
  const stack = nodes.map(node => ({ node, containerId: 'home' })).reverse();
  let processed = 0;
  while (stack.length) {
    const { node, containerId } = stack.pop()!;
    // Every non-Home container was created earlier in this validated traversal.
    if (++processed % BOOKMARK_IMPORT_LIMITS.batchSize === 0) await yieldBookmarkImport();
    let item: FolderWorkspaceItem | LinkWorkspaceItem;
    if (node.type === 'folder') {
      const name = boundBookmarkTitle(node.title);
      const folder = { id: crypto.randomUUID(), name, icon: 'folder' as const, color: 'neutral' as const,
        widthTier: getFolderWidthTier(name, geometry.itemSize), createdAt: now, updatedAt: now };
      next.folders.push(folder);
      item = { id: crypto.randomUUID(), type: 'folder', folderId: folder.id, containerId, x: 0, y: 0 };
      for (let index = node.children.length - 1; index >= 0; index--) stack.push({ node: node.children[index], containerId: folder.id });
    } else {
      if (node.url.length > BOOKMARK_IMPORT_LIMITS.urlCharacters) throw new Error('A bookmark URL is too long.');
      const url = normalizeUrl(node.url);
      if (!url) throw new Error('The bookmark import contains an invalid URL.');
      if (url.length > BOOKMARK_IMPORT_LIMITS.urlCharacters) throw new Error('A bookmark URL is too long.');
      // Separate resources retain the current project-ownership assumptions.
      const link = { id: crypto.randomUUID(), title: boundBookmarkTitle(node.title.trim() || url), url, createdAt: now };
      next.links.push(link);
      item = { id: crypto.randomUUID(), type: 'link', linkId: link.id, containerId, x: 0, y: 0 };
    }
    const size = getWorkspaceItemDimensions(item, geometry.itemSize, next.projects, next.folders);
    const existing = occupied.get(containerId) ?? [];
    const bottom = existing.reduce((height, entry) => Math.max(height, entry.y * GRID_SIZE + entry.height + WORKSPACE_PADDING * 2), geometry.height);
    const position = await findImportPosition(existing, { ...geometry, height: bottom + size.height + GRID_SIZE }, size);
    const placed = { ...item, ...position };
    next.workspaceItems.push(placed);
    existing.push({ ...placed, ...size }); occupied.set(containerId, existing);
  }
  next.bookmarkImports = [...(data.bookmarkImports ?? []).filter(entry => entry.fingerprint !== fingerprint),
    { fingerprint, importedAt: Date.now(), ...summary }];
  return { data: next, summary };
}
