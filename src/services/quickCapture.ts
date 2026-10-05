import type { OtiumData } from '../domain/data';
import type { Link } from '../domain/link';
import type { CurrentPage } from './currentTab';
import { dataRepository } from './storage';
import { createFolder, updateFolder } from './folders';
import { updateProject } from './projects';
import { getFolderPath } from '../utils/folderHierarchy';
import { normalizeUrl } from '../utils/url';
import { findInitialPosition, getWorkspaceItemDimensions, toSpatialItems, workspaceGeometryForViewport } from '../utils/workspace';
import { GRID_SIZE, WORKSPACE_PADDING } from '../constants/grid';
import type { PageSelection } from './selectedText';
import { assertWidgetCreationAccess } from './widgetCapabilities';
import { permissionService } from './permissions';
import { addProjectWidget, updateProjectWidget } from './projectWidgets';
import { nextProjectCanvasPosition } from './projectCanvas';

function geometry(data: OtiumData, page: CurrentPage) {
  return workspaceGeometryForViewport(page.width, page.height, data.settings.appearance.itemSize);
}
function sameUrl(link: Link, page: CurrentPage) { return normalizeUrl(link.url) === normalizeUrl(page.url); }

export function isPageCaptured(data: OtiumData, page: CurrentPage, destination: { containerId: string } | { projectId: string }): boolean {
  const ids = new Set(data.links.filter(link => sameUrl(link, page)).map(link => link.id));
  if ('projectId' in destination) {
    const project = data.projects.find(project => project.id === destination.projectId && !project.trashedAt);
    return Boolean(project?.linkIds.some(id => ids.has(id)));
  }
  return data.workspaceItems.some(item => item.type === 'link' && !item.trashedAt && item.containerId === destination.containerId && ids.has(item.linkId));
}

function capture(data: OtiumData, page: CurrentPage, destination: { containerId: string } | { projectId: string }): OtiumData {
  const url = normalizeUrl(page.url);
  if (!url) throw new Error('This page cannot be saved.');
  if ('containerId' in destination && destination.containerId !== 'home' && !getFolderPath(data, destination.containerId)) throw new Error('Folder is unavailable.');
  const project = 'projectId' in destination ? data.projects.find(project => project.id === destination.projectId && !project.trashedAt) : undefined;
  if ('projectId' in destination && !project) throw new Error('Project is unavailable.');
  if (isPageCaptured(data, page, destination)) return data;
  // A captured project-owned resource becomes shared when used outside its owner.
  // Existing project references remain valid; the resource id stays unchanged.
  const existing = data.links.find(link => sameUrl(link, page) && !link.projectId) ??
    data.links.find(link => sameUrl(link, page));
  const link: Link = existing ?? {
    id: crypto.randomUUID(), title: page.title.trim() || new URL(url).hostname, url, createdAt: Date.now(),
    ...(project ? { projectId: project.id } : {}),
  };
  let next = existing ? data : { ...data, links: [...data.links, link] };
  if (existing?.projectId && existing.projectId !== project?.id) {
    const shared = { ...existing };
    delete shared.projectId;
    next = { ...data, links: data.links.map(entry => entry.id === shared.id ? shared : entry) };
  }
  if (project) return updateProject(next, project.id, { name: project.name, linkIds: [...project.linkIds, link.id] });
  const containerId = (destination as { containerId: string }).containerId;
  const viewport = geometry(data, page);
  const item = { id: crypto.randomUUID(), type: 'link' as const, linkId: link.id, containerId, x: 0, y: 0 };
  const occupied = toSpatialItems(data.workspaceItems.filter(item => !item.trashedAt && item.containerId === containerId), viewport.itemSize, data.projects, data.folders);
  const size = getWorkspaceItemDimensions(item, viewport.itemSize, data.projects, data.folders);
  const bottom = occupied.reduce((height, entry) => Math.max(height, WORKSPACE_PADDING * 2 + entry.y * GRID_SIZE + entry.height), viewport.height);
  const position = findInitialPosition(occupied, { ...viewport, height: bottom + size.height + GRID_SIZE }, size);
  return { ...next, workspaceItems: [...data.workspaceItems, { ...item, ...position }] };
}

export const quickCaptureService = {
  read: () => dataRepository.load(),
  subscribe: dataRepository.subscribe,
  addToHome: (page: CurrentPage) => dataRepository.mutate(data => capture(data, page, { containerId: 'home' })),
  addToFolder: (page: CurrentPage, containerId: string) => dataRepository.mutate(data => capture(data, page, { containerId })),
  addToProject: (page: CurrentPage, projectId: string) => dataRepository.mutate(data => capture(data, page, { projectId })),
  addSelectionToProject: (selection: PageSelection, projectId: string) => dataRepository.mutate(async data => {
    await assertWidgetCreationAccess(data, 'clip');
    if (!await permissionService.hasCapabilities(['active-page-capture'])) throw new Error('Page capture access is required.');
    if (!selection.text.trim() || !normalizeUrl(selection.sourceUrl)) throw new Error('Selected text is unavailable.');
    const created = addProjectWidget(data, projectId, 'clip', nextProjectCanvasPosition(data, projectId));
    const widget = created.widgetInstances[created.widgetInstances.length - 1];
    const next = updateProjectWidget(created, widget.id, {
      text: selection.text, originalText: selection.text, sourceUrl: selection.sourceUrl, sourceTitle: selection.sourceTitle,
      ...(selection.faviconUrl ? { faviconUrl: selection.faviconUrl } : {}),
      ...(selection.textFragmentUrl ? { textFragmentUrl: selection.textFragmentUrl } : {}),
    });
    return next;
  }),
  async createFolder(page: CurrentPage, containerId: string) {
    let folderId = '';
    const data = await dataRepository.mutate(latest => {
      const next = createFolder(latest, { name: '', icon: 'folder', color: 'neutral' }, geometry(latest, page), containerId);
      folderId = next.folders[next.folders.length - 1].id;
      return next;
    });
    return { data, folderId };
  },
  renameFolder: (id: string, name: string) => dataRepository.mutate(data => updateFolder(data, id, { name: name.trim() })),
};
