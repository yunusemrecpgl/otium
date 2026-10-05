import type { Link } from '../domain/link';
import type { Project } from '../domain/project';
import type { WorkspaceItem } from '../domain/workspace';

export function availableProjectLinks(links: Link[], items: WorkspaceItem[]): Link[] {
  const active = new Set(items.flatMap(item => item.type === 'link' && !item.trashedAt ? [item.linkId] : []));
  return links.filter(link => !link.projectId && active.has(link.id));
}

export function resolveProjectLinks(project: Project, links: Link[]): Link[] {
  const resources = new Map(links.map((link) => [link.id, link]));
  return project.linkIds.flatMap((id) => {
    const link = resources.get(id);
    return link && (!link.projectId || link.projectId === project.id) ? [link] : [];
  });
}
