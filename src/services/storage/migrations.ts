import { normalizeTextStyle, isTextConfig } from '../../domain/text';
import { isPageWatchConfig, migratePageWatchConfig } from '../../domain/pageWatch';
import { isFormulaConfig } from '../../domain/formula';
import type { OtiumData } from '../../domain/data';
import type { BookmarkImportMetadata } from '../../domain/importedBookmarks';
import type { Link } from '../../domain/link';
import type { WorkspaceItem } from '../../domain/workspace';
import type { Project } from '../../domain/project';
import type { ProjectCanvasItem } from '../../domain/projectCanvasItem';
import type { ProjectCanvasState } from '../../domain/projectCanvasState';
import { normalizeProjectCanvasZoom } from '../../domain/projectCanvasState';
import type { WidgetInstance, WidgetConfigValue } from '../../domain/widget';
import { isTodoConfig } from '../../domain/todo';
import { isResourceConfig } from '../../domain/resource';
import { isWebDataConfig } from '../../domain/webData';
import { isClipConfig } from '../../domain/clip';
import { isCompareConfig } from '../../domain/compare';
import { isRssConfig } from '../../domain/rss';
import { normalizeFolderIcon } from '../../utils/folderIcons';
import type { Folder } from '../../domain/folder';
import { isProjectColor } from '../../domain/projectColor';
import { DEFAULT_SETTINGS, normalizeItemSize } from '../../domain/settings';
import type { UserSettings } from '../../domain/settings';
import { normalizeUrl } from '../../utils/url';
import { preserveWidgetConfig } from '../widgetConfig';
import { browserLocale, isLocale } from '../../i18n/locale';

export const STORAGE_KEY = 'persistentData';
export const SCHEMA_VERSION = 2;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function trashMetadata(value: Record<string, unknown>): { trashedAt?: number } {
  if (value.trashedAt === undefined) return {};
  if (typeof value.trashedAt !== 'number' || !Number.isFinite(value.trashedAt) || value.trashedAt <= 0) throw new Error('Stored trash metadata is invalid. Original data has been preserved.');
  return { trashedAt: value.trashedAt };
}

export function parseSettings(value: unknown, oldTheme?: unknown): UserSettings {
  const settings = record(value);
  const appearance = record(settings?.appearance);
  const capabilities = record(settings?.widgetCapabilities);
  const widgetCapabilities = capabilities ? Object.fromEntries(Object.entries(capabilities).flatMap(([type, state]) => {
    const entry = record(state);
    return typeof entry?.enabled === 'boolean' ? [[type, { enabled: entry.enabled }]] : [];
  })) : undefined;
  const size = appearance?.itemSize;
  const theme = appearance?.theme ?? oldTheme;
  return {
    ...(widgetCapabilities ? { widgetCapabilities } : {}),
    appearance: {
      language: isLocale(appearance?.language) ? appearance.language : browserLocale(),
      itemSize: normalizeItemSize(size),
      theme: theme === 'light' || theme === 'dark' || theme === 'system'
        ? theme : DEFAULT_SETTINGS.appearance.theme,
    },
  };
}

export function hasCanonicalStoredSettings(value: unknown, settings: UserSettings): boolean {
  const storedSettings = record(record(value)?.settings);
  const appearance = record(storedSettings?.appearance);
  return appearance?.itemSize === settings.appearance.itemSize &&
    appearance?.theme === settings.appearance.theme && appearance?.language === settings.appearance.language;
}

