import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import { SORTABLE_DRAG_THRESHOLD, SORTABLE_ITEM_WIDTH, SORTABLE_ITEM_HEIGHT } from '../constants/sortable';
import { calculateInsertionIndex } from '../utils/sortable';

export type SortableSource = 'external' | 'list';

export interface SortableDragState {
  id: string;
  source: SortableSource;
  left: number;
  top: number;
  insertionIndex: number | null;
}

interface SortableOptions {
  onInsert: (id: string, index: number) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

interface Gesture {
  id: string;
  source: SortableSource;
  pointerId: number;
  node: HTMLButtonElement;
  captureNode: HTMLElement;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  clientX: number;
  clientY: number;
  active: boolean;
}

export function useSortableDrag(options: SortableOptions) {
  const zoneRef = useRef<HTMLElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef<number | null>(null);
  const callbacks = useRef(options);
  useEffect(() => { callbacks.current = options; }, [options]);
  const suppressedClick = useRef<HTMLButtonElement | null>(null);
  const [drag, setDrag] = useState<SortableDragState | null>(null);

  function cleanup() {
    const current = gesture.current;
    gesture.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (current?.captureNode.hasPointerCapture(current.pointerId)) current.captureNode.releasePointerCapture(current.pointerId);
    setDrag(null);
  }

  useEffect(() => {
    const cancel = () => {
      if (gesture.current?.active) suppressedClick.current = gesture.current.node;
      cleanup();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) {
        event.preventDefault();
        cancel();
      }
    };
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', escape);
      cleanup();
    };
  }, []);

  function getInsertionIndex(current: Gesture): number | null {
    const zone = zoneRef.current;
    if (!zone) return null;
    const bounds = zone.getBoundingClientRect();
    if (current.clientX < bounds.left || current.clientX > bounds.right ||
        current.clientY < bounds.top || current.clientY > bounds.bottom) return null;

    const list = zone.querySelector<HTMLElement>('[data-sortable-list]');
    if (!list) return 0;
    const left = list.getBoundingClientRect().left;
    const placeholder = list.querySelector<HTMLElement>('[data-sortable-placeholder]');
    if (placeholder && current.clientX >= left + placeholder.offsetLeft &&
        current.clientX <= left + placeholder.offsetLeft + placeholder.offsetWidth) {
      return Number(placeholder.dataset.sortablePlaceholder);
    }
    // Use layout positions, ignoring in-flight FLIP transforms. Keeping the index
    // while inside the physical gap prevents placeholder/geometry oscillation.
    const rects = Array.from(list.querySelectorAll<HTMLElement>('[data-sortable-id]'))
      .filter((node) => node.dataset.sortableId !== current.id)
      .map((node) => {
        const width = node.offsetWidth;
        return { left: left + node.offsetLeft, width };
      });
    return calculateInsertionIndex(current.clientX, rects);
  }

  function publish(current: Gesture) {
    setDrag({
      id: current.id, source: current.source,
      left: current.clientX - current.offsetX,
      top: current.clientY - current.offsetY,
      insertionIndex: getInsertionIndex(current),
    });
  }

  function start(event: PointerEvent<HTMLButtonElement>, id: string, source: SortableSource) {
    if (callbacks.current.disabled || event.button !== 0 || !event.isPrimary || gesture.current) return;
    suppressedClick.current = null;
    const rect = event.currentTarget.getBoundingClientRect();
    gesture.current = {
      id, source, pointerId: event.pointerId, node: event.currentTarget, captureNode: event.currentTarget,
      startX: event.clientX, startY: event.clientY, clientX: event.clientX, clientY: event.clientY,
      // Preserve the proportional grab point as the square source becomes a compact preview.
      offsetX: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * SORTABLE_ITEM_WIDTH,
      offsetY: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) * SORTABLE_ITEM_HEIGHT,
      active: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.clientX = event.clientX;
    current.clientY = event.clientY;
    if (!current.active && Math.hypot(current.clientX - current.startX, current.clientY - current.startY) < SORTABLE_DRAG_THRESHOLD) return;
    if (!current.active && current.source === 'list' && zoneRef.current) {
      // A hidden source can lose capture. Transfer to a stable surface before
      // removing it from layout; ignore the old source's capture-loss event.
      current.captureNode = zoneRef.current;
      current.captureNode.setPointerCapture(current.pointerId);
    }
    current.active = true;
    suppressedClick.current = current.node;
    event.preventDefault();
    if (frame.current === null) {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (gesture.current === current) publish(current);
      });
    }
  }

  function finish(event: PointerEvent<HTMLElement>, cancelled: boolean) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (event.type === 'lostpointercapture' && event.target !== current.captureNode) return;
    if (!cancelled) move(event);
    const index = current.active && !cancelled ? getInsertionIndex(current) : null;
    const active = current.active;
    if (active) suppressedClick.current = current.node;
    cleanup();
    if (!active || cancelled || callbacks.current.disabled) return;
    if (index !== null) callbacks.current.onInsert(current.id, index);
    else if (current.source === 'list') callbacks.current.onRemove(current.id);
  }

  function onScroll() {
    if (gesture.current?.active) publish(gesture.current);
  }

  function getSourceHandlers(id: string, source: SortableSource) {
    return {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => start(event, id, source),
      onPointerMove: move,
      onPointerUp: (event: PointerEvent<HTMLElement>) => finish(event, false),
      onPointerCancel: (event: PointerEvent<HTMLElement>) => finish(event, true),
      onLostPointerCapture: (event: PointerEvent<HTMLElement>) => finish(event, true),
      onClickCapture: (event: MouseEvent<HTMLButtonElement>) => {
        if (event.detail !== 0 && suppressedClick.current === event.currentTarget) {
          event.preventDefault();
          event.stopPropagation();
          suppressedClick.current = null;
        }
      },
    };
  }

  const zoneHandlers = {
    onPointerMove: move,
    onPointerUp: (event: PointerEvent<HTMLElement>) => finish(event, false),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => finish(event, true),
    onLostPointerCapture: (event: PointerEvent<HTMLElement>) => finish(event, true),
  };
  return { drag, zoneRef, getSourceHandlers, onScroll, zoneHandlers };
}

export type SortableSourceHandlers = ReturnType<ReturnType<typeof useSortableDrag>['getSourceHandlers']>;
export type SortableZoneHandlers = ReturnType<typeof useSortableDrag>['zoneHandlers'];
