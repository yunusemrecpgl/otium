import type { WidgetDefinition } from './widget';
import { isProjectColor } from './projectColor';
import type { ProjectColor } from './projectColor';
import { isFontSizeToken } from './typography';
import type { FontSizeToken } from './typography';

export const TEXT_DEFINITION: WidgetDefinition = {
  type: 'text', name: 'Text / Label', version: 1, icon: 'type', allowedScopes: ['project'], resizable: true,
  defaultSize: { width: 260, height: 80 }, minSize: { width: 100, height: 40 },
};
export interface TextStyle {
  bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean;
  fontSize?: number | FontSizeToken; fontFamily?: 'sans' | 'serif' | 'mono'; textAlign?: 'left' | 'center' | 'right';
  textColor?: ProjectColor; backgroundColor?: ProjectColor; borderColor?: ProjectColor;
}
export interface TextConfig { text: string; style?: TextStyle }
export function normalizeTextStyle(value: unknown): TextStyle {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>, style: TextStyle = {};
  for (const key of ['bold', 'italic', 'underline', 'strike'] as const) {
    if (typeof source[key] === 'boolean') style[key] = source[key];
  }
  if (typeof source.fontSize === 'number' && Number.isFinite(source.fontSize)) style.fontSize = Math.max(12, Math.min(48, Math.round(source.fontSize)));
  else if (isFontSizeToken(source.fontSize)) style.fontSize = source.fontSize;
  if (source.fontFamily === 'sans' || source.fontFamily === 'serif' || source.fontFamily === 'mono') style.fontFamily = source.fontFamily;
  if (source.textAlign === 'left' || source.textAlign === 'center' || source.textAlign === 'right') style.textAlign = source.textAlign;
  for (const key of ['textColor', 'backgroundColor', 'borderColor'] as const) {
    if (isProjectColor(source[key])) style[key] = source[key];
  }
  return style;
}
export function readTextConfig(value: { text?: unknown; style?: unknown }): TextConfig {
  return { text: typeof value.text === 'string' ? value.text : '', ...(value.style ? { style: normalizeTextStyle(value.style) } : {}) };
}
export function isTextConfig(value: unknown): value is TextConfig {
  return !!value && typeof value === 'object' && typeof (value as Partial<TextConfig>).text === 'string';
}
