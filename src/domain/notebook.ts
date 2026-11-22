import { normalizeUrl } from '../utils/url';
import { isFolderIcon } from '../utils/folderIcons';
import { isNotebookColorToken, isNotebookColorTone } from './notebookPalette';
import type { NotebookColorKind, NotebookColorTone } from './notebookPalette';

export interface NotebookMark {
  type: string;
  attrs?: Record<string, unknown>;
}
export interface NotebookNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NotebookNode[];
  marks?: NotebookMark[];
  text?: string;
}
export interface NotebookSection {
  id: string;
  name: string;
  color?: NotebookColorTone;
  order: number;
  createdAt: number;
  updatedAt: number;
}
export interface NotebookPage extends Omit<NotebookSection, 'name'> {
  sectionId: string;
  title: string;
  content: NotebookNode;
}
export const DEFAULT_NOTEBOOK_TEMPLATE_ICON = 'file-text';

export function notebookTemplateIconName(icon = DEFAULT_NOTEBOOK_TEMPLATE_ICON): string {
  // Resolve the original short IDs at render and validation time. Keep the
  // stored values intact so an existing workspace can round-trip as saved.
  switch (icon) {
    case 'note': return DEFAULT_NOTEBOOK_TEMPLATE_ICON;
    case 'meeting': return 'clipboard-list';
    case 'checklist': return 'list-checks';
    case 'code': return 'square-code';
    default: return icon;
  }
}

export interface NotebookTemplate {
  id: string;
  name: string;
  icon?: string;
  color?: NotebookColorTone;
  content: NotebookNode;
  createdAt: number;
  updatedAt: number;
}
export interface NotebookData {
  version: 1;
  sections: NotebookSection[];
  pages: NotebookPage[];
  templates?: NotebookTemplate[];
}

export const EMPTY_NOTEBOOK: NotebookData = { version: 1, sections: [], pages: [] };
export const EMPTY_NOTE: NotebookNode = { type: 'doc', content: [{ type: 'paragraph' }] };
const NOTEBOOK_MAX_INDENT = 12; // Existing documents may still carry this legacy attribute.
export const NOTEBOOK_MAX_DOCUMENT_DEPTH = 48;

export function safeNotebookHref(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value) && normalizeUrl(value) !== null;
}

export const NOTEBOOK_CODE_LANGUAGES = ['plaintext', 'javascript', 'typescript', 'json', 'html', 'css', 'python', 'bash', 'sql', 'c', 'cpp'] as const;
const notebookCodeAliases = new Map<string, string>(([
  ['javascript', ['js', 'jsx', 'mjs', 'cjs']], ['typescript', ['ts', 'tsx', 'mts', 'cts']],
  ['json', ['jsonc', 'json5']], ['html', ['xml', 'xhtml', 'rss', 'atom', 'xjb', 'xsd', 'xsl', 'plist', 'wsf', 'svg']],
  ['python', ['py', 'gyp', 'ipython']], ['bash', ['sh', 'zsh']], ['c', ['h']],
  ['cpp', ['cc', 'c++', 'h++', 'hpp', 'hh', 'hxx', 'cxx']],
] as const).flatMap(([language, aliases]) => aliases.map(alias => [alias, language] as const)));

const blocks = ['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'horizontalRule', 'codeBlock', 'details', 'table', 'blockMath'];
const inline = ['text', 'hardBreak', 'inlineMath'];
const children: Record<string, readonly string[]> = {
  doc: blocks, paragraph: inline, heading: inline,
  bulletList: ['listItem'], orderedList: ['listItem'], taskList: ['taskItem'],
  listItem: blocks, taskItem: blocks, blockquote: blocks, codeBlock: ['text'],
  details: ['detailsSummary', 'detailsContent'], detailsSummary: ['text'], detailsContent: blocks,
  table: ['tableRow'], tableRow: ['tableCell', 'tableHeader'], tableCell: blocks, tableHeader: blocks,
  text: [], hardBreak: [], horizontalRule: [], inlineMath: [], blockMath: [],
};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const fields = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k));
const oneOf = (value: unknown, choices: readonly string[]) => typeof value === 'string' && choices.includes(value);
const integer = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const numericStyle = (value: unknown, format: RegExp, min: number, max: number) =>
  typeof value === 'string' && format.test(value) && parseFloat(value) >= min && parseFloat(value) <= max;