function parseLinks(value: unknown): Link[] {
  if (!Array.isArray(value)) throw new Error('Stored links are invalid. Original data has been preserved.');
  const ids = new Set<string>();
  return value.map((entry) => {
    const link = record(entry);
    if (!link || typeof link.id !== 'string' || !link.id || ids.has(link.id) ||
        typeof link.title !== 'string' || !link.title.trim() ||
        typeof link.url !== 'string' || !normalizeUrl(link.url) ||
        typeof link.createdAt !== 'number' || !Number.isFinite(link.createdAt)) {
      throw new Error('Stored links contain invalid or duplicate records. Original data has been preserved.');
    }
    ids.add(link.id);
    return {
      id: link.id, title: link.title, url: link.url, createdAt: link.createdAt,
      ...(typeof link.updatedAt === 'number' ? { updatedAt: link.updatedAt } : {}),
      ...(typeof link.projectId === 'string' ? { projectId: link.projectId } : {}),
    };
  });
}

function parseItems(value: unknown, links: Link[]): WorkspaceItem[] {
  if (!Array.isArray(value)) throw new Error('Stored workspace is invalid. Original data has been preserved.');
  const ids = new Set<string>();
  return value.map((entry) => {
    const item = record(entry);
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) ||
        !Number.isSafeInteger(item.x) || !Number.isSafeInteger(item.y)) {
      throw new Error('Stored workspace contains invalid references or positions. Original data has been preserved.');
    }
    ids.add(item.id);
    const containerId = item.containerId === undefined ? 'home' : item.containerId;
    if (typeof containerId !== 'string' || !containerId) throw new Error('Stored workspace container is invalid.');
    const position = { id: item.id, containerId, x: item.x as number, y: item.y as number, ...trashMetadata(item) };
    if (item.type === 'folder' && typeof item.folderId === 'string' && item.folderId) {
      return { ...position, type: 'folder', folderId: item.folderId };
    }
    if (item.type === 'project' && typeof item.projectId === 'string' && item.projectId) {
      if (item.trashedWithProject !== undefined && typeof item.trashedWithProject !== 'boolean') throw new Error('Stored Project trash metadata is invalid.');
      // Retain orphan placements; Home skips unresolved projects without deletion.
      return { ...position, type: 'project', projectId: item.projectId,
        ...(typeof item.trashedWithProject === 'boolean' ? { trashedWithProject: item.trashedWithProject } : {}) };
    }
    if (item.type === 'link' && typeof item.linkId === 'string' &&
        links.some((link) => link.id === item.linkId && !link.projectId)) {
      return { ...position, type: 'link', linkId: item.linkId };
    }
    throw new Error('Stored workspace contains invalid references or positions. Original data has been preserved.');
  });
}

export function parseCurrentData(value: unknown): OtiumData {
  const data = record(value);
  if (!data || data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error('Unsupported storage schema. Original data has been preserved.');
  }
  const links = parseLinks(data.links);
  const projects = parseProjects(data.projects, links);
  if (links.some((link) => link.projectId && !projects.some((project) => project.id === link.projectId))) {
    throw new Error('A stored link references a missing project. Original data has been preserved.');
  }
  return {
    schemaVersion: SCHEMA_VERSION, links, projects, folders: parseFolders(data.folders),
    workspaceItems: parseItems(data.workspaceItems, links),
    projectCanvasItems: parseProjectCanvasItems(data.projectCanvasItems),
    projectCanvasStates: parseProjectCanvasStates(data.projectCanvasStates),
    widgetInstances: parseWidgetInstances(data.widgetInstances),
    settings: parseSettings(data.settings),
    ...(data.bookmarkImports === undefined ? {} : { bookmarkImports: parseBookmarkImports(data.bookmarkImports) }),
  };
}

function parseBookmarkImports(value: unknown): BookmarkImportMetadata[] {
  if (!Array.isArray(value)) throw new Error('Stored bookmark import metadata is invalid. Original data has been preserved.');
  const fingerprints = new Set<string>();
  return value.map(entry => {
    const metadata = record(entry);
    if (!metadata || typeof metadata.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(metadata.fingerprint) ||
        fingerprints.has(metadata.fingerprint) || typeof metadata.importedAt !== 'number' ||
        !Number.isFinite(metadata.importedAt) || metadata.importedAt <= 0 ||
        !Number.isSafeInteger(metadata.bookmarks) || (metadata.bookmarks as number) < 1 ||
        !Number.isSafeInteger(metadata.folders) || (metadata.folders as number) < 0) {
      throw new Error('Stored bookmark import metadata is invalid. Original data has been preserved.');
    }
    fingerprints.add(metadata.fingerprint);
    return { fingerprint: metadata.fingerprint, importedAt: metadata.importedAt,
      bookmarks: metadata.bookmarks as number, folders: metadata.folders as number };
  });
}

