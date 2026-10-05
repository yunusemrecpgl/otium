import { t, useLocale } from "../i18n";
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useTheme } from '../hooks/useTheme';
import { useBrowserColorScheme } from '../hooks/useBrowserColorScheme';
import type { Theme } from '../domain/settings';
import { exportRecoveryData } from '../services/workspaceExport';

function ApplicationRecovery({ retry, theme }: { retry: () => void; theme: Theme }) {
  useLocale();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function exportData() {
    if (exporting) return;
    setExporting(true); setError(null);
    try { await exportRecoveryData(); }
    catch { setError('Recovery data could not be exported. Please try again.'); }
    finally { setExporting(false); }
  }
  return <main className="otium-app application-error" data-theme={theme}>
    <h1>{t("Something went wrong")}</h1>
    <p>{t("Your stored workspace has not been reset.")}</p>
    <div className="data-recovery-actions">
      <button type="button" className="quiet-button" onClick={retry} disabled={exporting}>{t("Retry")}</button>
      <button type="button" className="quiet-button" onClick={() => window.location.reload()} disabled={exporting}>{t("Reload")}</button>
      <button type="button" className="quiet-button" onClick={() => { void exportData(); }} disabled={exporting}>{t("Export Recovery Data")}</button>
    </div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
  </main>;
}

function WorkspaceRecovery({ retry }: { retry: () => void }) {
  const theme = useTheme();
  return <ApplicationRecovery retry={retry} theme={theme} />;
}

function BrowserRecovery({ retry }: { retry: () => void }) {
  const theme = useBrowserColorScheme();
  return <ApplicationRecovery retry={retry} theme={theme} />;
}

export function ApplicationErrorBoundary({ children, browserTheme = false }: { children: ReactNode; browserTheme?: boolean }) {
  useLocale();
  return <ErrorBoundary fallback={retry => browserTheme ? <BrowserRecovery retry={retry} /> : <WorkspaceRecovery retry={retry} />}>{children}</ErrorBoundary>;
}
