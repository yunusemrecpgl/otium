import type { OtiumData } from '../domain/data';
import { GRID_SIZE, WORKSPACE_PADDING } from '../constants/grid';
import { findNearestFreePosition, getWorkspaceItemDimensions, toSpatialItems } from '../utils/workspace';
import type { WorkspaceGeometry } from '../utils/workspace';
import { canTransferToContainer, getFolderPath } from '../utils/folderHierarchy';
import { restoreProjectCanvasItem } from './projectCanvasTrash';
import { isProjectCanvasPlacement, uniqueProjectCanvasPlacements } from './projectCanvasValidation';

export const TRASH_DESTINATION = '__otium_trash__';

export function hasPermanentTrash(data: OtiumData): boolean {
  return data.projects.some(item => !!item.trashedAt) || data.folders.some(item => !!item.trashedAt) ||
    data.workspaceItems.some(item => !!item.trashedAt) || data.projectCanvasItems.some(item => isProjectCanvasPlacement(item) && !!item.trashedAt);
}

export function emptyTrash(data: OtiumData): OtiumData {
  const projects = new Set(data.projects.filter(item => item.trashedAt).map(item => item.id));
  const folders = new Set(data.folders.filter(item => item.trashedAt).map(item => item.id));
  // Folder descendants are hidden with their parent. Keep any Folder which
  // also has a surviving placement outside the deleted subtree.
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of data.workspaceItems) {
      if (item.type !== 'folder' || !folders.has(item.containerId) || folders.has(item.folderId)) continue;
      if (data.workspaceItems.some(other => other.type === 'folder' && other.folderId === item.folderId && !other.trashedAt && !folders.has(other.containerId))) continue;
      folders.add(item.folderId); changed = true;
    }
  }
  const removedWorkspace = data.workspaceItems.filter(item => item.trashedAt || folders.has(item.containerId) ||
    (item.type === 'folder' && folders.has(item.folderId)) || (item.type === 'project' && projects.has(item.projectId)));
  const removedIds = new Set(removedWorkspace.map(item => item.id));
  const workspaceItems = data.workspaceItems.filter(item => !removedIds.has(item.id));
  const removedCanvas = data.projectCanvasItems.filter(item => isProjectCanvasPlacement(item) && (item.trashedAt || projects.has(item.projectId)));
  const canvasIds = new Set(removedCanvas.map(item => item.id));
  const projectCanvasItems = data.projectCanvasItems.filter(item => !canvasIds.has(item.id));
  const remainingProjects = data.projects.filter(item => !projects.has(item.id)).map(project => {
    const removedLinks = new Set(removedCanvas.filter(item => item.projectId === project.id && item.type === 'link').map(item => item.referenceId));
    const survivingLinks = new Set(projectCanvasItems.filter(item => item.projectId === project.id && item.type === 'link').map(item => item.referenceId));
    return { ...project, linkIds: project.linkIds.filter(id => !removedLinks.has(id) || survivingLinks.has(id)) };
  });
  const linkCandidates = new Set([
    ...removedWorkspace.flatMap(item => item.type === 'link' ? [item.linkId] : []),
    ...removedCanvas.flatMap(item => item.type === 'link' ? [item.referenceId] : []),
    ...data.projects.filter(item => projects.has(item.id)).flatMap(item => item.linkIds),
    ...data.links.filter(item => item.projectId && projects.has(item.projectId)).map(item => item.id),
  ]);
  const usedLinks = new Set([...workspaceItems.flatMap(item => item.type === 'link' ? [item.linkId] : []),
    ...projectCanvasItems.flatMap(item => item.type === 'link' ? [item.referenceId] : []), ...remainingProjects.flatMap(item => item.linkIds)]);
  const widgetCandidates = new Set(removedCanvas.filter(item => item.type === 'widget').map(item => item.referenceId));
  const usedWidgets = new Set(projectCanvasItems.filter(item => item.type === 'widget').map(item => item.referenceId));
  return { ...data, workspaceItems, projectCanvasItems, projects: remainingProjects,
    folders: data.folders.filter(item => !folders.has(item.id)),
    projectCanvasStates: data.projectCanvasStates.filter(item => !projects.has(item.projectId)),
    links: data.links.filter(item => !linkCandidates.has(item.id) || usedLinks.has(item.id)).map(item => {
      if (!item.projectId || !projects.has(item.projectId)) return item;
      const retained = { ...item }; delete retained.projectId; return retained;
    }),
    widgetInstances: data.widgetInstances.filter(item => !widgetCandidates.has(item.id) || usedWidgets.has(item.id)) };
}

export interface TrashTarget {
  type: 'workspace' | 'project' | 'folder' | 'canvas';
  id: string;
}

export function getTrashEntries(data: OtiumData): (TrashTarget & { trashedAt: number })[] {
  const projects = new Set(data.projects.filter(project => project.trashedAt).map(project => project.id));
  const folders = new Set(data.folders.filter(folder => folder.trashedAt).map(folder => folder.id));
  return [
    ...data.projects.flatMap(project => project.trashedAt ? [{ type: 'project' as const, id: project.id, trashedAt: project.trashedAt }] : []),
    ...data.folders.flatMap(folder => folder.trashedAt ? [{ type: 'folder' as const, id: folder.id, trashedAt: folder.trashedAt }] : []),
    ...data.workspaceItems.flatMap(item => item.trashedAt &&
      !(item.type === 'project' && projects.has(item.projectId)) && !(item.type === 'folder' && folders.has(item.folderId))
      ? [{ type: 'workspace' as const, id: item.id, trashedAt: item.trashedAt }] : []),
    ...uniqueProjectCanvasPlacements(data.projectCanvasItems).flatMap(item => item.trashedAt ? [{ type: 'canvas' as const, id: item.id, trashedAt: item.trashedAt }] : []),
  ].sort((a, b) => b.trashedAt - a.trashedAt);
}

