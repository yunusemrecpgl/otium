import { useEffect, useState } from 'react';
import { workspaceGeometryForViewport } from '../utils/workspace';
import type { WorkspaceGeometry } from '../utils/workspace';

export function useWorkspaceViewport(itemSize: number): WorkspaceGeometry {
  const [size, setSize] = useState(() => workspaceGeometryForViewport(window.innerWidth, window.innerHeight, itemSize));
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setSize(previous => {
        const next = workspaceGeometryForViewport(window.innerWidth, window.innerHeight, itemSize);
        return previous.width === next.width && previous.height === next.height ? previous : next;
      }));
    };
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('resize', update); cancelAnimationFrame(frame); };
  }, [itemSize]);
  return { ...size, itemSize };
}
