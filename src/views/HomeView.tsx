import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { OtiumData } from '../domain/data';
import type { NewLink } from '../domain/link';
import type { Theme } from '../domain/settings';
import type { GridPosition, WorkspaceGeometry } from '../utils/workspace';
import { toSpatialItems } from '../utils/workspace';
import { AddButton } from '../components/AddButton';
import { AddLinkModal } from '../components/AddLinkModal';
import { LinkItem } from '../components/LinkItem';
import { ProjectCard } from '../components/ProjectCard';
import type { Project } from '../domain/project';
import { resolveProjectLinks } from '../utils/projectLinks';
import { ThemeToggle } from '../components/ThemeToggle';
import { ArrangeButton } from '../components/ArrangeButton';
import { arrangeWorkspace } from '../utils/arrangeWorkspace';
import { insertionChanges } from '../utils/horizontalInsertion';
import type { HorizontalInsertionProposal, WorkspacePositionChange } from '../utils/horizontalInsertion';
import { canonicalInsertionForProjection, projectWorkspaceToViewport } from '../utils/workspaceProjection';
import { useWorkspaceViewport } from '../hooks/useWorkspaceViewport';
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection';
import type { GroupDragPreview, SpatialDragGroup } from '../hooks/useSpatialDrag';
import type { FolderDraft, FolderPatch } from '../domain/folder';
import { FolderCard } from '../components/FolderCard';
import { CreateFolderModal } from '../components/CreateFolderModal';
import { useWorkspaceTransition } from '../hooks/useWorkspaceTransition';
import { useWorkspaceTransfer } from '../hooks/useWorkspaceTransfer';
import { TrashDropTarget } from '../components/TrashDropTarget';
import { TRASH_DESTINATION } from '../services/trash';
import { FolderEditor } from '../components/FolderEditor';
import { FolderNavigation } from '../components/FolderNavigation';
import { getFolderPath } from '../utils/folderHierarchy';

interface HomeViewProps {
  data: OtiumData;
  theme: Theme;
  onToggleTheme: () => void;
  onOpenProject: (project: Project) => void;
  onAdd: (link: NewLink, containerId?: string) => Promise<void>;
  onMove: (id: string, position: GridPosition, geometry?: WorkspaceGeometry) => Promise<void>;
  onMoveBatch: (changes: WorkspacePositionChange[], geometry?: WorkspaceGeometry) => Promise<void>;
  onCreateFolder: (draft: FolderDraft, containerId?: string) => Promise<void>;
  onTransfer: (ids: string[], containerId: string, positions: WorkspacePositionChange[]) => Promise<void>;
  onTrash: (ids: string[]) => Promise<void>;
  onUpdateFolder: (id: string, patch: FolderPatch) => Promise<void>;
  onFlushFolderEdits: () => void;
}

