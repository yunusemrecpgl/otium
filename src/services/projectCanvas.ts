import type { OtiumData } from '../domain/data';
import { normalizeProjectCanvasZoom } from '../domain/projectCanvasState';
import type { ProjectCanvasZoom } from '../domain/projectCanvasState';
import type { ProjectCanvasItem } from '../domain/projectCanvasItem';
import { WidgetRegistry } from './widgetRegistry';
import { resolveProjectLinks } from '../utils/projectLinks';
import { findNearestValidPlacement, PROJECT_CANVAS_GRID, resolveProjectCanvasSize } from './projectCanvasGeometry';
import { activeProjectCanvasItems, isProjectCanvasPlacement, isValidCanvasRect, normalizeCanvasCoordinate, normalizeCanvasDimension } from './projectCanvasValidation';
import { PROJECT_CANVAS_LIMITS } from '../constants/projectCanvas';

export { PROJECT_CANVAS_GRID } from './projectCanvasGeometry';
export const PROJECT_LINK_SIZE = 80;

export function nextProjectCanvasPosition(data: OtiumData, projectId: string) {
  const right = activeProjectCanvasItems(data, projectId).reduce((right, item) => Math.max(right, item.x + item.width), 0);
  return { x: normalizeCanvasCoordinate(Math.ceil(right / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID + PROJECT_CANVAS_GRID), y: PROJECT_CANVAS_GRID };
}

export function projectCanvasGroupPositions(items: ProjectCanvasItem[], anchorId: string, dx: number, dy: number, snap: boolean) {
  if (!items.length || !items.every(isProjectCanvasPlacement) || !items.every(isValidCanvasRect) ||
      !Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error('Project canvas selection is unavailable.');
  const anchor = items.find(item => item.id === anchorId);
  if (!anchor) throw new Error('Project canvas selection is unavailable.');
  const bounds = items.reduce((bounds, item) => ({ left: Math.min(bounds.left, item.x), right: Math.max(bounds.right, item.x),
    top: Math.min(bounds.top, item.y), bottom: Math.max(bounds.bottom, item.y) }), { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y });
  const minX = -PROJECT_CANVAS_LIMITS.coordinate - bounds.left, maxX = PROJECT_CANVAS_LIMITS.coordinate - bounds.right;
  const minY = -PROJECT_CANVAS_LIMITS.coordinate - bounds.top, maxY = PROJECT_CANVAS_LIMITS.coordinate - bounds.bottom;
  dx = Math.max(minX, Math.min(maxX, dx)); dy = Math.max(minY, Math.min(maxY, dy));
  if (snap) {
    dx = Math.round((anchor.x + dx) / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID - anchor.x;
    dy = Math.round((anchor.y + dy) / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID - anchor.y;
    dx = Math.max(Math.ceil((anchor.x + minX) / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID - anchor.x,
      Math.min(Math.floor((anchor.x + maxX) / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID - anchor.x, dx));
    dy = Math.max(Math.ceil((anchor.y + minY) / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID - anchor.y,
      Math.min(Math.floor((anchor.y + maxY) / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID - anchor.y, dy));
  }
  const positions = items.map(item => ({ id: item.id, x: item.x + dx, y: item.y + dy }));
  if (positions.some(position => Math.abs(position.x) > PROJECT_CANVAS_LIMITS.coordinate || Math.abs(position.y) > PROJECT_CANVAS_LIMITS.coordinate)) {
    throw new Error('A safe canvas position could not be found.');
  }
  return positions;
}

export function resolveProjectCanvasGroupPositions(items: ProjectCanvasItem[], anchorId: string, dx: number, dy: number, allItems: ProjectCanvasItem[]) {
  const positions = projectCanvasGroupPositions(items, anchorId, dx, dy, true);
  const ids = new Set(items.map(item => item.id));
  const moving = items.map((item, index) => ({ ...item, ...positions[index] }));
  const offset = findNearestValidPlacement(moving, allItems.filter(item => isProjectCanvasPlacement(item) && !ids.has(item.id)));
  return positions.map(position => ({ ...position, x: position.x + offset.x, y: position.y + offset.y }));
}

export function moveProjectCanvasGroup(data: OtiumData, projectId: string, ids: string[], anchorId: string, dx: number, dy: number): OtiumData {
  const project = data.projects.find(entry => entry.id === projectId && !entry.trashedAt);
  const active = activeProjectCanvasItems(data, projectId);
  const items = active.filter(item => ids.includes(item.id));
  if (!project || !ids.length || new Set(ids).size !== ids.length || items.length !== ids.length || !ids.includes(anchorId) ||
      !Number.isFinite(dx) || !Number.isFinite(dy) || items.some(item => item.type === 'link' && !project.linkIds.includes(item.referenceId))) {
    throw new Error('Project canvas selection is unavailable.');
  }
  const positions = new Map(resolveProjectCanvasGroupPositions(items, anchorId, dx, dy,
    active).map(position => [position.id, position]));
  const normalized = new Map(items.map(item => [item.id, item]));
  return ensureProjectCanvasState({ ...data, projectCanvasItems: data.projectCanvasItems.map(item => {
    const position = isProjectCanvasPlacement(item) && positions.get(item.id);
    return position ? { ...normalized.get(item.id)!, x: position.x, y: position.y } : item;
  }) }, projectId);
}

export function snapProjectCanvasSize(width: number, height: number, minSize = { width: 40, height: 40 }) {
  const minimum = { width: Math.ceil(normalizeCanvasDimension(minSize.width, 40, 1) / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID,
    height: Math.ceil(normalizeCanvasDimension(minSize.height, 40, 1) / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID };
  return { width: Math.round(normalizeCanvasDimension(width, minimum.width, minimum.width) / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID,
    height: Math.round(normalizeCanvasDimension(height, minimum.height, minimum.height) / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID };
}

export function resizeProjectCanvasItem(data: OtiumData, projectId: string, id: string, width: number, height: number, minSize?: { width: number; height: number }): OtiumData {
  const active = activeProjectCanvasItems(data, projectId);
  const item = active.find(entry => entry.id === id);
  const widget = data.widgetInstances.find(entry => entry.id === item?.referenceId);
  const definition = widget && WidgetRegistry.get(widget.type);
  if (!data.projects.some(project => project.id === projectId && !project.trashedAt) || !item || item.type === 'link' || !definition?.resizable ||
      !Number.isFinite(width) || !Number.isFinite(height) ||
      (minSize && (!Number.isFinite(minSize.width) || !Number.isFinite(minSize.height) || minSize.width <= 0 || minSize.height <= 0))) {
    throw new Error('Canvas item cannot be resized.');
  }
  const size = resolveProjectCanvasSize(item, width, height,
    active.filter(other => other.id !== id), definition.minSize ?? minSize);
  return ensureProjectCanvasState({ ...data, projectCanvasItems: data.projectCanvasItems.map(entry => isProjectCanvasPlacement(entry) && entry.id === id ? { ...item, ...size } : entry) }, projectId);
}

export function ensureProjectCanvasState(data: OtiumData, projectId: string, _viewport?: { width: number; height: number }): OtiumData {
  const existing = data.projectCanvasStates.find(state => state.projectId === projectId);
  if (existing) return data;
  // Legacy dimensions remain as inert compatibility metadata, never camera bounds.
  const state = { projectId, width: 1600, height: 1200, zoom: normalizeProjectCanvasZoom(1) };
  return { ...data, projectCanvasStates: existing
    ? data.projectCanvasStates.map(entry => entry.projectId === projectId ? state : entry)
    : [...data.projectCanvasStates, state] };
}

export function setProjectCanvasZoom(data: OtiumData, projectId: string, zoom: ProjectCanvasZoom): OtiumData {
  if (!data.projectCanvasStates.some(state => state.projectId === projectId)) throw new Error('Project canvas is unavailable.');
  return { ...data, projectCanvasStates: data.projectCanvasStates.map(state => state.projectId === projectId
    ? { ...state, zoom: normalizeProjectCanvasZoom(zoom) } : state) };
}

export function ensureProjectCanvasLinks(data: OtiumData, projectId: string): OtiumData {
  const project = data.projects.find(entry => entry.id === projectId && !entry.trashedAt);
  if (!project) throw new Error('Project not found.');
  const items = [...data.projectCanvasItems];
  for (const link of resolveProjectLinks(project, data.links)) {
    // A trashed placement is a tombstone, not a missing item to regenerate.
    if (items.some(item => isProjectCanvasPlacement(item) && item.projectId === projectId && item.type === 'link' && item.referenceId === link.id)) continue;
    const active = activeProjectCanvasItems({ ...data, projectCanvasItems: items }, projectId);
    const intended = { ...nextProjectCanvasPosition({ ...data, projectCanvasItems: items }, projectId), width: PROJECT_LINK_SIZE, height: PROJECT_LINK_SIZE };
    const offset = findNearestValidPlacement([intended], active);
    items.push({ id: crypto.randomUUID(), projectId, type: 'link', referenceId: link.id,
      ...intended, x: intended.x + offset.x, y: intended.y + offset.y });
  }
  const next = items.length === data.projectCanvasItems.length ? data : { ...data, projectCanvasItems: items };
  return data.projectCanvasStates.some(state => state.projectId === projectId) ? ensureProjectCanvasState(next, projectId) : next;
}

export function moveProjectCanvasLink(data: OtiumData, projectId: string, id: string, x: number, y: number): OtiumData {
  const project = data.projects.find(entry => entry.id === projectId && !entry.trashedAt);
  const active = activeProjectCanvasItems(data, projectId);
  const item = active.find(entry => entry.id === id && entry.type === 'link');
  if (!project || !item || !project.linkIds.includes(item.referenceId) || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error('Project canvas item is unavailable.');
  }
  const [position] = resolveProjectCanvasGroupPositions([item], id, x - item.x, y - item.y,
    active);
  return ensureProjectCanvasState({ ...data, projectCanvasItems: data.projectCanvasItems.map(entry => isProjectCanvasPlacement(entry) && entry.id === id ? { ...item, ...position } : entry) }, projectId);
}
