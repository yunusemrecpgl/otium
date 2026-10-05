import type { ComponentType } from 'react';
import type { ProjectCanvasItem } from '../../domain/projectCanvasItem';
import type { WidgetInstance } from '../../domain/widget';
import type { ProjectWidgetConfig, InspectorWidgetConfig } from '../../domain/projectWidget';
import { NoteFormattingBar, TodoFormattingBar, TextFormattingBar } from './NoteFormattingBar';
import type { WebDataStatus } from '../../domain/webData';

interface EditorProps {
  instance: WidgetInstance; disabled: boolean;
  onUpdate: (id: string, config: ProjectWidgetConfig) => Promise<void>;
  onPreview: (id: string, config: InspectorWidgetConfig) => void;
  webDataStatus?: WebDataStatus;
}

// Properties resolution stays separate from canvas renderers.
const widgetEditors: Partial<Record<string, { name: string; Editor: ComponentType<EditorProps> }>> = {
  text: { name: 'Text / Label', Editor: TextFormattingBar },
  note: { name: 'Note', Editor: NoteFormattingBar },
  todo: { name: 'Todo', Editor: TodoFormattingBar },
};
const portalEditors: Record<string, string> = { 'web-data': 'Web Data', resource: 'Resource', clip: 'Clip / Evidence', compare: 'Compare',
  rss: 'RSS Feed', formula: 'Formula', 'page-watch': 'Page Watch' };

export interface ProjectInspectorProps {
  item?: ProjectCanvasItem; instance?: WidgetInstance; disabled: boolean;
  onUpdate: EditorProps['onUpdate']; onPreview: EditorProps['onPreview'];
  webDataStatus?: WebDataStatus;
  onPortalTarget: (target: HTMLDivElement | null) => void;
}
export function inspectorWidgetName(type: string): string | undefined {
  return widgetEditors[type]?.name ?? portalEditors[type];
}
export function ProjectInspectorContent({ item, instance, disabled, onUpdate, onPreview, webDataStatus, onPortalTarget }: ProjectInspectorProps) {
  if (item?.type !== 'widget' || !instance) return null;
  const editor = widgetEditors[instance.type];
  return editor ? <editor.Editor key={instance.id} instance={instance} disabled={disabled} onUpdate={onUpdate} onPreview={onPreview} webDataStatus={webDataStatus} />
    : portalEditors[instance.type] ? <div ref={onPortalTarget} /> : <p className="muted">No properties available for this widget.</p>;
}
// Retained for future non-widget properties; widget selection uses the floating shell.
export function ProjectInspector(props: ProjectInspectorProps) {
  if (props.item?.type !== 'widget' || !props.instance) return null;
  return <aside className="project-inspector" aria-label="Project Inspector">
    <header>{inspectorWidgetName(props.instance.type) ?? 'Widget'}</header>
    <ProjectInspectorContent {...props} />
  </aside>;
}
