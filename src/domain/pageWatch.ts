import type { WidgetDefinition } from './widget';
import type { TextStyle } from './text';

export const PAGE_WATCH_DEFINITION: WidgetDefinition = {
  type: 'page-watch', name: 'Page Watch', version: 4, icon: 'eye',
  allowedScopes: ['project'], resizable: true,
  defaultSize: { width: 320, height: 340 }, minSize: { width: 160, height: 160 },
};
export interface PageWatchConfig {
  style?: TextStyle;
  title: string; url: string; selector?: string; refreshMinutes: number;
  mode?: 'static' | 'rendered';
  sourceMode?: 'static' | 'rendered' | 'direct';
  directUrl?: string; directPath?: string;
  currentValue?: string; previousValue?: string; lastChangedAt?: number; lastCheckedAt?: number;
  fields?: PageWatchField[];
}
export interface PageWatchField {
  id: string; label: string; selectorOrPath: string;
  selector?: string; directPath?: string;
  currentValue?: string; previousValue?: string; lastChangedAt?: number;
}
export function pageWatchFields(config: PageWatchConfig): PageWatchField[] {
  if (config.fields) return config.fields;
  return [{ id: 'legacy-field', label: 'Value', selectorOrPath: pageWatchSourceMode(config) === 'direct' ? config.directPath ?? '' : config.selector ?? '',
    selector: config.selector ?? '', directPath: config.directPath ?? '',
    ...(config.currentValue !== undefined ? { currentValue: config.currentValue } : {}),
    ...(config.previousValue !== undefined ? { previousValue: config.previousValue } : {}),
    ...(config.lastChangedAt !== undefined ? { lastChangedAt: config.lastChangedAt } : {}) }];
}
export function migratePageWatchConfig(config: PageWatchConfig): PageWatchConfig {
  const next = { ...config, fields: pageWatchFields(config) };
  delete next.currentValue; delete next.previousValue; delete next.lastChangedAt;
  return next;
}
export function resetPageWatchField(field: PageWatchField): PageWatchField {
  return { id: field.id, label: field.label, selectorOrPath: field.selectorOrPath,
    ...(field.selector !== undefined ? { selector: field.selector } : {}),
    ...(field.directPath !== undefined ? { directPath: field.directPath } : {}) };
}
export function resetPageWatchBaseline(config: PageWatchConfig): PageWatchConfig {
  return { title: config.title, url: config.url, selector: config.selector ?? '', refreshMinutes: config.refreshMinutes,
    mode: config.mode ?? 'static', sourceMode: pageWatchSourceMode(config),
    ...(config.directUrl !== undefined ? { directUrl: config.directUrl } : {}),
    ...(config.directPath !== undefined ? { directPath: config.directPath } : {}),
    ...(config.style ? { style: config.style } : {}),
    fields: pageWatchFields(config).map(resetPageWatchField) };
}
export function pageWatchSourceMode(config: Pick<PageWatchConfig, 'mode' | 'sourceMode'>): 'static' | 'rendered' | 'direct' {
  return config.sourceMode ?? config.mode ?? 'static';
}
export function pageWatchSourceKey(config: PageWatchConfig): string {
  return JSON.stringify([config.url, pageWatchSourceMode(config), config.directUrl ?? '',
    pageWatchFields(config).map(field => [field.id, field.selectorOrPath])]);
}
export function normalizeWatchedText(text: string): string { return text.replace(/\s+/g, ' ').trim(); }
export function isPageWatchConfig(value: unknown): value is PageWatchConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<PageWatchConfig>;
  return typeof config.title === 'string' && typeof config.url === 'string' &&
    (typeof config.selector === 'string' || (config.selector === undefined && Array.isArray(config.fields))) &&
    (config.mode === undefined || config.mode === 'static' || config.mode === 'rendered') &&
    (config.sourceMode === undefined || ['static', 'rendered', 'direct'].includes(config.sourceMode)) &&
    (config.directUrl === undefined || typeof config.directUrl === 'string') &&
    (config.directPath === undefined || typeof config.directPath === 'string') &&
    typeof config.refreshMinutes === 'number' && Number.isFinite(config.refreshMinutes) && config.refreshMinutes >= 5 &&
    (config.currentValue === undefined || typeof config.currentValue === 'string') &&
    (config.previousValue === undefined || typeof config.previousValue === 'string') &&
    [config.lastChangedAt, config.lastCheckedAt].every(validTimestamp) &&
    (config.fields === undefined || (Array.isArray(config.fields) && config.fields.length >= 1 &&
      new Set(config.fields.map(field => field?.id)).size === config.fields.length && config.fields.every(field =>
        field && typeof field.id === 'string' && !!field.id && typeof field.label === 'string' && typeof field.selectorOrPath === 'string' &&
        (field.selector === undefined || typeof field.selector === 'string') && (field.directPath === undefined || typeof field.directPath === 'string') &&
        (field.currentValue === undefined || typeof field.currentValue === 'string') &&
        (field.previousValue === undefined || typeof field.previousValue === 'string') && validTimestamp(field.lastChangedAt))));
}
function validTimestamp(time: unknown): boolean {
  return time === undefined || (typeof time === 'number' && Number.isFinite(time) && time >= 0);
}
