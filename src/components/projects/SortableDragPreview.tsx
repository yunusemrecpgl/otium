import type { Link } from '../../domain/link';
import { LinkFavicon } from '../LinkFavicon';
import type { SortableDragState } from '../../hooks/useSortableDrag';
import { createPortal } from 'react-dom';
import { SORTABLE_ITEM_WIDTH, SORTABLE_ITEM_HEIGHT } from '../../constants/sortable';

export function SortableDragPreview({ drag, link }: { drag: SortableDragState | null; link?: Link }) {
  if (!drag || !link) return null;
  // Portal avoids transformed page-transition ancestors affecting viewport positioning.
  return createPortal(
    <div className="slotbar-link sortable-drag-preview" style={{ left: drag.left, top: drag.top, width: SORTABLE_ITEM_WIDTH, height: SORTABLE_ITEM_HEIGHT }} aria-hidden="true">
      <LinkFavicon key={link.url} title={link.title} url={link.url} />
      <span className="slotbar-title">{link.title}</span>
    </div>,
    document.querySelector('.otium-app') ?? document.body,
  );
}
