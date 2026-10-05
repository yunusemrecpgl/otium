import type { OtiumData } from '../domain/data';
import type { Project, ProjectDraft } from '../domain/project';
import type { ProjectColor } from '../domain/projectColor';
import type { Link } from '../domain/link';
import { normalizeUrl } from '../utils/url';
import { ensureProjectCanvasLinks } from './projectCanvas';
import { restoreProjectCanvasItem } from './projectCanvasTrash';
import { isProjectCanvasPlacement } from './projectCanvasValidation';

export function getProjects(data: OtiumData): Project[] {
  return data.projects.filter(project => !project.trashedAt);
}

function validateReferences(projectId: string, linkIds: string[], links: Link[]) {
  if (new Set(linkIds).size !== linkIds.length) throw new Error('A project cannot contain duplicate link references.');
  for (const id of linkIds) {
    const link = links.find((entry) => entry.id === id);
    if (!link || (link.projectId && link.projectId !== projectId)) {
      throw new Error('A selected link is unavailable or belongs to another project.');
    }
  }
}

// Build one logical transaction. useOtiumData persists it through the shared queue.
export function createProject(data: OtiumData, draft: ProjectDraft): { data: OtiumData; project: Project } {
  const name = draft.name.trim();
  if (!draft.id || !name) throw new Error('A project name is required.');
  const existing = data.projects.find((project) => project.id === draft.id);
  if (existing) return { data, project: existing }; // Retry-safe stable draft identity.
  const existingIds = new Set(data.links.map((link) => link.id));
  for (const link of draft.projectLinks) {
    if (!link.id || existingIds.has(link.id) || link.projectId !== draft.id ||
        !draft.linkIds.includes(link.id) || !link.title.trim() || !normalizeUrl(link.url) ||
        !Number.isFinite(link.createdAt)) {
      throw new Error('The project draft contains an invalid link.');
    }
    existingIds.add(link.id);
  }
  const links = [...data.links, ...draft.projectLinks];
  validateReferences(draft.id, draft.linkIds, links);
  const now = Date.now();
  const project: Project = { id: draft.id, name, linkIds: [...draft.linkIds], createdAt: now, updatedAt: now };
  return { data: ensureProjectCanvasLinks({ ...data, links, projects: [...data.projects, project] }, project.id), project };
}

export function updateProject(data: OtiumData, id: string, patch: Pick<Project, 'name' | 'linkIds'> & { projectLinks?: Link[] }): OtiumData {
  const existing = data.projects.find((project) => project.id === id && !project.trashedAt);
  if (!existing) throw new Error('Project not found.');
  const name = patch.name.trim();
  if (!name) throw new Error('A project name is required.');
  const links = [...data.links];
  const draftIds = new Set<string>();
  for (const link of patch.projectLinks ?? []) {
    if (!link.id || draftIds.has(link.id) || link.projectId !== id || !patch.linkIds.includes(link.id) ||
        !link.title.trim() || !normalizeUrl(link.url) || !Number.isFinite(link.createdAt)) throw new Error('The project draft contains an invalid link.');
    draftIds.add(link.id);
    const stored = links.find(entry => entry.id === link.id);
    if (stored && stored.projectId !== id) throw new Error('This link belongs to another project.');
    if (!stored) links.push(link);
  }
  validateReferences(id, patch.linkIds, links);
  // Preserve every owned resource: removing its reference does not delete Link data.
  const trashedAt = Date.now();
  let next: OtiumData = { ...data, links,
    projectCanvasItems: data.projectCanvasItems.map(item => isProjectCanvasPlacement(item) && item.projectId === id && item.type === 'link' && !item.trashedAt && !patch.linkIds.includes(item.referenceId)
      ? { ...item, trashedAt } : item),
    projects: data.projects.map((project) => project.id === id
      ? { ...project, name, linkIds: [...patch.linkIds], updatedAt: trashedAt } : project) };
  for (const linkId of patch.linkIds.filter(linkId => !existing.linkIds.includes(linkId))) {
    const hasActivePlacement = next.projectCanvasItems.some(item => isProjectCanvasPlacement(item) && item.projectId === id && item.type === 'link' && item.referenceId === linkId && !item.trashedAt);
    const previousPlacement = !hasActivePlacement && next.projectCanvasItems.find(item => isProjectCanvasPlacement(item) && item.projectId === id && item.type === 'link' && item.referenceId === linkId && item.trashedAt);
    if (previousPlacement) next = restoreProjectCanvasItem(next, previousPlacement.id);
  }
  return ensureProjectCanvasLinks(next, id);
}

export function setProjectColor(data: OtiumData, id: string, color: ProjectColor): OtiumData {
  if (!data.projects.some(project => project.id === id && !project.trashedAt)) throw new Error('Project not found.');
  return { ...data, projects: data.projects.map(project => project.id === id
    ? { ...project, color, updatedAt: Date.now() } : project) };
}

export function deleteProject(data: OtiumData, id: string): OtiumData {
  if (!data.projects.some(project => project.id === id && !project.trashedAt)) throw new Error('Project not found.');
  const trashedAt = Date.now();
  return {
    ...data,
    projects: data.projects.map(project => project.id === id ? { ...project, trashedAt, updatedAt: trashedAt } : project),
    workspaceItems: data.workspaceItems.map(item => item.type === 'project' && item.projectId === id && !item.trashedAt
      ? { ...item, trashedAt, trashedWithProject: true } : item),
  };
}
