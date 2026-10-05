import { t, useLocale } from "../../i18n";
import { lazy, memo, Suspense, useCallback, useMemo, useState } from 'react';
import type { ProjectCanvasItem } from '../../domain/projectCanvasItem';
import type { WidgetInstance } from '../../domain/widget';
import type { ProjectWidgetConfig } from '../../domain/projectWidget';
import type { InspectorWidgetConfig } from '../../domain/projectWidget';
import type { WebDataStatus } from '../../domain/webData';
import type { RegisterProjectQuickActions } from './ProjectContextToolbar';
import { WidgetRegistry } from '../../services/widgetRegistry';
import { ProjectCanvasResize } from './ProjectCanvasResize';
import { WidgetDraftBoundary } from '../../hooks/useWidgetDraftPersistence';
import { ErrorBoundary } from '../ErrorBoundary';

function createRenderers() {
  return {
    TextWidget: lazy(() => import('../widgets/TextWidget')),
    PageWatchWidget: lazy(() => import('../widgets/PageWatchWidget')),
    FormulaWidget: lazy(() => import('../widgets/FormulaWidget')),
    NoteWidget: lazy(() => import('../widgets/NoteWidget')),
    TodoWidget: lazy(() => import('../widgets/TodoWidget')),
    ResourceWidget: lazy(() => import('../widgets/ResourceWidget')),
    WebDataWidget: lazy(() => import('../widgets/WebDataWidget')),
    ClipWidget: lazy(() => import('../widgets/ClipWidget')),
    CompareWidget: lazy(() => import('../widgets/CompareWidget')),
    RssWidget: lazy(() => import('../widgets/RssWidget')),
  };
}
const initialRenderers = createRenderers();

export const ProjectCanvasWidget = memo(function ProjectCanvasWidget({ item, instance: storedInstance, draft, selected, singleSelected, disabled, getPoint, onInteraction, onResize, onError, onUpdate, onPreview, storedConfig, onWebDataStatus, inspectorTarget, onQuickActions }: {
  item: ProjectCanvasItem; instance: WidgetInstance; selected: boolean; singleSelected: boolean; disabled: boolean;
  draft?: InspectorWidgetConfig;
  getPoint: (x: number, y: number) => { x: number; y: number };
  onInteraction: (id: string, active: boolean) => void;
  onResize: (id: string, width: number, height: number, minSize?: { width: number; height: number }) => Promise<void>;
  onError: (message: string | null) => void;
  onUpdate: (id: string, config: ProjectWidgetConfig) => Promise<void>;
  onPreview: (id: string, config: InspectorWidgetConfig) => void;
  storedConfig: WidgetInstance['config'];
  onWebDataStatus: (id: string, status: WebDataStatus | null) => void;
  inspectorTarget?: HTMLElement | null;
  appearanceTarget?: HTMLElement | null;
  onQuickActions: RegisterProjectQuickActions;
}) {
  useLocale();
  const instance = useMemo(() => draft ? { ...storedInstance, config: draft as unknown as WidgetInstance['config'] } : storedInstance, [storedInstance, draft]);
  const interaction = useCallback((active: boolean) => onInteraction(item.id, active), [item.id, onInteraction]);
  const boundary = useMemo(() => ({ selected, inspectorOpen: !!inspectorTarget }), [selected, inspectorTarget]);
  const resetKey = useMemo(() => JSON.stringify([instance.id, instance.type, instance.version, instance.config, selected]), [instance, selected]);
  const [preview, setPreview] = useState<{ width: number; height: number } | null>(null);
  const [renderers, setRenderers] = useState(initialRenderers);
  const { TextWidget, PageWatchWidget, FormulaWidget, NoteWidget, TodoWidget, ResourceWidget, WebDataWidget, ClipWidget, CompareWidget, RssWidget } = renderers;
  const definition = WidgetRegistry.get(instance.type);
  const size = preview ?? item;
  return <div className="project-canvas-node project-canvas-widget" data-canvas-item={item.id} data-selected={selected || undefined}
    style={{ left: item.x, top: item.y, width: size.width, height: size.height, zIndex: item.zIndex }}>
    <ErrorBoundary resetKey={resetKey}
      onReset={() => setRenderers(createRenderers())}
      fallback={retry => <div className="project-widget-error" role="alert"><span>{t("Something went wrong")}</span>
        <button type="button" className="quiet-button" onClick={retry}>{t("Retry")}</button></div>}>
    <WidgetDraftBoundary.Provider value={boundary}>
    <Suspense fallback={<div className="project-widget-loading" role="status" aria-label={t("Loading widget")}><span aria-hidden="true" /></div>}>
      {instance.type === 'note' && <NoteWidget instance={instance} disabled={disabled} onUpdate={onUpdate} onPreview={onPreview} />}
      {instance.type === 'todo' && <TodoWidget instance={instance} disabled={disabled} onUpdate={onUpdate} onPreview={onPreview} />}
      {instance.type === 'resource' && <ResourceWidget instance={instance} disabled={disabled} onUpdate={onUpdate} inspectorTarget={inspectorTarget} onQuickActions={onQuickActions} />}
      {instance.type === 'web-data' && <WebDataWidget instance={instance} disabled={disabled} onUpdate={onUpdate} onPreview={onPreview}
        storedConfig={storedConfig} onStatus={onWebDataStatus} inspectorTarget={inspectorTarget} />}
      {instance.type === 'clip' && <ClipWidget instance={instance} disabled={disabled} onUpdate={onUpdate} inspectorTarget={inspectorTarget} onQuickActions={onQuickActions} />}
      {instance.type === 'compare' && <CompareWidget instance={instance} disabled={disabled} onUpdate={onUpdate} inspectorTarget={inspectorTarget} onQuickActions={onQuickActions} />}
      {instance.type === 'text' && <TextWidget instance={instance} disabled={disabled} onUpdate={onUpdate} onPreview={onPreview} />}
      {instance.type === 'page-watch' && <PageWatchWidget instance={instance} disabled={disabled} onUpdate={onUpdate} inspectorTarget={inspectorTarget} onQuickActions={onQuickActions} />}
      {instance.type === 'formula' && <FormulaWidget instance={instance} disabled={disabled} onUpdate={onUpdate} inspectorTarget={inspectorTarget} onQuickActions={onQuickActions} />}
      {instance.type === 'rss' && <RssWidget instance={instance} disabled={disabled} onUpdate={onUpdate} inspectorTarget={inspectorTarget} onQuickActions={onQuickActions} />}
    </Suspense>
    </WidgetDraftBoundary.Provider>
    </ErrorBoundary>
    <ProjectCanvasResize item={item} selected={singleSelected} capabilities={{ resizable: definition?.resizable ?? false, minSize: definition?.minSize }}
      disabled={disabled} getPoint={getPoint} onPreview={setPreview} onInteraction={interaction} onResize={onResize} onError={onError} />
  </div>;
});



