import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { BookmarkPlus, ChevronsLeft, ChevronsRight, ChevronDown, ChevronRight, Pencil, Plus, Settings, Trash2, X } from 'lucide-react';
import { t, useLocale } from '../i18n';
import { DEFAULT_NOTEBOOK_TEMPLATE_ICON, EMPTY_NOTE, EMPTY_NOTEBOOK } from '../domain/notebook';
import type { NotebookData, NotebookNode, NotebookPage, NotebookSection } from '../domain/notebook';
import { notebookColorToken } from '../domain/notebookPalette';
import type { NotebookColorTone } from '../domain/notebookPalette';
import { dataRepository } from '../services/storage';
import { NotebookEditor } from './NotebookEditor';
import type { NotebookExportSnapshot } from './NotebookEditor';
import { NotebookNoteExport } from './NotebookNoteExport';
import { NotebookEntryColorPicker } from './NotebookColorPalette';
import { NOTEBOOK_BACKGROUNDS, PAGE_PADDING_MIN, PAGE_PADDING_MAX, readPagePadding, readNotebookBackground, savePagePadding, saveNotebookBackground } from './notebookPagePreferences';
import { FONT_SIZE_MIN, FONT_SIZE_MAX, readNotebookFontSize, saveNotebookFontSize, readNotebookZoom, saveNotebookZoom } from './notebookPagePreferences';
import { NOTEBOOK_LINE_HEIGHTS, readNotebookLineHeight, saveNotebookLineHeight, readLastNotebookNote, saveLastNotebookNote } from './notebookPagePreferences';
import { readNotebookSpellcheck, saveNotebookSpellcheck } from './notebookPagePreferences';
import { NotebookSectionTemplates } from './NotebookSectionTemplates';
import { NotebookTemplateDialog } from './NotebookTemplateDialog';
import type { NotebookTemplateDraft } from './NotebookTemplateDialog';
import type { NotebookStarter, NotebookTemplateChange } from './notebookTemplates';
import { useNotebookReorder } from './useNotebookReorder';
import type { NotebookDrop } from './useNotebookReorder';
import { ThemeToggle } from '../components/ThemeToggle';
import type { Theme } from '../domain/settings';

const WIDTH_KEY = 'otium:notebook-navigation-width';
const clampWidth = (width: number) => Math.max(140, Math.min(440, width));
function initialWidth() {
  try { return clampWidth(Number(localStorage.getItem(WIDTH_KEY)) || 240); }
  catch { return 240; }
}

type NotebookSelection =
  | { kind: 'notebook' }
  | { kind: 'section'; sectionId: string }
  | { kind: 'note'; sectionId: string; pageId: string };

const notebookRoot = { kind: 'notebook' } as const;

const ordered = <T extends { order: number; id: string }>(items: T[]) =>
  [...items].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

function moveNotebookEntries<T extends { order: number; id: string }>(entries: T[], drop: NotebookDrop, inGroup: (entry: T) => boolean) {
  const group = ordered(entries.filter(inGroup));
  const source = group.findIndex(entry => entry.id === drop.id);
  const anchor = group.findIndex(entry => entry.id === drop.anchorId);
  if (source < 0 || anchor < 0 || source === anchor) return entries;
  const destination = anchor + Number(drop.after) - Number(source < anchor);
  if (source === destination) return entries;
  const [entry] = group.splice(source, 1);
  group.splice(destination, 0, entry);
  const ranks = new Map(group.map((item, index) => [item.id, index]));
  return entries.map(item => {
    const order = ranks.get(item.id);
    return order === undefined || order === item.order ? item : { ...item, order };
  });
}
const sectionSelection = (section?: NotebookSection): NotebookSelection =>
  section ? { kind: 'section', sectionId: section.id } : notebookRoot;

