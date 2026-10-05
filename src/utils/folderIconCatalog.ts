import dynamicIconImports from 'lucide-react/dynamicIconImports';
import { normalizeIconSearch } from './folderIcons';

// This search catalog is evaluated only when the picker is opened.
export const FOLDER_ICON_RESULT_LIMIT = 80;
export const folderIconCatalog = Object.keys(dynamicIconImports).sort().map(id => ({
  id,
  name: id.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(''),
  search: normalizeIconSearch(id),
}));
