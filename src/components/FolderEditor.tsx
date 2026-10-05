import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Folder, FolderPatch } from '../domain/folder';
import { FolderIcon } from './FolderIcon';
import { FolderIconPicker, FolderColorPicker } from './FolderPickers';

interface Props {
  folder: Folder;
  onUpdate: (id: string, patch: FolderPatch) => Promise<void>;
  onFlush: () => void;
}

export function FolderEditor({ folder, onUpdate, onFlush }: Props) {
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState<'icon' | 'color' | null>(null);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const flush = useRef(onFlush);
  flush.current = onFlush;
  useEffect(() => () => flush.current(), []);

  function close(returnFocus = false) {
    setOpen(false); setPicker(null); flush.current();
    if (returnFocus) trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    textarea.current?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); }
    };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape); };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    const reposition = () => {
      const anchor = trigger.current?.getBoundingClientRect(), rect = panel.current?.getBoundingClientRect();
      if (!anchor || !rect) return;
      const next = { left: Math.max(8, Math.min(anchor.left - rect.width - 10, window.innerWidth - rect.width - 8)),
        top: Math.max(8, Math.min(anchor.bottom - rect.height, window.innerHeight - rect.height - 8)) };
      setPosition(previous => previous.left === next.left && previous.top === next.top ? previous : next);
    };
    reposition();
    const observer = new ResizeObserver(reposition);
    observer.observe(panel.current);
    window.addEventListener('resize', reposition);
    return () => { observer.disconnect(); window.removeEventListener('resize', reposition); };
  }, [open]);

  function update(patch: FolderPatch) {
    setError(null);
    void onUpdate(folder.id, patch).catch(cause => setError(cause instanceof Error ? cause.message : 'Folder could not be updated.'));
  }

  return <>
    <button ref={trigger} type="button" className="folder-edit-trigger" aria-label="Edit folder" aria-expanded={open} aria-controls={open ? 'folder-editor' : undefined}
      onClick={() => { if (open) close(); else { setOpen(true); setError(null); } }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
    </button>
    {open && <div ref={panel} id="folder-editor" className="folder-editor" role="region" aria-label="Folder settings" style={position}>
      <textarea ref={textarea} rows={2} maxLength={40} aria-label="Folder name" placeholder="Folder name" value={folder.name}
        aria-describedby="folder-name-count" onChange={event => update({ name: event.target.value.slice(0, 40) })} />
      <span id="folder-name-count" className="folder-name-count">{folder.name.length} / 40</span>
      <div className="folder-editor-tiles">
        <button type="button" className="folder-editor-tile" aria-label="Change folder icon" aria-expanded={picker === 'icon'} onClick={() => setPicker(previous => previous === 'icon' ? null : 'icon')}><FolderIcon icon={folder.icon} /></button>
        <button type="button" className="folder-editor-tile" aria-label="Change folder color" aria-expanded={picker === 'color'} onClick={() => setPicker(previous => previous === 'color' ? null : 'color')}>
          <span className="project-color-swatch folder-editor-color" data-project-color={folder.color} aria-hidden="true" />
        </button>
      </div>
      {picker === 'icon' && <FolderIconPicker value={folder.icon} onChange={icon => { update({ icon }); setPicker(null); }} />}
      {picker === 'color' && <FolderColorPicker value={folder.color} onChange={color => { update({ color }); setPicker(null); }} />}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>}
  </>;
}
