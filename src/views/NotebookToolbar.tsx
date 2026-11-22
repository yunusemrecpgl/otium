import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, ListChecks, Table2, SquareCode, Quote, Minus, Eraser, Pilcrow, Subscript, Superscript } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { notebookColorToken } from '../domain/notebookPalette';
import type { NotebookColorKind } from '../domain/notebookPalette';
import { t } from '../i18n';
import { NotebookColorOptions, NotebookColorSwatch } from './NotebookColorPalette';
import { observeNotebookPopover } from './notebookPopover';

const headingLevels = [1, 2, 3, 4, 5, 6] as const;
const fontSizes = ['12px', '14px', '16px', '18px', '20px', '24px', '32px', '40px', '48px'];
const alignments = [
  { value: 'left', label: 'Left', action: 'Align left', icon: AlignLeft },
  { value: 'center', label: 'Center', action: 'Align center', icon: AlignCenter },
  { value: 'right', label: 'Right', action: 'Align right', icon: AlignRight },
  { value: 'justify', label: 'Justified', action: 'Justify', icon: AlignJustify },
] as const;

const symbols = [
  ['Math', '± × ÷ ≠ ≈ ≤ ≥ √ ∞ ∑ ∫ π'],
  ['Greek', 'α β γ δ ε θ λ μ σ φ ω'],
  ['Arrows', '← ↑ → ↓ ↔ ⇒'],
  ['Currency', '€ $ £ ¥ ₺'],
  ['Miscellaneous', '© ® ™ ° § • …'],
] as const;

