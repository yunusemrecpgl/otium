import { TEXT_DEFINITION } from '../domain/text';
import { PAGE_WATCH_DEFINITION } from '../domain/pageWatch';
import { FORMULA_DEFINITION } from '../domain/formula';
import type { WidgetDefinition } from '../domain/widget';
import { NOTE_DEFINITION } from '../domain/note';
import { TODO_DEFINITION } from '../domain/todo';
import { RESOURCE_DEFINITION } from '../domain/resource';
import { WEB_DATA_DEFINITION } from '../domain/webData';
import { CLIP_DEFINITION } from '../domain/clip';
import { COMPARE_DEFINITION } from '../domain/compare';
import { RSS_DEFINITION } from '../domain/rss';

const definitions: readonly WidgetDefinition[] = Object.freeze([NOTE_DEFINITION, TODO_DEFINITION, RESOURCE_DEFINITION, WEB_DATA_DEFINITION, CLIP_DEFINITION, COMPARE_DEFINITION, RSS_DEFINITION, FORMULA_DEFINITION, PAGE_WATCH_DEFINITION, TEXT_DEFINITION]);

// Metadata only: importing this registry never imports widget implementations.
export const WidgetRegistry = Object.freeze({
  getAll(): readonly WidgetDefinition[] {
    return definitions;
  },
  get(type: string): WidgetDefinition | undefined {
    return definitions.find(definition => definition.type === type);
  },
});
