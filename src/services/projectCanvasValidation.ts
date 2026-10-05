import type { OtiumData } from '../domain/data';
import type { ProjectCanvasItem } from '../domain/projectCanvasItem';
import type { WidgetInstance } from '../domain/widget';
import { PROJECT_CANVAS_LIMITS } from '../constants/projectCanvas';
import { WidgetRegistry } from './widgetRegistry';

export type CanvasRect = Pick<ProjectCanvasItem, 'x' | 'y' | 'width' | 'height'>;

export function isProjectCanvasPlacement(value: unknown): value is ProjectCanvasItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && !!item.id && typeof item.projectId === 'string' && !!item.projectId &&
    (item.type === 'link' || item.type === 'widget') && typeof item.referenceId === 'string' && !!item.referenceId &&
    (item.trashedAt === undefined || (typeof item.trashedAt === 'number' && Number.isFinite(item.trashedAt) && item.trashedAt > 0));
}

export function normalizeCanvasCoordinate(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(-PROJECT_CANVAS_LIMITS.coordinate, Math.min(PROJECT_CANVAS_LIMITS.coordinate, value)) : 0;
}

export function normalizeCanvasDimension(value: unknown, fallback: number, minimum: number): number {
  const floor = Number.isFinite(minimum) && minimum > 0 ? Math.min(PROJECT_CANVAS_LIMITS.dimension, minimum) : 1;
  const safeFallback = Number.isFinite(fallback) && fallback > 0 ? fallback : floor;
  return Math.max(floor, Math.min(PROJECT_CANVAS_LIMITS.dimension,
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : safeFallback));
}

export function isValidCanvasRect(value: unknown): value is CanvasRect {
  if (!value || typeof value !== 'object') return false;
  const rect = value as CanvasRect;
  return [rect.x, rect.y, rect.width, rect.height].every(value => typeof value === 'number' && Number.isFinite(value)) &&
    Math.abs(rect.x) <= PROJECT_CANVAS_LIMITS.coordinate && Math.abs(rect.y) <= PROJECT_CANVAS_LIMITS.coordinate &&
    rect.width > 0 && rect.height > 0 && rect.width <= PROJECT_CANVAS_LIMITS.dimension && rect.height <= PROJECT_CANVAS_LIMITS.dimension;
}

export function normalizeProjectCanvasItem(item: ProjectCanvasItem, widgets: readonly WidgetInstance[]): ProjectCanvasItem {
  const widget = item.type === 'widget' ? widgets.find(widget => widget.id === item.referenceId) : undefined;
  const definition = widget && WidgetRegistry.get(widget.type);
  const defaults = definition?.defaultSize ?? { width: 80, height: 80 };
  const minimum = definition?.minSize ?? (item.type === 'widget' ? { width: 40, height: 40 } : { width: 1, height: 1 });
  const next = { ...item, x: normalizeCanvasCoordinate(item.x), y: normalizeCanvasCoordinate(item.y),
    width: normalizeCanvasDimension(item.width, defaults.width, minimum.width),
    height: normalizeCanvasDimension(item.height, defaults.height, minimum.height) };
  if (typeof item.zIndex === 'number' && Number.isFinite(item.zIndex)) {
    next.zIndex = Math.max(-PROJECT_CANVAS_LIMITS.zIndex, Math.min(PROJECT_CANVAS_LIMITS.zIndex, item.zIndex));
  } else delete next.zIndex;
  return item.x === next.x && item.y === next.y && item.width === next.width && item.height === next.height && item.zIndex === next.zIndex ? item : next;
}

export function uniqueProjectCanvasPlacements(items: readonly unknown[]): ProjectCanvasItem[] {
  const placements = items.filter(isProjectCanvasPlacement);
  const counts = new Map<string, number>();
  for (const item of placements) counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  return placements.filter(item => counts.get(item.id) === 1);
}

// Persisted placements may include opaque malformed records. Keep them in the
// snapshot; only this resolved, normalized view participates in canvas geometry.
export function activeProjectCanvasItems(data: Pick<OtiumData, 'projects' | 'links' | 'widgetInstances' | 'projectCanvasItems'>, projectId: string): ProjectCanvasItem[] {
  const project = data.projects.find(project => project.id === projectId && !project.trashedAt);
  if (!project) return [];
  const members = new Set(project.linkIds);
  const links = new Map(data.links.map(link => [link.id, link]));
  const widgets = new Map(data.widgetInstances.map(widget => [widget.id, widget]));
  const placedLinks = new Set<string>();
  return uniqueProjectCanvasPlacements(data.projectCanvasItems).flatMap(item => {
    if (item.projectId !== projectId || item.trashedAt) return [];
    if (item.type === 'link') {
      const link = links.get(item.referenceId);
      if (!link || !members.has(link.id) || (link.projectId && link.projectId !== projectId) || placedLinks.has(link.id)) return [];
      placedLinks.add(link.id);
    } else if (!widgets.has(item.referenceId)) return [];
    const widget = widgets.get(item.referenceId);
    return [normalizeProjectCanvasItem(item, item.type === 'widget' && widget ? [widget] : [])];
  });
}
