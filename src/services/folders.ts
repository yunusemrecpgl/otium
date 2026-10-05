import type { OtiumData } from '../domain/data';
import { isFolderIcon, normalizeFolderIcon } from '../utils/folderIcons';
import type { FolderDraft, FolderPatch } from '../domain/folder';
import { isProjectColor } from '../domain/projectColor';
import type { ProjectColor } from '../domain/projectColor';
import { GRID_SIZE, WORKSPACE_PADDING } from '../constants/grid';
import { getFolderWidthTier } from '../utils/folderDimensions';
import { findInitialPosition, findNearestFreePosition, toSpatialItems } from '../utils/workspace';
import type { WorkspaceGeometry, SpatialItem } from '../utils/workspace';
import type { WorkspacePositionChange } from '../utils/horizontalInsertion';
import { canTransferToContainer, getFolderPath } from '../utils/folderHierarchy';

export function createFolder(data: OtiumData, draft: FolderDraft, geometry: WorkspaceGeometry, containerId = 'home'): OtiumData {
  if (containerId !== 'home' && !getFolderPath(data, containerId)) throw new Error('Folder is unavailable.');
  const name = draft.name.trim();
  if (name.length > 40) throw new Error('Folder names may contain up to 40 characters.');
  const now = Date.now();
  const folder = { ...draft, icon: normalizeFolderIcon(draft.icon), name, id: crypto.randomUUID(), widthTier: getFolderWidthTier(name, geometry.itemSize), createdAt: now, updatedAt: now };
  const item = { id: crypto.randomUUID(), type: 'folder' as const, folderId: folder.id, containerId, x: 0, y: 0 };
  const folders = [...data.folders, folder];
  const spatial = toSpatialItems(data.workspaceItems.filter(item => !item.trashedAt && item.containerId === containerId), geometry.itemSize, data.projects, folders);
  const size = toSpatialItems([item], geometry.itemSize, data.projects, folders)[0];
  const room = destinationGeometry(spatial, [size], geometry);
  const position = findInitialPosition(spatial, room, size);
  return { ...data, folders, workspaceItems: [...data.workspaceItems, { ...item, ...position }] };
}

export function setFolderColor(data: OtiumData, id: string, color: ProjectColor): OtiumData {
  if (!data.folders.some(folder => folder.id === id)) throw new Error('Folder not found.');
  return { ...data, folders: data.folders.map(folder => folder.id === id ? { ...folder, color, updatedAt: Date.now() } : folder) };
}

export function updateFolder(data: OtiumData, id: string, patch: FolderPatch): OtiumData {
  const folder = data.folders.find(folder => folder.id === id && !folder.trashedAt);
  if (!folder) throw new Error('Folder not found.');
  if (patch.name !== undefined && patch.name.length > 40) throw new Error('Folder names may contain up to 40 characters.');
  if (patch.icon !== undefined && !isFolderIcon(patch.icon)) throw new Error('Unknown folder icon.');
  if (patch.color !== undefined && !isProjectColor(patch.color)) throw new Error('Unknown folder color.');
  const next = { ...folder, ...patch, updatedAt: Date.now(),
    ...(patch.icon === undefined ? {} : { icon: normalizeFolderIcon(patch.icon) }),
    ...(patch.name === undefined ? {} : { widthTier: getFolderWidthTier(patch.name, data.settings.appearance.itemSize) }) };
  return { ...data, folders: data.folders.map(entry => entry.id === id ? next : entry) };
}

function destinationGeometry(existing: SpatialItem[], moved: SpatialItem[], geometry: WorkspaceGeometry): WorkspaceGeometry {
  const bottom = Math.max(geometry.height, ...existing.map(item => WORKSPACE_PADDING + item.y * GRID_SIZE + item.height + WORKSPACE_PADDING));
  return { ...geometry, height: bottom + moved.reduce((height, item) => height + item.height + GRID_SIZE, 0) };
}

// Transfer placement only: preserve resource ids and Project.linkIds.
export function transferWorkspaceItems(data: OtiumData, ids: string[], containerId: string, geometry: WorkspaceGeometry, displayedPositions: WorkspacePositionChange[] = []): OtiumData {
  if (!canTransferToContainer(data, ids, containerId)) throw new Error('A folder cannot be moved into itself or a descendant, or an unavailable destination.');
  const selected = data.workspaceItems.filter(item => !item.trashedAt && ids.includes(item.id) && item.containerId !== containerId);
  if (!selected.length) return data;
  if (new Set(selected.map(item => item.containerId)).size !== 1) throw new Error('Select items from one workspace.');
  if (selected.some(item => item.containerId !== 'home' && !getFolderPath(data, item.containerId))) throw new Error('Source folder is unavailable.');
  const display = new Map(displayedPositions.map(position => [position.id, position]));
  const moved = toSpatialItems(selected.map(item => ({ ...item, ...display.get(item.id) })), geometry.itemSize, data.projects, data.folders);
  const occupied = toSpatialItems(data.workspaceItems.filter(item => !item.trashedAt && item.containerId === containerId), geometry.itemSize, data.projects, data.folders);
  const room = destinationGeometry(occupied, moved, geometry);
  const x = Math.min(...moved.map(item => item.x)), y = Math.min(...moved.map(item => item.y));
  const footprint = { width: Math.max(...moved.map(item => (item.x - x) * GRID_SIZE + item.width)),
    height: Math.max(...moved.map(item => (item.y - y) * GRID_SIZE + item.height)) };
  room.height += footprint.height;
  const origin = findNearestFreePosition({ x, y }, occupied, room, undefined, footprint);
  const positions = new Map<string, { x: number; y: number }>();
  for (const item of moved) {
    const position = origin ? { x: origin.x + item.x - x, y: origin.y + item.y - y }
      : findNearestFreePosition(item, occupied, room, undefined, item);
    if (!position) throw new Error('No space for these items. Enlarge the window.');
    positions.set(item.id, position);
    occupied.push({ ...item, ...position });
  }
  return { ...data, workspaceItems: data.workspaceItems.map(item => {
    const position = positions.get(item.id);
    return position ? { ...item, ...position, containerId } : item;
  }) };
}
