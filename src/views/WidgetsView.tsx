import { WidgetRegistry } from '../services/widgetRegistry';
import { WidgetIcon } from '../components/widgets/WidgetIcon';

export function WidgetsView() {
  const definitions = WidgetRegistry.getAll();
  return <main className="secondary-view widgets-view">
    <h1>Widgets</h1>
    {definitions.length === 0 && <p className="muted">No widgets available yet.</p>}
    {definitions.map(definition => <p key={definition.type}><WidgetIcon type={definition.type} /> {definition.name}</p>)}
  </main>;
}

