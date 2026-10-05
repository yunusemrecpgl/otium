import { t, useLocale } from "../i18n";
import { useState } from 'react';
import type { OtiumData } from '../domain/data';
import { FolderIcon } from '../components/FolderIcon';
import { TrashIcon } from '../components/navigation/Icons';
import { LinkFavicon } from '../components/LinkFavicon';
import { WidgetIcon } from '../components/widgets/WidgetIcon';
import { WidgetRegistry } from '../services/widgetRegistry';
import { getTrashEntries, hasPermanentTrash } from '../services/trash';
import { EmptyTrashDialog } from '../components/EmptyTrashDialog';
import type { TrashTarget } from '../services/trash';
import { isProjectCanvasPlacement } from '../services/projectCanvasValidation';

export function TrashView({ data, onRestore, onEmpty }: { data: OtiumData; onRestore: (target: TrashTarget) => Promise<void>; onEmpty: () => Promise<void> }) {
  useLocale();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const entries = getTrashEntries(data);
  return <main className="trash-view" aria-labelledby="trash-title">
    <h1 id="trash-title">{t("Trash")}</h1>
    {hasPermanentTrash(data) && <button type="button" className="project-destructive-action" disabled={busy !== null} onClick={() => setConfirmEmpty(true)}>{t("Empty Trash")}</button>}
    {confirmEmpty && <EmptyTrashDialog onCancel={() => setConfirmEmpty(false)} onBusyChange={value => setBusy(value ? 'empty' : null)} onEmpty={async () => { await onEmpty(); setConfirmEmpty(false); }} />}
    {!entries.length && <p className="muted">{t("Trash is empty.")}</p>}
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
      const widgetName = widget ? t(WidgetRegistry.get(widget.type)?.name ?? widget.type) : undefined;
      const widgetTitle = typeof widget?.config.title === 'string' ? widget.config.title.trim() : '';
      const title = canvas ? link?.title ?? (widgetTitle || widgetName || t('Canvas item')) : link?.title ?? project?.name ?? folder?.name ?? '';
      const label = title.trim() || (folder ? `${folder.icon} folder` : placement?.type ?? entry.type);
      const kind = canvas ? widgetName ?? (canvas.type === 'link' ? t("Link") : t("Widget"))
        : entry.type === 'project' ? t("Project") : entry.type === 'folder' ? t("Folder") : placement?.type === 'project' ? t("Project shortcut") : placement?.type === 'folder' ? t("Folder") : t("Link");
      const ownerUnavailable = !!canvas && (!project || !!project.trashedAt);
      const key = `${entry.type}:${entry.id}`;
      return <li key={key}>
        <span className="trash-entry-icon">{folder ? <FolderIcon icon={folder.icon} /> : link ? <LinkFavicon title={link.title} url={link.url} /> : widget ? <WidgetIcon type={widget.type} /> : <TrashIcon />}</span>
        <span className="trash-entry-text"><span title={label}>{label}</span><small>{kind}{canvas && ` · ${project?.name ?? t('Unavailable Project')}`}{ownerUnavailable && ' · ' + t('Restore Project first')}</small></span>
        <button type="button" disabled={busy !== null || ownerUnavailable} aria-label={t("Restore {0}", { 0: label })} onClick={async () => {
          if (busy) return; setBusy(key); setError(null);
          try { await onRestore(entry); }
          catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not restore this item.")); }
          finally { setBusy(null); }
        }}>{busy === key ? t("Restoring…") : t("Restore")}</button>
      </li>;
    })}</ul>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
  </main>;
}
