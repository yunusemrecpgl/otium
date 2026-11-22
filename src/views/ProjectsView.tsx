import { t, useLocale } from "../i18n";
import { useRef, useState } from 'react';
import type { Link } from '../domain/link';
import type { Project } from '../domain/project';
import { LinkFavicon } from '../components/LinkFavicon';
import { resolveProjectLinks } from '../utils/projectLinks';
import { PROJECT_PREVIEW_LIMIT } from '../constants/project';
import { preloadProjectPage } from '../services/projectPageLoader';

interface ProjectsViewProps {
  projects: Project[];
  links: Link[];
  onOpen: (project: Project) => void;
  ready: boolean;
  onCreate: (baseName: string) => Promise<Project>;
  onSavingChange: (saving: boolean) => void;
}

export function ProjectsView({ projects, links, onOpen, ready, onCreate, onSavingChange }: ProjectsViewProps) {
  useLocale();
  const [creating, setCreating] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');

  async function create() {
    if (pending.current) return;
    pending.current = true;
    setCreating(true);
    setError('');
    onSavingChange(true);
    try { onOpen(await onCreate(t('Untitled Work'))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Project could not be saved. Please try again.'); }
    finally { pending.current = false; setCreating(false); onSavingChange(false); }
  }

  const activeProjects = projects.filter(project => !project.trashedAt);

  return (
    <main className="secondary-view projects-view">
      <div className="projects-heading">
        <h1>{t("Projects")}</h1>
        <button type="button" className="quiet-button" disabled={!ready || creating} onClick={() => void create()}><span aria-hidden="true">+</span> {creating ? t("Creating…") : t("New Project")}</button>
      </div>
      {ready && activeProjects.length === 0 && <p className="muted">{t("No projects yet.")}</p>}
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <ul className="projects-list">
        {activeProjects.map((project) => {
          const resolved = resolveProjectLinks(project, links);
          return (
          <li key={project.id}>
            <button type="button" className="project-list-item project-navigation-button" onPointerEnter={preloadProjectPage} onFocus={preloadProjectPage} onClick={() => onOpen(project)} aria-label={t("Open project {0}", { 0: project.name })}>
            <span className="project-list-name" title={project.name}>{project.name}</span>
            <span className="project-preview-row" aria-label={t("{0} links", { 0: resolved.length })}>
              {resolved.slice(0, PROJECT_PREVIEW_LIMIT).map((link) => (
                <span key={link.id} className="project-preview-icon" title={link.title}><LinkFavicon key={link.url} title={link.title} url={link.url} /></span>
              ))}
              {resolved.length > PROJECT_PREVIEW_LIMIT && <span className="muted preview-overflow">+{resolved.length - PROJECT_PREVIEW_LIMIT}</span>}
              {resolved.length === 0 && <span className="muted preview-overflow">{t("No links")}</span>}
            </span>
            </button>
          </li>
          );
        })}
      </ul>
    </main>
  );
}
