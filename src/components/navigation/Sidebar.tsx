import { HomeIcon, ProjectsIcon, WidgetsIcon, SettingsIcon, TrashIcon } from './Icons';
import type { ViewName } from './Icons';

interface SidebarProps {
  active: ViewName;
  onNavigate: (view: ViewName) => void;
  disabled?: boolean;
}

export function Sidebar({ active, onNavigate, disabled }: SidebarProps) {
  return (
    <nav className="sidebar" aria-label="Otium navigation">
      <button type="button" disabled={disabled} className="nav-button" aria-label="Home" title="Home" aria-current={active === 'home' ? 'page' : undefined} onClick={() => onNavigate('home')}><HomeIcon /></button>
      <button type="button" disabled={disabled} className="nav-button" aria-label="Projects" title="Projects" aria-current={active === 'projects' ? 'page' : undefined} onClick={() => onNavigate('projects')}><ProjectsIcon /></button>
      <button type="button" disabled={disabled} className="nav-button" aria-label="Widgets" title="Widgets" aria-current={active === 'widgets' ? 'page' : undefined} onClick={() => onNavigate('widgets')}><WidgetsIcon /></button>
      <button type="button" disabled={disabled} className="nav-button trash-nav" aria-label="Trash" title="Trash" aria-current={active === 'trash' ? 'page' : undefined} onClick={() => onNavigate('trash')}><TrashIcon /></button>
      <button type="button" disabled={disabled} className="nav-button settings-nav" aria-label="Settings" title="Settings" aria-current={active === 'settings' ? 'page' : undefined} onClick={() => onNavigate('settings')}><SettingsIcon /></button>
    </nav>
  );
}

