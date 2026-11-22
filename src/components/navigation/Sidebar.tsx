import { t, useLocale } from "../../i18n";
import { HomeIcon, ProjectsIcon, WidgetsIcon, SettingsIcon, TrashIcon } from './Icons';
import type { ViewName } from './Icons';
import { NotebookPen } from 'lucide-react';

interface SidebarProps {
  active: ViewName;
  onNavigate: (view: ViewName) => void;
  disabled?: boolean;
}

export function Sidebar({ active, onNavigate, disabled }: SidebarProps) {
  useLocale();
  return (
    <nav className="sidebar" aria-label={t("Otium navigation")}>
      <button type="button" disabled={disabled} className="nav-button" data-tour-target="home" aria-label={t("Home")} title={t("Home")} aria-current={active === 'home' ? 'page' : undefined} onClick={() => onNavigate('home')}><HomeIcon /></button>
      <button type="button" disabled={disabled} className="nav-button" data-tour-target="projects" aria-label={t("Projects")} title={t("Projects")} aria-current={active === 'projects' ? 'page' : undefined} onClick={() => onNavigate('projects')}><ProjectsIcon /></button>
      <button type="button" disabled={disabled} className="nav-button" data-tour-target="notebook" aria-label={t('Notebook')} title={t('Notebook')} aria-current={active === 'notebook' ? 'page' : undefined} onClick={() => onNavigate('notebook')}><NotebookPen /></button>
      <button type="button" disabled={disabled} className="nav-button widgets-nav" data-tour-target="widgets" aria-label={t("Widgets")} title={t("Widgets")} aria-current={active === 'widgets' ? 'page' : undefined} onClick={() => onNavigate('widgets')}><WidgetsIcon /></button>
      <button type="button" disabled={disabled} className="nav-button trash-nav" aria-label={t("Trash")} title={t("Trash")} aria-current={active === 'trash' ? 'page' : undefined} onClick={() => onNavigate('trash')}><TrashIcon /></button>
      <button type="button" disabled={disabled} className="nav-button settings-nav" aria-label={t("Settings")} title={t("Settings")} aria-current={active === 'settings' ? 'page' : undefined} onClick={() => onNavigate('settings')}><SettingsIcon /></button>
      <a className="sidebar-brand" href="https://proje4.com" target="_blank" rel="noopener noreferrer" title="Proje4" aria-label="Proje4"><span className="proje4-logo" aria-hidden="true" /></a>
    </nav>
  );
}

