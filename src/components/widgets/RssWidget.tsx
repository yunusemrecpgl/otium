import { useProjectQuickActions } from '../../hooks/useProjectQuickActions';
import type { RegisterProjectQuickActions } from '../projects/ProjectContextToolbar';
import { FormattingControls } from '../projects/NoteFormattingBar';
import { normalizeTextStyle } from '../../domain/text';
import { widgetSurface, widgetTextColor, widgetContentScale } from './widgetAppearance';
import { WidgetInspectorPortal } from '../projects/WidgetInspectorPortal';
import ExternalSourceError from './ExternalSourceError';
import { subscribeOriginAccessRemoved } from '../../services/externalSources';
import { useEffect, useRef, useState } from 'react';
import { useWidgetDraftPersistence } from '../../hooks/useWidgetDraftPersistence';
import { Rss } from 'lucide-react';
import type { WidgetInstance } from '../../domain/widget';
import { isRssConfig } from '../../domain/rss';
import type { RssConfig } from '../../domain/rss';
import { fetchPublicFeed } from '../../services/rss';
import type { FeedArticle } from '../../services/rss';
import { normalizeUrl } from '../../utils/url';
import { browserTabsService } from '../../services/browserTabs';

const DEFAULT_CONFIG: RssConfig = { title: 'RSS Feed', feedUrl: '', refreshMinutes: 30, itemLimit: 5 };

