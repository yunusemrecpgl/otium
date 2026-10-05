import { t, useLocale } from "../../i18n";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, PaintBucket, ALargeSmall, ChevronDown } from 'lucide-react';
import { readNoteConfig } from '../../domain/note';
import { readTodoConfig } from '../../domain/todo';
import { normalizeTextStyle, readTextConfig } from '../../domain/text';
import type { TextStyle } from '../../domain/text';
import { FONT_SIZES, isFontSizeToken, nearestFontSize } from '../../domain/typography';
import { useInspectorWidgetEditor } from '../../hooks/useInspectorWidgetEditor';
import { InspectorPalette, AlignmentCycle } from './InspectorControls';
import type { ProjectInspectorProps } from './ProjectInspector';
import { clampFloating, floatingBounds } from './floatingBounds';

type FormattingProps = Pick<ProjectInspectorProps, 'instance' | 'disabled' | 'onUpdate' | 'onPreview'>;
export function NoteFormattingBar({ instance, disabled, onUpdate, onPreview }: FormattingProps) {
  useLocale();
  const { config, latest, error, edit } = useInspectorWidgetEditor(instance!, readNoteConfig, onUpdate, onPreview);
  return <FormattingControls name="Note" style={config.style ?? {}} disabled={disabled} error={error} listStyle={config.listStyle ?? 'none'}
    onStyle={patch => edit({ style: normalizeTextStyle({ ...latest.current.style, ...patch }) })}
    onCycleList={() => edit({ listStyle: config.listStyle === 'bullet' ? 'numbered' : config.listStyle === 'numbered' ? 'none' : 'bullet' })} />;
}
export function TodoFormattingBar({ instance, disabled, onUpdate, onPreview }: FormattingProps) {
  useLocale();
  const { config, latest, error, edit } = useInspectorWidgetEditor(instance!, readTodoConfig, onUpdate, onPreview);
  return <FormattingControls name="Todo" style={config.style ?? {}} disabled={disabled} error={error} allowStrike={false}
    onStyle={patch => edit({ style: normalizeTextStyle({ ...latest.current.style, ...patch }) })} />;
}
export function TextFormattingBar({ instance, disabled, onUpdate, onPreview }: FormattingProps) {
  useLocale();
  const { config, latest, error, edit } = useInspectorWidgetEditor(instance!, readTextConfig, onUpdate, onPreview);
  return <FormattingControls name="Text / Label" style={config.style ?? {}} disabled={disabled} error={error}
    onStyle={patch => edit({ style: normalizeTextStyle({ ...latest.current.style, ...patch }) })} />;
}
export function FormattingControls({ name, style, disabled, error, listStyle, onCycleList, allowStrike = true, basic = false, extraControls, presentationControls, onStyle: changeStyle }: {
  name: string; style: TextStyle; disabled: boolean; error: boolean;
  listStyle?: 'none' | 'bullet' | 'numbered'; onCycleList?: () => void; allowStrike?: boolean; basic?: boolean; extraControls?: ReactNode; presentationControls?: ReactNode; onStyle: (patch: Partial<TextStyle>) => void;
}) {
  useLocale();
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<'textColor' | 'backgroundColor' | 'family' | 'size' | null>(null);
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
      popup.style.left = '';
      popup.style.top = '';
      const bar = root.current!.getBoundingClientRect();
      if (menu === 'family' || menu === 'size') {
        const trigger = root.current?.querySelector<HTMLElement>(`[data-floating-menu="${menu}"]`);
        if (trigger) {
          const anchor = trigger.getBoundingClientRect();
          popup.style.left = `${anchor.left - bar.left}px`;
          popup.style.top = `${anchor.bottom - bar.top + 8}px`;
        }
      }
      const rect = popup.getBoundingClientRect();
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
    if (menu === 'family' || menu === 'size') root.current?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]')?.focus();
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
  const ListIcon = listStyle === 'numbered' ? ListOrdered : List;
  const families = [{ value: 'sans', label: t("Sans") }, { value: 'mono', label: t("Mono") }, { value: 'serif', label: t("Serif") }];
  const sizes = Object.entries(FONT_SIZES).map(([value, size]) => ({ value, label: t(size.label) }));
  const size = nearestFontSize(style.fontSize ?? 13);
  return <div ref={root} className="note-format-bar" role="toolbar" aria-label={t("{0} formatting", { 0: t(name) })}>
    <div className="note-format-group">
      {(['textColor', 'backgroundColor'] as const).map(key => {
        const Icon = key === 'textColor' ? ALargeSmall : PaintBucket;
        const label = key === 'textColor' ? t("Text color") : t("Background color");
        return <button key={key} data-floating-menu={key} type="button" className="quiet-button" title={label} aria-label={label} aria-expanded={palette === key}
          aria-pressed={palette === key} disabled={disabled} onClick={() => setMenu(current => current === key ? null : key)}>
          <Icon size={16} style={{ color: style[key] ? `var(--palette-${style[key]}-dot)` : undefined }} />
        </button>;
      })}
    </div>
    <div className="note-format-group">
      {(['family', 'size'] as const).map(key => <button key={key} data-floating-menu={key} type="button"
        className="quiet-button inspector-select-trigger" aria-label={key === 'family' ? t("Font family") : t("Font size")} aria-haspopup="listbox"
        aria-expanded={menu === key} disabled={disabled} onClick={() => setMenu(current => current === key ? null : key)}>
        <span>{key === 'family' ? families.find(family => family.value === (style.fontFamily ?? 'sans'))?.label ?? t('Sans') : t(FONT_SIZES[size].label)}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>)}
    </div>
    {extraControls}
    {!basic && <div className="note-format-group">
      {toggles.filter(toggle => allowStrike || toggle.key !== 'strike').map(({ key, name, Icon }) => <button key={key} type="button" className="quiet-button" title={t(name)} aria-label={t(name)}
        aria-pressed={!!style[key]} disabled={disabled} onClick={() => changeStyle({ [key]: !style[key] })}><Icon size={16} /></button>)}
    </div>}
    {!basic && <div className="note-format-group">
      {onCycleList && <button type="button" className="quiet-button" title={t("List style: {0}", { 0: t(listStyle ?? 'none') })} aria-label={t("List style: {0}", { 0: t(listStyle ?? 'none') })}
        aria-pressed={!!listStyle && listStyle !== 'none'} disabled={disabled}
        onClick={onCycleList}><ListIcon size={16} /></button>}
      {presentationControls}
      <AlignmentCycle value={style.textAlign} disabled={disabled} onChange={textAlign => { setMenu(null); changeStyle({ textAlign }); }} />
    </div>}
    {palette && <div data-floating-menu-content className="note-format-palette" role="dialog" aria-label={palette === 'textColor' ? t("Text color") : t("Background color")}>
      <InspectorPalette label={palette === 'textColor' ? t("Text color") : t("Background color")} value={style[palette]} disabled={disabled}
        onChange={value => changeStyle({ [palette]: value })} />
    </div>}
    {(menu === 'family' || menu === 'size') && <div data-floating-menu-content className="note-format-palette inspector-select-menu"
      role="listbox" aria-label={menu === 'family' ? t("Font family") : t("Font size")} onKeyDown={event => {
        const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
        const index = options.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'ArrowDown' ? (index + 1) % options.length : event.key === 'ArrowUp' ? (index - 1 + options.length) % options.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : undefined;
        if (next !== undefined) { event.preventDefault(); options[next]?.focus(); }
      }}>
      {(menu === 'family' ? families : sizes).map(option => <button key={option.value} type="button" role="option"
        aria-selected={option.value === (menu === 'family' ? style.fontFamily ?? 'sans' : size)} disabled={disabled}
        onClick={() => {
          if (menu === 'family') changeStyle({ fontFamily: option.value as TextStyle['fontFamily'] });
          else if (isFontSizeToken(option.value)) changeStyle({ fontSize: option.value });
          root.current?.querySelector<HTMLButtonElement>(`[data-floating-menu="${menu}"]`)?.focus(); setMenu(null);
        }}>{t(option.label)}</button>)}
    </div>}
    {error && <span className="note-format-error form-error" role="alert">{t("{subject} could not be saved.", { subject: t(name) })}</span>}
  </div>;
}
