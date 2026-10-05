import { GRID_SIZE, ITEM_GAP, SIDEBAR_WIDTH, WORKSPACE_ITEM_GAP, WORKSPACE_PADDING } from '../constants/grid';
import type { BaseWorkspaceItem, WorkspaceItem } from '../domain/workspace';
import type { Project } from '../domain/project';
import { getProjectDimensions } from './projectDimensions';
import type { Folder } from '../domain/folder';
import { getFolderDimensions } from './folderDimensions';

export interface GridPosition { x: number; y: number }
export interface Dimensions { width: number; height: number }
export interface WorkspaceGeometry extends Dimensions { itemSize: number }
export interface SpatialItem extends Pick<BaseWorkspaceItem, 'id' | 'x' | 'y'> { width: number; height: number }
interface Rectangle extends Dimensions { left: number; top: number }

export function workspaceGeometryForViewport(width: number, height: number, itemSize: number): WorkspaceGeometry {
  return { width: Math.max(0, width - SIDEBAR_WIDTH), height, itemSize };
}

export function getWorkspaceGeometry(itemSize: number): WorkspaceGeometry {
  return workspaceGeometryForViewport(window.innerWidth, window.innerHeight, itemSize);
}

export function gridToPixels(x: number, y: number) {
  return { left: WORKSPACE_PADDING + x * GRID_SIZE, top: WORKSPACE_PADDING + y * GRID_SIZE };
}

export function pixelsToGrid(left: number, top: number): GridPosition {
  return {
    x: Math.round((left - WORKSPACE_PADDING) / GRID_SIZE),
    y: Math.round((top - WORKSPACE_PADDING) / GRID_SIZE),
  };
}

// First grid coordinate after the actual rectangle plus a caller's visual gap.
export function firstGridXAfterItem(item: Pick<SpatialItem, 'x' | 'width'>, gap: number): number {
  const desiredLeft = gridToPixels(item.x, 0).left + item.width + gap;
  return Math.ceil((desiredLeft - WORKSPACE_PADDING) / GRID_SIZE);
}

export function getWorkspaceItemDimensions(item: WorkspaceItem, itemSize: number, projects: readonly Project[] = [], folders: readonly Folder[] = []): Dimensions {
  if (item.type === 'folder') return getFolderDimensions(folders.find(folder => folder.id === item.folderId) ?? { name: '' }, itemSize);
  return item.type === 'project'
    ? getProjectDimensions(projects.find(project => project.id === item.projectId) ?? { name: '' }, itemSize)
    : { width: itemSize, height: itemSize };
}

export function toSpatialItems(items: WorkspaceItem[], itemSize: number, projects: readonly Project[] = [], folders: readonly Folder[] = []): SpatialItem[] {
  return items.map((item) => ({ ...item, ...getWorkspaceItemDimensions(item, itemSize, projects, folders) }));
}

export function rectanglesOverlap(a: Rectangle, b: Rectangle) {
  return a.left < b.left + b.width && a.left + a.width > b.left &&
    a.top < b.top + b.height && a.top + a.height > b.top;
}

export function hasRequiredClearance(a: Rectangle, b: Rectangle, gap = WORKSPACE_ITEM_GAP): boolean {
  return a.left + a.width + gap <= b.left || b.left + b.width + gap <= a.left ||
    a.top + a.height + gap <= b.top || b.top + b.height + gap <= a.top;
}

export function wouldItemsOverlap(position: GridPosition, items: SpatialItem[], size: Dimensions, ignoredId?: string) {
  const candidate = { ...gridToPixels(position.x, position.y), ...size };
  return items.some((item) => item.id !== ignoredId && rectanglesOverlap(candidate, {
    ...gridToPixels(item.x, item.y), width: item.width, height: item.height,
  }));
}

