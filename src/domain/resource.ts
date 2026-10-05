import type { WidgetDefinition } from './widget';
import type { TextStyle } from './text';

export const RESOURCE_DEFINITION: WidgetDefinition = {
  type: 'resource', name: 'Resource', version: 1, icon: 'external-link',
  allowedScopes: ['project'], resizable: true,
  defaultSize: { width: 240, height: 160 }, minSize: { width: 160, height: 120 },
};

export interface ResourceConfig { title: string; url: string; label: string; datetime?: string; style?: TextStyle }

export function isResourceConfig(value: unknown): value is ResourceConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<ResourceConfig>;
  return typeof config.title === 'string' && typeof config.url === 'string' && typeof config.label === 'string' &&
    (config.datetime === undefined || typeof config.datetime === 'string');
}
