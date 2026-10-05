import type { Link } from '../domain/link';
import type { Project } from '../domain/project';
import type { ProjectWorkspaceItem } from '../domain/workspace';
import { PROJECT_PREVIEW_LIMIT } from '../constants/project';
import { gridToPixels } from '../utils/workspace';
import type { GridPosition, SpatialItem, WorkspaceGeometry } from '../utils/workspace';
import { useSpatialDrag } from '../hooks/useSpatialDrag';
import type { SpatialDragGroup, SpatialInsertionInteraction, SpatialTransferInteraction } from '../hooks/useSpatialDrag';
import { roomDirection } from '../utils/roomDirection';
import { getProjectDimensions, PROJECT_TITLE_FONT_SIZE, PROJECT_TITLE_PADDING } from '../utils/projectDimensions';
import { LinkFavicon } from './LinkFavicon';
import { preloadProjectPage } from '../services/projectPageLoader';

interface ProjectCardProps {
  project: Project;
  links: Link[];
  item: ProjectWorkspaceItem;
  items: SpatialItem[];
  itemSize: number;
  geometry?: WorkspaceGeometry;
  canonicalPosition?: GridPosition;
  onMove: (id: string, position: GridPosition) => Promise<void>;
  onOpen: (project: Project) => void;
  insertion?: SpatialInsertionInteraction;
  previewPosition?: GridPosition;
  selected?: boolean;
  group?: SpatialDragGroup;
  transfer?: SpatialTransferInteraction;
  groupPixels?: { left: number; top: number };
}

export function ProjectCard({ project, links, item, items, itemSize, geometry, canonicalPosition, onMove, onOpen, insertion, previewPosition, selected, group, groupPixels, transfer }: ProjectCardProps) {
  const dimensions = getProjectDimensions(project, itemSize);
  const { visual, handlers } = useSpatialDrag({ item, items, itemSize, geometry, canonicalPosition, dimensions, onDrop: onMove, insertion, group, transfer });
  const pixels = visual?.dragging ? { left: visual.left, top: visual.top }
    : groupPixels ? groupPixels
    : previewPosition ? gridToPixels(previewPosition.x, previewPosition.y)
    : visual ? { left: visual.left, top: visual.top } : gridToPixels(item.x, item.y);
  return (
    <>
      {visual?.dragging && visual.target && !group && (
        <div className="workspace-slot drop-preview" style={{ ...gridToPixels(visual.target.x, visual.target.y), ...dimensions }} aria-hidden="true" />
      )}
      <button
        type="button"
        className={`workspace-slot project-card home-spatial-item${selected ? ' is-selected' : ''}${visual?.dragging || groupPixels ? ' is-dragging' : visual ? ' is-settling' : ''}`}
        data-workspace-id={item.id}
        data-room-direction={roomDirection(item.id)}
        style={{ ...pixels, ...dimensions, padding: PROJECT_TITLE_PADDING, fontSize: PROJECT_TITLE_FONT_SIZE }}
        title={project.name} aria-label={`Open project ${project.name}`} draggable={false}
        data-project-color={project.color ?? 'neutral'}
        {...handlers}
        onPointerEnter={preloadProjectPage}
        onFocus={preloadProjectPage}
        onClick={(event) => {
          handlers.onClick(event);
          if (!event.defaultPrevented) onOpen(project);
        }}
      >
        <span className="project-card-name">{project.name}</span>
        {!!links.length && <span className="project-card-metadata" aria-hidden="true">
          <span className="project-favicon-stack">
          {links.slice(0, PROJECT_PREVIEW_LIMIT).map((link, index) => (
            <span className="project-stack-icon" key={link.id} style={{ zIndex: PROJECT_PREVIEW_LIMIT - index }}><LinkFavicon key={link.url} title={link.title} url={link.url} /></span>
          ))}
          </span>
          {links.length > PROJECT_PREVIEW_LIMIT && <span className="preview-overflow muted">+{links.length - PROJECT_PREVIEW_LIMIT}</span>}
        </span>}
      </button>
    </>
  );
}
