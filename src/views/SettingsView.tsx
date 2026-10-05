import { t, useLocale } from "../i18n";
import type { AppearanceSettings, ThemePreference } from '../domain/settings';
import { ItemSizeControl } from '../components/settings/ItemSizeControl';
import { BookmarkImport } from '../components/settings/BookmarkImport';
import { AdvancedSiteIcons } from '../components/settings/AdvancedSiteIcons';
import { DataRecovery } from '../components/settings/DataRecovery';
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
        <h2 id="data-heading">{t("Data & Recovery")}</h2>
        <DataRecovery disabled={disabled} />
      </section>
      <section aria-labelledby="import-heading"><h2 id="import-heading">{t("Import")}</h2>
        <BookmarkImport disabled={disabled} onImport={onImport} onBusyChange={onImportBusyChange} />
      </section>
      </div></div>
    </main>
  );
}
