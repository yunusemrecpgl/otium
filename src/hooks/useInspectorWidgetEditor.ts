import { useWidgetDraftPersistence } from './useWidgetDraftPersistence';
import type { WidgetInstance } from '../domain/widget';

// Both editing surfaces receive the same Project draft. Only the active
// editor schedules a save; the Project commits the latest shared draft.
export function useInspectorWidgetEditor<T extends object>(instance: WidgetInstance,
  read: (value: WidgetInstance['config']) => T,
  onUpdate: (id: string, config: T) => Promise<void>, onPreview?: (id: string, config: T) => void, equals?: (a: T, b: T) => boolean) {
  const editor = useWidgetDraftPersistence({ value: read(instance.config),
    save: config => onUpdate(instance.id, config),
    preview: onPreview ? config => onPreview(instance.id, config) : undefined,
    equals, errorMessage: 'Widget could not be saved.',
  });
  return { ...editor, error: !!editor.error };
}
