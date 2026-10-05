import { t, useLocale } from "../../i18n";
import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Link } from '../../domain/link';
import type { Project } from '../../domain/project';
import type { ProjectCanvasItem } from '../../domain/projectCanvasItem';
import type { ProjectCanvasState, ProjectCanvasZoom } from '../../domain/projectCanvasState';
import { PROJECT_CANVAS_ZOOM_LEVELS } from '../../domain/projectCanvasState';
import { projectCanvasGroupPositions, resolveProjectCanvasGroupPositions } from '../../services/projectCanvas';
import { LinkItemContent } from '../LinkItemContent';
import { ProjectCanvasResize } from './ProjectCanvasResize';
import { LINK_CANVAS_CAPABILITIES } from '../../domain/projectCanvasRenderer';
import type { ProjectCanvasCapabilities } from '../../domain/projectCanvasRenderer';
import type { WidgetInstance } from '../../domain/widget';
import type { ProjectWidgetConfig } from '../../domain/projectWidget';
import { ProjectCanvasWidget } from './ProjectCanvasWidget';
import { FloatingProjectInspector } from './FloatingProjectInspector';
import type { InspectorWidgetConfig } from '../../domain/projectWidget';
import type { WebDataStatus } from '../../domain/webData';
import { ProjectContextToolbar } from './ProjectContextToolbar';
import { ownsProjectCanvasWheel } from './projectCanvasWheel';
import { useProjectCanvasLookup } from './useProjectCanvasLookup';

import type { ProjectQuickActions } from './ProjectContextToolbar';
import { WidgetRegistry } from '../../services/widgetRegistry';
import { activeProjectCanvasItems } from '../../services/projectCanvasValidation';

interface Props {
  project: Project;
  overlay: ReactNode;
  widgets: WidgetInstance[];
  onUpdateWidget: (id: string, config: ProjectWidgetConfig) => Promise<void>;
  onTrash: (ids: string[]) => Promise<void>;
  onDuplicate: (id: string, config?: ProjectWidgetConfig) => Promise<string>;
  onPlacementHint: (point: { x: number; y: number }) => void;
  links: Link[];
  items: ProjectCanvasItem[];
  state?: ProjectCanvasState;
  onZoom: (zoom: ProjectCanvasZoom) => Promise<void>;
  disabled: boolean;
  onOpenLink: (link: Link) => void;
  onMoveGroup: (ids: string[], anchorId: string, dx: number, dy: number) => Promise<void>;
  onMove: (id: string, x: number, y: number) => Promise<void>;
  onResize: (id: string, width: number, height: number, minSize?: { width: number; height: number }) => Promise<void>;
  onError: (message: string | null) => void;
}

