import { useEffect, useRef, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { t, useLocale } from '../../i18n';
import { bookmarkImportOnboarding } from '../../services/bookmarkImportOnboarding';
import { permissionService } from '../../services/permissions';
import { websiteIconsOnboarding } from '../../services/websiteIconsOnboarding';
import { useBookmarkImport } from './useBookmarkImport';
import type { ImportBookmarks } from './useBookmarkImport';

export function BrowserBookmarkOnboarding({ workspaceEmpty, onImport }: { workspaceEmpty: boolean; onImport: ImportBookmarks }) {
  useLocale();
  const [visible, setVisible] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!workspaceEmpty || !permissionService.isAvailable()) return;
    let active = true, completed = false;
    function showIfPending() {
      void Promise.all([bookmarkImportOnboarding.pending(), websiteIconsOnboarding.completed()]).then(([pending, iconsDone]) => {
        if (active && !completed && pending && iconsDone) setVisible(true);
      }).catch(cause => console.warn('Bookmark onboarding could not be read.', cause));
    }
    let stopBookmarks = () => {}, stopIcons = () => {};
    try {
      stopBookmarks = bookmarkImportOnboarding.subscribe(() => { completed = true; setVisible(false); });
      stopIcons = websiteIconsOnboarding.subscribe(showIfPending);
    } catch (cause) { console.warn('Bookmark onboarding synchronization is unavailable.', cause); }
    showIfPending();
    return () => { active = false; stopBookmarks(); stopIcons(); };
  }, [workspaceEmpty]);

  useEffect(() => {
    if (!denied) return;
    const timer = window.setTimeout(() => setDenied(false), 6000);
    return () => window.clearTimeout(timer);
  }, [denied]);

  function finish(wasDenied = false) {
    setVisible(false);
    if (wasDenied) setDenied(true);
    void bookmarkImportOnboarding.complete().catch(cause => console.warn('Bookmark onboarding choice could not be saved.', cause));
  }

  return <>
    {visible && workspaceEmpty && <ImportPrompt onImport={onImport} onFinish={finish} />}
    {denied && <p className="workspace-error" role="status">{t('Bookmark access was not granted. You can still import exported HTML.')}</p>}
  </>;
}

function ImportPrompt({ onImport, onFinish }: { onImport: ImportBookmarks; onFinish: (denied?: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { busy, error, canReadBrowser, fromBrowser } = useBookmarkImport(onImport);
  useEffect(() => {
    const node = dialog.current!, previous = document.activeElement;
    node.showModal();
    return () => { node.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);

  return <dialog ref={dialog} className="website-icons-onboarding" aria-labelledby="browser-bookmarks-title"
    aria-describedby="browser-bookmarks-description" aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) onFinish(); }}>
    <div className="website-icons-illustration" aria-hidden="true"><Bookmark size={52} strokeWidth={1.25} /></div>
    <h2 id="browser-bookmarks-title">{t('Import your browser bookmarks')}</h2>
    <p id="browser-bookmarks-description">{t('Copy your bookmarks and folders into Otium once. Changes in Otium will not modify your browser bookmarks, and future browser changes will not sync.')}</p>
    <div className="website-icons-onboarding-actions">
      <button type="button" className="widget-access-primary" disabled={busy || !canReadBrowser} onClick={() => {
        void fromBrowser(true).then(result => {
          if (result === 'imported' || result === 'denied') onFinish(result === 'denied');
        });
      }}>{busy ? t('Importing…') : t('Import bookmarks')}</button>
      <button type="button" className="text-button" disabled={busy} onClick={() => onFinish()}>{t('Not now')}</button>
    </div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
  </dialog>;
}
