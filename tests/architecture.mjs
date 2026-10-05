import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const output = path.resolve('node_modules/.tmp/otium-architecture-tests');
function compile(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const sourcePath = path.join(directory, entry.name);
    if (entry.isDirectory()) compile(sourcePath);
    else if (entry.name.endsWith('.ts')) {
      const relative = path.relative('src', sourcePath);
      const target = path.join(output, relative.replace(/\.ts$/, '.mjs'));
      const code = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
      }).outputText.replace(/from '([^']+)'/g, (_, specifier) =>
        `from '${specifier === 'react' ? '../react-mock' : specifier}.mjs'`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, code);
    }
  }
}
compile('src');
fs.writeFileSync(path.join(output, 'react-mock.mjs'), `
let slots = [], cursor = 0, effects = [];
export function useState(initial) {
  const index = cursor++;
  if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
  return [slots[index].value, value => {
    slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
  }];
}
export function useRef(value) {
  const index = cursor++;
  return slots[index] ??= { current: value };
}
export function useEffect(effect, deps) {
  const index = cursor++;
  const previous = slots[index];
  if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) {
    effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
  }
}
export function render(hook) {
  cursor = 0; effects = [];
  const result = hook();
  for (const effect of effects) effect();
  return result;
}
export function reset() {
  for (const slot of slots) slot?.cleanup?.();
  slots = []; effects = [];
}
`);
const load = file => import(pathToFileURL(path.join(output, file)).href);
const { createDataRepository } = await load('services/storage.mjs');
const { migrateLegacyData, parseSettings, parseCurrentData } = await load('services/storage/migrations.mjs');
const settingsDomain = await load('domain/settings.mjs');
const legacy = [
  { id: 'a', type: 'link', title: 'GitHub', url: 'https://github.com/', x: 4, y: 3, createdAt: 10 },
  { id: 'b', type: 'link', title: 'Docs', url: 'https://example.com/', x: 7, y: 3, createdAt: 20 },
];
let values = { links: structuredClone(legacy), theme: 'dark' };
let writes = 0;
let reads = 0;
let failWrites = false;
const provider = {
  async read(keys) { reads++; return structuredClone(Object.fromEntries(keys.map(key => [key, values[key]]))); },
  async write(update) {
    if (failWrites) throw new Error('Simulated storage failure');
    writes++; Object.assign(values, structuredClone(update));
  },
};
const repository = createDataRepository(provider);
const [migrated, duplicateLoad] = await Promise.all([repository.load(), repository.load()]);
assert.deepEqual(migrated, duplicateLoad);
assert.equal(reads, 1);
assert.equal(writes, 1);
assert.equal(migrated.schemaVersion, 2);
assert.equal(migrated.settings.appearance.itemSize, 96);
assert.equal(migrated.settings.appearance.theme, 'dark');
assert.deepEqual(values.links, legacy);
assert.equal(values.theme, 'dark');
assert(!('x' in migrated.links[0]));
assert.deepEqual(migrated.workspaceItems[0], { id: 'a', type: 'link', linkId: 'a', x: 4, y: 3 });
assert.deepEqual(await createDataRepository(provider).load(), migrated);
assert.equal(writes, 1);
assert.deepEqual(parseCurrentData(migrated), migrated);
assert.deepEqual(parseSettings({ appearance: { itemSize: 119, theme: 'bad' } }), { appearance: { itemSize: 128, theme: 'system' } });
assert.deepEqual([82, 92, 104, 118].map(settingsDomain.normalizeItemSize), [96, 96, 96, 128]);
assert.deepEqual([-100, 64, 96, 128, 160, 999, Number.NaN, '96'].map(settingsDomain.normalizeItemSize),
  [64, 64, 96, 128, 160, 160, 96, 96]);
for (const size of [64, 96, 128, 160]) {
  assert.equal(settingsDomain.normalizeItemSize(size), size);
  assert.equal(size % 32, 0);
}

const legacySizeSnapshot = structuredClone(migrated);
legacySizeSnapshot.settings.appearance.itemSize = 82;
let normalizationWrites = 0;
const normalizationProvider = {
  async read() { return { persistentData: structuredClone(legacySizeSnapshot) }; },
  async write(update) { normalizationWrites++; Object.assign(legacySizeSnapshot, structuredClone(update.persistentData)); },
};
const normalizedRepository = createDataRepository(normalizationProvider);
const normalizedSnapshot = await normalizedRepository.load();
assert.equal(normalizedSnapshot.settings.appearance.itemSize, 96);
assert.equal(normalizationWrites, 1);
assert.deepEqual(normalizedSnapshot.workspaceItems, migrated.workspaceItems);
assert.equal((await normalizedRepository.load()).settings.appearance.itemSize, 96);
assert.equal(normalizationWrites, 1);
assert.equal((await createDataRepository(normalizationProvider).load()).settings.appearance.itemSize, 96);
assert.equal(normalizationWrites, 1);
assert.throws(() => migrateLegacyData({ links: [...legacy, legacy[0]] }));
assert.throws(() => migrateLegacyData({ links: [{ ...legacy[0], x: 0.5 }] }));
assert.throws(() => parseCurrentData({ ...migrated, schemaVersion: 3 }));
const invalidValues = { links: [{ ...legacy[0], url: 'javascript:alert(1)' }] };
let invalidWrites = 0;
await assert.rejects(createDataRepository({
  async read() { return invalidValues; },
  async write() { invalidWrites++; },
}).load());
assert.equal(invalidWrites, 0);

const geometry = await load('utils/workspace.mjs');
const viewport = { width: 800, height: 600, itemSize: 82 };
const spatial = geometry.toSpatialItems(migrated.workspaceItems, 82);
assert(geometry.wouldItemsOverlap({ x: 6, y: 3 }, spatial, { width: 82, height: 82 }, 'b'));
assert(!geometry.wouldItemsOverlap({ x: 6, y: 3 }, geometry.toSpatialItems(migrated.workspaceItems, 64), { width: 64, height: 64 }, 'b'));
assert(!geometry.isValidPosition({ x: 0, y: 0 }, [], viewport));
assert(!geometry.isValidPosition({ x: 22, y: 0 }, [], viewport));
assert.equal(geometry.findNearestFreePosition({ x: 0, y: 0 }, [], { width: 100, height: 100, itemSize: 82 }), null);
const crowded = [
  { id: 'a', type: 'link', linkId: 'a', x: 4, y: 3 },
  { id: 'b', type: 'link', linkId: 'b', x: 7, y: 3 },
];
const fitted = geometry.fitWorkspaceItems(crowded, { ...viewport, itemSize: 120 });
assert.equal(fitted[0].x, 4);
assert.notDeepEqual(fitted[1], crowded[1]);
const fittedSpatial = geometry.toSpatialItems(fitted, 120);
for (const item of fitted) assert(geometry.isValidPosition(item, fittedSpatial, { ...viewport, itemSize: 120 }, item.id));
assert.deepEqual(geometry.fitWorkspaceItems(fitted, { ...viewport, itemSize: 120 }), fitted);
assert.throws(() => geometry.fitWorkspaceItems(crowded, { width: 120, height: 120, itemSize: 120 }));
// Collision primitives accept heterogeneous dimensions for future item kinds.
assert(geometry.wouldItemsOverlap({ x: 5, y: 4 }, [{ id: 'large', x: 4, y: 3, width: 192, height: 128 }], { width: 64, height: 64 }));
assert.deepEqual(geometry.pixelsToGrid(148, 116), { x: 4, y: 3 });

const listeners = new Map();
const mediaListeners = new Set();
const media = {
  matches: false,
  addEventListener(_, listener) { mediaListeners.add(listener); },
  removeEventListener(_, listener) { mediaListeners.delete(listener); },
};
globalThis.window = {
  innerWidth: 852, innerHeight: 600,
  matchMedia() { return media; },
  addEventListener(name, listener) { listeners.set(name, listener); },
  removeEventListener(name) { listeners.delete(name); },
  setTimeout, clearTimeout,
};
globalThis.chrome = { storage: { local: { get: provider.read, set: provider.write } } };
assert.equal(geometry.getWorkspaceGeometry(120).width, 800);
const mock = await load('react-mock.mjs');
const { useTheme } = await load('hooks/useTheme.mjs');
assert.equal(mock.render(() => useTheme('system')), 'light');
media.matches = true;
for (const listener of mediaListeners) listener();
assert.equal(mock.render(() => useTheme('system')), 'dark');
assert.equal(mock.render(() => useTheme('light')), 'light');
mock.reset();
assert.equal(mediaListeners.size, 0);

