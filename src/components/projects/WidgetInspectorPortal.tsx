import { t, useLocale } from "../../i18n";
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { InspectorSection } from './InspectorControls';

// The existing widget owns config and runtime state; this only renders its
// additional properties surface in the selected Inspector shell.
export function WidgetInspectorPortal({ target, children }: { target?: HTMLElement | null; children: ReactNode }) {
  useLocale();
  return target ? createPortal(<div className="project-inspector-properties">{children}</div>, target) : null;
}
export function InspectorField({ label, children }: { label: string; children: ReactNode }) {
  useLocale();
  return <label>{label}{children}</label>;
}
export function InspectorGeneral({ title, disabled, onChange, onBlur }: {
  title: string; disabled: boolean; onChange: (value: string) => void; onBlur: () => void;
}) {
  useLocale();
  return <InspectorSection title={t("General")}><InspectorField label={t("Title")}>
    <input spellCheck={false} value={title} disabled={disabled} onBlur={onBlur} onChange={event => onChange(event.target.value)} />
  </InspectorField></InspectorSection>;
}
