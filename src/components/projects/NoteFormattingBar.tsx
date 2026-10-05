import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, PaintBucket, ALargeSmall } from 'lucide-react';
import { readNoteConfig } from '../../domain/note';
import { readTodoConfig } from '../../domain/todo';
import { normalizeTextStyle, readTextConfig } from '../../domain/text';
import type { TextStyle } from '../../domain/text';
import { FONT_SIZES, isFontSizeToken, nearestFontSize } from '../../domain/typography';
import { useInspectorWidgetEditor } from '../../hooks/useInspectorWidgetEditor';
import { InspectorPalette } from './InspectorControls';
import type { ProjectInspectorProps } from './ProjectInspector';
import { clampFloating, floatingBounds } from './floatingBounds';

type FormattingProps = Pick<ProjectInspectorProps, 'instance' | 'disabled' | 'onUpdate' | 'onPreview'>;
export function NoteFormattingBar({ instance, disabled, onUpdate, onPreview }: FormattingProps) {
  const { config, latest, error, edit } = useInspectorWidgetEditor(instance!, readNoteConfig, onUpdate, onPreview);
  return <FormattingControls name="Note" style={config.style ?? {}} disabled={disabled} error={error} listStyle={config.listStyle ?? 'none'}
    onStyle={patch => edit({ style: normalizeTextStyle({ ...latest.current.style, ...patch }) })}
    onCycleList={() => edit({ listStyle: config.listStyle === 'bullet' ? 'numbered' : config.listStyle === 'numbered' ? 'none' : 'bullet' })} />;
}
export function TodoFormattingBar({ instance, disabled, onUpdate, onPreview }: FormattingProps) {
  const { config, latest, error, edit } = useInspectorWidgetEditor(instance!, readTodoConfig, onUpdate, onPreview);
  return <FormattingControls name="Todo" style={config.style ?? {}} disabled={disabled} error={error} allowStrike={false}
    onStyle={patch => edit({ style: normalizeTextStyle({ ...latest.current.style, ...patch }) })} />;
}
export function TextFormattingBar({ instance, disabled, onUpdate, onPreview }: FormattingProps) {
  const { config, latest, error, edit } = useInspectorWidgetEditor(instance!, readTextConfig, onUpdate, onPreview);
  return <FormattingControls name="Text / Label" style={config.style ?? {}} disabled={disabled} error={error}
    onStyle={patch => edit({ style: normalizeTextStyle({ ...latest.current.style, ...patch }) })} />;
}
export function FormattingControls({ name, style, disabled, error, listStyle, onCycleList, allowStrike = true, basic = false, extraControls, presentationControls, cycleAlignment = false, onStyle: changeStyle }: {
  name: string; style: TextStyle; disabled: boolean; error: boolean;
  listStyle?: 'none' | 'bullet' | 'numbered'; onCycleList?: () => void; allowStrike?: boolean; basic?: boolean; extraControls?: ReactNode; presentationControls?: ReactNode; cycleAlignment?: boolean; onStyle: (patch: Partial<TextStyle>) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<'textColor' | 'backgroundColor' | 'alignment' | 'family' | 'size' | null>(null);
  const palette = menu === 'textColor' || menu === 'backgroundColor' ? menu : null;
  useLayoutEffect(() => {
    const popup = root.current?.querySelector<HTMLElement>('[data-floating-menu-content]');
    const panel = root.current?.closest('.compact-floating-inspector');
    if (!popup) return;
    const place = () => {
      const usable = floatingBounds();
      popup.style.maxHeight = `${Math.max(1, usable.bottom - usable.top)}px`;
      popup.style.maxWidth = `${Math.max(1, usable.right - usable.left)}px`;
      popup.style.transform = '';
      const rect = popup.getBoundingClientRect();
      const bar = root.current!.getBoundingClientRect();
      const preferredTop = rect.bottom > usable.bottom && bar.top - rect.height - 12 >= usable.top
        ? bar.top - rect.height - 12 : rect.top;
      const x = clampFloating(rect.left, usable.left, usable.right - rect.width) - rect.left;
      const y = clampFloating(preferredTop, usable.top, usable.bottom - rect.height) - rect.top;
      popup.style.transform = `translate(${x}px, ${y}px)`;
    };
    place();
    const resize = new ResizeObserver(place);
    resize.observe(root.current!); resize.observe(popup);
    const changes = new MutationObserver(place);
    if (panel) {
      changes.observe(panel, { attributes: true, attributeFilter: ['style', 'data-shown'] });
      panel.addEventListener('transitionend', place);
    }
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      resize.disconnect(); changes.disconnect(); panel?.removeEventListener('transitionend', place);
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const outside = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || !root.current?.contains(target) ||
        (!target.closest('[data-floating-menu-content]') && target.closest('[data-floating-menu]')?.getAttribute('data-floating-menu') !== menu)) setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setMenu(null); }
    };
    document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape, true); };
  }, [menu]);
  const toggles = [{ key: 'bold', name: 'Bold', Icon: Bold }, { key: 'italic', name: 'Italic', Icon: Italic },
    { key: 'underline', name: 'Underline', Icon: Underline }, { key: 'strike', name: 'Strikethrough', Icon: Strikethrough }] as const;
  const Alignment = style.textAlign === 'center' ? AlignCenter : style.textAlign === 'right' ? AlignRight : AlignLeft;
  const ListIcon = listStyle === 'numbered' ? ListOrdered : List;
  return <div ref={root} className="note-format-bar" role="toolbar" aria-label={`${name} formatting`}>
    <div className="note-format-group">
      {(['textColor', 'backgroundColor'] as const).map(key => {
        const Icon = key === 'textColor' ? ALargeSmall : PaintBucket;
        const label = key === 'textColor' ? 'Text color' : 'Background color';
        return <button key={key} data-floating-menu={key} type="button" className="quiet-button" title={label} aria-label={label} aria-expanded={palette === key}
          aria-pressed={palette === key} disabled={disabled} onClick={() => setMenu(current => current === key ? null : key)}>
          <Icon size={16} style={{ color: style[key] ? `var(--palette-${style[key]}-dot)` : undefined }} />
        </button>;
      })}
    </div>
    <div className="note-format-group">
      <select data-floating-menu="family" onFocus={() => setMenu('family')} onPointerDown={() => setMenu('family')} aria-label="Font family" value={style.fontFamily ?? 'sans'} disabled={disabled}
        onChange={event => { changeStyle({ fontFamily: event.target.value as TextStyle['fontFamily'] }); setMenu(null); }}>
        <option value="sans">Sans</option><option value="mono">Mono</option><option value="serif">Serif</option>
      </select>
      <select data-floating-menu="size" onFocus={() => setMenu('size')} onPointerDown={() => setMenu('size')} aria-label="Font size" value={nearestFontSize(style.fontSize ?? 13)} disabled={disabled}
        onChange={event => { if (isFontSizeToken(event.target.value)) changeStyle({ fontSize: event.target.value }); setMenu(null); }}>
        {Object.entries(FONT_SIZES).map(([token, size]) => <option key={token} value={token}>{size.label}</option>)}
      </select>
    </div>
    {extraControls}
    {!basic && <div className="note-format-group">
      {toggles.filter(toggle => allowStrike || toggle.key !== 'strike').map(({ key, name, Icon }) => <button key={key} type="button" className="quiet-button" title={name} aria-label={name}
        aria-pressed={!!style[key]} disabled={disabled} onClick={() => changeStyle({ [key]: !style[key] })}><Icon size={16} /></button>)}
    </div>}
    {!basic && <div className="note-format-group">
      {onCycleList && <button type="button" className="quiet-button" title={`List style: ${listStyle ?? 'none'}`} aria-label={`List style: ${listStyle ?? 'none'}`}
        aria-pressed={!!listStyle && listStyle !== 'none'} disabled={disabled}
        onClick={onCycleList}><ListIcon size={16} /></button>}
      {presentationControls}
      <button data-floating-menu={cycleAlignment ? undefined : "alignment"} type="button" className="quiet-button" aria-label="Text alignment" title="Text alignment"
        aria-expanded={cycleAlignment ? undefined : menu === 'alignment'} disabled={disabled} onClick={() => {
          if (cycleAlignment) { setMenu(null); changeStyle({ textAlign: style.textAlign === 'left' || !style.textAlign ? 'center' : style.textAlign === 'center' ? 'right' : 'left' }); }
          else setMenu(current => current === 'alignment' ? null : 'alignment');
        }}><Alignment size={16} /></button>
    </div>}
    {palette && <div data-floating-menu-content className="note-format-palette" role="dialog" aria-label={palette === 'textColor' ? 'Text color' : 'Background color'}>
      <InspectorPalette label={palette === 'textColor' ? 'Text color' : 'Background color'} value={style[palette]} disabled={disabled}
        onChange={value => changeStyle({ [palette]: value })} />
    </div>}
    {menu === 'alignment' && <div data-floating-menu-content className="note-format-palette note-format-alignment-menu" role="group" aria-label="Text alignment">
      {([{ value: 'left', Icon: AlignLeft }, { value: 'center', Icon: AlignCenter }, { value: 'right', Icon: AlignRight }] as const).map(({ value, Icon }) =>
        <button key={value} type="button" className="quiet-button" title={`Align ${value}`} aria-label={`Align ${value}`}
          aria-pressed={(style.textAlign ?? 'left') === value} disabled={disabled} onClick={() => { changeStyle({ textAlign: value }); setMenu(null); }}><Icon size={16} /></button>)}
    </div>}
    {error && <span className="note-format-error form-error" role="alert">{name} could not be saved.</span>}
  </div>;
}
