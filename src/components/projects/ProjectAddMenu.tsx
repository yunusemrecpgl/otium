import { t, useLocale } from "../../i18n";
import { useEffect, useId, useRef, useState } from 'react';
import { WidgetRegistry } from '../../services/widgetRegistry';
import { WidgetIcon } from '../widgets/WidgetIcon';
import { Globe } from 'lucide-react';

export function ProjectAddMenu({ disabled, onWebsite, onWidget }: { disabled: boolean; enabledWidgetTypes: ReadonlySet<string>; onWebsite: () => void; onWidget: (type: string) => void }) {
  useLocale();
  const [panel, setPanel] = useState<'menu' | null>(null);
  const control = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const widgets = WidgetRegistry.getAll().filter(definition => definition.allowedScopes.includes('project'));
  useEffect(() => {
    if (!panel) return;
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !control.current?.contains(event.target)) setPanel(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPanel(null); trigger.current?.focus(); }
    };
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', outside, true); window.removeEventListener('keydown', escape); };
  }, [panel]);
  return <div ref={control} className="project-add-control">
    <button ref={trigger} type="button" className="quiet-button project-canvas-add-button" aria-label={t("Add to project")} title={t("Add to project")} disabled={disabled} aria-expanded={panel !== null}
      aria-controls={panel ? panelId : undefined} onClick={() => setPanel(current => current ? null : 'menu')}>+</button>
    {panel && <div ref={panelRef} id={panelId} className="project-add-panel" role="group" aria-label={t("Add to project")}>
      <button type="button" disabled={disabled} onClick={() => { setPanel(null); onWebsite(); }}><Globe size={15} /> {t("Website")}</button>
      {widgets.map(widget => <button key={widget.type} type="button" disabled={disabled}
        onClick={() => { setPanel(null); onWidget(widget.type); }}><WidgetIcon type={widget.type} size={15} /> {t(widget.name)}</button>)}
    </div>}
  </div>;
}