export function trashWorkspaceItems(data: OtiumData, ids: string[]): OtiumData {
  const selected = data.workspaceItems.filter(item => ids.includes(item.id) && !item.trashedAt);
  if (!selected.length) return data;
  const placements = new Set(selected.map(item => item.id));
  const folders = new Set(selected.flatMap(item => item.type === 'folder' ? [item.folderId] : []));
  const trashedAt = Date.now();
  return {
    ...data,
    workspaceItems: data.workspaceItems.map(item => placements.has(item.id)
      ? { ...item, trashedAt, ...(item.type === 'project' ? { trashedWithProject: false } : {}) } : item),
    folders: data.folders.map(folder => folders.has(folder.id) ? { ...folder, trashedAt } : folder),
  };
}

function restoreRecord<T extends { trashedAt?: number; trashedWithProject?: boolean }>(record: T): T {
  const active = { ...record };
  delete active.trashedAt;
  delete active.trashedWithProject;
  return active;
}

function restoreWorkspacePlacement(data: OtiumData, id: string, geometry: WorkspaceGeometry, preserveContainer = false): OtiumData {
  const item = data.workspaceItems.find(item => item.id === id && item.trashedAt);
  if (!item) throw new Error('Trash entry is no longer available.');
  const containerId = preserveContainer ? item.containerId : item.containerId === 'home' || !getFolderPath(data, item.containerId) ||
    !canTransferToContainer({ ...data, workspaceItems: data.workspaceItems.map(entry => entry.id === id ? restoreRecord(entry) : entry) }, [id], item.containerId)
    ? 'home' : item.containerId;
  const size = getWorkspaceItemDimensions(item, geometry.itemSize, data.projects, data.folders);
  const occupied = toSpatialItems(data.workspaceItems.filter(entry => !entry.trashedAt && entry.containerId === containerId), geometry.itemSize, data.projects, data.folders);
  const room = { ...geometry, height: Math.max(geometry.height,
    WORKSPACE_PADDING * 2 + item.y * GRID_SIZE + size.height,
    ...occupied.map(entry => WORKSPACE_PADDING * 2 + entry.y * GRID_SIZE + entry.height)) + size.height + GRID_SIZE };
  const position = findNearestFreePosition(item, occupied, room, undefined, size);
  if (!position) throw new Error('No room to restore this item. Enlarge the window.');
  return {
    ...data,
    workspaceItems: data.workspaceItems.map(entry => entry.id === id ? { ...restoreRecord(entry), containerId, ...position } as typeof entry : entry),
  };
}

function restoreProject(data: OtiumData, id: string, geometry: WorkspaceGeometry): OtiumData {
  const project = data.projects.find(project => project.id === id && project.trashedAt);
  if (!project) throw new Error('Project Trash entry is no longer available.');
  const placements = data.workspaceItems.filter(item => item.type === 'project' && item.projectId === id && item.trashedAt &&
    (item.trashedWithProject || (item.trashedWithProject === undefined && item.trashedAt === project.trashedAt)));
  let next = { ...data, projects: data.projects.map(entry => entry.id === id ? restoreRecord(entry) : entry) };
  for (const placement of placements) {
    // Keep shortcuts in their original container, even if a parent Folder is
    // still trashed. They become visible again when that Folder is restored.
    next = restoreWorkspacePlacement(next, placement.id, geometry, true);
  }
  return next;
}

function restoreFolder(data: OtiumData, id: string, geometry: WorkspaceGeometry): OtiumData {
  const folder = data.folders.find(folder => folder.id === id && folder.trashedAt);
  if (!folder) throw new Error('Folder Trash entry is no longer available.');
  const next = { ...data, folders: data.folders.map(entry => entry.id === id ? restoreRecord(entry) : entry) };
  const placement = data.workspaceItems.find(item => item.type === 'folder' && item.folderId === id && item.trashedAt);
  // Descendants were never removed; restoring the root makes the same subtree
  // accessible through the existing Folder hierarchy queries.
  return placement ? restoreWorkspacePlacement(next, placement.id, geometry) : next;
}

export function restoreTrashEntry(data: OtiumData, target: TrashTarget | string, geometry: WorkspaceGeometry): OtiumData {
  const entry: TrashTarget = typeof target === 'string' ? { type: 'workspace', id: target } : target;
  if (entry.type === 'canvas') return restoreProjectCanvasItem(data, entry.id);
  if (entry.type === 'project') return restoreProject(data, entry.id, geometry);
  if (entry.type === 'folder') return restoreFolder(data, entry.id, geometry);
  const item = data.workspaceItems.find(item => item.id === entry.id && item.trashedAt);
  if (!item) throw new Error('Trash entry is no longer available.');
  // Legacy placement-based restore remains compatible, while domain deletes
  // restore all and only the placements deleted with the Project.
  if (item.type === 'project' && data.projects.some(project => project.id === item.projectId && project.trashedAt)) {
    return restoreProject(data, item.projectId, geometry);
  }
  if (item.type === 'folder' && data.folders.some(folder => folder.id === item.folderId && folder.trashedAt)) {
    return restoreFolder(data, item.folderId, geometry);
  }
  return restoreWorkspacePlacement(data, entry.id, geometry);
}
