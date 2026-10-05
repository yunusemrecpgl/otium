import { GRID_SIZE, WORKSPACE_PADDING } from '../constants/grid';
import { INSERTION_HYSTERESIS, INSERTION_MAX_GAP, INSERTION_ROW_TOLERANCE, INSERTION_ZONE_HALF_WIDTH } from '../constants/insertion';
import { gridToPixels, hasRequiredClearance, isValidPosition, rectanglesOverlap } from './workspace';
import { getNextCompactGridX } from './homeLayout';
import type { GridPosition, SpatialItem, WorkspaceGeometry } from './workspace';

export interface WorkspacePositionChange extends GridPosition { id: string }
interface IntentZone { left: number; right: number; top: number; bottom: number }
export interface HorizontalInsertionCandidate {
  leftId: string;
  rightId: string;
  zone: IntentZone;
}
export interface HorizontalInsertionProposal {
  draggedId: string;
  draggedPosition: GridPosition;
  movedItems: WorkspacePositionChange[];
  candidate: HorizontalInsertionCandidate;
  contentHeight?: number;
  draggedItems?: WorkspacePositionChange[];
}

function rectangle(item: SpatialItem) {
  return { ...gridToPixels(item.x, item.y), width: item.width, height: item.height };
}

export function belongsToHorizontalRow(a: SpatialItem, b: SpatialItem): boolean {
  const first = rectangle(a), second = rectangle(b);
  const overlap = Math.min(first.top + first.height, second.top + second.height) - Math.max(first.top, second.top);
  return Math.abs(first.top - second.top) <= INSERTION_ROW_TOLERANCE &&
    overlap >= Math.min(first.height, second.height) * 0.75;
}

function zoneForPair(left: SpatialItem, right: SpatialItem): IntentZone | null {
  if (!belongsToHorizontalRow(left, right)) return null;
  const a = rectangle(left), b = rectangle(right);
  const gap = b.left - (a.left + a.width);
  if (gap < 0 || gap > INSERTION_MAX_GAP) return null;
  const center = (a.left + a.width + b.left) / 2;
  const halfWidth = Math.min(INSERTION_ZONE_HALF_WIDTH, Math.max(8, gap / 2 + 4));
  const top = Math.max(a.top, b.top), bottom = Math.min(a.top + a.height, b.top + b.height);
  const margin = Math.min(GRID_SIZE / 2, (bottom - top) / 4);
  return { left: center - halfWidth, right: center + halfWidth, top: top + margin, bottom: bottom - margin };
}

function contains(zone: IntentZone, pointer: { left: number; top: number }, margin = 0) {
  return pointer.left >= zone.left - margin && pointer.left <= zone.right + margin &&
    pointer.top >= zone.top - margin && pointer.top <= zone.bottom + margin;
}

// Evaluate persisted geometry, never the animated neighbor positions.
export function findHorizontalInsertionCandidate(items: SpatialItem[], draggedId: string,
  pointer: { left: number; top: number }, previous: HorizontalInsertionCandidate | null = null): HorizontalInsertionCandidate | null {
  const remaining = items.filter((item) => item.id !== draggedId).sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id));
  const pairs: HorizontalInsertionCandidate[] = [];
  for (const left of remaining) {
    const right = remaining.find((item) => item.x > left.x && belongsToHorizontalRow(left, item));
    if (!right) continue;
    const zone = zoneForPair(left, right);
    if (zone) pairs.push({ leftId: left.id, rightId: right.id, zone });
  }
  if (previous) {
    const retained = pairs.find((pair) => pair.leftId === previous.leftId && pair.rightId === previous.rightId);
    if (retained && contains(retained.zone, pointer, INSERTION_HYSTERESIS)) return retained;
  }
  return pairs.find((pair) => contains(pair.zone, pointer)) ?? null;
}

export function isValidSpatialLayout(items: SpatialItem[], geometry: WorkspaceGeometry): boolean {
  return new Set(items.map((item) => item.id)).size === items.length &&
    items.every((item) => isValidPosition(item, items, geometry, item.id, item));
}

