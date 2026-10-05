import type { OtiumData } from '../domain/data';
import type { WidgetCapability } from '../domain/widget';
import { WidgetRegistry } from './widgetRegistry';
import { permissionService } from './permissions';

export async function assertWidgetCreationAccess(_data: OtiumData, type: string): Promise<void> {
  const definition = WidgetRegistry.get(type);
  if (!definition) throw new Error('Widget is unavailable.');
  // Creating/editing a manual widget needs no page access. Capture and rendered
  // reading still check their capabilities at the point of use.
}

export const widgetCapabilityService = {
  // Called directly from Enable. Origin access is intentionally not requested.
  requestEnable(type: string): Promise<boolean> {
    const definition = WidgetRegistry.get(type);
    return definition ? permissionService.requestCapabilities(definition.requiredCapabilities) : Promise.resolve(false);
  },
  hasModeAccess(type: string, mode: string): Promise<boolean> {
    return permissionService.hasCapabilities(WidgetRegistry.get(type)?.modeCapabilities?.[mode] ?? []);
  },
  requestModeAccess(type: string, mode: string): Promise<boolean> {
    return permissionService.requestCapabilities(WidgetRegistry.get(type)?.modeCapabilities?.[mode] ?? []);
  },
  modeRequirements(type: string, mode: string): readonly WidgetCapability[] {
    return WidgetRegistry.get(type)?.modeCapabilities?.[mode] ?? [];
  },
};
