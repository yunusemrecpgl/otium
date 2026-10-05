import { t, useLocale } from "../i18n";
import { lazy, Suspense } from 'react';
import type { FolderIcon as Icon } from '../domain/folder';
import { PROJECT_COLORS } from '../domain/projectColor';
import type { ProjectColor } from '../domain/projectColor';

const LucideIconPicker = lazy(() => import('./LucideIconPicker'));

export function FolderIconPicker({ value, onChange, disabled }: { value: Icon; onChange: (icon: Icon) => void; disabled?: boolean }) {
  useLocale();
  return <Suspense fallback={<p className="muted" role="status">{t("Loading icons…")}</p>}>
    <LucideIconPicker value={value} onChange={onChange} disabled={disabled} />
  </Suspense>;
}
export function FolderColorPicker({ value, onChange, disabled }: { value: ProjectColor; onChange: (color: ProjectColor) => void; disabled?: boolean }) {
  useLocale();
  return <div className="folder-color-picker" role="group" aria-label={t("Folder color")}>
    {PROJECT_COLORS.map(color => <button type="button" key={color} className="project-color-swatch" data-project-color={color} aria-label={t(color)} aria-pressed={value === color} disabled={disabled} onClick={() => onChange(color)} />)}
  </div>;
}
