import { useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { WorkspaceItem } from '../domain/workspace';
import type { SpatialTransferInteraction } from './useSpatialDrag';
import type { WorkspacePositionChange } from '../utils/horizontalInsertion';
import { TRASH_DESTINATION } from '../services/trash';
import type { OtiumData } from '../domain/data';
import { canTransferToContainer } from '../utils/folderHierarchy';

export function useWorkspaceTransfer(canvas: RefObject<HTMLElement | null>, items: WorkspaceItem[], containerId: string,
  onTransfer: (ids: string[], containerId: string, positions: WorkspacePositionChange[]) => Promise<void>, onTrash: (ids: string[]) => Promise<void>, data: OtiumData) {
  const [target, setTarget] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragging = useRef(false);
  const trashRef = useRef<HTMLDivElement>(null);
  const targets = useRef<{ id: string; itemId?: string; node: HTMLElement }[]>([]);
  const interaction: SpatialTransferInteraction = {
    onDragState: active => { dragging.current = active; setDragActive(active); },
    onStart: () => {
      targets.current = [...(canvas.current?.querySelectorAll<HTMLElement>('[data-destination-id]') ?? [])].map(node => ({
        id: node.dataset.destinationId!, itemId: node.dataset.workspaceId, node,
      }));
    },
    targetAt: (clientX, clientY, ids) => {
      // Explicit highest priority, independent of underlying destinations/z-index.
      if (dragging.current && items.some(item => ids.includes(item.id)) && trashRef.current) {
        const rect = trashRef.current.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) return TRASH_DESTINATION;
      }
      if (!items.some(item => ids.includes(item.id))) return null;
      // Resolve the unscaled rectangle even during target animation or scrolling.
      const destination = targets.current.find(entry => {
        if (entry.id === containerId || (entry.itemId && ids.includes(entry.itemId))) return false;
        if (!canTransferToContainer(data, ids, entry.id)) return false;
        const rect = entry.node.getBoundingClientRect();
        const width = entry.node.offsetWidth, height = entry.node.offsetHeight;
        const left = rect.left + (rect.width - width) / 2, top = rect.top + (rect.height - height) / 2;
        const insetX = Math.min(8, width * .1), insetY = Math.min(8, height * .1);
        return clientX >= left + insetX && clientX <= left + width - insetX && clientY >= top + insetY && clientY <= top + height - insetY;
      });
      return destination?.id ?? null;
    },
    onPreview: setTarget,
    onDrop: (ids, destination, positions) => destination === TRASH_DESTINATION
      ? onTrash(ids.filter(id => items.some(item => item.id === id)))
      : onTransfer(ids.filter(id => items.some(item => item.id === id)), destination, positions),
  };
  return { target, interaction, dragActive, trashRef };
}
