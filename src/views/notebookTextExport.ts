import { safeNotebookHref } from '../domain/notebook';
import type { NotebookNode } from '../domain/notebook';

export const notebookChildren = (node: NotebookNode) => node.content ?? [];
export const notebookTableRows = (node: NotebookNode) => notebookChildren(node).map(notebookChildren);

export function notebookHeadingLevel(node: NotebookNode) {
  const level = Number(node.attrs?.level);
  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : 1;
}

export function notebookLiteralText(node: NotebookNode): string {
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'inlineMath' || node.type === 'blockMath') return String(node.attrs?.latex ?? '');
  return node.text ?? notebookChildren(node).map(notebookLiteralText).join('');
}

function backticks(text: string, minimum: number) {
  return '`'.repeat((text.match(/`+/g) ?? []).reduce((length, run) => Math.max(length, run.length + 1), minimum));
}

function fencedCode(text: string, language = '') {
  const fence = backticks(text, 3);
  return `${fence}${language}\n${text}${text.endsWith('\n') ? '' : '\n'}${fence}`;
}

function inlineCode(text: string) {
  const fence = backticks(text, 1);
  const pad = /^`|`$/.test(text) || /^ .* $/.test(text) && /\S/.test(text) ? ' ' : '';
  return fence + pad + text + pad + fence;
}

function markdownInline(node: NotebookNode): string {
  if (node.type === 'hardBreak') return '  \n';
  if (node.type === 'inlineMath') return inlineCode(notebookLiteralText(node));
  if (node.type !== 'text') return notebookChildren(node).map(markdownInline).join('');
  const text = node.text ?? '';
  const [, leading, core, trailing] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  if (!core) return text;
  const marks = node.marks ?? [];
  let value = marks.some(mark => mark.type === 'code') ? inlineCode(core)
    : core.replace(/[\\`*_{}\[\]<>#~]/g, '\\$&').replace(/(^|\n)(\s*)([-+](?=\s)|\d{1,9}[.)](?=\s))/g,
      (_, line: string, space: string, marker: string) => line + space + marker.replace(/[-+.)]/, '\\$&'));
  for (const type of ['bold', 'italic', 'strike', 'superscript', 'subscript']) {
    if (!marks.some(mark => mark.type === type)) continue;
    switch (type) {
      case 'bold': value = `**${value}**`; break;
      case 'italic': value = `*${value}*`; break;
      case 'strike': value = `~~${value}~~`; break;
      case 'superscript': value = `<sup>${value}</sup>`; break;
      case 'subscript': value = `<sub>${value}</sub>`; break;
    }
  }
  const href = marks.find(mark => mark.type === 'link')?.attrs?.href;
  if (safeNotebookHref(href)) value = `[${value}](<${href.replace(/[<>\s]/g, encodeURIComponent)}>)`;
  return leading + value + trailing;
}

const isList = (node: NotebookNode) => ['bulletList', 'orderedList', 'taskList'].includes(node.type);

function list(node: NotebookNode, markdown: boolean) {
  const start = Number(node.attrs?.start ?? 1);
  return notebookChildren(node).map((item, index) => {
    const marker = node.type === 'taskList' ? `${markdown ? '- ' : ''}[${item.attrs?.checked ? 'x' : ' '}] `
      : node.type === 'orderedList' ? `${start + index}. ` : '- ';
    const body = notebookChildren(item).map((child, part) =>
      `${part ? isList(child) ? '\n' : '\n\n' : ''}${block(child, markdown)}`).join('');
    const indent = ' '.repeat(markdown && node.type === 'taskList' ? 2 : marker.length);
    return marker + body.replace(/\n(?=.)/g, '\n' + indent);
  }).join('\n');
}

function table(node: NotebookNode, markdown: boolean) {
  const rows = notebookTableRows(node);
  const columns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const textRows = () => rows.map(row => row.map(cell => block(cell, false).replace(/\s+/g, ' ')).join('\t')).join('\n');
  if (!markdown) return textRows();
  if (!columns) return '';
  if (columns > 32) return fencedCode(textRows(), 'tsv');
  const pipeRow = (cells: string[]) => `| ${cells.join(' | ')} |`;
  const values = rows.map(row => {
    const cells = row.map(cell => block(cell, true).replace(/\s*\n\s*/g, '<br>').replace(/\|/g, '\\|'));
    return pipeRow([...cells, ...Array<string>(columns - cells.length).fill('')]);
  });
  const header = rows[0]?.length && rows[0].every(cell => cell.type === 'tableHeader');
  const first = header ? values.shift()! : pipeRow(Array<string>(columns).fill(''));
  return [first, pipeRow(Array<string>(columns).fill('---')), ...values].join('\n');
}

function block(node: NotebookNode, markdown: boolean): string {
  const children = notebookChildren(node);
  switch (node.type) {
    case 'paragraph':
    case 'detailsSummary': return markdown ? markdownInline(node) : notebookLiteralText(node);
    case 'heading': return markdown ? `${'#'.repeat(notebookHeadingLevel(node))} ${markdownInline(node)}` : notebookLiteralText(node);
    case 'bulletList':
    case 'orderedList':
    case 'taskList': return list(node, markdown);
    case 'blockquote': return children.map(child => block(child, markdown)).join('\n\n').replace(/^/gm, '> ');
    case 'codeBlock': {
      const language = String(node.attrs?.language ?? '');
      const text = notebookLiteralText(node);
      return markdown ? fencedCode(text, language !== 'plaintext' && /^[a-z\d-]+$/i.test(language) ? language : '') : text;
    }
    case 'table': return table(node, markdown);
    case 'horizontalRule': return '---';
    case 'blockMath': return markdown ? fencedCode(notebookLiteralText(node), 'latex') : notebookLiteralText(node);
    default: return children.map(child => block(child, markdown)).join('\n\n');
  }
}

export function notebookTextExport(node: NotebookNode, format: 'md' | 'txt') {
  return block(node, format === 'md').replace(/\n+$/, '') + '\n';
}
