import { t, useLocale } from "../../i18n";
import { useTextWidgetEditor } from '../../hooks/useTextWidgetEditor';
import type { WidgetInstance } from '../../domain/widget';
import type { TextConfig } from '../../domain/text';
import { widgetSurface, widgetTypography } from './widgetAppearance';

export default function TextWidget({ instance, disabled, onUpdate, onPreview }: {
  instance: WidgetInstance; disabled: boolean; onUpdate: (id: string, config: TextConfig) => Promise<void>;
  onPreview?: (id: string, config: TextConfig) => void;
}) {
  useLocale();
  const { text, style, error, flush, changeText } = useTextWidgetEditor(instance, onUpdate, onPreview);
  return <div className="note-widget text-widget" style={widgetSurface(style)}>
    <textarea spellCheck={false} aria-label={t("Canvas text")} placeholder={t("Text / Label")} value={text} disabled={disabled} onBlur={flush} style={{
      ...widgetTypography(style), fontWeight: style.bold === undefined ? 500 : style.bold ? 700 : 400,
    }} onChange={event => {
      changeText(event.target.value);
    }} />
    {error && <span className="form-error" role="alert">{t("Text could not be saved.")}</span>}
  </div>;
}