function validColor(value: unknown, kind: NotebookColorKind): boolean {
  if (typeof value !== 'string' || value.length > 64) return false;
  return isNotebookColorToken(value, kind) ||
    /^#[0-9a-f]{3,8}$/i.test(value) && [4, 5, 7, 9].includes(value.length) ||
    /^(?:rgba?|hsla?)\([\d.,%+\- /]+\)$/i.test(value) ||
    /^[a-z]{1,24}$/i.test(value);
}

const plainMarks = ['bold', 'italic', 'underline', 'strike', 'code', 'superscript', 'subscript'];
const textStyleFields = ['color', 'backgroundColor', 'fontSize', 'lineHeight'];
function validTextStyleAttribute(key: string, value: unknown) {
  if (value == null) return true;
  switch (key) {
    case 'color': return validColor(value, 'color');
    case 'backgroundColor': return validColor(value, 'highlight');
    case 'fontSize': return numericStyle(value, /^\d{1,3}(?:\.\d{1,2})?px$/, 8, 96);
    case 'lineHeight': return numericStyle(value, /^\d(?:\.\d{1,2})?$/, 0.8, 4);
    default: return false;
  }
}
function validMark(v: unknown): boolean {
  if (!record(v) || typeof v.type !== 'string' || !fields(v, ['type', 'attrs'])) return false;
  if (plainMarks.includes(v.type)) return v.attrs === undefined;
  const attrs = v.attrs;
  if (!record(attrs)) return false;
  if (v.type === 'textStyle') return fields(attrs, textStyleFields) &&
    textStyleFields.every(key => validTextStyleAttribute(key, attrs[key]));
  return v.type === 'link' && fields(attrs, ['href', 'target', 'rel', 'class', 'title']) && safeNotebookHref(attrs.href) &&
    (attrs.target == null || attrs.target === '_blank') &&
    (attrs.rel == null || (typeof attrs.rel === 'string' && attrs.rel.split(/\s+/).includes('noopener'))) &&
    attrs.class == null && (attrs.title == null || typeof attrs.title === 'string');
}

const orderedListTypes = ['1', 'a', 'A', 'i', 'I'];
const validColumnWidths = (widths: unknown, span: unknown) => widths == null ||
  (Array.isArray(widths) && widths.length === span && widths.every(w => integer(w, 0, 20000)));

export function normalizeNotebookNodeAttributes(type: string, attrs: Record<string, unknown>, editorInput = false) {
  if (type === 'codeBlock' && typeof attrs.language === 'string' && !oneOf(attrs.language, NOTEBOOK_CODE_LANGUAGES)) {
    const language = attrs.language.toLowerCase();
    return { ...attrs, language: oneOf(language, NOTEBOOK_CODE_LANGUAGES) ? language : notebookCodeAliases.get(language) ?? 'plaintext' };
  }
  if (editorInput && type === 'orderedList' && (!Number.isSafeInteger(attrs.start) || (attrs.type != null && !oneOf(attrs.type, orderedListTypes)))) {
    return { ...attrs, start: Number.isSafeInteger(attrs.start) ? attrs.start : 1,
      type: oneOf(attrs.type, orderedListTypes) ? attrs.type : null };
  }
  if (editorInput && (type === 'tableCell' || type === 'tableHeader') && !validColumnWidths(attrs.colwidth, attrs.colspan)) {
    return { ...attrs, colwidth: null };
  }
  return attrs;
}

