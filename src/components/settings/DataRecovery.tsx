import { useEffect, useRef, useState } from 'react';
import { dataRepository } from '../../services/storage';
import type { RecoveryStatus } from '../../services/storage/recovery';
import { exportRecoveryData, exportWorkspace } from '../../services/workspaceExport';

interface DataRecoveryProps {
  disabled?: boolean;
  onRetry?: () => Promise<void>;
}

export function DataRecovery({ disabled = false, onRetry }: DataRecoveryProps) {
  const [status, setStatus] = useState<RecoveryStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false);
  useEffect(() => {
    let active = true;
    void dataRepository.getRecoveryStatus().then(next => {
      if (active) setStatus(next);
    }).catch(() => { if (active) setError('Recovery snapshot status could not be read.'); });
    return () => { active = false; };
  }, []);

  async function perform(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setBusy(true); setError(null);
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The recovery action could not be completed.'); }
    finally { working.current = false; setBusy(false); }
  }

  return <div className="data-recovery">
    {status && <p className="muted">{status.available
      ? `Recovery snapshot: ${new Date(status.createdAt!).toLocaleString()}`
      : status.exists ? 'Stored recovery data is not a supported, valid restore snapshot.' : 'No recovery snapshot available yet.'}</p>}
    <div className="data-recovery-actions" aria-busy={busy}>
      {onRetry ? <button className="quiet-button" type="button" disabled={disabled || busy} onClick={() => void perform(onRetry)}>Retry</button>
        : <button className="quiet-button" type="button" disabled={disabled || busy} onClick={() => void perform(exportWorkspace)}>Export Workspace</button>}
      <button className="quiet-button" type="button" disabled={disabled || busy} onClick={() => void perform(exportRecoveryData)}>Export Recovery Data</button>
      {status?.available && <button className="quiet-button" type="button" disabled={disabled || busy} onClick={() => {
        if (!window.confirm(`Replace the current workspace with the recovery snapshot from ${new Date(status.createdAt!).toLocaleString()}? Current stored data will be preserved for recovery export.`)) return;
        void perform(async () => {
          await dataRepository.restoreRecovery(status.createdAt!);
          window.location.reload();
        });
      }}>Restore Last Known Good</button>}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}

export function WorkspaceRecovery({ error, onRetry }: { error: string; onRetry: () => Promise<void> }) {
  return <main className="secondary-view settings-view">
    <h1>Otium cannot load this workspace</h1>
    <p>The original stored data is still available. Export it before making recovery changes.</p>
    <p className="form-error" role="alert">{error}</p>
    <DataRecovery onRetry={onRetry} />
  </main>;
}
