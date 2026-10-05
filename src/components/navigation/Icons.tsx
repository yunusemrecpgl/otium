export type ViewName = 'home' | 'projects' | 'widgets' | 'trash' | 'settings';

export function WidgetsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="12" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 20h7" /></svg>;
}

export function TrashIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>;
}

export function HomeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9" /></svg>;
}

export function ProjectsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
}

export function SettingsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-.6 2.1-2 .9-2-.5-2 3.5 1.5 1.5v3L2.4 15l2 3.5 2-.5 2 .9L9 21h6l.6-2.1 2-.9 2 .5 2-3.5-1.5-1.5v-3L21.6 9l-2-3.5-2 .5-2-.9L15 3Z" /><circle cx="12" cy="12" r="3" /></svg>;
}
