import type { WidgetInstance } from '../domain/widget';
import { normalizeTextStyle, readTextConfig } from '../domain/text';
import type { TextConfig, TextStyle } from '../domain/text';
import { useInspectorWidgetEditor } from './useInspectorWidgetEditor';

export function useTextWidgetEditor(instance: WidgetInstance, onUpdate: (id: string, config: TextConfig) => Promise<void>, onPreview?: (id: string, config: TextConfig) => void) {
  const { config, latest, error, flush, edit } = useInspectorWidgetEditor(instance, readTextConfig, onUpdate, onPreview);
  return { text: config.text, style: config.style ?? {}, error, flush,
    changeText: (text: string) => edit({ text }),
    changeStyle: (patch: Partial<TextStyle>) => edit({ style: normalizeTextStyle({ ...latest.current.style, ...patch }) }),
  };
}
