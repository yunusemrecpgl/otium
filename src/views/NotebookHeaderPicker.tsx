import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { observeNotebookPopover } from './notebookPopover';

export function NotebookHeaderPicker({ label, valueLabel, disabled, panelClass, indicator, preserveEditorFocus, children }: {
  label: string; valueLabel?: string; disabled: boolean; panelClass: string; indicator: ReactNode;
  preserveEditorFocus?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    const header = root?.closest<HTMLElement>('.notebook-note-header');
    if (!open || !root || !trigger || !panel || !header) return;
    const stopPositioning = observeNotebookPopover(header, trigger, panel);
    const dismissOutside = (event: PointerEvent) => {
      if (!event.composedPath().includes(root)) setOpen(false);
    };
    const dismissFromEditor = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || root.contains(document.activeElement)) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', dismissOutside, true);
    if (preserveEditorFocus) document.addEventListener('keydown', dismissFromEditor, true);
    return () => {
      stopPositioning?.();
      document.removeEventListener('pointerdown', dismissOutside, true);
      if (preserveEditorFocus) document.removeEventListener('keydown', dismissFromEditor, true);
    };
  }, [open, preserveEditorFocus]);

  function close() {
    setOpen(false);
    if (!preserveEditorFocus || rootRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
  }
  return <div ref={rootRef} className="notebook-tool-menu notebook-entry-picker"
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => {
      if (event.key !== 'Escape' || !open) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    }}>
    <button ref={triggerRef} type="button" className="quiet-button notebook-entry-trigger" disabled={disabled}
      onMouseDown={preserveEditorFocus ? event => event.preventDefault() : undefined}
      aria-expanded={open} aria-label={valueLabel ? `${label} · ${valueLabel}` : label} title={label} onClick={() => setOpen(current => !current)}>
      {indicator}<ChevronDown size={12} aria-hidden="true" />
    </button>
    {open && <div ref={panelRef} className={`notebook-tool-panel ${panelClass}`}>{children(close)}</div>}
  </div>;
}