export function normalizeNotebookMarkAttributes(type: string, attrs: Record<string, unknown>) {
  if (type === 'link' && safeNotebookHref(attrs.href)) {
    const target = attrs.target == null || attrs.target === '_blank' ? attrs.target : '_blank';
    const rel = attrs.rel == null || (typeof attrs.rel === 'string' && attrs.rel.split(/\s+/).includes('noopener'))
      ? attrs.rel : 'noopener noreferrer nofollow';
    if (target !== attrs.target || rel !== attrs.rel || attrs.class != null) return { ...attrs, target, rel, class: null };
  }
  if (type !== 'textStyle') return attrs;
  let normalized = attrs;
  for (const key of textStyleFields) {
    if (validTextStyleAttribute(key, attrs[key])) continue;
    if (normalized === attrs) normalized = { ...attrs };
    const points = key === 'fontSize' && typeof attrs[key] === 'string' && /^(\d+(?:\.\d+)?)pt$/i.exec(attrs[key]);
    const pixels = points ? `${Number((Number(points[1]) * 4 / 3).toFixed(2))}px` : null;
    normalized[key] = validTextStyleAttribute(key, pixels) ? pixels : null;
  }
  return normalized;
}

function validNodeAttributes(type: string, value: unknown): boolean {
  if (value === undefined) return type !== 'inlineMath' && type !== 'blockMath';
  if (!record(value)) return false;
  const a = value;
  switch (type) {
    case 'paragraph':
    case 'heading':
      return fields(a, type === 'heading' ? ['level', 'textAlign'] : ['textAlign', 'indentLevel']) &&
        (a.indentLevel === undefined || integer(a.indentLevel, 0, NOTEBOOK_MAX_INDENT)) &&
        (type !== 'heading' || integer(a.level, 1, 6)) &&
        (a.textAlign == null || oneOf(a.textAlign, ['left', 'center', 'right', 'justify']));
    case 'orderedList':
      return fields(a, ['start', 'type']) && Number.isSafeInteger(a.start) && (a.type == null || oneOf(a.type, orderedListTypes));
    case 'taskItem': return fields(a, ['checked']) && typeof a.checked === 'boolean';
    case 'details': return fields(a, ['open']) && typeof a.open === 'boolean';
    case 'codeBlock': return fields(a, ['language']) && (a.language == null || oneOf(a.language, NOTEBOOK_CODE_LANGUAGES));
    case 'inlineMath':
    case 'blockMath': return fields(a, ['latex']) && typeof a.latex === 'string' && a.latex.length <= 4096;
    case 'tableCell':
    case 'tableHeader':
      // Tiptap emits align: null on newly inserted cells and headers.
      return fields(a, ['colspan', 'rowspan', 'colwidth', 'align']) &&
        (a.align == null || oneOf(a.align, ['left', 'center', 'right'])) &&
        integer(a.colspan, 1, 100) && integer(a.rowspan, 1, 1000) &&
        validColumnWidths(a.colwidth, a.colspan);
    default: return false;
  }
}

function checkedNotebookDocument(value: unknown, normalize = false, editorInput = false): NotebookNode | undefined {
  let count = 0;
  function visit(v: unknown, depth: number, parent?: string): NotebookNode | undefined {
    if (++count > 100000 || depth > NOTEBOOK_MAX_DOCUMENT_DEPTH || !record(v) || typeof v.type !== 'string' ||
      !(parent ? children[parent].includes(v.type) : v.type === 'doc') ||
      !fields(v, ['type', 'attrs', 'content', 'marks', 'text'])) return;
    const attrs = normalize && record(v.attrs) ? normalizeNotebookNodeAttributes(v.type, v.attrs, editorInput) : v.attrs;
    if (!validNodeAttributes(v.type, attrs)) return;
    if (v.type === 'text' ? typeof v.text !== 'string' || !v.text.length : v.text !== undefined) return;
    let marks = v.marks;
    if (marks !== undefined) {
      if (!inline.includes(v.type) || parent === 'codeBlock' || !Array.isArray(marks) || marks.length > 9) return;
      const entries = editorInput ? marks.map(mark => {
        if (!record(mark) || typeof mark.type !== 'string' || !record(mark.attrs)) return mark;
        const normalized = normalizeNotebookMarkAttributes(mark.type, mark.attrs);
        return normalized === mark.attrs ? mark : { ...mark, attrs: normalized };
      }) : marks;
      if (!entries.every(validMark) || new Set(entries.map(mark => mark.type)).size !== entries.length) return;
      if (entries.some((entry, index) => entry !== (marks as unknown[])[index])) marks = entries;
    }
    if (v.content !== undefined && !Array.isArray(v.content)) return;
    const items = v.content ?? [];
    if (!children[v.type].length && items.length) return;
    if (['doc', 'bulletList', 'orderedList', 'taskList', 'listItem', 'taskItem', 'blockquote', 'detailsContent', 'table', 'tableCell', 'tableHeader'].includes(v.type) && !items.length) return;
    if (['listItem', 'taskItem'].includes(v.type) && (!record(items[0]) || items[0].type !== 'paragraph')) return;
    if (v.type === 'details' && (items.length !== 2 || !record(items[0]) || items[0].type !== 'detailsSummary' || !record(items[1]) || items[1].type !== 'detailsContent')) return;
    let content: unknown[] = items;
    for (const [index, item] of items.entries()) {
      const child = visit(item, depth + 1, v.type);
      if (!child) return;
      if (child === item) continue;
      if (content === items) content = items.slice();
      content[index] = child;
    }
    return (attrs === v.attrs && marks === v.marks && content === items ? v : {
      ...v, ...(attrs !== v.attrs ? { attrs } : {}), ...(marks !== v.marks ? { marks } : {}),
      ...(content !== items ? { content } : {}),
    }) as unknown as NotebookNode;
  }
  return visit(value, 0);
}

