import { useEffect, useRef, useState } from 'react';
import { t, useLocale } from '../i18n';

export function EmptyTrashDialog({ onCancel, onEmpty, onBusyChange }: {
  onCancel: () => void; onEmpty: () => Promise<void>; onBusyChange: (busy: boolean) => void;
}) {
  useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement;
    node.showModal();
    return () => { node.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className="add-link-modal project-delete-dialog" aria-labelledby="empty-trash-title"
    onCancel={event => { event.preventDefault(); if (!pending.current) onCancel(); }}>
    <h1 id="empty-trash-title">{t('Empty Trash?')}</h1>
    <p>{t('This permanently deletes all items in Trash and cannot be undone.')}</p>
    {error && <p className="form-error" role="alert">{t('Trash could not be emptied. Please try again.')}</p>}
    <div className="modal-actions">
      <button type="button" autoFocus disabled={busy} onClick={onCancel}>{t('Cancel')}</button>
      <button type="button" className="project-destructive-action" disabled={busy} onClick={async () => {
        if (pending.current) return;
        pending.current = true; setBusy(true); setError(false); onBusyChange(true);
        try { await onEmpty(); }
        catch { setError(true); }
        finally { pending.current = false; setBusy(false); onBusyChange(false); }
      }}>{busy ? t('Deleting…') : t('Empty Trash')}</button>
    </div>
  </dialog>;
}
