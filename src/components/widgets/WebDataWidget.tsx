import ExternalSourceError from './ExternalSourceError';
import { OriginAccessRequiredError, requestOriginAccess, subscribeOriginAccessRemoved } from '../../services/externalSources';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, PlugZap } from 'lucide-react';
import type { WidgetInstance } from '../../domain/widget';
import { readWebDataConfig } from '../../domain/webData';
import type { WebDataConfig, WebDataStatus, WebDataField } from '../../domain/webData';
import { fetchPublicJsonResponse, previewJsonValue, resolveJsonDotPath, publicJsonEndpoint } from '../../services/webData';

import { FormattingControls } from '../projects/NoteFormattingBar';
import { WidgetInspectorPortal } from '../projects/WidgetInspectorPortal';
import { WebDataFieldLabel } from './WebDataFieldLabel';
import { ResponseExplorer } from './ResponseExplorer';
import { useStaticFavicon } from '../../hooks/useStaticFavicon';
import { normalizeTextStyle } from '../../domain/text';
import { fontSizePixels } from '../../domain/typography';
import { useInspectorWidgetEditor } from '../../hooks/useInspectorWidgetEditor';
import { widgetSurface, widgetTypography, widgetContentScale } from './widgetAppearance';

const sameConfig = (a: WebDataConfig, b: WebDataConfig) => JSON.stringify(a) === JSON.stringify(b);