const drain = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const { useOtiumData } = await load('hooks/useOtiumData.mjs');
let state = mock.render(useOtiumData);
await drain();
state = mock.render(useOtiumData);
assert(state.ready);
assert.equal(state.data.links.length, 2);
const initialWrites = writes;
const canonicalBeforeResize = structuredClone(state.data.workspaceItems);
state.setAppearance({ itemSize: 120 });
state = mock.render(useOtiumData);
assert.equal(state.data.settings.appearance.itemSize, 128);
assert.deepEqual(state.data.workspaceItems, canonicalBeforeResize);
assert.equal(writes, initialWrites); // Preview is immediate, storage is deferred.
state.flushSettings();
await drain();
state = mock.render(useOtiumData);
assert.equal(values.persistentData.settings.appearance.itemSize, 128);
const beforeMove = structuredClone(state.data.links);
await state.moveItem('a', { x: 12, y: 8 });
state = mock.render(useOtiumData);
assert.deepEqual(state.data.links, beforeMove);
assert.equal(values.persistentData.workspaceItems.find(item => item.id === 'a').x, 12);
await state.addLink({ title: 'New', url: 'https://example.org/' });
state = mock.render(useOtiumData);
assert.equal(state.data.links.length, 3);
const newResource = state.data.links.at(-1);
const newPlacement = state.data.workspaceItems.at(-1);
assert.notEqual(newResource.id, newPlacement.id);
assert.equal(newPlacement.linkId, newResource.id);
assert(!('x' in newResource));
assert(!('title' in newPlacement));
failWrites = true;
const beforeFailure = structuredClone(state.data);
await assert.rejects(state.moveItem('a', { x: 14, y: 8 }));
state = mock.render(useOtiumData);
assert.deepEqual(state.data, beforeFailure);
assert(state.error);
failWrites = false;
state.setAppearance({ theme: 'system' });
state.flushSettings();
await drain();
state = mock.render(useOtiumData);
assert.equal(values.persistentData.settings.appearance.theme, 'system');
assert.equal(values.theme, 'dark'); // Legacy preference is not modified.
assert.deepEqual(await createDataRepository(provider).load(), state.data);
mock.reset();

let rafCallback;
globalThis.requestAnimationFrame = callback => { rafCallback = callback; return 1; };
globalThis.cancelAnimationFrame = () => { rafCallback = undefined; };
const target = {
  parentElement: { getBoundingClientRect: () => ({ left: 52, top: 0 }) },
  getBoundingClientRect: () => ({ left: 200, top: 116 }),
  setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {},
};
const event = (x, y) => ({ button: 0, isPrimary: true, pointerId: 1, clientX: x, clientY: y, currentTarget: target, preventDefault() {} });
const { useSpatialDrag } = await load('hooks/useSpatialDrag.mjs');
const item = { id: 'drag', type: 'link', linkId: 'a', x: 4, y: 3 };
const options = { item, items: geometry.toSpatialItems([item], 120), itemSize: 120, onDrop: async (_, position) => { drops.push(position); } };
let drops = [];
let drag = mock.render(() => useSpatialDrag(options));
drag.handlers.onPointerDown(event(230, 136));
drag.handlers.onPointerMove(event(233, 136));
drag.handlers.onPointerUp(event(233, 136));
let prevented = false;
drag.handlers.onClick({ detail: 1, preventDefault() { prevented = true; }, stopPropagation() {} });
assert(!prevented);
assert.equal(drops.length, 0);
drag.handlers.onPointerDown(event(230, 136));
drag.handlers.onPointerMove(event(281, 177));
rafCallback();
drag = mock.render(() => useSpatialDrag(options));
assert.equal(drag.visual.left, 199);
assert.equal(drag.visual.top, 157);
assert(drag.visual.dragging);
const preview = drag.visual.target;
drag.handlers.onPointerUp(event(281, 177));
drag.handlers.onClick({ detail: 1, preventDefault() { prevented = true; }, stopPropagation() {} });
assert(prevented);
assert.deepEqual(drops, [preview]);
await drain();
drag = mock.render(() => useSpatialDrag(options));
drag.handlers.onPointerDown(event(230, 136));
drag.handlers.onPointerMove(event(300, 210));
drag.handlers.onPointerCancel(event(300, 210));
drag = mock.render(() => useSpatialDrag(options));
assert.equal(drag.visual.left, 148);
assert.equal(drag.visual.top, 116);
assert.equal(drops.length, 1);
prevented = false;
drag.handlers.onClick({ detail: 0, preventDefault() { prevented = true; }, stopPropagation() {} });
assert(!prevented);
mock.reset();

const drafts = await load('services/projectDraft.mjs');
const projectService = await load('services/projects.mjs');
const projectionUtils = await load('utils/workspaceProjection.mjs');
const canonical = [
  { id: 'fixed', x: 4, y: 4, width: 82, height: 82 },
  { id: 'right-link', x: 25, y: 4, width: 82, height: 82 },
  { id: 'right-project', x: 30, y: 8, width: 246, height: 82 },
];
const canonicalCopy = structuredClone(canonical);
const smallViewport = { width: 520, height: 320, itemSize: 82 };
const narrow = projectionUtils.projectWorkspaceToViewport(canonical, smallViewport);
assert.deepEqual(canonical, canonicalCopy);
assert.deepEqual(narrow.positions.get('fixed'), { x: 4, y: 4, projected: false });
assert(narrow.positions.get('right-link')?.projected);
assert(narrow.positions.get('right-project')?.projected);
assert(narrow.spatialItems.every(item => geometry.isValidPosition(item, narrow.spatialItems,
  { ...smallViewport, height: narrow.contentHeight }, item.id, item)));
assert.deepEqual(projectionUtils.projectWorkspaceToViewport(canonical, smallViewport).positions, narrow.positions);
const enlarged = projectionUtils.projectWorkspaceToViewport(canonical, { width: 1500, height: 900, itemSize: 82 });
assert(enlarged.spatialItems.every(item => item.x === canonical.find(original => original.id === item.id).x &&
  item.y === canonical.find(original => original.id === item.id).y));
const crowdedProjectionItems = Array.from({ length: 10 }, (_, index) => ({ id: `crowded-${index}`, x: 40 + index * 3, y: 4, width: 82, height: 82 }));
const extended = projectionUtils.projectWorkspaceToViewport(crowdedProjectionItems, { width: 240, height: 240, itemSize: 82 });
assert.equal(extended.positions.size, crowdedProjectionItems.length);
assert(extended.contentHeight > 240);
assert(extended.spatialItems.every(item => geometry.isValidPosition(item, extended.spatialItems,
  { width: 240, height: extended.contentHeight, itemSize: 82 }, item.id, item)));
const base = structuredClone(migrated);
let projectDraft = drafts.createProjectDraft();
const stableProjectId = projectDraft.id;
projectDraft = { ...projectDraft, name: '  Research  ' };
projectDraft = drafts.selectDraftLink(projectDraft, base.links[1]);
projectDraft = drafts.selectDraftLink(projectDraft, base.links[0]);
assert.deepEqual(projectDraft.linkIds, ['b', 'a']);
projectDraft = drafts.removeDraftLink(projectDraft, 'b');
projectDraft = drafts.selectDraftLink(projectDraft, base.links[1]);
assert.deepEqual(projectDraft.linkIds, ['a', 'b']);
projectDraft = drafts.addDraftProjectLink(projectDraft, ' Private Docs ', 'docs.example.org');
const owned = projectDraft.projectLinks[0];
assert.equal(owned.title, 'Private Docs');
assert.equal(owned.url, 'https://docs.example.org/');
assert.equal(owned.projectId, stableProjectId);
assert.equal(base.links.length, 2);
assert.equal(base.projects.length, 0);
assert.deepEqual(base.workspaceItems, migrated.workspaceItems);
assert.throws(() => drafts.addDraftProjectLink(projectDraft, ' ', 'example.org'));
assert.throws(() => drafts.addDraftProjectLink(projectDraft, 'Bad', 'javascript:alert(1)'));
assert.throws(() => drafts.selectDraftLink(projectDraft, { ...base.links[0], projectId: 'another-project' }));
const removedLocal = drafts.removeDraftLink(projectDraft, owned.id);
assert.equal(removedLocal.projectLinks.length, 0);
assert(!removedLocal.linkIds.includes(owned.id));
assert.deepEqual(base.links, migrated.links); // Draft cancellation/removal never mutates source data.
assert.equal(projectDraft.id, stableProjectId);
assert.equal(projectDraft.name, '  Research  '); // Step navigation uses the same draft.

