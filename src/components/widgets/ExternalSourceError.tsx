import { t, useLocale } from "../../i18n";
import { useEffect, useState } from 'react';
import { OriginAccessRequiredError, requestOriginAccess } from '../../services/externalSources';
import { BrowserCapabilityRequiredError, permissionService } from '../../services/permissions';

export default function ExternalSourceError({ error, disabled, onRetry }: {
  error: Error; disabled: boolean; onRetry: () => void;
}) {
  useLocale();
  const [pending, setPending] = useState(false);
  const [denied, setDenied] = useState(false);
  useEffect(() => { setDenied(false); }, [error]);
  if (!(error instanceof OriginAccessRequiredError) && !(error instanceof BrowserCapabilityRequiredError)) return <p className="form-error" role="alert">{t(error.message)}</p>;
  return <div className="external-source-access">
    <p className="muted" role="status">{error instanceof OriginAccessRequiredError ? t("Access required for {host}", { host: new URL(error.url).hostname }) : t(error.message)}</p>
    <button type="button" className="quiet-button" disabled={disabled || pending} onClick={() => {
      const request = error instanceof OriginAccessRequiredError ? requestOriginAccess(error.url) : permissionService.requestCapabilities(error.capabilities);
      setPending(true);
      void request.then(granted => {
        setPending(false); setDenied(!granted);
        if (granted) onRetry();
      }).catch(() => { setPending(false); setDenied(true); });
    }}>{pending ? t("Requesting access…") : error instanceof BrowserCapabilityRequiredError ? t("Grant access") : t("Allow access")}</button>
    {denied && <p className="muted" role="status">{t("Access was not granted. You can try again.")}</p>}
  </div>;
}