export function validNotebookDocument(value: unknown): value is NotebookNode {
  return checkedNotebookDocument(value) !== undefined;
}

export function validNotebookEditorInput(value: unknown): boolean {
  return checkedNotebookDocument(value, true, true) !== undefined;
}

export function parseNotebook(value: unknown): NotebookData {
  const invalid = () => new Error('Stored notebook is invalid or unsupported. Original data has been preserved.');
  if (!record(value) || value.version !== 1 || !Array.isArray(value.sections) || !Array.isArray(value.pages)) throw invalid();
  const sections = new Set<string>(), pages = new Set<string>();
  function identified(entry: unknown, ids: Set<string>): entry is Record<string, unknown> & { id: string } {
    if (!record(entry) || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) ||
      typeof entry.createdAt !== 'number' || !Number.isFinite(entry.createdAt) ||
      typeof entry.updatedAt !== 'number' || !Number.isFinite(entry.updatedAt)) return false;
    ids.add(entry.id);
    return true;
  }
  function base(entry: unknown, ids: Set<string>): entry is Record<string, unknown> & { id: string } {
    return identified(entry, ids) && Number.isSafeInteger(entry.order) && Number(entry.order) >= 0 &&
      (entry.color === undefined || isNotebookColorTone(entry.color));
  }
  for (const entry of value.sections) {
    if (!base(entry, sections) || typeof entry.name !== 'string' || !entry.name.trim()) throw invalid();
  }
  function normalizeContent(entry: Record<string, unknown>) {
    const content = checkedNotebookDocument(entry.content, true);
    if (!content) throw invalid();
    return content === entry.content ? entry : { ...entry, content };
  }
  const validatedPages = value.pages.map(entry => {
    if (!base(entry, pages) || typeof entry.sectionId !== 'string' || !sections.has(entry.sectionId) ||
      typeof entry.title !== 'string' || !entry.title.trim()) throw invalid();
    return normalizeContent(entry);
  });
  let validatedTemplates: unknown[] | undefined;
  if (value.templates !== undefined) {
    if (!Array.isArray(value.templates)) throw invalid();
    const templates = new Set<string>();
    validatedTemplates = value.templates.map(entry => {
      if (!identified(entry, templates) || typeof entry.name !== 'string' || !entry.name.trim() ||
        (entry.icon !== undefined && (typeof entry.icon !== 'string' || !isFolderIcon(notebookTemplateIconName(entry.icon)))) ||
        (entry.color !== undefined && !isNotebookColorTone(entry.color))) throw invalid();
      return normalizeContent(entry);
    });
  }
  // Preserve all record fields and any already valid Tiptap JSON verbatim.
  const hasRepairs = validatedPages.some((page, index) => page !== (value.pages as unknown[])[index]) ||
    validatedTemplates?.some((template, index) => template !== (value.templates as unknown[])[index]);
  return (hasRepairs ? { ...value, pages: validatedPages,
    ...(validatedTemplates ? { templates: validatedTemplates } : {}) } : value) as unknown as NotebookData;
}