// A size change may leave unrelated canonical rectangles overlapping. An
// intentional move must be safe without requiring those untouched items to move.
export function isValidSpatialChanges(items: SpatialItem[], changedIds: ReadonlySet<string>, geometry: WorkspaceGeometry): boolean {
  return new Set(items.map(item => item.id)).size === items.length &&
    items.filter(item => changedIds.has(item.id)).every(item =>
      isValidPosition(item, items, geometry, item.id, item));
}

// Normalize only the affected local chain; distant manual gaps remain spatial.
export function proposeHorizontalInsertion(dragged: SpatialItem, candidate: HorizontalInsertionCandidate,
  items: SpatialItem[], geometry: WorkspaceGeometry, compactSource = true): HorizontalInsertionProposal | null {
  if (items.filter((item) => item.id === dragged.id).length !== 1) return null;
  const originalLeft = items.find(item => item.id === candidate.leftId && item.id !== dragged.id);
  const originalRight = items.find(item => item.id === candidate.rightId && item.id !== dragged.id);
  if (!originalLeft || !originalRight || !zoneForPair(originalLeft, originalRight)) return null;
  function nearby(a: SpatialItem, b: SpatialItem) {
    const first = rectangle(a), second = rectangle(b);
    return second.left - first.left - first.width <= INSERTION_MAX_GAP;
  }
  const positions = new Map<string, GridPosition>();
  if (compactSource) {
    const sourceRow = items.filter(item => item.id !== dragged.id && belongsToHorizontalRow(dragged, item))
      .sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
    const before = sourceRow.filter(item => item.x < dragged.x).at(-1);
    let nextX = before && nearby(before, dragged) ? getNextCompactGridX(before) : dragged.x;
    let previous = dragged;
    for (const item of sourceRow.filter(item => item.x > dragged.x)) {
      if (!nearby(previous, item)) break;
      if (nextX < item.x) positions.set(item.id, { x: nextX, y: item.y });
      nextX = getNextCompactGridX({ ...item, x: Math.min(nextX, item.x) });
      previous = item;
    }
  }
  const working = items.filter(item => item.id !== dragged.id).map(item => ({ ...item, ...positions.get(item.id) }));
  const left = working.find(item => item.id === candidate.leftId)!;
  const right = working.find(item => item.id === candidate.rightId)!;
  const row = working.filter(item => item.x > left.x && belongsToHorizontalRow(left, item))
    .sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
  if (row[0]?.id !== right.id) return null;
  const chain: SpatialItem[] = [];
  let preceding = { ...dragged, x: getNextCompactGridX(left), y: left.y };
  let previousOriginal = left;
  for (const item of row) {
    // The source's vacated rectangle can connect two original neighbors.
    const connected = nearby(previousOriginal, item) ||
      (belongsToHorizontalRow(left, dragged) && dragged.x > previousOriginal.x && dragged.x < item.x &&
        nearby(previousOriginal, dragged) && nearby(dragged, item));
    const minimumX = getNextCompactGridX(preceding);
    if (!connected && item.x >= minimumX) break;
    chain.push(item);
    preceding = { ...item, x: minimumX };
    previousOriginal = item;
  }
  const sequence = [dragged, ...chain];
  const scheduledIds = new Set(sequence.map(item => item.id));
  let placed = working.filter(item => !scheduledIds.has(item.id));
  const maxHeight = Math.max(geometry.height, ...items.map(item => rectangle(item).top + item.height + WORKSPACE_PADDING)) +
    items.reduce((height, item) => height + item.height + GRID_SIZE, 0);
  const wrapGeometry = { ...geometry, height: maxHeight };
  let rowY = left.y;
  let rowHeight = Math.max(left.height, ...working.filter(item => belongsToHorizontalRow(left, item)).map(item => item.height));
  let nextX = getNextCompactGridX(left);
  let wrapped = false;
  for (let index = 0; index < sequence.length; index++) {
    const item = sequence[index];
    const maxX = Math.floor((geometry.width - WORKSPACE_PADDING * 2 - item.width) / GRID_SIZE);
    if (maxX < 0) return null;
    let position: GridPosition | null = null;
    while (!position) {
      if (nextX > maxX) {
        rowY += Math.ceil((rowHeight + GRID_SIZE) / GRID_SIZE);
        nextX = 0;
        rowHeight = 0;
        wrapped = true;
      }
      if (gridToPixels(0, rowY).top + item.height > maxHeight - WORKSPACE_PADDING) return null;
      if (!wrapped) {
        position = { x: nextX, y: rowY };
        if (!isValidPosition(position, placed, wrapGeometry, undefined, item)) return null;
      } else {
        // A wrapped footprint enters from the left. Only the local row chain
        // it reaches is queued behind the overflowing items, preserving order.
        for (let x = nextX; x <= maxX; x++) {
          const candidatePosition = { x, y: rowY };
          const candidateRect = { ...gridToPixels(x, rowY), width: item.width, height: item.height };
          const rowOccupants = placed.filter(other => belongsToHorizontalRow({ ...item, ...candidatePosition }, other))
            .sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
          const blocker = rowOccupants.find(other => !hasRequiredClearance(candidateRect, rectangle(other)));
          const pushed: SpatialItem[] = [];
          if (blocker) {
            let previous = blocker;
            for (const other of rowOccupants.filter(other => other.x >= blocker.x)) {
              if (other.id !== blocker.id && !nearby(previous, other)) break;
              pushed.push(other);
              previous = other;
            }
          }
          const pushedIds = new Set(pushed.map(other => other.id));
          const remaining = placed.filter(other => !pushedIds.has(other.id));
          if (!isValidPosition(candidatePosition, remaining, wrapGeometry, undefined, item)) continue;
          placed = remaining;
          for (const other of pushed) {
            if (!scheduledIds.has(other.id)) {
              sequence.push(other);
              scheduledIds.add(other.id);
            }
          }
          position = candidatePosition;
          break;
        }
        if (!position) {
          rowHeight = Math.max(item.height, rowHeight,
            ...placed.filter(other => other.y === rowY).map(other => other.height));
          nextX = maxX + 1;
          continue;
        }
      }
    }
    positions.set(item.id, position);
    const moved = { ...item, ...position };
    placed.push(moved);
    rowHeight = Math.max(rowHeight, item.height,
      ...placed.filter(other => other.y === rowY).map(other => other.height));
    nextX = getNextCompactGridX(moved);
  }
  const draggedPosition = positions.get(dragged.id)!;
  const movedItems = items.filter(item => item.id !== dragged.id && positions.has(item.id)).filter(item => {
    const position = positions.get(item.id)!;
    return position.x !== item.x || position.y !== item.y;
  }).map(item => ({ id: item.id, ...positions.get(item.id)! }));
  const changes = new Map([[dragged.id, draggedPosition], ...movedItems.map((item) => [item.id, item] as const)]);
  const proposed = items.map((item) => ({ ...item, ...(changes.get(item.id) ?? {}) }));
  const movingIds = new Set(changes.keys());
  // A wide inserted object must not make a neighbor jump through an unrelated
  // object merely because its final rectangle lands beyond that obstacle.
  for (const moved of movedItems) {
    const original = items.find((item) => item.id === moved.id)!;
    if (original.y !== moved.y) continue;
    const start = rectangle(original), end = gridToPixels(moved.x, moved.y);
    const swept = { ...start, left: Math.min(start.left, end.left), width: Math.abs(end.left - start.left) + original.width };
    if (items.some((item) => !movingIds.has(item.id) && rectanglesOverlap(swept, rectangle(item)))) return null;
  }
  const contentHeight = Math.max(geometry.height, ...proposed.map(item => rectangle(item).top + item.height + WORKSPACE_PADDING));
  if (!isValidSpatialChanges(proposed, movingIds, { ...geometry, height: contentHeight })) return null;
  return { draggedId: dragged.id, draggedPosition, movedItems, candidate, contentHeight };
}

export function insertionChanges(proposal: HorizontalInsertionProposal): WorkspacePositionChange[] {
  return [...(proposal.draggedItems ?? [{ id: proposal.draggedId, ...proposal.draggedPosition }]), ...proposal.movedItems];
}
