import { Activity, ExternalLink, ListTodo, NotebookPen, Quote, Table2, Rss, Calculator, Eye, Type } from 'lucide-react';

export function WidgetIcon({ type, size = 16 }: { type: string; size?: number }) {
  const Icon = type === 'text' ? Type : type === 'page-watch' ? Eye : type === 'formula' ? Calculator : type === 'rss' ? Rss : type === 'compare' ? Table2 : type === 'clip' ? Quote : type === 'web-data' ? Activity : type === 'resource' ? ExternalLink : type === 'todo' ? ListTodo : NotebookPen;
  return <Icon size={size} aria-hidden="true" />;
}
