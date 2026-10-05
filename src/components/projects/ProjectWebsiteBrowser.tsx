import { t, useLocale } from "../../i18n";
import { useEffect, useState } from 'react';
import type { Folder } from '../../domain/folder';
import type { Link } from '../../domain/link';
import type { WorkspaceItem } from '../../domain/workspace';
import type { SortableSourceHandlers } from '../../hooks/useSortableDrag';
import { normalizeUrl } from '../../utils/url';
import { FolderIcon } from '../FolderIcon';
import { ExistingLinks } from './ExistingLinks';

// A folder must be reachable through live placements from Home.
export function projectWebsiteContainers(items: WorkspaceItem[], folders: Folder[]): Set<string> {
  const live = new Set(folders.filter(folder => !folder.trashedAt).map(folder => folder.id));
  const reachable = new Set(['home']);
  const pending = ['home'];
  while (pending.length) {
    const parent = pending.pop()!;
    for (const item of items) {
      if (item.type !== 'folder' || item.trashedAt || item.containerId !== parent || !live.has(item.folderId) || reachable.has(item.folderId)) continue;
      reachable.add(item.folderId); pending.push(item.folderId);
    }
  }
  return reachable;
}
export function projectWebsiteKey(link: Link): string { return normalizeUrl(link.url) ?? link.url; }

export function ProjectWebsiteBrowser({ links, allLinks, items, folders, selectedIds, onSelect, disabled, draggedId, getDragHandlers }: {
  links: Link[]; allLinks: Link[]; items: WorkspaceItem[]; folders: Folder[]; selectedIds: string[];
  onSelect: (link: Link) => void; disabled: boolean; draggedId?: string;
  getDragHandlers: (id: string) => SortableSourceHandlers;
}) {
  useLocale();
  const [path, setPath] = useState<string[]>([]);
  const containerId = path.at(-1) ?? 'home';
  const reachable = projectWebsiteContainers(items, folders);
  useEffect(() => {
    // If a placement is removed or reparented, return to the live root.
    let parent = 'home';
    for (const id of path) {
      if (!folders.some(folder => folder.id === id && !folder.trashedAt) ||
          !items.some(item => item.type === 'folder' && !item.trashedAt && item.folderId === id && item.containerId === parent)) {
        setPath([]); return;
      }
      parent = id;
    }
  }, [items, folders, path]);
  const placements = items.filter(item => !item.trashedAt && item.containerId === containerId && reachable.has(containerId));
  const folderIds = new Set(placements.flatMap(item => item.type === 'folder' && !path.includes(item.folderId) ? [item.folderId] : []));
  const childFolders = folders.filter(folder => !folder.trashedAt && folderIds.has(folder.id));
  const ids = new Set(placements.flatMap(item => item.type === 'link' ? [item.linkId] : []));
  const choices = new Map<string, Link>();
  for (const link of links) {
    if (!ids.has(link.id) || link.projectId) continue;
    const key = projectWebsiteKey(link), previous = choices.get(key);
    if (!previous || selectedIds.includes(link.id)) choices.set(key, link);
  }
  const selectedUrls = new Set(allLinks.filter(link => selectedIds.includes(link.id)).map(projectWebsiteKey));
  const displayed = [...choices.values()];
  return <section className="project-website-browser">
    <nav className="project-website-breadcrumb" aria-label={t("Website folders")}>
      <button type="button" className="text-button" disabled={disabled || !!draggedId} onClick={() => setPath([])}>{t("Home")}</button>
      {path.map((id, index) => {
        const folder = folders.find(folder => folder.id === id);
        return folder && <span key={id}><span aria-hidden="true"> / </span>
          <button type="button" className="text-button" aria-label={folder.name || 'Folder'} disabled={disabled || !!draggedId}
            onClick={() => setPath(path.slice(0, index + 1))}>{folder.name || <FolderIcon icon={folder.icon} />}</button>
        </span>;
      })}
      {path.length > 0 && <button type="button" className="text-button" disabled={disabled || !!draggedId} onClick={() => setPath(path.slice(0, -1))}>{t("← Back")}</button>}
    </nav>
    {childFolders.length > 0 && <div className="project-website-folders"><h2>{t("Folders")}</h2>
      <div className="project-website-folder-grid">{childFolders.map(folder => <button key={folder.id} type="button"
        className="project-website-folder" aria-label={folder.name ? t("Open {0}", { 0: folder.name }) : t("Open folder")} title={folder.name || 'Open folder'}
        disabled={disabled || !!draggedId} onClick={() => setPath([...path, folder.id])}>
        <FolderIcon icon={folder.icon} />{folder.name && <span>{folder.name}</span>}
      </button>)}</div>
    </div>}
    <ExistingLinks links={displayed} selectedIds={displayed.filter(link => selectedUrls.has(projectWebsiteKey(link))).map(link => link.id)}
      heading="Websites" emptyMessage="No websites in this folder." onSelect={onSelect} disabled={disabled} draggedId={draggedId} getDragHandlers={getDragHandlers} />
  </section>;
}
