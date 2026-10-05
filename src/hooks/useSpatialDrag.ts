import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import { DRAG_THRESHOLD, GRID_SIZE } from '../constants/grid';
import { findNearestFreePosition, getWorkspaceGeometry, gridToPixels, pixelsToGrid, rectanglesOverlap } from '../utils/workspace';
import type { Dimensions, GridPosition, WorkspaceGeometry } from '../utils/workspace';
import type { BaseWorkspaceItem } from '../domain/workspace';
import type { SpatialItem } from '../utils/workspace';
import { findHorizontalInsertionCandidate, proposeHorizontalInsertion } from '../utils/horizontalInsertion';
import type { HorizontalInsertionCandidate, HorizontalInsertionProposal, WorkspacePositionChange } from '../utils/horizontalInsertion';

export interface GroupDragPreview {
  positions: Map<string, { left: number; top: number }>;
  target: (Dimensions & { left: number; top: number }) | null;
}

export interface SpatialDragGroup {
  members: SpatialItem[];
  onPreview: (preview: GroupDragPreview | null) => void;
  onDrop: (changes: WorkspacePositionChange[]) => Promise<void>;
}

export interface SpatialTransferInteraction {
  onStart: () => void;
  onDragState: (dragging: boolean) => void;
  targetAt: (clientX: number, clientY: number, ids: string[]) => string | null;
  onPreview: (containerId: string | null) => void;
  onDrop: (ids: string[], containerId: string, positions: WorkspacePositionChange[]) => Promise<void>;
}

interface GroupGesture {
  members: SpatialItem[];
  footprint: SpatialItem;
  anchorOffset: GridPosition;
  compactSource: boolean;
  interaction: SpatialDragGroup;
}

export interface SpatialInsertionInteraction {
  onPreview: (proposal: HorizontalInsertionProposal | null) => void;
  onCommit: (proposal: HorizontalInsertionProposal) => Promise<void>;
}

interface DragOptions {
  item: BaseWorkspaceItem;
  items: SpatialItem[];
  itemSize: number;
  dimensions?: Dimensions;
  geometry?: WorkspaceGeometry;
  canonicalPosition?: GridPosition;
  onDrop: (id: string, position: GridPosition) => Promise<void>;
  insertion?: SpatialInsertionInteraction;
  group?: SpatialDragGroup;
  transfer?: SpatialTransferInteraction;
}

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  originLeft: number;
  originTop: number;
  left: number;
  top: number;
  active: boolean;
  pointerLeft: number;
  pointerTop: number;
  node: HTMLElement;
  group: GroupGesture | null;
  transfer?: SpatialTransferInteraction;
  clientX: number;
  clientY: number;
}

interface DragVisual {
  left: number;
  top: number;
  target: GridPosition | null;
  dragging: boolean;
}

