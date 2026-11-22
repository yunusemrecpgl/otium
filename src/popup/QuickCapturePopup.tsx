import { t } from "../i18n";
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useEffect, useRef, useState } from 'react';
import { Home, ChevronLeft, ChevronRight, Briefcase, Check, Quote } from 'lucide-react';
import type { OtiumData } from '../domain/data';
import { currentTabService } from '../services/currentTab';
import type { CurrentPage } from '../services/currentTab';
import { isPageCaptured, quickCaptureService } from '../services/quickCapture';
import { getFolderPath } from '../utils/folderHierarchy';
import { FolderIcon } from '../components/FolderIcon';
import { LinkFavicon } from '../components/LinkFavicon';
import { useBrowserColorScheme } from '../hooks/useBrowserColorScheme';
import { selectedTextService } from '../services/selectedText';
import type { PageSelection } from '../services/selectedText';
import { useWidgetCapabilities } from '../hooks/useWidgetCapabilities';
import { widgetCapabilityService } from '../services/widgetCapabilities';
import { browserTabsService } from '../services/browserTabs';
import { setLocale } from '../i18n';


function displayTitle(title: string) {
  const [first = '', ...rest] = Array.from(title);
  return first.toLocaleUpperCase() + rest.join('');
}

export function QuickCapturePopup() {
  useDocumentTitle();
  const [data, setData] = useState<OtiumData | null>(null);
  const [page, setPage] = useState<CurrentPage | null>(null);
  const [selection, setSelection] = useState<PageSelection | null>(null);
  const [projectCapture, setProjectCapture] = useState<'link' | 'selection'>('link');
  const [success, setSuccess] = useState<string | null>(null);
  const [savedFolderId, setSavedFolderId] = useState<string | null>(null);
  const [view, setView] = useState<'main' | 'folders' | 'projects'>('main');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const notificationVersion = useRef(0), operationVersion = useRef(0);
  function acceptResult(next: OtiumData) {
    if (notificationVersion.current === operationVersion.current) setData(next);
  }
  const theme = useBrowserColorScheme();
  useEffect(() => { if (data?.settings.appearance.language) setLocale(data.settings.appearance.language); }, [data?.settings.appearance.language]);
  const { enabledTypes } = useWidgetCapabilities(data);
  const clipAvailable = enabledTypes.has('clip');
  useEffect(() => {
    let active = true;
    const version = notificationVersion.current;
    let unsubscribe = () => {};
    try {
      unsubscribe = quickCaptureService.subscribe(next => {
        if (!active) return;
        notificationVersion.current++;
        setData(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      }, cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Stored data could not be read.');
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Storage synchronization is unavailable.'); }
    void Promise.allSettled([quickCaptureService.read(), currentTabService.read()]).then(([stored, tab]) => {
      if (!active) return;
      if (stored.status === 'fulfilled' && notificationVersion.current === version) setData(stored.value);
      if (tab.status === 'fulfilled') setPage(tab.value);
      const failed = stored.status === 'rejected' ? stored.reason : tab.status === 'rejected' ? tab.reason : null;
      if (failed) setError(failed instanceof Error ? failed.message : 'Unable to load this page.');
      setLoading(false);
    });
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => {
    let active = true;
    setSelection(null);
    if (clipAvailable && page) void selectedTextService.read().then(value => { if (active) setSelection(value); });
    return () => { active = false; };
  }, [clipAvailable, page?.url]);

  async function run(operation: () => Promise<void>) {
    if (pending.current) return;
    operationVersion.current = notificationVersion.current;
    pending.current = true; setBusy(true); setError(null); setSuccess(null);
    try { await operation(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The page could not be saved.'); }
    finally { pending.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!savedFolderId) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      setSavedFolderId(null);
      setView('main');
    }, reducedMotion ? 250 : 600);
    return () => window.clearTimeout(timer);
  }, [savedFolderId]);

  const disabled = busy || savedFolderId !== null || loading || !data || !page;
  const folders = view === 'folders' && data ? data.folders.flatMap(folder => {
    const path = getFolderPath(data, folder.id);
    if (!path) return [];
    const label = path.map(entry => entry.name.trim() || t('unnamed folder')).join(' / ');
    const stops = path.map(entry => `var(--palette-${entry.color}-surface)`);
    const background = stops.length === 1 ? stops[0] : `linear-gradient(to right, ${stops.join(', ')})`;
    return [{ folder, path, label, background }];
  }).sort((a, b) => a.label.localeCompare(b.label, data.settings.appearance.language)) : [];
  const projects = data?.projects.filter(project => !project.trashedAt) ?? [];
  const homeAdded = Boolean(data && page && isPageCaptured(data, page, { containerId: 'home' }));
  return <main className="otium-app otium-popup" data-theme={theme} aria-busy={loading || busy}>
    <div className="popup-management"><button type="button" className="popup-back" disabled={busy || savedFolderId !== null} onClick={() => { void run(() => browserTabsService.openWidgets()); }}>{t("Widgets & permissions")}</button></div>
    {page && <header className="popup-page-preview">
      <div className="popup-page-text">
        <h1 title={page.title}>{displayTitle(page.title)}</h1>
        <p title={page.url}>{new URL(page.url).host}{new URL(page.url).pathname === '/' ? '' : new URL(page.url).pathname}</p>
      </div>
      <LinkFavicon title={page.title} url={page.url} />
    </header>}
    {loading && <p className="muted" role="status">{t("Loading…")}</p>}
    {view === 'main' && !loading && <div className="popup-actions">
      {!clipAvailable && <div className="popup-permission-hint"><p>{t("Capture selected text and keep its source. Clip needs access to the active page.")}</p>
        <button type="button" className="popup-row" disabled={disabled} onClick={() => { void run(async () => {
          if (!await widgetCapabilityService.requestEnable('clip')) throw new Error('Access was not granted. You can try again.');
        }); }}><Quote /><span>{t("Grant Clip access")}</span></button>
      </div>}
      <button type="button" className="popup-row" disabled={disabled || homeAdded} onClick={() => { void run(async () => { acceptResult(await quickCaptureService.addToHome(page!)); }); }}>
        <Home /><span>{homeAdded ? t("Added to Home") : t("Add to Home")}</span>{homeAdded && <Check />}
      </button>
      <button type="button" className="popup-row" disabled={disabled} onClick={() => { setSuccess(null); setView('folders'); }}>
        <FolderIcon icon="folder" /><span>{t("Add to Folder")}</span><ChevronRight />
      </button>
      <button type="button" className="popup-row" disabled={disabled} onClick={() => { setProjectCapture('link'); setView('projects'); }}>
        <Briefcase /><span>{t("Add to Project")}</span><ChevronRight />
      </button>
      {clipAvailable && selection && <button type="button" className="popup-row" disabled={disabled}
        onClick={() => { setProjectCapture('selection'); setSuccess(null); setView('projects'); }}>
        <Quote /><span>{t("Add Selection to Project")}</span><ChevronRight />
      </button>}
    </div>}
    {view !== 'main' && <>
      <button type="button" className="popup-back" disabled={busy || savedFolderId !== null} onClick={() => setView('main')}><ChevronLeft />{t("Back")}</button>
      <h2 className="popup-section-title">{view === 'projects' ? t("Projects") : t("Folders")}</h2>
    </>}
    {view === 'folders' && <div className="popup-destinations">
      {folders.map(({ folder, path, label, background }) => {
        const added = Boolean(data && page && isPageCaptured(data, page, { containerId: folder.id }));
        const addedLabel = path.every(entry => entry.name.trim()) ? t('Added to {name}', { name: label }) : t('Added');
        return <button key={folder.id} type="button" className="popup-row popup-folder-save" disabled={disabled || added}
          data-save-success={savedFolderId === folder.id || undefined}
          style={{ background }}
          aria-label={added ? t('Added to {name}', { name: label }) : label}
          onClick={() => { void run(async () => {
            acceptResult(await quickCaptureService.addToFolder(page!, folder.id));
            setSuccess(addedLabel);
            setSavedFolderId(folder.id);
          }); }}>
          <span className="popup-folder-path" aria-hidden="true">
            {path.map((entry, index) => <span className="popup-folder-segment" key={entry.id}>
              {index > 0 && <span className="popup-folder-separator">/</span>}
              <FolderIcon icon={entry.icon} />
              {entry.name.trim() && <span className="popup-folder-segment-name" title={entry.name}>{entry.name}</span>}
            </span>)}
          </span>
          {savedFolderId === folder.id && <Check className="popup-folder-success-check" aria-hidden="true" />}
        </button>;
      })}
      {!folders.length && <p className="muted">{t("No folders here.")}</p>}
    </div>}
    {view === 'projects' && <div className="popup-destinations">
      {projects.map(project => {
        const added = projectCapture === 'link' && Boolean(data && page && isPageCaptured(data, page, { projectId: project.id }));
        return <button key={project.id} type="button" className="popup-row" disabled={disabled || added} title={project.name} onClick={() => {
          void run(async () => {
            if (projectCapture === 'selection') {
              if (!selection) throw new Error('No selected text is available.');
              acceptResult(await quickCaptureService.addSelectionToProject(selection, project.id));
              setSuccess(t("Added to {name}", { name: project.name }));
            } else acceptResult(await quickCaptureService.addToProject(page!, project.id));
          });
        }}><span className="project-color-swatch" data-project-color={project.color ?? 'neutral'} aria-hidden="true" /><span>{project.name}</span>{added && <Check aria-label={t("Added")} />}</button>;
      })}
      {!projects.length && <p className="muted">{t("No projects yet.")}</p>}
    </div>}
    {success && <p className="muted" role="status">{success}</p>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
  </main>;
}
