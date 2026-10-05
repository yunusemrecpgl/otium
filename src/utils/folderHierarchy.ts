import type { OtiumData } from '../domain/data';
import type { Folder } from '../domain/folder';

// Placement is the only parent relationship. A visited set bounds malformed trees.
export function getFolderPath(data: OtiumData, id: string): Folder[] | null {
  const folders = new Map(data.folders.map(folder => [folder.id, folder]));
  const placements = new Map(data.workspaceItems.flatMap(item => item.type === 'folder' ? [[item.folderId, item] as const] : []));
  const visited = new Set<string>();
  const path: Folder[] = [];
  while (id !== 'home') {
    if (visited.has(id)) return null;
    visited.add(id);
    const folder = folders.get(id), placement = placements.get(id);
    if (!folder || folder.trashedAt || !placement || placement.trashedAt) return null;
    path.push(folder);
    id = placement.containerId;
  }
  return path.reverse();
}

export function canTransferToContainer(data: OtiumData, ids: readonly string[], destination: string): boolean {
  const path = destination === 'home' ? [] : getFolderPath(data, destination);
  if (!path) return false;
  const ancestors = new Set(path.map(folder => folder.id));
  return data.workspaceItems.filter(item => ids.includes(item.id) && !item.trashedAt).every(item =>
    item.type !== 'folder' || !ancestors.has(item.folderId));
}
