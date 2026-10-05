import type { Link } from './link';
import type { ProjectColor } from './projectColor';

export interface Project {
  id: string;
  name: string;
  // Order is meaningful; resources are referenced rather than copied.
  linkIds: string[];
  createdAt: number;
  updatedAt: number;
  color?: ProjectColor;
  trashedAt?: number;
}

// Never persisted until creation is complete.
export interface ProjectDraft {
  id: string;
  name: string;
  linkIds: string[];
  projectLinks: Link[];
}
