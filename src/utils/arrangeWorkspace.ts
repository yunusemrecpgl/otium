import { GRID_SIZE, WORKSPACE_PADDING } from '../constants/grid';
import { getNextCompactGridX } from './homeLayout';
import { gridToPixels } from './workspace';
import type { SpatialItem, WorkspaceGeometry } from './workspace';
import type { WorkspacePositionChange } from './horizontalInsertion';

export function arrangeWorkspace(items: SpatialItem[], viewport: WorkspaceGeometry) {
  const changes: WorkspacePositionChange[] = [];
  // The Add tile occupies the first footprint; utilities are outside the canvas.
  let x = getNextCompactGridX({ x: 0, width: viewport.itemSize });
  let y = 0;
  let rowHeight = viewport.itemSize;
  let height = viewport.height;
  for (const item of items) {
    if (item.width > viewport.width - WORKSPACE_PADDING * 2) {
      throw new Error('Widen the window to arrange this workspace.');
    }
    if (gridToPixels(x, y).left + item.width > viewport.width - WORKSPACE_PADDING) {
      y += Math.ceil((rowHeight + GRID_SIZE) / GRID_SIZE);
      x = 0;
      rowHeight = 0;
    }
    changes.push({ id: item.id, x, y });
    height = Math.max(height, gridToPixels(x, y).top + item.height + WORKSPACE_PADDING);
    rowHeight = Math.max(rowHeight, item.height);
    x = getNextCompactGridX({ x, width: item.width });
  }
  return { changes, geometry: { ...viewport, height } };
}
