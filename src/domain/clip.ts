import type { WidgetDefinition } from './widget';
import type { TextStyle } from './text';

export const CLIP_DEFINITION: WidgetDefinition = {
  type: 'clip', name: 'Clip', version: 1, icon: 'quote',
  allowedScopes: ['project'], resizable: true,
  defaultSize: { width: 320, height: 280 }, minSize: { width: 220, height: 200 },
};

// Matches future capture: selected text, current page URL and page title.
export interface ClipConfig { text: string; originalText?: string; sourceUrl: string; sourceTitle: string; textFragmentUrl?: string; faviconUrl?: string; style?: TextStyle }

export function readClipConfig(value: unknown): ClipConfig {
  if (!isClipConfig(value)) return { text: '', sourceUrl: '', sourceTitle: '' };
  return { ...value, ...(value.originalText === undefined && value.text ? { originalText: value.text } : {}) };
}

export function isClipConfig(value: unknown): value is ClipConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<ClipConfig>;
  return typeof config.text === 'string' && typeof config.sourceUrl === 'string' && typeof config.sourceTitle === 'string' &&
    (config.originalText === undefined || typeof config.originalText === 'string') &&
    (config.textFragmentUrl === undefined || typeof config.textFragmentUrl === 'string') &&
    (config.faviconUrl === undefined || typeof config.faviconUrl === 'string');
}
