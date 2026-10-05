import type { WidgetDefinition } from './widget';
import type { TextStyle } from './text';

export const RSS_DEFINITION: WidgetDefinition = {
  type: 'rss', name: 'RSS Feed', version: 1, icon: 'rss', allowedScopes: ['project'], resizable: true,
  defaultSize: { width: 320, height: 380 }, minSize: { width: 200, height: 180 },
};
export interface RssConfig { title: string; feedUrl: string; refreshMinutes: number; itemLimit: number; style?: TextStyle }
export function isRssConfig(value: unknown): value is RssConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<RssConfig>;
  return typeof config.title === 'string' && typeof config.feedUrl === 'string' &&
    typeof config.refreshMinutes === 'number' && Number.isFinite(config.refreshMinutes) && config.refreshMinutes >= 5 &&
    typeof config.itemLimit === 'number' && Number.isInteger(config.itemLimit) && config.itemLimit >= 1 && config.itemLimit <= 10;
}
