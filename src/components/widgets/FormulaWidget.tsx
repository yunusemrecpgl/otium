import { useProjectQuickActions } from '../../hooks/useProjectQuickActions';
import type { RegisterProjectQuickActions } from '../projects/ProjectContextToolbar';
import { FormattingControls } from '../projects/NoteFormattingBar';
import { normalizeTextStyle } from '../../domain/text';
import { fontSizePixels } from '../../domain/typography';
import { widgetSurface, widgetTextColor, widgetContentScale } from './widgetAppearance';
import { WidgetInspectorPortal } from '../projects/WidgetInspectorPortal';
import { useLayoutEffect, useRef, useState } from 'react';
import { useWidgetDraftPersistence } from '../../hooks/useWidgetDraftPersistence';
import { Calculator, X } from 'lucide-react';
import type { WidgetInstance } from '../../domain/widget';
import { defaultFormulaConfig, isFormulaConfig } from '../../domain/formula';
import type { FormulaConfig, FormulaVariable } from '../../domain/formula';
import { evaluateFormula } from '../../services/formula';

export default function FormulaWidget({ instance, disabled, onUpdate, inspectorTarget, onQuickActions }: {
  instance: WidgetInstance; disabled: boolean;
  onUpdate: (id: string, config: FormulaConfig) => Promise<void>;
  inspectorTarget?: HTMLElement | null;
  onQuickActions?: RegisterProjectQuickActions;
}) {
  const { config, latest, error: saveError, flush, replace: edit } = useWidgetDraftPersistence<FormulaConfig>({
    value: isFormulaConfig(instance.config) ? instance.config : defaultFormulaConfig(),
    save: config => onUpdate(instance.id, config), errorMessage: 'Formula could not be saved.',
  });
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});
  const expressionEditor = useRef<HTMLInputElement | null>(null);
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !expressionEditor.current) return;
    expressionEditor.current.focus(); expressionEditor.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [config.expression, inspectorTarget]);
  function editVariable(id: string, patch: Partial<FormulaVariable>) {
    edit({ ...latest.current, variables: latest.current.variables.map(variable => variable.id === id ? { ...variable, ...patch } : variable) });
  }
  let result: string | null = null, error: string | null = null;
  try {
    if (config.variables.some(variable => {
      const draft = numericDrafts[variable.id];
      return draft !== undefined && (!draft.trim() || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(draft.trim()) || !Number.isFinite(Number(draft)));
    })) throw new Error('Enter a valid numeric value.');
    result = evaluateFormula(config.expression, config.variables);
  } catch (cause) { error = cause instanceof Error ? cause.message : 'Expression could not be calculated.'; }

  function insertExpression(text: string, caretOffset = text.length) {
    const expression = latest.current.expression;
    const start = expressionEditor.current?.selectionStart ?? expression.length;
    const end = expressionEditor.current?.selectionEnd ?? start;
    pendingCaret.current = start + caretOffset;
    edit({ ...latest.current, expression: expression.slice(0, start) + text + expression.slice(end) });
  }
  const appearance = normalizeTextStyle(config.style);
  const contentTypography = widgetContentScale(appearance);
  const variableEditors = (inspector = false) => <>      <div className="formula-variables">
        {config.variables.map((variable, index) => <div className="formula-variable" key={variable.id}>
          {inspector && <button type="button" className="quiet-button formula-insert-variable" title={'Insert ' + variable.name} aria-label={'Insert ' + variable.name}
            disabled={disabled || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable.name)} onClick={() => insertExpression(variable.name)}>↗</button>}
          <input spellCheck={false} aria-label={`Variable ${index + 1} name`} style={inspector ? undefined : contentTypography} title={variable.name} value={variable.name} disabled={disabled}
            onBlur={flush} onChange={event => editVariable(variable.id, { name: event.target.value })} />
          <input spellCheck={false} type="text" inputMode="decimal" aria-label={`Variable ${index + 1} value`} style={inspector ? undefined : contentTypography} disabled={disabled}
            value={numericDrafts[variable.id] ?? String(variable.value)} onChange={event => {
              const draft = event.target.value;
              setNumericDrafts(previous => ({ ...previous, [variable.id]: draft }));
              if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(draft.trim()) && Number.isFinite(Number(draft))) {
                editVariable(variable.id, { value: Number(draft) });
              }
            }} onBlur={flush} />
          <button type="button" className="compare-remove" aria-label={`Remove variable ${index + 1}`} disabled={disabled} onClick={() => {
            setNumericDrafts(previous => { const next = { ...previous }; delete next[variable.id]; return next; });
            edit({ ...latest.current, variables: latest.current.variables.filter(entry => entry.id !== variable.id) });
          }}><X size={12} aria-hidden="true" /></button>
        </div>)}
      </div>
      <button type="button" className="text-button" disabled={disabled} onClick={() => {
        const names = new Set(latest.current.variables.map(variable => variable.name));
        let index = latest.current.variables.length + 1;
        while (names.has(`variable${index}`)) index++;
        edit({ ...latest.current, variables: [...latest.current.variables, { id: crypto.randomUUID(), name: `variable${index}`, value: 0 }] });
      }}>+ Variable</button>
