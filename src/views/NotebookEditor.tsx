import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';
import { getLocale, t } from '../i18n';
import { EMPTY_NOTE } from '../domain/notebook';
import type { NotebookPage, NotebookNode } from '../domain/notebook';
import { dataRepository } from '../services/storage';
import { sameWorkspaceValue } from '../services/storage/workspaceImport';
import { useWidgetDraftPersistence } from '../hooks/useWidgetDraftPersistence';

import { NotebookDocumentGuard, notebookExtensions } from './notebookExtensions';
import { NotebookToolbar } from './NotebookToolbar';
import type { NotebookBackground } from './notebookPagePreferences';
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from './notebookPagePreferences';

// Keep the preferred page width for zoom and Fit. At 100%, the page reflows
// to the actual editor column, including any space taken by its scrollbar.
const notebookPageWidth = (viewportWidth: number, padding: number) => Math.max(viewportWidth, 320 + 2 * padding);
const boundZoom = (value: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
// ProseMirror includes undefined defaults in JS objects. Keep the draft in
// its actual JSON form, omitting absent legacy attributes but retaining values.
const documentJSON = (editor: Editor): NotebookNode => JSON.parse(JSON.stringify(editor.getJSON()));

export type NotebookExportSnapshot = { pageId: string; read: () => NotebookNode };

class NotebookConflictError extends Error {}
const conflictMessage = 'This note changed elsewhere. Your draft was not saved.';

export function NotebookEditor({ page, flushRef, exportRef, spellcheck, pagePadding, background, showPaddingGuides, fontSize, lineHeight, zoom, onZoomChange, onSaveConflictCopy }: {
  page: NotebookPage; flushRef: RefObject<(() => Promise<boolean>) | null>; spellcheck: boolean;
  exportRef: RefObject<NotebookExportSnapshot | null>;
  pagePadding: number; background: NotebookBackground; showPaddingGuides: boolean;
  fontSize: number; lineHeight: number; zoom: number; onZoomChange: (value: number) => void;
  onSaveConflictCopy: (content: NotebookNode) => Promise<NotebookNode>;
}) {
  const baseline = useRef(page.content);
  const viewport = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState('');
  const [contentRejected, setContentRejected] = useState(false);
  const [conflict, setConflict] = useState(false);
  const conflictPending = useRef(false);
  const repairing = useRef(false);
  const [repairingConflict, setRepairingConflict] = useState(false);
  const [savedCopy, setSavedCopy] = useState(false);
  const draft = useWidgetDraftPersistence<NotebookNode>({
    value: page.content, delay: 650, errorMessage: 'Notebook changes could not be saved.',
    async save(content) {
      if (conflictPending.current) throw new NotebookConflictError(conflictMessage);
      setError('');
      try {
        await dataRepository.updateNotebook(notebook => {
          const latest = notebook.pages.find(note => note.id === page.id);
          if (!latest || !sameWorkspaceValue(latest.content, baseline.current)) {
            throw new NotebookConflictError(conflictMessage);
          }
          return { ...notebook, pages: notebook.pages.map(note =>
            note.id === page.id ? { ...note, content, updatedAt: Date.now() } : note) };
        });
        baseline.current = content;
      } catch (cause) {
        if (cause instanceof NotebookConflictError) { conflictPending.current = true; setConflict(true); }
        setError(cause instanceof Error ? cause.message : 'Notebook changes could not be saved.');
        throw cause;
      }
    },
  });
  const contentLabel = t('Note content');
  const extensions = useMemo(() => [...notebookExtensions, NotebookDocumentGuard.configure({
    onRejected: () => setContentRejected(true),
  })], []);
  const editor = useEditor({
    extensions,
    content: page.content ?? EMPTY_NOTE, immediatelyRender: false, injectCSS: false,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: 'notebook-document', role: 'textbox', 'aria-multiline': 'true', 'aria-label': contentLabel, spellcheck: String(spellcheck) } },
    onUpdate: ({ editor: current }) => { setSavedCopy(false); setContentRejected(false); draft.replace(documentJSON(current)); },
    onBlur: () => { void draft.flush(); },
  });
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    function measure() {
      if (!node) return;
      const width = node.clientWidth, height = node.clientHeight;
      setViewportSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [editor]);
  useLayoutEffect(() => {
    flushRef.current = draft.flush;
    return () => { flushRef.current = null; };
  }, [draft.flush, flushRef]);
  useLayoutEffect(() => {
    if (!editor) return;
    const snapshot = { pageId: page.id, read: () => documentJSON(editor) };
    exportRef.current = snapshot;
    return () => { if (exportRef.current === snapshot) exportRef.current = null; };
  }, [editor, exportRef, page.id]);
  useEffect(() => {
    if (!editor || !sameWorkspaceValue(draft.config, page.content)) return;
    baseline.current = page.content;
    if (!sameWorkspaceValue(documentJSON(editor), page.content)) {
      editor.commands.setContent(page.content, { emitUpdate: false });
    }
  }, [editor, draft.config, page.content]);
  useEffect(() => {
    editor?.setOptions({ editorProps: { attributes: {
      class: 'notebook-document', role: 'textbox', 'aria-multiline': 'true', 'aria-label': contentLabel, spellcheck: String(spellcheck),
    } } });
  }, [editor, contentLabel, spellcheck]);

  async function resolveConflict(copy: boolean) {
    if (!editor || repairing.current) return;
    repairing.current = true;
    setRepairingConflict(true);
    setError('');
    try {
      await draft.flush(); // Let the conflicted save settle before resetting its draft.
      const committed = copy ? await onSaveConflictCopy(draft.latest.current)
        : (await dataRepository.readNotebook()).pages.find(note => note.id === page.id)?.content;
      if (!committed) throw new Error('This notebook item is no longer available.');
      // Clear history so Undo cannot resurrect the discarded local draft.
      const { schema, plugins } = editor.state;
      editor.view.updateState(EditorState.create({ schema, plugins, doc: schema.nodeFromJSON(committed) }));
      baseline.current = committed;
      draft.reset(committed);
      conflictPending.current = false;
      setConflict(false);
      setContentRejected(false);
      setSavedCopy(copy);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Notebook changes could not be saved.');
    } finally {
      repairing.current = false;
      setRepairingConflict(false);
    }
  }

  if (!editor) return null;
  const text = editor.getText();
  const words = [...new Intl.Segmenter(getLocale(), { granularity: 'word' }).segment(text)]
    .filter(segment => segment.isWordLike).length;
  return <>
    <NotebookToolbar editor={editor} fontSize={fontSize} lineHeight={lineHeight} disabled={repairingConflict} />
    {(error || draft.error) && <p className="form-error" role="alert">{t(error || draft.error || '')}</p>}
    {conflict && <div className="notebook-conflict-actions" aria-label={t(conflictMessage)} role="group">
      <button type="button" className="quiet-button" disabled={repairingConflict} onClick={() => void resolveConflict(true)}>{t('Save as a copy')}</button>
      <button type="button" className="quiet-button" disabled={repairingConflict} onClick={() => void resolveConflict(false)}>{t('Reload saved note')}</button>
    </div>}
    {savedCopy && <p className="muted notebook-conflict-actions" role="status">{t('Draft saved as a copy.')}</p>}
    {contentRejected && <p className="form-error" role="alert">{t('This edit exceeds the supported Notebook content limits.')}</p>}
    <div className="notebook-editor-scroll" ref={viewport} inert={repairingConflict}>
      <EditorContent editor={editor} className="notebook-page-surface" data-notebook-background={background}
        data-show-padding-guides={showPaddingGuides || undefined}
        style={{ '--notebook-page-padding': `${pagePadding}px`, '--notebook-base-line-height': lineHeight, fontSize,
          width: zoom === 100 ? '100%' : notebookPageWidth(viewportSize.width, pagePadding),
          minHeight: zoom === 100 ? '100%' : Math.floor(viewportSize.height / (zoom / 100)),
          zoom: zoom / 100 } as CSSProperties} />
    </div>
    <footer className="notebook-editor-footer">
      <p className="notebook-word-count muted">{t('Words: {words} · Characters: {characters}', { words, characters: Array.from(text).length })}</p>
      <div className="project-canvas-controls notebook-zoom-controls" role="group" aria-label={t('Notebook zoom')}>
        <button type="button" className="quiet-button" aria-label={t('Zoom out')} title={t('Zoom out')}
          disabled={zoom <= ZOOM_MIN} onClick={() => onZoomChange(boundZoom(zoom - ZOOM_STEP))}>−</button>
        <output>{new Intl.NumberFormat(getLocale(), { style: 'percent' }).format(zoom / 100)}</output>
        <button type="button" className="quiet-button" aria-label={t('Zoom in')} title={t('Zoom in')}
          disabled={zoom >= ZOOM_MAX} onClick={() => onZoomChange(boundZoom(zoom + ZOOM_STEP))}>+</button>
        <button type="button" className="quiet-button" onClick={() => {
          const node = viewport.current;
          if (!node?.clientWidth) return;
          const width = node.clientWidth;
          onZoomChange(boundZoom(Math.floor(100 * width / notebookPageWidth(width, pagePadding))));
          node.scrollLeft = 0;
        }}>{t('Fit')}</button>
      </div>
    </footer>
  </>;
}
