import type { Folder } from '../domain/folder';
import type { WorkspaceItem } from '../domain/workspace';
import type { Theme } from '../domain/settings';
import { ThemeToggle } from '../components/ThemeToggle';
import { Trash2 } from 'lucide-react';
import type { WidgetInstance } from '../domain/widget';
import type { ProjectWidgetConfig } from '../domain/projectWidget';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Link } from '../domain/link';
import type { Project, ProjectDraft } from '../domain/project';
import { resolveProjectLinks } from '../utils/projectLinks';
import { browserTabsService } from '../services/browserTabs';
import { ProjectToolbar } from '../components/projects/ProjectToolbar';
import { ProjectCanvas } from '../components/projects/ProjectCanvas';
import { ProjectAddMenu } from '../components/projects/ProjectAddMenu';
import { CreateProjectView } from './CreateProjectView';
import { DeleteProjectDialog } from '../components/projects/DeleteProjectDialog';
import { PROJECT_COLORS } from '../domain/projectColor';
import type { ProjectColor } from '../domain/projectColor';
import type { ProjectCanvasItem } from '../domain/projectCanvasItem';
import type { ProjectCanvasState, ProjectCanvasZoom } from '../domain/projectCanvasState';
import { isProjectCanvasPlacement } from '../services/projectCanvasValidation';

