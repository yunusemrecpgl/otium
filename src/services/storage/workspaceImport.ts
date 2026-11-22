import type { OtiumData } from '../../domain/data';
import { NOTEBOOK_MAX_DOCUMENT_DEPTH } from '../../domain/notebook';
import { PROJECT_CANVAS_LIMITS } from '../../constants/projectCanvas';
import { LEGACY_WORKSPACE_SCHEMA_VERSION, SCHEMA_VERSION } from './migrations';
import { parseSupportedData } from './recovery';

export const MAX_WORKSPACE_FILE_BYTES = 32 * 1024 * 1024;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function sameWorkspaceValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((value, i) => sameWorkspaceValue(value, b[i]));
  if (!record(a) || !record(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameWorkspaceValue(a[key], b[key]));
}

function boundJson(value: unknown) {
  const notebook = record(value) && record(value.notebook) ? value.notebook : undefined;
  const notebookDocuments = new Set<unknown>();
  for (const collection of [notebook?.pages, notebook?.templates]) {
    if (!Array.isArray(collection)) continue;
    for (const entry of collection) if (record(entry) && record(entry.content)) notebookDocuments.add(entry.content);
  }
  let count = 0;
  function visit(entry: unknown, depth: number, limit = 64) {
    if (++count > 1_000_000 || depth > limit) throw new Error('This workspace is too complex to import safely.');
    if (typeof entry === 'number' && !Number.isFinite(entry)) throw new Error('This workspace contains invalid numbers.');
    // Each Notebook node adds a content-array edge as well as a node edge.
    // Leave four more edges for the deepest node's marks and attributes.
    const childLimit = depth === 4 && notebookDocuments.has(entry) ? depth + 2 * NOTEBOOK_MAX_DOCUMENT_DEPTH + 4 : limit;
    if (entry && typeof entry === 'object') for (const child of Object.values(entry)) visit(child, depth + 1, childLimit);
  }
  visit(value, 0);
}

export function validateWorkspaceImport(value: unknown): OtiumData {
  boundJson(value);
  if (!record(value) || (value.schemaVersion !== SCHEMA_VERSION && value.schemaVersion !== LEGACY_WORKSPACE_SCHEMA_VERSION)) {
    throw new Error('This workspace file is incomplete or uses an unsupported schema.');
  }
  const data = parseSupportedData(value);
  // Project references and geometry are resolved at runtime. Keep records
  // hidden by that view, as well as old canvas dimensions (inert metadata).
  const projects = new Set(data.projects.map(project => project.id));
  const folders = new Set(data.folders.map(folder => folder.id));
  const parents = new Map<string, string>();
  const invalidReference = () => new Error('This workspace contains invalid or missing references.');
  for (const item of data.workspaceItems) {
    if (item.containerId !== 'home' && !folders.has(item.containerId)) throw invalidReference();
    if (item.type === 'project' && !projects.has(item.projectId)) continue;
    if (item.x < 0 || item.y < 0 || item.x > PROJECT_CANVAS_LIMITS.coordinate || item.y > PROJECT_CANVAS_LIMITS.coordinate) {
      throw new Error('This workspace contains invalid item geometry.');
    }
    if (item.type === 'folder') {
      if (!folders.has(item.folderId) || parents.has(item.folderId)) throw invalidReference();
      parents.set(item.folderId, item.containerId);
    }
  }
  const resolved = new Set(['home']);
  for (const id of folders) {
    const path = new Set<string>();
    let current = id;
    while (!resolved.has(current)) {
      const parent = parents.get(current);
      if (!parent || path.has(current)) throw new Error('This workspace contains an invalid folder hierarchy.');
      path.add(current);
      current = parent;
    }
    for (const folder of path) resolved.add(folder);
  }
  return data;
}

export async function readWorkspaceImport(file: File) {
  if (file.size > MAX_WORKSPACE_FILE_BYTES) throw new Error('This workspace file is too large.');
  let envelope: unknown;
  try { envelope = JSON.parse(await file.text()); }
  catch { throw new Error('This file could not be read as workspace JSON.'); }
  if (!record(envelope) || envelope.type !== 'otium-workspace' || envelope.exportVersion !== 1 ||
      !record(envelope.data) || envelope.schemaVersion !== envelope.data.schemaVersion) {
    throw new Error('Choose a supported Otium Workspace export.');
  }
  const date = typeof envelope.exportedAt === 'number' ? new Date(envelope.exportedAt) : null;
  return { data: validateWorkspaceImport(envelope.data), exportedAt: date && Number.isFinite(date.getTime()) ? date : null };
}
