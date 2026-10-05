import type { StorageProvider } from './provider';

const CAPACITY_HEADROOM_RATIO = 0.1;
const MINIMUM_HEADROOM_BYTES = 256 * 1024;

// Include all local keys (recovery, legacy data and caches), subtract only keys
// being replaced, and conservatively estimate their serialized UTF-8 size.
export async function assertStorageCapacity(provider: StorageProvider, values: Record<string, unknown>) {
  let capacity;
  try {
    if (!provider.capacity) throw new Error('Unavailable');
    capacity = await provider.capacity(Object.keys(values));
  } catch { throw new Error('Storage capacity could not be checked. Nothing was imported.'); }
  const { usedBytes, replacedBytes, quotaBytes } = capacity;
  if (![usedBytes, replacedBytes, quotaBytes].every(Number.isFinite) ||
      usedBytes < 0 || replacedBytes < 0 || replacedBytes > usedBytes || quotaBytes <= 0) {
    throw new Error('Storage capacity could not be checked. Nothing was imported.');
  }
  const encoder = new TextEncoder();
  const nextBytes = Object.entries(values).reduce((total, [key, value]) =>
    total + encoder.encode(key).byteLength + encoder.encode(JSON.stringify(value)).byteLength, 0);
  const headroom = Math.max(MINIMUM_HEADROOM_BYTES, quotaBytes * CAPACITY_HEADROOM_RATIO);
  if (usedBytes - replacedBytes + nextBytes > quotaBytes - headroom) {
    throw new Error('Not enough storage capacity for this import. The workspace is unchanged.');
  }
}
