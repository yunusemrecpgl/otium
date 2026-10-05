export const PROJECT_COLORS = ['neutral', 'slate', 'blue', 'teal', 'green', 'amber', 'rose', 'violet'] as const;
export type ProjectColor = typeof PROJECT_COLORS[number];

export function isProjectColor(value: unknown): value is ProjectColor {
  return PROJECT_COLORS.some(color => color === value);
}
