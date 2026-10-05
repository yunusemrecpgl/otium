import { useProjectQuickActions } from '../../hooks/useProjectQuickActions';
import type { RegisterProjectQuickActions } from '../projects/ProjectContextToolbar';
import { WidgetInspectorPortal } from '../projects/WidgetInspectorPortal';
import { InspectorSegments } from '../projects/InspectorControls';
import { useEffect, useRef, useState } from 'react';
import { useWidgetDraftPersistence } from '../../hooks/useWidgetDraftPersistence';
import { Eye, X, PlugZap } from 'lucide-react';
import type { WidgetInstance } from '../../domain/widget';
import type { PageWatchConfig, PageWatchField } from '../../domain/pageWatch';
import { isPageWatchConfig, migratePageWatchConfig, normalizeWatchedText, pageWatchFields, pageWatchSourceKey, pageWatchSourceMode, resetPageWatchBaseline, resetPageWatchField } from '../../domain/pageWatch';
import { readRenderedPageWatchFields } from '../../services/renderedPageWatch';
import { fetchPageWatchDirectFields, fetchPageWatchFields } from '../../services/pageWatch';
import { previewJsonValue } from '../../services/webData';
import { hasOriginAccess, OriginAccessRequiredError, subscribeOriginAccessRemoved } from '../../services/externalSources';
import { browserTabsService } from '../../services/browserTabs';
import { normalizeUrl } from '../../utils/url';
import PageWatchDiscovery from './PageWatchDiscovery';
import { PageWatchSourcePanel } from './PageWatchSourcePanel';
import ExternalSourceError from './ExternalSourceError';
import { FormattingControls } from '../projects/NoteFormattingBar';
import { ResponseExplorer } from './ResponseExplorer';
import { WebDataFieldLabel } from './WebDataFieldLabel';
import { useStaticFavicon } from '../../hooks/useStaticFavicon';
import { normalizeTextStyle } from '../../domain/text';
import { widgetSurface, widgetContentScale, widgetTypography, widgetTextColor } from './widgetAppearance';
import { fontSizePixels } from '../../domain/typography';

const DEFAULT_CONFIG: PageWatchConfig = { title: 'Page Watch', url: '', selector: '', refreshMinutes: 30, mode: 'static' };

