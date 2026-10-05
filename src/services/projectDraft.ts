import type { Link } from '../domain/link';
import type { ProjectDraft } from '../domain/project';
import { normalizeUrl } from '../utils/url';

export function createProjectDraft(): ProjectDraft {
  return { id: crypto.randomUUID(), name: '', linkIds: [], projectLinks: [] };
}

export function selectDraftLink(draft: ProjectDraft, link: Link): ProjectDraft {
  if (link.projectId && link.projectId !== draft.id) throw new Error('This link belongs to another project.');
  return draft.linkIds.includes(link.id) ? removeDraftLink(draft, link.id)
    : { ...draft, linkIds: [...draft.linkIds, link.id] };
}

export function removeDraftLink(draft: ProjectDraft, id: string): ProjectDraft {
  return {
    ...draft,
    linkIds: draft.linkIds.filter((linkId) => linkId !== id),
    projectLinks: draft.projectLinks.filter((link) => link.id !== id),
  };
}

export function addDraftProjectLink(draft: ProjectDraft, title: string, inputUrl: string): ProjectDraft {
  const url = normalizeUrl(inputUrl);
  if (!title.trim() || !url) throw new Error('Enter a site name and a valid HTTP or HTTPS URL.');
  const link: Link = {
    id: crypto.randomUUID(), title: title.trim(), url,
    projectId: draft.id, createdAt: Date.now(),
  };
  return {
    ...draft, linkIds: [...draft.linkIds, link.id],
    projectLinks: [...draft.projectLinks, link],
  };
}