const CanvasLink = memo(function CanvasLink({ item, link, disabled, onOpenLink, onResize, onError, getPoint, onDragging, selected, singleSelected, capabilities }: {
  item: ProjectCanvasItem; link: Link;
  getPoint: (x: number, y: number) => { x: number; y: number };
  onDragging: (id: string, dragging: boolean) => void;
  selected: boolean;
  singleSelected: boolean;
  capabilities: ProjectCanvasCapabilities;
} & Pick<Props, 'disabled' | 'onOpenLink' | 'onResize' | 'onError'>) {
  useLocale();
  const [sizePreview, setSizePreview] = useState<{ width: number; height: number } | null>(null);
  const interaction = useCallback((active: boolean) => onDragging(item.id, active), [item.id, onDragging]);
  const size = sizePreview ?? item;
  return <div className="project-canvas-node" data-canvas-item={item.id} data-selected={selected || undefined}
    style={{ left: item.x, top: item.y, width: size.width, height: size.height, zIndex: item.zIndex }}>
    <a href={link.url} target="_blank" rel="noopener noreferrer" draggable={false}
      className="workspace-slot link-item project-page-link" title={link.title} aria-label={link.title}
      style={{ left: 0, top: 0, width: '100%', height: '100%' }} onDragStart={event => event.preventDefault()}
      onClick={event => { event.preventDefault(); if (!disabled) onOpenLink(link); }}>
      <LinkItemContent title={link.title} url={link.url} />
    </a>
    <ProjectCanvasResize item={item} selected={singleSelected} capabilities={capabilities} disabled={disabled}
      getPoint={getPoint} onPreview={setSizePreview} onInteraction={interaction} onResize={onResize} onError={onError} />
  </div>;
});
interface ProjectCamera {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export function ProjectCanvas({ project, overlay, links, items, widgets, onUpdateWidget, onTrash, onDuplicate, onPlacementHint, state, onZoom, ...actions }: Props) {
  useLocale();
  const viewport = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [interactionIds, setInteractionIds] = useState<Set<string>>(new Set());
  const interacting = useRef(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quickBusy, setQuickBusy] = useState(false);
  const quickPending = useRef(false);
  const [widgetActions, setWidgetActions] = useState<Map<string, ProjectQuickActions>>(new Map());
  const registerQuickActions = useCallback((id: string, quick: ProjectQuickActions | null) => {
    setWidgetActions(previous => {
      const current = previous.get(id);
      if (quick ? current?.snapshot === quick.snapshot && current?.refresh?.run === quick.refresh?.run &&
        current?.refresh?.disabled === quick.refresh?.disabled && current?.open?.run === quick.open?.run &&
        current?.open?.disabled === quick.open?.disabled && current?.open?.label === quick.open?.label && !!current : !current) return previous;
      const next = new Map(previous);
      if (quick) next.set(id, quick); else next.delete(id);
      return next;
    });
  }, []);
  const [inspectorTarget, setInspectorTarget] = useState<HTMLDivElement | null>(null);
  const [appearanceTarget, setAppearanceTarget] = useState<HTMLDivElement | null>(null);
  const [webDataStatus, setWebDataStatus] = useState<Map<string, WebDataStatus>>(new Map());
  const reportWebDataStatus = useCallback((id: string, status: WebDataStatus | null) => {
    setWebDataStatus(previous => {
      const current = previous.get(id);
      if (status ? !!current && current.loading === status.loading && current.error === status.error &&
        current.value === status.value && current.updatedAt === status.updatedAt && current.available === status.available &&
        current.refresh === status.refresh : !current) return previous;
      const next = new Map(previous);
      if (status) next.set(id, status); else next.delete(id);
      return next;
    });
  }, []);
  const [widgetDrafts, setWidgetDrafts] = useState<Map<string, InspectorWidgetConfig>>(new Map());
  const latestDrafts = useRef(widgetDrafts);
  const previewWidget = useCallback((id: string, config: InspectorWidgetConfig) => {
    const current = latestDrafts.current.get(id);
    if (current === config || (current && JSON.stringify(current) === JSON.stringify(config))) return;
    latestDrafts.current = new Map(latestDrafts.current).set(id, config);
    setWidgetDrafts(latestDrafts.current);
  }, []);
  const widgetSaves = useRef(new Map<string, Promise<void>>());
  const widgetUpdate = useRef(onUpdateWidget); widgetUpdate.current = onUpdateWidget;
  const updateWidget = useCallback(function saveWidget(id: string, _config: ProjectWidgetConfig): Promise<void> {
    const pending = widgetSaves.current.get(id);
    if (pending) return pending.then(() => saveWidget(id, _config));
    // Every shared editor previews first. No remaining draft means a newer
    // flush already saved it; never write an old cleanup/debounce argument.
    if (!latestDrafts.current.has(id)) return Promise.resolve();
    const run = async () => {
      while (latestDrafts.current.has(id)) {
        const current = latestDrafts.current.get(id)!;
        await widgetUpdate.current(id, current);
        if (JSON.stringify(latestDrafts.current.get(id)) === JSON.stringify(current)) {
          latestDrafts.current = new Map(latestDrafts.current); latestDrafts.current.delete(id);
          setWidgetDrafts(latestDrafts.current);
        }
      }
    };
    const saving = run();
    widgetSaves.current.set(id, saving);
    const finished = () => { if (widgetSaves.current.get(id) === saving) widgetSaves.current.delete(id); };
    void saving.then(finished, finished);
    return saving;
  }, []);
  // High-fan-out handlers keep their identity while calling the latest parent.
  const actionRef = useRef({ ...actions, onUpdateWidget });
  actionRef.current = { ...actions, onUpdateWidget };
  const resizeItem = useCallback<Props['onResize']>((...args) => actionRef.current.onResize(...args), []);
  const reportError = useCallback<Props['onError']>(message => actionRef.current.onError(message), []);
  const openLink = useCallback<Props['onOpenLink']>(link => actionRef.current.onOpenLink(link), []);
  const saveWidget = useCallback<Props['onUpdateWidget']>((id, config) => actionRef.current.onUpdateWidget(id, config), []);
  const itemInteraction = useCallback((id: string, active: boolean) => {
    interacting.current = active; setDragging(active); setInteractionIds(active ? new Set([id]) : new Set());
  }, []);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [moveSaving, setMoveSaving] = useState(false);
  const trashTarget = useRef<HTMLDivElement>(null);
  const [trashState, setTrashState] = useState<'hidden' | 'revealing' | 'active'>('hidden');
  const trashStateRef = useRef(trashState);
  const [trashOver, setTrashOver] = useState(false);
  function updateTrashState(next: typeof trashState) {
    // Pointer events must see the same state immediately, before React commits.
    trashStateRef.current = next; setTrashState(next);
    if (next === 'hidden') setTrashOver(false);
  }
  function activateVisibleTrash() {
    const target = trashTarget.current;
    if (trashStateRef.current === 'revealing' && move.current?.moved && target &&
        Number(getComputedStyle(target).opacity) >= 0.99) updateTrashState('active');
  }
  function isOverTrash(x: number, y: number) {
    if (trashStateRef.current !== 'active' || !move.current?.moved) return false;
    const target = trashTarget.current;
    if (!target || Number(getComputedStyle(target).opacity) < 0.99) return false;
    // Read the currently rendered surface, including its slide, on every hit
    // test. Never retain a target rectangle across gestures.
    const rect = target.firstElementChild?.getBoundingClientRect();
    return !!rect && rect.width > 0 && rect.height > 0 &&
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }
  const move = useRef<{ pointerId: number; anchorId: string; startX: number; startY: number; point: { x: number; y: number }; items: ProjectCanvasItem[]; moved: boolean; capture: HTMLElement } | null>(null);
  useEffect(() => {
    // Reduced motion (or reversing a fade before it starts) may produce no
    // transitionend event. Only an already-visible surface can activate here.
    if (trashState === 'revealing') activateVisibleTrash();
  }, [trashState]);
  const marquee = useRef<{ pointerId: number; startX: number; startY: number; point: { x: number; y: number }; moved: boolean } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const suppressClick = useRef(false);
  const [zoomSaving, setZoomSaving] = useState(false);
  const zoomPending = useRef(false);
  const [panning, setPanning] = useState(false);
  const pan = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const [camera, setCamera] = useState<ProjectCamera>({ offsetX: 0, offsetY: 0, zoom: state?.zoom ?? 1 });
  const cameraRef = useRef(camera);
  const [zoomLevel, setZoomLevel] = useState<ProjectCanvasZoom>(state?.zoom ?? 1);
  const zoomLevelRef = useRef(zoomLevel);
  const persistedZoom = useRef(state?.zoom ?? 1); persistedZoom.current = state?.zoom ?? 1;
  const animation = useRef<{ frame: number; target: ProjectCamera } | null>(null);
  const placementHint = useRef(onPlacementHint);
  placementHint.current = onPlacementHint;
  useEffect(() => {
    const element = viewport.current;
    if (element) placementHint.current({ x: (element.clientWidth / 2 - camera.offsetX) / camera.zoom - 140,
      y: (element.clientHeight / 2 - camera.offsetY) / camera.zoom - 110 });
  }, [camera]);
  const getPoint = useCallback((x: number, y: number) => {
    const rect = viewport.current!.getBoundingClientRect();
    const view = cameraRef.current;
    return { x: (x - rect.left - view.offsetX) / view.zoom, y: (y - rect.top - view.offsetY) / view.zoom };
  }, []);
  function cancelSelectionGesture() {
    move.current = null; marquee.current = null;
    setInteractionIds(new Set());
    interacting.current = false; setDragging(false); setPositions(new Map()); setSelectionRect(null);
    updateTrashState('hidden');
  }
  function rectangle(start: { x: number; y: number }, end: { x: number; y: number }) {
    return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
  }

