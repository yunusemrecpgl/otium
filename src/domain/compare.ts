import type { WidgetDefinition, WidgetConfigValue } from './widget';
import { normalizeTextStyle } from './text';
import type { TextStyle } from './text';

export const COMPARE_DEFINITION: WidgetDefinition = {
  type: 'compare', name: 'Compare', version: 1, icon: 'table-2',
  allowedScopes: ['project'], resizable: true,
  defaultSize: { width: 460, height: 300 }, minSize: { width: 260, height: 220 },
};

export interface CompareColumn { id: string; title: string }
export interface CompareRow { id: string; label: string; values: Record<string, string> }
export type CompareGridMode = 'horizontal' | 'vertical' | 'both' | 'none';
export interface CompareConfig { gridMode?: CompareGridMode; style?: TextStyle; title: string; columns: CompareColumn[]; rows: CompareRow[] }

export function isCompareConfig(value: unknown): value is CompareConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<CompareConfig>;
  if (typeof config.title !== 'string' || !Array.isArray(config.columns) || !config.columns.length || !Array.isArray(config.rows) || !config.rows.length) return false;
  const columns = new Set<string>(), rows = new Set<string>();
  if (!config.columns.every(column => {
    if (!column || typeof column.id !== 'string' || !column.id || columns.has(column.id) || typeof column.title !== 'string') return false;
    columns.add(column.id); return true;
  })) return false;
  return config.rows.every(row => {
    if (!row || typeof row.id !== 'string' || !row.id || rows.has(row.id) || typeof row.label !== 'string' ||
        !row.values || typeof row.values !== 'object' || Array.isArray(row.values) ||
        Object.entries(row.values).some(([id, text]) => !columns.has(id) || typeof text !== 'string') ||
        [...columns].some(id => !Object.prototype.hasOwnProperty.call(row.values, id))) return false;
    rows.add(row.id); return true;
  });
}

export function serializeCompare(config: CompareConfig): Record<string, WidgetConfigValue> {
  return { title: config.title, columns: config.columns.map(column => ({ id: column.id, title: column.title })),
    rows: config.rows.map(row => ({ id: row.id, label: row.label, values: { ...row.values } })),
    ...(config.gridMode ? { gridMode: config.gridMode } : {}),
    ...(config.style ? { style: { ...normalizeTextStyle(config.style) } } : {}) }; 
}

export function defaultCompareConfig(): CompareConfig {
  const columns = ['Column A', 'Column B'].map(title => ({ id: crypto.randomUUID(), title }));
  return { title: 'Compare', columns, rows: ['Row A', 'Row B', 'Row C'].map(label => ({
    id: crypto.randomUUID(), label, values: Object.fromEntries(columns.map(column => [column.id, ''])),
  })) };
}
