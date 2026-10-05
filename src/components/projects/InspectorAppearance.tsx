import { t, useLocale } from "../../i18n";
import { Bold, Italic, Underline, Strikethrough } from 'lucide-react';
import type { TextStyle } from '../../domain/text';
import { FONT_SIZES, nearestFontSize, isFontSizeToken } from '../../domain/typography';
import { InspectorSection, InspectorSegments, InspectorPalette, AlignmentCycle } from './InspectorControls';

export function InspectorTypography({ style, disabled, onChange, defaultSize = 20, basic = false }: {
  style: TextStyle; disabled: boolean; onChange: (patch: Partial<TextStyle>) => void;
  defaultSize?: number; basic?: boolean;
}) {
  useLocale();
  const toggles = [{ key: 'bold', label: t("Bold"), Icon: Bold }, { key: 'italic', label: t("Italic"), Icon: Italic },
    { key: 'underline', label: t("Underline"), Icon: Underline }, { key: 'strike', label: t("Strikethrough"), Icon: Strikethrough }] as const;
  return <InspectorSection title={t("Typography")}>
    {!basic && <div className="inspector-segments" role="group" aria-label={t("Text formatting")}>
      {toggles.map(({ key, label, Icon }) => <button key={key} type="button" className="quiet-button"
        disabled={disabled} aria-label={label} title={label} aria-pressed={!!style[key]}
        onClick={() => onChange({ [key]: !style[key] })}><Icon size={15} aria-hidden="true" /></button>)}
    </div>}
    <div className="inspector-palette-control"><span>{t("Font family")}</span>
      <InspectorSegments label={t("Font family")} value={style.fontFamily ?? 'sans'} disabled={disabled}
        options={[{ value: 'sans', label: t("Sans") }, { value: 'mono', label: t("Mono") }, { value: 'serif', label: t("Serif") }]}
        onChange={fontFamily => onChange({ fontFamily })} />
    </div>
    <label>{t("Font size")}<select value={nearestFontSize(style.fontSize ?? defaultSize)} disabled={disabled} onChange={event => {
        if (isFontSizeToken(event.target.value)) onChange({ fontSize: event.target.value });
      }}>
        {Object.entries(FONT_SIZES).map(([token, size]) => <option key={token} value={token}>{t(size.label)}</option>)}
      </select>
    </label>
    {!basic && <AlignmentCycle value={style.textAlign} disabled={disabled} onChange={textAlign => onChange({ textAlign })} />}
  </InspectorSection>;
}

export function InspectorAppearance({ style, disabled, onChange }: {
  style: TextStyle; disabled: boolean; onChange: (patch: Partial<TextStyle>) => void;
}) {
  useLocale();
  return <InspectorSection title={t("Appearance")}>
    <InspectorPalette label={t("Text color")} value={style.textColor} disabled={disabled} onChange={textColor => onChange({ textColor })} />
    <InspectorPalette label={t("Background color")} value={style.backgroundColor} disabled={disabled} onChange={backgroundColor => onChange({ backgroundColor })} />
  </InspectorSection>;
}
