import type { TextConfig } from './text';
import type { PageWatchConfig } from './pageWatch';
import type { FormulaConfig } from './formula';
import type { NoteConfig } from './note';
import type { TodoConfig } from './todo';
import type { ResourceConfig } from './resource';
import type { WebDataConfig } from './webData';
import type { ClipConfig } from './clip';
import type { CompareConfig } from './compare';
import type { RssConfig } from './rss';

export type ProjectWidgetType = 'note' | 'todo' | 'resource' | 'web-data' | 'clip' | 'compare' | 'rss' | 'formula' | 'page-watch' | 'text';
export type ProjectWidgetConfig = NoteConfig | TodoConfig | ResourceConfig | WebDataConfig | ClipConfig | CompareConfig | RssConfig | FormulaConfig | PageWatchConfig | TextConfig;
export type InspectorWidgetConfig = TextConfig | NoteConfig | TodoConfig | WebDataConfig;
