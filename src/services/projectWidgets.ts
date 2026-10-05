import { isTextConfig, normalizeTextStyle } from '../domain/text';
import { isPageWatchConfig, migratePageWatchConfig, pageWatchFields, pageWatchSourceMode, resetPageWatchField, resetPageWatchBaseline } from '../domain/pageWatch';
import { defaultFormulaConfig, isFormulaConfig, serializeFormula } from '../domain/formula';
import type { OtiumData } from '../domain/data';
import type { ProjectWidgetConfig, ProjectWidgetType } from '../domain/projectWidget';
import { isTodoConfig } from '../domain/todo';
import { isResourceConfig } from '../domain/resource';
import { isWebDataConfig } from '../domain/webData';
import { isClipConfig } from '../domain/clip';
import { defaultCompareConfig, isCompareConfig, serializeCompare } from '../domain/compare';
import { isRssConfig } from '../domain/rss';
import type { WidgetConfigValue } from '../domain/widget';
import { WidgetRegistry } from './widgetRegistry';
import { ensureProjectCanvasState, PROJECT_CANVAS_GRID } from './projectCanvas';
import { findNearestValidPlacement } from './projectCanvasGeometry';
import { activeProjectCanvasItems, normalizeCanvasCoordinate } from './projectCanvasValidation';
import { preserveWidgetConfig } from './widgetConfig';

