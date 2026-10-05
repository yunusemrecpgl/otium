import { Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import type { TextStyle } from '../../domain/text';
import { FONT_SIZES, nearestFontSize, isFontSizeToken } from '../../domain/typography';
import { InspectorSection, InspectorSegments, InspectorPalette } from './InspectorControls';

export function InspectorTypography({ style, disabled, onChange, defaultSize = 20, basic = false }: {
  style: TextStyle; disabled: boolean; onChange: (patch: Partial<TextStyle>) => void;
  defaultSize?: number; basic?: boolean;
}) {
  const toggles = [{ key: 'bold', label: 'Bold', Icon: Bold }, { key: 'italic', label: 'Italic', Icon: Italic },
    { key: 'underline', label: 'Underline', Icon: Underline }, { key: 'strike', label: 'Strikethrough', Icon: Strikethrough }] as const;
  return <InspectorSection title="Typography">
    {!basic && <div className="inspector-segments" role="group" aria-label="Text formatting">
      {toggles.map(({ key, label, Icon }) => <button key={key} type="button" className="quiet-button"
        disabled={disabled} aria-label={label} title={label} aria-pressed={!!style[key]}
        onClick={() => onChange({ [key]: !style[key] })}><Icon size={15} aria-hidden="true" /></button>)}
    </div>}
    <div className="inspector-palette-control"><span>Font family</span>
      <InspectorSegments label="Font family" value={style.fontFamily ?? 'sans'} disabled={disabled}
        options={[{ value: 'sans', label: 'Sans' }, { value: 'mono', label: 'Mono' }, { value: 'serif', label: 'Serif' }]}
        onChange={fontFamily => onChange({ fontFamily })} />
    </div>
    <label>Font size
      <select value={nearestFontSize(style.fontSize ?? defaultSize)} disabled={disabled} onChange={event => {
        if (isFontSizeToken(event.target.value)) onChange({ fontSize: event.target.value });
      }}>
        {Object.entries(FONT_SIZES).map(([token, size]) => <option key={token} value={token}>{size.label}</option>)}
      </select>
    </label>
    {!basic && <InspectorSegments label="Text alignment" value={style.textAlign ?? 'left'} disabled={disabled}
      options={[{ value: 'left', label: 'Align left', icon: <AlignLeft size={15} /> },
        { value: 'center', label: 'Align center', icon: <AlignCenter size={15} /> },
        { value: 'right', label: 'Align right', icon: <AlignRight size={15} /> }]}
      onChange={textAlign => onChange({ textAlign })} />}
  </InspectorSection>;
}

export function InspectorAppearance({ style, disabled, onChange }: {
  style: TextStyle; disabled: boolean; onChange: (patch: Partial<TextStyle>) => void;
}) {
  return <InspectorSection title="Appearance">
    <InspectorPalette label="Text color" value={style.textColor} disabled={disabled} onChange={textColor => onChange({ textColor })} />
    <InspectorPalette label="Background color" value={style.backgroundColor} disabled={disabled} onChange={backgroundColor => onChange({ backgroundColor })} />
  </InspectorSection>;
}