const built = projectService.createProject(base, projectDraft);
assert.equal(built.project.color, undefined);
const colored = projectService.setProjectColor(built.data, built.project.id, 'teal');
assert.equal(colored.projects[0].color, 'teal');
assert.equal(parseCurrentData(colored).projects[0].color, 'teal');
assert.equal(parseCurrentData({ ...colored, projects: colored.projects.map(project => ({ ...project, color: 'unknown' })) }).projects[0].color, undefined);
assert.equal(built.data.projects[0].color, undefined);
assert.equal(built.project.name, 'Research');
assert.deepEqual(built.project.linkIds, ['a', 'b', owned.id]);
assert.equal(built.data.projects.length, 1);
assert.equal(built.data.links.length, 3);
assert.deepEqual(built.data.workspaceItems, base.workspaceItems);
assert.deepEqual(built.data.links.filter(link => !link.projectId), base.links);
assert.equal(projectService.createProject(built.data, projectDraft).data.projects.length, 1);
assert.deepEqual(projectService.getProjects(built.data), [built.project]);
assert.deepEqual(parseCurrentData(built.data), built.data);
const oldV2 = structuredClone(base);
delete oldV2.projects;
assert.deepEqual(parseCurrentData(oldV2).projects, []);
assert.throws(() => projectService.createProject(base, { ...projectDraft, name: ' ' }));
assert.throws(() => projectService.createProject(base, { ...projectDraft, linkIds: ['missing'] }));
assert.throws(() => projectService.createProject(base, { ...projectDraft, linkIds: ['a', 'a'] }));
assert.throws(() => projectService.createProject(base, {
  ...projectDraft, projectLinks: [{ ...owned, projectId: 'another-project' }],
}));
const orphaned = structuredClone(built.data);
orphaned.projects = [];
assert.throws(() => parseCurrentData(orphaned));
const badPlacement = structuredClone(built.data);
badPlacement.workspaceItems.push({ id: 'bad-placement', type: 'link', linkId: owned.id, x: 10, y: 10 });
assert.throws(() => parseCurrentData(badPlacement));
const emptyProject = projectService.createProject(base, { ...drafts.createProjectDraft(), name: 'Empty' });
assert.deepEqual(emptyProject.project.linkIds, []);
const updated = projectService.updateProject(built.data, built.project.id, { name: 'Renamed', linkIds: [owned.id, 'b', 'a'] });
assert.deepEqual(updated.projects[0].linkIds, [owned.id, 'b', 'a']);
assert.equal(updated.projects[0].createdAt, built.project.createdAt);
assert.deepEqual(updated.links, built.data.links);
assert.throws(() => projectService.updateProject(updated, 'missing', { name: 'Bad', linkIds: [] }));

// Exercise the UI's shared persistence path: one snapshot, retry guard, rollback, reload.
state = mock.render(useOtiumData);
await drain();
state = mock.render(useOtiumData);
let liveDraft = drafts.createProjectDraft();
liveDraft = { ...liveDraft, name: 'Persisted project' };
liveDraft = drafts.selectDraftLink(liveDraft, state.data.links[1]);
liveDraft = drafts.selectDraftLink(liveDraft, state.data.links[0]);
liveDraft = drafts.addDraftProjectLink(liveDraft, 'Project resource', 'project.example.com');
const beforeProjectWrites = writes;
const originalHome = structuredClone(state.data.workspaceItems);
const storedProject = await state.createProject(liveDraft);
state = mock.render(useOtiumData);
assert.equal(writes, beforeProjectWrites + 1);
assert.equal(state.projects.filter(project => project.id === storedProject.id).length, 1);
assert.equal(values.persistentData.projects[0].id, storedProject.id);
assert.deepEqual(values.persistentData.projects[0].linkIds, liveDraft.linkIds);
assert(values.persistentData.links.some(link => link.projectId === storedProject.id));
assert.deepEqual(state.data.workspaceItems.slice(0, originalHome.length), originalHome);
const projectPlacement = state.data.workspaceItems.at(-1);
assert.equal(projectPlacement.type, 'project');
assert.equal(projectPlacement.projectId, storedProject.id);
assert.notEqual(projectPlacement.id, storedProject.id);
assert(geometry.isValidPosition(projectPlacement, geometry.toSpatialItems(state.data.workspaceItems, 120, state.data.projects),
  geometry.getWorkspaceGeometry(120), projectPlacement.id, geometry.getWorkspaceItemDimensions(projectPlacement, 120, state.data.projects)));
await state.createProject(liveDraft);
state = mock.render(useOtiumData);
assert.equal(state.projects.filter(project => project.id === storedProject.id).length, 1);
assert.equal(state.data.workspaceItems.filter(item => item.type === 'project' && item.projectId === storedProject.id).length, 1);
await state.updateProject(storedProject.id, { name: 'Updated project', linkIds: [...liveDraft.linkIds].reverse() });
state = mock.render(useOtiumData);
assert.equal(state.projects[0].name, 'Updated project');
assert.deepEqual(state.projects[0].linkIds, [...liveDraft.linkIds].reverse());
const movingProject = state.data.workspaceItems.find(item => item.type === 'project' && item.projectId === storedProject.id);
const projectItemSize = state.data.settings.appearance.itemSize;
const desiredProjectPosition = geometry.findNearestFreePosition({ x: 16, y: 12 }, geometry.toSpatialItems(state.data.workspaceItems, projectItemSize, state.data.projects),
  geometry.getWorkspaceGeometry(projectItemSize), movingProject.id, geometry.getWorkspaceItemDimensions(movingProject, projectItemSize, state.data.projects));
const beforeProjectMove = writes;
await state.moveItem(movingProject.id, desiredProjectPosition);
state = mock.render(useOtiumData);
assert.equal(writes, beforeProjectMove + 1);
assert.deepEqual(values.persistentData.workspaceItems.find(item => item.id === movingProject.id), { ...movingProject, ...desiredProjectPosition });
const occupiedLink = state.data.workspaceItems.find(item => item.type === 'link');
await assert.rejects(state.moveItem(movingProject.id, occupiedLink));
assert.equal(writes, beforeProjectMove + 1);
const beforeFullWorkspace = state.data;
window.innerWidth = 152; window.innerHeight = 100;
await assert.rejects(state.createProject({ ...drafts.createProjectDraft(), name: 'No room' }));
state = mock.render(useOtiumData);
assert.equal(state.data, beforeFullWorkspace);
assert.equal(writes, beforeProjectMove + 1);
window.innerWidth = 852; window.innerHeight = 600;
const beforeFailedProject = structuredClone(state.data);
let failedDraft = { ...drafts.createProjectDraft(), name: 'Should roll back' };
failedDraft = drafts.addDraftProjectLink(failedDraft, 'Unsaved link', 'unsaved.example.org');
failWrites = true;
await assert.rejects(state.createProject(failedDraft));
state = mock.render(useOtiumData);
assert.deepEqual(state.data, beforeFailedProject);
failWrites = false;
assert.deepEqual(await createDataRepository(provider).load(), beforeFailedProject);
mock.reset();
console.log('Project drafts/cancellation, ordered selection, project-only links, atomic creation, retries, update, rollback and reload checks passed.');

const placement = await load('services/projectPlacement.mjs');
const projectDimensions = await load('utils/projectDimensions.mjs');
const homeLayout = await load('utils/homeLayout.mjs');
const clearanceRect = { left: 100, top: 100, width: 96, height: 96 };
for (const rect of [
 { left: 196, top: 100 }, { left: 227, top: 100 },
 { left: 100, top: 196 }, { left: 100, top: 227 },
 { left: 196, top: 196 },
]) assert(!geometry.hasRequiredClearance(clearanceRect, { ...rect, width: 96, height: 96 }));
for (const rect of [
 { left: 228, top: 100 }, { left: -28, top: 100 },
 { left: 100, top: 228 }, { left: 100, top: -28 },
 { left: 228, top: 196 },
]) assert(geometry.hasRequiredClearance(clearanceRect, { ...rect, width: 96, height: 96 }));
for (const size of [64, 96, 128, 160]) {
 const viewport = { width: 3000, height: 2000, itemSize: size };
 for (const tier of [1, 2, 3]) {
  const width = homeLayout.widthForHomeSpan(size, tier);
  const anchor = { id: 'anchor', x: 8, y: 8, width, height: size };
  const touchingX = 8 + width / 32, touchingY = 8 + size / 32;
  assert(!geometry.isValidPosition({ x: touchingX, y: 8 }, [anchor], viewport));
  assert(!geometry.isValidPosition({ x: 8, y: touchingY }, [anchor], viewport));
  assert.deepEqual(geometry.findNearestFreePosition({ x: touchingX, y: 8 }, [anchor], viewport), { x: touchingX + 1, y: 8 });
  assert.deepEqual(geometry.findNearestFreePosition({ x: 8, y: touchingY }, [anchor], viewport), { x: 8, y: touchingY + 1 });
  const touching = [anchor, { id: 'neighbor', x: touchingX, y: 8, width: size, height: size },
   { id: 'below', x: 8, y: touchingY, width, height: size }];
  const canonical = structuredClone(touching);
  const projected = projectionUtils.projectWorkspaceToViewport(touching, viewport);
  assert.equal(projected.spatialItems.length, touching.length);
  assert(hybridProjectionLayout(projected.spatialItems, viewport));
  assert.deepEqual(touching, canonical);
 }
}
function hybridProjectionLayout(items, viewport) {
 return items.every(item => geometry.isValidPosition(item, items, viewport, item.id, item));
}

