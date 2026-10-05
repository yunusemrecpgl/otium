import { t, useLocale } from "../../i18n";
import { useProjectQuickActions } from '../../hooks/useProjectQuickActions';
import type { RegisterProjectQuickActions } from '../projects/ProjectContextToolbar';
import { FormattingControls } from '../projects/NoteFormattingBar';
import { normalizeTextStyle } from '../../domain/text';
import { widgetSurface, widgetTypography, widgetTitleTypography } from './widgetAppearance';
import { WidgetInspectorPortal } from '../projects/WidgetInspectorPortal';
import { useState, useSyncExternalStore } from 'react';
import { browserCapabilities } from '../../services/permissions';
import { widgetCapabilityService } from '../../services/widgetCapabilities';
import { useWidgetDraftPersistence } from '../../hooks/useWidgetDraftPersistence';
import { Quote, RotateCcw } from 'lucide-react';
import type { WidgetInstance } from '../../domain/widget';
import { readClipConfig } from '../../domain/clip';
import type { ClipConfig } from '../../domain/clip';
import { normalizeUrl } from '../../utils/url';
import { browserTabsService } from '../../services/browserTabs';
import { clipSourceUrl } from '../../utils/textFragment';
import { useStaticFavicon } from '../../hooks/useStaticFavicon';

export default function ClipWidget({ instance, disabled, onUpdate, inspectorTarget, onQuickActions }: {
  instance: WidgetInstance;
  disabled: boolean;
  onUpdate: (id: string, config: ClipConfig) => Promise<void>;
  inspectorTarget?: HTMLElement | null;
  onQuickActions?: RegisterProjectQuickActions;
}) {
  useLocale();
  const access = useSyncExternalStore(browserCapabilities.subscribe, browserCapabilities.getSnapshot);
  const { config, latest, error: saveError, flush, replace } = useWidgetDraftPersistence<ClipConfig>({
    value: readClipConfig(instance.config), save: config => onUpdate(instance.id, config), errorMessage: t("Clip could not be saved."),
  });
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [failedFavicon, setFailedFavicon] = useState<string | null>(null);
  function edit(patch: Partial<ClipConfig>) {
    const next = { ...latest.current, ...patch };
    if (patch.sourceUrl !== undefined && patch.sourceUrl !== latest.current.sourceUrl) delete next.textFragmentUrl;
    replace(next);
  }
  const source = normalizeUrl(config.sourceUrl);
  const url = clipSourceUrl(config.sourceUrl, config.textFragmentUrl);
  const hostname = source ? new URL(source).hostname : '';
  const pageTitle = typeof instance.config.pageTitle === 'string' ? instance.config.pageTitle.trim() : '';
  const title = config.sourceTitle.trim() || pageTitle || hostname || 'Untitled Clip';
  const favicon = useStaticFavicon(source ?? undefined, config.faviconUrl);
  const sourceLetter = hostname.replace(/^www\./i, '').charAt(0).toUpperCase();
  const appearance = normalizeTextStyle(config.style);
  const open = async () => {
      if (!url || opening) return;
      setOpening(true); setError(null);
      try { await browserTabsService.openLink(url); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Source could not be opened.'); }
      finally { setOpening(false); }
    };
  useProjectQuickActions(instance.id, onQuickActions, { snapshot: () => latest.current, open: { run: open, disabled: disabled || opening || !url, label: "Open Source" } });
  return <div className="note-widget clip-widget" style={widgetSurface(appearance)}>
    <header className="note-widget-header clip-widget-header"><Quote size={16} aria-hidden="true" />
      <input spellCheck={false} aria-label={t("Source title")} placeholder={title} title={title} value={config.sourceTitle}
        style={widgetTitleTypography(appearance)} disabled={disabled} onChange={event => edit({ sourceTitle: event.target.value })} onBlur={flush} />
    </header>
    <textarea spellCheck={false} aria-label={t("Clip text")} placeholder={t("Quote or evidence…")} value={config.text} style={widgetTypography(appearance)} disabled={disabled}
      onChange={event => edit({ text: event.target.value })} onBlur={flush} />
    <button type="button" className="quiet-button clip-open-source" disabled={disabled || opening || !url} onClick={open}>{t("Open Source")}</button>
    {(favicon || sourceLetter) && <span className="clip-source-mark" aria-hidden="true">
      {favicon && failedFavicon !== favicon ? <img src={favicon} alt="" referrerPolicy="no-referrer" onError={() => setFailedFavicon(favicon)} />
        : sourceLetter ? <span>{sourceLetter}</span> : null}
    </span>}
    <WidgetInspectorPortal target={inspectorTarget}>
      <div className="clip-format-cluster">
        {!access.capture && <div className="clip-capture-access"><span>{t("Capture selected text from the active page using the Otium popup. Page access is required.")}</span>
          <button type="button" className="quiet-button" disabled={disabled} onClick={() => {
            void widgetCapabilityService.requestEnable('clip').then(granted => { if (!granted) setError('Access was not granted. You can try again.'); });
          }}>{t("Grant access")}</button></div>}
        <label className="clip-format-source">{t("Source URL")}<input spellCheck={false} type="url" aria-label={t("Clip source URL")} placeholder={t("Source URL")} value={config.sourceUrl} title={config.sourceUrl}
            disabled={disabled} onBlur={flush} onChange={event => edit({ sourceUrl: event.target.value })} />
          <button type="button" className="quiet-button clip-restore-text" title={t("Restore captured text")} aria-label={t("Restore captured text")}
            disabled={disabled || config.originalText === undefined} onClick={() => {
              if (latest.current.originalText !== undefined) edit({ text: latest.current.originalText });
            }}><RotateCcw size={16} aria-hidden="true" /></button>
        </label>
        <FormattingControls name="Clip / Evidence" style={appearance} disabled={disabled} error={!!(error || saveError)}
          onStyle={patch => edit({ style: normalizeTextStyle({ ...latest.current.style, ...patch }) })} />
      </div>
    </WidgetInspectorPortal>
    {(saveError || error) && <p className="form-error" role="alert">{t((saveError || error) ?? "")}</p>}
  </div>;
}



