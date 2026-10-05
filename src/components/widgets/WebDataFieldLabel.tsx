import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { WidgetDraftBoundary } from '../../hooks/useWidgetDraftPersistence';

export function WebDataFieldLabel({ label, disabled, style, onCommit }: {
  label: string; disabled: boolean; style?: CSSProperties; onCommit: (label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const cancelled = useRef(false);
  const active = useRef(false), latest = useRef(draft), mounted = useRef(true);
  const commit = useRef(onCommit); commit.current = onCommit;
  const boundary = useContext(WidgetDraftBoundary);
  const previousBoundary = useRef(boundary);
  function finish() {
    if (!active.current) return;
    active.current = false;
    if (!cancelled.current) commit.current(latest.current);
    if (mounted.current) setEditing(false);
  }
  useLayoutEffect(() => {
    const previous = previousBoundary.current; previousBoundary.current = boundary;
    if (previous?.selected && !boundary?.selected) finish();
  }, [boundary?.selected]);
  useEffect(() => {
    mounted.current = true;
    const hidden = () => { if (document.visibilityState === 'hidden') finish(); };
    const leaving = () => finish();
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', leaving);
    window.addEventListener('beforeunload', leaving);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', leaving);
      window.removeEventListener('beforeunload', leaving);
      mounted.current = false; finish();
    };
  }, []);
  return editing ? <input autoFocus spellCheck={false} className="web-data-field-label" aria-label="Field label" value={draft} style={style}
    disabled={disabled} onFocus={event => event.target.select()} onChange={event => { latest.current = event.target.value; setDraft(event.target.value); }} onBlur={finish}
    onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); event.currentTarget.blur(); }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelled.current = true; active.current = false; setEditing(false); }
    }} /> : <button type="button" className="web-data-field-label" disabled={disabled} title={label} style={style}
    onClick={() => { cancelled.current = false; active.current = true; latest.current = label; setDraft(label); setEditing(true); }}>{label || 'Value'}</button>;
}
