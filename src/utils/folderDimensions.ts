import type { Folder } from '../domain/folder';
import { widthForHomeSpan } from './homeLayout';

export function getFolderWidthTier(name: string, itemSize: number): 1 | 2 {
  if (!name.trim()) return 1;
  return Array.from(name).length * 8 + 48 <= itemSize ? 1 : 2;
}
export function getFolderDimensions(folder: Pick<Folder, 'name'>, itemSize: number) {
  return { width: widthForHomeSpan(itemSize, getFolderWidthTier(folder.name, itemSize)), height: itemSize };
}
