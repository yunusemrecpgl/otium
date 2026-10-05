import type { WidgetDefinition } from './widget';
import { normalizeTextStyle } from './text';
import type { TextStyle } from './text';

export const TODO_DEFINITION: WidgetDefinition = {
  type: 'todo', name: 'Todo', version: 1, icon: 'list-todo',
  allowedScopes: ['project'], resizable: true,
  defaultSize: { width: 300, height: 280 }, minSize: { width: 220, height: 180 },
};

export interface TodoItem { id: string; text: string; completed: boolean }
export interface TodoConfig { title: string; items: TodoItem[]; style?: TextStyle }
export function readTodoConfig(value: unknown): TodoConfig {
  if (!isTodoConfig(value)) return { title: 'Todo', items: [] };
  return { title: value.title, items: value.items,
    ...(value.style ? { style: normalizeTextStyle(value.style) } : {}) };
}

export function isTodoConfig(value: unknown): value is TodoConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<TodoConfig>;
  if (typeof config.title !== 'string' || !Array.isArray(config.items)) return false;
  const ids = new Set<string>();
  return config.items.every(item => {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.text !== 'string' || typeof item.completed !== 'boolean') return false;
    ids.add(item.id); return true;
  });
}
