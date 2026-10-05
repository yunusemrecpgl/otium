const wheelControls = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="listbox"], [role="menu"]';
const floatingSurfaces = '.project-inspector, .project-context-toolbar, .project-context-popover, .project-add-panel, [data-floating-menu-content]';

/** Internal scroll regions own the wheel even when already at their scroll boundary. */
export function ownsProjectCanvasWheel(target: EventTarget | null, viewport: HTMLElement): boolean {
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  if (!element || !viewport.contains(element)) return true;
  if (element.closest(`${wheelControls}, ${floatingSurfaces}`)) return true;

  const item = element.closest('[data-canvas-item]');
  if (!item || !viewport.contains(item)) return false;
  for (let region: Element | null = element; region && region !== viewport; region = region.parentElement) {
    const style = getComputedStyle(region);
    const scrollsY = /^(auto|scroll|overlay)$/.test(style.overflowY) && region.scrollHeight > region.clientHeight;
    const scrollsX = /^(auto|scroll|overlay)$/.test(style.overflowX) && region.scrollWidth > region.clientWidth;
    if (scrollsY || scrollsX) return true;
    if (region === item) break;
  }
  return false;
}
