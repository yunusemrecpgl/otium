export interface SortableItemRect {
  left: number;
  width: number;
}

export function calculateInsertionIndex(pointerX: number, itemRects: SortableItemRect[]): number {
  const index = itemRects.findIndex((rect) => pointerX < rect.left + rect.width / 2);
  return index === -1 ? itemRects.length : index;
}

// Index is relative to the remaining entries, never the original array.
export function insertOrMoveId(ids: string[], id: string, index: number): string[] {
  const remaining = ids.filter((entry) => entry !== id);
  const target = Math.max(0, Math.min(remaining.length, Math.trunc(index)));
  return [...remaining.slice(0, target), id, ...remaining.slice(target)];
}

export function removeId(ids: string[], id: string): string[] {
  return ids.filter((entry) => entry !== id);
}
