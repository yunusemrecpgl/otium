import { t, useLocale } from "../../i18n";
import { useEffect, useRef, useState } from 'react';
import { permissionService } from '../../services/permissions';
import { websiteIconsOnboarding } from '../../services/websiteIconsOnboarding';
import { useFaviconPermission } from '../../hooks/useFaviconPermission';
import { Globe } from 'lucide-react';

export function WebsiteIconsOnboarding() {
  useLocale();
  const granted = useFaviconPermission();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const allow = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!permissionService.isAvailable()) return;
    let active = true, completedElsewhere = false;
    let unsubscribe = () => {};
    try {
      unsubscribe = websiteIconsOnboarding.subscribe(() => {
        completedElsewhere = true;
        if (active) setVisible(false);
      });
    } catch (cause) { console.warn('Website Icons onboarding synchronization is unavailable.', cause); }
    void Promise.all([websiteIconsOnboarding.completed(), permissionService.has('favicon')]).then(async ([completed, access]) => {
      if (!active || completedElsewhere) return;
      if (access && !completed) await websiteIconsOnboarding.complete();
      else if (!completed) setVisible(true);
    }).catch(cause => console.warn('Website Icons onboarding could not be read.', cause));
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!granted || !visible || pending.current) return;
    void websiteIconsOnboarding.complete().then(() => setVisible(false))
      .catch(() => setError('Could not remember this choice. Please try again.'));
  }, [granted, visible]);
  useEffect(() => {
    if (!visible) return;
    const node = dialog.current!, previous = document.activeElement;
    node.showModal(); allow.current?.focus();
    return () => { node.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [visible]);
  async function finish(request: boolean) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      // The browser request is the first async operation in this click handler.
      // Declining it also completes this step; manual retry remains in Settings.
      if (request) await permissionService.request('favicon');
      await websiteIconsOnboarding.complete();
      setVisible(false);
    } catch { setError('Could not complete this step. Please try again or choose Not now.'); }
    finally { pending.current = false; setBusy(false); }
  }
  if (!visible) return null;
  return <dialog ref={dialog} className="website-icons-onboarding" aria-labelledby="website-icons-title" aria-describedby="website-icons-description" aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) void finish(false); }}>
    <div className="website-icons-illustration" aria-hidden="true"><Globe size={52} strokeWidth={1.25} /></div>
    <h2 id="website-icons-title">{t("Enable website icons")}</h2>
    <p id="website-icons-description">{t("Otium uses your browser’s saved website icons to make links and saved websites easier to recognize. Granting this access improves the default experience.")}</p>
    <div className="website-icons-onboarding-actions">
      <button ref={allow} type="button" className="widget-access-primary" disabled={busy} onClick={() => { void finish(!granted); }}>{busy ? t("Saving…") : t("Allow website icons")}</button>
      <button type="button" className="text-button" disabled={busy} onClick={() => { void finish(false); }}>{t("Not now")}</button>
    </div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
  </dialog>;
}
