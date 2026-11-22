export const NOTEBOOK_COLOR_TONES = ['Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Purple', 'Pink', 'Gray'] as const;
export type NotebookColorTone = typeof NOTEBOOK_COLOR_TONES[number];
export type NotebookColorKind = 'color' | 'highlight';

export function isNotebookColorTone(value: unknown): value is NotebookColorTone {
  return NOTEBOOK_COLOR_TONES.some(tone => tone === value);
}

export function notebookColorToken(kind: NotebookColorKind, tone: NotebookColorTone) {
  return `var(--notebook-${kind}-${tone.toLowerCase()})`;
}

export function isNotebookColorToken(value: string, kind: NotebookColorKind) {
  return NOTEBOOK_COLOR_TONES.some(tone => notebookColorToken(kind, tone) === value);
}
