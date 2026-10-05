import type { WidgetDefinition } from './widget';
import { normalizeTextStyle } from './text';
import type { TextStyle } from './text';

export const NOTE_DEFINITION: WidgetDefinition = {
  type: 'note', name: 'Note', version: 1, icon: 'notebook-pen',
  allowedScopes: ['project'], resizable: true,
  defaultSize: { width: 280, height: 220 }, minSize: { width: 180, height: 140 },
};

export interface NoteConfig { title: string; text: string; style?: TextStyle; listStyle?: 'none' | 'bullet' | 'numbered' }
export function readNoteConfig(value: { title?: unknown; text?: unknown; style?: unknown; listStyle?: unknown }): NoteConfig {
  return { title: String(value.title ?? ''), text: String(value.text ?? ''),
    ...(value.style ? { style: normalizeTextStyle(value.style) } : {}),
    ...(value.listStyle === 'none' || value.listStyle === 'bullet' || value.listStyle === 'numbered' ? { listStyle: value.listStyle } : {}) };
}