interface Props {
  theme: Theme;
  onToggleTheme: () => void;
  folders: Folder[];
  workspaceItems: WorkspaceItem[];
  project: Project;
  canvasItems: ProjectCanvasItem[];
  widgets: WidgetInstance[];
  onAddWidget: (projectId: string, type: 'note' | 'todo' | 'resource' | 'web-data' | 'clip' | 'compare' | 'rss' | 'formula' | 'page-watch' | 'text', position: { x: number; y: number }) => Promise<void>;
  onUpdateWidget: (id: string, config: ProjectWidgetConfig) => Promise<void>;
  onTrashCanvasItems: (projectId: string, ids: string[]) => Promise<void>;
  onDuplicateCanvasItem: (projectId: string, id: string, config?: ProjectWidgetConfig) => Promise<string>;
  canvasState?: ProjectCanvasState;
  onCanvasZoom: (projectId: string, zoom: ProjectCanvasZoom) => Promise<void>;
  onEnsureCanvas: (projectId: string, viewport: { width: number; height: number }) => Promise<void>;
  onResizeCanvasItem: (projectId: string, id: string, width: number, height: number, minSize?: { width: number; height: number }) => Promise<void>;
  onMoveCanvasItems: (projectId: string, ids: string[], anchorId: string, dx: number, dy: number) => Promise<void>;
  onMoveCanvasItem: (projectId: string, id: string, x: number, y: number) => Promise<void>;
  links: Link[];
  availableLinks: Link[];
  addedToHome: boolean;
  onBack: () => void;
  onSave: (draft: ProjectDraft) => Promise<Project>;
  onAddToHome: (id: string) => Promise<void>;
  onSavingChange: (saving: boolean) => void;
  onSetColor: (id: string, color: ProjectColor) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ProjectPage({ theme, onToggleTheme, folders, workspaceItems, project, canvasItems, widgets, onAddWidget, onUpdateWidget, onTrashCanvasItems, onDuplicateCanvasItem, canvasState, onCanvasZoom, onEnsureCanvas, onMoveCanvasItem, onMoveCanvasItems, onResizeCanvasItem, links, availableLinks, addedToHome, onBack, onSave, onAddToHome, onSavingChange, onSetColor, onDelete }: Props) {
  const page = useRef<HTMLElement>(null);
  const initialization = useRef<string | null>(null);
  const ensureCanvas = useRef(onEnsureCanvas); ensureCanvas.current = onEnsureCanvas;
  const widgetPosition = useRef({ x: 20, y: 20 });
  const [renaming, setRenaming] = useState(false);
  const [widgetAdding, setWidgetAdding] = useState(false);
  const widgetPending = useRef(false);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addingRef = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [colorSaving, setColorSaving] = useState(false);
  const colorPending = useRef(false);
  const colorControl = useRef<HTMLDivElement>(null);
  const colorButton = useRef<HTMLButtonElement>(null);
  const busy = widgetAdding || adding || colorSaving || deleting || renaming;
  useEffect(() => {
    if (!colorOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !colorControl.current?.contains(event.target)) setColorOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setColorOpen(false); colorButton.current?.focus(); }
    };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape); };
  }, [colorOpen]);
  const resolved = useMemo(() => resolveProjectLinks(project, links), [project, links]);
  const availableIds = useMemo(() => new Set(availableLinks.map(link => link.id)), [availableLinks]);
  const activeLinks = useMemo(() => resolved.filter(link => link.projectId === project.id || availableIds.has(link.id)), [resolved, project.id, availableIds]);
  // Trashed placements are intentional tombstones, not missing geometry.
  const placedLinks = useMemo(() => new Set(canvasItems.filter(item =>
    isProjectCanvasPlacement(item) && item.projectId === project.id && item.type === 'link').map(item => item.referenceId)), [canvasItems, project.id]);
  const canvasReady = !!canvasState && resolved.every(link => placedLinks.has(link.id));
  const canvasStarted = useRef(canvasReady);
  useEffect(() => { if (canvasReady) canvasStarted.current = true; }, [canvasReady]);
  const membership = JSON.stringify(resolved.map(link => link.id));
  useEffect(() => {
    if (editing || canvasReady || initialization.current === membership) return;
    const element = page.current;
    if (!element) return;
    initialization.current = membership;
    const toolbarHeight = element.querySelector('.project-toolbar')?.getBoundingClientRect().height ?? 0;
    void ensureCanvas.current(project.id, { width: element.clientWidth, height: Math.max(0, element.clientHeight - toolbarHeight) })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Canvas placements could not be saved.'))
      .finally(() => { if (initialization.current === membership) initialization.current = null; });
  }, [canvasReady, membership, project.id, editing]);

  if (editing) return <CreateProjectView folders={folders} workspaceItems={workspaceItems} links={links} availableLinks={availableLinks} initialProject={project} onCreate={onSave}
    onCancel={() => setEditing(false)} onComplete={() => setEditing(false)} onSavingChange={onSavingChange} />;

  async function addToHome() {
    if (addingRef.current || addedToHome) return;
    addingRef.current = true; setAdding(true); setError(null); onSavingChange(true);
    try { await onAddToHome(project.id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Project could not be added to Home.'); }
    finally { addingRef.current = false; setAdding(false); onSavingChange(false); }
  }

  function editProject() {
    setError(null); setColorOpen(false); setEditing(true);
  }

  return <main ref={page} className="secondary-view project-page">
    <ProjectToolbar name={project.name} onBack={onBack} disabled={busy} onRename={async name => {
      setRenaming(true); onSavingChange(true);
      try { await onSave({ id: project.id, name, linkIds: [...project.linkIds], projectLinks: [] }); }
      finally { setRenaming(false); onSavingChange(false); }
    }} rightActions={<><ThemeToggle theme={theme} onToggle={onToggleTheme} /><div ref={colorControl} className="project-page-color-control">
          <button ref={colorButton} type="button" className="quiet-button project-page-color-button" disabled={busy} aria-expanded={colorOpen}
            onClick={() => setColorOpen(open => !open)}>
            <span className="project-color-swatch" data-project-color={project.color ?? 'neutral'} aria-hidden="true" />Color
          </button>
          {colorOpen && <div className="project-color-palette project-page-color-palette" role="group" aria-label="Project color">
            {PROJECT_COLORS.map(color => <button key={color} type="button" className="project-color-swatch" data-project-color={color}
              aria-label={color} title={color} aria-pressed={(project.color ?? 'neutral') === color} disabled={busy} onClick={async () => {
                if (colorPending.current) return;
                colorPending.current = true; setColorOpen(false); setColorSaving(true); setError(null); onSavingChange(true);
                try { await onSetColor(project.id, color); }
                catch (cause) { setError(cause instanceof Error ? cause.message : 'Project color could not be saved.'); }
                finally { colorPending.current = false; setColorSaving(false); onSavingChange(false); }
              }} />)}
          </div>}
        </div>
        <button type="button" className="text-button project-destructive-action" disabled={busy || opening}
          onClick={() => { setColorOpen(false); setConfirmDelete(true); }}><Trash2 size={14} aria-hidden="true" />Delete Project</button></>}>
        <button type="button" className="quiet-button" disabled={opening || busy || !activeLinks.length} onClick={async () => {
          setOpening(true); setError(null);
          try { await browserTabsService.openProject(project, activeLinks); }
          catch (cause) { setError(cause instanceof Error ? cause.message : 'Some project websites could not be opened.'); }
          finally { setOpening(false); }
        }}>{opening ? 'Opening…' : 'Open All'}</button>
        <button type="button" className="quiet-button" onClick={() => { void addToHome(); }} disabled={addedToHome || busy}>
          {adding ? 'Adding…' : addedToHome ? 'Added to Home' : 'Add to Home'}
        </button>

    </ProjectToolbar>
    {canvasReady || canvasStarted.current ? <ProjectCanvas overlay={<>         <ProjectAddMenu disabled={busy || opening} onWebsite={editProject} onWidget={type => {
          if ((type !== 'note' && type !== 'todo' && type !== 'resource' && type !== 'web-data' && type !== 'clip' && type !== 'compare' && type !== 'rss' && type !== 'formula' && type !== 'page-watch' && type !== 'text') || widgetPending.current) return;
          widgetPending.current = true; setWidgetAdding(true); setError(null);
          void onAddWidget(project.id, type, widgetPosition.current).catch(cause => setError(cause instanceof Error ? cause.message : 'Widget could not be added.'))
            .finally(() => { widgetPending.current = false; setWidgetAdding(false); });
        }} />
 </>} widgets={widgets} onPlacementHint={point => { widgetPosition.current = point; }} onUpdateWidget={onUpdateWidget}
      onError={setError} onDuplicate={(id, config) => onDuplicateCanvasItem(project.id, id, config)}
      onTrash={ids => onTrashCanvasItems(project.id, ids)} links={resolved}
      project={project} items={canvasItems} disabled={busy}
      state={canvasState} onZoom={zoom => onCanvasZoom(project.id, zoom)}
      onMoveGroup={(ids, anchorId, dx, dy) => onMoveCanvasItems(project.id, ids, anchorId, dx, dy)}
      onResize={(id, width, height, minSize) => onResizeCanvasItem(project.id, id, width, height, minSize)}
      onMove={(id, x, y) => onMoveCanvasItem(project.id, id, x, y)} onOpenLink={link => {
      setError(null);
      void browserTabsService.openLink(link.url).catch(cause => setError(cause instanceof Error ? cause.message : 'Website could not be opened.'));
    }} /> : <div className="workspace-loading project-workspace-loading" role="status" aria-label="Preparing Project canvas" />}
    {error && <p className="form-error" role="alert">{error}</p>}
    {confirmDelete && <DeleteProjectDialog onCancel={() => setConfirmDelete(false)} onDelete={async () => { await onDelete(project.id); onBack(); }}
      onBusyChange={value => { setDeleting(value); onSavingChange(value); }} />}
  </main>;
}











