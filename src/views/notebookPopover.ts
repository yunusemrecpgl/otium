export function observeNotebookPopover(host: HTMLElement, trigger: HTMLElement, panel: HTMLElement) {
  const wrapper = panel.parentElement;
  const workspace = host.closest('.notebook-workspace');
  if (!wrapper || !workspace) return;

  const position = () => {
    const gap = 4;
    const anchor = trigger.getBoundingClientRect();
    const origin = wrapper.getBoundingClientRect();
    const bounds = workspace.getBoundingClientRect();
    const left = Math.max(0, bounds.left) + gap;
    const right = Math.min(document.documentElement.clientWidth, bounds.right) - gap;
    const top = Math.max(0, bounds.top) + gap;
    const bottom = Math.min(document.documentElement.clientHeight, bounds.bottom) - gap;

    panel.style.maxWidth = `${Math.max(0, right - left)}px`;
    const below = bottom - anchor.bottom - gap;
    const above = anchor.top - top - gap;
    const fullHeight = panel.scrollHeight + panel.offsetHeight - panel.clientHeight;
    const flip = fullHeight > below && above > below;
    panel.style.setProperty('--notebook-menu-room', `${Math.max(0, flip ? above : below)}px`);

    const x = Math.max(left, Math.min(anchor.left, right - panel.offsetWidth));
    const y = flip ? anchor.top - gap - panel.offsetHeight : anchor.bottom + gap;
    panel.style.left = `${x - origin.left}px`;
    panel.style.top = `${y - origin.top}px`;
  };

  position();
  const observer = new ResizeObserver(position);
  for (const element of [workspace, host, trigger, panel, ...host.children]) observer.observe(element);
  window.addEventListener('resize', position);
  return () => {
    observer.disconnect();
    window.removeEventListener('resize', position);
  };
}
