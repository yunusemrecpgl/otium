import { t, useLocale } from "../../i18n";
import { useEffect, useRef, useState } from 'react';

export function DeleteProjectDialog({ onCancel, onDelete, onBusyChange }: {
  onCancel: () => void;
  onDelete: () => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement;
    node.showModal();
    return () => { node.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className="add-link-modal project-delete-dialog" aria-labelledby="delete-project-title"
    onCancel={event => { event.preventDefault(); if (!pending.current) onCancel(); }}>
    <h1 id="delete-project-title">{t("Delete this project?")}</h1>
    <p>{t("This removes the project from Otium. Its underlying website Links are not deleted.")}</p>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    <div className="modal-actions">
      <button type="button" autoFocus disabled={busy} onClick={onCancel}>{t("Cancel")}</button>
      <button type="button" className="project-destructive-action" disabled={busy} onClick={async () => {
        if (pending.current) return;
        pending.current = true; setBusy(true); setError(null); onBusyChange(true);
        try { await onDelete(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : t("Project could not be deleted.")); }
        finally { pending.current = false; setBusy(false); onBusyChange(false); }
      }}>{busy ? t("Deleting…") : t("Delete")}</button>
    </div>
  </dialog>;
}
