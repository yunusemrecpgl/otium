import { t, useLocale } from "../../i18n";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { clampFloating, floatingBounds } from './floatingBounds';

// Compact editor tools use workspace screen coordinates, never the camera.
export function CompactFloatingInspectorShell({ open, dragging, getWorkspace, getAnchor, children }: {
  open: boolean; dragging: boolean; getWorkspace: () => HTMLElement | null; getAnchor: () => DOMRect | undefined; children: ReactNode;
}) {
  useLocale();
  const [present, setPresent] = useState(open);
  const [shown, setShown] = useState(false);
  const [bounds, setBounds] = useState({ x: 8, y: 8 });
  const panel = useRef<HTMLElement>(null);
  const content = useRef(children);
  const workspace = useRef(getWorkspace); workspace.current = getWorkspace;
  if (open) content.current = children;
  useEffect(() => {
    if (open) setPresent(true);
    const frame = requestAnimationFrame(() => setShown(open && !dragging));
    const timer = !open ? setTimeout(() => setPresent(false), 150) : undefined;
    return () => { cancelAnimationFrame(frame); if (timer) clearTimeout(timer); };
  }, [open, dragging]);
  useLayoutEffect(() => {
    if (!present && !open) return;
    const element = workspace.current();
    if (!element) return;
    const update = () => {
      const rect = getAnchor();
      if (!rect || !panel.current) return;
      const usable = floatingBounds(element);
      panel.current.style.maxWidth = `${Math.max(1, usable.right - usable.left)}px`;
      panel.current.style.maxHeight = `${Math.max(1, usable.bottom - usable.top)}px`;
      const width = panel.current.offsetWidth, height = panel.current.offsetHeight;
      const center = (rect.left + rect.right) / 2;
      const above = rect.top - height - 20;
      const next = { x: clampFloating(center, usable.left + width / 2, usable.right - width / 2),
        y: clampFloating(above >= usable.top ? above : rect.bottom + 20, usable.top, usable.bottom - height) };
      setBounds(previous => previous.x === next.x && previous.y === next.y ? previous : next);
    };
    update();
    const observer = new ResizeObserver(update); observer.observe(element);
    if (panel.current) observer.observe(panel.current);
    const changes = new MutationObserver(update);
    changes.observe(element, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      observer.disconnect(); changes.disconnect(); window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [present, open, getAnchor]);
  if (!present && !open) return null;
  return createPortal(<aside ref={panel} className="project-inspector floating-project-inspector note-floating-inspector compact-floating-inspector"
    aria-label={t("Floating formatting tools")} data-shown={shown || undefined} aria-hidden={!shown || dragging || !open} inert={!shown || dragging || !open}
    style={{ left: bounds.x, top: bounds.y, width: 'max-content' }}>
    <div className="floating-inspector-body">{open ? children : content.current}</div>
  </aside>, document.querySelector('.otium-app') ?? document.body);
}
