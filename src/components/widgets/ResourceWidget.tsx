import { t, useLocale } from "../../i18n";
import { useProjectQuickActions } from '../../hooks/useProjectQuickActions';
import type { RegisterProjectQuickActions } from '../projects/ProjectContextToolbar';
import { FormattingControls } from '../projects/NoteFormattingBar';
import { normalizeTextStyle } from '../../domain/text';
import { widgetSurface, widgetContentScale, widgetLeadingIconSize } from './widgetAppearance';
import { WidgetInspectorPortal } from '../projects/WidgetInspectorPortal';
import { useState } from 'react';
import { useWidgetDraftPersistence } from '../../hooks/useWidgetDraftPersistence';
import { CalendarDays, ExternalLink } from 'lucide-react';
import { useStaticFavicon } from '../../hooks/useStaticFavicon';
import type { WidgetInstance } from '../../domain/widget';
import { isResourceConfig } from '../../domain/resource';
import type { ResourceConfig } from '../../domain/resource';
import { normalizeUrl } from '../../utils/url';
import { browserTabsService } from '../../services/browserTabs';
import { ResourceCountdown } from './ResourceCountdown';

export default function ResourceWidget({ instance, disabled, onUpdate, inspectorTarget, onQuickActions }: {
  instance: WidgetInstance;
  disabled: boolean;
  onUpdate: (id: string, config: ResourceConfig) => Promise<void>;
  inspectorTarget?: HTMLElement | null;
  onQuickActions?: RegisterProjectQuickActions;
}) {
  useLocale();
  const { config, latest, error: saveError, flush, edit } = useWidgetDraftPersistence<ResourceConfig>({
    value: isResourceConfig(instance.config) ? instance.config : { title: 'Resource', url: '', label: '' },
    save: config => onUpdate(instance.id, config), errorMessage: t("Resource could not be saved."),
  });
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [failedFavicon, setFailedFavicon] = useState<string | null>(null);
  const url = normalizeUrl(config.url);
  const hostname = url ? new URL(url).hostname : '';
  const label = config.label.trim() || hostname || 'Untitled Resource';
  const sourceLetter = hostname.replace(/^www\./i, '').charAt(0).toUpperCase();
  const favicon = useStaticFavicon(url ?? undefined);
  const appearance = normalizeTextStyle(config.style);
  const markSize = widgetLeadingIconSize(appearance);
  const open = async () => {
      if (!url || opening) return;
      setOpening(true); setError(null);
      try { await browserTabsService.openLink(url); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Resource could not be opened.'); }
      finally { setOpening(false); }
      };
  useProjectQuickActions(instance.id, onQuickActions, { snapshot: () => latest.current, open: { run: open, disabled: disabled || opening || !url, label: "Open" } });
  return <div className="note-widget resource-widget" style={widgetSurface(appearance)}>
    <div className="resource-summary">
      <header className="note-widget-header resource-label-row" style={widgetContentScale(appearance)}>
        <ExternalLink size={16} aria-hidden="true" />
      <input spellCheck={false} className="resource-label" aria-label={t("Resource label")} placeholder={label} title={label} value={config.label}
        disabled={disabled} onChange={event => edit({ label: event.target.value })} onBlur={flush} />
      </header>
      <ResourceCountdown datetime={config.datetime} />
    </div>
    <div className="resource-footer">
      <button type="button" className="quiet-button resource-open" disabled={disabled || opening || !url} onClick={open}>{t("Open")}</button>
    </div>
    {url && <span className="clip-source-mark resource-source-mark" aria-hidden="true" style={{ width: markSize, height: markSize }}>
      {favicon && failedFavicon !== favicon ? <img src={favicon} alt="" onError={() => setFailedFavicon(favicon)} /> : <span>{sourceLetter}</span>}
    </span>}
    <WidgetInspectorPortal target={inspectorTarget}>
      <div className="clip-format-cluster">
        <label className="clip-format-source">{t("Resource URL")}<input spellCheck={false} type="url" aria-label={t("Resource URL")} placeholder="https://…" value={config.url} disabled={disabled}
            onBlur={flush} onChange={event => edit({ url: event.target.value })} />
        </label>
        <FormattingControls name="Resource" style={appearance} disabled={disabled} error={!!(error || saveError)} basic
          onStyle={patch => edit({ style: normalizeTextStyle({ ...latest.current.style, ...patch }) })}
          extraControls={<label className="note-format-group resource-date-control" title={t("Date/time (optional)")}>
            <CalendarDays size={16} aria-hidden="true" />
            <input spellCheck={false} type="datetime-local" aria-label={t("Resource date and time (optional)")} value={config.datetime ?? ''}
              disabled={disabled} onBlur={flush} onChange={event => edit({ datetime: event.target.value })} />
          </label>} />
      </div>
    </WidgetInspectorPortal>
    {(saveError || error) && <p className="form-error" role="alert">{t((saveError || error) ?? "")}</p>}
  </div>;
}



