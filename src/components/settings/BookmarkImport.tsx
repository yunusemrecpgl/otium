import { useEffect, useRef, useState } from 'react';
import type { ImportedBookmarkNode, BookmarkImportRequest, BookmarkImportSummary } from '../../domain/importedBookmarks';
import { parseBookmarkHtml } from '../../services/bookmarkHtml';
import { BOOKMARK_IMPORT_LIMITS } from '../../constants/bookmarkImport';
import { fingerprintBookmarkHtml, RepeatedBookmarkImportError } from '../../services/bookmarkImportSafety';

interface Props {
  disabled: boolean;
  onImport: (request: BookmarkImportRequest) => Promise<BookmarkImportSummary>;
  onBusyChange: (busy: boolean) => void;
}
interface Preview { nodes: ImportedBookmarkNode[]; summary: BookmarkImportSummary; filename: string; fingerprint: string }

export function BookmarkImport({ disabled, onImport, onBusyChange }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<BookmarkImportSummary | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const submitting = useRef(false);
  useEffect(() => () => { request.current++; }, []);
  return <div className="bookmark-import">
    <label htmlFor="bookmark-html-file">Import bookmarks</label>
    <p className="muted">Import an exported browser bookmark HTML file.</p>
    <input ref={input} id="bookmark-html-file" type="file" accept=".html,.htm,text/html" disabled={disabled || parsing || busy}
      onChange={async event => {
        const file = event.currentTarget.files?.[0];
        const token = ++request.current;
        setPreview(null); setError(null); setSuccess(null);
        if (!file) return;
        setParsing(true);
        try {
          if (file.size > BOOKMARK_IMPORT_LIMITS.fileBytes) throw new Error('Bookmark file is too large.');
          const html = await file.text();
          if (token !== request.current) return;
          const parsed = await parseBookmarkHtml(html);
          if (token !== request.current) return;
          const fingerprint = await fingerprintBookmarkHtml(html);
          if (token !== request.current) return;
          setPreview({ ...parsed, filename: file.name, fingerprint });
        } catch (cause) {
          if (token === request.current) {
            setError(cause instanceof Error ? cause.message : 'Unable to read this bookmark file.');
            if (input.current) input.current.value = '';
          }
        } finally { if (token === request.current) setParsing(false); }
      }} />
    {parsing && <p role="status">Reading bookmarks…</p>}
    {preview && <div className="bookmark-import-preview">
      <p className="bookmark-import-filename" title={preview.filename}>{preview.filename}</p>
      <p role="status">{preview.summary.bookmarks} bookmarks · {preview.summary.folders} folders</p>
      <div className="bookmark-import-actions">
        <button type="button" disabled={disabled || busy} onClick={async () => {
          if (submitting.current) return;
          submitting.current = true; setBusy(true); setError(null); onBusyChange(true);
          try {
            const importRequest = { nodes: preview.nodes, fingerprint: preview.fingerprint };
            let summary: BookmarkImportSummary;
            try { summary = await onImport(importRequest); }
            catch (cause) {
              if (!(cause instanceof RepeatedBookmarkImportError)) throw cause;
              // The storage lock is released before asking. An explicit repeat
              // still builds from the freshest snapshot in a new locked mutation.
              if (!window.confirm(cause.message)) return;
              summary = await onImport({ ...importRequest, allowRepeat: true });
            }
            setSuccess(summary); setPreview(null);
            if (input.current) input.current.value = '';
          } catch (cause) { setError(cause instanceof Error ? cause.message : 'Bookmarks could not be imported.'); }
          finally { submitting.current = false; setBusy(false); onBusyChange(false); }
        }}>{busy ? 'Importing…' : 'Import'}</button>
        <button type="button" disabled={busy} onClick={() => {
          setPreview(null); setError(null);
          if (input.current) input.current.value = '';
        }}>Cancel</button>
      </div>
    </div>}
    {success && <p role="status">Imported {success.bookmarks} bookmarks and {success.folders} folders.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
