import { t, useLocale } from "../../i18n";
import { useEffect, useRef, useState } from 'react';
import type { ImportedBookmarkNode, BookmarkImportSummary } from '../../domain/importedBookmarks';
import { parseBookmarkHtml } from '../../services/bookmarkHtml';
import { BOOKMARK_IMPORT_LIMITS } from '../../constants/bookmarkImport';
import { fingerprintBookmarkSource } from '../../services/bookmarkImportSafety';
import { useBookmarkImport } from './useBookmarkImport';
import type { ImportBookmarks } from './useBookmarkImport';

interface Props {
  disabled: boolean;
  onImport: ImportBookmarks;
  onBusyChange: (busy: boolean) => void;
}
interface Preview { nodes: ImportedBookmarkNode[]; summary: BookmarkImportSummary; filename: string; fingerprint: string }

export function BookmarkImport({ disabled, onImport, onBusyChange }: Props) {
  useLocale();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const { busy, error, success, denied, canReadBrowser, clearFeedback, fromBrowser, run } = useBookmarkImport(onImport, onBusyChange);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  function clearPreview() {
    setPreview(null);
    if (input.current) input.current.value = '';
  }
  const message = parseError ?? error;
  return <div className="bookmark-import">
    <h3 id="data-bookmarks-title">{t('Browser Bookmarks')}</h3>
    <p className="muted">{t('Copy bookmarks and folders into Otium from this browser or an exported HTML file.')}</p>
    <div className="bookmark-import-choices">
      <button type="button" className="quiet-button" disabled={disabled || parsing || busy || !canReadBrowser} onClick={() => {
        setParseError(null);
        void fromBrowser().then(result => { if (result === 'imported') clearPreview(); });
      }}>{t('Import from this browser')}</button>
      <button type="button" className="quiet-button" disabled={disabled || parsing || busy} onClick={() => input.current?.click()}>{t('Import exported HTML')}</button>
    </div>
    <input ref={input} type="file" hidden aria-label={t('Import exported HTML')} accept=".html,.htm,text/html" disabled={disabled || parsing || busy}
      onChange={async event => {
        const file = event.currentTarget.files?.[0];
        const token = ++request.current;
        setPreview(null); setParseError(null); clearFeedback();
        if (!file) return;
        setParsing(true);
        try {
          if (file.size > BOOKMARK_IMPORT_LIMITS.fileBytes) throw new Error('Bookmark file is too large.');
          const html = await file.text();
          if (token !== request.current) return;
          const parsed = await parseBookmarkHtml(html);
          if (token !== request.current) return;
          const fingerprint = await fingerprintBookmarkSource(html);
          if (token !== request.current) return;
          setPreview({ ...parsed, filename: file.name, fingerprint });
        } catch (cause) {
          if (token === request.current) {
            setParseError(cause instanceof Error ? cause.message : 'Unable to read this bookmark file.');
            if (input.current) input.current.value = '';
          }
        } finally { if (token === request.current) setParsing(false); }
      }} />
    {parsing && <p role="status">{t("Reading bookmarks…")}</p>}
    {busy && <p role="status">{t('Importing…')}</p>}
    {preview && <div className="bookmark-import-preview">
      <p className="bookmark-import-filename" title={preview.filename}>{preview.filename}</p>
      <p role="status">{t("{count} bookmarks · {folders} folders", { count: preview.summary.bookmarks, folders: preview.summary.folders })}</p>
      <div className="bookmark-import-actions">
        <button type="button" disabled={disabled || busy} onClick={() => {
          void run(() => ({ nodes: preview.nodes, fingerprint: preview.fingerprint }))
            .then(result => { if (result === 'imported') clearPreview(); });
        }}>{busy ? t("Importing…") : t("Import")}</button>
        <button type="button" disabled={busy} onClick={() => {
          clearPreview(); setParseError(null); clearFeedback();
        }}>{t("Cancel")}</button>
      </div>
    </div>}
    {success && <p role="status">{t("Imported {count} bookmarks and {folders} folders.", { count: success.bookmarks, folders: success.folders })}</p>}
    {denied && <p className="muted" role="status">{t('Bookmark access was not granted. You can still import exported HTML.')}</p>}
    {message && <p className="form-error" role="alert">{t(message)}</p>}
  </div>;
}
