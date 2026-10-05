import { useState } from 'react';
import type { FormEvent } from 'react';

interface ProjectLinkFormProps {
  onAdd: (title: string, url: string) => void;
  disabled?: boolean;
}

export function ProjectLinkForm({ onAdd, disabled }: ProjectLinkFormProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      onAdd(title, url);
      setTitle('');
      setUrl('');
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Link could not be added.');
    }
  }

  return (
    <section className="project-link-form" aria-labelledby="project-link-title">
      <h2 id="project-link-title">Add Project Link</h2>
      <form onSubmit={submit}>
        <label htmlFor="project-site-name">Site name</label>
        <input spellCheck={false} id="project-site-name" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} disabled={disabled} autoComplete="off" />
        <label htmlFor="project-site-url">URL</label>
        <input id="project-site-url" type="text" inputMode="url" value={url} onChange={(event) => { setUrl(event.target.value); setError(null); }} required disabled={disabled} autoComplete="off" spellCheck={false} aria-invalid={!!error} aria-describedby={error ? 'project-link-error' : undefined} />
        {error && <p id="project-link-error" className="form-error" role="alert">{error}</p>}
        <button type="submit" className="quiet-button" disabled={disabled || !title.trim() || !url.trim()}>Add</button>
      </form>
    </section>
  );
}