</>;
  useProjectQuickActions(instance.id, onQuickActions, { snapshot: () => latest.current });
  return <div className="note-widget formula-widget" style={widgetSurface(appearance)}>
    <header className="note-widget-header">
      <Calculator size={16} style={{ width: 16, height: 16 }} aria-hidden="true" />
      <input spellCheck={false} aria-label="Formula title" value={config.title} style={widgetTextColor(appearance)} disabled={disabled} onBlur={flush}
        onChange={event => edit({ ...latest.current, title: event.target.value })} />
    </header>
    <div className="formula-body">
      <input spellCheck={false} className="formula-expression" style={contentTypography} aria-label="Arithmetic expression" placeholder="price * quantity" value={config.expression}
        disabled={disabled} onBlur={flush} onChange={event => edit({ ...latest.current, expression: event.target.value })} />
      {variableEditors()}
      <div className="formula-result" style={contentTypography} aria-live="polite">
        <span className="muted" style={{ ...contentTypography, opacity: .7 }}>Result</span>
        {error ? <p className="muted" role="status">{error}</p> : <output title={result ?? ''} style={{ ...contentTypography, fontSize: Math.round(fontSizePixels(appearance.fontSize, 16)! * 1.375), fontWeight: 600 }}>{result}</output>}
      </div>
      <WidgetInspectorPortal target={inspectorTarget}>
        <div className="clip-format-cluster formula-format-cluster">
          <div className="formula-builder" role="group" aria-label="Formula Builder">
            <span className="muted">Formula Builder</span>
            {['sqrt', 'pow', 'log', 'mod'].map(name => <button key={name} type="button" className="quiet-button" title={'Insert ' + name} disabled={disabled}
              onClick={() => insertExpression(name + (name === 'pow' || name === 'mod' ? '(, )' : '()'), name.length + 1)}>{name}()</button>)}
          </div>
          <label className="clip-format-source">Expression
            <input ref={expressionEditor} spellCheck={false} aria-label="Formula expression" value={config.expression} disabled={disabled}
              onBlur={flush} onChange={event => edit({ ...latest.current, expression: event.target.value })} />
          </label>
          <div className="formula-inspector-variables" role="group" aria-label="Variables">
            <span className="muted">Variables</span>
            {variableEditors(true)}
          </div>
          <FormattingControls name="Formula" basic style={appearance} disabled={disabled} error={!!saveError}
            onStyle={patch => edit({ ...latest.current, style: normalizeTextStyle({ ...latest.current.style, ...patch }) })} />
        </div>
      </WidgetInspectorPortal>
      {saveError && <p className="form-error" role="alert">{saveError}</p>}
    </div>
  </div>;
}



