import type { ReactNode } from 'react';
import { PROJECT_COLORS } from '../../domain/projectColor';
import type { ProjectColor } from '../../domain/projectColor';

export function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="inspector-section"><h3>{title}</h3>{children}</section>;
}

export function InspectorSegments<T extends string>({ label, value, options, disabled, onChange }: {
  label: string; value: T; options: readonly { value: T; label: string; icon?: ReactNode }[];
  disabled: boolean; onChange: (value: T) => void;
}) {
  return <div className="inspector-segments" role="group" aria-label={label}>
    {options.map(option => <button key={option.value} type="button" className="quiet-button" disabled={disabled}
      aria-label={option.label} title={option.label} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
      {option.icon ?? option.label}
    </button>)}
  </div>;
}

export function InspectorPalette({ label, value, disabled, onChange }: {
  label: string; value?: ProjectColor; disabled: boolean; onChange: (color?: ProjectColor) => void;
}) {
  return <div className="inspector-palette-control"><span>{label}</span>
    <div className="inspector-palette" role="group" aria-label={label}>
      <button type="button" className="quiet-button" disabled={disabled} aria-pressed={!value}
        onClick={() => onChange(undefined)}>Auto</button>
      {PROJECT_COLORS.map(color => <button key={color} type="button" className="project-color-swatch"
        data-project-color={color} aria-label={`${label}: ${color}`} title={color} disabled={disabled}
        aria-pressed={value === color} onClick={() => onChange(color)} />)}
    </div>
  </div>;
}