export function addProjectWidget(data: OtiumData, projectId: string, type: ProjectWidgetType, position: { x: number; y: number }): OtiumData {
  const definition = WidgetRegistry.get(type);
  if (!definition?.allowedScopes.includes('project') || !data.projects.some(project => project.id === projectId && !project.trashedAt) || !Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new Error('Project widget is unavailable.');
  const config: Record<string, WidgetConfigValue> = type === 'text' ? { text: '' }
    : type === 'page-watch' ? { title: 'Page Watch', url: '', selector: '', refreshMinutes: 30, mode: 'static', fields: [{ id: crypto.randomUUID(), label: 'Value', selectorOrPath: '', selector: '', directPath: '' }] }
    : type === 'formula' ? serializeFormula(defaultFormulaConfig())
    : type === 'rss' ? { title: 'RSS Feed', feedUrl: '', refreshMinutes: 30, itemLimit: 5 }
    : type === 'compare' ? serializeCompare(defaultCompareConfig())
    : type === 'clip' ? { text: '', sourceUrl: '', sourceTitle: '' }
    : type === 'web-data' ? { title: 'Web Data', url: '', jsonPath: '', refreshMinutes: 15, fields: [] }
    : type === 'resource' ? { title: 'Resource', url: '', label: '' }
    : type === 'todo' ? { title: 'Todo', items: [] } : { title: 'Note', text: '' };
  const now = Date.now(), id = crypto.randomUUID();
  const placement = { x: Math.round(normalizeCanvasCoordinate(position.x) / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID,
    y: Math.round(normalizeCanvasCoordinate(position.y) / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID, ...definition.defaultSize };
  const offset = findNearestValidPlacement([placement], activeProjectCanvasItems(data, projectId));
  return ensureProjectCanvasState({ ...data,
    widgetInstances: [...data.widgetInstances, { id, type, version: definition.version, config, createdAt: now, updatedAt: now }],
    projectCanvasItems: [...data.projectCanvasItems, { id: crypto.randomUUID(), projectId, type: 'widget', referenceId: id,
      ...placement, x: placement.x + offset.x, y: placement.y + offset.y }],
  }, projectId);
}

export function updateProjectWidget(data: OtiumData, id: string, config: ProjectWidgetConfig): OtiumData {
  const instance = data.widgetInstances.find(widget => widget.id === id);
  if (!instance) return data;
  let stored: Record<string, WidgetConfigValue>;
  if (instance.type === 'text' && isTextConfig(config)) {
    stored = { text: config.text, ...(config.style ? { style: { ...normalizeTextStyle(config.style) } } : {}) };
  } else if (instance.type === 'page-watch' && isPageWatchConfig(config)) {
    const old = isPageWatchConfig(instance.config) ? instance.config : null;
    const sourceChanged = !old || old.url !== config.url || old.directUrl !== config.directUrl || pageWatchSourceMode(old) !== pageWatchSourceMode(config);
    const next = sourceChanged ? resetPageWatchBaseline(config) : migratePageWatchConfig(config);
    if (old && !sourceChanged) {
      const previous = new Map(pageWatchFields(old).map(field => [field.id, field]));
      next.fields = pageWatchFields(next).map(field => previous.get(field.id)?.selectorOrPath !== field.selectorOrPath ? resetPageWatchField(field) : field);
    }
    stored = { title: next.title, url: next.url, selector: next.selector ?? '', refreshMinutes: next.refreshMinutes, mode: next.mode ?? 'static',
      sourceMode: next.sourceMode ?? next.mode ?? 'static',
      ...(next.directUrl !== undefined ? { directUrl: next.directUrl } : {}),
      ...(next.directPath !== undefined ? { directPath: next.directPath } : {}),
      fields: pageWatchFields(next).map(field => ({ ...field })),
      ...(next.style ? { style: { ...normalizeTextStyle(next.style) } } : {}),
      ...(next.lastCheckedAt !== undefined ? { lastCheckedAt: next.lastCheckedAt } : {}) };
  } else if (instance.type === 'formula' && isFormulaConfig(config)) {
    stored = serializeFormula(config);
  } else if (instance.type === 'rss' && isRssConfig(config)) {
    stored = { title: config.title, feedUrl: config.feedUrl, refreshMinutes: config.refreshMinutes, itemLimit: config.itemLimit,
      ...(config.style ? { style: { ...normalizeTextStyle(config.style) } } : {}) };
  } else if (instance.type === 'compare' && isCompareConfig(config)) {
    stored = serializeCompare(config);
  } else if (instance.type === 'clip' && isClipConfig(config)) {
    const old = isClipConfig(instance.config) ? instance.config : undefined;
    const originalText = old?.originalText ?? (old?.text || config.originalText);
    stored = { text: config.text, sourceUrl: config.sourceUrl, sourceTitle: config.sourceTitle,
      ...(originalText !== undefined ? { originalText } : {}),
      ...(config.faviconUrl ? { faviconUrl: config.faviconUrl } : {}),
      ...(config.textFragmentUrl ? { textFragmentUrl: config.textFragmentUrl } : {}),
      ...(config.style ? { style: { ...normalizeTextStyle(config.style) } } : {}) };
  } else if (instance.type === 'web-data' && isWebDataConfig(config)) {
    stored = { title: config.title, url: config.url, jsonPath: config.jsonPath, refreshMinutes: config.refreshMinutes,
      ...(config.fields ? { fields: config.fields.slice(0, 8).map(field => ({ ...field })) } : {}),
      ...(config.style ? { style: { ...normalizeTextStyle(config.style) } } : {}) };
  } else if (instance.type === 'resource' && isResourceConfig(config)) {
    stored = { title: config.title, url: config.url, label: config.label,
      ...(config.datetime ? { datetime: config.datetime } : {}),
      ...(config.style ? { style: { ...normalizeTextStyle(config.style) } } : {}) };
  } else if (instance.type === 'todo' && isTodoConfig(config)) {
    stored = { title: config.title, items: config.items.map(item => ({ id: item.id, text: item.text, completed: item.completed })),
      ...(config.style ? { style: { ...normalizeTextStyle(config.style) } } : {}) };
  } else if (instance.type === 'note' && 'title' in config && typeof config.title === 'string' && 'text' in config && typeof config.text === 'string') {
    stored = { title: config.title, text: config.text,
      ...('listStyle' in config && (config.listStyle === 'none' || config.listStyle === 'bullet' || config.listStyle === 'numbered') ? { listStyle: config.listStyle } : {}),
      ...('style' in config && config.style ? { style: { ...normalizeTextStyle(config.style) } } : {}) };
  } else throw new Error('Invalid widget content.');
  stored = preserveWidgetConfig(instance.type as ProjectWidgetType, instance.config, stored);
  return { ...data, widgetInstances: data.widgetInstances.map(widget => widget.id === id
    ? { ...widget, version: widget.type === 'page-watch' ? Math.max(widget.version, 4) : widget.version, config: stored, updatedAt: Date.now() } : widget) };
}


