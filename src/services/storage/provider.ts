export interface StorageProvider {
  read(keys: string[]): Promise<Record<string, unknown>>;
  write(values: Record<string, unknown>): Promise<void>;
  capacity?(replacedKeys: string[]): Promise<{ usedBytes: number; replacedBytes: number; quotaBytes: number }>;
  subscribe?(key: string, onChange: (value: unknown) => void): () => void;
}

interface ChromeStorageArea {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  getBytesInUse(keys: string[] | null): Promise<number>;
  QUOTA_BYTES: number;
}

function localArea(): ChromeStorageArea {
  const api = (globalThis as typeof globalThis & {
    chrome?: { storage?: { local?: ChromeStorageArea } };
  }).chrome;
  if (!api?.storage?.local) {
    throw new Error('Storage is unavailable. Open Otium as an extension and reload it at brave://extensions to apply the storage permission.');
  }
  return api.storage.local;
}

// Chrome-specific calls are confined to this provider.
export const chromeStorageProvider: StorageProvider = {
  read: (keys) => localArea().get(keys),
  write: (values) => localArea().set(values),
  async capacity(replacedKeys) {
    const area = localArea();
    const [usedBytes, replacedBytes] = await Promise.all([area.getBytesInUse(null), area.getBytesInUse(replacedKeys)]);
    return { usedBytes, replacedBytes, quotaBytes: area.QUOTA_BYTES };
  },
  subscribe(key, onChange) {
    const api = (globalThis as typeof globalThis & { chrome?: { storage?: {
      onChanged?: {
        addListener(listener: (changes: Record<string, { newValue?: unknown }>, area: string) => void): void;
        removeListener(listener: (changes: Record<string, { newValue?: unknown }>, area: string) => void): void;
      };
    } } }).chrome?.storage?.onChanged;
    if (!api) throw new Error('Storage synchronization is unavailable. Open Otium as an extension.');
    const changed = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && Object.hasOwn(changes, key)) onChange(changes[key].newValue);
    };
    api.addListener(changed);
    return () => api.removeListener(changed);
  },
};
