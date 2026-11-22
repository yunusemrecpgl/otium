import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, RefObject } from 'react';

type Source = { id: string; sectionId: string | null };
type Placement = { anchorId: string; after: boolean };
export type NotebookDrop = Source & Placement;

export function useNotebookReorder(viewport: RefObject<HTMLDivElement | null>, onDrop: (drop: NotebookDrop) => void) {
  const gesture = useRef<{
    source: Source; list: HTMLElement; pointer: number; started: number; startX: number; startY: number;
    x: number; y: number; active: boolean; frame: number;
  } | null>(null);
  const suppressClick = useRef(false);
  const [preview, setPreview] = useState<(Source & { placement: Placement | null }) | null>(null);

  useEffect(() => () => cancelAnimationFrame(gesture.current?.frame ?? 0), []);

  function hit(list: HTMLElement, source: Source, x: number, y: number): Placement | null {
    const windowBounds = viewport.current?.getBoundingClientRect();
    const bounds = list.getBoundingClientRect();
    if (!windowBounds || x < Math.max(bounds.left, windowBounds.left) || x > Math.min(bounds.right, windowBounds.right) ||
      y < Math.max(bounds.top - 4, windowBounds.top) || y > Math.min(bounds.bottom + 4, windowBounds.bottom)) return null;
    let lastId: string | undefined;
    for (const row of list.children) {
      const id = (row as HTMLElement).dataset.notebookSortId;
      if (!id || id === source.id) continue;
      lastId = id;
      const rect = row.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) return { anchorId: id, after: false };
    }
    return lastId ? { anchorId: lastId, after: true } : null;
  }

  function showPlacement(current: NonNullable<typeof gesture.current>) {
    const placement = hit(current.list, current.source, current.x, current.y);
    setPreview(previous => previous?.id === current.source.id && previous.sectionId === current.source.sectionId &&
      previous.placement?.anchorId === placement?.anchorId && previous.placement?.after === placement?.after
      ? previous : { ...current.source, placement });
  }

  function scrollWhileDragging() {
    const current = gesture.current;
    const scroller = viewport.current;
    if (!current?.active || !scroller) return;
    const bounds = scroller.getBoundingClientRect();
    if (current.x >= bounds.left && current.x <= bounds.right && current.y >= bounds.top && current.y <= bounds.bottom) {
      const edge = Math.min(28, bounds.height / 3);
      const distance = Math.max(0, bounds.top + edge - current.y) - Math.max(0, current.y - bounds.bottom + edge);
      if (distance) {
        const before = scroller.scrollTop;
        scroller.scrollTop -= Math.sign(distance) * Math.ceil(Math.abs(distance) / 4);
        if (scroller.scrollTop !== before) showPlacement(current);
      }
    }
    current.frame = requestAnimationFrame(scrollWhileDragging);
  }

  function cancel() {
    cancelAnimationFrame(gesture.current?.frame ?? 0);
    gesture.current = null;
    setPreview(null);
  }

  function start(event: PointerEvent<HTMLButtonElement>, source: Source) {
    if (!event.isPrimary || event.button !== 0 || gesture.current) return;
    suppressClick.current = false;
    const list = event.currentTarget.closest('li')?.parentElement;
    if (!list || list.childElementCount < 2 || event.pointerType === 'touch') return;
    gesture.current = { source, list, pointer: event.pointerId, started: event.timeStamp,
      startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false, frame: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    current.x = event.clientX;
    current.y = event.clientY;
    if (!current.active) {
      const dx = Math.abs(current.x - current.startX), dy = Math.abs(current.y - current.startY);
      if (Math.max(dx, dy) < 5) return;
      suppressClick.current = true;
      if (event.timeStamp - current.started < 170 || dx > dy) { cancel(); return; }
      current.active = true;
      current.frame = requestAnimationFrame(scrollWhileDragging);
    }
    event.preventDefault();
    showPlacement(current);
  }

  function finish(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    const placement = current.active && hit(current.list, current.source, event.clientX, event.clientY);
    cancel();
    if (placement) onDrop({ ...current.source, ...placement });
  }

  function pointerCancel(event: PointerEvent<HTMLButtonElement>) {
    if (gesture.current?.pointer === event.pointerId) cancel();
  }

  return { preview, suppressClick, start, move, finish, pointerCancel, cancel };
}
