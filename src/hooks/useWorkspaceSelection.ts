import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { DRAG_THRESHOLD } from '../constants/grid';
import { gridToPixels, rectanglesOverlap } from '../utils/workspace';
import type { SpatialItem } from '../utils/workspace';

interface Marquee { left: number; top: number; width: number; height: number }
interface SelectionGesture {
  pointerId: number;
  left: number;
  top: number;
  active: boolean;
  node: HTMLElement;
  previous: Set<string>;
}

export function useWorkspaceSelection(items: SpatialItem[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const gesture = useRef<SelectionGesture | null>(null);
  useEffect(() => {
    const available = new Set(items.map(item => item.id));
    setSelectedIds(previous => [...previous].some(id => !available.has(id))
      ? new Set([...previous].filter(id => available.has(id))) : previous);
  }, [items]);
  useEffect(() => {
    const abort = () => {
      const current = gesture.current;
      gesture.current = null;
      if (!current) return;
      if (current.node.hasPointerCapture(current.pointerId)) current.node.releasePointerCapture(current.pointerId);
      setSelectedIds(current.previous);
      setMarquee(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') abort(); };
    window.addEventListener('blur', abort);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('blur', abort);
      window.removeEventListener('keydown', escape);
      abort();
    };
  }, []);

  function update(event: PointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const canvas = current.node.getBoundingClientRect();
    const left = event.clientX - canvas.left, top = event.clientY - canvas.top;
    if (!current.active && Math.hypot(left - current.left, top - current.top) < DRAG_THRESHOLD) return;
    current.active = true;
    const rectangle = { left: Math.min(left, current.left), top: Math.min(top, current.top),
      width: Math.abs(left - current.left), height: Math.abs(top - current.top) };
    setMarquee(rectangle);
    setSelectedIds(new Set(items.filter(item => rectanglesOverlap(rectangle,
      { ...gridToPixels(item.x, item.y), width: item.width, height: item.height })).map(item => item.id)));
    event.preventDefault();
  }

  function finish(event: PointerEvent<HTMLElement>, cancelled: boolean) {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (!cancelled) update(event);
    gesture.current = null;
    if (current.node.hasPointerCapture(current.pointerId)) current.node.releasePointerCapture(current.pointerId);
    if (cancelled) setSelectedIds(current.previous);
    setMarquee(null);
  }

  return { selectedIds, marquee,
    handlers: {
      onPointerDownCapture: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0 || !(event.target instanceof Element)) return;
        const item = event.target.closest<HTMLElement>('[data-workspace-id]');
        if (item && !selectedIds.has(item.dataset.workspaceId!)) setSelectedIds(new Set());
      },
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.target !== event.currentTarget || event.button !== 0 || !event.isPrimary || gesture.current) return;
        const canvas = event.currentTarget.getBoundingClientRect();
        gesture.current = { pointerId: event.pointerId, left: event.clientX - canvas.left, top: event.clientY - canvas.top,
          active: false, node: event.currentTarget, previous: selectedIds };
        setSelectedIds(new Set());
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      },
      onPointerMove: update,
      onPointerUp: (event: PointerEvent<HTMLElement>) => finish(event, false),
      onPointerCancel: (event: PointerEvent<HTMLElement>) => finish(event, true),
      onLostPointerCapture: (event: PointerEvent<HTMLElement>) => finish(event, true),
    },
  };
}
