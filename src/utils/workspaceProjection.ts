import { CONTROL_SIZE, GRID_SIZE, WORKSPACE_PADDING } from '../constants/grid';
import { findNearestFreePosition, gridToPixels, isValidPosition } from './workspace';
import type { GridPosition, SpatialItem, WorkspaceGeometry } from './workspace';
import { insertionChanges, isValidSpatialChanges, proposeHorizontalInsertion } from './horizontalInsertion';
import type { HorizontalInsertionProposal } from './horizontalInsertion';

export interface DisplayPosition extends GridPosition { projected: boolean }

export function projectWorkspaceToViewport(items: SpatialItem[], viewport: WorkspaceGeometry) {
  const positions = new Map<string, DisplayPosition>();
  const placed: SpatialItem[] = [];
  const pending: SpatialItem[] = [];
  // Visible canonical rectangles get first claim on their original places.
  for (const item of items) {
    if (isValidPosition(item, placed, viewport, undefined, item)) {
      positions.set(item.id, { x: item.x, y: item.y, projected: false });
      placed.push(item);
    } else pending.push(item);
  }
  let height = viewport.height;
  // A bounded vertical extension is used only when the visible grid is full.
  const rowStep = Math.max(1, Math.ceil((Math.max(viewport.itemSize, ...items.map(item => item.height)) + GRID_SIZE) / GRID_SIZE));
  const maxHeight = viewport.height + (pending.length + 1) * rowStep * GRID_SIZE;
  for (const item of pending) {
    let target: GridPosition | null = null;
    while (!target && height <= maxHeight) {
      target = findNearestFreePosition(item, placed, { ...viewport, height }, undefined, item);
      if (!target) height += rowStep * GRID_SIZE;
    }
    if (!target) continue; // Even the width cannot accommodate this rectangle.
    placed.push({ ...item, ...target });
    positions.set(item.id, { ...target, projected: target.x !== item.x || target.y !== item.y });
  }
  const contentHeight = Math.max(viewport.height, ...placed.map(item => WORKSPACE_PADDING * 2 + item.y * GRID_SIZE + item.height));
  return { positions, contentHeight, spatialItems: placed };
}

// A visible insertion can have canonical neighbors temporarily projected off-row.
// Include those actual reflow neighbors in the intentional batch without saving
// any other item's temporary responsive position.
export function canonicalInsertionForProjection(displayProposal: HorizontalInsertionProposal,
  canonicalItems: SpatialItem[], viewport: WorkspaceGeometry, displayedItems?: SpatialItem[]) {
  const dragged = canonicalItems.find(item => item.id === displayProposal.draggedId);
  if (!dragged) return null;
  const right = Math.max(0, ...canonicalItems.map(item => gridToPixels(item.x, item.y).left + item.width));
  const bottom = Math.max(0, ...canonicalItems.map(item => gridToPixels(item.x, item.y).top + item.height));
  const geometry = {
    ...viewport,
    width: Math.max(viewport.width, right + canonicalItems.reduce((sum, item) => sum + item.width, 0) + CONTROL_SIZE + WORKSPACE_PADDING * 2),
    height: Math.max(viewport.height, bottom + WORKSPACE_PADDING),
  };
  const proposal = displayProposal.draggedItems ? null
    : proposeHorizontalInsertion(dragged, displayProposal.candidate, canonicalItems, geometry);
  if (!proposal || proposal.draggedPosition.x !== displayProposal.draggedPosition.x ||
      proposal.draggedPosition.y !== displayProposal.draggedPosition.y ||
      displayProposal.movedItems.some(display => !proposal.movedItems.some(canonical =>
        canonical.id === display.id && canonical.x === display.x && canonical.y === display.y))) {
    if (!displayedItems) return null;
    const left = displayedItems.find(item => item.id === displayProposal.candidate.leftId);
    const canonicalLeft = canonicalItems.find(item => item.id === left?.id);
    if (!left || !canonicalLeft) return null;
    // The insertion explicitly uses this displayed anchor. Persist its location
    // only as part of this gesture, never merely because it was projected.
    const fallback = { ...displayProposal, movedItems: [...displayProposal.movedItems,
      ...(displayProposal.movedItems.some(item => item.id === left.id) ||
        (left.x === canonicalLeft.x && left.y === canonicalLeft.y) ? [] : [{ id: left.id, x: left.x, y: left.y }])] };
    const changes = new Map(insertionChanges(fallback).map(item => [item.id, item]));
    const next = canonicalItems.map(item => ({ ...item, ...changes.get(item.id) }));
    return isValidSpatialChanges(next, new Set(changes.keys()), geometry) ? { proposal: fallback, geometry } : null;
  }
  return { proposal, geometry };
}
