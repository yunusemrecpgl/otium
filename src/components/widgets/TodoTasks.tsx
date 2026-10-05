import { useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { TodoItem } from '../../domain/todo';
import type { TextStyle } from '../../domain/text';
import { widgetContentScale, widgetTypography } from './widgetAppearance';

export function TodoTasks({ items, disabled, style, onChange, onBlur }: {
  items: TodoItem[]; disabled: boolean; style?: TextStyle;
  onChange: (items: TodoItem[]) => void; onBlur: () => void;
}) {
  const inputs = useRef(new Map<string, HTMLInputElement>()), focusTask = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (focusTask.current) { inputs.current.get(focusTask.current)?.focus(); focusTask.current = null; }
  }, [items]);
  return <div className="todo-tasks">
    {items.map(item => <div key={item.id} className="todo-task" data-completed={item.completed || undefined}>
      <input spellCheck={false} type="checkbox" aria-label={`Complete ${item.text || 'task'}`} checked={item.completed} disabled={disabled}
        onChange={event => onChange(items.map(task => task.id === item.id ? { ...task, completed: event.target.checked } : task))} />
      <input spellCheck={false} type="text" aria-label="Task text" value={item.text} placeholder="Task" disabled={disabled} onBlur={onBlur}
        style={{ ...widgetTypography({ ...style, strike: false }), ...widgetContentScale(style),
          ...(item.completed ? { textDecoration: [style?.underline ? 'underline' : '', 'line-through'].filter(Boolean).join(' '),
            opacity: style?.textColor ? 0.65 : undefined } : {}) }}
        ref={element => { if (element) inputs.current.set(item.id, element); else inputs.current.delete(item.id); }}
        onChange={event => onChange(items.map(task => task.id === item.id ? { ...task, text: event.target.value } : task))} />
      <button type="button" className="todo-task-remove" aria-label="Remove task" disabled={disabled}
        onClick={() => onChange(items.filter(task => task.id !== item.id))}><X size={12} aria-hidden="true" /></button>
    </div>)}
    <button type="button" className="text-button todo-add-task" disabled={disabled} onClick={() => {
      const id = crypto.randomUUID(); focusTask.current = id;
      onChange([...items, { id, text: '', completed: false }]);
    }}>+ Add task</button>
  </div>;
}
