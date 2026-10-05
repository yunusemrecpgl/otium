import { t, useLocale } from "../../i18n";
import { NotebookPen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { WidgetInstance } from '../../domain/widget';
import type { NoteConfig } from '../../domain/note';
import { readNoteConfig } from '../../domain/note';
import { useInspectorWidgetEditor } from '../../hooks/useInspectorWidgetEditor';
import { widgetSurface, widgetTypography, widgetTitleTypography } from './widgetAppearance';

export default function NoteWidget({ instance, disabled, onUpdate, onPreview }: {
  instance: WidgetInstance; disabled: boolean;
  onUpdate: (id: string, config: NoteConfig) => Promise<void>;
  onPreview?: (id: string, config: NoteConfig) => void;
}) {
  useLocale();
  const { config, error, flush, edit } = useInspectorWidgetEditor(instance, readNoteConfig, onUpdate, onPreview);
  const [editing, setEditing] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const listed = config.listStyle === 'bullet' || config.listStyle === 'numbered';
  useEffect(() => { if (editing) textarea.current?.focus(); }, [editing]);
  let number = 0;
  return <div className="note-widget" style={widgetSurface(config.style)}>
    <header className="note-widget-header">
      <NotebookPen size={16} aria-hidden="true" />
      <input spellCheck={false} aria-label={t("Note title")} value={config.title} disabled={disabled} onBlur={flush} style={widgetTitleTypography(config.style)}
        onChange={event => edit({ title: event.target.value })} />
    </header>
    {listed && !editing ? <button type="button" className="note-list-preview" aria-label={t("Edit Note text")} disabled={disabled}
      style={widgetTypography(config.style)} onClick={() => setEditing(true)}>
      {config.text ? config.text.split('\n').map((line, index) => <span className="note-list-line" key={index}>
        <span className="note-list-marker" aria-hidden="true">{line.trim() ? config.listStyle === 'bullet' ? '•' : `${++number}.` : ''}</span>
        <span className="note-list-text">{line || '\u00a0'}</span>
      </span>) : <span className="muted">{t("Write a note…")}</span>}
    </button> : <textarea ref={textarea} spellCheck={false} aria-label={t("Note text")} placeholder={t("Write a note…")} value={config.text} disabled={disabled} style={widgetTypography(config.style)}
      onChange={event => edit({ text: event.target.value })} onBlur={() => { flush(); setEditing(false); }} />}
    {error && <p className="form-error" role="alert">{t("Note could not be saved.")}</p>}
  </div>;
}