export default function WebDataWidget({ instance, disabled, onUpdate, onPreview, storedConfig, onStatus, inspectorTarget }: {
  instance: WidgetInstance;
  disabled: boolean;
  onUpdate: (id: string, config: WebDataConfig) => Promise<void>;
  onPreview: (id: string, config: WebDataConfig) => void;
  storedConfig: WidgetInstance['config'];
  onStatus: (id: string, status: WebDataStatus | null) => void;
  inspectorTarget?: HTMLElement | null;
}) {
  const committed = readWebDataConfig(storedConfig);
  const { config, latest, error: saveError, flush, edit } = useInspectorWidgetEditor(instance, readWebDataConfig, onUpdate, onPreview, sameConfig);
  const [result, setResult] = useState<{ values: Map<string, { value?: string; error?: string }>; updatedAt: number } | null>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ url: string; data: unknown } | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const sourceRow = useRef<HTMLDivElement | null>(null);
  const connectRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [connectedUrl, setConnectedUrl] = useState(committed.url);
  const endpoint = publicJsonEndpoint(connectedUrl);

  const interval = Math.min(2_147_483_647, Math.max(1, committed.refreshMinutes) * 60_000);
  const cache = useRef<{ key: string; attemptedAt: number } | null>(null);
  const refresh = useRef<(force?: boolean) => void>(() => {});
  const manualRefresh = useCallback(() => refresh.current(true), []);
  useEffect(() => {
    let active = true;
    let accessRetry = false;
    let controller: AbortController | null = null;
    const key = JSON.stringify([endpoint]);
    if (cache.current?.key !== key) { setFetchError(null); cache.current = null; }
    if (!connectRequest.current) setLoading(false);
    if (!endpoint) {
      setFetchError(connectedUrl.trim() ? new Error('Enter a public HTTPS JSON endpoint.') : null);
      refresh.current = () => {};
      return;
    }
    const run = async (force = false) => {
      if (!active || controller || connectRequest.current || (!force && document.visibilityState === 'hidden')) return;
      if (!force && cache.current?.key === key && Date.now() - cache.current.attemptedAt < interval) return;
      cache.current = { key, attemptedAt: Date.now() };
      controller = new AbortController();
      const request = controller;
      const timeout = setTimeout(() => request.abort(), 20_000);
      setLoading(true); setFetchError(null);
      try {
        const data = await fetchPublicJsonResponse(endpoint, request.signal);
        if (active && !connectRequest.current) {
          setResponse({ url: endpoint, data });
          applyResponse(data, latest.current.fields ?? []);
        }
      } catch (cause) {
        if (active && !connectRequest.current) setFetchError(cause instanceof Error ? cause : new Error('JSON could not be loaded.'));
      } finally {
        clearTimeout(timeout); controller = null;
        if (active && !connectRequest.current) setLoading(false);
        if (active && accessRetry) { accessRetry = false; void run(true); }
      }
    };
    refresh.current = force => { void run(force); };
    const unsubscribeAccess = subscribeOriginAccessRemoved(endpoint, () => {
      cache.current = null;
      if (controller) { accessRetry = true; controller.abort(); }
      else void run(true);
    });
    void run();
    const poll = setInterval(() => { void run(); }, interval);
    const visible = () => { if (document.visibilityState === 'visible') void run(); };
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false; clearInterval(poll); unsubscribeAccess();
      if (controller) { cache.current = null; controller.abort(); }
      document.removeEventListener('visibilitychange', visible);
      refresh.current = () => {};
    };
  }, [endpoint, interval, connectedUrl]);

  const reportedValue = result?.values.get(config.fields?.[0]?.path ?? config.jsonPath)?.value;
  useEffect(() => {
    onStatus(instance.id, { loading, error: fetchError, value: reportedValue, updatedAt: result?.updatedAt, available: !!endpoint,
      refresh: manualRefresh });
  }, [onStatus, instance.id, loading, fetchError, result?.updatedAt, endpoint, reportedValue, manualRefresh]);
  useEffect(() => () => onStatus(instance.id, null), [onStatus, instance.id]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; connectRequest.current?.abort(); }; }, []);
  useEffect(() => {
    if (!explorerOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !sourceRow.current?.contains(event.target)) setExplorerOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setExplorerOpen(false); event.stopPropagation(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true); };
  }, [explorerOpen]);
  useEffect(() => { if (!inspectorTarget) setExplorerOpen(false); }, [inspectorTarget]);
  function connect(requestPermission = true) {
    const url = publicJsonEndpoint(latest.current.url);
    if (!url) { setFetchError(new Error('Enter a public HTTPS JSON endpoint.')); return; }
    // Permission requests are invoked synchronously from this explicit action.
    const permission = requestPermission && fetchError instanceof OriginAccessRequiredError && fetchError.url === url
      ? requestOriginAccess(url) : Promise.resolve(true);
    if (connectRequest.current) return;
    const controller = new AbortController(); connectRequest.current = controller;
    cache.current = { key: JSON.stringify([url]), attemptedAt: Date.now() };
    flush(); setLoading(true); setFetchError(null); setExplorerOpen(true);
    const timeout = setTimeout(() => controller.abort(), 20_000);
    void permission.then(async granted => {
      if (!granted) throw new OriginAccessRequiredError(url);
      const data = await fetchPublicJsonResponse(url, controller.signal);
      if (controller.signal.aborted || publicJsonEndpoint(latest.current.url) !== url) return;
      setResponse({ url, data });
      setConnectedUrl(url);
      applyResponse(data, latest.current.fields ?? []);
    }).catch(cause => {
      if (mounted.current && publicJsonEndpoint(latest.current.url) === url) setFetchError(cause instanceof Error ? cause : new Error('JSON could not be loaded.'));
    }).finally(() => {
      clearTimeout(timeout);
      if (connectRequest.current === controller) { connectRequest.current = null; if (mounted.current) setLoading(false); }
    });
  }
  function applyResponse(data: unknown, fields: WebDataField[], checkedAt?: number) {
    setResult(previous => {
      const values = new Map<string, { value?: string; error?: string }>();
      for (const field of fields) {
        try { values.set(field.path, { value: previewJsonValue(resolveJsonDotPath(data, field.path)) }); }
        catch { values.set(field.path, { value: previous?.values.get(field.path)?.value, error: 'Value not found' }); }
      }
      return { values, updatedAt: checkedAt ?? Date.now() };
    });
  }
  function togglePath(path: string) {
    if (!response || response.url !== publicJsonEndpoint(latest.current.url)) return;
    const current = latest.current.fields ?? [];
    const selected = current.some(field => field.path === path);
    if (!selected && current.length >= 8) return;
    const fields = selected ? current.filter(field => field.path !== path)
      : [...current, { id: crypto.randomUUID(), path, label: path || 'Value' }];
    edit({ fields });
    applyResponse(response.data, fields, result?.updatedAt);
  }
  function renameField(id: string, label: string) {
    edit({ fields: (latest.current.fields ?? []).map(field => field.id === id ? { ...field, label } : field) });
    void flush();
  }
  const fields = config.fields ?? [];
  const hero = fields.length === 1 ? fields[0] : undefined;
  const sourceUrl = publicJsonEndpoint(config.url);
  const hostname = sourceUrl ? new URL(sourceUrl).hostname : '';
  const favicon = useStaticFavicon(sourceUrl ?? undefined);
  const [failedIcon, setFailedIcon] = useState<string | null>(null);
  const appearance = normalizeTextStyle(config.style);
  const headerTypography = { ...widgetContentScale(appearance), textAlign: 'left' as const, fontWeight: 500, fontStyle: 'normal', textDecoration: 'none' };
  const typography = { ...widgetContentScale(appearance), ...widgetTypography(appearance) };
  return <div className="note-widget web-data-widget" style={widgetSurface(appearance)}>
    <header className="note-widget-header" style={headerTypography}>
      <Activity size={16} aria-hidden="true" />
      {hero ? <WebDataFieldLabel key={hero.id} label={hero.label} disabled={disabled}
        style={{ ...typography, textAlign: 'left' }} onCommit={label => renameField(hero.id, label)} /> :
        <input spellCheck={false} aria-label="Web Data label" title={config.title} value={config.title} placeholder="Web Data"
          style={headerTypography} disabled={disabled} onBlur={flush}
          onChange={event => edit({ title: event.target.value })} />}
    </header>
    <div className="web-data-output" aria-live="polite">
      {hero && <div className="web-data-value" title={result?.values.get(hero.path)?.value}
        style={{ ...typography, fontSize: Math.round(fontSizePixels(appearance.fontSize, 16)! * 1.3), fontWeight: appearance.bold ? 700 : 600 }}>
        {result?.values.get(hero.path)?.value ?? '—'}
        {result?.values.get(hero.path)?.error && <span className="web-data-field-error">{result.values.get(hero.path)?.error}</span>}
      </div>}
      {fields.length > 1 && <div className="web-data-field-rows">
        {fields.map(field => <div className="web-data-field-row" key={field.id}>
          <WebDataFieldLabel label={field.label} disabled={disabled} style={{ ...typography, textAlign: 'left' }}
            onCommit={label => renameField(field.id, label)} />
          <div className="web-data-field-value" style={{ ...typography, textAlign: 'right' }} title={result?.values.get(field.path)?.value}>
            <span>{result?.values.get(field.path)?.value ?? '—'}</span>
            {result?.values.get(field.path)?.error && <span className="web-data-field-error">{result.values.get(field.path)?.error}</span>}
          </div>
        </div>)}
      </div>}
      {loading && <span className="muted">Loading…</span>}
      {fetchError && <ExternalSourceError key={endpoint} error={fetchError} disabled={disabled || loading} onRetry={() => connect(false)} />}
    </div>
    <div className="resource-footer web-data-footer">
      <button type="button" className="quiet-button" disabled={disabled || loading || !endpoint} onClick={() => refresh.current(true)}>Refresh</button>
      <div className="web-data-metadata">
        <span>Every {config.refreshMinutes} min</span>
        <span>{result ? 'Updated ' + new Date(result.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not updated yet'}</span>
      </div>
      {hostname && <span className="web-data-source-mark" aria-hidden="true">
        {favicon && failedIcon !== favicon ? <img src={favicon} alt="" onError={() => setFailedIcon(favicon)} /> : hostname.replace(/^www\./i, '').charAt(0).toUpperCase()}
      </span>}
    </div>
    <WidgetInspectorPortal target={inspectorTarget}>
      <div className="clip-format-cluster">
        <div ref={sourceRow} className="web-data-source-cluster">
          {explorerOpen && <div className="web-data-explorer-panel">
            {response?.url === sourceUrl && <ResponseExplorer response={response.data} selectedPaths={fields.map(field => field.path)} onToggle={togglePath} disabled={disabled} />}
            {loading && <span className="muted">Loading…</span>}
            {fetchError && <ExternalSourceError error={fetchError} disabled={disabled || loading} onRetry={() => connect(false)} />}
          </div>}
          <div className="clip-format-source web-data-source-row">
            <label className="web-data-refresh-control" title="Refresh interval in minutes">Every
              <input spellCheck={false} type="number" min={1} step={1} aria-label="Refresh interval in minutes" value={config.refreshMinutes} disabled={disabled}
                onBlur={flush} onChange={event => edit({ refreshMinutes: Number.isFinite(event.target.valueAsNumber) ? Math.max(1, Math.round(event.target.valueAsNumber)) : 1 })} /> min
            </label>
            <input spellCheck={false} type="url" aria-label="Source URL" placeholder="https://api.example.com/data" value={config.url}
              disabled={disabled} onBlur={flush} onChange={event => { setExplorerOpen(false); edit({ url: event.target.value }); }} />
            <button type="button" className="quiet-button web-data-connect" title="Connect" aria-label="Connect" disabled={disabled || loading} onClick={() => connect()}>
              <PlugZap size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <FormattingControls name="Web Data" style={appearance} disabled={disabled} error={saveError}
          onStyle={patch => edit({ style: normalizeTextStyle({ ...latest.current.style, ...patch }) })} />
      </div>
    </WidgetInspectorPortal>
    {saveError && <p className="form-error" role="alert">Web Data could not be saved.</p>}
  </div>;
}
