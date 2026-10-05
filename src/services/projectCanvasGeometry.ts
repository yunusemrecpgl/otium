import type { ProjectCanvasItem } from '../domain/projectCanvasItem';
import { PROJECT_CANVAS_LIMITS } from '../constants/projectCanvas';
import { isValidCanvasRect, normalizeCanvasDimension } from './projectCanvasValidation';

export const PROJECT_CANVAS_GRID = 20;
export const PROJECT_CANVAS_GAP = 20;
type Rect = Pick<ProjectCanvasItem, 'x' | 'y' | 'width' | 'height'>;

export function rectanglesOverlapWithGap(a: Rect, b: Rect, gap = PROJECT_CANVAS_GAP): boolean {
  if (!isValidCanvasRect(a) || !isValidCanvasRect(b) || !Number.isFinite(gap) || gap < 0 || gap > PROJECT_CANVAS_LIMITS.dimension) return false;
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}
export function isPlacementValid(moving: readonly Rect[], obstacles: readonly Rect[]): boolean {
  // Internal group geometry is intentionally ignored.
  return moving.every(item => isValidCanvasRect(item) && obstacles.every(other => !rectanglesOverlapWithGap(item, other)));
}

function placementCheck(moving: readonly Rect[], obstacles: readonly Rect[]) {
  if (!moving.length || !moving.every(isValidCanvasRect)) throw new Error('Canvas geometry is unavailable.');
  const safeObstacles = obstacles.filter(isValidCanvasRect);
  if (moving.length * safeObstacles.length > PROJECT_CANVAS_LIMITS.boundaryPairs) throw new Error('Canvas placement is too complex. Try a smaller selection.');
  let remaining = PROJECT_CANVAS_LIMITS.collisionChecks as number;
  const valid = (rects: readonly Rect[]) => rects.every(item => isValidCanvasRect(item) && safeObstacles.every(other => {
    if (--remaining < 0) throw new Error('A safe canvas position could not be found. Try a different position.');
    return !rectanglesOverlapWithGap(item, other);
  }));
  return { obstacles: safeObstacles, valid };
}

