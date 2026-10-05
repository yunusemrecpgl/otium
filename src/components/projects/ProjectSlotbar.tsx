import { t, useLocale } from "../../i18n";
import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Link } from '../../domain/link';
import { LinkFavicon } from '../LinkFavicon';
import type { SortableDragState, SortableSourceHandlers, SortableZoneHandlers } from '../../hooks/useSortableDrag';
import { SORTABLE_SHIFT_DURATION } from '../../constants/sortable';

interface ProjectSlotbarProps {
  linkIds: string[];
  links: Link[];
  onRemove: (id: string) => void;
  disabled?: boolean;
  zoneRef: RefObject<HTMLElement | null>;
  drag: SortableDragState | null;
  getDragHandlers: (id: string) => SortableSourceHandlers;
  onScroll: () => void;
  zoneHandlers: SortableZoneHandlers;
}

export function ProjectSlotbar({ linkIds, links, onRemove, disabled, zoneRef, drag, getDragHandlers, onScroll, zoneHandlers }: ProjectSlotbarProps) {
  useLocale();
  const byId = new Map(links.map((link) => [link.id, link]));
  const listRef = useRef<HTMLOListElement>(null);
  const positions = useRef(new Map<string, number>());
  const animations = useRef(new Map<string, Animation>());
  const insertionIndex = drag?.insertionIndex ?? null;
  const draggedId = drag?.id;

  useLayoutEffect(() => {
    const next = new Map<string, number>();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    listRef.current?.querySelectorAll<HTMLElement>('[data-sortable-id]').forEach((node) => {
      const id = node.dataset.sortableId!;
      if (id === draggedId) return;
      const left = node.offsetLeft;
      next.set(id, left);
      const previous = positions.current.get(id);
      if (previous !== undefined && previous !== left) {
        const transform = getComputedStyle(node).transform;
        const currentShift = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
        animations.current.get(id)?.cancel();
        if (!reducedMotion) {
          const animation = node.animate([
            { transform: `translateX(${previous - left + currentShift}px)` },
            { transform: 'translateX(0)' },
          ], { duration: SORTABLE_SHIFT_DURATION, easing: 'cubic-bezier(0.2, 0, 0.2, 1)' });
          animations.current.set(id, animation);
          animation.onfinish = () => {
            if (animations.current.get(id) === animation) animations.current.delete(id);
          };
        }
      }
    });
    animations.current.forEach((animation, id) => {
      if (!next.has(id)) {
        animation.cancel();
        animations.current.delete(id);
      }
    });
    positions.current = next;
  }, [linkIds, insertionIndex, draggedId]);

  useLayoutEffect(() => {
    const running = animations.current;
    return () => { running.forEach((animation) => animation.cancel()); };
  }, []);

  function placeholder() {
    return <li key="insertion-placeholder" className="slotbar-placeholder" data-sortable-placeholder={insertionIndex} aria-hidden="true" />;
  }

  let visibleIndex = 0;
  const nodes = linkIds.flatMap((id) => {
    const link = byId.get(id);
    if (!link) return [];
    const removedFromFlow = id === draggedId;
    const before = !removedFromFlow && insertionIndex === visibleIndex ? [placeholder()] : [];
    if (!removedFromFlow) visibleIndex++;
    return [...before, (
      <li key={id} data-sortable-id={id} className={`slotbar-link${removedFromFlow ? ' sortable-source-hidden' : ''}`}>
        <button type="button" className="slotbar-handle" aria-label={t("Drag {0} to reorder", { 0: link.title })} title={link.title} disabled={disabled} {...getDragHandlers(id)}>
          <LinkFavicon key={link.url} title={link.title} url={link.url} />
          <span className="slotbar-title">{link.title}</span>
        </button>
        <button type="button" className="slotbar-remove" aria-label={t("Remove {0} from project", { 0: link.title })} title={t("Remove link")} onClick={() => onRemove(id)} disabled={disabled || !!drag}>×</button>
      </li>
    )];
  });
  if (insertionIndex === visibleIndex) nodes.push(placeholder());

  return (
    <section ref={zoneRef} className={`project-slotbar${insertionIndex !== null ? ' is-drop-active' : ''}`} aria-label={t("Selected project links")} onScroll={onScroll} {...zoneHandlers}>
      <ol ref={listRef} className="slotbar-items" data-sortable-list>{nodes}</ol>
      {linkIds.length === 0 && insertionIndex === null && <p className="slotbar-empty">{t("Choose links below to build your project")}</p>}
    </section>
  );
}
