import { useRef, useState } from 'react';
import type { ProjectCanvasItem } from '../../domain/projectCanvasItem';
import type { ProjectCanvasCapabilities } from '../../domain/projectCanvasRenderer';
import { snapProjectCanvasSize } from '../../services/projectCanvas';

export function ProjectCanvasResize({ item, selected, capabilities, disabled, getPoint, onPreview, onInteraction, onResize, onError }: {
  item: ProjectCanvasItem;
  selected: boolean;
  capabilities: ProjectCanvasCapabilities;
  disabled: boolean;
  getPoint: (x: number, y: number) => { x: number; y: number };
  onPreview: (size: { width: number; height: number } | null) => void;
  onInteraction: (active: boolean) => void;
  onResize: (id: string, width: number, height: number, minSize?: { width: number; height: number }) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const gesture = useRef<{ pointerId: number; x: number; y: number; width: number; height: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const cancel = () => { gesture.current = null; onPreview(null); onInteraction(false); };
  if (!selected || !capabilities.resizable) return null;
  return <button type="button" className="project-canvas-resize" aria-label="Resize canvas item" disabled={disabled || saving}
    onClick={event => { event.preventDefault(); event.stopPropagation(); }}
    onPointerDown={event => {
      event.stopPropagation(); event.preventDefault();
      if (event.button !== 0 || !event.isPrimary || saving) return;
      const point = getPoint(event.clientX, event.clientY);
      gesture.current = { pointerId: event.pointerId, ...point, width: item.width, height: item.height };
      onInteraction(true); event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      event.stopPropagation();
      const drag = gesture.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const point = getPoint(event.clientX, event.clientY);
      onPreview(snapProjectCanvasSize(drag.width + point.x - drag.x, drag.height + point.y - drag.y, capabilities.minSize));
    }}
    onPointerUp={event => {
      event.stopPropagation();
      const drag = gesture.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const point = getPoint(event.clientX, event.clientY);
      const size = snapProjectCanvasSize(drag.width + point.x - drag.x, drag.height + point.y - drag.y, capabilities.minSize);
      gesture.current = null; event.currentTarget.releasePointerCapture(event.pointerId);
      onPreview(size); setSaving(true); onError(null);
      void onResize(item.id, size.width, size.height, capabilities.minSize)
        .catch(() => onError('Canvas size could not be saved. Please try again.')).finally(() => {
        onPreview(null); setSaving(false); onInteraction(false);
      });
    }}
    onPointerCancel={cancel}
    onLostPointerCapture={() => { if (gesture.current) cancel(); }} />;
}
