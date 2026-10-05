import type { Folder } from '../domain/folder';
import type { FolderWorkspaceItem } from '../domain/workspace';
import { useSpatialDrag } from '../hooks/useSpatialDrag';
import type { SpatialDragGroup, SpatialInsertionInteraction, SpatialTransferInteraction } from '../hooks/useSpatialDrag';
import { gridToPixels } from '../utils/workspace';
import type { GridPosition, SpatialItem, WorkspaceGeometry } from '../utils/workspace';
import { getFolderDimensions } from '../utils/folderDimensions';
import { roomDirection } from '../utils/roomDirection';
import { FolderIcon } from './FolderIcon';

interface Props {
  folder: Folder;
  item: FolderWorkspaceItem;
  items: SpatialItem[];
  itemSize: number;
  geometry: WorkspaceGeometry;
  canonicalPosition: GridPosition;
  onMove: (id: string, position: GridPosition) => Promise<void>;
  onOpen: (id: string) => void;
  insertion: SpatialInsertionInteraction;
  transfer: SpatialTransferInteraction;
  previewPosition?: GridPosition;
  selected?: boolean;
  group?: SpatialDragGroup;
  groupPixels?: { left: number; top: number };
  activeTarget: boolean;
}
export function FolderCard({ folder, item, items, itemSize, geometry, canonicalPosition, onMove, onOpen, insertion, transfer, previewPosition, selected, group, groupPixels, activeTarget }: Props) {
  const unnamed = !folder.name.trim();
  const label = folder.name.trim() || `${folder.icon} folder`;
  const dimensions = getFolderDimensions(folder, itemSize);
  const { visual, handlers } = useSpatialDrag({ item, items, itemSize, geometry, canonicalPosition, dimensions, onDrop: onMove, insertion, group, transfer });
  const pixels = visual?.dragging ? { left: visual.left, top: visual.top } : groupPixels ??
    (previewPosition ? gridToPixels(previewPosition.x, previewPosition.y) : visual ? { left: visual.left, top: visual.top } : gridToPixels(item.x, item.y));
  return <>
    {visual?.dragging && visual.target && !group && <div className="workspace-slot drop-preview" style={{ ...gridToPixels(visual.target.x, visual.target.y), ...dimensions }} aria-hidden="true" />}
    <button type="button" className={`workspace-slot project-card folder-card home-spatial-item${unnamed ? ' is-icon-only' : ''}${selected ? ' is-selected' : ''}${visual?.dragging || groupPixels ? ' is-dragging' : visual ? ' is-settling' : ''}${activeTarget ? ' is-transfer-target' : ''}`}
      data-workspace-id={item.id} data-destination-id={folder.id} data-room-direction={roomDirection(item.id)} data-project-color={folder.color}
      style={{ ...pixels, ...dimensions }} title={label} aria-label={`Open folder ${label}`} draggable={false} {...handlers}
      onClick={event => { handlers.onClick(event); if (!event.defaultPrevented) onOpen(folder.id); }}>
      <FolderIcon icon={folder.icon} className="folder-card-icon" />{!unnamed && <span className="project-card-name">{folder.name}</span>}
    </button>
  </>;
}
