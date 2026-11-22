import type { OtiumData } from '../domain/data';
import { chromeStorageProvider } from './storage/provider';
import type { StorageProvider } from './storage/provider';
import { LEGACY_WORKSPACE_SCHEMA_VERSION, migrateLegacyData, SCHEMA_VERSION, STORAGE_KEY } from './storage/migrations';
import { parseSupportedData, RECOVERY_KEY, RECOVERY_REFRESH_MS, RECOVERY_VERSION, recoveryStatus, UnsupportedStorageVersionError, validateRecovery } from './storage/recovery';
import type { RecoverySnapshot } from './storage/recovery';
import { assertStorageCapacity } from './storage/capacity';
import { sameWorkspaceValue, validateWorkspaceImport } from './storage/workspaceImport';
import { EMPTY_NOTEBOOK, parseNotebook } from '../domain/notebook';
import type { NotebookData } from '../domain/notebook';
import { BOOKMARK_IMPORT_ONBOARDING_KEY } from './bookmarkImportOnboarding';

const WORKSPACE_REPLACEMENT_KEY = 'otium:workspaceReplacement';
interface WorkspaceReplacement {
  epoch: string;
  pending: boolean;
  previous: unknown;
  primaryMissing?: true;
}

export type PersistentDataMutation = (latest: OtiumData) => OtiumData;
export type CoordinatedDataMutation = (latest: OtiumData) => OtiumData | Promise<OtiumData>;
export interface DataMutationOptions {
  backupBeforeDestructiveWrite?: boolean;
  checkCapacity?: boolean;
  writeFailureMessage?: string;
}

// Web Locks are shared by documents on the extension origin, including New Tabs
// and the popup. The lock covers the entire read/validate/write operation.
function coordinated<T>(operation: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks;
  if (!locks) return Promise.reject(new Error('Safe storage coordination is unavailable. Open Otium in a supported Chromium browser.'));
  return locks.request(`otium:${STORAGE_KEY}`, { mode: 'exclusive' }, operation);
}

