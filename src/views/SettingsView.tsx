import type { AppearanceSettings, ThemePreference } from '../domain/settings';
import { ItemSizeControl } from '../components/settings/ItemSizeControl';
import { BookmarkImport } from '../components/settings/BookmarkImport';
import { AdvancedSiteIcons } from '../components/settings/AdvancedSiteIcons';
import { DataRecovery } from '../components/settings/DataRecovery';
import type { BookmarkImportRequest, BookmarkImportSummary } from '../domain/importedBookmarks';

interface SettingsViewProps {
  appearance: AppearanceSettings;
  onChange: (patch: Partial<AppearanceSettings>) => void;
  onCommit: () => void;
  disabled: boolean;
  onImport: (request: BookmarkImportRequest) => Promise<BookmarkImportSummary>;
  onImportBusyChange: (busy: boolean) => void;
}

export function SettingsView({ appearance, onChange, onCommit, disabled, onImport, onImportBusyChange }: SettingsViewProps) {
  return (
    <main className="secondary-view settings-view">
      <h1>Settings</h1>
      <section aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Appearance</h2>
        <ItemSizeControl value={appearance.itemSize} onChange={(itemSize) => onChange({ itemSize })} onCommit={onCommit} disabled={disabled} />
        <div className="theme-setting">
          <label htmlFor="theme-preference">Theme</label>
          <select id="theme-preference" value={appearance.theme} disabled={disabled} onChange={(event) => {
            onChange({ theme: event.target.value as ThemePreference });
            onCommit();
          }}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </section>
      <section aria-labelledby="browser-heading">
        <h2 id="browser-heading">Browser</h2>
        <AdvancedSiteIcons disabled={disabled} />
      </section>
      <section aria-labelledby="data-heading">
        <h2 id="data-heading">Data &amp; Recovery</h2>
        <DataRecovery disabled={disabled} />
        <BookmarkImport disabled={disabled} onImport={onImport} onBusyChange={onImportBusyChange} />
      </section>
    </main>
  );
}
