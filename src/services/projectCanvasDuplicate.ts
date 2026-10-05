import type { OtiumData } from '../domain/data';
import type { ProjectWidgetConfig } from '../domain/projectWidget';
import { findNearestValidPlacement, PROJECT_CANVAS_GRID } from './projectCanvasGeometry';
import { updateProjectWidget } from './projectWidgets';
import { activeProjectCanvasItems, normalizeCanvasCoordinate } from './projectCanvasValidation';

export function duplicateProjectCanvasItem(data: OtiumData, projectId: string, id: string, config?: ProjectWidgetConfig) {
  const project = data.projects.find(entry => entry.id === projectId && !entry.trashedAt);
  const active = activeProjectCanvasItems(data, projectId);
  const item = active.find(entry => entry.id === id);
  if (!project || !item) throw new Error('Project canvas item is unavailable.');
  const referenceId = crypto.randomUUID(), now = Date.now();
  let next = data;
  if (item.type === 'widget') {
    const widget = data.widgetInstances.find(entry => entry.id === item.referenceId);
    if (!widget) throw new Error('Widget is unavailable.');
    next = { ...data, widgetInstances: [...data.widgetInstances, { ...widget, id: referenceId,
      config: JSON.parse(JSON.stringify(widget.config)), createdAt: now, updatedAt: now }] };
    if (config) next = updateProjectWidget(next, referenceId, config);
  } else {
    const link = data.links.find(entry => entry.id === item.referenceId);
    if (!link || !project.linkIds.includes(link.id)) throw new Error('Project link is unavailable.');
    const linkIds = [...project.linkIds]; linkIds.splice(linkIds.indexOf(link.id) + 1, 0, referenceId);
    next = { ...data, links: [...data.links, { ...link, id: referenceId, projectId, createdAt: now, updatedAt: now }],
      projects: data.projects.map(entry => entry.id === projectId ? { ...entry, linkIds, updatedAt: now } : entry) };
  }
  const duplicate = { ...item, id: crypto.randomUUID(), referenceId,
    x: normalizeCanvasCoordinate(Math.round(item.x / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID + PROJECT_CANVAS_GRID),
    y: normalizeCanvasCoordinate(Math.round(item.y / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID + PROJECT_CANVAS_GRID) };
  const offset = findNearestValidPlacement([duplicate], active);
  duplicate.x += offset.x; duplicate.y += offset.y;
  return { data: { ...next, projectCanvasItems: [...next.projectCanvasItems, duplicate] }, id: duplicate.id };
}
