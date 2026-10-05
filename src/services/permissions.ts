import type { WidgetCapability } from '../domain/widget';

type OptionalPermission = 'favicon' | 'scripting' | 'activeTab';
const capabilityPermissions: Record<WidgetCapability, readonly OptionalPermission[]> = {
  'active-page-capture': ['activeTab', 'scripting'], scripting: ['scripting'], favicon: ['favicon'],
  // Enabling external sources never grants host access. Each configured origin
  // continues using the existing externalSources permission flow.
  'external-source': [],
};
function requiredPermissions(capabilities: readonly WidgetCapability[]) {
  return [...new Set(capabilities.flatMap(capability => capabilityPermissions[capability]))];
}
interface PermissionDetails { permissions?: string[]; origins?: string[] }
interface PermissionEvent {
  addListener(listener: (details: PermissionDetails) => void): void;
  removeListener(listener: (details: PermissionDetails) => void): void;
}
interface PermissionApi {
  contains(details: PermissionDetails): Promise<boolean>;
  request(details: PermissionDetails): Promise<boolean>;
  remove(details: PermissionDetails): Promise<boolean>;
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
  async hasCapabilities(capabilities: readonly WidgetCapability[]): Promise<boolean> {
    const permissions = requiredPermissions(capabilities);
    if (!permissions.length) return true;
    if (!this.isAvailable()) return false;
    try { return await browserApi()!.permissions!.contains({ permissions }); } catch { return false; }
  },
  requestCapabilities(capabilities: readonly WidgetCapability[]): Promise<boolean> {
    const permissions = requiredPermissions(capabilities);
    if (!permissions.length) return Promise.resolve(true);
    if (!this.isAvailable()) return Promise.resolve(false);
    // Call request before any await to retain the explicit click gesture.
    // Chrome does not prompt for permissions already granted.
    try { return browserApi()!.permissions!.request({ permissions }).then(granted => {
      refreshBrowserCapabilities(); return granted;
    }).catch(() => false); } catch { return Promise.resolve(false); }
  },
  async removeCapabilities(capabilities: readonly WidgetCapability[]): Promise<boolean> {
    // Clip and Rendered mode share optional scripting. Required activeTab and
    // Core Website Icons access are never removed by this action.
    const permissions = requiredPermissions(capabilities).filter(permission => permission === 'scripting');
    if (!permissions.length || !this.isAvailable()) return false;
    const removed = await browserApi()!.permissions!.remove({ permissions });
    if (removed) refreshBrowserCapabilities();
    return removed;
  },
};

type CapabilitySnapshot = Readonly<{ verified: boolean; capture: boolean; scripting: boolean; favicon: boolean }>;
let capabilitySnapshot: CapabilitySnapshot = { verified: false, capture: false, scripting: false, favicon: false };
let capabilityRevision = 0;
const capabilityListeners = new Set<() => void>();
function publishCapabilities(next: CapabilitySnapshot) {
  if (next.verified === capabilitySnapshot.verified && next.capture === capabilitySnapshot.capture && next.scripting === capabilitySnapshot.scripting && next.favicon === capabilitySnapshot.favicon) return;
  capabilitySnapshot = next;
  capabilityListeners.forEach(listener => listener());
}
function refreshBrowserCapabilities() {
  const revision = ++capabilityRevision;
  void Promise.all([permissionService.hasCapabilities(['active-page-capture']), permissionService.hasCapabilities(['scripting']), permissionService.hasCapabilities(['favicon'])])
    .then(([capture, scripting, favicon]) => {
      if (revision === capabilityRevision) publishCapabilities({ verified: true, capture, scripting, favicon });
    });
}
function capabilityChanged(details: PermissionDetails) {
  if (details.permissions?.some(permission => permission === 'scripting' || permission === 'activeTab' || permission === 'favicon')) refreshBrowserCapabilities();
}
function capabilityRemoved(details: PermissionDetails) {
  const removed = details.permissions ?? [];
  if (!removed.some(permission => permission === 'scripting' || permission === 'activeTab' || permission === 'favicon')) return;
  // Immediately block only revoked capabilities. Unrelated grants and normal
  // re-verification must not flicker existing capture/rendered workflows.
  publishCapabilities({ ...capabilitySnapshot, verified: false,
    capture: removed.includes('scripting') || removed.includes('activeTab') ? false : capabilitySnapshot.capture,
    scripting: removed.includes('scripting') ? false : capabilitySnapshot.scripting,
    favicon: removed.includes('favicon') ? false : capabilitySnapshot.favicon });
  capabilityChanged(details);
}
export const browserCapabilities = {
  getSnapshot: () => capabilitySnapshot,
  subscribe(listener: () => void) {
    capabilityListeners.add(listener);
    const api = permissionService.isAvailable() ? browserApi()?.permissions : undefined;
    if (capabilityListeners.size === 1) {
      api?.onAdded.addListener(capabilityChanged); api?.onRemoved.addListener(capabilityRemoved);
      refreshBrowserCapabilities();
    }
    return () => {
      capabilityListeners.delete(listener);
      if (!capabilityListeners.size) {
        capabilityRevision++;
        api?.onAdded.removeListener(capabilityChanged); api?.onRemoved.removeListener(capabilityRemoved);
      }
    };
  },
};

export class BrowserCapabilityRequiredError extends Error {
  readonly capabilities: readonly WidgetCapability[];
  constructor(capabilities: readonly WidgetCapability[]) {
    super('Browser page access is required. Allow access to use this feature.');
    this.capabilities = capabilities;
    this.name = 'BrowserCapabilityRequiredError';
  }
}

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
