import { t, useLocale } from "../i18n";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Folder } from '../domain/folder';
import { FolderIcon } from './FolderIcon';

interface Props {
  path: Folder[];
  roots: Folder[];
  containerId: string;
  target: string | null;
  disabled: boolean;
  onNavigate: (id: string) => void;
}
interface Snapshot { rect: DOMRect; node: HTMLButtonElement }

export function FolderNavigation({ path, roots, containerId, target, disabled, onNavigate }: Props) {
  useLocale();
  const nav = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  const breadcrumb = path.length > 1;
  const previous = useRef<{ containerId: string; breadcrumb: boolean; buttons: Map<string, Snapshot> } | null>(null);
  const cleanup = useRef<(() => void)[]>([]);
  useEffect(() => {
    const node = nav.current!;
    const measure = () => setWidth(node.clientWidth - 40);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => { observer.disconnect(); cleanup.current.forEach(clean => clean()); };
  }, []);

  let visible = breadcrumb ? path : roots;
  let collapsed: Folder[] = [];
  if (breadcrumb && width > 0) {
    const required = 90 + path.reduce((sum, folder) => sum + Math.min(240, 65 + folder.name.length * 7) + 24, 0);
    if (required > width && path.length > 3) {
      visible = [path[0], ...path.slice(-2)];
      collapsed = path.slice(1, -2);
      if (90 + visible.reduce((sum, folder) => sum + Math.min(240, 65 + folder.name.length * 7) + 24, 0) + 45 > width) {
        visible = path.slice(-1);
        collapsed = path.slice(0, -1);
      }
    }
  }

  useLayoutEffect(() => {
    const node = nav.current!;
    const buttons = new Map([...node.querySelectorAll<HTMLButtonElement>(':scope > button[data-nav-id]')].map(button =>
      [button.dataset.navId!, { rect: button.getBoundingClientRect(), node: button }] as const));
    const old = previous.current;
    if (old && old.containerId !== containerId && (old.breadcrumb || breadcrumb) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cleanup.current.forEach(clean => clean());
      cleanup.current = [];
      for (const [id, current] of buttons) {
        if (id === 'home') continue;
        const before = old.buttons.get(id);
        const animation = before ? current.node.animate([
          { transform: `translate(${before.rect.left - current.rect.left}px, ${before.rect.top - current.rect.top}px)` },
          { transform: 'translate(0, 0)' },
        ], { duration: 210, easing: 'ease-out' }) : current.node.animate([
          { opacity: 0, transform: 'translateX(6px)' }, { opacity: 1, transform: 'translateX(0)' },
        ], { duration: 210, easing: 'ease-out' });
        cleanup.current.push(() => animation.cancel());
      }
      const bounds = node.getBoundingClientRect();
      for (const [id, before] of old.buttons) {
        if (id === 'home' || buttons.has(id)) continue;
        const ghost = before.node.cloneNode(true) as HTMLButtonElement;
        ghost.removeAttribute('data-destination-id'); ghost.removeAttribute('data-nav-id');
        ghost.setAttribute('aria-hidden', 'true'); ghost.tabIndex = -1;
        Object.assign(ghost.style, { position: 'absolute', pointerEvents: 'none', left: `${before.rect.left - bounds.left}px`,
          top: `${before.rect.top - bounds.top}px`, width: `${before.rect.width}px`, height: `${before.rect.height}px`, margin: '0' });
        node.appendChild(ghost);
        const animation = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 190, easing: 'ease-out' });
        animation.onfinish = () => ghost.remove();
        cleanup.current.push(() => { animation.cancel(); ghost.remove(); });
      }
    }
    previous.current = { containerId, breadcrumb, buttons };
  });

  function destination(folder: Pick<Folder, 'id' | 'name' | 'icon'>, menu = false) {
    const label = folder.name.trim() || `${folder.icon} folder`;
    return <button type="button" key={folder.id} data-nav-id={menu ? undefined : folder.id} data-destination-id={folder.id}
      className={target === folder.id ? 'is-transfer-target' : ''} aria-label={t("Go to {0}", { 0: label })} title={label}
      aria-current={folder.id === containerId ? 'page' : undefined} disabled={disabled} onClick={event => {
        if (menu) event.currentTarget.closest('details')?.removeAttribute('open');
        onNavigate(folder.id);
      }}><FolderIcon icon={folder.icon} />{folder.name.trim() && <span>{folder.name}</span>}</button>;
  }
  return <nav ref={nav} className={`folder-navigation${breadcrumb ? ' is-breadcrumb' : ''}`} aria-label={breadcrumb ? t("Folder breadcrumb") : t("Workspace destinations")}>
    {destination({ id: 'home', name: 'Home', icon: 'home' })}
    {collapsed.length > 0 && visible.length === 1 && <><span className="breadcrumb-separator" aria-hidden="true">›</span><details className="breadcrumb-overflow"><summary aria-label={t("More ancestors")}>…</summary><div>{collapsed.map(folder => destination(folder, true))}</div></details></>}
    {visible.map((folder, index) => <Fragment key={folder.id}>
      {breadcrumb && <span className="breadcrumb-separator" aria-hidden="true">›</span>}
      {destination(folder)}
      {collapsed.length > 0 && visible.length > 1 && index === 0 && <><span className="breadcrumb-separator" aria-hidden="true">›</span><details className="breadcrumb-overflow"><summary aria-label={t("More ancestors")}>…</summary><div>{collapsed.map(ancestor => destination(ancestor, true))}</div></details></>}
    </Fragment>)}
  </nav>;
}