export function createDataRepository(provider: StorageProvider) {
  let loadedEpoch: string | undefined;
  async function replacement(): Promise<WorkspaceReplacement | undefined> {
    const value = (await provider.read([WORKSPACE_REPLACEMENT_KEY]))[WORKSPACE_REPLACEMENT_KEY];
    if (value === undefined) return;
    const state = value as WorkspaceReplacement;
    if (!state || typeof state.epoch !== 'string' || typeof state.pending !== 'boolean' || state.previous === undefined ||
        (state.primaryMissing !== undefined && (state.primaryMissing !== true || state.previous !== null))) {
      throw new Error('Workspace rollback state is invalid. Nothing was changed.');
    }
    return state;
  }
  async function rollback(state: WorkspaceReplacement) {
    if (state.primaryMissing) {
      if (!provider.remove) throw new Error('Workspace rollback is unavailable. The original backup is preserved.');
      await provider.remove(STORAGE_KEY);
    } else await provider.write({ [STORAGE_KEY]: state.previous });
    const restored = (await provider.read([STORAGE_KEY]))[STORAGE_KEY];
    if (!sameWorkspaceValue(restored, state.primaryMissing ? undefined : state.previous)) throw new Error('Workspace rollback could not be verified. The original backup is preserved.');
    await provider.write({ [WORKSPACE_REPLACEMENT_KEY]: { ...state, pending: false } });
  }
  // Called only under the workspace lock. Publish the new epoch after the
  // primary is verified; a pending journal blocks readers and writers on error.
  async function replacePrimary(next: OtiumData, state: WorkspaceReplacement | undefined, previous: unknown,
    failureMessage: string, recovery?: RecoverySnapshot) {
    if (previous === undefined && !provider.remove) throw new Error('The current workspace could not be backed up. Nothing was changed.');
    const backup: WorkspaceReplacement = { epoch: state?.epoch ?? '', pending: true,
      previous: previous === undefined ? null : previous, ...(previous === undefined ? { primaryMissing: true } : {}) };
    const committed = { ...backup, epoch: crypto.randomUUID(), pending: false };
    const pendingWrite = { [WORKSPACE_REPLACEMENT_KEY]: backup };
    const commit = { [WORKSPACE_REPLACEMENT_KEY]: committed, ...(recovery ? { [RECOVERY_KEY]: recovery } : {}) };
    await assertStorageCapacity(provider, pendingWrite);
    await assertStorageCapacity(provider, { ...commit, [STORAGE_KEY]: next });
    await provider.write(pendingWrite);
    if (!sameWorkspaceValue(await replacement(), backup)) throw new Error('The workspace backup could not be verified. Nothing was changed.');
    try {
      await provider.write({ [STORAGE_KEY]: next });
      const stored = (await provider.read([STORAGE_KEY]))[STORAGE_KEY];
      if (!sameWorkspaceValue(stored, next)) throw new Error('The written workspace did not match the verified data.');
      await provider.write(commit);
    } catch (cause) {
      try { await rollback(backup); }
      catch { throw new Error('Rollback could not finish. Reload Otium to retry from the preserved backup.', { cause }); }
      throw new Error(failureMessage, { cause });
    }
  }
  function assertEpoch(epoch: string) {
    if (loadedEpoch !== epoch) throw new Error('The workspace was replaced. Reload Otium before making changes.');
  }
  async function readLatest(allowLegacy = false) {
    const values = await provider.read([STORAGE_KEY, 'links', 'theme']);
    const legacy = values[STORAGE_KEY] === undefined;
    if (legacy && !allowLegacy) throw new Error('Stored workspace is invalid. Original data has been preserved.');
    const raw = legacy ? values : values[STORAGE_KEY];
    const data = legacy ? migrateLegacyData(values) : parseSupportedData(raw);
    const rawSchemaVersion = legacy ? 0 : (raw as { schemaVersion: number }).schemaVersion;
    return { data, raw, legacy, rawSchemaVersion, normalize: legacy || !sameWorkspaceValue(raw, data) };
  }
  function prepareBackup(source: Awaited<ReturnType<typeof readLatest>>, previous: unknown) {
    // An older installation must not replace a backup from a newer version.
    try { validateRecovery(previous); }
    catch (cause) { if (cause instanceof UnsupportedStorageVersionError) throw cause; }
    const snapshot: RecoverySnapshot = {
      type: 'otium-recovery', recoveryVersion: RECOVERY_VERSION, createdAt: Date.now(),
      schemaVersion: source.rawSchemaVersion,
      data: source.raw, ...(source.legacy ? { format: 'legacy' } : {}),
    };
    // Keep raw data preserved by a previous restore without nesting backups.
    if (previous && typeof previous === 'object' && 'displacedData' in previous) {
      snapshot.displacedData = (previous as RecoverySnapshot).displacedData;
    }
    validateRecovery(snapshot);
    return snapshot;
  }
  async function writeBackup(snapshot: RecoverySnapshot, mandatory = true) {
    try {
      await provider.write({ [RECOVERY_KEY]: snapshot });
      if (mandatory && !sameWorkspaceValue((await provider.read([RECOVERY_KEY]))[RECOVERY_KEY], snapshot)) {
        throw new Error('The written recovery snapshot could not be verified.');
      }
    }
    catch { throw new Error('Recovery backup could not be saved. The original workspace has not been replaced.'); }
  }
  async function backup(source: Awaited<ReturnType<typeof readLatest>>, previous: unknown, mandatory = true) {
    await writeBackup(prepareBackup(source, previous), mandatory);
  }
  function load(): Promise<OtiumData> {
    return coordinated(async () => {
      const state = await replacement();
      const epoch = state?.epoch ?? '';
      if (loadedEpoch !== undefined) assertEpoch(epoch);
      if (state?.pending) await rollback(state);
      loadedEpoch = epoch;
      const source = await readLatest(true);
      if (source.normalize) {
        // A rewrite must never proceed without preserving its original data.
        const previous = (await provider.read([RECOVERY_KEY]))[RECOVERY_KEY];
        if (source.legacy && (state || previous !== undefined)) {
          // An absent primary after rollback is still absent. Do not replace a
          // real recovery snapshot with empty defaults or stale legacy keys.
          throw new Error('Stored workspace is invalid. Original data has been preserved.');
        }
        const newWorkspace = source.legacy && !state && previous === undefined && Object.keys(source.raw as object).length === 0;
        await backup(source, previous);
        await provider.write({ [STORAGE_KEY]: source.data, ...(newWorkspace ? { [BOOKMARK_IMPORT_ONBOARDING_KEY]: true } : {}) });
      } else {
        // Routine refresh is best effort; its failure cannot invalidate a
        // successfully validated primary workspace or remove the old snapshot.
        try {
          const previous = (await provider.read([RECOVERY_KEY]))[RECOVERY_KEY];
          const status = recoveryStatus(previous);
          const snapshot = previous as RecoverySnapshot | undefined;
          // Keep the raw schema-2 rollback copy across routine refreshes.
          const migrationBackup = status.available && snapshot?.recoveryVersion === RECOVERY_VERSION &&
            snapshot.schemaVersion === LEGACY_WORKSPACE_SCHEMA_VERSION;
          if (!migrationBackup && (!status.available || Date.now() - status.createdAt! >= RECOVERY_REFRESH_MS)) await backup(source, previous, false);
        } catch (cause) {
          console.warn('Otium recovery snapshot refresh failed. The valid workspace remains available.', cause);
        }
      }
      return source.data;
    });
  }
  return {
    load,
    refresh: load,
    updateNotebook(change: (notebook: NotebookData) => NotebookData): Promise<NotebookData> {
      const expectedEpoch = loadedEpoch;
      return coordinated(async () => {
        const state = await replacement();
        if (state?.pending || expectedEpoch === undefined || expectedEpoch !== (state?.epoch ?? '')) {
          throw new Error('Reload Otium before making changes to this workspace.');
        }
        const source = await readLatest();
        if (source.normalize) throw new Error('Reload Otium before making changes to this workspace.');
        const current = source.data.notebook ?? EMPTY_NOTEBOOK;
        const next = parseNotebook(change(current));
        if (!sameWorkspaceValue(current, next)) {
          // Patch only Notebook onto the raw workspace; leave other domains
          // and any fields unknown to this build byte-for-byte equivalent.
          const values = { [STORAGE_KEY]: { ...(source.raw as OtiumData), notebook: next } };
          await assertStorageCapacity(provider, values);
          await provider.write(values);
        }
        return next;
      });
    },
    readNotebook(): Promise<NotebookData> {
      const expectedEpoch = loadedEpoch;
      return coordinated(async () => {
        const state = await replacement();
        if (state?.pending || expectedEpoch === undefined || expectedEpoch !== (state?.epoch ?? '')) {
          throw new Error('Reload Otium before making changes to this workspace.');
        }
        return (await readLatest()).data.notebook ?? EMPTY_NOTEBOOK;
      });
    },
    mutate(mutator: CoordinatedDataMutation, options?: DataMutationOptions): Promise<OtiumData> {
      const expectedEpoch = loadedEpoch;
      return coordinated(async () => {
        const state = await replacement();
        if (state?.pending || expectedEpoch !== (state?.epoch ?? '')) throw new Error('Reload Otium before making changes to this workspace.');
        const source = await readLatest();
        const { data: latest, normalize } = source;
        const previous = JSON.stringify(latest);
        // A mutator may edit its argument; preserve the original before invoking it.
        const next = parseSupportedData(await mutator(structuredClone(latest)));
        if (normalize || JSON.stringify(next) !== previous) {
          const snapshot = normalize || options?.backupBeforeDestructiveWrite
            ? prepareBackup(source, (await provider.read([RECOVERY_KEY]))[RECOVERY_KEY]) : null;
          if (options?.checkCapacity) {
            await assertStorageCapacity(provider, { [STORAGE_KEY]: next, ...(snapshot ? { [RECOVERY_KEY]: snapshot } : {}) });
          }
          if (snapshot) await writeBackup(snapshot);
          try { await provider.write({ [STORAGE_KEY]: next }); }
          catch (cause) {
            if (options?.writeFailureMessage) throw new Error(options.writeFailureMessage, { cause });
            throw cause;
          }
        }
        return next;
      });
    },
    exportWorkspace() {
      return coordinated(async () => {
        if ((await replacement())?.pending) throw new Error('Reload Otium before exporting the workspace.');
        const source = await readLatest();
        return { type: 'otium-workspace' as const, exportVersion: 1, exportedAt: Date.now(),
          schemaVersion: SCHEMA_VERSION, data: validateWorkspaceImport(source.data) };
      });
    },
    replaceWorkspace(candidate: OtiumData) {
      return coordinated(async () => {
        const next = validateWorkspaceImport(candidate);
        const state = await replacement();
        assertEpoch(state?.epoch ?? '');
        if (state?.pending) throw new Error('Reload Otium before importing another workspace.');
        const previous = (await provider.read([STORAGE_KEY]))[STORAGE_KEY];
        if (previous === undefined) throw new Error('The current workspace could not be backed up. Nothing was imported.');
        await replacePrimary(next, state, previous, 'Import failed. Your original workspace was restored.');
      });
    },
    async exportRecoveryData() {
      // A single raw read remains available even if coordination cannot start.
      // Export never writes storage or runs a migration.
      return {
        type: 'otium-raw-recovery' as const, exportVersion: 1, exportedAt: Date.now(),
        data: await provider.read([STORAGE_KEY, RECOVERY_KEY, WORKSPACE_REPLACEMENT_KEY, 'links', 'theme']),
      };
    },
    async getRecoveryStatus() {
      return recoveryStatus((await provider.read([RECOVERY_KEY]))[RECOVERY_KEY]);
    },
    restoreRecovery(expectedCreatedAt: number): Promise<void> {
      return coordinated(async () => {
        const state = await replacement();
        if (state?.pending) throw new Error('Reload Otium to finish workspace rollback.');
        assertEpoch(state?.epoch ?? '');
        const values = await provider.read([STORAGE_KEY, RECOVERY_KEY]);
        const { snapshot, data } = validateRecovery(values[RECOVERY_KEY]);
        if (snapshot.createdAt !== expectedCreatedAt) throw new Error('The recovery snapshot changed. Retry and confirm the latest snapshot.');
        // The shared journal preserves the displaced primary for raw recovery
        // export, including when the old primary is malformed or absent.
        await replacePrimary(data, state, values[STORAGE_KEY], 'Restore failed. Your original workspace was restored.',
          { ...snapshot, recoveryVersion: RECOVERY_VERSION });
      });
    },
    subscribe(onChange: (data: OtiumData) => void, onError: (cause: unknown) => void): () => void {
      let active = true;
      const unsubscribe = provider.subscribe?.(STORAGE_KEY, () => {
        // A replacement may publish a primary write before verification. Wait
        // for the transaction and read its final state, not the event payload.
        void coordinated(async () => {
          if (!active) return;
          const state = await replacement();
          if (state?.pending) throw new Error('Reload Otium to finish workspace rollback.');
          if (loadedEpoch !== undefined && loadedEpoch !== (state?.epoch ?? '')) return;
          const value = (await provider.read([STORAGE_KEY]))[STORAGE_KEY];
          if (active) onChange(parseSupportedData(value));
        }).catch(cause => { if (active) onError(cause); });
      }) ?? (() => {});
      try {
        const unsubscribeReplacement = provider.subscribe?.(WORKSPACE_REPLACEMENT_KEY, value => {
          const state = value as WorkspaceReplacement | undefined;
          if (state && !state.pending && loadedEpoch !== undefined && state.epoch !== loadedEpoch) window.location.reload();
        });
        return () => { active = false; unsubscribe(); unsubscribeReplacement?.(); };
      } catch (cause) { active = false; unsubscribe(); throw cause; }
    },
  };
}

