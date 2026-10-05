import { useSyncExternalStore } from 'react';
import { faviconPermission } from '../services/permissions';

export function useFaviconPermission() {
  return useSyncExternalStore(faviconPermission.subscribe, faviconPermission.getSnapshot);
}
