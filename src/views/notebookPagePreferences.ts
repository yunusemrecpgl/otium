const PAGE_PADDING_KEY = 'otium:notebook-page-padding';
const BACKGROUND_KEY = 'otium:notebook-background';
const FONT_SIZE_KEY = 'otium:notebook-font-size';
const LINE_HEIGHT_KEY = 'otium:notebook-line-height';
const ZOOM_KEY = 'otium:notebook-zoom';
const LAST_NOTE_KEY = 'otium:notebook-last-note';
const SPELLCHECK_KEY = 'otium:notebook-spellcheck';

export const PAGE_PADDING_MIN = 16;
export const PAGE_PADDING_MAX = 120;
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 28;
export const NOTEBOOK_LINE_HEIGHTS = [1.2, 1.4, 1.5, 1.6, 1.8, 2] as const;
export type NotebookLineHeight = typeof NOTEBOOK_LINE_HEIGHTS[number];
export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
export const ZOOM_STEP = 10;
export const NOTEBOOK_BACKGROUNDS = ['none', 'lines', 'grid'] as const;
export type NotebookBackground = typeof NOTEBOOK_BACKGROUNDS[number];

function read(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Optional UI preference. */ }
}

export function readPagePadding() {
  const value = Number(read(PAGE_PADDING_KEY));
  return Number.isInteger(value) && value >= PAGE_PADDING_MIN && value <= PAGE_PADDING_MAX ? value : 72;
}
export const readNotebookSpellcheck = () => read(SPELLCHECK_KEY) === 'true';
export const saveNotebookSpellcheck = (value: boolean) => write(SPELLCHECK_KEY, String(value));
export function readNotebookBackground(): NotebookBackground {
  const value = read(BACKGROUND_KEY);
  return NOTEBOOK_BACKGROUNDS.find(mode => mode === value) ?? 'none';
}
export const savePagePadding = (value: number) => write(PAGE_PADDING_KEY, String(value));
export const saveNotebookBackground = (value: NotebookBackground) => write(BACKGROUND_KEY, value);
function readNumber(key: string, min: number, max: number, fallback: number) {
  const value = Number(read(key));
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}
export const readNotebookFontSize = () => readNumber(FONT_SIZE_KEY, FONT_SIZE_MIN, FONT_SIZE_MAX, 16);
export const saveNotebookFontSize = (value: number) => write(FONT_SIZE_KEY, String(value));
export function readNotebookLineHeight(): NotebookLineHeight {
  const value = Number(read(LINE_HEIGHT_KEY));
  return NOTEBOOK_LINE_HEIGHTS.find(height => height === value) ?? 1.5;
}
export const saveNotebookLineHeight = (value: NotebookLineHeight) => write(LINE_HEIGHT_KEY, String(value));
export const readNotebookZoom = () => readNumber(ZOOM_KEY, ZOOM_MIN, ZOOM_MAX, 100);
export const saveNotebookZoom = (value: number) => write(ZOOM_KEY, String(value));
export const readLastNotebookNote = () => read(LAST_NOTE_KEY);
export const saveLastNotebookNote = (id: string) => write(LAST_NOTE_KEY, id);
