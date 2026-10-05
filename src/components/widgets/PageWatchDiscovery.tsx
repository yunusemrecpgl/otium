import { ScanSearch } from 'lucide-react';
import { WidgetInspectorPortal } from '../projects/WidgetInspectorPortal';
import { useEffect, useRef, useState } from 'react';
import { discoverPageWatchSources } from '../../services/pageWatchDiscovery';
import type { SourceCandidate } from '../../services/pageWatchDiscovery';
import ExternalSourceError from './ExternalSourceError';
import { normalizeUrl } from '../../utils/url';

export default function PageWatchDiscovery({ url, selector, currentValue, disabled, onUse, onAddPath, inspectorTarget, compact = false }: {
  url: string; selector: string; currentValue?: string; disabled: boolean;
  onUse: (url: string, path: string) => void;
  onAddPath?: (url: string, path: string) => void;
  inspectorTarget?: HTMLElement | null; compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SourceCandidate[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    setResults(null); setError(null); setLoading(false);
    return () => { request.current?.abort(); request.current = null; };
  }, [url, selector]);
  async function discover() {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(null); setResults(null);
    try {
      const found = await discoverPageWatchSources(url, selector, currentValue, controller.signal);
      if (!controller.signal.aborted) setResults(found);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause : new Error('Source discovery is unavailable.'));
    } finally {
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }
  const controls = <div className="page-watch-discovery">
    <button type="button" className={compact ? "quiet-button" : "text-button"} aria-label="Discover source" title={loading ? "Discovering…" : "Discover source"} disabled={disabled || loading || !url.trim()} onClick={() => { void discover(); }}>
      {compact ? <ScanSearch size={16} aria-hidden="true" /> : loading ? 'Discovering…' : 'Discover source'}
    </button>
    {error && <ExternalSourceError error={error} disabled={disabled || loading} onRetry={() => { void discover(); }} />}
    {results && !results.length && <p className="muted">No likely direct sources found.</p>}
    {results?.map(candidate => {
      const source = new URL(candidate.url);
      return <div className="page-watch-candidate" key={candidate.url}>
        <span className="muted">{candidate.matched ? 'Matching direct data source found' : candidate.verified ? 'Direct JSON source found' : 'Possible data source'}</span>
        <span className="page-watch-candidate-url" title={candidate.url}>{source.pathname}{source.search}</span>
        {source.origin !== new URL(normalizeUrl(url) ?? candidate.url).origin && <span className="muted">{source.hostname} · access may be required</span>}
        {candidate.value !== undefined && <span className="page-watch-candidate-value" title={candidate.value}>Possible value: {candidate.path || 'root'} → {candidate.value}</span>}
        <button type="button" className="quiet-button" disabled={disabled} onClick={() => onUse(candidate.url, candidate.path ?? '')}>Use source</button>
        {candidate.suggestedPaths?.map(entry => <div className="page-watch-path-suggestion" key={entry.path}>
          <span title={`${entry.path} → ${entry.value}`}>{entry.path || 'root'} → {entry.value}</span>
          <button type="button" className="text-button" disabled={disabled} onClick={() => onAddPath?.(candidate.url, entry.path)}>+ Field</button>
        </div>)}
      </div>;
    })}
  </div>;
  return <>{controls}<WidgetInspectorPortal target={inspectorTarget}>{controls}</WidgetInspectorPortal></>;
}

