import type { Folder } from '../domain/folder';
import type { WorkspaceItem } from '../domain/workspace';
import { useEffect, useRef, useState } from 'react';
import type { Link } from '../domain/link';
import type { Project, ProjectDraft } from '../domain/project';
import { LinkFavicon } from '../components/LinkFavicon';
import { CreateProjectView } from './CreateProjectView';
import { resolveProjectLinks } from '../utils/projectLinks';
import { PROJECT_PREVIEW_LIMIT } from '../constants/project';
import { preloadProjectPage } from '../services/projectPageLoader';

interface ProjectsViewProps {
  folders: Folder[];
  workspaceItems: WorkspaceItem[];
  projects: Project[];
  links: Link[];
  availableLinks: Link[];
  onOpen: (project: Project) => void;
  ready: boolean;
  onCreate: (draft: ProjectDraft) => Promise<Project>;
  onSavingChange: (saving: boolean) => void;
}

export function ProjectsView({ folders, workspaceItems, projects, links, availableLinks, onOpen, ready, onCreate, onSavingChange }: ProjectsViewProps) {
  const [creating, setCreating] = useState(false);
  const [returning, setReturning] = useState(false);
  const newButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (returning) newButton.current?.focus();
  }, [creating, returning]);

  function closeCreation() {
    setReturning(true);
    setCreating(false);
  }

  if (creating) return <CreateProjectView folders={folders} workspaceItems={workspaceItems} links={links} availableLinks={availableLinks} onCreate={onCreate} onCancel={closeCreation} onComplete={onOpen} onSavingChange={onSavingChange} />;
  const activeProjects = projects.filter(project => !project.trashedAt);

  return (
    <main className={`secondary-view projects-view${returning ? ' page-enter-back' : ''}`}>
      <div className="projects-heading">
        <h1>Projects</h1>
        <button ref={newButton} type="button" className="quiet-button" disabled={!ready} onClick={() => { setReturning(false); setCreating(true); }}><span aria-hidden="true">+</span> New Project</button>
      </div>
      {ready && activeProjects.length === 0 && <p className="muted">No projects yet.</p>}
      <ul className="projects-list">
        {activeProjects.map((project) => {
          const resolved = resolveProjectLinks(project, links);
          return (
          <li key={project.id}>
            <button type="button" className="project-list-item project-navigation-button" onPointerEnter={preloadProjectPage} onFocus={preloadProjectPage} onClick={() => onOpen(project)} aria-label={`Open project ${project.name}`}>
            <span className="project-list-name" title={project.name}>{project.name}</span>
            <span className="project-preview-row" aria-label={`${resolved.length} links`}>
              {resolved.slice(0, PROJECT_PREVIEW_LIMIT).map((link) => (
                <span key={link.id} className="project-preview-icon" title={link.title}><LinkFavicon key={link.url} title={link.title} url={link.url} /></span>
              ))}
              {resolved.length > PROJECT_PREVIEW_LIMIT && <span className="muted preview-overflow">+{resolved.length - PROJECT_PREVIEW_LIMIT}</span>}
              {resolved.length === 0 && <span className="muted preview-overflow">No links</span>}
            </span>
            </button>
          </li>
          );
        })}
      </ul>
    </main>
  );
}
