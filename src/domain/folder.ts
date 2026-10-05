import type { ProjectColor } from './projectColor';

// Persist only a stable Lucide name, never component or SVG data.
export type FolderIcon = string;
export interface Folder {
  id: string;
  name: string;
  icon: FolderIcon;
  color: ProjectColor;
  widthTier: 1 | 2;
  createdAt: number;
  updatedAt: number;
  trashedAt?: number;
}
export type FolderDraft = Pick<Folder, 'name' | 'icon' | 'color'>;
export type FolderPatch = Partial<FolderDraft>;
