import { useEffect, useRef, useState } from 'react';
import type { FolderDraft, FolderIcon as Icon } from '../domain/folder';
import type { ProjectColor } from '../domain/projectColor';
import { FolderIconPicker, FolderColorPicker } from './FolderPickers';

export function CreateFolderModal({ onClose, onCreate }: { onClose: () => void; onCreate: (draft: FolderDraft) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<Icon>('folder');
  const [color, setColor] = useState<ProjectColor>('neutral');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement;
    element.showModal(); input.current?.focus();
    return () => { element.close(); if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className="add-link-modal" aria-labelledby="folder-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={async event => {
      event.preventDefault(); if (submitting.current) return;
      submitting.current = true; setBusy(true); setError(null);
      try { await onCreate({ name: name.trim(), icon, color }); onClose(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Folder could not be saved.'); }
      finally { submitting.current = false; setBusy(false); }
    }}>
      <h1 id="folder-title">Create Folder</h1>
      <label htmlFor="folder-name">Folder name (optional)</label>
      <input id="folder-name" ref={input} value={name} onChange={event => setName(event.target.value)} maxLength={40} disabled={busy} autoComplete="off" />
      <FolderIconPicker value={icon} onChange={setIcon} disabled={busy} />
      <FolderColorPicker value={color} onChange={setColor} disabled={busy} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button></div>
    </form>
  </dialog>;
}
