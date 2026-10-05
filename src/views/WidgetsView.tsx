import { t, useLocale } from "../i18n";
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Globe, X } from 'lucide-react';
import { WidgetRegistry } from '../services/widgetRegistry';
import { widgetUsage } from '../services/widgetUsage';
import type { WidgetUsage } from '../services/widgetUsage';
import { WidgetIcon } from '../components/widgets/WidgetIcon';
import { widgetCapabilityService } from '../services/widgetCapabilities';
import { browserCapabilities, permissionService } from '../services/permissions';
import { useFaviconPermission } from '../hooks/useFaviconPermission';
import type { WidgetCapabilityMetadata } from '../domain/widget';

const usefulness: Record<string, string> = {
  note: 'Keep ideas, meeting notes and reference text alongside your Project work.',
  todo: 'Track the next steps for a Project with editable tasks and completion checkboxes.',
  text: 'Organize your canvas with headings and section labels.',
  clip: 'Keep captured evidence, edit its working text and reopen the original source.',
  compare: 'Place options side by side and edit their criteria and values.',
  resource: 'Keep an important shortcut nearby, with an optional date and live countdown.',
  'web-data': 'Connect a public JSON endpoint and display the fields you select.',
  'page-watch': 'Check selected text or data values and see when the source changes.',
  formula: 'Calculate results from your own variables and supported safe formulas.',
  rss: 'Keep recent article titles from a public RSS or Atom feed in your Project.',
  'website-icons': 'Recognize saved links using icons already known to your browser. Fallback icons remain available without access.',
};

function accessSummary(definition: WidgetCapabilityMetadata): string {
  if (definition.requiredCapabilities.includes('active-page-capture')) return 'Requires access to the active page to capture selected text.';
  if (definition.sourceAccess === 'per-origin') {
    const source = 'Site access is requested only when you connect a source.';
    return definition.modeCapabilities?.rendered?.length
      ? `Static and Direct modes work without page access. Rendered mode requires access to the current page through an already-open matching tab. ${source}` : source;
  }
  return 'No additional browser access required.';
}

interface CatalogEntry { type: string; name: string; description: string; access: string; usage: WidgetUsage }
function CatalogIcon({ type, size }: { type: string; size: number }) {
  useLocale();
  return type === 'website-icons' ? <Globe size={size} aria-hidden="true" /> : <WidgetIcon type={type} size={size} />;
}

