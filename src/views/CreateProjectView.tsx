import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import type { Link } from '../domain/link';
import type { Project, ProjectDraft } from '../domain/project';
import { addDraftProjectLink, createProjectDraft, removeDraftLink, selectDraftLink } from '../services/projectDraft';
import { ProjectSteps } from '../components/projects/ProjectSteps';
import { ProjectIllustration } from '../components/projects/ProjectIllustration';
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
  initialProject?: Project;
  onCreate: (draft: ProjectDraft) => Promise<Project>;
  onCancel: () => void;
  onComplete: (project: Project) => void;
  onSavingChange: (saving: boolean) => void;
}

export function CreateProjectView({ links, availableLinks, folders, workspaceItems, initialProject, onCreate, onCancel, onComplete, onSavingChange }: CreateProjectViewProps) {
  const [draft, setDraft] = useState(() => initialProject ? {
    id: initialProject.id, name: initialProject.name, linkIds: [...initialProject.linkIds],
    projectLinks: links.filter(link => link.projectId === initialProject.id && initialProject.linkIds.includes(link.id)),
  } : createProjectDraft());
  const [step, setStep] = useState<1 | 2>(initialProject ? 2 : 1);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const containers = projectWebsiteContainers(workspaceItems, folders);
  const activeIds = new Set(workspaceItems.flatMap(item => item.type === 'link' && !item.trashedAt && containers.has(item.containerId) ? [item.linkId] : []));
  const globalLinks = [...new Map(availableLinks.filter(link => !link.projectId && activeIds.has(link.id)).map(link => [link.id, link])).values()];
  const resolvedLinks = [...links.filter(link => !link.projectId), ...draft.projectLinks];
  const { drag, zoneRef, getSourceHandlers, onScroll, zoneHandlers } = useSortableDrag({
    disabled: busy || step !== 2,
    onInsert: (id, index) => setDraft((current) => {
      if (!globalLinks.some((link) => link.id === id) && !current.projectLinks.some((link) => link.id === id) && !current.linkIds.includes(id)) return current;
      const source = globalLinks.find(link => link.id === id);
      const equivalent = source && resolvedLinks.find(link => current.linkIds.includes(link.id) && projectWebsiteKey(link) === projectWebsiteKey(source));
      return { ...current, linkIds: insertOrMoveId(current.linkIds, equivalent?.id ?? id, index) };
    }),
    onRemove: (id) => setDraft((current) => removeDraftLink(current, id)),
  });

  useEffect(() => {
    if (step === 1) nameInput.current?.focus();
    else stepHeading.current?.focus();
  }, [step]);

  function continueProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    setDraft((current) => ({ ...current, name: current.name.trim() }));
    setDirection('forward');
    setStep(2);
    setError(null);
  }

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
        {initialProject ? <span className="eyebrow">Edit project websites</span> : <ProjectSteps step={step} />}
        <button type="button" className="text-button" onClick={onCancel} disabled={busy || !!drag}>Cancel</button>
      </header>
      {step === 1 ? (
        <div key="identity" className={`project-identity page-enter-${direction}`}>
          <form className="project-name-form" onSubmit={continueProject}>
            <p className="eyebrow">{initialProject ? 'Edit project' : 'New project'}</p>
            <h1>Give your project a name</h1>
            <label htmlFor="project-name">Project name</label>
            <input ref={nameInput} id="project-name" placeholder="canmet.02" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required maxLength={120} autoComplete="off" />
            <button type="submit" className="quiet-button continue-button" disabled={!draft.name.trim()}>Continue <span aria-hidden="true">→</span></button>
          </form>
          <aside className="project-introduction">
            <ProjectIllustration />
            <h2>A place for your work</h2>
            <p>Keep the links for a piece of work together in one project.</p>
          </aside>
        </div>
      ) : (
        <div key="builder" className={`project-builder page-enter-forward${drag ? ' is-sortable-dragging' : ''}`}>
          <div className="builder-heading">
            <div><p className="eyebrow">Project links</p><h1 ref={stepHeading} tabIndex={-1}>{draft.name}</h1></div>
            <button type="button" className="quiet-button" onClick={() => void finish()} disabled={busy || !!drag}>{busy ? (initialProject ? 'Saving…' : 'Creating…') : (initialProject ? 'Save Changes' : 'Create Project')}</button>
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
          {error && <p className="form-error" role="alert">{error}</p>}
          <footer className="builder-footer"><button type="button" className="text-button" disabled={busy || !!drag} onClick={() => {
            if (initialProject) { onCancel(); return; }
            setDirection('back'); setStep(1);
          }}>← Back</button></footer>
        </div>
      )}
      <SortableDragPreview drag={drag} link={resolvedLinks.find((link) => link.id === drag?.id)} />
    </main>
  );
}