export function NotebookToolbar({ editor, fontSize, lineHeight, disabled }: { editor: Editor; fontSize: number; lineHeight: number; disabled?: boolean }) {
  const [menu, setMenu] = useState('');
  const toolbarRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (menu && toolbar && trigger && panel) return observeNotebookPopover(toolbar, trigger, panel);
  }, [menu]);

  const chain = () => editor.chain().focus();
  function action(label: string, run: () => unknown, pressed?: boolean, disabled?: boolean, glyph?: ReactNode) {
    return <button key={label} type="button" className="quiet-button" title={t(label)} aria-label={t(label)} aria-pressed={pressed}
      disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => { setMenu(''); run(); }}>{glyph ?? t(label)}</button>;
  }
  function ribbon(label: string, children: ReactNode) {
    return <div className="notebook-ribbon-group" role="group" aria-label={t(label)}>{children}</div>;
  }
  const icon = (Icon: typeof AlignLeft) => <Icon size={15} aria-hidden="true" />;
  function group(label: string, children: ReactNode, { trigger, title = t(label), compact = false, triggerClass }: {
    trigger?: ReactNode; title?: string; compact?: boolean; triggerClass?: string;
  } = {}) {
    const open = menu === label;
    return <div className="notebook-tool-menu"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMenu(current => current === label ? '' : current); }}
      onKeyDown={event => {
        if (event.key === 'Escape' && menu === label) {
          setMenu('');
          event.currentTarget.querySelector('button')?.focus();
        }
      }}>
      <button ref={open ? triggerRef : undefined} type="button" className={triggerClass ? `quiet-button ${triggerClass}` : 'quiet-button'} title={title} aria-label={title} aria-expanded={open}
        onClick={() => setMenu(current => current === label ? '' : label)}>{trigger ?? t(label)} <span aria-hidden="true">▾</span></button>
      {open && <div ref={panelRef} className={compact ? 'notebook-tool-panel notebook-tool-panel-compact' : 'notebook-tool-panel'}>{children}</div>}
    </div>;
  }

  function palette(label: string, kind: NotebookColorKind, value: unknown, setColor: (value?: string) => unknown, glyph: string) {
    return group(label, <NotebookColorOptions label={t(label)} kind={kind} value={value} preserveEditorSelection onSelect={tone => {
      setMenu('');
      setColor(tone && notebookColorToken(kind, tone));
    }} />, { trigger: <span className="notebook-color-trigger">{glyph}<NotebookColorSwatch value={value} kind={kind} /></span>, compact: true });
  }

  const { selection, storedMarks } = editor.state;
  const style = selection.empty
    ? (storedMarks ?? selection.$head.marks()).find(mark => mark.type.name === 'textStyle')?.attrs ?? {}
    : editor.getAttributes('textStyle');
  const table = editor.isActive('table');
  const block = selection.$head.parent;
  const heading = block.type.name === 'heading' ? headingLevels.find(level => block.attrs.level === level) : undefined;
  const paragraph = block.type.name === 'paragraph';
  const codeBlock = block.type.name === 'codeBlock';
  const blockLabel = heading ? `Heading ${heading}` : paragraph ? 'Paragraph' : codeBlock ? 'Code block' : 'Text structure';
  const alignmentIndex = Math.max(0, alignments.findIndex(alignment => alignment.value === block.attrs.textAlign));
  const currentAlignment = alignments[alignmentIndex];
  const nextAlignment = alignments[(alignmentIndex + 1) % alignments.length];
  const alignmentLabel = t('Current alignment: {current}. Next: {next}.', { current: t(currentAlignment.label), next: t(nextAlignment.action) });
  const explicitSize = typeof style.fontSize === 'string' && /^\d+(?:\.\d+)?px$/.test(style.fontSize) ? style.fontSize : undefined;
  const sizeLabel = `${parseFloat(explicitSize ?? String(fontSize))} px`;
  const fontSizeOptions = explicitSize && !fontSizes.includes(explicitSize)
    ? [...fontSizes.filter(size => parseFloat(size) !== parseFloat(explicitSize)), explicitSize]
      .sort((a, b) => parseFloat(a) - parseFloat(b)) : fontSizes;

  return <>
    <div ref={toolbarRef} className="notebook-toolbar notebook-ribbon" role="group" aria-label={t('Note formatting')} inert={disabled}>
      {ribbon('History', <>
        {action('Undo', () => chain().undo().run(), undefined, !editor.can().undo(), '↶')}
        {action('Redo', () => chain().redo().run(), undefined, !editor.can().redo(), '↷')}
      </>)}
      {ribbon('Text structure', <>
        {group('Text structure', <div className="notebook-heading-options" style={{ fontSize, lineHeight }}>
          {action('Paragraph', () => chain().setParagraph().run(), paragraph, undefined,
            <span className="notebook-heading-preview">{t('Paragraph')}</span>)}
          {headingLevels.map(level => action('Heading ' + level, () => chain().setHeading({ level }).run(), heading === level, undefined,
            <span className="notebook-heading-preview" data-level={level}>{t('Heading ' + level)}</span>))}
        </div>, { compact: true, trigger: heading ? `H${heading}` : paragraph ? 'P' : icon(codeBlock ? SquareCode : Pilcrow),
          title: t(blockLabel), triggerClass: 'notebook-heading-trigger' })}
        {action('Blockquote', () => chain().toggleBlockquote().run(), editor.isActive('blockquote'), undefined, icon(Quote))}
      </>)}
      {ribbon('Text formatting', <>
        {action('Bold', () => chain().toggleBold().run(), editor.isActive('bold'), undefined, <strong>B</strong>)}
        {action('Italic', () => chain().toggleItalic().run(), editor.isActive('italic'), undefined, <i>I</i>)}
        {action('Underline', () => chain().toggleUnderline().run(), editor.isActive('underline'), undefined, <u>U</u>)}
        {action('Strikethrough', () => chain().toggleStrike().run(), editor.isActive('strike'), undefined, <s>S</s>)}
        {action('Inline code', () => chain().toggleCode().run(), editor.isActive('code'), undefined, '</>')}
        {action('Superscript', () => chain().toggleSuperscript().run(), editor.isActive('superscript'), undefined, icon(Superscript))}
        {action('Subscript', () => chain().toggleSubscript().run(), editor.isActive('subscript'), undefined, icon(Subscript))}
        {action('Clear formatting', () => chain().unsetAllMarks().unsetTextAlign().clearNodes().run(), undefined, undefined, 'Tx')}
      </>)}
      {ribbon('Colors', <>
        {palette('Text color', 'color', style.color, value => (value ? chain().setColor(value) : chain().unsetColor()).run(), 'A')}
        {palette('Highlight', 'highlight', style.backgroundColor,
          value => (value ? chain().setBackgroundColor(value) : chain().unsetBackgroundColor()).run(), '▰')}
        {action('Reset colors', () => chain().unsetColor().unsetBackgroundColor().run(), undefined, undefined, icon(Eraser))}
      </>)}
      {ribbon('Typography', group('Font size', <>
        {action('Default', () => chain().unsetFontSize().run(), !explicitSize, undefined, `${t('Default')} · ${fontSize} px`)}
        {fontSizeOptions.map(size => action(`${parseFloat(size)} px`, () => chain().setFontSize(size).run(), explicitSize === size))}
      </>, { trigger: sizeLabel, title: `${t('Font size')} · ${sizeLabel}`, compact: true }))}
      {ribbon('Lists', <>
        {action('Bullet list', () => chain().toggleBulletList().run(), editor.isActive('bulletList'), undefined, icon(List))}
        {action('Ordered list', () => chain().toggleOrderedList().run(), editor.isActive('orderedList'), undefined, icon(ListOrdered))}
        {action('Checklist', () => chain().toggleTaskList().run(), editor.isActive('taskList'), undefined, icon(ListChecks))}
      </>)}
      {ribbon('Align', <button type="button" className="quiet-button" title={alignmentLabel} aria-label={alignmentLabel}
        onMouseDown={event => event.preventDefault()} onClick={() => {
          setMenu('');
          editor.commands.setTextAlign(nextAlignment.value);
        }}>{icon(currentAlignment.icon)}</button>)}
      {ribbon('Insert', <>
        {action('Table', () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), undefined, undefined, icon(Table2))}
        {action('Code block', () => chain().setCodeBlock({ language: 'plaintext' }).run(), undefined, undefined, icon(SquareCode))}
        {action('Horizontal rule', () => chain().setHorizontalRule().run(), undefined, undefined, icon(Minus))}
        {group('Symbols', symbols.map(([name, values]) => <div key={name}>
          <p>{t(name)}</p><div className="notebook-symbols">
            {values.split(' ').map(symbol => <button type="button" className="quiet-button" key={symbol}
              onMouseDown={event => event.preventDefault()} onClick={() => { setMenu(''); chain().insertContent(symbol).run(); }}>{symbol}</button>)}
          </div>
        </div>))}
      </>)}
      {table && group('Table', <>
        {action('Add row before', () => chain().addRowBefore().run())}
        {action('Add row after', () => chain().addRowAfter().run())}
        {action('Delete row', () => chain().deleteRow().run())}
        {action('Add column before', () => chain().addColumnBefore().run())}
        {action('Add column after', () => chain().addColumnAfter().run())}
        {action('Delete column', () => chain().deleteColumn().run())}
        {action('Toggle header row', () => chain().toggleHeaderRow().run())}
        {action('Merge cells', () => chain().mergeCells().run(), undefined, !editor.can().mergeCells())}
        {action('Split cell', () => chain().splitCell().run(), undefined, !editor.can().splitCell())}
        {action('Delete table', () => chain().deleteTable().run())}
      </>)}
    </div>
  </>;
}
