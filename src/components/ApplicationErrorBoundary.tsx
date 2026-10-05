import { useState } from 'react';
import type { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useTheme } from '../hooks/useTheme';
import { exportRecoveryData } from '../services/workspaceExport';

function ApplicationRecovery({ retry }: { retry: () => void }) {
  const theme = useTheme();
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
    <h1>Something went wrong</h1>
    <p>Your stored workspace has not been reset.</p>
    <div className="data-recovery-actions">
      <button type="button" className="quiet-button" onClick={retry} disabled={exporting}>Retry</button>
      <button type="button" className="quiet-button" onClick={() => window.location.reload()} disabled={exporting}>Reload</button>
      <button type="button" className="quiet-button" onClick={() => { void exportData(); }} disabled={exporting}>Export Recovery Data</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </main>;
}

export function ApplicationErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary fallback={retry => <ApplicationRecovery retry={retry} />}>{children}</ErrorBoundary>;
}
