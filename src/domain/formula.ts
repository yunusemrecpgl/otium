import type { WidgetDefinition, WidgetConfigValue } from './widget';
import { normalizeTextStyle } from './text';
import type { TextStyle } from './text';

export const FORMULA_DEFINITION: WidgetDefinition = {
  type: 'formula', name: 'Formula', version: 1, icon: 'calculator',
  allowedScopes: ['project'], resizable: true,
  defaultSize: { width: 320, height: 320 }, minSize: { width: 240, height: 240 },
};
export interface FormulaVariable { id: string; name: string; value: number }
export interface FormulaConfig { title: string; expression: string; variables: FormulaVariable[]; style?: TextStyle }
export function isFormulaConfig(value: unknown): value is FormulaConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<FormulaConfig>, ids = new Set<string>();
  return typeof config.title === 'string' && typeof config.expression === 'string' && Array.isArray(config.variables) &&
    config.variables.every(variable => {
      if (!variable || typeof variable.id !== 'string' || !variable.id || ids.has(variable.id) ||
        typeof variable.name !== 'string' || typeof variable.value !== 'number' || !Number.isFinite(variable.value)) return false;
      ids.add(variable.id); return true;
    });
}
export function serializeFormula(config: FormulaConfig): Record<string, WidgetConfigValue> {
  return { title: config.title, expression: config.expression,
    variables: config.variables.map(variable => ({ ...variable })),
    ...(config.style ? { style: { ...normalizeTextStyle(config.style) } } : {}) };
}
export function defaultFormulaConfig(): FormulaConfig {
  return { title: 'Formula', expression: '', variables: [] };
}