export function isValidPosition(position: GridPosition, items: SpatialItem[], geometry: WorkspaceGeometry, ignoredId?: string, size: Dimensions = { width: geometry.itemSize, height: geometry.itemSize }) {
  if (!Number.isInteger(position.x) || !Number.isInteger(position.y)) return false;
  const candidate = { ...gridToPixels(position.x, position.y), ...size };
  const padding = WORKSPACE_PADDING;
  if (candidate.left < padding || candidate.top < padding ||
      candidate.left + size.width > geometry.width - padding ||
      candidate.top + size.height > geometry.height - padding) return false;
  const controls: Rectangle[] = [
    { left: padding, top: padding, width: geometry.itemSize, height: geometry.itemSize },
  ];
  return !controls.some((control) => rectanglesOverlap(candidate, control)) &&
    items.every(item => item.id === ignoredId || hasRequiredClearance(candidate, {
      ...gridToPixels(item.x, item.y), width: item.width, height: item.height,
    }));
}

export function clampToWorkspace(desired: GridPosition, geometry: WorkspaceGeometry, size: Dimensions): GridPosition | null {
  const maxX = Math.floor((geometry.width - 2 * WORKSPACE_PADDING - size.width) / GRID_SIZE);
  const maxY = Math.floor((geometry.height - 2 * WORKSPACE_PADDING - size.height) / GRID_SIZE);
  if (maxX < 0 || maxY < 0) return null;
  return {
    x: Math.max(0, Math.min(maxX, Math.round(desired.x))),
    y: Math.max(0, Math.min(maxY, Math.round(desired.y))),
  };
}

export function findNearestFreePosition(desired: GridPosition, items: SpatialItem[], geometry: WorkspaceGeometry, ignoredId?: string, size: Dimensions = { width: geometry.itemSize, height: geometry.itemSize }): GridPosition | null {
  const origin = clampToWorkspace(desired, geometry, size);
  if (!origin) return null;
  if (isValidPosition(origin, items, geometry, ignoredId, size)) return origin;
  const maxX = Math.floor((geometry.width - 2 * WORKSPACE_PADDING - size.width) / GRID_SIZE);
  const maxY = Math.floor((geometry.height - 2 * WORKSPACE_PADDING - size.height) / GRID_SIZE);
  let nearest: GridPosition | null = null;
  let distance = Infinity;
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= maxX; x++) {
      const nextDistance = (x - origin.x) ** 2 + (y - origin.y) ** 2;
      if (nextDistance < distance && isValidPosition({ x, y }, items, geometry, ignoredId, size)) {
        nearest = { x, y };
        distance = nextDistance;
      }
    }
  }
  return nearest;
}

export function findInitialPosition(items: SpatialItem[], geometry: WorkspaceGeometry, size: Dimensions = { width: geometry.itemSize, height: geometry.itemSize }): GridPosition {
  const stepX = Math.ceil((size.width + ITEM_GAP) / GRID_SIZE);
  const stepY = Math.ceil((size.height + ITEM_GAP) / GRID_SIZE);
  for (let y = 0; WORKSPACE_PADDING + y * GRID_SIZE + size.height <= geometry.height - WORKSPACE_PADDING; y += stepY) {
    for (let x = 0; WORKSPACE_PADDING + x * GRID_SIZE + size.width <= geometry.width - WORKSPACE_PADDING; x += stepX) {
      if (isValidPosition({ x, y }, items, geometry, undefined, size)) return { x, y };
    }
  }
  const fallback = findNearestFreePosition({ x: 0, y: 0 }, items, geometry, undefined, size);
  if (!fallback) throw new Error('No free space in this workspace. Enlarge the window to add an item.');
  return fallback;
}

// Used only on an explicit size change; migration never moves existing items.
export function fitWorkspaceItems(items: WorkspaceItem[], geometry: WorkspaceGeometry, projects: readonly Project[] = []): WorkspaceItem[] {
  const placed: SpatialItem[] = [];
  // Reserve still-valid original positions before relocating any displaced items.
  const result = items.map((item) => {
    const size = getWorkspaceItemDimensions(item, geometry.itemSize, projects);
    if (!isValidPosition(item, placed, geometry, undefined, size)) return null;
    placed.push({ ...item, ...size });
    return item;
  });
  return items.map((item, index) => {
    if (result[index]) return result[index];
    const size = getWorkspaceItemDimensions(item, geometry.itemSize, projects);
    const position = findNearestFreePosition(item, placed, geometry, undefined, size);
    if (!position) throw new Error('This item size does not fit the current workspace. Choose a smaller size or enlarge the window.');
    const next = { ...item, ...position };
    placed.push({ ...next, ...size });
    return next;
  });
}
