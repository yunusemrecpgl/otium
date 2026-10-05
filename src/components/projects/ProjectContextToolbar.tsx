import { Copy, RefreshCw, ExternalLink, Palette } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ProjectWidgetConfig } from '../../domain/projectWidget';

export interface ProjectQuickActions {
  snapshot?: () => ProjectWidgetConfig;
  refresh?: { run: () => void; disabled: boolean };
  open?: { run: () => void; disabled: boolean; label: 'Open' | 'Open Source' };
}
export type RegisterProjectQuickActions = (id: string, actions: ProjectQuickActions | null) => void;

export function ProjectContextToolbar({ disabled, actions, onDuplicate, hidden, appearance, appearanceEditor, onAppearanceTarget }: {
  disabled: boolean; actions?: ProjectQuickActions; onDuplicate: () => void; hidden: boolean;
  appearance: boolean; appearanceEditor?: ReactNode; onAppearanceTarget: (target: HTMLDivElement | null) => void;
}) {
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), appearanceButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!appearanceOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setAppearanceOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      setAppearanceOpen(false); appearanceButton.current?.focus();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape, true); };
  }, [appearanceOpen]);
  return <div ref={root} className="project-context-toolbar" data-hidden={hidden || undefined} aria-hidden={hidden} inert={hidden} role="toolbar" aria-label="Selected item actions">
    <div className="project-context-group" role="group" aria-label="Object">
    <button type="button" className="quiet-button" title="Duplicate" aria-label="Duplicate" disabled={disabled} onClick={onDuplicate}><Copy size={16} aria-hidden="true" /></button>
    </div>
    {(actions?.refresh || actions?.open) && <div className="project-context-group" role="group" aria-label="Actions">
    {actions?.refresh && <button type="button" className="quiet-button" title="Refresh" aria-label="Refresh" disabled={disabled || actions.refresh.disabled} onClick={actions.refresh.run}><RefreshCw size={16} aria-hidden="true" /></button>}
    {actions?.open && <button type="button" className="quiet-button" title={actions.open.label} aria-label={actions.open.label} disabled={disabled || actions.open.disabled} onClick={actions.open.run}><ExternalLink size={16} aria-hidden="true" /></button>}
    </div>}
    {appearance && <div className="project-context-group" role="group" aria-label="Visual">
      <button ref={appearanceButton} type="button" className="quiet-button" title="Appearance" aria-label="Appearance" aria-expanded={appearanceOpen}
      aria-pressed={appearanceOpen} disabled={disabled} onClick={() => setAppearanceOpen(open => !open)}><Palette size={16} aria-hidden="true" /></button>
    </div>}
    {appearanceOpen && <div className="project-context-popover" role="dialog" aria-label="Appearance">
      {appearanceEditor ?? <div ref={onAppearanceTarget} />}
    </div>}
  </div>;
}