// Normal SpatialDrag preview and commit choose the same nearest safe position.
const clearanceAnchor = { id: 'anchor', x: 8, y: 8, width: 96, height: 96 };
const clearanceSource = { id: 'source', x: 20, y: 20, width: 96, height: 96 };
const clearanceNode = { ...target, getBoundingClientRect: () => ({ left: 712, top: 660 }) };
const clearanceEvent = (x, y) => ({ ...event(x, y), currentTarget: clearanceNode });
const clearanceDrops = [];
const clearanceOptions = { item: clearanceSource, items: [clearanceAnchor, clearanceSource], itemSize: 96,
 geometry: { width: 3000, height: 2000, itemSize: 96 }, onDrop: async (id, position) => clearanceDrops.push({ id, ...position }) };
let clearanceDrag = mock.render(() => useSpatialDrag(clearanceOptions));
clearanceDrag.handlers.onPointerDown(clearanceEvent(722, 670));
clearanceDrag.handlers.onPointerMove(clearanceEvent(434, 286)); rafCallback();
clearanceDrag = mock.render(() => useSpatialDrag(clearanceOptions));
assert.deepEqual(clearanceDrag.visual.target, { x: 12, y: 8 });
clearanceDrag.handlers.onPointerUp(clearanceEvent(434, 286));
assert.deepEqual(clearanceDrops, [{ id: 'source', x: 12, y: 8 }]);
await drain(); mock.reset();
for (const itemSize of [64, 96, 128, 160]) {
 for (const name of ['CRM','canmet-02','Canmet Website Project','Canmet Website Redesign and Marketing']) {
  const dimensions = projectDimensions.getProjectDimensions({name},itemSize);
  assert.equal(dimensions.height,itemSize);
  assert([1,2,3].some(span => dimensions.width === homeLayout.widthForHomeSpan(itemSize, span)));
  assert(dimensions.width <= homeLayout.widthForHomeSpan(itemSize, 3));
 }
}
for (const itemSize of [64, 96, 128, 160]) {
 const baseSpan = homeLayout.getBaseHomeSpan(itemSize);
 assert.equal(baseSpan.pixels % 32, 0);
 assert(baseSpan.gap >= 10 && baseSpan.gap < 42);
 for (const tier of [1,2,3]) {
  const width = homeLayout.widthForHomeSpan(itemSize,tier);
  const next = homeLayout.getNextCompactGridX({x:4,width});
  assert.equal(next-4,tier*baseSpan.columns);
  assert.equal((next-4)*32-width,baseSpan.gap);
  // One multi-span object and equivalent compact Links share their right edge.
  assert.equal(width,(tier-1)*baseSpan.pixels+itemSize);
 }
}
const projectSize = { width: 82, height: 82 };
const backfilled = placement.reconcileProjectPlacements(built.data, viewport);
assert.equal(backfilled.workspaceItems.length, base.workspaceItems.length + 1);
assert.deepEqual(backfilled.workspaceItems.slice(0, base.workspaceItems.length), base.workspaceItems);
assert.equal(placement.reconcileProjectPlacements(backfilled, viewport), backfilled);
const placedProject = backfilled.workspaceItems.at(-1);
assert.deepEqual(geometry.getWorkspaceItemDimensions(placedProject, 64), { width: 64, height: 64 });
assert.deepEqual(geometry.getWorkspaceItemDimensions(placedProject, 120), { width: 120, height: 120 });
assert(geometry.isValidPosition(placedProject, geometry.toSpatialItems(backfilled.workspaceItems, 82), viewport, placedProject.id, projectSize));
assert.equal(placement.reconcileProjectPlacements(built.data, { width: 100, height: 100, itemSize: 82 }), built.data);
assert.throws(() => placement.placeProject(built.data, built.project.id, { width: 100, height: 100, itemSize: 82 }));
const mixed = [
  { id: 'p', type: 'project', projectId: built.project.id, x: 4, y: 3 },
  { id: 'l', type: 'link', linkId: 'a', x: 11, y: 3 },
  { id: 'p2', type: 'project', projectId: 'other', x: 4, y: 7 },
];
const mixedSpatial = geometry.toSpatialItems(mixed, 82);
assert(!geometry.isValidPosition({ x: 6, y: 3 }, mixedSpatial, viewport, 'l')); // Link -> Project.
assert(!geometry.isValidPosition({ x: 5, y: 3 }, mixedSpatial, viewport, 'p2', projectSize)); // Project -> Project.
assert(!geometry.isValidPosition({ x: 10, y: 3 }, mixedSpatial, viewport, 'p', projectSize)); // Project -> Link.
const edge = geometry.findNearestFreePosition({ x: 100, y: 100 }, mixedSpatial, viewport, 'p', projectSize);
assert(geometry.isValidPosition(edge, mixedSpatial, viewport, 'p', projectSize));
const mixedFitted = geometry.fitWorkspaceItems(mixed, { ...viewport, itemSize: 120 });
for (const entry of mixedFitted) assert(geometry.isValidPosition(entry, geometry.toSpatialItems(mixedFitted, 120),
  { ...viewport, itemSize: 120 }, entry.id, geometry.getWorkspaceItemDimensions(entry, 120)));
assert.deepEqual(geometry.toSpatialItems(mixedFitted, 120).filter(item => item.type === 'project').map(({ width, height }) => ({ width, height })), [{ width: 120, height: 120 }, { width: 120, height: 120 }]);

// Backfill writes once and reload never replaces a moved position or placement ID.
let upgradeValues = { persistentData: structuredClone(built.data) }, upgradeWrites = 0;
const upgradeProvider = {
  async read() { return structuredClone(upgradeValues); },
  async write(update) { upgradeWrites++; Object.assign(upgradeValues, structuredClone(update)); },
};
const upgraded = await createDataRepository(upgradeProvider).load();
assert.equal(upgradeWrites, 1);
assert.deepEqual(await createDataRepository(upgradeProvider).load(), upgraded);
assert.equal(upgradeWrites, 1);
const movedUpgrade = { ...upgraded, workspaceItems: upgraded.workspaceItems.map(item => item.type === 'project' ? { ...item, x: 12, y: 10 } : item) };
await createDataRepository(upgradeProvider).save(movedUpgrade);
assert.deepEqual(await createDataRepository(upgradeProvider).load(), movedUpgrade);
assert.equal(upgradeWrites, 2);
let upgradeFailedWrites = 0;
await assert.rejects(createDataRepository({ async read() { return { persistentData: built.data }; },
  async write() { upgradeFailedWrites++; throw new Error('Unavailable'); } }).load());
assert.equal(upgradeFailedWrites, 1);
assert.deepEqual(built.data.workspaceItems, base.workspaceItems);

const { resolveProjectLinks } = await load('utils/projectLinks.mjs');
const unresolved = { ...backfilled, projects: [{ ...built.project, linkIds: ['missing', 'b', 'a'] }],
  workspaceItems: [...backfilled.workspaceItems, { id: 'orphan-project', type: 'project', projectId: 'gone', x: 20, y: 10 }] };
assert.deepEqual(parseCurrentData(unresolved), unresolved);
assert.deepEqual(resolveProjectLinks(unresolved.projects[0], unresolved.links).map(link => link.id), ['b', 'a']);
assert.equal(placement.reconcileProjectPlacements(unresolved, viewport), unresolved);
assert.throws(() => parseCurrentData({ ...backfilled, projects: [{ ...built.project, linkIds: [false] }] }));

