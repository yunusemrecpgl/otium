import type { Link } from '../domain/link';
import type { LinkWorkspaceItem } from '../domain/workspace';
import { gridToPixels } from '../utils/workspace';
import type { GridPosition, SpatialItem, WorkspaceGeometry } from '../utils/workspace';
import { useSpatialDrag } from '../hooks/useSpatialDrag';
import type { SpatialDragGroup, SpatialInsertionInteraction, SpatialTransferInteraction } from '../hooks/useSpatialDrag';
import { roomDirection } from '../utils/roomDirection';
import { LinkItemContent } from './LinkItemContent';

interface LinkItemProps {
  link: Link;
  item: LinkWorkspaceItem;
  items: SpatialItem[];
  itemSize: number;
  geometry?: WorkspaceGeometry;
  canonicalPosition?: GridPosition;
  onMove: (id: string, position: GridPosition) => Promise<void>;
  insertion?: SpatialInsertionInteraction;
  previewPosition?: GridPosition;
  selected?: boolean;
  group?: SpatialDragGroup;
  transfer?: SpatialTransferInteraction;
  groupPixels?: { left: number; top: number };
}

export function LinkItem({ link, item, items, itemSize, geometry, canonicalPosition, onMove, insertion, previewPosition, selected, group, groupPixels, transfer }: LinkItemProps) {
  const { visual, handlers } = useSpatialDrag({ item, items, itemSize, geometry, canonicalPosition, onDrop: onMove, insertion, group, transfer });
  const pixels = visual?.dragging ? { left: visual.left, top: visual.top }
    : groupPixels ? groupPixels
    : previewPosition ? gridToPixels(previewPosition.x, previewPosition.y)
    : visual ? { left: visual.left, top: visual.top } : gridToPixels(item.x, item.y);
  return (
    <>
      {visual?.dragging && visual.target && !group && (
        <div className="workspace-slot drop-preview" style={gridToPixels(visual.target.x, visual.target.y)} aria-hidden="true" />
      )}
      <a
        className={`workspace-slot link-item home-spatial-item${selected ? ' is-selected' : ''}${visual?.dragging || groupPixels ? ' is-dragging' : visual ? ' is-settling' : ''}`}
        data-workspace-id={item.id}
        data-room-direction={roomDirection(item.id)}
        href={link.url}
        style={pixels}
        title={link.title} aria-label={link.title} draggable={false}
        {...handlers}
      >
        <LinkItemContent key={link.url} title={link.title} url={link.url} />
      </a>
    </>
  );
}
