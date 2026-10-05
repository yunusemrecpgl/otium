import { t, useLocale } from "../../i18n";
import type { WidgetInstance } from '../../domain/widget';
import type { InspectorWidgetConfig, ProjectWidgetConfig } from '../../domain/projectWidget';
import { readTextConfig, normalizeTextStyle } from '../../domain/text';
import { readNoteConfig } from '../../domain/note';
import { readTodoConfig } from '../../domain/todo';
import { readWebDataConfig } from '../../domain/webData';
import { useInspectorWidgetEditor } from '../../hooks/useInspectorWidgetEditor';
import { InspectorAppearance } from './InspectorAppearance';

export function WidgetAppearanceEditor({ instance, disabled, onUpdate, onPreview }: {
  instance: WidgetInstance; disabled: boolean;
  onUpdate: (id: string, config: ProjectWidgetConfig) => Promise<void>;
  onPreview: (id: string, config: InspectorWidgetConfig) => void;
}) {
  useLocale();
  const read = (value: WidgetInstance['config']): InspectorWidgetConfig => instance.type === 'note' ? readNoteConfig(value)
    : instance.type === 'todo' ? readTodoConfig(value) : instance.type === 'web-data' ? readWebDataConfig(value) : readTextConfig(value);
  const { config, latest, error, edit } = useInspectorWidgetEditor(instance, read, onUpdate, onPreview);
  return <>
    <InspectorAppearance style={config.style ?? {}} disabled={disabled}
      onChange={patch => edit({ style: normalizeTextStyle({ ...latest.current.style, ...patch }) })} />
    {error && <span className="form-error" role="alert">{t("Appearance could not be saved.")}</span>}
  </>;
}