// The same spatial engine accepts the large footprint, preserves offset, and suppresses click after drag.
const largeOptions = { ...options, item: mixed[0], items: mixedSpatial, dimensions: projectSize };
drops = [];
drag = mock.render(() => useSpatialDrag(largeOptions));
drag.handlers.onPointerDown(event(230, 136));
drag.handlers.onPointerMove(event(900, 900));
rafCallback();
drag = mock.render(() => useSpatialDrag(largeOptions));
assert.equal(drag.visual.left, 818);
assert.equal(drag.visual.top, 880);
const largePreview = drag.visual.target;
assert(geometry.isValidPosition(largePreview, mixedSpatial, viewport, 'p', projectSize));
drag.handlers.onPointerUp(event(900, 900));
assert.deepEqual(drops, [largePreview]);
prevented = false;
drag.handlers.onClick({ detail: 1, preventDefault() { prevented = true; }, stopPropagation() {} });
assert(prevented);
await drain();
mock.reset();

const { createBrowserTabsService } = await load('services/browserTabs.mjs');
let opened = [], releaseTab;
const tabs = createBrowserTabsService(() => ({
  async create(options) {
    opened.push(options);
    if (opened.length === 1) await new Promise(resolve => { releaseTab = resolve; });
  },
}));
const firstOpening = tabs.openProject(unresolved.projects[0], unresolved.links);
assert.equal(tabs.openProject(unresolved.projects[0], unresolved.links), firstOpening);
assert.equal(opened.length, 1);
releaseTab();
await firstOpening;
assert.deepEqual(opened, [{ url: base.links[1].url, active: false }, { url: base.links[0].url, active: false }]);
await tabs.openProject(emptyProject.project, []);
assert.equal(opened.length, 2);
await tabs.openProject({ ...built.project, linkIds: ['unsafe', 'a'] }, [{ id: 'unsafe', url: 'javascript:alert(1)' }, ...base.links]);
assert.equal(opened.length, 3);
let tabAttempts = 0;
const failingTabs = createBrowserTabsService(() => ({ async create() { tabAttempts++; throw new Error('Cannot create'); } }));
await assert.rejects(failingTabs.openProject(built.project, built.data.links));
await assert.rejects(failingTabs.openProject(built.project, built.data.links));
assert.equal(tabAttempts, 2);
console.log('Project placement/backfill/idempotency, mixed-size collision/clamping, large spatial drag and ordered browser-tab activation checks passed.');

const sortable = await load('utils/sortable.mjs');
assert.equal(sortable.calculateInsertionIndex(49, [{ left: 0, width: 100 }, { left: 110, width: 100 }]), 0);
assert.equal(sortable.calculateInsertionIndex(50, [{ left: 0, width: 100 }, { left: 110, width: 100 }]), 1);
assert.equal(sortable.calculateInsertionIndex(160, [{ left: 0, width: 100 }, { left: 110, width: 100 }]), 2);
assert.equal(sortable.calculateInsertionIndex(1000, []), 0);
assert.deepEqual(sortable.insertOrMoveId(['a', 'b', 'c'], 'd', 1), ['a', 'd', 'b', 'c']);
assert.deepEqual(sortable.insertOrMoveId(['a', 'b', 'c', 'd'], 'b', 2), ['a', 'c', 'b', 'd']);
assert.deepEqual(sortable.insertOrMoveId(['a', 'b', 'c', 'd'], 'c', 1), ['a', 'c', 'b', 'd']);
assert.deepEqual(sortable.insertOrMoveId(['a', 'b'], 'a', 99), ['b', 'a']);
assert.deepEqual(sortable.removeId(['a', 'b', 'c'], 'b'), ['a', 'c']);

const { useSortableDrag } = await load('hooks/useSortableDrag.mjs');
const captures = new Set();
const sourceNode = {
  getBoundingClientRect: () => ({ left: 100, top: 300, width: 82, height: 82 }),
  setPointerCapture(id) { captures.add(id); },
  hasPointerCapture(id) { return captures.has(id); },
  releasePointerCapture(id) { captures.delete(id); },
};
const sortableEvent = (x, y) => ({
  button: 0, isPrimary: true, pointerId: 7, clientX: x, clientY: y,
  currentTarget: sourceNode, preventDefault() {},
});
const listNodes = [
  { dataset: { sortableId: 'a' }, offsetLeft: 0, offsetWidth: 160 },
  { dataset: { sortableId: 'b' }, offsetLeft: 170, offsetWidth: 160 },
];
let gap = null;
const listNode = {
  getBoundingClientRect: () => ({ left: 100 }),
  querySelector() { return gap; },
  querySelectorAll() { return listNodes; },
};
const zone = {
  setPointerCapture: sourceNode.setPointerCapture, hasPointerCapture: sourceNode.hasPointerCapture, releasePointerCapture: sourceNode.releasePointerCapture,
  getBoundingClientRect: () => ({ left: 80, right: 700, top: 100, bottom: 200 }),
  querySelector() { return listNode; },
};
let inserted = [], removed = [];
const sortOptions = {
  onInsert(id, index) { inserted.push({ id, index }); },
  onRemove(id) { removed.push(id); },
};
let sortState = mock.render(() => useSortableDrag(sortOptions));
sortState.zoneRef.current = zone;
let sourceHandlers = sortState.getSourceHandlers('d', 'external');
sourceHandlers.onPointerDown(sortableEvent(141, 341));
sourceHandlers.onPointerMove(sortableEvent(144, 341));
assert.equal(rafCallback, undefined);
sourceHandlers.onPointerUp(sortableEvent(144, 341));
assert.equal(captures.size, 0);
let blocked = false;
sourceHandlers.onClickCapture({ detail: 1, currentTarget: sourceNode, preventDefault() { blocked = true; }, stopPropagation() {} });
assert(!blocked);

sourceHandlers.onPointerDown(sortableEvent(141, 341));
sourceHandlers.onPointerMove(sortableEvent(260, 150));
rafCallback();
sortState = mock.render(() => useSortableDrag(sortOptions));
assert.equal(sortState.drag.insertionIndex, 1);
assert.equal(sortState.drag.left, 180); // Proportional grab offset: 41/82 * 160.
assert.equal(sortState.drag.top, 129);
assert.equal(inserted.length, 0); // No draft mutation during pointermove.
// Gap occupies the intended index and remains stable despite neighbor shifting.
gap = { offsetLeft: 170, offsetWidth: 160, dataset: { sortablePlaceholder: '1' } };
listNodes[1].offsetLeft = 340;
sourceHandlers.onPointerMove(sortableEvent(330, 150));
rafCallback();
sortState = mock.render(() => useSortableDrag(sortOptions));
assert.equal(sortState.drag.insertionIndex, 1);
sourceHandlers.onPointerUp(sortableEvent(330, 150));
assert.deepEqual(inserted, [{ id: 'd', index: 1 }]);
assert.equal(captures.size, 0);
sourceHandlers.onClickCapture({ detail: 1, currentTarget: sourceNode, preventDefault() { blocked = true; }, stopPropagation() {} });
assert(blocked);
sortState = mock.render(() => useSortableDrag(sortOptions));
assert.equal(sortState.drag, null);

gap = null;
listNodes[1].offsetLeft = 170;
// Already-selected external source reorders among the remaining entries.
sourceHandlers = sortState.getSourceHandlers('a', 'external');
sourceHandlers.onPointerDown(sortableEvent(141, 341));
sourceHandlers.onPointerMove(sortableEvent(600, 150));
rafCallback();
sortState = mock.render(() => useSortableDrag(sortOptions));
assert.equal(sortState.drag.insertionIndex, 1); // Only b remains.
sourceHandlers.onPointerUp(sortableEvent(600, 150));
assert.deepEqual(inserted.at(-1), { id: 'a', index: 1 });
assert.deepEqual(sortable.insertOrMoveId(['a', 'b'], 'a', inserted.at(-1).index), ['b', 'a']);

sourceHandlers = sortState.getSourceHandlers('b', 'list');
sourceHandlers.onPointerDown(sortableEvent(141, 341));
sourceHandlers.onPointerMove(sortableEvent(550, 450));
rafCallback();
sourceHandlers.onPointerUp(sortableEvent(550, 450));
assert.deepEqual(removed, ['b']);
sortState = mock.render(() => useSortableDrag(sortOptions));
assert.equal(sortState.drag, null);
// Outside external drop is a no-op.
sourceHandlers = sortState.getSourceHandlers('d', 'external');
sourceHandlers.onPointerDown(sortableEvent(141, 341));
sourceHandlers.onPointerMove(sortableEvent(550, 450));
sourceHandlers.onPointerUp(sortableEvent(550, 450));
assert.equal(inserted.length, 2);
assert.equal(removed.length, 1);