export const dataRepository = createDataRepository(chromeStorageProvider);

const FOLDER_NAVIGATION_ORDER_KEY = 'otium:folderNavigationOrder';
const folderOrder = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((id): id is string => typeof id === 'string'))] : [];

// Keep this UI preference outside the workspace snapshot: sorting must not
// normalize or rewrite any workspace or recovery records.
export const folderNavigationOrder = {
  async read() {
    return folderOrder((await chromeStorageProvider.read([FOLDER_NAVIGATION_ORDER_KEY]))[FOLDER_NAVIGATION_ORDER_KEY]);
  },
  subscribe(onChange: (order: string[]) => void) {
    return chromeStorageProvider.subscribe?.(FOLDER_NAVIGATION_ORDER_KEY, value => onChange(folderOrder(value))) ?? (() => {});
  },
  move(id: string, anchor: string, after: boolean, defaults: string[]) {
    return coordinated(async () => {
      const latest = [...new Set([...await folderNavigationOrder.read(), ...defaults])];
      const next = latest.filter(entry => entry !== id);
      next.splice(next.indexOf(anchor) + Number(after), 0, id);
      if (next.some((entry, index) => entry !== latest[index])) {
        await chromeStorageProvider.write({ [FOLDER_NAVIGATION_ORDER_KEY]: next });
      }
      return next;
    });
  },
};
