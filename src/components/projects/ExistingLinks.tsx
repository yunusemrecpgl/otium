import type { Link } from '../../domain/link';
import { LinkItemContent } from '../LinkItemContent';
import type { SortableSourceHandlers } from '../../hooks/useSortableDrag';

interface ExistingLinksProps {
  heading?: string;
  emptyMessage?: string;
  links: Link[];
  selectedIds: string[];
  onSelect: (link: Link) => void;
  disabled?: boolean;
  draggedId?: string;
  getDragHandlers: (id: string) => SortableSourceHandlers;
}

export function ExistingLinks({ links, selectedIds, onSelect, disabled, draggedId, getDragHandlers, heading = 'Existing Links', emptyMessage = 'No global links yet.' }: ExistingLinksProps) {
  return (
    <section className="existing-links" aria-labelledby="existing-links-title">
      <h2 id="existing-links-title">{heading}</h2>
      {links.length === 0 ? <p className="muted">{emptyMessage}</p> : (
        <div className="builder-link-grid">
          {links.map((link) => (
            <button key={link.id} type="button" className={`workspace-slot link-item builder-link${draggedId === link.id ? ' is-sortable-source' : ''}`} title={link.title} aria-label={`${selectedIds.includes(link.id) ? 'Remove' : 'Add'} ${link.title} ${selectedIds.includes(link.id) ? 'from' : 'to'} project`} aria-pressed={selectedIds.includes(link.id)} disabled={disabled} {...getDragHandlers(link.id)} onClick={() => { if (!draggedId) onSelect(link); }}>
              <LinkItemContent key={link.url} title={link.title} url={link.url} />
              <span className="builder-selection" aria-hidden="true">{selectedIds.includes(link.id) ? '−' : '+'}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
