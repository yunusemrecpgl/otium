export interface Link {
  id: string;
  title: string;
  url: string;
  createdAt: number;
  updatedAt?: number;
  // Omitted for global links; a project-only link names its owning project.
  projectId?: string;
}

export type NewLink = Pick<Link, 'title' | 'url'>;
