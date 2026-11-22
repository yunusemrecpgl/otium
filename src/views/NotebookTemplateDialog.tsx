import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FolderIconPicker } from '../components/FolderPickers';
import { notebookTemplateIconName } from '../domain/notebook';
import type { NotebookTemplate } from '../domain/notebook';
import { t } from '../i18n';
import { getFolderIconName } from '../utils/folderIcons';
import { NotebookColorOptions, NotebookColorSwatch } from './NotebookColorPalette';
import { NotebookTemplateGlyph } from './NotebookTemplateGlyph';
import { NOTEBOOK_TEMPLATE_DEFAULT_SURFACE, notebookTemplateSurface } from './notebookTemplates';
import type { NotebookTemplateChange } from './notebookTemplates';

export type NotebookTemplateDraft = NotebookTemplateChange & { name: string };

export function NotebookTemplateDialog({ draft, sourcePageId, templates, busy, error, onDraftChange, onChange }: {
  draft: NotebookTemplateDraft | null; sourcePageId?: string; templates: NotebookTemplate[]; busy: boolean; error: string;
  onDraftChange: (draft: NotebookTemplateDraft | null) => void;
  onChange: (change: NotebookTemplateChange) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const colorButton = useRef<HTMLButtonElement>(null);
  const iconButton = useRef<HTMLButtonElement>(null);
  const [picker, setPicker] = useState<'color' | 'icon' | null>(null);
  const [submitFailed, setSubmitFailed] = useState(false);
  const isOpen = draft !== null;
  useEffect(() => {
    if (isOpen) dialog.current?.showModal();
    else { dialog.current?.close(); setSubmitFailed(false); setPicker(null); }
  }, [isOpen]);

  function closePicker() {
    (picker === 'color' ? colorButton : iconButton).current?.focus();
    setPicker(null);
  }

  const target = draft && draft.kind !== 'save' ? templates.find(template => template.id === draft.id) : undefined;
  const available = draft?.kind === 'save' ? draft.pageId === sourcePageId : !!target;
  const canSubmit = !busy && available && !!draft && (draft.kind === 'delete' || !!draft.name.trim());

  return <dialog ref={dialog} className="add-link-modal notebook-template-dialog" aria-labelledby="notebook-template-title"
    onCancel={event => {
      event.preventDefault();
      if (picker) closePicker();
      else if (!busy) onDraftChange(null);
    }}>
    {draft && <form key={draft.kind} onSubmit={event => {
      event.preventDefault();
      if (!canSubmit) return;
      setSubmitFailed(false);
      void onChange(draft).then(saved => {
        if (saved) onDraftChange(null);
        else setSubmitFailed(true);
      });
    }}>
      <h2 id="notebook-template-title">{draft.kind === 'save' ? t('Save as template') : draft.kind === 'edit' ? t('Edit template')
        : t('Delete “{name}”?', { name: target?.name ?? draft.name })}</h2>
      {draft.kind !== 'delete' && <label>{t('Template name')}
        <input autoFocus required value={draft.name} disabled={busy} onChange={event => onDraftChange({ ...draft, name: event.target.value })} />
      </label>}
      {draft.kind !== 'delete' && <div className="notebook-template-choices"
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPicker(null); }}>
        <div className="notebook-template-triggers">
          <button ref={colorButton} type="button" className="quiet-button" disabled={busy} aria-expanded={picker === 'color'}
            aria-label={`${t('Template color')} · ${t(draft.color ?? 'Default')}`} title={t('Template color')}
            onClick={() => setPicker(current => current === 'color' ? null : 'color')}>
            <NotebookColorSwatch kind="highlight" value={notebookTemplateSurface(draft.color)} />
            <span className="notebook-template-choice-name">{t(draft.color ?? 'Default')}</span><ChevronDown size={12} aria-hidden="true" />
          </button>
          <button ref={iconButton} type="button" className="quiet-button" disabled={busy} aria-expanded={picker === 'icon'}
            onClick={() => setPicker(current => current === 'icon' ? null : 'icon')}>
            <NotebookTemplateGlyph icon={draft.icon} /><span className="notebook-template-choice-name">{t('Template icon')}</span><ChevronDown size={12} aria-hidden="true" />
          </button>
        </div>
        {picker === 'color' && <fieldset className="notebook-template-picker" disabled={busy} aria-label={t('Template color')}>
          <NotebookColorOptions kind="highlight" label={t('Template color')}
            value={draft.color && notebookTemplateSurface(draft.color)} defaultSwatch={NOTEBOOK_TEMPLATE_DEFAULT_SURFACE}
            onSelect={color => { closePicker(); onDraftChange({ ...draft, color }); }} />
        </fieldset>}
        {picker === 'icon' && <div className="notebook-template-picker">
          <FolderIconPicker value={notebookTemplateIconName(draft.icon)} disabled={busy} label={t('Template icon')} searchLabel={t('Search icons…')}
            onChange={icon => {
              closePicker();
              if (icon === getFolderIconName(notebookTemplateIconName(draft.icon))) return;
              // Use the Lucide export name to distinguish Code from the old square-code ID.
              onDraftChange({ ...draft, icon: icon === 'code' ? 'Code' : icon });
            }} />
        </div>}
      </div>}
      {!available ? <p className="form-error" role="alert">{t('This notebook item is no longer available.')}</p>
        : submitFailed && <p className="form-error" role="alert">{t(error || 'Notebook changes could not be saved.')}</p>}
      <div className="modal-actions">
        {draft.kind === 'edit' && <button type="button" className="project-destructive-action notebook-template-delete"
          disabled={busy || !target} onClick={() => {
            if (!target) return;
            setPicker(null);
            setSubmitFailed(false);
            onDraftChange({ kind: 'delete', id: target.id, name: target.name });
          }}>{t('Delete template')}</button>}
        <button type="button" autoFocus={draft.kind === 'delete'} disabled={busy} onClick={() => onDraftChange(null)}>{t('Cancel')}</button>
        <button type="submit" disabled={!canSubmit} className={draft.kind === 'delete' ? 'project-destructive-action' : undefined}>
          {t(draft.kind === 'delete' ? 'Delete' : 'Save template')}
        </button>
      </div>
    </form>}
  </dialog>;
}
