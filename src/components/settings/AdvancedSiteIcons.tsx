import { t, useLocale } from "../../i18n";
import { useRef, useState } from 'react';
import { useFaviconPermission } from '../../hooks/useFaviconPermission';
import { permissionService } from '../../services/permissions';

export function AdvancedSiteIcons({ disabled }: { disabled: boolean }) {
  useLocale();
  const granted = useFaviconPermission();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requesting = useRef(false);
  const available = permissionService.isAvailable();
  return <div className="advanced-site-icons">
    <p>{t("Website Icons")}</p>
    <p className="muted">{t("Use your browser's saved website icons so links are easier to recognize.")}</p>
    <p className="muted" role="status">{granted ? t("Access granted") : t("Access required")}</p>
    {!granted && <button type="button" disabled={disabled || busy || !available} onClick={async () => {
      if (requesting.current) return;
      requesting.current = true; setBusy(true); setMessage(null);
      try {
        const enabled = await permissionService.request('favicon');
        if (!enabled) setMessage('Access was not granted. Fallback icons remain available.');
      } catch { setMessage('Unable to grant website icon access.'); }
      finally { requesting.current = false; setBusy(false); }
    }}>{busy ? t("Requesting…") : t("Grant access")}</button>}
    {!available && <p className="muted">{t("Available when Otium is opened as an extension.")}</p>}
    {!granted && message && <p role="status">{t(message)}</p>}
  </div>;
}
