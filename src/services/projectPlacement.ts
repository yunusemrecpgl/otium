import type { OtiumData } from '../domain/data';
import type { ProjectWorkspaceItem } from '../domain/workspace';
import { findInitialPosition, getWorkspaceItemDimensions, toSpatialItems } from '../utils/workspace';
import type { WorkspaceGeometry } from '../utils/workspace';
import { GRID_SIZE, WORKSPACE_PADDING } from '../constants/grid';

export function placeProject(data: OtiumData, projectId: string, geometry: WorkspaceGeometry): OtiumData {
  if (data.workspaceItems.some((item) => item.type === 'project' && item.projectId === projectId && item.containerId === 'home' && !item.trashedAt)) return data;
  if (!data.projects.some((project) => project.id === projectId && !project.trashedAt)) throw new Error('Project not found.');
  const item: ProjectWorkspaceItem = { id: crypto.randomUUID(), type: 'project', projectId, containerId: 'home', x: 0, y: 0 };
  const occupied = toSpatialItems(data.workspaceItems.filter(item => !item.trashedAt && item.containerId === 'home'), geometry.itemSize, data.projects, data.folders);
  const size = getWorkspaceItemDimensions(item, geometry.itemSize, data.projects, data.folders);
  const bottom = occupied.reduce((height, entry) => Math.max(height, WORKSPACE_PADDING * 2 + entry.y * GRID_SIZE + entry.height), geometry.height);
  const position = findInitialPosition(occupied, { ...geometry, height: bottom + size.height + GRID_SIZE }, size);
  return { ...data, workspaceItems: [...data.workspaceItems, { ...item, ...position }] };
}