function WidgetDetail({ entry, status, action, busy, error, onAction, onClose }: {
  entry: CatalogEntry; status: string; action?: string; busy: boolean; error?: string;
  onAction: () => void; onClose: () => void;
}) {
  useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current!, previous = document.activeElement;
    node.showModal();
    return () => { node.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className="add-link-modal widget-detail-panel" aria-labelledby="widget-detail-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header>
      <CatalogIcon type={entry.type} size={24} />
      <h1 id="widget-detail-title">{t(entry.name)}</h1>
      <button type="button" className="quiet-button widget-detail-close" aria-label={t("Close widget details")} title={t("Close")} autoFocus onClick={onClose}><X size={18} /></button>
    </header>
    <p>{t(entry.description)}</p>
    <section><h2>{t("What this does")}</h2><p>{t(usefulness[entry.type])}</p></section>
    <section className="widget-detail-usage"><h2>{t("How to use")}</h2>
      <ol>{entry.usage.usageSteps.map((step, index) => <li key={index}>{t(step)}</li>)}</ol>
      {entry.usage.tip && <p className="muted">{t(entry.usage.tip)}</p>}
      {entry.usage.modes?.map(mode => <p key={t(mode.name)}><strong>{t(mode.name)}:</strong> {t(mode.description)}</p>)}
    </section>
    <section><h2>{action || entry.type === 'website-icons' ? t("Why access is needed") : t("Browser access")}</h2><p>{t(entry.access)}</p>
      {(entry.type === 'clip' || entry.type === 'page-watch') && <p className="muted widget-detail-shared-access">{t("Page capture access is shared by Clip and Rendered Page Watch. Removing it affects both, but keeps existing widgets and data. Static and Direct modes remain available.")}</p>}
      <p className="widget-detail-state muted" role="status">{t(status)}</p>
    </section>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {action && <div className="modal-actions"><button type="button" className={action === 'Grant access' ? 'widget-access-primary' : undefined} disabled={busy} onClick={onAction}>{busy ? t("Updating access…") : t(action ?? "")}</button></div>}
  </dialog>;
}

export function WidgetsView({ enabledWidgetTypes }: { enabledWidgetTypes: ReadonlySet<string> }) {
  useLocale();
  const access = useSyncExternalStore(browserCapabilities.subscribe, browserCapabilities.getSnapshot);
  const favicon = useFaviconPermission();
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pendingAction = useRef(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const entries: CatalogEntry[] = WidgetRegistry.getAll().map(definition => ({
    type: definition.type, name: definition.name, description: definition.description, access: accessSummary(definition), usage: widgetUsage[definition.type],
  }));
  entries.push({ type: 'website-icons', name: 'Website Icons', description: 'Use browser-saved favicons to recognize links.', usage: widgetUsage['website-icons'],
    access: 'Optional access to your browser’s saved website icons. Grant it here if you skipped the first-run step; fallback icons remain available without access.' });
  const entry = entries.find(entry => entry.type === selected);
  function cardState(type: string): string {
    return type === 'clip' ? enabledWidgetTypes.has(type) ? 'Access granted' : 'Permission required'
      : type === 'page-watch' ? access.scripting ? 'Access granted' : 'Permission required'
      : type === 'website-icons' ? favicon ? 'Access granted' : 'Permission required' : 'Available';
  }
  const granted = selected === 'page-watch' ? access.scripting : selected === 'website-icons' ? favicon : enabledWidgetTypes.has(selected ?? '');
  const action = selected === 'clip' ? granted ? 'Remove access' : 'Grant access'
    : selected === 'page-watch' ? granted ? 'Remove access' : 'Grant access'
    : selected === 'website-icons' && !granted ? 'Grant access' : undefined;
  async function changeAccess(type: string, remove: boolean) {
    if (pendingAction.current) return;
    pendingAction.current = true; setPending(true); setErrors(previous => ({ ...previous, [type]: undefined }));
    try {
      // These actions never request/revoke origins or change widget data.
      const definition = WidgetRegistry.get(type);
      const capabilities = type === 'page-watch' ? widgetCapabilityService.modeRequirements(type, 'rendered') : definition?.requiredCapabilities ?? [];
      const changed = type === 'website-icons' ? !remove && await permissionService.request('favicon')
        : remove ? await permissionService.removeCapabilities(capabilities)
        : type === 'page-watch' ? await widgetCapabilityService.requestModeAccess(type, 'rendered') : await widgetCapabilityService.requestEnable(type);
      if (!changed) setErrors(previous => ({ ...previous, [type]: remove ? 'Access could not be removed. Please try again.' : 'Access was not granted. You can try again.' }));
    } catch { setErrors(previous => ({ ...previous, [type]: 'Browser access could not be updated. Please try again.' })); }
    finally { pendingAction.current = false; setPending(false); }
  }
  return <main className="secondary-view widgets-view">
    <header className="widgets-heading"><h1>{t("Widgets & access")}</h1><p className="muted">{t("Your Project tools are always available. Grant browser access here for page capture, rendered content and website icons.")}</p></header>
    <ul className="widget-catalog" aria-label={t("Built-in widgets and capabilities")}>
      {entries.map(entry => <li key={entry.type} className="widget-catalog-entry">
        <div className="widget-catalog-card" data-access={cardState(entry.type) === 'Available' ? 'core' : cardState(entry.type) === 'Access granted' ? 'granted' : 'required'}>
        <button type="button" className="widget-catalog-details" aria-haspopup="dialog" aria-label={t("{0}: {1}. View details", { 0: t(entry.name), 1: t(cardState(entry.type)) })} onClick={() => setSelected(entry.type)}>
          <span className="widget-catalog-icon"><CatalogIcon type={entry.type} size={22} /></span>
          <span className="widget-catalog-name">{t(entry.name)}</span>
          <span className="widget-catalog-description" title={t(entry.description)}>{t(entry.description)}</span>
          <span className="widget-catalog-state">{t(cardState(entry.type))}</span>
          {entry.type === 'page-watch' && <span className="widget-catalog-description">{t("Rendered mode only · Static / Direct available")}</span>}
        </button>
        {cardState(entry.type) === 'Permission required' && <button type="button" className="widget-access-primary" disabled={pending} onClick={() => { void changeAccess(entry.type, false); }}>{t("Grant access")}</button>}
        {errors[entry.type] && <p className="form-error" role="alert">{t(errors[entry.type] ?? '')}</p>}
        </div>
      </li>)}
    </ul>
    {entry && <WidgetDetail key={entry.type} entry={entry} status={entry.type === 'page-watch' ? granted ? t("Rendered access granted") : t("Rendered access required") : cardState(entry.type)}
      action={action} busy={pending} error={errors[entry.type]} onClose={() => setSelected(null)} onAction={() => { void changeAccess(entry.type, granted); }} />}
  </main>;
}
