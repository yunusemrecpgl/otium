import type { CSSProperties, ReactNode } from 'react';
import { ClipboardList, Ellipsis, Plus } from 'lucide-react';
import type { NotebookTemplate } from '../domain/notebook';
import { t } from '../i18n';
import { NotebookTemplateGlyph } from './NotebookTemplateGlyph';
import { NOTEBOOK_TEMPLATES, notebookTemplateSurface } from './notebookTemplates';
import type { NotebookStarter } from './notebookTemplates';

export function NotebookSectionTemplates({ templates, busy, onOpen, onManage }: {
  templates: NotebookTemplate[]; busy: boolean;
  onOpen: (starter?: NotebookStarter) => void;
  onManage: (template: NotebookTemplate) => void;
}) {
  function card(id: string, name: string, icon: ReactNode, starter?: NotebookStarter, template?: NotebookTemplate) {
    return <div className="notebook-template-tile" key={id}>
      <button type="button" className="quiet-button notebook-template-card" title={name} disabled={busy}
        onClick={() => onOpen(starter)}>
        <span className="notebook-template-surface" aria-hidden="true"
          style={{ '--notebook-template-surface': notebookTemplateSurface(template?.color) } as CSSProperties}>
          {icon}
        </span>
        <span className="notebook-template-name">{name}</span>
      </button>
      {template && <button type="button" className="quiet-button notebook-template-manage"
        title={t('Manage template')} aria-label={`${t('Manage template')} · ${name}`} disabled={busy} onClick={() => onManage(template)}>
        <Ellipsis size={15} aria-hidden="true" />
      </button>}
    </div>;
  }

  return <div className="notebook-section-start">
    <div className="notebook-template-library">
      <div className="notebook-section-starters">
        {card('new', t('New note'), <Plus />)}
        {NOTEBOOK_TEMPLATES.map(template => {
          const name = t(template.titleKey);
          return card(`builtin:${template.titleKey}`, name, <ClipboardList />, { title: name, createContent: template.createContent });
        })}
      </div>
      <section className="notebook-user-templates" aria-labelledby="notebook-user-templates-title">
        <h3 id="notebook-user-templates-title">{t('Your templates')}</h3>
        <div className="notebook-section-starters">
          {templates.map(template => card(template.id, template.name, <NotebookTemplateGlyph icon={template.icon} />,
            { title: template.name, templateId: template.id }, template))}
        </div>
      </section>
    </div>
  </div>;
}
