import type { ProjectWidgetType } from '../domain/projectWidget';
import type { WidgetConfigValue } from '../domain/widget';

type Config = Record<string, WidgetConfigValue>;

// Missing owned properties are intentional clears/resets, not unknown data.
const CONFIG_KEYS: Record<ProjectWidgetType, readonly string[]> = {
  text: ['text', 'style'],
  note: ['title', 'text', 'listStyle', 'style'],
  todo: ['title', 'items', 'style'],
  resource: ['title', 'url', 'label', 'datetime', 'style'],
  'web-data': ['title', 'url', 'jsonPath', 'refreshMinutes', 'fields', 'style'],
  clip: ['text', 'originalText', 'sourceUrl', 'sourceTitle', 'faviconUrl', 'textFragmentUrl', 'style'],
  compare: ['title', 'columns', 'rows', 'gridMode', 'style'],
  rss: ['title', 'feedUrl', 'refreshMinutes', 'itemLimit', 'style'],
  formula: ['title', 'expression', 'variables', 'style'],
  'page-watch': ['title', 'url', 'selector', 'refreshMinutes', 'mode', 'sourceMode', 'directUrl', 'directPath',
    'fields', 'currentValue', 'previousValue', 'lastChangedAt', 'lastCheckedAt', 'style'],
};
const STYLE_KEYS = ['bold', 'italic', 'underline', 'strike', 'fontSize', 'fontFamily', 'textAlign',
  'textColor', 'backgroundColor', 'borderColor'];
const COLLECTION_KEYS: Partial<Record<ProjectWidgetType, Record<string, readonly string[]>>> = {
  todo: { items: ['id', 'text', 'completed'] },
  'web-data': { fields: ['id', 'path', 'label'] },
  compare: { columns: ['id', 'title'], rows: ['id', 'label', 'values'] },
  formula: { variables: ['id', 'name', 'value'] },
  'page-watch': { fields: ['id', 'label', 'selectorOrPath', 'selector', 'directPath', 'currentValue', 'previousValue', 'lastChangedAt'] },
};

function record(value: WidgetConfigValue | undefined): Config {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function preserveUnknown(previous: Config, next: Config, owned: readonly string[]): Config {
  return { ...Object.fromEntries(Object.entries(previous).filter(([key]) => !owned.includes(key))), ...next };
}

// Normalization remains the caller's responsibility. Unknown properties stay
// opaque, including on retained collection entries; removed entries stay removed.
export function preserveWidgetConfig(type: ProjectWidgetType, previous: Config, normalized: Config): Config {
  const next = preserveUnknown(previous, normalized, CONFIG_KEYS[type]);
  const style = preserveUnknown(record(previous.style), record(normalized.style), STYLE_KEYS);
  if (normalized.style !== undefined || Object.keys(style).length) next.style = style;
  for (const [key, owned] of Object.entries(COLLECTION_KEYS[type] ?? {})) {
    const entries = normalized[key];
    if (!Array.isArray(entries)) continue;
    const previousEntries = previous[key];
    const byId = new Map((Array.isArray(previousEntries) ? previousEntries : []).map(value => {
      const entry = record(value);
      return [entry.id, entry] as const;
    }));
    next[key] = entries.map(value => {
      const entry = record(value);
      return preserveUnknown(byId.get(entry.id) ?? {}, entry, owned);
    });
  }
  return next;
}
