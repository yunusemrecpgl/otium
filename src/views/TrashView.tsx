import { useState } from 'react';
import type { OtiumData } from '../domain/data';
import { FolderIcon } from '../components/FolderIcon';
import { TrashIcon } from '../components/navigation/Icons';
import { LinkFavicon } from '../components/LinkFavicon';
import { WidgetIcon } from '../components/widgets/WidgetIcon';
import { WidgetRegistry } from '../services/widgetRegistry';
import { getTrashEntries } from '../services/trash';
import type { TrashTarget } from '../services/trash';
import { isProjectCanvasPlacement } from '../services/projectCanvasValidation';

export function TrashView({ data, onRestore }: { data: OtiumData; onRestore: (target: TrashTarget) => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entries = getTrashEntries(data);
  return <main className="trash-view" aria-labelledby="trash-title">
    <h1 id="trash-title">Trash</h1>
    {!entries.length && <p className="muted">Trash is empty.</p>}
    <ul className="trash-entries">{entries.map(entry => {
      const placement = entry.type === 'workspace' ? data.workspaceItems.find(item => item.id === entry.id) : undefined;
      const canvas = entry.type === 'canvas' ? data.projectCanvasItems.find(item => isProjectCanvasPlacement(item) && item.id === entry.id) : undefined;
      const linkId = canvas?.type === 'link' ? canvas.referenceId : placement?.type === 'link' ? placement.linkId : undefined;
      const link = linkId ? data.links.find(link => link.id === linkId) : undefined;
      const projectId = entry.type === 'project' ? entry.id : canvas?.projectId ?? (placement?.type === 'project' ? placement.projectId : undefined);
      const project = projectId ? data.projects.find(project => project.id === projectId) : undefined;
      const folderId = entry.type === 'folder' ? entry.id : placement?.type === 'folder' ? placement.folderId : undefined;
      const folder = folderId ? data.folders.find(folder => folder.id === folderId) : undefined;
      const widget = canvas?.type === 'widget' ? data.widgetInstances.find(widget => widget.id === canvas.referenceId) : undefined;
      const widgetName = widget ? WidgetRegistry.get(widget.type)?.name ?? widget.type : undefined;
      const widgetTitle = typeof widget?.config.title === 'string' ? widget.config.title.trim() : '';
      const title = canvas ? link?.title ?? (widgetTitle || widgetName || 'Canvas item') : link?.title ?? project?.name ?? folder?.name ?? '';
      const label = title.trim() || (folder ? `${folder.icon} folder` : placement?.type ?? entry.type);
      const kind = canvas ? widgetName ?? (canvas.type === 'link' ? 'Link' : 'Widget')
        : entry.type === 'project' ? 'Project' : entry.type === 'folder' ? 'Folder' : placement?.type === 'project' ? 'Project shortcut' : placement?.type === 'folder' ? 'Folder' : 'Link';
      const ownerUnavailable = !!canvas && (!project || !!project.trashedAt);
      const key = `${entry.type}:${entry.id}`;
      return <li key={key}>
        <span className="trash-entry-icon">{folder ? <FolderIcon icon={folder.icon} /> : link ? <LinkFavicon title={link.title} url={link.url} /> : widget ? <WidgetIcon type={widget.type} /> : <TrashIcon />}</span>
        <span className="trash-entry-text"><span title={label}>{label}</span><small>{kind}{canvas && ` · ${project?.name ?? 'Unavailable Project'}`}{ownerUnavailable && ' · Restore Project first'}</small></span>
        <button type="button" disabled={busy !== null || ownerUnavailable} aria-label={`Restore ${label}`} onClick={async () => {
          if (busy) return; setBusy(key); setError(null);
          try { await onRestore(entry); }
          catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not restore this item.'); }
          finally { setBusy(null); }
        }}>{busy === key ? 'Restoring…' : 'Restore'}</button>
      </li>;
    })}</ul>
    {error && <p className="form-error" role="alert">{error}</p>}
  </main>;
}
