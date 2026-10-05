export type WidgetScope = 'project' | 'home';
export type WidgetCapability = 'active-page-capture' | 'scripting' | 'favicon' | 'external-source';
export interface WidgetCapabilityState { enabled: boolean }
export interface WidgetCapabilityMetadata {
  description: string;
  requiredCapabilities: readonly WidgetCapability[];
  optionalCapabilities: readonly WidgetCapability[];
  defaultEnabled: boolean;
  sourceAccess?: 'per-origin';
  modeCapabilities?: Readonly<Record<string, readonly WidgetCapability[]>>;
}

export interface WidgetSize {
  width: number;
  height: number;
}

// Definitions describe metadata only; implementations can be loaded separately.
export interface WidgetDefinition extends Partial<WidgetCapabilityMetadata> {
  type: string;
  name: string;
  version: number;
  icon: string;
  allowedScopes: readonly WidgetScope[];
  defaultSize: WidgetSize;
  minSize?: WidgetSize;
  resizable: boolean;
}

export type WidgetConfigValue = string | number | boolean | null | WidgetConfigValue[] | { [key: string]: WidgetConfigValue };

// Placement and ownership belong to future placement models, not the instance.
export interface WidgetInstance {
  id: string;
  type: string;
  version: number;
  config: Record<string, WidgetConfigValue>;
  createdAt: number;
  updatedAt: number;
}
