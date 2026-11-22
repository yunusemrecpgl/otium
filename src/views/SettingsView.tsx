import { t, useLocale } from "../i18n";
import type { AppearanceSettings, ThemePreference } from '../domain/settings';
import { ItemSizeControl } from '../components/settings/ItemSizeControl';
import { BookmarkImport } from '../components/settings/BookmarkImport';
import { AdvancedSiteIcons } from '../components/settings/AdvancedSiteIcons';
import { WorkspaceImport } from '../components/settings/WorkspaceImport';
import { exportWorkspace } from '../services/workspaceExport';
import { useState } from 'react';
import type { BookmarkImportRequest, BookmarkImportSummary } from '../domain/importedBookmarks';
import { LANGUAGES } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import { setLocale } from '../i18n';

interface SettingsViewProps {
  appearance: AppearanceSettings;
  onChange: (patch: Partial<AppearanceSettings>) => void;
  onCommit: () => void;
  disabled: boolean;
  onImport: (request: BookmarkImportRequest) => Promise<BookmarkImportSummary>;
  onImportBusyChange: (busy: boolean) => void;
}

export function SettingsView({ appearance, onChange, onCommit, disabled, onImport, onImportBusyChange }: SettingsViewProps) {
  useLocale();
  const [exportError, setExportError] = useState('');
  return (
    <main className="secondary-view settings-view">
      <div className="settings-content">
      <div className="settings-brand"><img src="/otium-logo.png" alt="" /><span>Otium</span></div>
      <h1>{t("Settings")}</h1>
      <div className="settings-grid">
      <section aria-labelledby="general-heading"><h2 id="general-heading">{t("General")}</h2>
        <div className="settings-control-row"><label htmlFor="language-preference">{t("Language")}</label>
          <select id="language-preference" value={appearance.language ?? 'en'} disabled={disabled} onChange={event => {
            const language = event.target.value as Locale;
            setLocale(language); onChange({ language }); onCommit();
          }}>{LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.name}</option>)}</select>
        </div>
        <div className="settings-control-row">
          <label htmlFor="theme-preference">{t("Theme")}</label>
          <select id="theme-preference" value={appearance.theme} disabled={disabled} onChange={event => {
            onChange({ theme: event.target.value as ThemePreference }); onCommit();
          }}><option value="system">{t("System")}</option><option value="light">{t("Light")}</option><option value="dark">{t("Dark")}</option></select>
        </div>
      </section>
      <section aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">{t("Appearance")}</h2>
        <ItemSizeControl value={appearance.itemSize} onChange={(itemSize) => onChange({ itemSize })} onCommit={onCommit} disabled={disabled} />
      </section>
      <section aria-labelledby="browser-heading">
        <h2 id="browser-heading">{t("Browser")}</h2>
        <AdvancedSiteIcons disabled={disabled} />
      </section>
      <section aria-labelledby="data-heading">
        <h2 id="data-heading">{t("Data")}</h2>
        <div className="settings-data-layout">
        <section className="settings-data-card settings-data-bookmarks" aria-labelledby="data-bookmarks-title">
          <BookmarkImport disabled={disabled} onImport={onImport} onBusyChange={onImportBusyChange} />
        </section>
        <WorkspaceImport disabled={disabled} onBusyChange={onImportBusyChange} />
        <section className="settings-data-card settings-data-export" aria-labelledby="data-export-title">
        <h3 id="data-export-title">{t('Export')}</h3>
        <p className="muted">{t('Download your Otium workspace as a JSON file.')}</p>
        <button type="button" className="quiet-button" disabled={disabled} onClick={() => {
          setExportError('');
          void exportWorkspace().catch(cause => setExportError(cause instanceof Error ? cause.message : String(cause)));
        }}>{t('Export Otium Workspace')}</button>
        {exportError && <p className="form-error" role="alert">{t(exportError)}</p>}
        </section>
        </div>
      </section>
      </div></div>
    </main>
  );
}