export function migrateLegacyData(values: Record<string, unknown>): OtiumData {
  const legacy = values.links ?? [];
  const links = parseLinks(legacy);
  // IDs and grid coordinates remain unchanged; the sidebar is never included.
  const workspaceItems = parseItems((legacy as Record<string, unknown>[]).map((item) => ({
    id: item.id, type: 'link', linkId: item.id, x: item.x, y: item.y,
  })), links);
  return { schemaVersion: SCHEMA_VERSION, links, projects: [], folders: [], workspaceItems, projectCanvasItems: [], projectCanvasStates: [], widgetInstances: [], settings: parseSettings(undefined, values.theme) };
}

function isWidgetConfig(value: unknown): value is WidgetConfigValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isWidgetConfig);
  const object = record(value);
  return !!object && Object.values(object).every(isWidgetConfig);
}

function parseWidgetInstances(value: unknown): WidgetInstance[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Stored widgets are invalid. Original data has been preserved.');
  const ids = new Set<string>();
  return value.map(entry => {
    const widget = record(entry), config = record(widget?.config);
    if (!widget || typeof widget.id !== 'string' || !widget.id || ids.has(widget.id) ||
        typeof widget.type !== 'string' || !widget.type || !Number.isSafeInteger(widget.version) || (widget.version as number) < 1 ||
        typeof widget.createdAt !== 'number' || !Number.isFinite(widget.createdAt) ||
        typeof widget.updatedAt !== 'number' || !Number.isFinite(widget.updatedAt) || !config || !isWidgetConfig(config) ||
        (widget.type === 'note' && (typeof config.title !== 'string' || typeof config.text !== 'string')) ||
        (widget.type === 'todo' && !isTodoConfig(config)) || (widget.type === 'resource' && !isResourceConfig(config)) ||
        (widget.type === 'web-data' && !isWebDataConfig(config)) || (widget.type === 'clip' && !isClipConfig(config)) ||
        (widget.type === 'compare' && !isCompareConfig(config)) || (widget.type === 'rss' && !isRssConfig(config)) || (widget.type === 'formula' && !isFormulaConfig(config)) || (widget.type === 'page-watch' && !isPageWatchConfig(config)) || (widget.type === 'text' && !isTextConfig(config))) {
      throw new Error('Stored widgets are invalid. Original data has been preserved.');
    }
    ids.add(widget.id);
    const stored = config as Record<string, WidgetConfigValue>;
    const pageWatch = widget.type === 'page-watch' && isPageWatchConfig(config) ? migratePageWatchConfig(config) : null;
    const { style: pageWatchStyle, ...pageWatchValues } = pageWatch ?? {};
    const migrated = pageWatch ? preserveWidgetConfig('page-watch', stored,
      { ...stored, ...pageWatchValues, fields: pageWatch.fields!.map(field => ({ ...field })),
        ...(pageWatchStyle ? { style: { ...normalizeTextStyle(pageWatchStyle) } } : {}) } as Record<string, WidgetConfigValue>) : stored;
    if (pageWatch) { delete migrated.currentValue; delete migrated.previousValue; delete migrated.lastChangedAt; }
    return { id: widget.id, type: widget.type, version: pageWatch ? Math.max(widget.version as number, 4) : widget.version as number,
      config: migrated,
      createdAt: widget.createdAt, updatedAt: widget.updatedAt };
  });
}