function initialSelection(notebook: NotebookData): NotebookSelection {
  const id = readLastNotebookNote();
  const page = notebook.pages.find(note => note.id === id);
  if (page && notebook.sections.some(section => section.id === page.sectionId)) {
    return { kind: 'note', sectionId: page.sectionId, pageId: page.id };
  }
  return sectionSelection(ordered(notebook.sections)[0]);
}

function entryAccent(color?: NotebookColorTone): CSSProperties | undefined {
  return color ? { '--notebook-entry-color': notebookColorToken('color', color) } as CSSProperties : undefined;
}

const nextOrder = (items: { order: number }[]) => items.reduce((max, item) => Math.max(max, item.order), -1) + 1;
function uniqueName(base: string, names: string[]) {
  const used = new Set(names);
  let name = base;
  for (let index = 2; used.has(name); index++) name = base + '-' + index;
  return name;
}

export function NotebookView({ notebook = EMPTY_NOTEBOOK, flush, theme, onToggleTheme }: {
  notebook?: NotebookData;
  flush: RefObject<(() => Promise<boolean>) | null>;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const locale = useLocale();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pagePadding, setPagePadding] = useState(readPagePadding);
  const [fontSize, setFontSize] = useState(readNotebookFontSize);
  const [lineHeight, setLineHeight] = useState(readNotebookLineHeight);
  const [zoom, setZoom] = useState(readNotebookZoom);
  const [showPaddingGuides, setShowPaddingGuides] = useState(false);
  const paddingGuideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(paddingGuideTimer.current), []);
  const [background, setBackground] = useState(readNotebookBackground);
  const [spellcheck, setSpellcheck] = useState(readNotebookSpellcheck);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const exportSnapshot = useRef<NotebookExportSnapshot | null>(null);
  const [selection, setSelection] = useState(() => initialSelection(notebook));
  const [creatingTitle, setCreatingTitle] = useState<string | null>(null);
  const [createdPage, setCreatedPage] = useState<NotebookPage | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(() =>
    selection.kind === 'notebook' ? null : selection.sectionId);
  const [editing, setEditing] = useState<{ id: string; name: string; source: 'sidebar' | 'header' } | null>(null);
  const editRef = useRef(editing);
  const sectionClick = useRef<{ id: string; before: string | null } | null>(null);
  const [deletion, setDeletion] = useState<NotebookSelection | null>(null);
  const [templateDraft, setTemplateDraft] = useState<NotebookTemplateDraft | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [width, setWidth] = useState(initialWidth);
  const header = useRef<HTMLDivElement>(null);
  const navigation = useRef<HTMLDivElement>(null);
  const resize = useRef<{ x: number; width: number; minimum: number; latest: number } | null>(null);
  useEffect(() => {
    if (deletion) dialog.current?.showModal();
    else dialog.current?.close();
  }, [deletion]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const reorder = useNotebookReorder(navigation, drop => {
    void run(async () => {
      await dataRepository.updateNotebook(latest => drop.sectionId === null
        ? { ...latest, sections: moveNotebookEntries(latest.sections, drop, () => true) }
        : { ...latest, pages: moveNotebookEntries(latest.pages, drop, note => note.sectionId === drop.sectionId) });
    });
  });
  const sections = ordered(notebook.sections);
  const section = selection.kind === 'notebook' ? undefined : sections.find(entry => entry.id === selection.sectionId) ?? sections[0];
  const storedPage = selection.kind === 'note' && section
    ? notebook.pages.find(note => note.id === selection.pageId && note.sectionId === selection.sectionId) : undefined;
  const page = storedPage ?? (selection.kind === 'note' && createdPage?.id === selection.pageId ? createdPage : undefined);
  useEffect(() => {
    if (createdPage && storedPage?.id === createdPage.id) setCreatedPage(null);
  }, [createdPage, storedPage?.id]);
  const expandedSection = expanded && !sections.some(entry => entry.id === expanded) ? section?.id : expanded;
  const context: NotebookSelection = page ? { kind: 'note', sectionId: page.sectionId, pageId: page.id }
    : section ? { kind: 'section', sectionId: section.id } : notebookRoot;
  const headerEntry = creatingTitle ? undefined : page ?? section;
  const renamingHeader = headerEntry && editing?.id === headerEntry.id && editing.source === 'header';
  const renameLabel = t(page ? 'Rename note' : 'Rename section');
  const deleteLabel = t(context.kind === 'note' ? 'Delete note' : context.kind === 'section' ? 'Delete section' : 'Delete notebook');
  const deleteSection = deletion?.kind === 'section' ? sections.find(entry => entry.id === deletion.sectionId) : undefined;
  const deletePage = deletion?.kind === 'note'
    ? notebook.pages.find(note => note.id === deletion.pageId && note.sectionId === deletion.sectionId)
      ?? (createdPage?.id === deletion.pageId ? createdPage : undefined) : undefined;
  const deleteName = deletePage?.title ?? deleteSection?.name;
  const sectionNotes = deleteSection ? ordered(notebook.pages.filter(note => note.sectionId === deleteSection.id)) : [];

  function select(next: NotebookSelection) {
    setCreatedPage(current => next.kind === 'note' && next.pageId === current?.id ? current : null);
    if (next.kind === 'note') saveLastNotebookNote(next.pageId);
    setSelection(next);
  }
  async function run(operation: () => Promise<void> | void) {
    if (pending.current) return false;
    pending.current = true; setBusy(true); setError('');
    try {
      if (await flush.current?.() === false) return false;
      await operation();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Notebook changes could not be saved.');
      return false;
    }
    finally { pending.current = false; setBusy(false); }
  }
  function addSection() {
    void run(async () => {
      const id = crypto.randomUUID(), now = Date.now();
      await dataRepository.updateNotebook(latest => ({ ...latest, sections: [...latest.sections, {
        id, name: uniqueName(t('New section'), latest.sections.map(entry => entry.name)),
        order: nextOrder(latest.sections), createdAt: now, updatedAt: now,
      }] }));
      select({ kind: 'section', sectionId: id });
      setExpanded(id);
    });
  }
  function addPage(section: NotebookSection, starter?: NotebookStarter) {
    if (pending.current) return;
    const title = starter?.title ?? t('New note');
    setCreatingTitle(title);
    void run(async () => {
      const id = crypto.randomUUID(), now = Date.now();
      const committed = await dataRepository.updateNotebook(latest => {
        if (!latest.sections.some(entry => entry.id === section.id)) throw new Error('This notebook item is no longer available.');
        const saved = starter && 'templateId' in starter ? latest.templates?.find(template => template.id === starter.templateId) : undefined;
        if (starter && 'templateId' in starter && !saved) throw new Error('This notebook item is no longer available.');
        const content = saved ? structuredClone(saved.content) : starter && 'createContent' in starter ? starter.createContent() : EMPTY_NOTE;
        const siblings = latest.pages.filter(note => note.sectionId === section.id);
        return { ...latest, pages: [...latest.pages, { id, sectionId: section.id,
          title: uniqueName(saved?.name.trim() ?? title, siblings.map(note => note.title)), content,
          order: nextOrder(siblings), createdAt: now, updatedAt: now }] };
      });
      // Storage synchronization may arrive after the write resolves. Open the
      // committed record by its new ID while the workspace catches up.
      setCreatedPage(committed.pages.find(note => note.id === id) ?? null);
      select({ kind: 'note', sectionId: section.id, pageId: id });
      setExpanded(section.id);
    }).finally(() => setCreatingTitle(null));
  }
  async function saveConflictCopy(page: NotebookPage, content: NotebookNode) {
    const committed = await dataRepository.updateNotebook(latest => {
      const original = latest.pages.find(note => note.id === page.id && note.sectionId === page.sectionId);
      if (!original) throw new Error('This notebook item is no longer available.');
      const siblings = latest.pages.filter(note => note.sectionId === original.sectionId);
      const now = Date.now();
      const copy = { id: crypto.randomUUID(), sectionId: original.sectionId,
        title: uniqueName(t('{title} (copy)', { title: original.title }), siblings.map(note => note.title)),
        content, order: nextOrder(siblings), createdAt: now, updatedAt: now,
        ...(original.color ? { color: original.color } : {}) };
      return { ...latest, pages: [...latest.pages, copy] };
    });
    return committed.pages.find(note => note.id === page.id)!.content;
  }
  function changeTemplate(change: NotebookTemplateChange) {
    return run(async () => {
      await dataRepository.updateNotebook(latest => {
        const templates = latest.templates ?? [];
        if (change.kind === 'save') {
          const note = latest.pages.find(page => page.id === change.pageId);
          if (!note) throw new Error('This notebook item is no longer available.');
          const now = Date.now();
          return { ...latest, templates: [...templates, {
            id: crypto.randomUUID(), name: change.name.trim(), icon: change.icon,
            ...(change.color ? { color: change.color } : {}), content: structuredClone(note.content),
            createdAt: now, updatedAt: now,
          }] };
        }
        const target = templates.find(template => template.id === change.id);
        if (!target) throw new Error('This notebook item is no longer available.');
        if (change.kind === 'delete') return { ...latest, templates: templates.filter(template => template !== target) };
        const name = change.name === change.original.name ? target.name : change.name.trim();
        const icon = change.icon === change.original.icon ? target.icon : change.icon;
        const color = change.color === change.original.color ? target.color : change.color;
        if (name === target.name && icon === target.icon && color === target.color) return latest;
        const updated = { ...target, name, updatedAt: Date.now() };
        if (icon === undefined) delete updated.icon;
        else updated.icon = icon;
        if (color === undefined) delete updated.color;
        else updated.color = color;
        return { ...latest, templates: templates.map(template => template === target ? updated : template) };
      });
    });
  }
  function updateEntryColor(target: NotebookSection | NotebookPage, color?: NotebookColorTone) {
    function applyColor<T extends NotebookSection | NotebookPage>(entry: T): T {
      if (entry.id !== target.id || entry.color === color) return entry;
      const updated = { ...entry, updatedAt: Date.now() };
      if (color === undefined) delete updated.color;
      else updated.color = color;
      return updated;
    }
    void run(async () => {
      await dataRepository.updateNotebook(latest => 'title' in target
        ? { ...latest, pages: latest.pages.map(applyColor) }
        : { ...latest, sections: latest.sections.map(applyColor) });
    });
  }
  function rename(entry: NotebookSection | NotebookPage) {
    const isPage = 'title' in entry;
    const edit = editRef.current;
    if (edit?.id !== entry.id) return;
    editRef.current = null;
    setEditing(null);
    const name = edit?.name.trim();
    if (!name || name === (isPage ? entry.title : entry.name)) return;
    void run(async () => {
      await dataRepository.updateNotebook(latest => isPage
        ? { ...latest, pages: latest.pages.map(note => note.id === entry.id ? { ...note, title: name, updatedAt: Date.now() } : note) }
        : { ...latest, sections: latest.sections.map(item => item.id === entry.id ? { ...item, name, updatedAt: Date.now() } : item) });
    });
  }
  function editName(entry: NotebookSection | NotebookPage, source: 'sidebar' | 'header') {
    if (pending.current) return;
    editRef.current = { id: entry.id, name: 'title' in entry ? entry.title : entry.name, source };
    setEditing(editRef.current);
  }
  function renameInput(entry: NotebookSection | NotebookPage, className: string) {
    if (!editing) return null;
    return <input className={className} aria-label={t('title' in entry ? 'Rename note' : 'Rename section')}
      ref={node => { if (node && document.activeElement !== node) { node.focus(); node.select(); } }}
      value={editing.name} onChange={event => {
        editRef.current = { ...editing, name: event.target.value };
        setEditing(editRef.current);
      }}
      onBlur={() => rename(entry)}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Enter') { event.preventDefault(); rename(entry); }
        if (event.key === 'Escape') { event.preventDefault(); editRef.current = null; setEditing(null); }
      }} />;
  }
  function remove(target: NotebookSelection) {
    setDeletion(null);
    void run(async () => {
      const remaining = await dataRepository.updateNotebook(latest => {
        if (target.kind === 'notebook') return { ...latest, sections: [], pages: [] };
        if (target.kind === 'note') return { ...latest, pages: latest.pages.filter(note => note.id !== target.pageId) };
        return { ...latest, sections: latest.sections.filter(item => item.id !== target.sectionId),
          pages: latest.pages.filter(note => note.sectionId !== target.sectionId) };
      });
      const next = sectionSelection((target.kind === 'note' ? remaining.sections.find(item => item.id === target.sectionId) : undefined)
        ?? ordered(remaining.sections)[0]);
      select(next);
      setExpanded(next.kind === 'section' ? next.sectionId : null);
    });
  }
  function row(entry: NotebookSection | NotebookPage) {
    const isPage = 'title' in entry;
    const name = isPage ? entry.title : entry.name;
    const scope = isPage ? entry.sectionId : null;
    return <div className="notebook-row" style={entryAccent(entry.color)}>
      {editing?.id === entry.id && editing.source === 'sidebar' ? renameInput(entry, 'notebook-row-name notebook-rename')
        : <button type="button" className="quiet-button notebook-row-name"
          data-notebook-note={isPage || undefined}
          data-notebook-dragging={(reorder.preview?.id === entry.id && reorder.preview.sectionId === scope) || undefined}
          aria-current={(isPage ? page?.id === entry.id : context.kind === 'section' && section?.id === entry.id) || undefined}
          aria-expanded={isPage ? undefined : expandedSection === entry.id} title={name} disabled={busy}
          onPointerDown={event => { if (!pending.current) reorder.start(event, { id: entry.id, sectionId: scope }); }}
          onPointerMove={reorder.move} onPointerUp={reorder.finish}
          onPointerCancel={reorder.pointerCancel} onLostPointerCapture={reorder.pointerCancel}
          onClick={event => {
            if (event.detail > 1 || (event.detail !== 0 && reorder.suppressClick.current) || pending.current) return;
            if (isPage) {
              if (page?.id !== entry.id) void run(() => select({ kind: 'note', sectionId: entry.sectionId, pageId: entry.id }));
              return;
            }
            sectionClick.current = event.detail === 1 ? { id: entry.id, before: expandedSection ?? null } : null;
            setExpanded(expandedSection === entry.id ? null : entry.id);
            if (selection.kind !== 'section' || selection.sectionId !== entry.id) {
              if (page) void run(() => select({ kind: 'section', sectionId: entry.id }));
              else select({ kind: 'section', sectionId: entry.id });
            }
          }} onDoubleClick={() => {
            if (reorder.suppressClick.current) return;
            if (!isPage && sectionClick.current?.id === entry.id) setExpanded(sectionClick.current.before);
            sectionClick.current = null;
            editName(entry, 'sidebar');
          }} onKeyDown={event => {
            if (event.key === 'F2') { event.preventDefault(); editName(entry, 'sidebar'); }
          }}>
          {isPage ? entry.color && <span className="notebook-note-color-dot" aria-hidden="true" />
            : expandedSection === entry.id ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          <span className="notebook-row-label">{name}</span>
        </button>}
    </div>;
  }

  function insertSide(id: string, sectionId: string | null) {
    const preview = reorder.preview;
    if (preview?.sectionId === sectionId && preview.placement?.anchorId === id) return preview.placement.after ? 'after' : 'before';
  }

  return <main className="notebook-workspace" aria-label={t('Notebook')}>
    <aside className="notebook-navigation" data-collapsed={collapsed} style={collapsed ? undefined : { flexBasis: width }} aria-label={t('Notebook navigation')}>
      <div ref={header} className="notebook-navigation-header">
        {!collapsed && <h1><button type="button" className="quiet-button notebook-root-button"
          aria-current={context.kind === 'notebook' || undefined} disabled={busy} onClick={() => {
            if (page) void run(() => select(notebookRoot));
            else select(notebookRoot);
          }}>{t('Notebook')}</button></h1>}
        <div className="notebook-actions">
        {!collapsed && <>
          <button type="button" className="quiet-button notebook-header-action" aria-label={t('New note')} title={t('New note')}
            disabled={busy || !section} onClick={() => { if (section) addPage(section); }}>
            <Plus size={14} aria-hidden="true" />
          </button>
          <button type="button" className="quiet-button notebook-header-action" aria-label={deleteLabel} title={deleteLabel}
            disabled={busy || (context.kind === 'notebook' && !sections.length)} onClick={() => setDeletion(context)}>
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </>}
        <button type="button" className="quiet-button" onClick={() => setCollapsed(value => !value)}
          aria-label={t(collapsed ? 'Expand notebook navigation' : 'Collapse notebook navigation')} aria-expanded={!collapsed} aria-controls="notebook-navigation-content">
          {collapsed ? <ChevronsRight size={16} aria-hidden="true" /> : <ChevronsLeft size={16} aria-hidden="true" />}
        </button>
        </div>
      </div>
      <div ref={navigation} id="notebook-navigation-content" hidden={collapsed} data-notebook-reordering={!!reorder.preview || undefined}
        onKeyDownCapture={event => {
          if (event.key !== 'Escape' || !reorder.preview) return;
          event.preventDefault();
          reorder.cancel();
        }}>
        <ul>{sections.map(item => <li key={item.id} data-notebook-sort-id={item.id} data-notebook-insert={insertSide(item.id, null)}>
          {row(item)}
          {expandedSection === item.id && <div className="notebook-section-notes">
            <ul>{ordered(notebook.pages.filter(note => note.sectionId === item.id)).map(note =>
              <li key={note.id} data-notebook-sort-id={note.id} data-notebook-insert={insertSide(note.id, item.id)}>{row(note)}</li>)}</ul>
          </div>}
        </li>)}</ul>
        <button type="button" className="quiet-button" disabled={busy} onClick={addSection}>+ {t('New section')}</button>
      </div>
      {!collapsed && <div className="notebook-resize-edge" aria-hidden="true"
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0) return;
          event.preventDefault();
          const panel = event.currentTarget.parentElement!;
          const row = header.current;
          if (!row) return;
          const current = panel.getBoundingClientRect().width;
          const style = getComputedStyle(panel);
          const minimum = [...row.children].reduce((sum, child) => sum + child.getBoundingClientRect().width, 0)
            + parseFloat(getComputedStyle(row).columnGap)
            + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
            + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
          resize.current = { x: event.clientX, width: current, minimum: Math.ceil(minimum), latest: current };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          if (!resize.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
          resize.current.latest = Math.max(resize.current.minimum, clampWidth(resize.current.width + event.clientX - resize.current.x));
          setWidth(resize.current.latest);
        }}
        onLostPointerCapture={() => {
          if (!resize.current) return;
          try { localStorage.setItem(WIDTH_KEY, String(resize.current.latest)); } catch { /* Optional UI preference. */ }
          resize.current = null;
        }} />}

    </aside>
    <dialog ref={dialog} className="add-link-modal project-delete-dialog notebook-delete-dialog" aria-labelledby="notebook-delete-title"
      aria-describedby={deleteSection ? 'notebook-delete-detail' : undefined}
      onCancel={event => { event.preventDefault(); setDeletion(null); }}>
      {deletion && <>
        <div className="notebook-delete-heading">
          <Trash2 size={27} aria-hidden="true" />
          <h2 id="notebook-delete-title">{deletion.kind === 'notebook' ? t('Delete all notebook sections and notes?')
            : deleteName ? t('Delete “{name}”?', { name: deleteName }) : t('This notebook item is no longer available.')}</h2>
        </div>
        {deleteSection && <div className="notebook-delete-context">
          <p id="notebook-delete-detail">{t(sectionNotes.length ? 'These notes will also be deleted:' : 'This section has no notes.')}</p>
          {sectionNotes.length > 0 && <ul aria-labelledby="notebook-delete-detail" tabIndex={sectionNotes.length > 5 ? 0 : undefined}>
            {sectionNotes.map(note => <li key={note.id} title={note.title}>{note.title}</li>)}
          </ul>}
        </div>}
        <div className="modal-actions">
          <button type="button" autoFocus onClick={() => setDeletion(null)}>{t('Cancel')}</button>
          <button type="button" className="project-destructive-action" disabled={deletion.kind !== 'notebook' && !deleteName}
            onClick={() => remove(deletion)}>{t('Delete')}</button>
        </div>
      </>}
    </dialog>
    <NotebookTemplateDialog draft={templateDraft} sourcePageId={page?.id} templates={notebook.templates ?? []}
      busy={busy} error={error} onDraftChange={setTemplateDraft} onChange={changeTemplate} />
    <section className="notebook-editor" aria-label={t('Note editor')} data-creating-note={creatingTitle ? '' : undefined} aria-busy={!!creatingTitle}>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <header className="notebook-note-header">
        <div className="notebook-title-row" style={entryAccent(headerEntry?.color)}>
          <h2 className="notebook-title">{creatingTitle ?? (renamingHeader
            ? renameInput(headerEntry, 'notebook-rename notebook-title-input')
            : page ? <button type="button" className="notebook-title-button" title={t('Rename note')} disabled={busy}
              onClick={() => editName(page, 'header')}>{page.title}</button>
            : section?.name ?? t('Notebook'))}</h2>
          {headerEntry && <div className="notebook-title-actions">
            <button type="button" className="quiet-button notebook-title-edit" disabled={busy || !!renamingHeader}
              aria-label={renameLabel} title={renameLabel} onClick={() => editName(headerEntry, 'header')}>
              <Pencil size={14} aria-hidden="true" />
            </button>
            <NotebookEntryColorPicker key={`${page ? 'note' : 'section'}:${headerEntry.id}`}
              label={t(page ? 'Note color' : 'Section color')} value={headerEntry.color} disabled={busy}
              onChange={tone => updateEntryColor(headerEntry, tone)} />
          </div>}
        </div>
        <div className="notebook-note-actions">
          {page && headerEntry && <button type="button" className="quiet-button notebook-save-template" disabled={busy}
            aria-label={t('Save as template')} title={t('Save as template')}
            onClick={() => setTemplateDraft({ kind: 'save', pageId: page.id, name: page.title,
              icon: DEFAULT_NOTEBOOK_TEMPLATE_ICON, color: page.color })}>
            <BookmarkPlus size={15} aria-hidden="true" /><span>{t('Save as template')}</span>
          </button>}
          {page && headerEntry && <NotebookNoteExport key={page.id} title={page.title}
            readContent={() => exportSnapshot.current?.pageId === page.id ? exportSnapshot.current.read() : page.content} />}
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button ref={settingsButton} type="button" className="quiet-button" aria-label={t('Notebook Settings')} title={t('Notebook Settings')}
            aria-expanded={settingsOpen} aria-controls="notebook-editor-settings"
            onMouseDown={event => event.preventDefault()} onClick={() => setSettingsOpen(open => !open)}>
            <Settings size={16} aria-hidden="true" />
          </button>
        </div>
      </header>
      {page ? <NotebookEditor key={page.id} page={page} flushRef={flush} exportRef={exportSnapshot} spellcheck={spellcheck} pagePadding={pagePadding}
        background={background} showPaddingGuides={showPaddingGuides} fontSize={fontSize} lineHeight={lineHeight}
        onSaveConflictCopy={content => saveConflictCopy(page, content)}
        zoom={zoom} onZoomChange={value => { setZoom(value); saveNotebookZoom(value); }} />
        : section ? <NotebookSectionTemplates templates={notebook.templates ?? []} busy={busy} onOpen={starter => addPage(section, starter)}
          onManage={template => setTemplateDraft({ kind: 'edit', id: template.id, name: template.name,
            icon: template.icon, color: template.color, original: template })} />
        : <p className="notebook-empty muted">{t(sections.length ? 'Select a section.' : 'Create your first section to get started.')}</p>}
    </section>
    <aside id="notebook-editor-settings" className="notebook-editor-settings" aria-labelledby="notebook-settings-title" hidden={!settingsOpen}>
      <div className="notebook-settings-header">
        <h2 id="notebook-settings-title">{t('Notebook Settings')}</h2>
        <button type="button" className="quiet-button" aria-label={t('Close')} onMouseDown={event => event.preventDefault()} onClick={event => {
          const focusInside = event.currentTarget.closest('aside')?.contains(document.activeElement);
          setSettingsOpen(false);
          if (focusInside) settingsButton.current?.focus();
        }}><X size={16} aria-hidden="true" /></button>
      </div>
      <h3>{t('Writing')}</h3>
      <label className="notebook-writing-setting">
        <span>{t('Spell check')}</span>
        <input type="checkbox" role="switch" checked={spellcheck} onChange={event => {
          const enabled = event.target.checked;
          setSpellcheck(enabled);
          saveNotebookSpellcheck(enabled);
        }} />
      </label>
      <label className="notebook-writing-setting">
        <span>{t('Default font size')}</span>
        <select value={fontSize} onChange={event => {
          const size = Number(event.target.value);
          setFontSize(size);
          saveNotebookFontSize(size);
        }}>
          {Array.from({ length: FONT_SIZE_MAX - FONT_SIZE_MIN + 1 }, (_, index) => FONT_SIZE_MIN + index)
            .map(size => <option key={size} value={size}>{size} px</option>)}
        </select>
      </label>
      <label className="notebook-writing-setting">
        <span>{t('Line height')}</span>
        <select value={lineHeight} onChange={event => {
          const height = NOTEBOOK_LINE_HEIGHTS.find(value => value === Number(event.target.value));
          if (height === undefined) return;
          setLineHeight(height);
          saveNotebookLineHeight(height);
        }}>
          {NOTEBOOK_LINE_HEIGHTS.map(height => <option key={height} value={height}>
            {height.toLocaleString(locale, { minimumFractionDigits: 1 })}
          </option>)}
        </select>
      </label>
      <h3>{t('Page')}</h3>
      <label className="notebook-writing-setting notebook-padding-setting">
        <span>{t('Page padding')}</span>
        <output>{pagePadding} px</output>
        <input type="range" min={PAGE_PADDING_MIN} max={PAGE_PADDING_MAX} value={pagePadding} onChange={event => {
          const value = event.target.valueAsNumber;
          setPagePadding(value);
          savePagePadding(value);
          setShowPaddingGuides(true);
          clearTimeout(paddingGuideTimer.current);
          paddingGuideTimer.current = setTimeout(() => setShowPaddingGuides(false), 650);
        }} />
      </label>
      <label className="notebook-writing-setting">
        <span>{t('Background')}</span>
        <select value={background} onChange={event => {
          const mode = NOTEBOOK_BACKGROUNDS.find(value => value === event.target.value);
          if (!mode) return;
          setBackground(mode);
          saveNotebookBackground(mode);
        }}>
          {NOTEBOOK_BACKGROUNDS.map((mode, index) => <option key={mode} value={mode}>{t(['None', 'Lines', 'Grid'][index])}</option>)}
        </select>
      </label>
    </aside>
  </main>;
}