// pointercancel and capture loss never commit a removal or insertion.
sourceHandlers = sortState.getSourceHandlers('b', 'list');
sourceHandlers.onPointerDown(sortableEvent(141, 341));
sourceHandlers.onPointerMove(sortableEvent(550, 450));
sourceHandlers.onPointerCancel(sortableEvent(550, 450));
sortState = mock.render(() => useSortableDrag(sortOptions));
assert.equal(sortState.drag, null);
assert.equal(removed.length, 1);
sourceHandlers.onPointerDown(sortableEvent(141, 341));
sourceHandlers.onPointerMove(sortableEvent(260, 150));
sourceHandlers.onLostPointerCapture(sortableEvent(260, 150));
assert.equal(inserted.length, 2);
assert.equal(captures.size, 0);
sourceHandlers.onPointerDown(sortableEvent(141, 341));
sourceHandlers.onPointerMove(sortableEvent(260, 150));
listeners.get('keydown')({ key: 'Escape', preventDefault() {} });
sortState = mock.render(() => useSortableDrag(sortOptions));
assert.equal(sortState.drag, null);
sourceHandlers.onPointerDown(sortableEvent(141, 341));
sourceHandlers.onPointerMove(sortableEvent(260, 150));
listeners.get('blur')();
assert.equal(captures.size, 0);
mock.reset();

sortState = mock.render(() => useSortableDrag(sortOptions));
sortState.zoneRef.current = zone;
sourceHandlers = sortState.getSourceHandlers('b', 'list');
sourceHandlers.onPointerDown(sortableEvent(141, 341));
sourceHandlers.onPointerMove(sortableEvent(260, 150));
// Browser capture transfer emits a loss event for the old source. It is not cancellation.
sourceHandlers.onLostPointerCapture({ ...sortableEvent(260, 150), type: 'lostpointercapture', target: sourceNode });
rafCallback();
sortState = mock.render(() => useSortableDrag(sortOptions));
assert(sortState.drag);
sortState.zoneHandlers.onLostPointerCapture({
  ...sortableEvent(260, 150), type: 'lostpointercapture', target: zone, currentTarget: zone,
});
sortState = mock.render(() => useSortableDrag(sortOptions));
assert.equal(sortState.drag, null);
assert.equal(captures.size, 0);
mock.reset();

const emptyZone = { ...zone, querySelector: () => ({ ...listNode, querySelectorAll: () => [] }) };
sortState = mock.render(() => useSortableDrag(sortOptions));
sortState.zoneRef.current = emptyZone;
sourceHandlers = sortState.getSourceHandlers('first', 'external');
sourceHandlers.onPointerDown(sortableEvent(141, 341));
sourceHandlers.onPointerUp(sortableEvent(300, 150));
assert.deepEqual(inserted.at(-1), { id: 'first', index: 0 });
mock.reset();

// Final sortable order is still saved only by normal project completion.
let orderedDraft = { ...drafts.createProjectDraft(), name: 'Sortable order', linkIds: ['a', 'b'] };
orderedDraft = { ...orderedDraft, linkIds: sortable.insertOrMoveId(orderedDraft.linkIds, 'b', 0) };
const orderedProject = projectService.createProject(base, orderedDraft);
assert.deepEqual(orderedProject.project.linkIds, ['b', 'a']);
assert.deepEqual(parseCurrentData(orderedProject.data).projects[0].linkIds, ['b', 'a']);
assert.deepEqual(orderedProject.data.workspaceItems, base.workspaceItems);
assert(!('x' in orderedProject.project));
state = mock.render(useOtiumData);
await drain();
state = mock.render(useOtiumData);
const completedSortable = await state.createProject(orderedDraft);
assert.deepEqual(values.persistentData.projects.find(project => project.id === completedSortable.id).linkIds, ['b', 'a']);
const loadedSortable = await createDataRepository(provider).load();
assert.deepEqual(loadedSortable.projects.find(project => project.id === completedSortable.id).linkIds, ['b', 'a']);
mock.reset();

console.log('Sortable insertion/reorder, threshold, grab offset, physical gap stability, duplicate avoidance, outside removal, empty drop, capture/cancel/Escape cleanup and ordered project completion checks passed.');

const hybrid = await load('utils/horizontalInsertion.mjs');
for (const size of [64, 96, 128, 160]) {
 const span = homeLayout.getBaseHomeSpan(size);
 const rowX = Math.max(4, span.columns);
 for (const tier of [1,2,3]) {
  const source = {id:'source-project',x:rowX+span.columns,y:12,width:homeLayout.widthForHomeSpan(size,tier),height:size};
  const matrixItems = [
   {id:'left',x:rowX,y:4,width:size,height:size},
   {id:'right',x:rowX+span.columns,y:4,width:size,height:size}, source,
  ];
  const pointer = {left:20+rowX*32+(size+span.pixels)/2,top:20+4*32+size/2};
  const candidate = hybrid.findHorizontalInsertionCandidate(matrixItems,source.id,pointer);
  const proposal = hybrid.proposeHorizontalInsertion(source,candidate,matrixItems,{width:2000,height:1000,itemSize:size});
  assert(proposal, `Expected an insertion proposal at ${size}px for tier ${tier}`);
  assert.equal(proposal.draggedPosition.x,rowX+span.columns);
  assert.equal(proposal.movedItems[0].x,rowX+(tier+1)*span.columns);
  assert.equal((proposal.movedItems[0].x-proposal.draggedPosition.x)*32-source.width,span.gap);
 }
}
const { updateWorkspacePositions } = await load('services/workspacePositions.mjs');
// Exercise actual authoritative Project dimensions with every source/neighbor
// combination, both insertion zones and touching versus automatically spaced rows.
for (const size of [64, 96, 128, 160]) {
 const projects = [1, 2, 3].map(tier => ({ id: `tier-${tier}`,
  name: tier === 1 ? 'A' : 'W'.repeat(Math.ceil(homeLayout.widthForHomeSpan(size, tier - 1) / 12.6)),
  linkIds: [], createdAt: 1, updatedAt: 1 }));
 projects.forEach((project, index) => assert.equal(projectDimensions.getProjectWidthTier(project, size), index + 1));
 for (const neighborTier of [0, 1, 2, 3]) for (const sourceTier of [0, 1, 2, 3]) {
  for (const gap of [0, 32]) for (const zoneIndex of [0, 1]) {
   const make = (id, tier, x, y) => tier === 0
    ? { id, type: 'link', linkId: id, x, y }
    : { id, type: 'project', projectId: `tier-${tier}`, x, y };
   let x = 8;
   const row = ['a', 'b', 'c'].map(id => {
    const item = make(id, neighborTier, x, 8);
    x += (geometry.getWorkspaceItemDimensions(item, size, projects).width + gap) / 32;
    return item;
   });
   const source = make('x', sourceTier, 8, 24);
   const items = [...row, source];
   const spatial = geometry.toSpatialItems(items, size, projects);
   const left = spatial[zoneIndex], right = spatial[zoneIndex + 1];
   const pointer = { left: 20 + (left.x * 32 + left.width + right.x * 32) / 2 + 3,
    top: 20 + left.y * 32 + size / 2 + 1 };
   const candidate = hybrid.findHorizontalInsertionCandidate(spatial, 'x', pointer);
   assert(candidate, `Missing semantic zone at ${size}px`);
   const viewport = { width: 6000, height: 2000, itemSize: size };
   const proposal = hybrid.proposeHorizontalInsertion(spatial.at(-1), candidate, spatial, viewport);
   assert(proposal);
   const committed = updateWorkspacePositions(items, hybrid.insertionChanges(proposal), viewport, projects);
   const resolved = geometry.toSpatialItems(committed, size, projects);
   const sorted = resolved.filter(item => item.y === 8).sort((a, b) => a.x - b.x);
   assert.deepEqual(sorted.map(item => item.id), zoneIndex === 0 ? ['a', 'x', 'b', 'c'] : ['a', 'b', 'x', 'c']);
   for (let index = zoneIndex; index < sorted.length - 1; index++) {
    assert.equal((sorted[index + 1].x - sorted[index].x) * 32 - sorted[index].width, 32);
   }
   assert.equal(committed[zoneIndex].x, row[zoneIndex].x); // Free/manual anchor remains fixed.
  }
 }
}

// Regression: size normalization may leave unrelated canonical overlaps. They
// must not reject an otherwise safe intentional insertion or be silently moved.
const regressionViewport = { width: 3000, height: 1800, itemSize: 96 };
const regressionItems = ['a', 'b', 'c', 'x', 'unrelated-1', 'unrelated-2'].map((id, index) => ({
 id, type: 'link', linkId: id, x: index < 3 ? 8 + index * 4 : index === 3 ? 8 : 60,
 y: index < 3 ? 8 : index === 3 ? 20 : 30,
}));
const regressionSpatial = geometry.toSpatialItems(regressionItems, 96);
const regressionCandidate = hybrid.findHorizontalInsertionCandidate(regressionSpatial, 'x', { left: 389, top: 325 });
const regressionProposal = hybrid.proposeHorizontalInsertion(regressionSpatial[3], regressionCandidate, regressionSpatial, regressionViewport);
assert(regressionProposal);
const regressionCommitted = updateWorkspacePositions(regressionItems, hybrid.insertionChanges(regressionProposal), regressionViewport);
assert.deepEqual(regressionCommitted.slice(4), regressionItems.slice(4));
assert.throws(() => updateWorkspacePositions(regressionItems, [{ id: 'x', x: 60, y: 30 }], regressionViewport));

