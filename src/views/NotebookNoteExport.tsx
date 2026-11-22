import { useState } from 'react';
import { Download } from 'lucide-react';
import type { NotebookNode } from '../domain/notebook';
import { t } from '../i18n';
import { NotebookHeaderPicker } from './NotebookHeaderPicker';
import { notebookTextExport } from './notebookTextExport';

const formats = [['md', 'Markdown'], ['txt', 'Plain text'], ['pdf', 'PDF']] as const;
type Format = typeof formats[number][0];

function fileStem(title: string) {
  const slug = title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  const bounded = Array.from(slug).slice(0, 60).join('').replace(/-+$/, '');
  return /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(bounded) ? `_${bounded}` : bounded;
}

function downloadNote(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  try {
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function NotebookNoteExport({ title, readContent }: { title: string; readContent: () => NotebookNode }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function perform(format: Format) {
    setBusy(true);
    setFailed(false);
    try {
      const content = readContent();
      const fallback = t('Untitled note');
      const filename = `${fileStem(title) || fileStem(fallback) || 'untitled-note'}.${format}`;
      const blob = format === 'pdf'
        ? await (await import('./notebookPdfExport')).notebookPdfExport(title.trim() || fallback, content)
        : new Blob([notebookTextExport(content, format)], { type: format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' });
      downloadNote(blob, filename);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return <div className="notebook-note-export" aria-busy={busy}>
    <NotebookHeaderPicker label={t('Export')} disabled={busy} panelClass="notebook-export-panel" preserveEditorFocus
      indicator={<><Download size={15} aria-hidden="true" /><span>{t('Export')}</span></>}>
      {close => formats.map(([format, label]) => <button key={format} type="button" className="quiet-button"
        onMouseDown={event => event.preventDefault()} onClick={() => { close(); void perform(format); }}>
        {t(label)} (.{format})
      </button>)}
    </NotebookHeaderPicker>
    {failed && <p className="notebook-export-error form-error" role="alert">{t('The note could not be exported.')}</p>}
  </div>;
}