export function useSpatialDrag({ item, items, itemSize, dimensions, geometry, canonicalPosition, onDrop, insertion, group, transfer }: DragOptions) {
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const pending = useRef(false);
  const [visual, setVisual] = useState<DragVisual | null>(null);
  const candidate = useRef<HorizontalInsertionCandidate | null>(null);
  const previewKey = useRef('');
  const insertionCallbacks = useRef(insertion);
  useEffect(() => { insertionCallbacks.current = insertion; }, [insertion]);

  useEffect(() => {
    function abort() {
      const current = gesture.current;
      gesture.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      candidate.current = null;
      if (previewKey.current) insertionCallbacks.current?.onPreview(null);
      previewKey.current = '';
      if (current) {
        current.transfer?.onDragState(false);
        current.transfer?.onPreview(null);
        current.group?.interaction.onPreview(null);
        if (current.active) suppressClick.current = true;
        if (current.node.hasPointerCapture(current.pointerId)) current.node.releasePointerCapture(current.pointerId);
        if (current.active) setVisual({ left: current.originLeft, top: current.originTop, target: null, dragging: false });
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) { event.preventDefault(); abort(); }
    };
    window.addEventListener('blur', abort);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('blur', abort);
      window.removeEventListener('keydown', escape);
      abort();
    };
  }, []);

  useEffect(() => {
    if (!visual || visual.dragging) return;
    const timer = window.setTimeout(() => setVisual(null), 200);
    return () => window.clearTimeout(timer);
  }, [visual]);

  function destination(current: Gesture) {
    const selected = current.group;
    if (!selected) return findNearestFreePosition(pixelsToGrid(current.left, current.top), items,
      geometry ?? getWorkspaceGeometry(itemSize), item.id, dimensions);
    const ids = new Set(selected.members.map(member => member.id));
    const target = findNearestFreePosition(pixelsToGrid(current.left - selected.anchorOffset.x * GRID_SIZE,
      current.top - selected.anchorOffset.y * GRID_SIZE), items.filter(member => !ids.has(member.id)),
      geometry ?? getWorkspaceGeometry(itemSize), undefined, selected.footprint);
    return target ? { x: target.x + selected.anchorOffset.x, y: target.y + selected.anchorOffset.y } : null;
  }

  function groupChanges(selected: GroupGesture, anchor: GridPosition): WorkspacePositionChange[] {
    const deltaX = anchor.x - selected.footprint.x - selected.anchorOffset.x;
    const deltaY = anchor.y - selected.footprint.y - selected.anchorOffset.y;
    return selected.members.map(member => ({ id: member.id, x: member.x + deltaX, y: member.y + deltaY }));
  }

  function publishGroupPreview(current: Gesture, target: GridPosition | null) {
    if (!current.group) return;
    const deltaX = current.left - current.originLeft, deltaY = current.top - current.originTop;
    current.group.interaction.onPreview({
      positions: new Map(current.group.members.map(member => {
        const pixels = gridToPixels(member.x, member.y);
        return [member.id, { left: pixels.left + deltaX, top: pixels.top + deltaY }];
      })),
      target: target ? { ...gridToPixels(target.x - current.group.anchorOffset.x, target.y - current.group.anchorOffset.y),
        width: current.group.footprint.width, height: current.group.footprint.height } : null,
    });
  }

  function insertionProposal(current: Gesture) {
    if (!insertion) return null;
    const dragged = current.group?.footprint ?? items.find((entry) => entry.id === item.id);
    if (!dragged) return null;
    const memberIds = new Set(current.group?.members.map(member => member.id));
    const insertionItems = current.group ? [...items.filter(member => !memberIds.has(member.id)), dragged] : items;
    const next = findHorizontalInsertionCandidate(insertionItems, item.id,
      { left: current.pointerLeft, top: current.pointerTop }, candidate.current);
    let proposal = next ? proposeHorizontalInsertion(dragged, next, insertionItems, geometry ?? getWorkspaceGeometry(itemSize),
      current.group?.compactSource ?? true) : null;
    if (proposal && current.group) {
      const anchor = { x: proposal.draggedPosition.x + current.group.anchorOffset.x,
        y: proposal.draggedPosition.y + current.group.anchorOffset.y };
      proposal = { ...proposal, draggedPosition: anchor, draggedItems: groupChanges(current.group, anchor) };
    }
    candidate.current = proposal?.candidate ?? null;
    return proposal;
  }

  function publishPreview(proposal: HorizontalInsertionProposal | null) {
    const key = proposal ? JSON.stringify([proposal.draggedId, proposal.draggedPosition, proposal.draggedItems, proposal.movedItems]) : '';
    if (key === previewKey.current) return;
    previewKey.current = key;
    insertion?.onPreview(proposal);
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || !event.isPrimary || pending.current || gesture.current) return;
    suppressClick.current = false;
    transfer?.onStart();
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = gridToPixels(item.x, item.y);
    let selected: GroupGesture | null = null;
    if (group && group.members.length > 1 && group.members.some(member => member.id === item.id)) {
      const members = group.members.map(member => ({ ...member }));
      const x = Math.min(...members.map(member => member.x)), y = Math.min(...members.map(member => member.y));
      const footprint = { id: item.id, x, y,
        width: Math.max(...members.map(member => (member.x - x) * GRID_SIZE + member.width)),
        height: Math.max(...members.map(member => (member.y - y) * GRID_SIZE + member.height)) };
      const ids = new Set(members.map(member => member.id));
      selected = { members, footprint, anchorOffset: { x: item.x - x, y: item.y - y }, interaction: group,
        compactSource: members.every(member => member.y === y) && !items.some(member => !ids.has(member.id) &&
          rectanglesOverlap({ ...gridToPixels(x, y), width: footprint.width, height: footprint.height },
            { ...gridToPixels(member.x, member.y), width: member.width, height: member.height })) };
    }
    gesture.current = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top,
      originLeft: origin.left, originTop: origin.top,
      left: origin.left, top: origin.top, active: false,
      pointerLeft: origin.left + event.clientX - rect.left,
      pointerTop: origin.top + event.clientY - rect.top, node: event.currentTarget,
      group: selected, transfer, clientX: event.clientX, clientY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.active && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < DRAG_THRESHOLD) return;
    if (!current.active) current.transfer?.onDragState(true);
    current.active = true;
    current.clientX = event.clientX;
    current.clientY = event.clientY;
    suppressClick.current = true;
    const canvas = event.currentTarget.parentElement!.getBoundingClientRect();
    current.pointerLeft = event.clientX - canvas.left;
    current.pointerTop = event.clientY - canvas.top;
    current.left = event.clientX - canvas.left - current.offsetX;
    current.top = event.clientY - canvas.top - current.offsetY;
    event.preventDefault();
    if (frame.current === null) {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (gesture.current === current) {
          const transferTarget = current.transfer?.targetAt(current.clientX, current.clientY, current.group?.members.map(member => member.id) ?? [item.id]) ?? null;
          current.transfer?.onPreview(transferTarget);
          const proposal = transferTarget ? null : insertionProposal(current);
          publishPreview(proposal);
          const target = transferTarget ? null : proposal?.draggedPosition ?? destination(current);
          publishGroupPreview(current, target);
          setVisual({ left: current.left, top: current.top,
            target, dragging: true });
        }
      });
    }
  }

  function finish(event: PointerEvent<HTMLElement>, cancelled: boolean) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!cancelled) move(event);
    gesture.current = null;
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current.active) { current.transfer?.onDragState(false); return; }
    suppressClick.current = true;
    const transferTarget = cancelled ? null : current.transfer?.targetAt(current.clientX, current.clientY, current.group?.members.map(member => member.id) ?? [item.id]);
    current.transfer?.onDragState(false);
    current.transfer?.onPreview(null);
    if (transferTarget && current.transfer) {
      candidate.current = null;
      publishPreview(null);
      current.group?.interaction.onPreview(null);
      setVisual(null);
      pending.current = true;
      void current.transfer.onDrop(current.group?.members.map(member => member.id) ?? [item.id], transferTarget,
        current.group?.members.map(member => ({ id: member.id, x: member.x, y: member.y })) ?? [{ id: item.id, x: item.x, y: item.y }])
        .catch(() => setVisual({ left: current.originLeft, top: current.originTop, target: null, dragging: false }))
        .finally(() => { pending.current = false; });
      return;
    }
    const proposal = cancelled ? null : insertionProposal(current);
    const target = cancelled ? null : proposal?.draggedPosition ?? destination(current);
    candidate.current = null;
    publishPreview(null);
    current.group?.interaction.onPreview(null);
    const finalPixels = target ? gridToPixels(target.x, target.y) : { left: current.originLeft, top: current.originTop };
    setVisual({ ...finalPixels, target: null, dragging: false });
    const canonical = canonicalPosition ?? item;
    if (target && (proposal || current.group || target.x !== canonical.x || target.y !== canonical.y)) {
      pending.current = true;
      const operation = proposal && insertion ? insertion.onCommit(proposal)
        : current.group ? current.group.interaction.onDrop(groupChanges(current.group, target))
        : onDrop(item.id, target);
      void operation.catch(() => {
        setVisual({ left: current.originLeft, top: current.originTop, target: null, dragging: false });
      }).finally(() => { pending.current = false; });
    }
  }

  function onClick(event: MouseEvent<HTMLElement>) {
    if (suppressClick.current && event.detail !== 0) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick.current = false;
    }
  }

  return {
    visual,
    handlers: {
      onPointerDown,
      onPointerMove: move,
      onPointerUp: (event: PointerEvent<HTMLElement>) => finish(event, false),
      onPointerCancel: (event: PointerEvent<HTMLElement>) => finish(event, true),
      onLostPointerCapture: (event: PointerEvent<HTMLElement>) => finish(event, true),
      onClick,
      onTransitionEnd: () => {
        if (!gesture.current && !pending.current) setVisual(null);
      },
    },
  };
}

