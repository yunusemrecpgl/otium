import { t, useLocale } from "../../i18n";
import type { ReactNode } from 'react';
import { PROJECT_COLORS } from '../../domain/projectColor';
import type { ProjectColor } from '../../domain/projectColor';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import type { TextStyle } from '../../domain/text';

export function AlignmentCycle({ value = 'left', disabled, onChange }: {
  value?: TextStyle['textAlign']; disabled: boolean; onChange: (value: NonNullable<TextStyle['textAlign']>) => void;
}) {
  useLocale();
  const next = value === 'left' ? 'center' : value === 'center' ? 'right' : 'left';
  const Icon = value === 'center' ? AlignCenter : value === 'right' ? AlignRight : AlignLeft;
  return <button type="button" className="quiet-button" disabled={disabled}
    title={t("Align {0}; click to align {1}", { 0: t(value), 1: t(next) })} aria-label={t("Text alignment: {0}. Change to {1}", { 0: t(value), 1: t(next) })}
    onClick={() => onChange(next)}><Icon size={16} aria-hidden="true" /></button>;
}

export function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  useLocale();
  return <section className="inspector-section"><h3>{title}</h3>{children}</section>;
}

export function InspectorSegments<T extends string>({ label, value, options, disabled, onChange }: {
  label: string; value: T; options: readonly { value: T; label: string; icon?: ReactNode }[];
  disabled: boolean; onChange: (value: T) => void;
}) {
  useLocale();
  return <div className="inspector-segments" role="group" aria-label={label}>
    {options.map(option => <button key={option.value} type="button" className="quiet-button" disabled={disabled}
      aria-label={t(option.label)} title={t(option.label)} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
      {option.icon ?? t(option.label)}
    </button>)}
  </div>;
}

export function InspectorPalette({ label, value, disabled, onChange }: {
  label: string; value?: ProjectColor; disabled: boolean; onChange: (color?: ProjectColor) => void;
}) {
  useLocale();
  return <div className="inspector-palette-control"><span>{label}</span>
    <div className="inspector-palette" role="group" aria-label={label}>
      <button type="button" className="quiet-button" disabled={disabled} aria-pressed={!value}
        onClick={() => onChange(undefined)}>{t("Auto")}</button>
      {PROJECT_COLORS.map(color => <button key={color} type="button" className="project-color-swatch"
        data-project-color={color} aria-label={`${label}: ${t(color)}`} title={t(color)} disabled={disabled}
        aria-pressed={value === color} onClick={() => onChange(color)} />)}
    </div>
  </div>;
}
