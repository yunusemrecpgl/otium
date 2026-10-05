import { useEffect, useRef, useState } from 'react';
import { Home, ChevronLeft, ChevronRight, Plus, Briefcase, Check, Quote } from 'lucide-react';
import type { OtiumData } from '../domain/data';
import { currentTabService } from '../services/currentTab';
import type { CurrentPage } from '../services/currentTab';
import { isPageCaptured, quickCaptureService } from '../services/quickCapture';
import { getFolderPath } from '../utils/folderHierarchy';
import { FolderIcon } from '../components/FolderIcon';
import { LinkFavicon } from '../components/LinkFavicon';
import { useTheme } from '../hooks/useTheme';
import { selectedTextService } from '../services/selectedText';
import type { PageSelection } from '../services/selectedText';

interface Rename { id: string; name: string }

function displayTitle(title: string) {
  const [first = '', ...rest] = Array.from(title);
  return first.toLocaleUpperCase() + rest.join('');
}

export function QuickCapturePopup() {
  const [data, setData] = useState<OtiumData | null>(null);
  const [page, setPage] = useState<CurrentPage | null>(null);
  const [selection, setSelection] = useState<PageSelection | null>(null);
  const [projectCapture, setProjectCapture] = useState<'link' | 'selection'>('link');
  const [success, setSuccess] = useState<string | null>(null);
  const [view, setView] = useState<'main' | 'folders' | 'projects'>('main');
  const [containerId, setContainerId] = useState('home');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rename, setRename] = useState<Rename | null>(null);
  const renameRef = useRef<Rename | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const notificationVersion = useRef(0), operationVersion = useRef(0);
  function acceptResult(next: OtiumData) {
    if (notificationVersion.current === operationVersion.current) setData(next);
  }
  const theme = useTheme(data?.settings.appearance.theme);
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
    void Promise.allSettled([quickCaptureService.read(), currentTabService.read(), selectedTextService.read()]).then(([stored, tab, selected]) => {
      if (!active) return;
      if (stored.status === 'fulfilled' && notificationVersion.current === version) setData(stored.value);
      if (tab.status === 'fulfilled') setPage(tab.value);
      if (selected.status === 'fulfilled') setSelection(selected.value);
      const failed = stored.status === 'rejected' ? stored.reason : tab.status === 'rejected' ? tab.reason : null;
      if (failed) setError(failed instanceof Error ? failed.message : 'Unable to load this page.');
      setLoading(false);
    });
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => { if (rename) { nameInput.current?.focus(); nameInput.current?.select(); } }, [rename?.id]);

  async function run(operation: () => Promise<void>) {
    if (pending.current) return;
    operationVersion.current = notificationVersion.current;
    pending.current = true; setBusy(true); setError(null); setSuccess(null);
    try { await operation(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The page could not be saved.'); }
    finally { pending.current = false; setBusy(false); }
  }
  function beginRename(id: string, name: string) {
    const edit = { id, name };
    renameRef.current = edit; setRename(edit);
  }
  function commitName() {
    const edit = renameRef.current;
    if (!edit || pending.current) return;
    renameRef.current = null; setRename(null);
    void run(async () => { acceptResult(await quickCaptureService.renameFolder(edit.id, edit.name)); });
  }
  const disabled = busy || loading || !data || !page;
  const path = data ? getFolderPath(data, containerId) : null;
  const currentFolder = path?.at(-1);
  const folderIds = new Set(data?.workspaceItems.flatMap(item => item.type === 'folder' && !item.trashedAt && item.containerId === containerId ? [item.folderId] : []) ?? []);
  const folders = data?.folders.filter(folder => !folder.trashedAt && folderIds.has(folder.id) && getFolderPath(data, folder.id)) ?? [];
  const projects = data?.projects.filter(project => !project.trashedAt) ?? [];
  const homeAdded = Boolean(data && page && isPageCaptured(data, page, { containerId: 'home' }));
  const folderAdded = Boolean(data && page && isPageCaptured(data, page, { containerId }));

  function navigateFolder(id: string) {
    if (renameRef.current) return;
    setContainerId(id);
  }
  function back() {
    if (view === 'folders' && containerId !== 'home') setContainerId(path?.at(-2)?.id ?? 'home');
    else setView('main');
  }

  return <main className="otium-app otium-popup" data-theme={theme} aria-busy={loading || busy}>
    {page && <header className="popup-page-preview">
      <div className="popup-page-text">
        <h1 title={page.title}>{displayTitle(page.title)}</h1>
        <p title={page.url}>{new URL(page.url).host}{new URL(page.url).pathname === '/' ? '' : new URL(page.url).pathname}</p>
      </div>
      <LinkFavicon title={page.title} url={page.url} />
    </header>}
    {loading && <p className="muted" role="status">Loading…</p>}
    {view === 'main' && !loading && <div className="popup-actions">
      <button type="button" className="popup-row" disabled={disabled || homeAdded} onClick={() => { void run(async () => { acceptResult(await quickCaptureService.addToHome(page!)); }); }}>
        <Home /><span>{homeAdded ? 'Added to Home' : 'Add to Home'}</span>{homeAdded && <Check />}
      </button>
      <button type="button" className="popup-row" disabled={disabled} onClick={() => { setContainerId('home'); setView('folders'); }}>
        <FolderIcon icon="folder" /><span>Add to Folder</span><ChevronRight />
      </button>
      <button type="button" className="popup-row" disabled={disabled} onClick={() => { setProjectCapture('link'); setView('projects'); }}>
        <Briefcase /><span>Add to Project</span><ChevronRight />
      </button>
      {selection && <button type="button" className="popup-row" disabled={disabled}
        onClick={() => { setProjectCapture('selection'); setSuccess(null); setView('projects'); }}>
        <Quote /><span>Add Selection to Project</span><ChevronRight />
      </button>}
    </div>}
    {view !== 'main' && <>
      <button type="button" className="popup-back" disabled={busy || Boolean(rename)} onClick={back}><ChevronLeft />Back</button>
      <h2 className="popup-section-title">{view === 'projects' ? 'Projects' : currentFolder ? <><FolderIcon icon={currentFolder.icon} />{currentFolder.name || 'Folders'}</> : 'Folders'}</h2>
    </>}
    {view === 'folders' && <>
      {containerId !== 'home' && <button type="button" className="popup-row" disabled={disabled || folderAdded || !path || Boolean(rename)} onClick={() => {
        void run(async () => { acceptResult(await quickCaptureService.addToFolder(page!, containerId)); });
      }}><Plus /><span>{folderAdded ? 'Added to this folder' : 'Add to this folder'}</span>{folderAdded && <Check />}</button>}
      <button type="button" className="popup-row popup-new-folder" disabled={disabled || Boolean(rename)} onClick={() => {
        void run(async () => {
          const result = await quickCaptureService.createFolder(page!, containerId);
          acceptResult(result.data); beginRename(result.folderId, 'New Folder');
        });
      }}><Plus /><span>New Folder</span></button>
      <div className="popup-destinations">
        {folders.map(folder => <div key={folder.id} className="popup-folder-row">
          <button type="button" className="popup-folder-icon" disabled={disabled || Boolean(rename)} aria-label={`Open ${folder.name || 'unnamed folder'}`} onClick={() => navigateFolder(folder.id)}>
            <FolderIcon icon={folder.icon} />
          </button>
          {rename?.id === folder.id ? <input ref={nameInput} className="popup-folder-input" aria-label="Folder name" maxLength={40} value={rename.name}
            onChange={event => { const edit = { id: folder.id, name: event.target.value }; renameRef.current = edit; setRename(edit); }}
            onBlur={commitName} onKeyDown={event => {
              if (event.key === 'Enter') { event.preventDefault(); commitName(); }
              if (event.key === 'Escape') { event.preventDefault(); renameRef.current = null; setRename(null); }
            }} /> : <span className="popup-folder-name" role="button" tabIndex={busy ? -1 : 0} aria-label={`Rename ${folder.name || 'unnamed folder'}`}
              title={folder.name || 'Unnamed folder'} onDoubleClick={() => { if (!busy) beginRename(folder.id, folder.name); }}
              onKeyDown={event => { if (!busy && (event.key === 'Enter' || event.key === 'F2')) { event.preventDefault(); beginRename(folder.id, folder.name); } }}>{folder.name}</span>}
          <button type="button" className="popup-folder-enter" disabled={disabled || Boolean(rename)} aria-label={`Open ${folder.name || 'unnamed folder'}`} onClick={() => navigateFolder(folder.id)}><ChevronRight /></button>
        </div>)}
        {!folders.length && <p className="muted">No folders here.</p>}
      </div>
    </>}
    {view === 'projects' && <div className="popup-destinations">
      {projects.map(project => {
        const added = projectCapture === 'link' && Boolean(data && page && isPageCaptured(data, page, { projectId: project.id }));
        return <button key={project.id} type="button" className="popup-row" disabled={disabled || added} title={project.name} onClick={() => {
          void run(async () => {
            if (projectCapture === 'selection') {
              if (!selection) throw new Error('No selected text is available.');
              acceptResult(await quickCaptureService.addSelectionToProject(selection, project.id));
              setSuccess(`Added to ${project.name}`);
            } else acceptResult(await quickCaptureService.addToProject(page!, project.id));
          });
        }}><span className="project-color-swatch" data-project-color={project.color ?? 'neutral'} aria-hidden="true" /><span>{project.name}</span>{added && <Check aria-label="Added" />}</button>;
      })}
      {!projects.length && <p className="muted">No projects yet.</p>}
    </div>}
    {success && <p className="muted" role="status">{success}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </main>;
}