function parseProjectCanvasStates(value: unknown): ProjectCanvasState[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Stored Project canvas states are invalid. Original data has been preserved.');
  const ids = new Set<string>();
  return value.map(entry => {
    const state = record(entry);
    if (!state || typeof state.projectId !== 'string' || !state.projectId || ids.has(state.projectId) ||
        typeof state.width !== 'number' || !Number.isFinite(state.width) || state.width <= 0 ||
        typeof state.height !== 'number' || !Number.isFinite(state.height) || state.height <= 0) {
      throw new Error('Stored Project canvas states contain invalid or duplicate records. Original data has been preserved.');
    }
    ids.add(state.projectId);
    return { projectId: state.projectId, width: state.width, height: state.height, zoom: normalizeProjectCanvasZoom(state.zoom) };
  });
}

function parseProjectCanvasItems(value: unknown): ProjectCanvasItem[] {
  // Additive schema-2 field; existing Projects need no generated placements.
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Stored Project canvas items are invalid. Original data has been preserved.');
  // Record-level tolerance: retain malformed/orphaned records verbatim for
  // recovery. Canvas consumers validate identities and normalize geometry at
  // runtime; normal load must not rewrite the collection or generate new IDs.
  return value.slice() as ProjectCanvasItem[];
}

function parseFolders(value: unknown): Folder[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Stored folders are invalid. Original data has been preserved.');
  const ids = new Set<string>();
  return value.map(entry => {
    const folder = record(entry);
    if (!folder || typeof folder.id !== 'string' || !folder.id || folder.id === 'home' || ids.has(folder.id) ||
      typeof folder.name !== 'string' || typeof folder.icon !== 'string' ||
      !isProjectColor(folder.color) || (folder.widthTier !== 1 && folder.widthTier !== 2) ||
      typeof folder.createdAt !== 'number' || !Number.isFinite(folder.createdAt) ||
      typeof folder.updatedAt !== 'number' || !Number.isFinite(folder.updatedAt)) throw new Error('Stored folders are invalid. Original data has been preserved.');
    ids.add(folder.id);
    return { id: folder.id, name: folder.name, icon: normalizeFolderIcon(folder.icon), color: folder.color,
      widthTier: folder.widthTier, createdAt: folder.createdAt, updatedAt: folder.updatedAt, ...trashMetadata(folder) };
  });
}

export function hasCanonicalContainers(value: unknown): boolean {
  const data = record(value);
  return Array.isArray(data?.folders) && Array.isArray(data?.widgetInstances) && Array.isArray(data?.projectCanvasStates) && Array.isArray(data?.projectCanvasItems) && Array.isArray(data?.workspaceItems) &&
    data.workspaceItems.every(entry => typeof record(entry)?.containerId === 'string');
}

function parseProjects(value: unknown, links: Link[]): Project[] {
  // Additive schema-2 field: older snapshots have no Projects yet.
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Stored projects are invalid. Original data has been preserved.');
  const ids = new Set<string>();
  return value.map((entry) => {
    const project = record(entry);
    if (!project || typeof project.id !== 'string' || !project.id || ids.has(project.id) ||
        typeof project.name !== 'string' || !project.name.trim() ||
        typeof project.createdAt !== 'number' || !Number.isFinite(project.createdAt) ||
        typeof project.updatedAt !== 'number' || !Number.isFinite(project.updatedAt) ||
        !Array.isArray(project.linkIds) || new Set(project.linkIds).size !== project.linkIds.length ||
        project.linkIds.some((id) => typeof id !== 'string' || !id ||
          links.some((link) => link.id === id && link.projectId && link.projectId !== project.id))) {
      throw new Error('Stored projects contain invalid records or link references. Original data has been preserved.');
    }
    ids.add(project.id);
    return {
      id: project.id, name: project.name, linkIds: project.linkIds as string[],
      createdAt: project.createdAt, updatedAt: project.updatedAt,
      ...(isProjectColor(project.color) ? { color: project.color } : {}),
      ...trashMetadata(project),
    };
  });
}