// A projected anchor is part of this explicit insertion, while all other
// responsive coordinates remain transient. Its saved left edge must match preview.
const anchorCanonical = regressionSpatial.map(item => item.id === 'a' ? { ...item, y: 14 } : item);
const anchorDisplay = regressionSpatial.filter(item => !item.id.startsWith('unrelated'));
const anchorProposal = hybrid.proposeHorizontalInsertion(anchorDisplay[3], regressionCandidate, anchorDisplay, regressionViewport);
const anchored = projectionUtils.canonicalInsertionForProjection(anchorProposal, anchorCanonical, regressionViewport, anchorDisplay);
assert(anchored);
assert(anchored.proposal.movedItems.some(item => item.id === 'a' && item.y === 8));
const anchoredCommit = updateWorkspacePositions(regressionItems.map(item => item.id === 'a' ? { ...item, y: 14 } : item),
 hybrid.insertionChanges(anchored.proposal), anchored.geometry);
assert.equal(anchoredCommit.find(item => item.id === 'a').y, 8);
assert.deepEqual(anchoredCommit.slice(4), regressionItems.slice(4));
const rowItems = ['a', 'b', 'c', 'd'].map((id, index) => ({ id, type: 'link', linkId: id, x: 4 + index * 4, y: 4 }));
const rowGeometry = { width: 1200, height: 700, itemSize: 82 };
const rowSpatial = geometry.toSpatialItems(rowItems, 82);
const intentPointer = { left: 381, top: 189 }; // Gap between B and C.
const intent = hybrid.findHorizontalInsertionCandidate(rowSpatial, 'a', intentPointer);
assert.equal(intent.leftId, 'b'); assert.equal(intent.rightId, 'c');
assert.equal(hybrid.findHorizontalInsertionCandidate(rowSpatial, 'a', { left: 380, top: 350 }), null);
assert.equal(hybrid.findHorizontalInsertionCandidate(rowSpatial, 'a', { left: 600, top: 189 }), null);
assert.equal(hybrid.findHorizontalInsertionCandidate(rowSpatial, 'a', { left: intent.zone.right + 4, top: 189 }), null);
assert.equal(hybrid.findHorizontalInsertionCandidate(rowSpatial, 'a', { left: intent.zone.right + 4, top: 189 }, intent).rightId, 'c');
assert.equal(hybrid.findHorizontalInsertionCandidate(rowSpatial, 'a', { left: intent.zone.right + 9, top: 189 }, intent), null);
const proposal = hybrid.proposeHorizontalInsertion(rowSpatial[0], intent, rowSpatial, rowGeometry);
const projectedSource = { id: 'source', x: 4, y: 8, width: 82, height: 82 };
const canonicalChain = [...rowSpatial, projectedSource];
const displayedChain = [...rowSpatial.slice(0, 3), { ...rowSpatial[3], x: 13, y: 8 }, projectedSource];
const displayedCandidate = hybrid.findHorizontalInsertionCandidate(displayedChain, 'source', intentPointer);
const displayInsertion = hybrid.proposeHorizontalInsertion(projectedSource, displayedCandidate,
  displayedChain, { width: 700, height: 400, itemSize: 82 });
assert(displayInsertion);
const canonicalInsertion = projectionUtils.canonicalInsertionForProjection(displayInsertion, canonicalChain,
  { width: 700, height: 400, itemSize: 82 });
assert.deepEqual(canonicalInsertion.proposal.movedItems.map(item => [item.id, item.x]), [['c', 16], ['d', 20]]);
assert.equal(canonicalInsertion.proposal.draggedPosition.x, displayInsertion.draggedPosition.x);
assert.deepEqual(proposal.draggedPosition, { x: 12, y: 4 });
assert.deepEqual(proposal.movedItems, [{ id: 'c', x: 16, y: 4 }, { id: 'd', x: 20, y: 4 }]);
const proposedItems = updateWorkspacePositions(rowItems, hybrid.insertionChanges(proposal), rowGeometry);
assert.deepEqual(rowItems[0], { id: 'a', type: 'link', linkId: 'a', x: 4, y: 4 });
assert.equal(proposedItems.length, rowItems.length);
assert(hybrid.isValidSpatialLayout(geometry.toSpatialItems(proposedItems, 82), rowGeometry));
assert.equal(proposedItems.find(item => item.id === 'b'), rowItems[1]); // Unaffected identity retained.
assert.throws(() => updateWorkspacePositions(rowItems, [{ id: 'gone', x: 2, y: 4 }], rowGeometry));
assert.throws(() => updateWorkspacePositions(rowItems, [{ id: 'a', x: 2, y: 4 }, { id: 'a', x: 3, y: 4 }], rowGeometry));
assert.throws(() => updateWorkspacePositions(rowItems, [{ id: 'a', x: 8, y: 4 }], rowGeometry));
assert.throws(() => updateWorkspacePositions(rowItems, [{ id: 'a', x: 2.5, y: 4 }], rowGeometry));
assert.throws(() => updateWorkspacePositions(rowItems, [{ id: 'a', x: -1, y: 4 }], rowGeometry));
assert.equal(hybrid.proposeHorizontalInsertion(rowSpatial[0], intent, rowSpatial, { ...rowGeometry, width: 640 }), null);
const blockedRow = [...rowSpatial, { id: 'off-row', x: 19, y: 5, width: 82, height: 82 }];
assert(!hybrid.belongsToHorizontalRow(rowSpatial[1], blockedRow.at(-1)));
assert.equal(hybrid.proposeHorizontalInsertion(blockedRow[0], intent, blockedRow, rowGeometry), null);
const unrelated = { id: 'other', type: 'link', linkId: 'b', x: 16, y: 10 };
const separateRows = geometry.toSpatialItems([...rowItems, unrelated], 82);
assert(!hybrid.proposeHorizontalInsertion(separateRows[0], intent, separateRows, rowGeometry).movedItems.some(item => item.id === 'other'));
const sparse = [rowSpatial[1], { ...rowSpatial[2], x: 16 }, rowSpatial[0]];
assert.equal(hybrid.findHorizontalInsertionCandidate(sparse, 'a', { left: 445, top: 189 }), null);
const largeSource = { id: 'large', type: 'project', projectId: 'large-project', x: 4, y: 12, width: 208, height: 120 };
const mixedInsertion = [...rowSpatial, largeSource];
const mixedIntent = hybrid.findHorizontalInsertionCandidate(mixedInsertion, 'large', { left: 253, top: 189 });
const mixedProposal = hybrid.proposeHorizontalInsertion(largeSource, mixedIntent, mixedInsertion, rowGeometry);
assert.deepEqual(mixedProposal.draggedPosition, { x: 8, y: 4 });
assert.deepEqual(mixedProposal.movedItems.map(item => item.x), [16, 20, 24]);
const tunnelItems = [rowSpatial[0], rowSpatial[1], largeSource, { id: 'tunnel-blocker', x: 12, y: 5, width: 82, height: 82 }];
const tunnelIntent = hybrid.findHorizontalInsertionCandidate(tunnelItems, 'large', { left: 253, top: 189 });
assert.equal(hybrid.proposeHorizontalInsertion(largeSource, tunnelIntent, tunnelItems, rowGeometry), null);
assert(hybrid.isValidSpatialLayout(mixedInsertion.map(item => ({ ...item,
  ...hybrid.insertionChanges(mixedProposal).find(change => change.id === item.id) })), rowGeometry));
const projectNeighbors = [rowSpatial[0], { ...largeSource, x: 8, y: 4 }, { ...rowSpatial[1], x: 16 },
  { ...rowSpatial[2], x: 4, y: 10 }];
