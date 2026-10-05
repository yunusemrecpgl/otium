import { TEXT_DEFINITION } from '../domain/text';
import { PAGE_WATCH_DEFINITION } from '../domain/pageWatch';
import { FORMULA_DEFINITION } from '../domain/formula';
import type { WidgetDefinition, WidgetCapabilityMetadata } from '../domain/widget';
import { NOTE_DEFINITION } from '../domain/note';
import { TODO_DEFINITION } from '../domain/todo';
import { RESOURCE_DEFINITION } from '../domain/resource';
import { WEB_DATA_DEFINITION } from '../domain/webData';
import { CLIP_DEFINITION } from '../domain/clip';
import { COMPARE_DEFINITION } from '../domain/compare';
import { RSS_DEFINITION } from '../domain/rss';

type RegisteredWidget = WidgetDefinition & WidgetCapabilityMetadata;
const metadata: Record<string, WidgetCapabilityMetadata> = {
  note: { description: 'Write lightweight notes directly on your Project canvas.', defaultEnabled: true, requiredCapabilities: [], optionalCapabilities: [] },
  todo: { description: 'Track tasks and completion inside a Project.', defaultEnabled: true, requiredCapabilities: [], optionalCapabilities: [] },
  text: { description: 'Add headings, labels and lightweight text blocks.', defaultEnabled: true, requiredCapabilities: [], optionalCapabilities: [] },
  clip: { description: 'Capture selected text from the current page and keep its source.', defaultEnabled: false, requiredCapabilities: ['active-page-capture'], optionalCapabilities: ['favicon'] },
  compare: { description: 'Compare structured values in a simple editable table.', defaultEnabled: true, requiredCapabilities: [], optionalCapabilities: [] },
  resource: { description: 'Keep a link and label with an optional date-based countdown.', defaultEnabled: true, requiredCapabilities: [], optionalCapabilities: ['favicon'] },
  'web-data': { description: 'Read selected values from a JSON endpoint.', defaultEnabled: true, requiredCapabilities: [], optionalCapabilities: ['external-source', 'favicon'], sourceAccess: 'per-origin' },
  'page-watch': { description: 'Monitor selected values from web pages or direct data sources.', defaultEnabled: true, requiredCapabilities: [], optionalCapabilities: ['external-source', 'scripting', 'favicon'], sourceAccess: 'per-origin', modeCapabilities: { rendered: ['scripting'] } },
  formula: { description: 'Calculate values using variables and safe formulas.', defaultEnabled: true, requiredCapabilities: [], optionalCapabilities: [] },
  rss: { description: 'Follow RSS or Atom feeds inside a Project.', defaultEnabled: true, requiredCapabilities: [], optionalCapabilities: ['external-source'], sourceAccess: 'per-origin' },
};
// Registry order also drives Project creation menus. No renderer imports.
const definitions: readonly RegisteredWidget[] = Object.freeze([
  NOTE_DEFINITION, TODO_DEFINITION, TEXT_DEFINITION, CLIP_DEFINITION, COMPARE_DEFINITION,
  RESOURCE_DEFINITION, WEB_DATA_DEFINITION, PAGE_WATCH_DEFINITION, FORMULA_DEFINITION, RSS_DEFINITION,
].map(definition => Object.freeze({ ...definition, ...metadata[definition.type] })));

// Metadata only: importing this registry never imports widget implementations.
export const WidgetRegistry = Object.freeze({
  getAll(): readonly RegisteredWidget[] {
    return definitions;
  },
  get(type: string): RegisteredWidget | undefined {
    return definitions.find(definition => definition.type === type);
  },
});