export default function PageWatchWidget({ instance, disabled, onUpdate, inspectorTarget, onQuickActions }: {
  instance: WidgetInstance; disabled: boolean; onUpdate: (id: string, config: PageWatchConfig) => Promise<void>;
  inspectorTarget?: HTMLElement | null;
  onQuickActions?: RegisterProjectQuickActions;
}) {
  const committed = migratePageWatchConfig(isPageWatchConfig(instance.config) ? instance.config : DEFAULT_CONFIG);
  const { config, latest, error: saveError, flush, replace } = useWidgetDraftPersistence<PageWatchConfig>({
    value: committed, save: config => onUpdate(instance.id, config), errorMessage: 'Page Watch could not be saved.',
  });
  const [sourcePanelOpen, setSourcePanelOpen] = useState(false);
  const sourceConfigButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!inspectorTarget) setSourcePanelOpen(false); }, [inspectorTarget]);
  const [, setChanged] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [directResponse, setDirectResponse] = useState<{ url: string; data: unknown } | null>(null);
  const [failedFavicon, setFailedFavicon] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  function edit(patch: Partial<PageWatchConfig>) {
    const old = latest.current;
    let next = { ...old, ...patch };
    if (next.url !== old.url || next.directUrl !== old.directUrl || pageWatchSourceMode(next) !== pageWatchSourceMode(old)) {
      next = resetPageWatchBaseline(next);
      setChanged(new Set()); setFieldErrors({}); setFetchError(null);
    } else if (patch.fields) {
      const previous = new Map(pageWatchFields(old).map(field => [field.id, field]));
      next.fields = patch.fields.map(field => previous.get(field.id)?.selectorOrPath !== field.selectorOrPath ? resetPageWatchField(field) : field);
    }
    replace(next);
  }
  function setMode(mode: 'static' | 'rendered' | 'direct', directUrl?: string, directPath?: string) {
    const old = latest.current, oldMode = pageWatchSourceMode(old);
    const fields = pageWatchFields(old).map((field, index) => {
      const next = { ...field, ...(oldMode === 'direct' ? { directPath: field.selectorOrPath } : { selector: field.selectorOrPath }) };
      return { ...next, selectorOrPath: mode === 'direct' ? (index === 0 && directPath !== undefined ? directPath : next.directPath ?? '') : next.selector ?? '' };
    });
    edit({ sourceMode: mode, ...(mode !== 'direct' ? { mode } : {}), fields,
      ...(directUrl !== undefined ? { directUrl } : {}) }); flush();
  }
  function editField(id: string, patch: Partial<PageWatchField>) {
    edit({ fields: pageWatchFields(latest.current).map(field => field.id === id ? { ...field, ...patch } : field) });
  }
  function renameField(id: string, label: string) {
    editField(id, { label });
    void flush();
  }
  function addField(path = '', directUrl?: string) {
    if (pageWatchFields(latest.current).length >= 20) return;
    if (directUrl) setMode('direct', directUrl);
    const fields = pageWatchFields(latest.current);
    edit({ fields: [...fields, { id: crypto.randomUUID(), label: `Field ${fields.length + 1}`, selectorOrPath: path,
      ...(pageWatchSourceMode(latest.current) === 'direct' ? { directPath: path } : { selector: path }) }] });
    if (directUrl) flush();
  }

  const mode = pageWatchSourceMode(committed), uiMode = pageWatchSourceMode(config);
  const sourceUrl = normalizeUrl(committed.url);
  const endpoint = mode === 'direct' ? normalizeUrl(committed.directUrl ?? '') : sourceUrl;
  const sourceKey = pageWatchSourceKey(committed);
  const interval = Math.min(2_147_483_647, Math.max(5, committed.refreshMinutes) * 60_000);
  const cache = useRef<{ key: string; attemptedAt: number } | null>(null);
  const refresh = useRef<(force?: boolean) => void>(() => {});
  useEffect(() => {
    let active = true, accessRetry = false;
    let controller: AbortController | null = null;
    if (cache.current?.key !== sourceKey) { setChanged(new Set()); setFieldErrors({}); setFetchError(null); cache.current = null; }
    setLoading(false);
    if (!endpoint) {
      setFetchError((mode === 'direct' ? committed.directUrl : committed.url)?.trim() ? new Error('Enter a public HTTP/HTTPS source URL.') : null);
      refresh.current = () => {}; return;
    }
    const fields = pageWatchFields(committed);
    const paths = fields.map(field => field.selectorOrPath);
    const run = async (force = false) => {
      if (!active || controller || (!force && document.visibilityState === 'hidden')) return;
      if (!force && cache.current?.key === sourceKey && Date.now() - cache.current.attemptedAt < interval) return;
      cache.current = { key: sourceKey, attemptedAt: Date.now() };
      controller = new AbortController(); const request = controller;
      const timeout = setTimeout(() => request.abort(), 20_000);
      setLoading(true); setFetchError(null);
      try {
        if (mode === 'direct' && sourceUrl && new URL(endpoint).origin !== new URL(sourceUrl).origin && !await hasOriginAccess(endpoint)) throw new OriginAccessRequiredError(endpoint);
        const results = await (mode === 'direct' ? fetchPageWatchDirectFields(endpoint, paths, request.signal, data => {
            if (active && !request.signal.aborted && pageWatchSourceKey(latest.current) === sourceKey) setDirectResponse({ url: endpoint, data });
          })
          : mode === 'rendered' ? readRenderedPageWatchFields(endpoint, paths, request.signal) : fetchPageWatchFields(endpoint, paths, request.signal));
        if (!active || request.signal.aborted || pageWatchSourceKey(latest.current) !== sourceKey) return;
        const now = Date.now(), changedIds = new Set<string>(), errors: Record<string, string> = {};
        let successful = false;
        const values = new Map(fields.map((field, index) => [field.id, results[index]]));
        const nextFields = pageWatchFields(latest.current).map(field => {
          const result = values.get(field.id);
          if (result?.value === undefined) { errors[field.id] = result?.error ?? 'Value unavailable.'; return field; }
          successful = true;
          const value = normalizeWatchedText(result.value), old = field.currentValue;
          const different = old !== undefined && normalizeWatchedText(old) !== value;
          if (different) changedIds.add(field.id);
          return { ...field, currentValue: value, ...(different ? { previousValue: old, lastChangedAt: now } : {}) };
        });
        setFieldErrors(errors); setChanged(changedIds);
        if (successful) { edit({ fields: nextFields, lastCheckedAt: now }); flush(); }
      } catch (cause) {
        if (active && pageWatchSourceKey(latest.current) === sourceKey) setFetchError(cause instanceof Error ? cause : new Error('Page could not be loaded.'));
      } finally {
        clearTimeout(timeout); controller = null;
        if (active) setLoading(false);
        if (active && accessRetry) { accessRetry = false; void run(true); }
      }
    };
    refresh.current = force => { void run(force); };
    const unsubscribeAccess = subscribeOriginAccessRemoved(endpoint, () => {
      cache.current = null;
      if (controller) { accessRetry = true; controller.abort(); } else void run(true);
    });
    void run();
    const poll = setInterval(() => { void run(); }, interval);
    const visible = () => { if (document.visibilityState === 'visible') void run(); };
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false; clearInterval(poll); unsubscribeAccess();
      if (controller) { cache.current = null; controller.abort(); }
      document.removeEventListener('visibilitychange', visible); refresh.current = () => {};
    };
  }, [endpoint, interval, sourceKey, sourceUrl]);

  async function open() {
    if (!sourceUrl) return;
    try { await browserTabsService.openLink(sourceUrl); } catch { setFetchError(new Error('Page could not be opened.')); }
  }
  useProjectQuickActions(instance.id, onQuickActions, { snapshot: () => latest.current,
    refresh: { run: () => refresh.current(true), disabled: disabled || loading || !endpoint },
    open: { run: open, disabled: disabled || !sourceUrl, label: 'Open' } });
  const fields = pageWatchFields(config);
  const hero = fields.length === 1 ? fields[0] : undefined;
  const appearance = normalizeTextStyle(config.style);
  const labelStyle = { ...widgetContentScale(appearance), fontWeight: 500, textAlign: 'left' as const };
  const valueStyle = { ...widgetContentScale(appearance), ...widgetTypography(appearance) };
  const identityUrl = normalizeUrl(config.url) ?? normalizeUrl(config.directUrl ?? '');
  const hostname = identityUrl ? new URL(identityUrl).hostname : '';
  const favicon = useStaticFavicon(identityUrl ?? undefined);
  function removeField(id: string) {
    const current = pageWatchFields(latest.current);
    if (current.length > 1) edit({ fields: current.filter(field => field.id !== id) });
  }
  function toggleDirectPath(path: string) {
    const current = pageWatchFields(latest.current);
    const selected = current.find(field => field.selectorOrPath === path);
    if (selected) { removeField(selected.id); return; }
    if (current.length >= 20) return;
    const field = { id: crypto.randomUUID(), label: path || 'Value', selectorOrPath: path, directPath: path };
    edit({ fields: current.length === 1 && !current[0].selectorOrPath && current[0].currentValue === undefined
      ? [{ ...field, id: current[0].id }] : [...current, field] });
  }
  const compactError = fetchError ? (/open.*tab|matching.*tab/i.test(fetchError.message) ? 'Open the source page in a browser tab.'
    : fetchError instanceof OriginAccessRequiredError ? 'Source access required.' : 'Check unavailable.')
    : Object.keys(fieldErrors).length ? 'Some values unavailable.' : null;
  return <div className="note-widget web-data-widget page-watch-widget" style={widgetSurface(appearance)}>
    <header className="note-widget-header"><Eye size={16} style={{ width: 16, height: 16 }} aria-hidden="true" />
      {hero ? <WebDataFieldLabel key={hero.id} label={hero.label || config.title || 'Page Watch'} disabled={disabled}
        style={labelStyle} onCommit={label => renameField(hero.id, label)} /> :
        <input spellCheck={false} aria-label="Page Watch title" title={config.title} value={config.title} disabled={disabled} onBlur={flush}
          style={widgetTextColor(appearance)} onChange={event => edit({ title: event.target.value })} />}
    </header>
    <div className="web-data-output page-watch-monitor" aria-live="polite">
      {hero ? <>
        <div className="web-data-value" title={hero.currentValue} style={{ ...valueStyle, fontSize: Math.round(fontSizePixels(appearance.fontSize, 16)! * 1.3) }}>{uiMode === 'direct' ? previewJsonValue(hero.currentValue ?? '—') : hero.currentValue ?? '—'}</div>
        <WatchChange field={hero} />
      </> : <div className="web-data-field-rows">
        {fields.map(field => <div className="web-data-field-row page-watch-monitor-row" key={field.id}>
          <WebDataFieldLabel label={field.label} disabled={disabled} style={labelStyle} onCommit={label => renameField(field.id, label)} />
          <span className="web-data-field-value" title={field.currentValue} style={{ ...valueStyle, textAlign: appearance.textAlign ?? 'right' }}>{uiMode === 'direct' ? previewJsonValue(field.currentValue ?? '—') : field.currentValue ?? '—'}</span>
          <WatchChange field={field} compact />
        </div>)}
      </div>}
      {loading && <span className="muted page-watch-monitor-status">Checking…</span>}
      {compactError && <span className="muted page-watch-monitor-status" title={fetchError?.message ?? Object.values(fieldErrors).join('; ')}>{compactError}</span>}
    </div>
    <div className="resource-footer web-data-footer page-watch-footer">
      <button type="button" className="quiet-button" disabled={disabled || loading || !endpoint} onClick={() => refresh.current(true)}>Refresh</button>
      <div className="web-data-metadata">
        <span>Every {config.refreshMinutes} min</span>
        <span>{config.lastCheckedAt !== undefined ? 'Checked ' + new Date(config.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not checked yet'}</span>
      </div>
      {hostname && <span className="web-data-source-mark" aria-hidden="true">
        {favicon && failedFavicon !== favicon ? <img src={favicon} alt="" onError={() => setFailedFavicon(favicon)} /> : hostname.replace(/^www\./i, '').charAt(0).toUpperCase()}
      </span>}
    </div>
    <WidgetInspectorPortal target={inspectorTarget}>
      <div className="clip-format-cluster page-watch-format-cluster">
        <div className="clip-format-source web-data-source-row">
          <label className="web-data-refresh-control" title="Refresh interval in minutes">Every
            <input spellCheck={false} type="number" min={5} step={1} aria-label="Refresh interval in minutes" value={config.refreshMinutes} disabled={disabled}
              onBlur={flush} onChange={event => edit({ refreshMinutes: Number.isFinite(event.target.valueAsNumber) ? Math.max(5, Math.round(event.target.valueAsNumber)) : 5 })} /> min
          </label>
          <span className="page-watch-source-caption">Source URL</span>
          <input spellCheck={false} type="url" aria-label="Source URL" value={config.url} disabled={disabled} onBlur={flush} onChange={event => edit({ url: event.target.value })} />
          <button ref={sourceConfigButton} type="button" className="quiet-button web-data-connect" title="Configure source" aria-label="Configure source" aria-expanded={sourcePanelOpen}
            disabled={disabled} onClick={() => setSourcePanelOpen(true)}><PlugZap size={16} aria-hidden="true" /></button>
        </div>
        <FormattingControls name="Page Watch" style={appearance} disabled={disabled} error={!!saveError}
          onStyle={patch => edit({ style: normalizeTextStyle({ ...latest.current.style, ...patch }) })} />
      </div>
    </WidgetInspectorPortal>
    <PageWatchSourcePanel getAnchor={() => sourceConfigButton.current?.closest('.compact-floating-inspector')?.getBoundingClientRect()} open={sourcePanelOpen && !!inspectorTarget} onClose={() => { void flush(); setSourcePanelOpen(false); sourceConfigButton.current?.focus(); }}>
        <div className="page-watch-format-source-controls">
          <InspectorSegments label="Source mode" value={uiMode} disabled={disabled} options={[{ value: 'static', label: 'Static' }, { value: 'rendered', label: 'Rendered' }, { value: 'direct', label: 'Direct' }]} onChange={mode => setMode(mode)} />
        </div>
        <div className="page-watch-source-row">
          <PageWatchDiscovery compact url={config.url} selector={fields.map(field => field.selector ?? field.selectorOrPath).join(' ')}
            currentValue={fields.find(field => field.currentValue !== undefined)?.currentValue} disabled={disabled}
            onUse={(url, path) => setMode('direct', url, path)} onAddPath={(url, path) => addField(path, url)} />
        </div>
        {uiMode === 'direct' && <label className="clip-format-source">Direct URL
          <input spellCheck={false} type="url" aria-label="Direct URL" value={config.directUrl ?? ''} disabled={disabled} onBlur={flush} onChange={event => edit({ directUrl: event.target.value })} />
        </label>}
        {uiMode === 'rendered' && <span className="muted page-watch-hint">Reads from an open rendered browser tab.</span>}
        <div className="page-watch-inspector-fields">
          <span className="muted">Watched Fields · {uiMode === 'direct' ? 'JSON paths' : 'CSS selectors'}</span>
          <div className="page-watch-inspector-field-list">
            {fields.map((field, index) => <div className="page-watch-inspector-field" key={field.id}>
              <span className="page-watch-inspector-label" title={field.label}>{field.label || 'Field ' + (index + 1)}</span>
              <input spellCheck={false} aria-label={'Field ' + (index + 1) + (uiMode === 'direct' ? ' JSON path' : ' CSS selector')}
                value={field.selectorOrPath} disabled={disabled} placeholder={uiMode === 'direct' ? 'prices.0.price' : '.price'} onBlur={flush}
                onChange={event => editField(field.id, { selectorOrPath: event.target.value, ...(uiMode === 'direct' ? { directPath: event.target.value } : { selector: event.target.value }) })} />
              <span className="muted page-watch-inspector-current" title={field.currentValue}>{uiMode === 'direct' ? previewJsonValue(field.currentValue ?? '—') : field.currentValue ?? '—'}</span>
              <button type="button" className="quiet-button" title="Remove field" aria-label={'Remove field ' + (index + 1)} disabled={disabled || fields.length <= 1} onClick={() => removeField(field.id)}><X size={12} aria-hidden="true" /></button>
              {fieldErrors[field.id] && <span className="muted page-watch-inspector-field-error">{fieldErrors[field.id]}</span>}
            </div>)}
          </div>
          <button type="button" className="text-button" disabled={disabled || fields.length >= 20} onClick={() => addField()}>+ Field</button>
        </div>
        {uiMode === 'direct' && directResponse?.url === normalizeUrl(config.directUrl ?? '') && <ResponseExplorer response={directResponse.data}
          selectedPaths={fields.map(field => field.selectorOrPath)} maxFields={20} disabled={disabled} onToggle={toggleDirectPath} />}
        {fetchError && <ExternalSourceError error={fetchError} disabled={disabled || loading} onRetry={() => refresh.current(true)} />}
        <span className="muted page-watch-source-status">{loading ? 'Checking…' : config.lastCheckedAt !== undefined ? 'Last checked: ' + new Date(config.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not checked yet'}</span>
    </PageWatchSourcePanel>
    {saveError && <span className="muted page-watch-monitor-status" title={saveError}>Changes could not be saved.</span>}
  </div>;
}

function numericValue(text: string | undefined): number | null {
  if (text === undefined) return null;
  const value = text.trim();
  const normalized = /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(value) ? value.replace(/,/g, '') : value;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER ? number : null;
}
function WatchChange({ field, compact = false }: { field: PageWatchField; compact?: boolean }) {
  if (field.lastChangedAt === undefined) return compact ? <span className="page-watch-change-indicator muted">—</span> : null;
  const current = numericValue(field.currentValue), previous = numericValue(field.previousValue);
  const delta = current !== null && previous !== null ? current - previous : null;
  const indicator = delta === null ? 'Changed' : delta > 0 ? '↑' : delta < 0 ? '↓' : '—';
  const minutes = Math.max(0, Math.floor((Date.now() - field.lastChangedAt) / 60000));
  const time = minutes < 1 ? 'just now' : minutes < 60 ? minutes + ' min ago' : minutes < 1440 ? Math.floor(minutes / 60) + ' h ago' : Math.floor(minutes / 1440) + ' days ago';
  const title = 'Previous: ' + (field.previousValue ?? '—') + ' · Changed ' + time;
  return <span className="page-watch-change-indicator muted" title={title}>
    {indicator}{!compact && delta !== null && delta !== 0 ? ' ' + new Intl.NumberFormat('en', { maximumFractionDigits: 6 }).format(Math.abs(delta)) : ''}
    {!compact && <span className="page-watch-change-time">Changed {time}</span>}
  </span>;
}
