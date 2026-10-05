import { GRID_SIZE } from '../constants/grid';

export type Theme = 'light' | 'dark';
export type ThemePreference = 'system' | Theme;

export interface AppearanceSettings {
  itemSize: number;
  theme: ThemePreference;
}

export interface UserSettings {
  appearance: AppearanceSettings;
}

export const ITEM_SIZE_MIN_MULTIPLIER = 1;
export const ITEM_SIZE_DEFAULT_MULTIPLIER = 4;
export const ITEM_SIZE_MAX_MULTIPLIER = 6;
export const ITEM_SIZE_MIN = GRID_SIZE * ITEM_SIZE_MIN_MULTIPLIER;
export const ITEM_SIZE_MAX = GRID_SIZE * ITEM_SIZE_MAX_MULTIPLIER;
export const ITEM_SIZE_STEP = GRID_SIZE;
export const DEFAULT_ITEM_SIZE = GRID_SIZE * ITEM_SIZE_DEFAULT_MULTIPLIER;

export function normalizeItemSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_ITEM_SIZE;
  const multiplier = Math.round(value / GRID_SIZE);
  return Math.min(ITEM_SIZE_MAX, Math.max(ITEM_SIZE_MIN, multiplier * GRID_SIZE));
}

export const DEFAULT_SETTINGS: UserSettings = {
  appearance: { itemSize: DEFAULT_ITEM_SIZE, theme: 'system' },
};
