import type { OtiumData } from '../domain/data';
import { chromeStorageProvider } from './storage/provider';
import type { StorageProvider } from './storage/provider';
import { migrateLegacyData, SCHEMA_VERSION, STORAGE_KEY } from './storage/migrations';
import { parseSupportedData, RECOVERY_KEY, RECOVERY_REFRESH_MS, recoveryStatus, UnsupportedStorageVersionError, validateRecovery } from './storage/recovery';
import type { RecoverySnapshot } from './storage/recovery';
import { assertStorageCapacity } from './storage/capacity';

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
  async function readLatest() {
    const values = await provider.read([STORAGE_KEY, 'links', 'theme']);
    const legacy = values[STORAGE_KEY] === undefined;
    const raw = legacy ? values : values[STORAGE_KEY];
    const data = legacy ? migrateLegacyData(values) : parseSupportedData(raw);
    return { data, raw, legacy, normalize: legacy || JSON.stringify(raw) !== JSON.stringify(data) };
  }
  function prepareBackup(source: Awaited<ReturnType<typeof readLatest>>, previous: unknown) {
    // An older installation must not replace a backup from a newer version.
    try { validateRecovery(previous); }
    catch (cause) { if (cause instanceof UnsupportedStorageVersionError) throw cause; }
    const snapshot: RecoverySnapshot = {
      type: 'otium-recovery', recoveryVersion: 1, createdAt: Date.now(),
      schemaVersion: source.legacy ? 0 : source.data.schemaVersion,
      data: source.raw, ...(source.legacy ? { format: 'legacy' } : {}),
    };
    // Keep raw data preserved by a previous restore without nesting backups.
    if (previous && typeof previous === 'object' && 'displacedData' in previous) {
      snapshot.displacedData = (previous as RecoverySnapshot).displacedData;
    }
    validateRecovery(snapshot);
    return snapshot;
  }
  async function writeBackup(snapshot: RecoverySnapshot) {
    try { await provider.write({ [RECOVERY_KEY]: snapshot }); }
    catch { throw new Error('Recovery backup could not be saved. The original workspace has not been replaced.'); }
  }
  async function backup(source: Awaited<ReturnType<typeof readLatest>>, previous: unknown) {
    await writeBackup(prepareBackup(source, previous));
  }
  function load(): Promise<OtiumData> {
    return coordinated(async () => {
      const source = await readLatest();
      if (source.normalize) {
        // A rewrite must never proceed without preserving its original data.
        const previous = (await provider.read([RECOVERY_KEY]))[RECOVERY_KEY];
        await backup(source, previous);
        await provider.write({ [STORAGE_KEY]: source.data });
      } else {
        // Routine refresh is best effort; its failure cannot invalidate a
        // successfully validated primary workspace or remove the old snapshot.
        try {
          const previous = (await provider.read([RECOVERY_KEY]))[RECOVERY_KEY];
          const status = recoveryStatus(previous);
          if (!status.available || Date.now() - status.createdAt! >= RECOVERY_REFRESH_MS) await backup(source, previous);
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
    mutate(mutator: CoordinatedDataMutation, options?: DataMutationOptions): Promise<OtiumData> {
      return coordinated(async () => {
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
      return coordinated(async () => ({
        type: 'otium-workspace' as const, exportVersion: 1, exportedAt: Date.now(),
        schemaVersion: SCHEMA_VERSION, data: (await readLatest()).data,
      }));
    },
    async exportRecoveryData() {
      // A single raw read remains available even if coordination cannot start.
      // Export never writes storage or runs a migration.
      return {
        type: 'otium-raw-recovery' as const, exportVersion: 1, exportedAt: Date.now(),
        data: await provider.read([STORAGE_KEY, RECOVERY_KEY, 'links', 'theme']),
      };
    },
    async getRecoveryStatus() {
      return recoveryStatus((await provider.read([RECOVERY_KEY]))[RECOVERY_KEY]);
    },
    restoreRecovery(expectedCreatedAt: number): Promise<void> {
      return coordinated(async () => {
        const values = await provider.read([STORAGE_KEY, RECOVERY_KEY, 'links', 'theme']);
        const { snapshot, data } = validateRecovery(values[RECOVERY_KEY]);
        if (snapshot.createdAt !== expectedCreatedAt) throw new Error('The recovery snapshot changed. Retry and confirm the latest snapshot.');
        const { [RECOVERY_KEY]: _backup, ...displacedData } = values;
        // If preservation fails (including quota failure), do not replace anything.
        try { await provider.write({ [RECOVERY_KEY]: { ...snapshot, displacedData } }); }
        catch { throw new Error('Current recovery data could not be preserved. The workspace has not been replaced.'); }
        await provider.write({ [STORAGE_KEY]: data });
      });
    },
    subscribe(onChange: (data: OtiumData) => void, onError: (cause: unknown) => void): () => void {
      return provider.subscribe?.(STORAGE_KEY, value => {
        let next: OtiumData;
        try { next = parseSupportedData(value); }
        catch (cause) { onError(cause); return; }
        // Notifications synchronize UI only; they never trigger a save.
        onChange(next);
      }) ?? (() => {});
    },
  };
}

export const dataRepository = createDataRepository(chromeStorageProvider);
