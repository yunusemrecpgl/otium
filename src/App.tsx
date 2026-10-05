import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Sidebar } from './components/navigation/Sidebar';
import type { ViewName } from './components/navigation/Icons';
import { CONTROL_SIZE, GRID_SIZE, SIDEBAR_WIDTH, VISUAL_DOT_SPACING, WORKSPACE_PADDING } from './constants/grid';
import { useTheme } from './hooks/useTheme';
import { useOtiumData } from './hooks/useOtiumData';
import { HomeView } from './views/HomeView';
import { loadProjectPage } from './services/projectPageLoader';
import { availableProjectLinks } from './utils/projectLinks';
import type { Project } from './domain/project';
import { SettingsView } from './views/SettingsView';
import { TrashView } from './views/TrashView';
import { WidgetsView } from './views/WidgetsView';
import { WorkspaceRecovery } from './components/settings/DataRecovery';
import './App.css';

const ProjectPage = lazy(() => loadProjectPage().then(module => ({ default: module.ProjectPage })));
const ProjectsView = lazy(() => import('./views/ProjectsView').then(module => ({ default: module.ProjectsView })));

function WorkspaceLoading() {
  return <div className="workspace-loading" role="status" aria-label="Loading workspace" />;
}

function App() {
  const { data, projects, ready, error, loadError, retryLoad, setAppearance, flushSettings, addLink, moveItem, moveItems, createProject, updateProject, addProjectToHome, setProjectColor, deleteProject, createFolder, updateFolder, transferItems, trashItems, restoreItem, importBookmarks, ensureProjectCanvas, moveProjectCanvasItem, setProjectCanvasZoom, resizeProjectCanvasItem, moveProjectCanvasItems, addProjectWidget, updateProjectWidget, trashProjectCanvasItems, duplicateProjectCanvasItem } = useOtiumData();
  const theme = useTheme(ready ? data.settings.appearance.theme : undefined);
  const firstWorkspacePainted = useRef(false);
  useEffect(() => { if (ready) firstWorkspacePainted.current = true; }, [ready]);
  const [view, setView] = useState<ViewName>('home');
  const [projectSaving, setProjectSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const currentProject = projects.find(project => project.id === projectId);
  const availableLinks = availableProjectLinks(data.links, data.workspaceItems);
  useEffect(() => {
    if (ready && projectId && !currentProject) { setProjectId(null); setProjectSaving(false); }
  }, [ready, projectId, currentProject]);
  const style: CSSProperties & Record<string, string> = {
    '--grid-size': `${GRID_SIZE}px`,
    '--visual-dot-spacing': `${VISUAL_DOT_SPACING}px`,
    '--item-size': `${data.settings.appearance.itemSize}px`,
    '--control-size': `${CONTROL_SIZE}px`,
    '--workspace-padding': `${WORKSPACE_PADDING}px`,
    '--sidebar-width': `${SIDEBAR_WIDTH}px`,
  };

  function navigate(next: ViewName) {
    flushSettings();
    setProjectId(null);
    setView(next);
  }
  function openProject(project: Project) {
    if (project.trashedAt) return;
    flushSettings(); setProjectId(project.id); setView('projects');
  }

  return (
    <div className="otium-app" data-theme={theme} data-booting={!firstWorkspacePainted.current || undefined} style={style} aria-busy={!ready && !loadError}>
      <Sidebar active={view} onNavigate={navigate} disabled={!ready || projectSaving || importing} />
      <div className="active-view">
        {loadError ? <WorkspaceRecovery error={loadError} onRetry={retryLoad} /> : !ready ? <WorkspaceLoading /> : <Suspense fallback={<WorkspaceLoading />}>
        {view === 'home' && ready && <HomeView data={data} theme={theme} onAdd={addLink} onMove={moveItem} onMoveBatch={moveItems}
          onOpenProject={openProject}
          onCreateFolder={createFolder} onUpdateFolder={updateFolder} onFlushFolderEdits={flushSettings} onTransfer={transferItems} onTrash={trashItems} onToggleTheme={() => {
          setAppearance({ theme: theme === 'light' ? 'dark' : 'light' });
          flushSettings();
        }} />}
        {view === 'projects' && (currentProject ? <ProjectPage folders={data.folders} workspaceItems={data.workspaceItems} key={currentProject.id} project={currentProject} links={data.links} availableLinks={availableLinks}
          theme={theme} onToggleTheme={() => { setAppearance({ theme: theme === 'light' ? 'dark' : 'light' }); flushSettings(); }}
          widgets={data.widgetInstances} onAddWidget={addProjectWidget} onUpdateWidget={updateProjectWidget} onTrashCanvasItems={trashProjectCanvasItems} onDuplicateCanvasItem={duplicateProjectCanvasItem} canvasItems={data.projectCanvasItems} onEnsureCanvas={ensureProjectCanvas} onMoveCanvasItem={moveProjectCanvasItem} onMoveCanvasItems={moveProjectCanvasItems} onResizeCanvasItem={resizeProjectCanvasItem}
          onCanvasZoom={setProjectCanvasZoom} canvasState={data.projectCanvasStates.find(state => state.projectId === currentProject.id)}
          addedToHome={data.workspaceItems.some(item => item.type === 'project' && item.projectId === currentProject.id && item.containerId === 'home' && !item.trashedAt)}
          onBack={() => setProjectId(null)} onSave={draft => updateProject(draft.id, draft)} onAddToHome={addProjectToHome} onSavingChange={setProjectSaving}
          onSetColor={setProjectColor} onDelete={deleteProject} />
          : <ProjectsView folders={data.folders} workspaceItems={data.workspaceItems} projects={projects} links={data.links} availableLinks={availableLinks} onOpen={openProject} ready={ready} onCreate={createProject} onSavingChange={setProjectSaving} />)}
        {view === 'widgets' && <WidgetsView />}
        {view === 'settings' && <SettingsView appearance={data.settings.appearance} onChange={setAppearance} onCommit={flushSettings} disabled={!ready || importing}
          onImport={importBookmarks} onImportBusyChange={setImporting} />}
        {view === 'trash' && ready && <TrashView data={data} onRestore={restoreItem} />}
        {error && <p className="workspace-error" role="alert">{error}</p>}
        </Suspense>}
      </div>
    </div>
  );
}

export default App;