export default function RssWidget({ instance, disabled, onUpdate, inspectorTarget, onQuickActions }: {
  instance: WidgetInstance;
  disabled: boolean;
  onUpdate: (id: string, config: RssConfig) => Promise<void>;
  inspectorTarget?: HTMLElement | null;
  onQuickActions?: RegisterProjectQuickActions;
}) {
  const committed = isRssConfig(instance.config) ? instance.config : DEFAULT_CONFIG;
  const { config, latest, error: saveError, flush, edit } = useWidgetDraftPersistence<RssConfig>({
    value: committed, save: config => onUpdate(instance.id, config), errorMessage: 'RSS Feed could not be saved.',
  });
  const [result, setResult] = useState<{ articles: FeedArticle[]; updatedAt: number } | null>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const endpoint = normalizeUrl(committed.feedUrl);

  const interval = Math.min(2_147_483_647, Math.max(5, committed.refreshMinutes) * 60_000);
  const cache = useRef<{ key: string; attemptedAt: number } | null>(null);
  const refresh = useRef<(force?: boolean) => void>(() => {});
  useEffect(() => {
    let active = true;
    let accessRetry = false;
    let controller: AbortController | null = null;
    const key = JSON.stringify([endpoint]);
    if (cache.current?.key !== key) { setResult(null); setFetchError(null); cache.current = null; }
    setLoading(false);
    if (!endpoint) {
      setResult(null);
      setFetchError(committed.feedUrl.trim() ? new Error('Enter a public HTTP/HTTPS RSS or Atom URL.') : null);
      refresh.current = () => {};
      return;
    }
    const run = async (force = false) => {
      if (!active || controller || (!force && document.visibilityState === 'hidden')) return;
      if (!force && cache.current?.key === key && Date.now() - cache.current.attemptedAt < interval) return;
      cache.current = { key, attemptedAt: Date.now() };
      controller = new AbortController();
      const request = controller;
      const timeout = setTimeout(() => request.abort(), 20_000);
      setLoading(true); setFetchError(null);
      try {
        const articles = await fetchPublicFeed(endpoint, request.signal);
        if (active) setResult({ articles, updatedAt: Date.now() });
      } catch (cause) {
        if (active) setFetchError(cause instanceof Error ? cause : new Error('Feed could not be loaded.'));
      } finally {
        clearTimeout(timeout); controller = null;
        if (active) setLoading(false);
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
  }, [endpoint, interval, committed.feedUrl]);

  const appearance = normalizeTextStyle(config.style);
  useProjectQuickActions(instance.id, onQuickActions, { snapshot: () => latest.current, refresh: { run: () => refresh.current(true), disabled: disabled || loading || !endpoint } });
  return <div className="note-widget rss-widget" style={widgetSurface(appearance)}>
    <header className="note-widget-header">
      <Rss size={16} aria-hidden="true" />
      <input spellCheck={false} aria-label="RSS Feed title" title={config.title} value={config.title} style={widgetTextColor(appearance)} disabled={disabled} onBlur={flush}
        onChange={event => edit({ title: event.target.value })} />
    </header>
    <div className="rss-articles" style={{ fontFamily: widgetContentScale(appearance).fontFamily }} aria-live="polite">
      {loading && <p className="muted">Loading…</p>}
      {fetchError && <ExternalSourceError key={endpoint} error={fetchError} disabled={disabled || loading} onRetry={() => refresh.current(true)} />}
      {!loading && !fetchError && !result && <p className="muted">Configure a public RSS or Atom feed.</p>}
      {!loading && !fetchError && result && !result.articles.length && <p className="muted">No articles in this feed.</p>}
      {result?.articles.slice(0, config.itemLimit).map((article, index) => <button key={`${article.url ?? ''}-${index}`} type="button"
        className="rss-article" disabled={disabled || !article.url} title={article.title} onClick={async () => {
          if (!article.url) return;
          try { await browserTabsService.openLink(article.url); }
          catch (cause) { setFetchError(cause instanceof Error ? cause : new Error('Article could not be opened.')); }
        }}>
        <span className="rss-article-title" style={widgetContentScale(appearance)}>{article.title}</span>
        {article.date && <span className="rss-article-date" style={widgetTextColor(appearance)}>{new Date(article.date).toLocaleDateString()}</span>}
      </button>)}
    </div>
    <div className="resource-footer web-data-footer rss-footer">
      <button type="button" className="quiet-button" disabled={disabled || loading || !endpoint} onClick={() => refresh.current(true)}>Refresh</button>
      <div className="web-data-metadata">
        <span>Every {config.refreshMinutes} min</span>
        <span>{result ? 'Updated ' + new Date(result.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not updated yet'}</span>
      </div>
    </div>
    <WidgetInspectorPortal target={inspectorTarget}>
      <div className="clip-format-cluster">
        <label className="clip-format-source">Feed URL
          <input spellCheck={false} type="url" aria-label="Feed URL" placeholder="RSS or Atom URL" value={config.feedUrl} disabled={disabled}
            onBlur={flush} onChange={event => edit({ feedUrl: event.target.value })} />
        </label>
        <FormattingControls name="RSS Feed" style={appearance} disabled={disabled} error={!!saveError} basic
          onStyle={patch => edit({ style: normalizeTextStyle({ ...latest.current.style, ...patch }) })}
          extraControls={<div className="note-format-group rss-format-settings">
            <label title="Item count">Items
              <input spellCheck={false} type="number" min={1} max={10} step={1} aria-label="Feed item count" value={config.itemLimit} disabled={disabled}
                onBlur={flush} onChange={event => edit({ itemLimit: Number.isFinite(event.target.valueAsNumber) ? Math.min(10, Math.max(1, Math.round(event.target.valueAsNumber))) : 5 })} />
            </label>
            <label title="Refresh interval in minutes">Every
              <input spellCheck={false} type="number" min={5} step={1} aria-label="Feed refresh interval in minutes" value={config.refreshMinutes} disabled={disabled}
                onBlur={flush} onChange={event => edit({ refreshMinutes: Number.isFinite(event.target.valueAsNumber) ? Math.max(5, Math.round(event.target.valueAsNumber)) : 5 })} /> min
            </label>
          </div>} />

      </div>
    </WidgetInspectorPortal>
    {saveError && <p className="form-error" role="alert">{saveError}</p>}
  </div>;
}



