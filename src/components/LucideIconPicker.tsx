import { t, useLocale } from "../i18n";
import { useState } from 'react';
import type { FolderIcon as Icon } from '../domain/folder';
import { FolderIcon } from './FolderIcon';
import { getFolderIconName, normalizeIconSearch } from '../utils/folderIcons';
import { folderIconCatalog, FOLDER_ICON_RESULT_LIMIT } from '../utils/folderIconCatalog';

export default function LucideIconPicker({ value, onChange, disabled }: { value: Icon; onChange: (icon: Icon) => void; disabled?: boolean }) {
  useLocale();
  const [query, setQuery] = useState('');
  const search = normalizeIconSearch(query);
  const selected = getFolderIconName(value);
  const matches = search ? folderIconCatalog.filter(icon => icon.search.includes(search)) : [
    ...folderIconCatalog.filter(icon => icon.id === selected || icon.id === 'folder'),
    ...folderIconCatalog.filter(icon => icon.id !== selected && icon.id !== 'folder'),
  ];
  const visible = matches.slice(0, FOLDER_ICON_RESULT_LIMIT);
  return <div className="folder-icon-search">
    <input type="search" aria-label={t("Search folder icons")} placeholder={t("Search icons…")} value={query}
      onChange={event => setQuery(event.target.value)} disabled={disabled} autoComplete="off" />
    <div className="folder-icon-picker" role="group" aria-label={t("Folder icon")}>
      {visible.map(icon => <button type="button" key={icon.id} aria-label={icon.name} title={icon.name}
        aria-pressed={selected === icon.id} disabled={disabled} onClick={() => onChange(icon.id)}><FolderIcon icon={icon.id} /></button>)}
    </div>
    {!visible.length && <p className="muted" role="status">{t("No icons found.")}</p>}
  </div>;
}
