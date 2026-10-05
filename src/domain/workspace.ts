export interface BaseWorkspaceItem {
  id: string;
  containerId: string;
  trashedAt?: number;
  x: number;
  y: number;
}

export interface LinkWorkspaceItem extends BaseWorkspaceItem {
  type: 'link';
  linkId: string;
}

export interface ProjectWorkspaceItem extends BaseWorkspaceItem {
  type: 'project';
  projectId: string;
  // Distinguishes domain deletion from an independently trashed shortcut.
  trashedWithProject?: boolean;
}

export interface FolderWorkspaceItem extends BaseWorkspaceItem {
  type: 'folder';
  folderId: string;
}

export type WorkspaceItem = LinkWorkspaceItem | ProjectWorkspaceItem | FolderWorkspaceItem;
