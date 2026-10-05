import { useProjectQuickActions } from '../../hooks/useProjectQuickActions';
import type { RegisterProjectQuickActions } from '../projects/ProjectContextToolbar';
import { WidgetInspectorPortal } from '../projects/WidgetInspectorPortal';
import { FormattingControls } from '../projects/NoteFormattingBar';
import { normalizeTextStyle } from '../../domain/text';
import { widgetSurface, widgetTypography, widgetContentScale } from './widgetAppearance';
import { useLayoutEffect, useRef } from 'react';
import { useWidgetDraftPersistence } from '../../hooks/useWidgetDraftPersistence';
import { Table2, X, Rows3, Columns3, Grid2X2, Square } from 'lucide-react';
import type { WidgetInstance } from '../../domain/widget';
import { defaultCompareConfig, isCompareConfig } from '../../domain/compare';
import type { CompareConfig, CompareGridMode } from '../../domain/compare';

export default function CompareWidget({ instance, disabled, onUpdate, inspectorTarget, onQuickActions }: {
  instance: WidgetInstance;
  disabled: boolean;
  onUpdate: (id: string, config: CompareConfig) => Promise<void>;
  inspectorTarget?: HTMLElement | null;
  onQuickActions?: RegisterProjectQuickActions;
}) {
  const { config, latest, error, flush, replace: edit } = useWidgetDraftPersistence<CompareConfig>({
    value: isCompareConfig(instance.config) ? instance.config : defaultCompareConfig(),
    save: config => onUpdate(instance.id, config), errorMessage: 'Compare could not be saved.',
  });
  const editors = useRef(new Map<string, HTMLInputElement>());
  const pendingFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const editor = editors.current.get(pendingFocus.current);
    if (editor) { editor.focus(); editor.select(); pendingFocus.current = null; }
  }, [config.columns, config.rows]);
  function removeColumn(id: string) {
    if (latest.current.columns.length <= 1) return;
    edit({ ...latest.current, columns: latest.current.columns.filter(column => column.id !== id),
      rows: latest.current.rows.map(row => ({ ...row, values: Object.fromEntries(Object.entries(row.values).filter(([key]) => key !== id)) })) });
  }
  function addColumn() {
        const column = { id: crypto.randomUUID(), title: `Column ${latest.current.columns.length + 1}` };
        pendingFocus.current = column.id;
        edit({ ...latest.current, columns: [...latest.current.columns, column],
          rows: latest.current.rows.map(row => ({ ...row, values: { ...row.values, [column.id]: '' } })) });
      
  }
  function addRow() {
        const id = crypto.randomUUID(); pendingFocus.current = id;
        edit({ ...latest.current, rows: [...latest.current.rows, { id, label: `Row ${latest.current.rows.length + 1}`,
          values: Object.fromEntries(latest.current.columns.map(column => [column.id, ''])) }] });
      
  }
  useProjectQuickActions(instance.id, onQuickActions, { snapshot: () => latest.current });
  const appearance = normalizeTextStyle(config.style);
  const content = { ...widgetContentScale(appearance), ...widgetTypography(appearance) };
  const structural = { ...content, textAlign: 'left' as const };
  const gridModes: CompareGridMode[] = ['horizontal', 'vertical', 'both', 'none'];
  const gridMode = gridModes.includes(config.gridMode!) ? config.gridMode! : 'horizontal';
  const GridIcon = { horizontal: Rows3, vertical: Columns3, both: Grid2X2, none: Square }[gridMode];
  return <div className="note-widget compare-widget" style={widgetSurface(appearance)}>
    <header className="note-widget-header" style={widgetContentScale(appearance)}>
      <Table2 size={16} aria-hidden="true" />
      <input spellCheck={false} aria-label="Compare title" style={{ ...widgetContentScale(appearance), textAlign: 'left' }} value={config.title} disabled={disabled} onBlur={flush}
        onChange={event => edit({ ...latest.current, title: event.target.value })} />
    </header>
    <div className="compare-table-scroll">
      <table className="compare-table" data-grid-mode={gridMode} aria-label={config.title || 'Comparison table'} style={{ minWidth: (config.columns.length + 1) * 120 }}>
        <thead><tr><th scope="col" />
          {config.columns.map((column, index) => <th scope="col" key={column.id}><div className="compare-cell-controls">
            <input spellCheck={false} aria-label={`Column ${index + 1} title`} style={structural} value={column.title} disabled={disabled} onBlur={flush}
              ref={element => { if (element) editors.current.set(column.id, element); else editors.current.delete(column.id); }}
              onChange={event => edit({ ...latest.current, columns: latest.current.columns.map(entry => entry.id === column.id ? { ...entry, title: event.target.value } : entry) })} />
            <button type="button" className="compare-remove" aria-label={`Remove column ${index + 1}`} disabled={disabled || config.columns.length <= 1}
              onClick={() => removeColumn(column.id)}><X size={12} aria-hidden="true" /></button>
          </div></th>)}
        </tr></thead>
        <tbody>{config.rows.map((row, rowIndex) => <tr key={row.id}>
          <th scope="row"><div className="compare-cell-controls">
            <input spellCheck={false} aria-label={`Row ${rowIndex + 1} label`} style={structural} value={row.label} disabled={disabled} onBlur={flush}
              ref={element => { if (element) editors.current.set(row.id, element); else editors.current.delete(row.id); }}
              onChange={event => edit({ ...latest.current, rows: latest.current.rows.map(entry => entry.id === row.id ? { ...entry, label: event.target.value } : entry) })} />
            <button type="button" className="compare-remove" aria-label={`Remove row ${rowIndex + 1}`} disabled={disabled || config.rows.length <= 1}
              onClick={() => { if (latest.current.rows.length > 1) edit({ ...latest.current, rows: latest.current.rows.filter(entry => entry.id !== row.id) }); }}>
              <X size={12} aria-hidden="true" />
            </button>
          </div></th>
          {config.columns.map((column, columnIndex) => <td key={column.id} style={{ textAlign: appearance.textAlign ?? 'left' }}>
            <input spellCheck={false} aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`} style={content} value={row.values[column.id]} disabled={disabled} onBlur={flush}
              onChange={event => edit({ ...latest.current, rows: latest.current.rows.map(entry => entry.id === row.id
                ? { ...entry, values: { ...entry.values, [column.id]: event.target.value } } : entry) })} />
          </td>)}
        </tr>)}</tbody>
      </table>
    </div>
    <div className="compare-actions">
      <button type="button" className="text-button" disabled={disabled} onClick={addColumn}>+ Column</button>
      <button type="button" className="text-button" disabled={disabled} onClick={addRow}>+ Row</button>
    </div>
    <WidgetInspectorPortal target={inspectorTarget}>
      <FormattingControls name="Compare" style={appearance} disabled={disabled} error={!!error} cycleAlignment
        onStyle={patch => edit({ ...latest.current, style: normalizeTextStyle({ ...latest.current.style, ...patch }) })}
        presentationControls={<button type="button" className="quiet-button" title={'Grid: ' + gridMode} aria-label={'Grid: ' + gridMode}
          disabled={disabled} onClick={() => edit({ ...latest.current, gridMode: gridModes[(gridModes.indexOf(gridMode) + 1) % gridModes.length] })}>
          <GridIcon size={16} aria-hidden="true" />
        </button>} />
    </WidgetInspectorPortal>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}



