import { memo, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CompactFloatingInspectorShell } from './CompactFloatingInspectorShell';
import { ProjectInspectorContent, inspectorWidgetName } from './ProjectInspector';
import type { ProjectInspectorProps } from './ProjectInspector';

type Position = { x: number; y: number };
const widths: Record<string, number> = { text: 320, resource: 320, clip: 420, note: 640, todo: 420,
  'web-data': 420, rss: 420, formula: 420, compare: 540, 'page-watch': 540 };

function FloatingConfigurationInspector({ getAnchor, ...props }: ProjectInspectorProps & {
  getAnchor: () => DOMRect | undefined;
}) {
  const panel = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const manuallyMoved = useRef(false);
  const gesture = useRef<{ id: number; x: number; y: number; position: Position } | null>(null);
  const name = props.instance && props.item?.type === 'widget' ? inspectorWidgetName(props.instance.type) : undefined;
  const width = widths[props.instance?.type ?? ''] ?? 320;
  function clamp(point: Position): Position {
    const rect = panel.current?.getBoundingClientRect();
    return { x: Math.max(8, Math.min(point.x, window.innerWidth - (rect?.width ?? width) - 8)),
      y: Math.max(8, Math.min(point.y, window.innerHeight - (rect?.height ?? 48) - 8)) };
  }
  useLayoutEffect(() => {
    if (!name) { setPosition(null); manuallyMoved.current = false; return; }
    if (!panel.current) return;
    if (position) { setPosition(previous => previous && clamp(previous)); return; }
    const anchor = getAnchor(), rect = panel.current.getBoundingClientRect();
    const candidates = anchor ? [
      { x: anchor.right + 12, y: anchor.top },
      { x: anchor.left - rect.width - 12, y: anchor.top },
      { x: anchor.left, y: anchor.bottom + 12 },
      { x: anchor.left, y: anchor.top - rect.height - 12 },
    ] : [];
    const fits = candidates.find(point => point.x >= 8 && point.y >= 8 &&
      point.x + rect.width <= window.innerWidth - 8 && point.y + rect.height <= window.innerHeight - 8);
    setPosition(clamp(fits ?? candidates[0] ?? { x: window.innerWidth - rect.width - 24, y: 100 }));
  }, [name, props.instance?.id]);
  useLayoutEffect(() => {
    const resize = () => setPosition(previous => previous && clamp(previous));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [width]);
  if (!name) return null;
  return createPortal(<aside ref={panel} className="project-inspector floating-project-inspector" aria-label={`${name} properties`}
    style={{ width, left: position?.x ?? 8, top: position?.y ?? 8,
      maxHeight: `calc(100dvh - ${position?.y ?? 8}px - 8px)`, visibility: position ? undefined : 'hidden' }}>
    <header className="floating-inspector-handle"
      onPointerDown={event => {
        if (event.button !== 0 || !event.isPrimary || !position) return;
        event.preventDefault(); event.stopPropagation();
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, position };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const drag = gesture.current;
        if (!drag || drag.id !== event.pointerId) return;
        event.preventDefault(); event.stopPropagation();
        manuallyMoved.current = true;
        setPosition(clamp({ x: drag.position.x + event.clientX - drag.x, y: drag.position.y + event.clientY - drag.y }));
      }}
      onPointerUp={event => {
        if (gesture.current?.id !== event.pointerId) return;
        gesture.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { gesture.current = null; }} onLostPointerCapture={() => { gesture.current = null; }}>
      {name}
    </header>
    <div className="floating-inspector-body"><ProjectInspectorContent {...props} /></div>
  </aside>, document.querySelector('.otium-app') ?? document.body);
}

export const FloatingProjectInspector = memo(function FloatingProjectInspector({ getWorkspace, dragging, ...props }: ProjectInspectorProps & {
  getAnchor: () => DOMRect | undefined; getWorkspace: () => HTMLElement | null; dragging: boolean;
}) {
  const compact = props.item?.type === 'widget' && !!props.instance && ['note', 'todo', 'text', 'clip', 'resource', 'web-data', 'compare', 'rss', 'formula', 'page-watch'].includes(props.instance.type);
  return <>
    <CompactFloatingInspectorShell open={compact} dragging={dragging} getWorkspace={getWorkspace} getAnchor={props.getAnchor}>
      {compact && <ProjectInspectorContent {...props} />}
    </CompactFloatingInspectorShell>
    {!compact && <FloatingConfigurationInspector {...props} />}
  </>;
});
