type OptionalPermission = 'favicon';
interface PermissionDetails { permissions?: string[]; origins?: string[] }
interface PermissionEvent {
  addListener(listener: (details: PermissionDetails) => void): void;
  removeListener(listener: (details: PermissionDetails) => void): void;
}
interface PermissionApi {
  contains(details: PermissionDetails): Promise<boolean>;
  request(details: PermissionDetails): Promise<boolean>;
  onAdded: PermissionEvent;
  onRemoved: PermissionEvent;
}

function browserApi() {
  return (globalThis as typeof globalThis & {
    chrome?: { permissions?: PermissionApi; runtime?: { id?: string; getURL(path: string): string } };
  }).chrome;
}

export const permissionService = {
  isAvailable: () => Boolean(browserApi()?.runtime?.id && browserApi()?.permissions),
  async has(permission: OptionalPermission): Promise<boolean> {
    if (!this.isAvailable()) return false;
    return browserApi()!.permissions!.contains({ permissions: [permission] });
  },
  async request(permission: OptionalPermission): Promise<boolean> {
    if (!this.isAvailable()) return false;
    // Called directly from Enable's click handler, preserving the user gesture.
    const granted = await browserApi()!.permissions!.request({ permissions: [permission] });
    if (permission === 'favicon') { revision++; updateFavicon(granted); }
    return granted;
  },
};

let faviconGranted = false;
let revision = 0;
let accessRevision = 0;
const listeners = new Set<() => void>();
function notifyAccessChange() {
  accessRevision++;
  listeners.forEach(listener => listener());
}
function updateFavicon(granted: boolean) {
  if (faviconGranted === granted) return;
  faviconGranted = granted;
  notifyAccessChange();
}
function added(details: PermissionDetails) {
  if (details.permissions?.includes('favicon')) { revision++; updateFavicon(true); }
  if (details.origins?.length) notifyAccessChange();
}
function removed(details: PermissionDetails) {
  if (details.permissions?.includes('favicon')) { revision++; updateFavicon(false); }
  if (details.origins?.length) notifyAccessChange();
}

export const faviconPermission = {
  getSnapshot: () => faviconGranted,
  getAccessSnapshot: () => accessRevision,
  subscribe(listener: () => void) {
    listeners.add(listener);
    const api = permissionService.isAvailable() ? browserApi()?.permissions : undefined;
    if (listeners.size === 1 && api) {
      api.onAdded.addListener(added);
      api.onRemoved.addListener(removed);
      const version = ++revision;
      void permissionService.has('favicon').then(granted => {
        if (version === revision) updateFavicon(granted);
      }).catch(() => { if (version === revision) updateFavicon(false); });
    }
    return () => {
      listeners.delete(listener);
      if (!listeners.size && api) {
        revision++;
        api.onAdded.removeListener(added);
        api.onRemoved.removeListener(removed);
      }
    };
  },
};

export function getBrowserFaviconUrl(pageUrl: string, size = 32): string | null {
  const runtime = browserApi()?.runtime;
  if (!faviconGranted || !runtime?.id) return null;
  try {
    const url = new URL(runtime.getURL('/_favicon/'));
    url.searchParams.set('pageUrl', pageUrl);
    url.searchParams.set('size', String(size));
    return url.href;
  } catch { return null; }
}
