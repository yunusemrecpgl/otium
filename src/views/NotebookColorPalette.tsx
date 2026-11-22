import type { CSSProperties } from 'react';
import { NOTEBOOK_COLOR_TONES, notebookColorToken } from '../domain/notebookPalette';
import type { NotebookColorKind, NotebookColorTone } from '../domain/notebookPalette';
import { t } from '../i18n';
import { NotebookHeaderPicker } from './NotebookHeaderPicker';

export function NotebookColorSwatch({ value, kind }: { value?: unknown; kind: NotebookColorKind }) {
  const color = typeof value === 'string' ? value : kind === 'color' ? 'var(--color-text-primary)' : 'transparent';
  return <span className="notebook-color-swatch" aria-hidden="true" style={{ '--notebook-swatch': color } as CSSProperties} />;
}

export function NotebookColorOptions({ label, kind, value, onSelect, preserveEditorSelection, defaultSwatch }: {
  label: string; kind: NotebookColorKind; value: unknown;
  onSelect: (tone?: NotebookColorTone) => void; preserveEditorSelection?: boolean; defaultSwatch?: string;
}) {
  return <div className="notebook-color-options" role="group" aria-label={label}>
    {['Default' as const, ...NOTEBOOK_COLOR_TONES].map(name => {
      const tone = name === 'Default' ? undefined : name;
      const token = tone && notebookColorToken(kind, tone);
      return <button key={name} type="button" className="quiet-button" title={t(name)}
        aria-pressed={token ? value === token : !value}
        onMouseDown={preserveEditorSelection ? event => event.preventDefault() : undefined}
        onClick={() => onSelect(tone)}><NotebookColorSwatch value={token ?? defaultSwatch} kind={kind} /><span>{t(name)}</span></button>;
    })}
  </div>;
}

export function NotebookEntryColorPicker({ label, value, disabled, onChange }: {
  label: string; value?: NotebookColorTone; disabled: boolean; onChange: (tone?: NotebookColorTone) => void;
}) {
  const name = t(value ?? 'Default');
  const token = value && notebookColorToken('color', value);
  return <NotebookHeaderPicker label={label} valueLabel={name} disabled={disabled} panelClass="notebook-entry-color-panel"
    indicator={<><NotebookColorSwatch kind="color" value={token} /><span>{name}</span></>}>
    {close => <NotebookColorOptions kind="color" label={label} value={token} onSelect={tone => {
      close();
      if (tone !== value) onChange(tone);
    }} />}
  </NotebookHeaderPicker>;
}
