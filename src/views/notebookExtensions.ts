import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { BackgroundColor, Color, FontSize, LineHeight, TextStyle } from '@tiptap/extension-text-style';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details';
import { TableKit } from '@tiptap/extension-table';
import { BlockMath, InlineMath } from '@tiptap/extension-mathematics';
import { Extension, ReactNodeViewRenderer } from '@tiptap/react';
import { Plugin } from '@tiptap/pm/state';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import { t } from '../i18n';
import { normalizeNotebookMarkAttributes, normalizeNotebookNodeAttributes, safeNotebookHref, validNotebookEditorInput } from '../domain/notebook';
import { NotebookLegacyIndent } from './notebookLegacyIndent';
import { NotebookCodeBlock } from './NotebookCodeBlock';
import 'katex/dist/katex.min.css';
import './notebook-rich-editor.css';

const lowlight = createLowlight({ javascript, typescript, json, html: xml, css, python, bash, sql, c, cpp });
lowlight.register('plaintext', () => ({ name: 'Plain text', disableAutodetect: true, contains: [] }));
const katexOptions = { trust: false, throwOnError: false, maxExpand: 500, maxSize: 20 };

export const NotebookDocumentGuard = Extension.create<{ onRejected: () => void }>({
  name: 'notebookDocumentGuard',
  addOptions: () => ({ onRejected: () => {} }),
  addProseMirrorPlugins() {
    return [new Plugin({
      filterTransaction: transaction => {
        if (!transaction.docChanged || validNotebookEditorInput(transaction.doc.toJSON())) return true;
        queueMicrotask(this.options.onRejected);
        return false;
      },
      appendTransaction: (transactions, _previous, state) => {
        if (!transactions.some(transaction => transaction.docChanged)) return null;
        const patch = state.tr;
        state.doc.descendants((node, position) => {
          const attrs = normalizeNotebookNodeAttributes(node.type.name, node.attrs, true);
          if (attrs !== node.attrs) patch.setNodeMarkup(position, undefined, attrs);
          for (const mark of node.marks) {
            const attrs = normalizeNotebookMarkAttributes(mark.type.name, mark.attrs);
            if (attrs === mark.attrs) continue;
            patch.removeMark(position, position + node.nodeSize, mark);
            if (Object.values(attrs).some(value => value != null)) {
              patch.addMark(position, position + node.nodeSize, mark.type.create(attrs));
            }
          }
        });
        // The repairs belong to the original edit's undo/redo step.
        return patch.docChanged ? patch : null;
      },
    })];
  },
});

export const notebookExtensions = [
  StarterKit.configure({
    codeBlock: false, trailingNode: false, gapcursor: false,
    link: { openOnClick: false, autolink: false, linkOnPaste: false, isAllowedUri: safeNotebookHref },
  }),
  TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
  NotebookLegacyIndent,
  TextStyle, Color, BackgroundColor, FontSize, LineHeight, Superscript, Subscript,
  TaskList, TaskItem.configure({ nested: true, a11y: { checkboxLabel: node => t('Checklist item: {name}', { name: node.textContent }) } }),
  Details.configure({ persist: true, renderToggleButton: ({ element, isOpen }) => {
    element.setAttribute('aria-label', t(isOpen ? 'Collapse details' : 'Expand details'));
    element.setAttribute('aria-expanded', String(isOpen));
  } }),
  DetailsSummary, DetailsContent,
  TableKit.configure({ table: { resizable: true } }),
  // Render saved equations without turning typed text into new equations.
  BlockMath.extend({ addInputRules: () => [] }).configure({ katexOptions }),
  InlineMath.extend({ addInputRules: () => [] }).configure({ katexOptions }),
  CodeBlockLowlight.extend({
    addNodeView() { return ReactNodeViewRenderer(NotebookCodeBlock, { contentDOMElementTag: 'code' }); },
  }).configure({ lowlight, defaultLanguage: 'plaintext' }),
];
