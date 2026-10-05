// Renderers can derive these capabilities from a future WidgetDefinition.
export interface ProjectCanvasCapabilities {
  resizable: boolean;
  minSize?: { width: number; height: number };
}

export const LINK_CANVAS_CAPABILITIES: ProjectCanvasCapabilities = { resizable: false };
