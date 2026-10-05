import type { Project } from '../domain/project';
import { widthForHomeSpan } from './homeLayout';

export const PROJECT_TITLE_FONT_SIZE = 14;
export const PROJECT_TITLE_PADDING = 12;

// Stable typography estimate: no DOM measurement or asynchronous layout changes.
export function getProjectWidthTier(project: Pick<Project, 'name'>, itemSize: number): 1 | 2 | 3 {
  const titleWidth = Array.from(project.name).reduce((width, character) => {
    const factor = /[ilI1.,' :;]/.test(character) ? 0.3 : /[MW@%]/.test(character) ? 0.9
      : (character.codePointAt(0) ?? 0) > 0x024f ? 1 : 0.56;
    return width + PROJECT_TITLE_FONT_SIZE * factor;
  }, 0);
  const required = titleWidth + PROJECT_TITLE_PADDING * 2;
  return required <= widthForHomeSpan(itemSize, 1) ? 1 : required <= widthForHomeSpan(itemSize, 2) ? 2 : 3;
}

export function getProjectDimensions(project: Pick<Project, 'name'>, itemSize: number) {
  return { width: widthForHomeSpan(itemSize, getProjectWidthTier(project, itemSize)), height: itemSize };
}
