// Screen-space bounds for overlays; never changes the canvas camera.
export function floatingBounds(workspace?: HTMLElement | null) {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
  const right = left + (viewport?.width ?? window.innerWidth);
  const bottom = top + (viewport?.height ?? window.innerHeight);
  const rect = workspace?.getBoundingClientRect();
  return {
    left: Math.max(left, rect?.left ?? left) + 8,
    top: Math.max(top, rect?.top ?? top) + 8,
    right: Math.min(right, rect?.right ?? right) - 8,
    bottom: Math.min(bottom, rect?.bottom ?? bottom) - 8,
  };
}

export function clampFloating(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
}
