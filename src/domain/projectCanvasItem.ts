// Visual placement only; Project.linkIds owns website membership and ordering.
export interface ProjectCanvasItem {
  id: string;
  projectId: string;
  type: 'link' | 'widget';
  referenceId: string;
  // Coordinates and dimensions are in Project canvas space.
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  trashedAt?: number;
}
