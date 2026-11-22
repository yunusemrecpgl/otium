import { useEffect, useRef, useState } from 'react';
import type { BookmarkImportRequest, BookmarkImportSummary } from '../../domain/importedBookmarks';
import { t } from '../../i18n';
import { RepeatedBookmarkImportError } from '../../services/bookmarkImportSafety';
import { readBrowserBookmarks } from '../../services/browserBookmarks';
import { permissionService } from '../../services/permissions';

export type ImportBookmarks = (request: BookmarkImportRequest) => Promise<BookmarkImportSummary>;

export function useBookmarkImport(onImport: ImportBookmarks, onBusyChange?: (busy: boolean) => void) {
  const [access, setAccess] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<BookmarkImportSummary | null>(null);
  const [denied, setDenied] = useState(false);
  const submitting = useRef(false);
  const available = permissionService.isAvailable();

  useEffect(() => {
    if (!available) return;
    let current = true, changed = false;
    const stop = permissionService.subscribe('bookmarks', granted => { changed = true; setAccess(granted); });
    void permissionService.has('bookmarks').catch(() => false).then(granted => {
      if (current && !changed) setAccess(granted);
    });
    return () => { current = false; stop(); };
  }, [available]);

  function clearFeedback() {
    setError(null); setSuccess(null); setDenied(false);
  }

  async function run(read: () => BookmarkImportRequest | null | Promise<BookmarkImportRequest | null>, browser = false) {
    if (submitting.current) return 'cancelled';
    submitting.current = true;
    setBusy(true); clearFeedback(); onBusyChange?.(true);
    try {
      const request = await read();
      if (!request) { setDenied(true); return 'denied'; }
      let summary: BookmarkImportSummary;
      try { summary = await onImport(request); }
      catch (cause) {
        if (!(cause instanceof RepeatedBookmarkImportError)) throw cause;
        // Confirm outside the storage lock, then rebuild from the latest workspace.
        if (!window.confirm(t(browser ? 'These browser bookmarks appear to have been imported before. Import them again?' : cause.message))) return 'cancelled';
        summary = await onImport({ ...request, allowRepeat: true });
      }
      setSuccess(summary);
      return 'imported';
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bookmarks could not be imported.');
      return 'failed';
    } finally { submitting.current = false; setBusy(false); onBusyChange?.(false); }
  }

  function fromBrowser(onlyIntoEmptyWorkspace = false) {
    if (!available || access === null) return Promise.resolve('cancelled' as const);
    return run(async () => {
      // Permission state was checked before the click. Request synchronously
      // from the click handler when access has not already been granted.
      if (!access) {
        const granted = await permissionService.request('bookmarks').catch(() => false);
        if (!granted) return null;
        setAccess(true);
      }
      return { ...await readBrowserBookmarks(), onlyIntoEmptyWorkspace };
    }, true);
  }

  return { busy, error, success, denied, canReadBrowser: available && access !== null, clearFeedback, fromBrowser, run };
}
