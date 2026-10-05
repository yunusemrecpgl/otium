import { trashProjectCanvasItems as removeCanvasItems } from '../services/projectCanvasTrash';
import { duplicateProjectCanvasItem as copyCanvasItem } from '../services/projectCanvasDuplicate';
import { addProjectWidget as buildWidget, updateProjectWidget as changeWidget } from '../services/projectWidgets';
import type { ProjectWidgetConfig } from '../domain/projectWidget';
import { useEffect, useRef, useState } from 'react';
import type { OtiumData } from '../domain/data';
import type { AppearanceSettings } from '../domain/settings';
import { DEFAULT_SETTINGS, normalizeItemSize } from '../domain/settings';
import type { NewLink } from '../domain/link';
import type { Project, ProjectDraft } from '../domain/project';
import type { ProjectColor } from '../domain/projectColor';
import { createProject as buildProject, getProjects, updateProject as changeProject, setProjectColor as changeProjectColor, deleteProject as trashProject } from '../services/projects';
import { dataRepository } from '../services/storage';
import type { PersistentDataMutation, CoordinatedDataMutation, DataMutationOptions } from '../services/storage';
import { placeProject } from '../services/projectPlacement';
import { findInitialPosition, getWorkspaceGeometry, getWorkspaceItemDimensions, isValidPosition, toSpatialItems } from '../utils/workspace';
import type { GridPosition, WorkspaceGeometry } from '../utils/workspace';
import type { WorkspacePositionChange } from '../utils/horizontalInsertion';
import { updateWorkspacePositions } from '../services/workspacePositions';
import type { FolderDraft, FolderPatch } from '../domain/folder';
import { createFolder as buildFolder, setFolderColor as changeFolderColor, transferWorkspaceItems, updateFolder as changeFolder } from '../services/folders';
import { GRID_SIZE, WORKSPACE_PADDING } from '../constants/grid';
import { trashWorkspaceItems, restoreTrashEntry } from '../services/trash';
import type { TrashTarget } from '../services/trash';
import { getFolderPath } from '../utils/folderHierarchy';
import type { BookmarkImportRequest, BookmarkImportSummary } from '../domain/importedBookmarks';
import { importBookmarks as buildBookmarkImport } from '../services/bookmarkImport';
import { RepeatedBookmarkImportError } from '../services/bookmarkImportSafety';
import { ensureProjectCanvasLinks, ensureProjectCanvasState, moveProjectCanvasLink, moveProjectCanvasGroup, resizeProjectCanvasItem as changeCanvasSize, setProjectCanvasZoom as changeCanvasZoom } from '../services/projectCanvas';
import type { ProjectCanvasZoom } from '../domain/projectCanvasState';

const emptyData: OtiumData = {
  schemaVersion: 2, links: [], projects: [], folders: [], workspaceItems: [], projectCanvasItems: [], projectCanvasStates: [], widgetInstances: [], settings: DEFAULT_SETTINGS,
};

type BootState = { data: OtiumData; status: 'loading' | 'ready' | 'error'; loadError: string | null };
type PendingEdit = { sequence: number; key: string; apply: PersistentDataMutation };

