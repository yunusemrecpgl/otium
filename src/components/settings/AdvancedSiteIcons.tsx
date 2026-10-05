import { useRef, useState } from 'react';
import { useFaviconPermission } from '../../hooks/useFaviconPermission';
import { permissionService } from '../../services/permissions';

export function AdvancedSiteIcons({ disabled }: { disabled: boolean }) {
  const granted = useFaviconPermission();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requesting = useRef(false);
  const available = permissionService.isAvailable();
  return <div className="advanced-site-icons">
    <p>Advanced site icons</p>
    <p className="muted">Use your browser's saved website icons to improve missing icons.</p>
    <button type="button" disabled={disabled || busy || granted || !available} onClick={async () => {
      if (requesting.current) return;
      requesting.current = true; setBusy(true); setMessage(null);
      try {
        const enabled = await permissionService.request('favicon');
        if (!enabled) setMessage('Advanced site icons remain disabled.');
      } catch { setMessage('Unable to enable advanced site icons.'); }
      finally { requesting.current = false; setBusy(false); }
    }}>{granted ? 'Enabled' : busy ? 'Enabling…' : 'Enable'}</button>
    {!available && <p className="muted">Available when Otium is opened as an extension.</p>}
    {!granted && message && <p role="status">{message}</p>}
  </div>;
}
