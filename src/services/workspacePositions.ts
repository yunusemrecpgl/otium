import type { Project } from '../domain/project';
import type { Folder } from '../domain/folder';
import type { WorkspaceItem } from '../domain/workspace';
import type { WorkspaceGeometry } from '../utils/workspace';
import { toSpatialItems } from '../utils/workspace';
import { isValidSpatialChanges } from '../utils/horizontalInsertion';
import type { WorkspacePositionChange } from '../utils/horizontalInsertion';

export function updateWorkspacePositions(items: WorkspaceItem[], changes: WorkspacePositionChange[], geometry: WorkspaceGeometry, projects: readonly Project[] = [], folders: readonly Folder[] = []): WorkspaceItem[] {
  const byId = new Map(changes.map((change) => [change.id, change]));
  if (!changes.length || byId.size !== changes.length ||
      changes.some((change) => !items.some((item) => item.id === change.id && !item.trashedAt))) {
    throw new Error('The workspace changed. Please try the insertion again.');
  }
  const next = items.map((item) => {
    const change = byId.get(item.id);
    return change ? { ...item, x: change.x, y: change.y } : item;
  });
  const containers = new Set(next.filter(item => byId.has(item.id)).map(item => item.containerId));
  if ([...containers].some(container => !isValidSpatialChanges(toSpatialItems(next.filter(item => !item.trashedAt && item.containerId === container), geometry.itemSize, projects, folders), new Set(byId.keys()), geometry))) {
    throw new Error('This insertion layout is unavailable.');
  }
  return next;
}
