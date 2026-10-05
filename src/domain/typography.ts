export const FONT_SIZES = {
  'x-sm': { label: 'Extra Small', pixels: 12 },
  sm: { label: 'Small', pixels: 14 },
  md: { label: 'Medium', pixels: 16 },
  l: { label: 'Large', pixels: 20 },
  xl: { label: 'Extra Large', pixels: 24 },
  xxl: { label: 'Extra Extra Large', pixels: 32 },
} as const;
export type FontSizeToken = keyof typeof FONT_SIZES;
export function isFontSizeToken(value: unknown): value is FontSizeToken {
  return typeof value === 'string' && Object.hasOwn(FONT_SIZES, value);
}
export function fontSizePixels(value: number | FontSizeToken | undefined, fallback?: number): number | undefined {
  return isFontSizeToken(value) ? FONT_SIZES[value].pixels : value ?? fallback;
}
export function nearestFontSize(value: number | FontSizeToken): FontSizeToken {
  if (isFontSizeToken(value)) return value;
  return (Object.keys(FONT_SIZES) as FontSizeToken[]).reduce((nearest, token) =>
    Math.abs(FONT_SIZES[token].pixels - value) < Math.abs(FONT_SIZES[nearest].pixels - value) ? token : nearest, 'x-sm');
}