export function HomeView(props: HomeViewProps) {
  const room = useWorkspaceTransition();
  const root = useRef<HTMLElement>(null);
  const navigation = useRef<HTMLDivElement>(null);
  const [navigationHeight, setNavigationHeight] = useState(0);
  const [destinationTarget, setDestinationTarget] = useState<string | null>(null);
  const insideFolder = room.containerId !== 'home';
  const path = useMemo(() => insideFolder ? getFolderPath(props.data, room.containerId) : [], [props.data.folders, props.data.workspaceItems, room.containerId, insideFolder]);
  const rootFolders = useMemo(() => {
    const ids = new Set(props.data.workspaceItems.filter(item => item.type === 'folder' && !item.trashedAt && item.containerId === 'home').map(item => item.type === 'folder' ? item.folderId : ''));
    return props.data.folders.filter(folder => !folder.trashedAt && ids.has(folder.id));
  }, [props.data.folders, props.data.workspaceItems]);
  useLayoutEffect(() => {
    const node = navigation.current;
    if (!node) { setNavigationHeight(0); return; }
    const measure = () => setNavigationHeight(node.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [insideFolder]);
  useLayoutEffect(() => {
    setDestinationTarget(null);
    const scrollContainer = root.current?.closest<HTMLElement>('.active-view');
    if (scrollContainer) scrollContainer.scrollTop = 0;
  }, [room.containerId]);
  useEffect(() => {
    if (insideFolder && !path) room.resetHome();
  }, [insideFolder, path, room.resetHome]);
  return <section ref={root} className="workspace-room">
    {insideFolder && <div ref={navigation} className="folder-workspace-header"><FolderNavigation path={path ?? []} roots={rootFolders}
      containerId={room.containerId} target={destinationTarget} disabled={room.phase !== 'idle'} onNavigate={room.navigate} /></div>}
    {(!insideFolder || path) && <WorkspaceCanvas key={room.containerId} {...props} containerId={room.containerId} phase={room.phase} onNavigate={room.navigate}
      root={root} navigationHeight={navigationHeight} onDestinationPreview={setDestinationTarget} />}
  </section>;
}

function WorkspaceCanvas({ data, theme, onToggleTheme, onOpenProject, onAdd, onMove, onMoveBatch, onCreateFolder, onTransfer, onTrash, onUpdateFolder, onFlushFolderEdits,
  containerId, phase, onNavigate, root, navigationHeight, onDestinationPreview }: HomeViewProps & {
    containerId: string; phase: 'idle' | 'out' | 'in'; onNavigate: (id: string) => void;
    root: RefObject<HTMLElement | null>; navigationHeight: number; onDestinationPreview: (id: string | null) => void;
  }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [arranging, setArranging] = useState(false);
  const arrangePending = useRef(false);
  const [insertionPreview, setInsertionPreview] = useState<HorizontalInsertionProposal | null>(null);
  const [groupPreview, setGroupPreview] = useState<GroupDragPreview | null>(null);
  const itemSize = data.settings.appearance.itemSize;
  const rawViewport = useWorkspaceViewport(itemSize);
  const viewport = { ...rawViewport, height: Math.max(0, rawViewport.height - navigationHeight) };
  const workspaceItems = useMemo(() => data.workspaceItems.filter(item => !item.trashedAt && item.containerId === containerId &&
    (item.type === 'project' ? data.projects.some(project => project.id === item.projectId && !project.trashedAt) :
      item.type === 'folder' ? data.folders.some(folder => folder.id === item.folderId && !folder.trashedAt) : true)), [data.workspaceItems, data.projects, data.folders, containerId]);
  const transfer = useWorkspaceTransfer(root, workspaceItems, containerId, async (ids, destination, positions) => {
    try { await onTransfer(ids, destination, positions); }
    catch (cause) { setOpenError(cause instanceof Error ? cause.message : 'Items could not be moved.'); throw cause; }
  }, async ids => {
    try { await onTrash(ids); }
    catch (cause) { setOpenError(cause instanceof Error ? cause.message : 'Items could not be moved to Trash.'); throw cause; }
  }, data);
  const transferInteraction = { ...transfer.interaction, onPreview: (id: string | null) => {
    transfer.interaction.onPreview(id);
    onDestinationPreview(id);
  } };
  const projection = useMemo(() => projectWorkspaceToViewport(
    toSpatialItems(workspaceItems, itemSize, data.projects, data.folders),
    { width: viewport.width, height: viewport.height, itemSize }),
  [workspaceItems, data.projects, data.folders, itemSize, viewport.width, viewport.height]);
  const spatialItems = projection.spatialItems;
  const selection = useWorkspaceSelection(spatialItems);
  const displayGeometry = { ...viewport, height: Math.max(viewport.height, projection.contentHeight) };
  const members = spatialItems.filter(item => selection.selectedIds.has(item.id));
  const group: SpatialDragGroup | undefined = members.length > 1 ? {
    members, onPreview: setGroupPreview,
    onDrop: changes => onMoveBatch(changes, displayGeometry),
  } : undefined;
  const links = new Map(data.links.map((link) => [link.id, link]));
  const projects = new Map(data.projects.map((project) => [project.id, project]));
  const folders = new Map(data.folders.map(folder => [folder.id, folder]));
  const currentFolder = containerId === 'home' ? undefined : folders.get(containerId);
  const unplaced = workspaceItems.some(item => !projection.positions.has(item.id) &&
    (item.type === 'link' ? links.has(item.linkId) : item.type === 'project' ? projects.has(item.projectId) : folders.has(item.folderId)));
  const previewPositions = new Map(insertionPreview?.movedItems.map((entry) => [entry.id, entry]) ?? []);
  const insertion = { onPreview: setInsertionPreview,
    onCommit: (proposal: HorizontalInsertionProposal) => {
      const canonical = canonicalInsertionForProjection(proposal,
        toSpatialItems(workspaceItems, itemSize, data.projects, data.folders),
        { ...displayGeometry, height: Math.max(displayGeometry.height, proposal.contentHeight ?? 0) }, spatialItems);
      if (!canonical) return Promise.reject(new Error('This insertion layout is unavailable.'));
      return onMoveBatch(insertionChanges(canonical.proposal), canonical.geometry);
    } };
  const moveDisplayedItem = (id: string, position: GridPosition) => onMove(id, position, displayGeometry);
  async function arrange() {
    if (arrangePending.current || phase !== 'idle' || transfer.dragActive || !workspaceItems.length) return;
    arrangePending.current = true;
    setArranging(true);
    setOpenError(null);
    try {
      const result = arrangeWorkspace(toSpatialItems(workspaceItems, itemSize, data.projects, data.folders), viewport);
      await onMoveBatch(result.changes, result.geometry);
    } catch (cause) {
      setOpenError(cause instanceof Error ? cause.message : 'Workspace could not be arranged.');
    } finally { arrangePending.current = false; setArranging(false); }
  }
  return (
    <>
    <div className="workspace-utilities" aria-label="Workspace utilities">
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <ArrangeButton onArrange={() => { void arrange(); }} disabled={arranging || phase !== 'idle' || transfer.dragActive || !workspaceItems.length} />
    </div>
    <main className={`workspace${selection.marquee ? ' is-selecting' : ''}`} aria-label={containerId === 'home' ? 'Otium workspace' : `${folders.get(containerId)?.name.trim() || 'Folder'} workspace`}
      data-room-phase={phase} style={{ minHeight: Math.max(viewport.height, projection.contentHeight, insertionPreview?.contentHeight ?? 0) }} {...selection.handlers}>
      <AddButton onClick={() => setModalOpen(true)} />
      {workspaceItems.map((item) => {
        switch (item.type) {
          case 'link': {
            const link = links.get(item.linkId);
            const display = projection.positions.get(item.id);
            return link && display ? <LinkItem key={item.id} item={{ ...item, ...display }} canonicalPosition={item} link={link} items={spatialItems} itemSize={itemSize} geometry={displayGeometry} onMove={moveDisplayedItem} insertion={insertion} previewPosition={previewPositions.get(item.id)}
              selected={selection.selectedIds.has(item.id)} group={selection.selectedIds.has(item.id) ? group : undefined} groupPixels={groupPreview?.positions.get(item.id)} transfer={transferInteraction} /> : null;
          }
          case 'project': {
            const project = projects.get(item.projectId);
            const display = projection.positions.get(item.id);
            return project && display ? <ProjectCard key={item.id} item={{ ...item, ...display }} canonicalPosition={item} project={project} links={resolveProjectLinks(project, data.links)} items={spatialItems} itemSize={itemSize} geometry={displayGeometry} onMove={moveDisplayedItem} onOpen={onOpenProject} insertion={insertion} previewPosition={previewPositions.get(item.id)}
              selected={selection.selectedIds.has(item.id)} group={selection.selectedIds.has(item.id) ? group : undefined} groupPixels={groupPreview?.positions.get(item.id)} transfer={transferInteraction} /> : null;
          }
          case 'folder': {
            const folder = folders.get(item.folderId);
            const display = projection.positions.get(item.id);
            return folder && display ? <FolderCard key={item.id} folder={folder} item={{ ...item, ...display }} canonicalPosition={item}
              items={spatialItems} itemSize={itemSize} geometry={displayGeometry} onMove={moveDisplayedItem} onOpen={onNavigate}
              insertion={insertion} previewPosition={previewPositions.get(item.id)}
              selected={selection.selectedIds.has(item.id)} group={selection.selectedIds.has(item.id) ? group : undefined} groupPixels={groupPreview?.positions.get(item.id)}
              transfer={transferInteraction} activeTarget={transfer.target === folder.id} /> : null;
          }
        }
      })}
      {groupPreview?.target && <div className="workspace-slot drop-preview group-drop-preview" style={groupPreview.target} aria-hidden="true" />}
      {selection.marquee && <div className="workspace-marquee" style={selection.marquee} aria-hidden="true" />}
      {openError && <p className="workspace-error" role="alert">{openError}</p>}
      {unplaced && <p className="workspace-projection-notice" role="status">Window is too narrow to show every item. Widen it to access the remaining items.</p>}
      {modalOpen && <AddLinkModal onClose={() => setModalOpen(false)} onAdd={link => onAdd(link, containerId)}
        onCreateFolder={() => { setModalOpen(false); setFolderModalOpen(true); }} />}
      {folderModalOpen && <CreateFolderModal onClose={() => setFolderModalOpen(false)} onCreate={draft => onCreateFolder(draft, containerId)} />}
    </main>
      {currentFolder && <FolderEditor key={containerId} folder={currentFolder} onUpdate={onUpdateFolder} onFlush={onFlushFolderEdits} />}
      <TrashDropTarget targetRef={transfer.trashRef} visible={transfer.dragActive} active={transfer.target === TRASH_DESTINATION} />
    </>
  );
}
