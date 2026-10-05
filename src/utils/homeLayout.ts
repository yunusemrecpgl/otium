import { GRID_SIZE } from '../constants/grid';
import { HOME_REFLOW_GAP } from '../constants/insertion';

// Visual size is independent from the integer-grid pitch of automatic rows.
export function getBaseHomeSpan(itemSize: number) {
  const columns = Math.ceil((itemSize + HOME_REFLOW_GAP) / GRID_SIZE);
  const pixels = columns * GRID_SIZE;
  return { columns, pixels, gap: pixels - itemSize };
}

export function widthForHomeSpan(itemSize: number, spans: 1 | 2 | 3) {
  return itemSize + (spans - 1) * getBaseHomeSpan(itemSize).pixels;
}

export function getNextCompactGridX(item: { x: number; width: number }) {
  return item.x + Math.ceil((item.width + GRID_SIZE) / GRID_SIZE);
}
