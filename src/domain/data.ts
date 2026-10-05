import type { Link } from './link';
import type { UserSettings } from './settings';
import type { WorkspaceItem } from './workspace';
import type { Project } from './project';
import type { Folder } from './folder';
import type { ProjectCanvasItem } from './projectCanvasItem';
import type { ProjectCanvasState } from './projectCanvasState';
import type { WidgetInstance } from './widget';
import type { BookmarkImportMetadata } from './importedBookmarks';

export interface OtiumData {
  schemaVersion: 2;
  links: Link[];
  projects: Project[];
  folders: Folder[];
  workspaceItems: WorkspaceItem[];
  projectCanvasItems: ProjectCanvasItem[];
  projectCanvasStates: ProjectCanvasState[];
  widgetInstances: WidgetInstance[];
  settings: UserSettings;
  bookmarkImports?: BookmarkImportMetadata[];
}
