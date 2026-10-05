import type { CSSProperties } from 'react';
import type { TextStyle } from '../../domain/text';
import { fontSizePixels } from '../../domain/typography';
import type { ProjectColor } from '../../domain/projectColor';

const fonts = { sans: 'var(--font-sans)', serif: 'var(--font-serif)', mono: 'var(--font-mono)' };
export function widgetLeadingIconSize(style: TextStyle = {}): number {
  const size = fontSizePixels(style.fontSize);
  return size === undefined ? 16 : Math.max(14, Math.min(32, Math.round(size * 16 / 14)));
}
export function widgetBorderColor(background?: ProjectColor): string {
  return background ? `color-mix(in srgb, var(--palette-${background}-dot) 40%, var(--palette-${background}-surface))`
    : 'var(--color-item-border)';
}
export function widgetSurface(style: TextStyle = {}): CSSProperties {
  return { backgroundColor: style.backgroundColor ? `var(--palette-${style.backgroundColor}-surface)` : undefined,
    borderColor: widgetBorderColor(style.backgroundColor), '--widget-leading-icon-size': `${widgetLeadingIconSize(style)}px` } as CSSProperties;
}
export function widgetTextColor(style: TextStyle = {}): CSSProperties {
  return { color: style.textColor ? `color-mix(in srgb, var(--palette-${style.textColor}-dot) 60%, var(--color-text-primary))` : undefined };
}
export function widgetTypography(style: TextStyle = {}): CSSProperties {
  return { ...widgetTextColor(style), fontWeight: style.bold === undefined ? undefined : style.bold ? 700 : 400,
    fontStyle: style.italic === undefined ? undefined : style.italic ? 'italic' : 'normal',
    textDecoration: style.underline === undefined && style.strike === undefined ? undefined :
      [style.underline ? 'underline' : '', style.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
    fontSize: fontSizePixels(style.fontSize), fontFamily: style.fontFamily ? fonts[style.fontFamily] : undefined, textAlign: style.textAlign };
}

// Structural titles share content scale/color, but keep their standardized
// weight and alignment regardless of content formatting or legacy title styles.
export function widgetContentScale(style: TextStyle = {}): CSSProperties {
  return { ...widgetTextColor(style), fontSize: fontSizePixels(style.fontSize, 13),
    fontFamily: style.fontFamily ? fonts[style.fontFamily] : undefined };
}
export function widgetTitleTypography(style: TextStyle = {}): CSSProperties {
  return { ...widgetContentScale(style), fontSize: Math.round(fontSizePixels(style.fontSize, 13)! * 1.15 * 10) / 10,
    fontWeight: 500, fontStyle: 'normal', textDecoration: 'none', textAlign: 'left' };
}