// Best-first search over grid-aligned rectangle boundaries. A nearest valid
// grid point lies at the intended axis or outside an obstacle boundary.
// Bound the work; a deterministic outer escape remains available for dense scenes.
function nearestPair(xs: number[], ys: number[], valid: (x: number, y: number) => boolean): { x: number; y: number } | null {
  type Entry = { i: number; j: number; distance: number };
  const heap: Entry[] = [], seen = new Set<string>();
  const before = (a: Entry, b: Entry) => a.distance < b.distance ||
    (a.distance === b.distance && (ys[a.j] < ys[b.j] || (ys[a.j] === ys[b.j] && xs[a.i] < xs[b.i])));
  function push(i: number, j: number) {
    const key = `${i}:${j}`;
    if (i >= xs.length || j >= ys.length || seen.has(key)) return;
    seen.add(key);
    const entry = { i, j, distance: xs[i] ** 2 + ys[j] ** 2 };
    heap.push(entry); let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!before(entry, heap[parent])) break;
      heap[index] = heap[parent]; index = parent;
    }
    heap[index] = entry;
  }
  function pop(): Entry {
    const first = heap[0], last = heap.pop()!;
    if (heap.length) {
      let index = 0;
      while (index * 2 + 1 < heap.length) {
        let child = index * 2 + 1;
        if (child + 1 < heap.length && before(heap[child + 1], heap[child])) child++;
        if (!before(heap[child], last)) break;
        heap[index] = heap[child]; index = child;
      }
      heap[index] = last;
    }
    return first;
  }
  push(0, 0);
  for (let count = 0; heap.length && count < PROJECT_CANVAS_LIMITS.searchCandidates; count++) {
    const entry = pop(), x = xs[entry.i], y = ys[entry.j];
    if (valid(x, y)) return { x, y };
    push(entry.i + 1, entry.j); push(entry.i, entry.j + 1);
  }
  return null;
}
const sortedOffsets = (values: Set<number>) => [...values].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
const floorGrid = (value: number) => Math.floor(value / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID;
const ceilGrid = (value: number) => Math.ceil(value / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID;

export function findNearestValidPlacement(moving: readonly Rect[], obstacles: readonly Rect[]): { x: number; y: number } {
  const check = placementCheck(moving, obstacles);
  if (check.valid(moving)) return { x: 0, y: 0 };
  const xs = new Set([0]), ys = new Set([0]);
  for (const item of moving) for (const other of check.obstacles) {
    xs.add(floorGrid(other.x - PROJECT_CANVAS_GAP - item.x - item.width));
    xs.add(ceilGrid(other.x + other.width + PROJECT_CANVAS_GAP - item.x));
    ys.add(floorGrid(other.y - PROJECT_CANVAS_GAP - item.y - item.height));
    ys.add(ceilGrid(other.y + other.height + PROJECT_CANVAS_GAP - item.y));
  }
  const valid = (x: number, y: number) => Number.isFinite(x) && Number.isFinite(y) &&
    check.valid(moving.map(item => ({ ...item, x: item.x + x, y: item.y + y })));
  const found = nearestPair(sortedOffsets(xs), sortedOffsets(ys), valid);
  if (found) return found;
  // Each outer extreme clears every obstacle on that axis; no packing or pushing.
  const extremes = (values: Set<number>) => [...values].reduce((range, value) =>
    ({ min: Math.min(range.min, value), max: Math.max(range.max, value) }), { min: 0, max: 0 });
  const xRange = extremes(xs), yRange = extremes(ys);
  const escapes = [{ x: xRange.min, y: 0 }, { x: xRange.max, y: 0 },
    { x: 0, y: yRange.min }, { x: 0, y: yRange.max }]
    .sort((a, b) => a.x ** 2 + a.y ** 2 - b.x ** 2 - b.y ** 2 || a.y - b.y || a.x - b.x);
  const escape = escapes.find(position => valid(position.x, position.y));
  if (!escape) throw new Error('A safe canvas position could not be found. Try a different position.');
  return escape;
}

export function resolveProjectCanvasSize(item: Rect, width: number, height: number, obstacles: readonly Rect[], minSize = { width: 40, height: 40 }): { width: number; height: number } {
  if (![width, height, minSize.width, minSize.height].every(Number.isFinite) ||
      minSize.width <= 0 || minSize.height <= 0 || minSize.width > PROJECT_CANVAS_LIMITS.dimension || minSize.height > PROJECT_CANVAS_LIMITS.dimension) {
    throw new Error('Canvas size is invalid.');
  }
  const check = placementCheck([item], obstacles);
  const minimum = { width: ceilGrid(minSize.width), height: ceilGrid(minSize.height) };
  const requested = { width: Math.round(normalizeCanvasDimension(width, minimum.width, minimum.width) / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID,
    height: Math.round(normalizeCanvasDimension(height, minimum.height, minimum.height) / PROJECT_CANVAS_GRID) * PROJECT_CANVAS_GRID };
  const validSize = (size: { width: number; height: number }) => check.valid([{ ...item, ...size }]);
  if (validSize(requested)) return requested;
  if (!validSize(minimum)) throw new Error('Not enough room to resize here. Move the item first.');
  const widths = new Set([requested.width, minimum.width]), heights = new Set([requested.height, minimum.height]);
  for (const other of check.obstacles) {
    const w = floorGrid(other.x - PROJECT_CANVAS_GAP - item.x), h = floorGrid(other.y - PROJECT_CANVAS_GAP - item.y);
    if (w >= minimum.width && w <= requested.width) widths.add(w);
    if (h >= minimum.height && h <= requested.height) heights.add(h);
  }
  const xs = sortedOffsets(new Set([...widths].map(w => requested.width - w)));
  const ys = sortedOffsets(new Set([...heights].map(h => requested.height - h)));
  const found = nearestPair(xs, ys, (x, y) => validSize({ width: requested.width - x, height: requested.height - y }));
  return found ? { width: requested.width - found.x, height: requested.height - found.y } : minimum;
}
