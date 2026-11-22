import { useRef, useState } from 'react';
import { getLocale, t, useLocale } from '../../i18n';
import { dataRepository } from '../../services/storage';
import { readWorkspaceImport } from '../../services/storage/workspaceImport';

export function WorkspaceImport({ disabled, onBusyChange }: { disabled: boolean; onBusyChange: (busy: boolean) => void }) {
  useLocale();
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof readWorkspaceImport>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const report = (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause));
  return <>
    <section className="settings-data-card settings-data-workspace bookmark-import" aria-labelledby="data-workspace-title">
    <h3 id="data-workspace-title">{t('Otium Workspace')}</h3>
    <p className="muted">{t('Restore a previously exported Otium workspace.')}</p>
    <input ref={input} type="file" hidden accept=".json,application/json" aria-label={t('Import Otium Workspace')}
      onChange={async event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file || pending.current) return;
        pending.current = true; setBusy(true); setPreview(null); setError('');
        try { setPreview(await readWorkspaceImport(file)); }
        catch (cause) { report(cause); }
        finally { pending.current = false; setBusy(false); }
      }} />
    <button type="button" className="quiet-button" disabled={disabled || busy} onClick={() => input.current?.click()}>{t('Import Otium Workspace')}</button>
    </section>
    <section className="settings-data-card settings-data-preview bookmark-import" aria-labelledby="data-preview-title">
    <h3 id="data-preview-title">{t('Preview')}</h3>
    {preview ? <div>
      <p>{t('Projects')}: {preview.data.projects.length} · {t('Folders')}: {preview.data.folders.length} · {t('Links')}: {preview.data.links.length} · {t('Widgets')}: {preview.data.widgetInstances.length}</p>
      {preview.exportedAt && <p>{preview.exportedAt.toLocaleString(getLocale())}</p>}
      <p>{t('Importing this workspace will replace your current Otium workspace.')}</p>
      <div className="bookmark-import-actions">
        <button type="button" disabled={disabled || busy} onClick={async () => {
          if (pending.current) return;
          pending.current = true; setBusy(true); setError(''); onBusyChange(true);
          try { await dataRepository.replaceWorkspace(preview.data); window.location.reload(); }
          catch (cause) { report(cause); }
          finally { pending.current = false; setBusy(false); onBusyChange(false); }
        }}>{t('Replace workspace')}</button>
        <button type="button" disabled={busy} onClick={() => setPreview(null)}>{t('Cancel')}</button>
      </div>
    </div> : <div>
      <p className="muted">{t('No workspace selected yet.')}</p>
      <p className="muted">{t('Select an Otium workspace file to review it before importing.')}</p>
    </div>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    </section>
  </>;
}
