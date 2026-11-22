import { createPdf } from 'pdfmake/build/pdfmake';
import fonts from 'pdfmake/build/vfs_fonts';
import type { CanvasElement, Content, ContentText, CustomTableLayout, Decoration, TDocumentDefinitions, TFontDictionary } from 'pdfmake/interfaces';
import type { NotebookNode } from '../domain/notebook';
import { notebookPdfText } from './notebookPdfGlyphs';
import { notebookChildren, notebookHeadingLevel, notebookLiteralText, notebookTableRows, notebookTextExport } from './notebookTextExport';

const pdfFonts: TFontDictionary = {
  Roboto: { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf' },
};
const bodySize = 11;
const bodyLineHeight = 1.22;
const codeBackground = '#f0f2f5';
const notebookTableLayout: CustomTableLayout = {
  hLineWidth: () => 0.45, hLineColor: '#ccd1d8', vLineWidth: () => 0,
  paddingLeft: () => 7, paddingRight: () => 7, paddingTop: () => 4, paddingBottom: () => 4,
  fillColor: (row, node) => row === 0 && node.table.headerRows ? '#eef1f5' : null,
};

function inline(node: NotebookNode): ContentText[] {
  if (node.type === 'text' || node.type === 'hardBreak' || node.type === 'inlineMath') {
    const text = notebookPdfText(notebookLiteralText(node));
    const has = (type: string) => node.marks?.some(mark => mark.type === type);
    const decoration: Decoration[] = [];
    if (has('underline')) decoration.push('underline');
    if (has('strike')) decoration.push('lineThrough');
    const script = has('superscript') ? 'sups' : has('subscript') ? 'subs' : undefined;
    // pdfmake shifts native sup/sub text without moving its decorations.
    // Roboto has real script numerals; other scripts stay readable on the baseline.
    const useScriptGlyphs = script && /^\d+$/.test(text) && !decoration.length;
    const rendered = script && !useScriptGlyphs && text.trim() ? `${script === 'sups' ? '^' : '_'}(${text})` : text;
    return [{ text: rendered, bold: has('bold'), italics: has('italic'),
      decoration: decoration.length ? decoration : undefined, background: has('code') ? codeBackground : undefined,
      fontFeatures: useScriptGlyphs ? [script] : undefined,
      wordBreak: /\S{55}/u.test(rendered) ? 'break-all' : undefined }];
  }
  return notebookChildren(node).flatMap(inline);
}

const stack = (children: NotebookNode[]) => children.flatMap(block);

function table(node: NotebookNode): Content[] {
  const rows = notebookTableRows(node);
  const columns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (!columns) return [];
  if (columns > 24) return [{ text: notebookPdfText(notebookTextExport(node, 'txt').replace(/\t/g, '  ')), wordBreak: 'break-all', margin: [0, 4, 0, 12] }];
  const headerRows = rows[0]?.length && rows[0].every(cell => cell.type === 'tableHeader') ? 1 : 0;
  const result: Content[] = [];
  for (let offset = 0; offset < columns; offset += 6) {
    const count = Math.min(columns - offset, 6);
    const body = rows.map(row => Array.from({ length: count }, (_, index): ContentText => {
      const cell = row[offset + index];
      const text = cell ? notebookPdfText(notebookTextExport(cell, 'txt').trimEnd()) : '';
      return { text, bold: cell?.type === 'tableHeader', fontSize: 9,
        wordBreak: /\S{24}/u.test(text) ? 'break-all' : 'normal' };
    }));
    result.push({ table: { body, headerRows, widths: Array<string>(count).fill(`${100 / count}%`) }, layout: notebookTableLayout, margin: [0, 4, 0, 12] });
  }
  return result;
}

function taskItem(item: NotebookNode): Content {
  const lineColor = '#596574';
  // Reserve the same height as the first Roboto text line so both columns
  // move to the next page together when there is not room for that line.
  const height = bodySize * bodyLineHeight * (2400 / 2048);
  const canvas: CanvasElement[] = [
    { type: 'line', x1: 0, y1: height, x2: 0, y2: height, strokeOpacity: 0 },
    { type: 'rect', x: 0.5, y: 3, w: 7, h: 7, r: 1, lineWidth: 0.7, lineColor },
  ];
  if (item.attrs?.checked) canvas.push({ type: 'polyline', points: [{ x: 2, y: 6.6 }, { x: 3.5, y: 8 }, { x: 6, y: 4.8 }], lineWidth: 0.9, lineColor });
  return { columns: [{ width: 9, canvas }, { width: '*', stack: stack(notebookChildren(item)) }], columnGap: 6, margin: [10, 0, 0, 0] };
}

function block(node: NotebookNode): Content[] {
  const children = notebookChildren(node);
  switch (node.type) {
    case 'paragraph':
    case 'detailsSummary': return [{ text: inline(node), margin: [0, 0, 0, 5] }];
    case 'heading': return [{ text: inline(node), bold: true, fontSize: [20, 16, 14, 12, 11, 10][notebookHeadingLevel(node) - 1], margin: [0, 10, 0, 5] }];
    case 'bulletList': return children.length ? [{ ul: children.map(item => ({ stack: stack(notebookChildren(item)) })), margin: [10, 0, 0, 5] }] : [];
    case 'orderedList': return children.length ? [{ ol: children.map(item => ({ stack: stack(notebookChildren(item)) })),
      start: Number(node.attrs?.start ?? 1), margin: [10, 0, 0, 5] }] : [];
    case 'taskList': return children.map(taskItem);
    case 'blockquote': return [{ stack: stack(children), margin: [15, 3, 0, 6], italics: true, color: '#414652' }];
    case 'codeBlock':
    case 'blockMath': {
      const text = notebookPdfText(notebookLiteralText(node).replace(/\t/g, '    '));
      return [{ text, fontSize: 9, background: codeBackground, preserveLeadingSpaces: true,
        wordBreak: /\S{55}/u.test(text) ? 'break-all' : 'normal', margin: [10, 4, 0, 9] }];
    }
    case 'table': return table(node);
    case 'horizontalRule': return [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 499, y2: 0, lineWidth: 0.6, lineColor: '#bfc4cc' }], margin: [0, 8, 0, 9] }];
    default: return stack(children);
  }
}

export async function notebookPdfExport(title: string, content: NotebookNode): Promise<Blob> {
  const documentTitle = notebookPdfText(title);
  const definition: TDocumentDefinitions = {
    info: { title }, pageSize: 'A4', pageMargins: [48, 48, 48, 48], defaultStyle: { font: 'Roboto', fontSize: bodySize, lineHeight: bodyLineHeight, color: '#21252b' },
    content: [{ text: documentTitle, fontSize: 24, bold: true, wordBreak: /\S{32}/u.test(documentTitle) ? 'break-all' : 'normal', margin: [0, 0, 0, 16] }, ...block(content)],
  };
  // The stream is created synchronously from bundled fonts, with no URL
  // resolver. Both creation and stream errors reach the export control.
  const stream = createPdf(definition, {}, pdfFonts, fonts).getStream();
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    stream.on('data', (chunk: Uint8Array) => chunks.push(new Uint8Array(chunk)));
    stream.once('error', reject);
    stream.once('end', () => resolve(new Blob(chunks, { type: 'application/pdf' })));
    stream.end();
  });
}
