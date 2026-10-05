import { useEffect, useState } from 'react';
import { OriginAccessRequiredError, requestOriginAccess } from '../../services/externalSources';

export default function ExternalSourceError({ error, disabled, onRetry }: {
  error: Error; disabled: boolean; onRetry: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [denied, setDenied] = useState(false);
  useEffect(() => { setDenied(false); }, [error]);
  if (!(error instanceof OriginAccessRequiredError)) return <p className="form-error" role="alert">{error.message}</p>;
  return <div className="external-source-access">
    <p className="muted" role="status">{error.message}</p>
    <button type="button" className="quiet-button" disabled={disabled || pending} onClick={() => {
      const request = requestOriginAccess(error.url);
      setPending(true);
      void request.then(granted => {
        setPending(false); setDenied(!granted);
        if (granted) onRetry();
      });
    }}>{pending ? 'Requesting access…' : 'Allow access'}</button>
    {denied && <p className="muted" role="status">Access was not granted. You can try again.</p>}
  </div>;
}
