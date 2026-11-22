import type { NotebookNode, NotebookTemplate } from '../domain/notebook';
import { notebookColorToken } from '../domain/notebookPalette';
import type { NotebookColorTone } from '../domain/notebookPalette';
import { t } from '../i18n';

export type NotebookStarter =
  | { title: string; createContent: () => NotebookNode }
  | { title: string; templateId: string };

type TemplateDetails = Pick<NotebookTemplate, 'name' | 'icon' | 'color'>;

export type NotebookTemplateChange =
  | { kind: 'save'; pageId: string; name: string; icon: string; color?: NotebookColorTone }
  | ({ kind: 'edit'; id: string; original: TemplateDetails } & TemplateDetails)
  | { kind: 'delete'; id: string };

export const NOTEBOOK_TEMPLATE_DEFAULT_SURFACE = 'var(--palette-neutral-surface)';
export const notebookTemplateSurface = (tone?: NotebookColorTone) =>
  tone ? notebookColorToken('highlight', tone) : NOTEBOOK_TEMPLATE_DEFAULT_SURFACE;

const text = (key: string): NotebookNode => ({ type: 'text', text: t(key) });
const heading = (level: number, key: string): NotebookNode => ({ type: 'heading', attrs: { level }, content: [text(key)] });

export const NOTEBOOK_TEMPLATES = [{
  titleKey: 'Meeting Notes',
  createContent: (): NotebookNode => ({ type: 'doc', content: [
    heading(1, 'Meeting Notes'),
    heading(2, 'Agenda'),
    { type: 'bulletList', content: [{ type: 'listItem', content: [
      { type: 'paragraph', content: [text('Discussion topic')] },
    ] }] },
    heading(2, 'Notes'),
    { type: 'paragraph' },
    heading(2, 'Action Items'),
    { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [
      { type: 'paragraph', content: [text('Follow-up task')] },
    ] }] },
  ] }),
}];
