import dynamicIconImports from 'lucide-react/dynamicIconImports';

function iconId(name: string): string {
  return name.replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2').toLowerCase();
}

export type LucideIconName = keyof typeof dynamicIconImports;
// Only names and lazy import functions are included here, never icon SVG data.
// Ignoring separators also resolves identifiers saved by the earlier registry.
const names = new Map(Object.keys(dynamicIconImports).map(name => [
  normalizeIconSearch(name), name as LucideIconName,
]));

const legacyIcons: Record<string, string> = {
  folder: 'folder', briefcase: 'briefcase', code: 'code', book: 'book',
  star: 'star', heart: 'heart', music: 'music', image: 'image', game: 'gamepad-2',
  shopping: 'shopping-bag', chart: 'chart-column', finance: 'chart-column',
  school: 'school', travel: 'send', home: 'house', tools: 'wrench', bookmark: 'bookmark',
};

export function normalizeFolderIcon(value: string): string {
  const id = iconId(value.trim().replace(/\s+/g, '-'));
  const resolved = Object.hasOwn(legacyIcons, id) ? legacyIcons[id] : id;
  return names.has(normalizeIconSearch(resolved)) ? resolved : 'folder';
}

export function isFolderIcon(value: string): boolean {
  const id = iconId(value.trim().replace(/\s+/g, '-'));
  return names.has(normalizeIconSearch(id)) || Object.hasOwn(legacyIcons, id);
}

export function getFolderIconName(value: string): LucideIconName {
  return names.get(normalizeIconSearch(normalizeFolderIcon(value))) ?? 'folder';
}

export function normalizeIconSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z\d]/g, '');
}

