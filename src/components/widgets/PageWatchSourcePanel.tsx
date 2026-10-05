import { t, useLocale } from "../../i18n";
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { floatingBounds } from '../projects/floatingBounds';

export function PageWatchSourcePanel({ open, onClose, getAnchor, children }: { open: boolean; onClose: () => void; getAnchor: () => DOMRect | undefined; children: ReactNode }) {
  useLocale();
  const [placement, setPlacement] = useState({ top: 96, maxHeight: 500, right: 16, maxWidth: 540 });
  const anchor = useRef(getAnchor); anchor.current = getAnchor;
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchor.current();
      const usable = floatingBounds();
      const height = usable.bottom - usable.top;
      const below = rect ? usable.bottom - rect.bottom - 12 : height - 96;
      const above = rect ? rect.top - usable.top - 12 : 0;
      const useBelow = below >= 180 || below >= above;
      const top = rect && useBelow ? Math.max(usable.top, Math.min(usable.bottom - 16, rect.bottom + 12)) : usable.top;
      const maxHeight = Math.max(1, Math.min(height * .72, rect && !useBelow ? above : usable.bottom - top));
      const right = window.innerWidth - usable.right;
      const maxWidth = Math.max(1, Math.min(540, usable.right - usable.left));
      setPlacement(previous => previous.top === top && previous.maxHeight === maxHeight && previous.right === right && previous.maxWidth === maxWidth
        ? previous : { top, maxHeight, right, maxWidth });
    };
    place(); window.addEventListener('resize', place);
    const bar = document.querySelector('.compact-floating-inspector');
    const changes = new MutationObserver(place);
    const resize = new ResizeObserver(place);
    if (bar) {
      changes.observe(bar, { attributes: true, attributeFilter: ['style', 'data-shown'] });
      resize.observe(bar);
      bar.addEventListener('transitionend', place);
    }
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      changes.disconnect(); resize.disconnect(); bar?.removeEventListener('transitionend', place);
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [open]);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [open, onClose]);
  return createPortal(<aside className="project-inspector page-watch-source-panel" hidden={!open}
    style={placement} aria-label={t("Page Watch Source Configuration")} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    <header><span>{t("Source Configuration")}</span>
      <button ref={close} type="button" className="quiet-button" title={t("Close source configuration")} aria-label={t("Close source configuration")} onClick={onClose}><X size={16} aria-hidden="true" /></button>
    </header>
    <div className="floating-inspector-body project-inspector-properties">{children}</div>
  </aside>, document.querySelector('.otium-app') ?? document.body);
}
