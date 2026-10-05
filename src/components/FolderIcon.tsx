import type { FolderIcon as Icon } from '../domain/folder';
import { Folder } from 'lucide-react';
import { DynamicIcon } from 'lucide-react/dynamic';
import { getFolderIconName } from '../utils/folderIcons';

export function FolderIcon({ icon, className }: { icon: Icon; className?: string }) {
  const name = getFolderIconName(icon);
  const fallback = () => <Folder className={className} size={20} strokeWidth={1.6} aria-hidden="true" />;
  if (name === 'folder') return fallback();
  return <DynamicIcon key={name} name={name} fallback={fallback} className={className} size={20} strokeWidth={1.6} aria-hidden="true" />;
}
