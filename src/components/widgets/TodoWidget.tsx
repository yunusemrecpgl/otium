import { t, useLocale } from "../../i18n";
import { ListTodo } from 'lucide-react';
import type { WidgetInstance } from '../../domain/widget';
import { readTodoConfig } from '../../domain/todo';
import type { TodoConfig } from '../../domain/todo';
import { useInspectorWidgetEditor } from '../../hooks/useInspectorWidgetEditor';
import { widgetSurface, widgetTitleTypography } from './widgetAppearance';
import { TodoTasks } from './TodoTasks';

export default function TodoWidget({ instance, disabled, onUpdate, onPreview }: {
  instance: WidgetInstance; disabled: boolean;
  onUpdate: (id: string, config: TodoConfig) => Promise<void>;
  onPreview?: (id: string, config: TodoConfig) => void;
}) {
  useLocale();
  const { config, error, flush, edit } = useInspectorWidgetEditor(instance, readTodoConfig, onUpdate, onPreview);
  return <div className="note-widget todo-widget" style={widgetSurface(config.style)}>
    <header className="note-widget-header">
      <ListTodo size={16} aria-hidden="true" />
      <input spellCheck={false} aria-label={t("Todo title")} value={config.title} disabled={disabled} onBlur={flush} style={widgetTitleTypography(config.style)}
        onChange={event => edit({ title: event.target.value })} />
    </header>
    <TodoTasks items={config.items} style={config.style} disabled={disabled} onBlur={flush} onChange={items => edit({ items })} />
    {error && <p className="form-error" role="alert">{t("Todo could not be saved.")}</p>}
  </div>;
}
