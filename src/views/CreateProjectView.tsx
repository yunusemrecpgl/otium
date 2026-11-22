import { t, useLocale } from "../i18n";
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Link } from '../domain/link';
import type { Project, ProjectDraft } from '../domain/project';
import { addDraftProjectLink, removeDraftLink, selectDraftLink } from '../services/projectDraft';
import { ProjectSlotbar } from '../components/projects/ProjectSlotbar';
import { ProjectWebsiteBrowser, projectWebsiteContainers, projectWebsiteKey } from '../components/projects/ProjectWebsiteBrowser';
import type { Folder } from '../domain/folder';
import type { WorkspaceItem } from '../domain/workspace';
import { ProjectLinkForm } from '../components/projects/ProjectLinkForm';
import { SortableDragPreview } from '../components/projects/SortableDragPreview';
import { useSortableDrag } from '../hooks/useSortableDrag';
import { insertOrMoveId } from '../utils/sortable';
import { SORTABLE_ITEM_WIDTH, SORTABLE_ITEM_HEIGHT, SORTABLE_ITEM_GAP } from '../constants/sortable';

const sortableStyle: CSSProperties & Record<string, string> = {
  '--sortable-item-width': `${SORTABLE_ITEM_WIDTH}px`,
  '--sortable-item-height': `${SORTABLE_ITEM_HEIGHT}px`,
  '--sortable-item-gap': `${SORTABLE_ITEM_GAP}px`,
};

interface CreateProjectViewProps {
  folders: Folder[];
  workspaceItems: WorkspaceItem[];
  links: Link[];
  availableLinks: Link[];
  initialProject: Project;
  onCreate: (draft: ProjectDraft) => Promise<Project>;
  onCancel: () => void;
  onComplete: (project: Project) => void;
  onSavingChange: (saving: boolean) => void;
}

export function CreateProjectView({ links, availableLinks, folders, workspaceItems, initialProject, onCreate, onCancel, onComplete, onSavingChange }: CreateProjectViewProps) {
  useLocale();
  const [draft, setDraft] = useState(() => ({
    id: initialProject.id, name: initialProject.name, linkIds: [...initialProject.linkIds],
    projectLinks: links.filter(link => link.projectId === initialProject.id && initialProject.linkIds.includes(link.id)),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const containers = projectWebsiteContainers(workspaceItems, folders);
  const activeIds = new Set(workspaceItems.flatMap(item => item.type === 'link' && !item.trashedAt && containers.has(item.containerId) ? [item.linkId] : []));
  const globalLinks = [...new Map(availableLinks.filter(link => !link.projectId && activeIds.has(link.id)).map(link => [link.id, link])).values()];
  const resolvedLinks = [...links.filter(link => !link.projectId), ...draft.projectLinks];
  const { drag, zoneRef, getSourceHandlers, onScroll, zoneHandlers } = useSortableDrag({
    disabled: busy,
    onInsert: (id, index) => setDraft((current) => {
      if (!globalLinks.some((link) => link.id === id) && !current.projectLinks.some((link) => link.id === id) && !current.linkIds.includes(id)) return current;
      const source = globalLinks.find(link => link.id === id);
      const equivalent = source && resolvedLinks.find(link => current.linkIds.includes(link.id) && projectWebsiteKey(link) === projectWebsiteKey(source));
      return { ...current, linkIds: insertOrMoveId(current.linkIds, equivalent?.id ?? id, index) };
    }),
    onRemove: (id) => setDraft((current) => removeDraftLink(current, id)),
  });

  useEffect(() => { stepHeading.current?.focus(); }, []);

  async function finish() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    onSavingChange(true);
    try {
      const project = await onCreate(draft);
      onComplete(project);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Project could not be saved. Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
      onSavingChange(false);
    }
  }

  return (
    <main className="create-project-view" style={sortableStyle}>
      <header className="creation-header">
        <span className="eyebrow">{t("Edit project websites")}</span>
        <button type="button" className="text-button" onClick={onCancel} disabled={busy || !!drag}>{t("Cancel")}</button>
      </header>
        <div key="builder" className={`project-builder page-enter-forward${drag ? ' is-sortable-dragging' : ''}`}>
          <div className="builder-heading">
            <div><p className="eyebrow">{t("Project links")}</p><h1 ref={stepHeading} tabIndex={-1}>{draft.name}</h1></div>
            <button type="button" className="quiet-button" onClick={() => void finish()} disabled={busy || !!drag}>{busy ? t("Saving…") : t("Save Changes")}</button>
          </div>
          <ProjectSlotbar linkIds={draft.linkIds} links={resolvedLinks} onRemove={(id) => setDraft((current) => removeDraftLink(current, id))} disabled={busy} zoneRef={zoneRef} drag={drag} getDragHandlers={(id) => getSourceHandlers(id, 'list')} onScroll={onScroll} zoneHandlers={zoneHandlers} />
          <div className="builder-regions">
            <ProjectWebsiteBrowser links={globalLinks} allLinks={resolvedLinks} folders={folders} items={workspaceItems} selectedIds={draft.linkIds}
              onSelect={link => setDraft(current => {
                const equivalent = resolvedLinks.find(entry => current.linkIds.includes(entry.id) && projectWebsiteKey(entry) === projectWebsiteKey(link));
                return selectDraftLink(current, equivalent ?? link);
              })} disabled={busy} draggedId={drag?.id} getDragHandlers={id => getSourceHandlers(id, 'external')} />
            <ProjectLinkForm onAdd={(title, url) => setDraft(addDraftProjectLink(draft, title, url))} disabled={busy || !!drag} />
          </div>
          {error && <p className="form-error" role="alert">{t(error)}</p>}
          <footer className="builder-footer"><button type="button" className="text-button" disabled={busy || !!drag} onClick={onCancel}>{t("← Back")}</button></footer>
        </div>
      <SortableDragPreview drag={drag} link={resolvedLinks.find((link) => link.id === drag?.id)} />
    </main>
  );
}

