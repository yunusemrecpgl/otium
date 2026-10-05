import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

export function ProjectToolbar({ name, onRename, onBack, disabled, children, rightActions }: {
  name: string; onRename: (name: string) => Promise<void>; onBack: () => void;
  disabled: boolean; children: ReactNode; rightActions: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const editingRef = useRef(false), pending = useRef(false);
  const commitRef = useRef(commit); commitRef.current = commit;
  useEffect(() => { if (editing) { input.current?.focus(); input.current?.select(); } }, [editing]);
  useEffect(() => {
    if (!editing) return;
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || input.current?.contains(event.target)) return;
      input.current?.blur();
      void commitRef.current();
    };
    window.addEventListener('pointerdown', outside, true);
    return () => window.removeEventListener('pointerdown', outside, true);
  }, [editing]);
  async function commit() {
    if (!editingRef.current || pending.current) return;
    if (!draft.trim()) { setError('A project name is required.'); input.current?.focus(); return; }
    pending.current = true;
    editingRef.current = false; setEditing(false);
    try {
      if (draft.trim() !== name) await onRename(draft.trim());
      editingRef.current = false; setEditing(false); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Project name could not be saved.'); }
    finally { pending.current = false; }
  }
  return <div className="project-toolbar">
    <button type="button" className="text-button" onClick={onBack} disabled={disabled}>← Projects</button>
    <header className="project-page-heading">
      <div className="project-inline-name">
        {editing ? <input spellCheck={false} ref={input} aria-label="Project name" value={draft} disabled={disabled} onChange={event => setDraft(event.target.value)}
          onBlur={() => { void commit(); }} onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); void commit(); }
            if (event.key === 'Escape') { event.preventDefault(); editingRef.current = false; setEditing(false); setDraft(name); setError(null); }
          }} /> : <h1><button type="button" disabled={disabled} title="Edit project name" onClick={() => {
            setDraft(name); setError(null); editingRef.current = true; setEditing(true);
          }}>{name}</button></h1>}
        {error && <span className="form-error" role="alert">{error}</span>}
      </div>
      <div className="project-page-actions">{children}</div>
    </header>
    <div className="project-toolbar-right">{rightActions}</div>
  </div>;
}
