import { FileText } from 'lucide-react';
import { FolderIcon } from '../components/FolderIcon';
import { DEFAULT_NOTEBOOK_TEMPLATE_ICON, notebookTemplateIconName } from '../domain/notebook';

export function NotebookTemplateGlyph({ icon }: { icon?: string }) {
  const name = notebookTemplateIconName(icon);
  return name === DEFAULT_NOTEBOOK_TEMPLATE_ICON ? <FileText size={20} strokeWidth={1.6} aria-hidden="true" />
    : <FolderIcon icon={name} />;
}
