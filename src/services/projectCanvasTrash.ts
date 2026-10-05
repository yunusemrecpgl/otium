import type { OtiumData } from '../domain/data';
import { findNearestValidPlacement } from './projectCanvasGeometry';
import { activeProjectCanvasItems, isProjectCanvasPlacement, normalizeProjectCanvasItem, uniqueProjectCanvasPlacements } from './projectCanvasValidation';

export function trashProjectCanvasItems(data: OtiumData, projectId: string, ids: string[]): OtiumData {
  const project = data.projects.find(entry => entry.id === projectId && !entry.trashedAt);
  const selected = new Set(ids);
  const items = activeProjectCanvasItems(data, projectId).filter(item => selected.has(item.id));
  if (!project || !items.length || items.length !== selected.size) throw new Error('Project canvas items are unavailable.');
  const trashedAt = Date.now();
  return { ...data,
    projectCanvasItems: data.projectCanvasItems.map(item => isProjectCanvasPlacement(item) && item.projectId === projectId && selected.has(item.id)
      ? { ...item, trashedAt } : item),
  };
}

export function restoreProjectCanvasItem(data: OtiumData, id: string): OtiumData {
  const stored = uniqueProjectCanvasPlacements(data.projectCanvasItems).find(entry => entry.id === id && entry.trashedAt);
  if (!stored) throw new Error('Canvas Trash entry is no longer available.');
  const item = normalizeProjectCanvasItem(stored, data.widgetInstances);
  const project = data.projects.find(entry => entry.id === item.projectId);
  if (!project || project.trashedAt) throw new Error('Restore the owning Project before restoring this canvas item.');
  const reference = item.type === 'widget'
    ? data.widgetInstances.find(widget => widget.id === item.referenceId)
    : data.links.find(link => link.id === item.referenceId && (!link.projectId || link.projectId === project.id));
  if (!reference) throw new Error('The original canvas resource is unavailable.');
  const obstacles = activeProjectCanvasItems(data, project.id);
  if (item.type === 'link' && obstacles.some(entry => entry.type === 'link' && entry.referenceId === item.referenceId)) {
    throw new Error('This website already has an active canvas placement.');
  }
  const offset = findNearestValidPlacement([item], obstacles);
  const restored = { ...item, x: item.x + offset.x, y: item.y + offset.y };
  delete restored.trashedAt;
  return { ...data,
    projectCanvasItems: data.projectCanvasItems.map(entry => isProjectCanvasPlacement(entry) && entry.id === id ? restored : entry),
    // Builder removal may have removed membership. Restore it once, without
    // changing the order of existing members or allocating another placement.
    projects: item.type === 'link' && !project.linkIds.includes(item.referenceId)
      ? data.projects.map(entry => entry.id === project.id
        ? { ...entry, linkIds: [...entry.linkIds, item.referenceId], updatedAt: Date.now() } : entry) : data.projects,
  };
}
