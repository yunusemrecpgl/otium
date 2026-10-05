import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { NewLink } from '../domain/link';
import { normalizeUrl } from '../utils/url';

interface AddLinkModalProps {
  onClose: () => void;
  onAdd: (link: NewLink) => Promise<void>;
  onCreateFolder?: () => void;
}

export function AddLinkModal({ onClose, onAdd, onCreateFolder }: AddLinkModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    element.showModal();
    nameInput.current?.focus();
    return () => {
      element.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const normalized = normalizeUrl(url);
    if (!title.trim() || !normalized) {
      setError('Enter a site name and a valid HTTP or HTTPS URL.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await onAdd({ title: title.trim(), url: normalized });
      onClose();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Link could not be saved. Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className="add-link-modal" aria-labelledby="add-link-title" onCancel={(event) => {
      event.preventDefault();
      onClose();
    }}>
      <form onSubmit={submit}>
        <h1 id="add-link-title">Add Link</h1>
        <label htmlFor="site-name">Site name</label>
        <input ref={nameInput} id="site-name" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} disabled={busy} autoComplete="off" />
        <label htmlFor="site-url">URL</label>
        <input id="site-url" type="text" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} required disabled={busy} autoComplete="off" spellCheck={false} aria-invalid={!!error} aria-describedby={error ? 'link-error' : undefined} />
        {error && <p id="link-error" className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          {onCreateFolder && <button type="button" onClick={onCreateFolder} disabled={busy}>Create Folder</button>}
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" disabled={busy || !title.trim() || !url.trim()}>{busy ? 'Adding…' : 'Add'}</button>
        </div>
      </form>
    </dialog>
  );
}


