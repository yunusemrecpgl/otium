export interface ProjectCanvasState {
  projectId: string;
  width: number;
  height: number;
  zoom: ProjectCanvasZoom;
}

export const PROJECT_CANVAS_ZOOM_LEVELS = [0.6, 0.8, 1, 1.2, 1.4] as const;
export type ProjectCanvasZoom = typeof PROJECT_CANVAS_ZOOM_LEVELS[number];
export function normalizeProjectCanvasZoom(value: unknown): ProjectCanvasZoom {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return PROJECT_CANVAS_ZOOM_LEVELS.reduce((nearest, level) => Math.abs(level - value) < Math.abs(nearest - value) ? level : nearest, 1 as ProjectCanvasZoom);
}