export function useOtiumData() {
  const [{ data, status: bootStatus, loadError }, setBoot] = useState<BootState>({ data: emptyData, status: 'loading', loadError: null });
  const ready = bootStatus === 'ready';
  const hydrated = useRef(false);
  const synchronizationError = useRef<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const current = useRef(data), saved = useRef(data);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEdits = useRef<PendingEdit[]>([]);
  const savingEdits = useRef(new Map<symbol, PendingEdit[]>());
  const editSequence = useRef(0);
  const latestEditSequence = useRef(new Map<string, number>());
  const notificationVersion = useRef(0);
  const initialLoad = useRef<Promise<OtiumData> | null>(null);

  function publish(next: OtiumData, status?: BootState['status']) {
    current.current = next;
    const loadError = synchronizationError.current;
    setBoot(previous => {
      const value = JSON.stringify(previous.data) === JSON.stringify(next) ? previous.data : next;
      const nextStatus = status ?? previous.status;
      const error = status ? loadError : previous.loadError;
      return value === previous.data && nextStatus === previous.status && error === previous.loadError
        ? previous : { data: value, status: nextStatus, loadError: error };
    });
  }
  function rebasedDrafts() {
    let next = saved.current;
    for (const edit of currentEdits([...savingEdits.current.values()].flat().concat(pendingEdits.current))) {
      // A remotely removed Folder must not crash synchronization. The same
      // intent is still validated against latest storage when it is committed.
      try { next = edit.apply(next); } catch { /* Keep the persisted baseline visible. */ }
    }
    return next;
  }
  function publishDrafts() {
    publish(rebasedDrafts());
  }
  function finishBoot() {
    hydrated.current = true;
    publish(rebasedDrafts(), synchronizationError.current ? 'error' : 'ready');
  }
  useEffect(() => {
    let active = true;
    const version = notificationVersion.current;
    let unsubscribe = () => {};
    try {
      unsubscribe = dataRepository.subscribe(next => {
        if (!active) return;
        notificationVersion.current++;
        saved.current = next;
        synchronizationError.current = null;
        // Initial migration notifications are folded into the first hydration.
        if (hydrated.current) publish(rebasedDrafts(), 'ready');
      }, cause => {
        if (!active) return;
        notificationVersion.current++;
        synchronizationError.current = cause instanceof Error ? cause.message : 'Stored data could not be read.';
        if (hydrated.current) publish(rebasedDrafts(), 'error');
      });
      // Reuse the same in-flight read when StrictMode replays mount effects.
      initialLoad.current ??= dataRepository.load();
      void initialLoad.current.then(loaded => {
        if (active && notificationVersion.current === version) { saved.current = loaded; synchronizationError.current = null; }
      }).catch(cause => {
        if (active && notificationVersion.current === version) synchronizationError.current = cause instanceof Error ? cause.message : 'Data could not be loaded.';
      }).finally(() => { if (active) finishBoot(); });
    } catch (cause) {
      synchronizationError.current = cause instanceof Error ? cause.message : 'Storage synchronization is unavailable.';
      finishBoot();
    }
    return () => { active = false; unsubscribe(); };
  }, []);

  async function retryLoad() {
    const version = notificationVersion.current;
    hydrated.current = false;
    synchronizationError.current = null;
    setBoot(previous => ({ ...previous, status: 'loading', loadError: null }));
    try {
      const loaded = await dataRepository.load();
      if (notificationVersion.current === version) {
        saved.current = loaded;
        synchronizationError.current = null;
      }
    } catch (cause) {
      if (notificationVersion.current === version) synchronizationError.current = cause instanceof Error ? cause.message : 'Data could not be loaded.';
      throw cause;
    } finally { finishBoot(); }
  }

  function assertReady() {
    if (loadError) throw new Error(loadError);
    if (!ready) throw new Error('Workspace is loading. Please try again shortly.');
  }
  function cancelDebounce() {
    if (debounce.current !== null) clearTimeout(debounce.current);
    debounce.current = null;
  }
  function currentEdits(edits: PendingEdit[]) {
    return edits.filter(edit => latestEditSequence.current.get(edit.key) === edit.sequence)
      .sort((a, b) => a.sequence - b.sequence);
  }
  async function mutate(mutator: CoordinatedDataMutation, options?: DataMutationOptions): Promise<OtiumData> {
    assertReady(); cancelDebounce();
    const edits = pendingEdits.current;
    pendingEdits.current = [];
    const token = Symbol(); savingEdits.current.set(token, edits);
    const version = notificationVersion.current;
    try {
      const next = await dataRepository.mutate(latest => mutator(currentEdits(edits).reduce((value, edit) => edit.apply(value), latest)), options);
      // onChanged may already have delivered this write or a newer one. Never
      // replace a newer notification with an earlier mutation's completion.
      if (notificationVersion.current === version) saved.current = next;
      setSaveError(null);
      return next;
    } catch (cause) {
      // Requeue every failed draft, but never revive an older value after a
      // newer edit was queued, captured by another save, or already persisted.
      pendingEdits.current = currentEdits([...edits, ...pendingEdits.current]);
      if (!(cause instanceof RepeatedBookmarkImportError)) {
        setSaveError(cause instanceof Error ? cause.message : 'Changes could not be saved. Please try again.');
      }
      throw cause;
    } finally {
      savingEdits.current.delete(token);
      publishDrafts();
    }
  }
  function flushSettings() {
    cancelDebounce();
    if (pendingEdits.current.length) void mutate(latest => latest).catch(() => {});
  }
  function stage(edit: PersistentDataMutation, key: string) {
    assertReady();
    // Validate the local preview without ever persisting its full snapshot.
    edit(current.current);
    const sequence = ++editSequence.current;
    latestEditSequence.current.set(key, sequence);
    pendingEdits.current.push({ sequence, key, apply: edit });
    publishDrafts(); setSaveError(null); cancelDebounce();
    debounce.current = setTimeout(flushSettings, 300);
  }
  const flush = useRef(flushSettings); flush.current = flushSettings;
  useEffect(() => {
    const pagehide = () => flush.current();
    window.addEventListener('pagehide', pagehide);
    return () => { window.removeEventListener('pagehide', pagehide); flush.current(); };
  }, []);

  function setAppearance(patch: Partial<AppearanceSettings>) {
    const intent = { ...patch, ...(patch.itemSize === undefined ? {} : { itemSize: normalizeItemSize(patch.itemSize) }) };
    try {
      // Independent fields must survive failures independently: a newer theme
      // edit must not discard an older, still-unsaved item-size edit.
      for (const key of Object.keys(intent) as (keyof AppearanceSettings)[]) {
        const value = intent[key];
        stage(latest => ({ ...latest, settings: { ...latest.settings,
          appearance: { ...latest.settings.appearance, [key]: value } } }), `appearance:${key}`);
      }
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Settings could not be applied.'); }
  }
  async function addLink(link: NewLink, containerId = 'home') {
    const resource = { ...link, id: crypto.randomUUID(), createdAt: Date.now() };
    const itemId = crypto.randomUUID();
    await mutate(latest => {
      const geometry = getWorkspaceGeometry(latest.settings.appearance.itemSize);
      if (containerId !== 'home' && !getFolderPath(latest, containerId)) throw new Error('Folder is unavailable.');
      const existing = toSpatialItems(latest.workspaceItems.filter(item => !item.trashedAt && item.containerId === containerId), geometry.itemSize, latest.projects, latest.folders);
      const position = findInitialPosition(existing, { ...geometry, height: Math.max(geometry.height, ...existing.map(item => item.y * GRID_SIZE + item.height + WORKSPACE_PADDING * 2)) + geometry.itemSize + GRID_SIZE });
      return { ...latest, links: [...latest.links, resource], workspaceItems: [...latest.workspaceItems,
        { id: itemId, type: 'link', linkId: resource.id, containerId, ...position }] };
    });
  }
  async function moveItem(id: string, position: GridPosition, displayGeometry?: WorkspaceGeometry) {
    await mutate(latest => {
      const viewport = getWorkspaceGeometry(latest.settings.appearance.itemSize);
      const geometry = { ...viewport, height: Math.max(viewport.height, displayGeometry?.height ?? 0) };
      const item = latest.workspaceItems.find(entry => entry.id === id);
      if (!item || item.trashedAt || !isValidPosition(position,
        toSpatialItems(latest.workspaceItems.filter(entry => !entry.trashedAt && entry.containerId === item.containerId), geometry.itemSize, latest.projects, latest.folders),
        geometry, id, getWorkspaceItemDimensions(item, geometry.itemSize, latest.projects, latest.folders))) throw new Error('This position is unavailable.');
      return { ...latest, workspaceItems: latest.workspaceItems.map(entry => entry.id === id ? { ...entry, x: position.x, y: position.y } : entry) };
    });
  }
  async function createProject(draft: ProjectDraft): Promise<Project> {
    const next = await mutate(latest => buildProject(latest, draft).data);
    return next.projects.find(project => project.id === draft.id)!;
  }
  async function ensureProjectCanvas(projectId: string, viewport: { width: number; height: number }) {
    await mutate(latest => ensureProjectCanvasState(ensureProjectCanvasLinks(latest, projectId), projectId, viewport));
  }
  async function moveProjectCanvasItem(projectId: string, id: string, x: number, y: number) {
    await mutate(latest => moveProjectCanvasLink(latest, projectId, id, x, y));
  }
  async function addProjectWidget(projectId: string, type: 'note' | 'todo' | 'resource' | 'web-data' | 'clip' | 'compare' | 'rss' | 'formula' | 'page-watch' | 'text', position: { x: number; y: number }) {
    await mutate(latest => buildWidget(latest, projectId, type, position));
  }
  async function updateProjectWidget(id: string, config: ProjectWidgetConfig) {
    await mutate(latest => changeWidget(latest, id, config));
  }
  async function trashProjectCanvasItems(projectId: string, ids: string[]) {
    await mutate(latest => removeCanvasItems(latest, projectId, ids));
  }
  async function duplicateProjectCanvasItem(projectId: string, id: string, config?: ProjectWidgetConfig) {
    let newId = '';
    await mutate(latest => { const duplicate = copyCanvasItem(latest, projectId, id, config); newId = duplicate.id; return duplicate.data; });
    return newId;
  }
  async function moveProjectCanvasItems(projectId: string, ids: string[], anchorId: string, dx: number, dy: number) {
    await mutate(latest => moveProjectCanvasGroup(latest, projectId, ids, anchorId, dx, dy));
  }
  async function resizeProjectCanvasItem(projectId: string, id: string, width: number, height: number, minSize?: { width: number; height: number }) {
    await mutate(latest => changeCanvasSize(latest, projectId, id, width, height, minSize));
  }
  async function setProjectCanvasZoom(projectId: string, zoom: ProjectCanvasZoom) {
    await mutate(latest => changeCanvasZoom(latest, projectId, zoom));
  }
  async function setProjectColor(id: string, color: ProjectColor) {
    await mutate(latest => changeProjectColor(latest, id, color));
  }
  async function deleteProject(id: string) {
    await mutate(latest => trashProject(latest, id));
  }
  async function moveItems(changes: WorkspacePositionChange[], displayGeometry?: WorkspaceGeometry) {
    await mutate(latest => {
      const viewport = getWorkspaceGeometry(latest.settings.appearance.itemSize);
      const geometry = { ...viewport, width: Math.max(viewport.width, displayGeometry?.width ?? 0), height: Math.max(viewport.height, displayGeometry?.height ?? 0) };
      return { ...latest, workspaceItems: updateWorkspacePositions(latest.workspaceItems, changes, geometry, latest.projects, latest.folders) };
    });
  }
  async function updateProject(id: string, patch: Pick<Project, 'name' | 'linkIds'> & Pick<ProjectDraft, 'projectLinks'>) {
    const before = current.current.projects.find(project => project.id === id);
    const nameChanged = patch.name !== before?.name;
    const linksChanged = JSON.stringify(patch.linkIds) !== JSON.stringify(before?.linkIds);
    const next = await mutate(latest => {
      const project = latest.projects.find(entry => entry.id === id);
      if (!project) throw new Error('Project not found.');
      return changeProject(latest, id, { ...patch, name: nameChanged ? patch.name : project.name,
        linkIds: linksChanged ? patch.linkIds : project.linkIds });
    });
    return next.projects.find(project => project.id === id)!;
  }
  async function addProjectToHome(id: string) {
    await mutate(latest => placeProject(latest, id, getWorkspaceGeometry(latest.settings.appearance.itemSize)));
  }
  async function createFolder(draft: FolderDraft, containerId = 'home') {
    await mutate(latest => buildFolder(latest, draft, getWorkspaceGeometry(latest.settings.appearance.itemSize), containerId));
  }
  async function setFolderColor(id: string, color: ProjectColor) {
    await mutate(latest => changeFolderColor(latest, id, color));
  }
  async function updateFolder(id: string, patch: FolderPatch) {
    if (patch.name !== undefined && patch.icon === undefined && patch.color === undefined) stage(latest => changeFolder(latest, id, patch), `folder:${id}:name`);
    else await mutate(latest => changeFolder(latest, id, patch));
  }
  async function transferItems(ids: string[], containerId: string, displayedPositions?: WorkspacePositionChange[]) {
    await mutate(latest => transferWorkspaceItems(latest, ids, containerId, getWorkspaceGeometry(latest.settings.appearance.itemSize), displayedPositions));
  }
  async function trashItems(ids: string[]) {
    await mutate(latest => trashWorkspaceItems(latest, ids));
  }
  async function restoreItem(target: TrashTarget | string) {
    await mutate(latest => restoreTrashEntry(latest, target, getWorkspaceGeometry(latest.settings.appearance.itemSize)));
  }
  async function importBookmarks(request: BookmarkImportRequest) {
    let summary: BookmarkImportSummary;
    await mutate(async latest => {
      const result = await buildBookmarkImport(latest, request, getWorkspaceGeometry(latest.settings.appearance.itemSize));
      summary = result.summary; return result.data;
    }, { checkCapacity: true, writeFailureMessage: 'Bookmarks could not be saved. The workspace is unchanged. Please try again.' });
    return summary!;
  }

  return { data, projects: getProjects(data), ready, bootStatus, error: loadError || saveError, loadError, retryLoad,
    setAppearance, flushSettings, addLink, moveItem, moveItems, createProject, updateProject, setProjectColor,
    createFolder, setFolderColor, updateFolder, transferItems, trashItems, restoreItem, importBookmarks, addProjectToHome, deleteProject,
    ensureProjectCanvas, moveProjectCanvasItem, setProjectCanvasZoom, resizeProjectCanvasItem, moveProjectCanvasItems, addProjectWidget, updateProjectWidget, trashProjectCanvasItems, duplicateProjectCanvasItem };
}
