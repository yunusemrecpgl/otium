import type { FolderIcon as Icon } from '../domain/folder';
import { Folder } from 'lucide-react';
import { DynamicIcon } from 'lucide-react/dynamic';
import { getFolderIconName } from '../utils/folderIcons';
import { useCallback, useState } from 'react';

export function FolderIcon({ icon, className }: { icon: Icon; className?: string }) {
  const name = getFolderIconName(icon);
  const [loaded, setLoaded] = useState<string | null>(null);
  const resolvedRef = useCallback((node: SVGSVGElement | null) => {
    if (node) setLoaded(name);
  }, [name]);
  return <span className={`folder-icon-slot icon-content-slot${className ? ` ${className}` : ''}`}
    data-resolved={name !== 'folder' && loaded === name} aria-hidden="true">
    <span className="icon-fallback"><Folder size={20} strokeWidth={1.6} /></span>
    {name !== 'folder' && <span className="icon-resolved">
      <DynamicIcon key={name} ref={resolvedRef} name={name} size={20} strokeWidth={1.6} />
    </span>}
  </span>;
}
