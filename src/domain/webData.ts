import type { WidgetDefinition } from './widget';
import { normalizeTextStyle } from './text';
import type { TextStyle } from './text';

export const WEB_DATA_DEFINITION: WidgetDefinition = {
  type: 'web-data', name: 'Web Data', version: 1, icon: 'activity',
  allowedScopes: ['project'], resizable: true,
  defaultSize: { width: 320, height: 320 }, minSize: { width: 160, height: 140 },
};

export interface WebDataField { id: string; path: string; label: string }
export interface WebDataConfig { fields?: WebDataField[]; title: string; url: string; jsonPath: string; refreshMinutes: number; style?: TextStyle }
export interface WebDataStatus { loading: boolean; error: Error | null; value?: string; updatedAt?: number; available: boolean; refresh: () => void }
export function readWebDataConfig(value: unknown): WebDataConfig {
  if (!isWebDataConfig(value)) return { title: 'Web Data', url: '', jsonPath: '', refreshMinutes: 15 };
  const paths = new Set<string>(), ids = new Set<string>();
  const fields = value.fields?.filter(field => {
    if (paths.has(field.path) || ids.has(field.id)) return false;
    paths.add(field.path); ids.add(field.id); return true;
  }).slice(0, 8).map(field => ({ ...field }));
  return { title: value.title, url: value.url, jsonPath: value.jsonPath, refreshMinutes: value.refreshMinutes,
    fields: fields ?? [{ id: 'legacy:' + value.jsonPath, path: value.jsonPath.trim(), label: value.jsonPath.trim() || value.title || 'Value' }],
    ...(value.style ? { style: normalizeTextStyle(value.style) } : {}) };
}

export function isWebDataConfig(value: unknown): value is WebDataConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<WebDataConfig>;
  return typeof config.title === 'string' && typeof config.url === 'string' && typeof config.jsonPath === 'string' &&
    (config.fields === undefined || (Array.isArray(config.fields) && config.fields.every(field => field && typeof field.id === 'string' && typeof field.path === 'string' && typeof field.label === 'string'))) &&
    typeof config.refreshMinutes === 'number' && Number.isFinite(config.refreshMinutes) && config.refreshMinutes >= 1;
}
