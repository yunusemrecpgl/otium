import { useMemo, useSyncExternalStore } from 'react';
import type { OtiumData } from '../domain/data';
import { browserCapabilities } from '../services/permissions';
import { WidgetRegistry } from '../services/widgetRegistry';

export function useWidgetCapabilities(data: OtiumData | null) {
  const access = useSyncExternalStore(browserCapabilities.subscribe, browserCapabilities.getSnapshot);
  const enabledTypes = useMemo(() => new Set(WidgetRegistry.getAll().filter(definition => {
    if (!data) return false;
    return definition.requiredCapabilities.every(capability => capability === 'active-page-capture' ? access.capture
      : capability === 'scripting' ? access.scripting : capability === 'favicon' ? access.favicon : capability === 'external-source');
  }).map(definition => definition.type)), [Boolean(data), access]);
  return { enabledTypes, access };
}