const projectNeighborIntent = hybrid.findHorizontalInsertionCandidate(projectNeighbors, 'c', { left: 253, top: 189 });
const neighborProposal = hybrid.proposeHorizontalInsertion(projectNeighbors[3], projectNeighborIntent, projectNeighbors, rowGeometry);
assert.deepEqual(neighborProposal.movedItems.map(item => [item.id, item.x]), [['large', 12], ['b', 20]]);
const vacatedSource = [
  { id: 'left', x: 8, y: 4, width: 120, height: 120 },
  { id: 'project', x: 12, y: 4, width: 208, height: 120 },
  { id: 'source', x: 20, y: 4, width: 120, height: 120 },
  { id: 'next', x: 24, y: 4, width: 120, height: 120 },
  { id: 'last', x: 28, y: 4, width: 120, height: 120 },
];
const vacatedIntent = hybrid.findHorizontalInsertionCandidate(vacatedSource, 'source', { left: 400, top: 208 });
const vacatedProposal = hybrid.proposeHorizontalInsertion(vacatedSource[2], vacatedIntent, vacatedSource, { ...rowGeometry, itemSize: 120 });
assert.deepEqual(vacatedProposal.movedItems.map(item => [item.id, item.x]), [['project', 18], ['next', 26], ['last', 31]]);
const controlsRow = [{ ...rowSpatial[0], x: 26, y: 0 }, { ...rowSpatial[1], x: 30, y: 0 }, { ...rowSpatial[2], x: 4, y: 10 }];
const controlsIntent = hybrid.findHorizontalInsertionCandidate(controlsRow, 'c', { left: 957, top: 61 });
assert.equal(hybrid.proposeHorizontalInsertion(controlsRow[2], controlsIntent, controlsRow, { width: 1160, height: 700, itemSize: 82 }), null);

// Repeated reorder keeps a compact span and preserves distant manual positions.
assert.equal(geometry.firstGridXAfterItem({ x: 4, width: 82 }, 10), 7);
assert.equal(geometry.firstGridXAfterItem({ x: 4, width: 208 }, 10), 11);
let repeated = rowSpatial.map((item, index) => ({ ...item, x: 4 + index * 3 }));
const distant = { id: 'distant', x: 30, y: 4, width: 82, height: 82 };
for (let iteration = 0; iteration < 20; iteration++) {
 const sorted = repeated.toSorted((a, b) => a.x - b.x);
 const source = sorted.at(-1), left = sorted[0], right = sorted[1];
 const pointer = { left: 20 + (left.x * 32 + 82 + right.x * 32) / 2, top: 189 };
 const items = [...repeated, distant];
 const candidate = hybrid.findHorizontalInsertionCandidate(items, source.id, pointer);
 const next = hybrid.proposeHorizontalInsertion(source, candidate, items, rowGeometry);
 assert(next); assert(!next.movedItems.some(item => item.id === distant.id));
 const changes = hybrid.insertionChanges(next);
 repeated = repeated.map(item => ({ ...item, ...changes.find(change => change.id === item.id) }));
 assert.deepEqual(repeated.map(item => item.x).sort((a,b) => a-b), [4,8,12,16]);
}

// Adaptive project footprints use the same dimensions for insertion and persistence.
for (const name of ['CRM','canmet-02','Canmet Website Project']) {
 const project = { id:'adaptive',name,linkIds:[],createdAt:1,updatedAt:1 };
 const source = {id:'adaptive-item',type:'project',projectId:'adaptive',x:4,y:12};
 const items = [...rowItems,source];
 const spatial = geometry.toSpatialItems(items,82,[project]);
 const candidate = hybrid.findHorizontalInsertionCandidate(spatial,source.id,{left:253,top:189});
 const next = hybrid.proposeHorizontalInsertion(spatial.at(-1),candidate,spatial,rowGeometry);
 assert(next);
 const committed = updateWorkspacePositions(items,hybrid.insertionChanges(next),rowGeometry,[project]);
 assert(hybrid.isValidSpatialLayout(geometry.toSpatialItems(committed,82,[project]),rowGeometry));
 assert.deepEqual(geometry.getWorkspaceItemDimensions(source,82,[project]),projectDimensions.getProjectDimensions(project,82));
}

// rAF preview is transient, stable, pointer-driven and cleaned on leave/cancel/abort.
let insertionPreviews = [], insertionCommits = [], normalDrops = [];
const hybridTarget = { ...target, getBoundingClientRect: () => ({ left: 200, top: 148 }) };
const hybridEvent = (x, y) => ({ ...event(x, y), currentTarget: hybridTarget });
const hybridOptions = { item: rowItems[0], items: rowSpatial, itemSize: 82,
  onDrop: async (id, position) => { normalDrops.push({ id, ...position }); },
  insertion: { onPreview: value => insertionPreviews.push(value), onCommit: async value => { insertionCommits.push(value); } } };
let hybridDrag = mock.render(() => useSpatialDrag(hybridOptions));
hybridDrag.handlers.onPointerDown(hybridEvent(230, 168));
hybridDrag.handlers.onPointerMove(hybridEvent(433, 189)); rafCallback();
hybridDrag = mock.render(() => useSpatialDrag(hybridOptions));
assert.equal(insertionPreviews.length, 1);
assert.equal(insertionCommits.length, 0);
assert.equal(hybridDrag.visual.left, 351); // Pointer offset preserved, independent of target.
assert.deepEqual(hybridDrag.visual.target, proposal.draggedPosition);
hybridDrag.handlers.onPointerMove(hybridEvent(435, 190)); rafCallback();
assert.equal(insertionPreviews.length, 1); // Same arrangement doesn't republish neighbors.
hybridDrag.handlers.onPointerMove(hybridEvent(650, 450)); rafCallback();
assert.equal(insertionPreviews.at(-1), null);
hybridDrag.handlers.onPointerMove(hybridEvent(433, 189)); rafCallback();
hybridDrag.handlers.onPointerCancel(hybridEvent(433, 189));
assert.equal(insertionPreviews.at(-1), null); assert.equal(insertionCommits.length, 0);
hybridDrag.handlers.onPointerDown(hybridEvent(230, 168));
hybridDrag.handlers.onPointerMove(hybridEvent(433, 189)); rafCallback();
hybridDrag.handlers.onPointerUp(hybridEvent(433, 189));
assert.equal(insertionCommits.length, 1); assert.equal(normalDrops.length, 0);
assert.equal(insertionPreviews.at(-1), null);
await drain();
hybridDrag = mock.render(() => useSpatialDrag(hybridOptions));
hybridDrag.handlers.onPointerDown(hybridEvent(230, 168));
hybridDrag.handlers.onPointerMove(hybridEvent(433, 189)); rafCallback();
listeners.get('keydown')({ key: 'Escape', preventDefault() {} });
assert.equal(insertionPreviews.at(-1), null); assert.equal(insertionCommits.length, 1);
hybridDrag.handlers.onPointerDown(hybridEvent(230, 168));
hybridDrag.handlers.onPointerMove(hybridEvent(433, 189)); rafCallback();
listeners.get('blur')();
assert.equal(insertionPreviews.at(-1), null);
hybridDrag.handlers.onPointerDown(hybridEvent(230, 168));
hybridDrag.handlers.onPointerUp(hybridEvent(650, 450));
assert.equal(normalDrops.length, 1);
await drain(); mock.reset();

// Batch path stores exactly one collision-free snapshot and rolls the whole batch back.
values.persistentData = { ...base, workspaceItems: rowItems.map(item => ({ ...item, linkId: 'a' })) };
await (await load('services/storage.mjs')).dataRepository.save(values.persistentData);
state = mock.render(useOtiumData); await drain(); state = mock.render(useOtiumData);
const beforeBatch = writes;
await state.moveItems(hybrid.insertionChanges(proposal));
state = mock.render(useOtiumData);
assert.equal(writes, beforeBatch + 1);
assert.deepEqual(values.persistentData.workspaceItems.map(item => [item.id, item.x, item.y]),
  [['a', 12, 4], ['b', 8, 4], ['c', 16, 4], ['d', 20, 4]]);
assert.deepEqual(await createDataRepository(provider).load(), state.data);
const batchSaved = structuredClone(state.data);
await assert.rejects(state.moveItems([{ id: 'a', x: 8, y: 4 }]));
assert.equal(writes, beforeBatch + 1);
failWrites = true;
await assert.rejects(state.moveItems([{ id: 'a', x: 12, y: 10 }, { id: 'c', x: 16, y: 10 }]));
state = mock.render(useOtiumData);
assert.deepEqual(state.data, batchSaved);
failWrites = false; mock.reset();
console.log('Hybrid horizontal intent/hysteresis, mixed-size chain reflow, blocked/bounds fallback, transient cleanup and atomic batch persistence checks passed.');

const manifest = JSON.parse(fs.readFileSync('public/manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage']);
assert.equal(manifest.chrome_url_overrides.newtab, 'index.html');
console.log('Migration/idempotency/recovery, settings persistence/rollback, theme, runtime geometry, sidebar coordinates and pointer regression checks passed.');




