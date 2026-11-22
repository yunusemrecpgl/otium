import { Extension } from '@tiptap/react';

// Retain old paragraph JSON on edits, but don't render or propagate the indent.
export const NotebookLegacyIndent = Extension.create({
  name: 'notebookLegacyIndent',
  addGlobalAttributes() {
    return [{
      types: ['paragraph'],
      attributes: { indentLevel: { default: undefined, rendered: false, keepOnSplit: false } },
    }];
  },
});
