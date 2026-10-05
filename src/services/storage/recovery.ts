import type { OtiumData } from '../../domain/data';
import { WidgetRegistry } from '../widgetRegistry';
import { migrateLegacyData, parseCurrentData, SCHEMA_VERSION } from './migrations';

export const RECOVERY_KEY = 'recoveryData';
export const RECOVERY_REFRESH_MS = 24 * 60 * 60 * 1000;

export class UnsupportedStorageVersionError extends Error {}

export interface RecoverySnapshot {
  type: 'otium-recovery';
  recoveryVersion: 1;
  createdAt: number;
  schemaVersion: number;
  data: unknown;
  format?: 'legacy';
  // Export-only preservation of the value displaced by an explicit restore.
  // This is never considered a known-good restore candidate.
  displacedData?: Record<string, unknown>;
}

export interface RecoveryStatus {
  available: boolean;
  exists: boolean;
  createdAt?: number;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

export function parseSupportedData(value: unknown): OtiumData {
  const stored = record(value);
  if (typeof stored?.schemaVersion === 'number' && stored.schemaVersion > SCHEMA_VERSION) {
    throw new UnsupportedStorageVersionError('This workspace requires a newer Otium version. Original data has been preserved.');
  }
  if (Array.isArray(stored?.widgetInstances)) {
    for (const entry of stored.widgetInstances) {
      const widget = record(entry);
      const definition = typeof widget?.type === 'string' ? WidgetRegistry.get(widget.type) : undefined;
      if (widget && typeof widget.type === 'string' && (!definition ||
          (typeof widget.version === 'number' && widget.version > definition.version))) {
        throw new UnsupportedStorageVersionError('This workspace contains an unsupported widget version. Original data has been preserved.');
      }
    }
  }
  return parseCurrentData(value);
}

export function validateRecovery(value: unknown): { snapshot: RecoverySnapshot; data: OtiumData } {
  const envelope = record(value);
  if (envelope?.type === 'otium-recovery' && typeof envelope.recoveryVersion === 'number' && envelope.recoveryVersion > 1) {
    throw new UnsupportedStorageVersionError('This recovery snapshot requires a newer Otium version. Original data has been preserved.');
  }
  if (!envelope || envelope.type !== 'otium-recovery' || envelope.recoveryVersion !== 1 ||
      typeof envelope.createdAt !== 'number' || !Number.isFinite(envelope.createdAt) || envelope.createdAt <= 0 ||
      (envelope.format !== undefined && envelope.format !== 'legacy')) {
    throw new Error('No supported, valid recovery snapshot is available.');
  }
  let data: OtiumData;
  if (envelope.format === 'legacy') {
    if (envelope.schemaVersion !== 0 || !record(envelope.data)) throw new Error('Invalid legacy recovery snapshot.');
    data = migrateLegacyData(envelope.data as Record<string, unknown>);
  } else {
    if (envelope.schemaVersion !== record(envelope.data)?.schemaVersion) throw new Error('Invalid recovery schema.');
    data = parseSupportedData(envelope.data);
  }
  return { snapshot: envelope as unknown as RecoverySnapshot, data };
}

export function recoveryStatus(value: unknown): RecoveryStatus {
  try {
    return { available: true, exists: true, createdAt: validateRecovery(value).snapshot.createdAt };
  } catch {
    return { available: false, exists: value !== undefined };
  }
}