  function updateCamera(next: ProjectCamera) {
    cameraRef.current = next; setCamera(next);
  }

  function finishAnimation() {
    if (!animation.current) return;
    cancelAnimationFrame(animation.current.frame);
    const target = animation.current.target; animation.current = null;
    updateCamera(target);
  }
  function animateCamera(target: ProjectCamera) {
    if (animation.current) cancelAnimationFrame(animation.current.frame);
    animation.current = null;
    const start = cameraRef.current;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { updateCamera(target); return; }
    const began = performance.now();
    const frame = (now: number) => {
      const fraction = Math.min(1, (now - began) / 120), t = 1 - (1 - fraction) ** 3;
      updateCamera({ offsetX: start.offsetX + (target.offsetX - start.offsetX) * t,
        offsetY: start.offsetY + (target.offsetY - start.offsetY) * t, zoom: start.zoom + (target.zoom - start.zoom) * t });
      if (fraction < 1) animation.current = { frame: requestAnimationFrame(frame), target };
      else animation.current = null;
    };
    animation.current = { frame: requestAnimationFrame(frame), target };
  }
  useEffect(() => () => { if (animation.current) cancelAnimationFrame(animation.current.frame); }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => updateCamera(cameraRef.current));
    observer.observe(element);
    const blur = () => {
      const gesture = pan.current;
      pan.current = null; setPanning(false);
      if (gesture && element.hasPointerCapture(gesture.pointerId)) element.releasePointerCapture(gesture.pointerId);
      const pointerId = move.current?.pointerId ?? marquee.current?.pointerId;
      const capture = move.current?.capture ?? element;
      if (pointerId !== undefined) {
        cancelSelectionGesture();
        if (capture.hasPointerCapture(pointerId)) capture.releasePointerCapture(pointerId);
      }
    };
    window.addEventListener('blur', blur);
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      blur(); setSelectedIds(new Set());
    };
    window.addEventListener('keydown', escape);
    return () => {
      observer.disconnect(); window.removeEventListener('blur', blur);
      window.removeEventListener('keydown', escape);
    };
  }, []);

  const activeItems = useMemo(() => activeProjectCanvasItems({ projects: [project], links, widgetInstances: widgets, projectCanvasItems: items }, project.id),
    [project, links, widgets, items]);
  const activeById = useProjectCanvasLookup(activeItems);
  const activeIds = useMemo(() => new Set(activeById.keys()), [activeById]);
  const activeKey = useMemo(() => JSON.stringify([...activeIds].sort()), [activeIds]);
  const linksById = useProjectCanvasLookup(links);
  const widgetsById = useProjectCanvasLookup(widgets);
  useEffect(() => {
    setSelectedIds(previous => {
      const next = new Set([...previous].filter(id => activeIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
    if ([...interactionIds].some(id => !activeIds.has(id))) cancelSelectionGesture();
  }, [activeKey]);
  const nodes = useMemo(() => {
    const placements = new Map([...activeById.values()].filter(item => item.type === 'link').map(item => [item.referenceId, item]));
    return links.flatMap(link => {
      const item = placements.get(link.id);
      return item ? [{ item, link: linksById.get(link.id)! }] : [];
    });
  }, [activeById, links, linksById]);
  const widgetNodes = useMemo(() => [...activeById.values()].flatMap(item => {
    const instance = item.type === 'widget' && widgetsById.get(item.referenceId);
    return instance ? [{ item, instance }] : [];
  }), [activeById, widgetsById]);
  // Temporary render ranks preserve normal z-order (including DOM-order ties),
  // while reserving the upper range for interacting items. Never stored.
  const layeredItems = useMemo(() => {
    if (!interactionIds.size) return activeById;
    const renderOrder = [...nodes, ...widgetNodes].map(node => node.item)
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    return new Map(renderOrder.map((item, index) => [item.id, { ...item,
      zIndex: index + 1 + (interactionIds.has(item.id) ? renderOrder.length : 0) }]));
  }, [activeById, nodes, widgetNodes, interactionIds]);
  const renderedItems = useMemo(() => {
    if (!positions.size) return layeredItems;
    return new Map([...layeredItems].map(([id, item]) => {
      const point = positions.get(id);
      return [id, point ? { ...item, x: point.x, y: point.y } : item];
    }));
  }, [layeredItems, positions]);

  function changeZoom(next: ProjectCanvasZoom, anchor?: { x: number; y: number }, offset?: { x: number; y: number }) {
    if (interacting.current || pan.current || zoomPending.current || actions.disabled || !state) return;
    const element = viewport.current;
    if (!element) return;
    const previous = cameraRef.current;
    const point = anchor ?? { x: element.clientWidth / 2, y: element.clientHeight / 2 };
    const position = offset ?? {
      x: point.x - (point.x - previous.offsetX) / previous.zoom * next,
      y: point.y - (point.y - previous.offsetY) / previous.zoom * next,
    };
    zoomLevelRef.current = next; setZoomLevel(next);
    animateCamera({ offsetX: position.x, offsetY: position.y, zoom: next });
    if (next === state.zoom) return;
    zoomPending.current = true; setZoomSaving(true); actions.onError(null);
    void onZoom(next).catch(() => {
      actions.onError('Canvas zoom could not be saved. Please try again.');
      finishAnimation();
      const saved = persistedZoom.current;
      zoomLevelRef.current = saved; setZoomLevel(saved);
      updateCamera({ zoom: saved,
        offsetX: point.x - (point.x - previous.offsetX) / previous.zoom * saved,
        offsetY: point.y - (point.y - previous.offsetY) / previous.zoom * saved });
    }).finally(() => { zoomPending.current = false; setZoomSaving(false); });
  }
  // Saved zoom can change on refresh or save rollback; offsets remain transient.
  useEffect(() => {
    const next = state?.zoom ?? 1;
    if (next === zoomLevelRef.current) return;
    finishAnimation();
    const previous = cameraRef.current;
    zoomLevelRef.current = next; setZoomLevel(next);
    const element = viewport.current;
    const x = (element?.clientWidth ?? 0) / 2, y = (element?.clientHeight ?? 0) / 2;
    updateCamera({ zoom: next, offsetX: x - (x - previous.offsetX) / previous.zoom * next,
      offsetY: y - (y - previous.offsetY) / previous.zoom * next });
  }, [state?.zoom]);

  const wheelHandler = useRef<(event: WheelEvent) => void>(() => {});
  const lastWheel = useRef(0);
  wheelHandler.current = event => {
    if (event.defaultPrevented || !viewport.current || ownsProjectCanvasWheel(event.target, viewport.current)) return;
    event.preventDefault();
    if (!event.deltaY || performance.now() - lastWheel.current < 140) return;
    if (interacting.current || pan.current || zoomPending.current || actions.disabled || !state) return;
    const index = PROJECT_CANVAS_ZOOM_LEVELS.indexOf(zoomLevelRef.current);
    const nextIndex = Math.max(0, Math.min(PROJECT_CANVAS_ZOOM_LEVELS.length - 1, index + (event.deltaY < 0 ? 1 : -1)));
    if (index === nextIndex) return;
    lastWheel.current = performance.now();
    const rect = viewport.current!.getBoundingClientRect();
    changeZoom(PROJECT_CANVAS_ZOOM_LEVELS[nextIndex], { x: event.clientX - rect.left, y: event.clientY - rect.top });
  };
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => wheelHandler.current(event);
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);

  function fit() {
    const element = viewport.current;
    if (!element) return;
    const active = activeItems;
    if (!active.length) { changeZoom(1, undefined, { x: 0, y: 0 }); return; }
    const padding = 60;
    const bounds = active.reduce((bounds, item) => ({ left: Math.min(bounds.left, item.x), top: Math.min(bounds.top, item.y),
      right: Math.max(bounds.right, item.x + item.width), bottom: Math.max(bounds.bottom, item.y + item.height) }),
      { left: active[0].x, top: active[0].y, right: active[0].x + active[0].width, bottom: active[0].y + active[0].height });
    const left = bounds.left - padding, top = bounds.top - padding;
    const right = bounds.right + padding, bottom = bounds.bottom + padding;
    const ratio = Math.min(element.clientWidth / (right - left), element.clientHeight / (bottom - top));
    const next = [...PROJECT_CANVAS_ZOOM_LEVELS].reverse().find(level => level <= ratio) ?? PROJECT_CANVAS_ZOOM_LEVELS[0];
    changeZoom(next, undefined, { x: element.clientWidth / 2 - (left + right) / 2 * next,
      y: element.clientHeight / 2 - (top + bottom) / 2 * next });
  }
  const index = PROJECT_CANVAS_ZOOM_LEVELS.indexOf(zoomLevel);
  const controlsDisabled = dragging || panning || moveSaving || zoomSaving || actions.disabled || !state;
  const inspectedItem = selectedIds.size === 1 ? activeById.get(selectedIds.values().next().value!) : undefined;
  const inspectedWidget = inspectedItem?.type === 'widget' ? widgetsById.get(inspectedItem.referenceId) : undefined;
  const inspectedDraft = inspectedWidget && widgetDrafts.get(inspectedWidget.id);
  const inspectorInstance = useMemo(() => inspectedWidget && inspectedDraft
    ? { ...inspectedWidget, config: inspectedDraft as unknown as WidgetInstance['config'] } : inspectedWidget, [inspectedWidget, inspectedDraft]);
  const getWorkspace = useCallback(() => viewport.current, []);
  const inspectedId = inspectedItem?.id;
  const getInspectorAnchor = useCallback(() => inspectedId
    ? viewport.current?.querySelector<HTMLElement>(`[data-canvas-item="${CSS.escape(inspectedId)}"]`)?.getBoundingClientRect() : undefined, [inspectedId]);
  const selectedLink = inspectedItem?.type === 'link' ? linksById.get(inspectedItem.referenceId) : undefined;
  const contextSupported = !!selectedLink || !!(inspectedWidget && WidgetRegistry.get(inspectedWidget.type));
  const quickActions: ProjectQuickActions | undefined = selectedLink
    ? { open: { label: "Open", disabled: actions.disabled, run: () => actions.onOpenLink(selectedLink) } }
    : inspectedWidget?.type === 'web-data' ? { refresh: {
      disabled: !webDataStatus.get(inspectedWidget.id)?.available || !!webDataStatus.get(inspectedWidget.id)?.loading,
      run: () => webDataStatus.get(inspectedWidget.id)?.refresh(),
    } } : inspectedWidget ? widgetActions.get(inspectedWidget.id) : undefined;
  async function duplicateSelection() {
    if (!inspectedItem || quickPending.current) return;
    const id = inspectedItem.id;
    quickPending.current = true; setQuickBusy(true); actions.onError(null);
    try {
      {
        const config = inspectedWidget ? latestDrafts.current.get(inspectedWidget.id) ?? quickActions?.snapshot?.() : undefined;
        const newId = await onDuplicate(id, config);
        setSelectedIds(previous => previous.size === 1 && previous.has(id) ? new Set([newId]) : previous);
      }
    } catch { actions.onError('Item could not be duplicated. Please try again.'); }
    finally { quickPending.current = false; setQuickBusy(false); }
  }
  return <div className="project-workspace">
    <section className="project-canvas" aria-label={t("Project canvas")}>
    <div ref={viewport} className="project-canvas-viewport" data-pan-cursor={panning ? 'grabbing' : undefined}
      style={{ backgroundSize: `${20 * camera.zoom}px ${20 * camera.zoom}px`, backgroundPosition: `${camera.offsetX}px ${camera.offsetY}px`,
        backgroundImage: `radial-gradient(circle, var(--color-grid-dot) ${camera.zoom}px, transparent ${camera.zoom}px)` }}
      onPointerDownCapture={event => {
        if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
        finishAnimation();
        suppressClick.current = false;
        if (event.button === 0) {
          if (interacting.current || pan.current || moveSaving || zoomPending.current || actions.disabled || !event.isPrimary) return;
          const target = event.target instanceof Element ? event.target : null;
          const id = target?.closest('[data-canvas-item]')?.getAttribute('data-canvas-item');
          if (target?.closest('.project-canvas-resize, input, textarea, button, [contenteditable="true"]')) {
            if (id && target.closest('input, textarea, [contenteditable="true"]') && !event.ctrlKey && !event.metaKey) setSelectedIds(new Set([id]));
            return;
          }
          if (id && (event.ctrlKey || event.metaKey)) return;
          const point = getPoint(event.clientX, event.clientY);
          if (id) {
            const group = selectedIds.has(id) ? new Set([...selectedIds].filter(id => activeIds.has(id))) : new Set([id]);
            setSelectedIds(new Set(group));
            setInteractionIds(new Set(group));
            move.current = { pointerId: event.pointerId, anchorId: id, startX: event.clientX, startY: event.clientY,
              point, items: activeItems.filter(item => group.has(item.id)), moved: false,
              capture: (target?.closest('a') ?? target?.closest('[data-canvas-item]')) as HTMLElement };
          } else {
            const focused = document.activeElement;
            if (focused instanceof HTMLElement && focused.matches('.note-widget input, .note-widget textarea, .todo-widget input')) focused.blur();
            marquee.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, point, moved: false };
          }
          event.preventDefault(); event.stopPropagation();
          interacting.current = true; setDragging(true);
          (move.current?.capture ?? event.currentTarget).setPointerCapture(event.pointerId);
          return;
        }
        if (interacting.current || zoomPending.current || actions.disabled || event.pointerType !== 'mouse' || event.button !== 1 || !event.isPrimary) return;
        event.preventDefault(); event.stopPropagation();
        pan.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
          offsetX: cameraRef.current.offsetX, offsetY: cameraRef.current.offsetY, moved: false };
        setPanning(true); event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMoveCapture={event => {
        if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
        const drag = move.current, selection = marquee.current;
        const current = drag ?? selection;
        if (current?.pointerId === event.pointerId) {
          event.preventDefault(); event.stopPropagation();
          if (drag && drag.items.some(item => !activeIds.has(item.id))) { cancelSelectionGesture(); return; }
          if (!current.moved && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 5) return;
          current.moved = true; suppressClick.current = true;
          const point = getPoint(event.clientX, event.clientY);
          if (drag) {
            if (trashStateRef.current === 'hidden') updateTrashState('revealing');
            setTrashOver(isOverTrash(event.clientX, event.clientY));
            try {
              setPositions(new Map(projectCanvasGroupPositions(drag.items, drag.anchorId, point.x - drag.point.x, point.y - drag.point.y, false)
                .map(position => [position.id, position])));
            } catch {
              cancelSelectionGesture(); actions.onError('Canvas selection is unavailable. Please try again.');
            }
          }
          else if (selection) setSelectionRect(rectangle(selection.point, point));
          return;
        }
        const gesture = pan.current;
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        event.preventDefault(); event.stopPropagation();
        const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
        if (!gesture.moved && Math.hypot(dx, dy) < 5) return;
        gesture.moved = true;
        updateCamera({ ...cameraRef.current, offsetX: gesture.offsetX + dx, offsetY: gesture.offsetY + dy });
      }}
      onPointerUpCapture={event => {
        if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
        const drag = move.current, selection = marquee.current;
        const current = drag ?? selection;
        if (current?.pointerId === event.pointerId) {
          event.preventDefault(); event.stopPropagation();
          const validDrag = !!drag && drag.items.every(item => activeIds.has(item.id));
          const trashDrop = validDrag && !!drag?.moved && isOverTrash(event.clientX, event.clientY);
          // Disable drops synchronously, before releasing capture or saving.
          updateTrashState('hidden');
          move.current = null; marquee.current = null; setSelectionRect(null);
          setInteractionIds(new Set());
          const capture = drag?.capture ?? event.currentTarget;
          if (capture.hasPointerCapture(event.pointerId)) capture.releasePointerCapture(event.pointerId);
          const point = getPoint(event.clientX, event.clientY);
          if (drag && !validDrag) { cancelSelectionGesture(); return; }
          if (drag?.moved) {
            if (trashDrop) {
              setMoveSaving(true); actions.onError(null);
              void onTrash(drag.items.map(item => item.id)).then(() => setSelectedIds(new Set()))
                .catch(() => actions.onError('Canvas items could not be moved to Trash. Please try again.')).finally(() => {
                setPositions(new Map()); setMoveSaving(false); interacting.current = false; setDragging(false);
              });
              return;
            }
            const dx = point.x - drag.point.x, dy = point.y - drag.point.y;
            try {
              setPositions(new Map(resolveProjectCanvasGroupPositions(drag.items, drag.anchorId, dx, dy, activeItems).map(position => [position.id, position])));
            } catch (cause) {
              cancelSelectionGesture();
              actions.onError(cause instanceof Error ? cause.message : t("A safe canvas position could not be found."));
              return;
            }
            setMoveSaving(true); actions.onError(null);
            void actions.onMoveGroup(drag.items.map(item => item.id), drag.anchorId, dx, dy)
              .catch(() => actions.onError('Canvas positions could not be saved. Please try again.')).finally(() => {
              setPositions(new Map()); setMoveSaving(false); interacting.current = false; setDragging(false);
            });
          } else {
            if (selection?.moved) {
              const rect = rectangle(selection.point, point);
              setSelectedIds(new Set(activeItems.filter(item => item.x <= rect.x + rect.width && item.x + item.width >= rect.x &&
                item.y <= rect.y + rect.height && item.y + item.height >= rect.y).map(item => item.id)));
            } else if (selection) setSelectedIds(new Set());
            interacting.current = false; setDragging(false);
          }
          return;
        }
        if (pan.current?.pointerId !== event.pointerId) return;
        event.preventDefault(); event.stopPropagation();
        pan.current = null; setPanning(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancelCapture={event => {
        if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
        if ((move.current ?? marquee.current)?.pointerId === event.pointerId) {
          event.stopPropagation(); cancelSelectionGesture(); return;
        }
        if (pan.current?.pointerId !== event.pointerId) return;
        event.stopPropagation(); pan.current = null; setPanning(false);
      }}
      onLostPointerCapture={event => {
        if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
        if ((move.current ?? marquee.current)?.pointerId === event.pointerId) cancelSelectionGesture();
        if (pan.current?.pointerId === event.pointerId) { pan.current = null; setPanning(false); }
      }}
      onAuxClickCapture={event => {
        if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
        if (event.button !== 1) return;
        event.preventDefault(); event.stopPropagation();
      }} onClickCapture={event => {
        if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
        if (suppressClick.current && event.detail !== 0) {
          suppressClick.current = false; event.preventDefault(); event.stopPropagation(); return;
        }
        if (event.target instanceof Element && event.target.closest('.project-canvas-resize, input, textarea, button, [contenteditable="true"]')) return;
        const id = event.target instanceof Element ? event.target.closest('[data-canvas-item]')?.getAttribute('data-canvas-item') : null;
        if (id && (event.ctrlKey || event.metaKey)) {
          event.preventDefault(); event.stopPropagation();
          setSelectedIds(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
        } else setSelectedIds(id ? new Set([id]) : new Set());
      }}>
      <div className="project-canvas-space" style={{
        transform: `translate(${camera.offsetX}px, ${camera.offsetY}px) scale(${camera.zoom})` }}>
        {nodes.map(({ item, link }) => <CanvasLink key={item.id} item={renderedItems.get(item.id)!} link={link}
          onOpenLink={openLink} onResize={resizeItem} onError={reportError}
          disabled={actions.disabled || zoomSaving || moveSaving}
          selected={selectedIds.has(item.id)} singleSelected={selectedIds.size === 1 && selectedIds.has(item.id)} capabilities={LINK_CANVAS_CAPABILITIES}
          onDragging={itemInteraction} getPoint={getPoint} />)}
        {widgetNodes.map(({ item, instance }) => <ProjectCanvasWidget key={item.id} item={renderedItems.get(item.id)!} instance={instance} draft={widgetDrafts.get(instance.id)}
          selected={selectedIds.has(item.id)} singleSelected={selectedIds.size === 1 && selectedIds.has(item.id)}
          disabled={actions.disabled || zoomSaving || moveSaving} getPoint={getPoint}
          onInteraction={itemInteraction} onResize={resizeItem} onError={reportError}
          onUpdate={['text', 'note', 'todo', 'web-data'].includes(instance.type) ? updateWidget : saveWidget} onPreview={previewWidget}
          storedConfig={instance.config} onWebDataStatus={reportWebDataStatus}
          inspectorTarget={selectedIds.size === 1 && selectedIds.has(item.id) ? inspectorTarget : null} appearanceTarget={selectedIds.size === 1 && selectedIds.has(item.id) ? appearanceTarget : null} onQuickActions={registerQuickActions} />)}
        {selectionRect && <div className="project-canvas-marquee" style={{ left: selectionRect.x, top: selectionRect.y,
          width: selectionRect.width, height: selectionRect.height }} />}
        {!links.length && !widgetNodes.length && <p className="muted project-canvas-empty">{t("No websites yet.")}</p>}
      </div>
    </div>
    <div className="project-canvas-overlay">{overlay}</div>
    {contextSupported && <ProjectContextToolbar key={inspectedItem?.id} onAppearanceTarget={setAppearanceTarget}
      appearance={false}
      hidden={dragging} disabled={controlsDisabled || quickBusy} actions={quickActions}
      onDuplicate={() => { void duplicateSelection(); }} />}
    <div ref={trashTarget} className="project-canvas-trash" data-visible={trashState !== 'hidden' || undefined}
      data-active={trashState === 'active' && trashOver || undefined} aria-hidden={trashState === 'hidden'}
      onTransitionEnd={event => {
        if (event.target === event.currentTarget && event.propertyName === 'opacity') activateVisibleTrash();
      }}><div className="project-canvas-trash-surface"><Trash2 size={20} aria-hidden="true" /><span>{t("Trash")}</span></div></div>
    <div className="project-canvas-controls" role="group" aria-label={t("Canvas zoom")}>
      <button type="button" className="quiet-button" aria-label={t("Zoom out")} disabled={controlsDisabled || index === 0}
        onClick={() => changeZoom(PROJECT_CANVAS_ZOOM_LEVELS[index - 1])}>−</button>
      <span aria-live="polite">{Math.round(zoomLevel * 100)}%</span>
      <button type="button" className="quiet-button" aria-label={t("Zoom in")} disabled={controlsDisabled || index === PROJECT_CANVAS_ZOOM_LEVELS.length - 1}
        onClick={() => changeZoom(PROJECT_CANVAS_ZOOM_LEVELS[index + 1])}>+</button>
      <button type="button" className="quiet-button" disabled={controlsDisabled} onClick={fit}>{t("Fit")}</button>
    </div>
    </section>
    <FloatingProjectInspector getWorkspace={getWorkspace} dragging={dragging} getAnchor={getInspectorAnchor}
      item={inspectedItem} instance={inspectorInstance} disabled={actions.disabled}
      onUpdate={updateWidget} onPreview={previewWidget} webDataStatus={inspectedWidget ? webDataStatus.get(inspectedWidget.id) : undefined}
      onPortalTarget={setInspectorTarget} />
  </div>;
}



