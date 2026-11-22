import { useEffect, useRef, useState } from 'react';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Check } from 'lucide-react';
import { useLocale, t } from '../i18n';
import { NOTEBOOK_CODE_LANGUAGES } from '../domain/notebook';

const languages = ['Plain text', 'JavaScript', 'TypeScript', 'JSON', 'HTML', 'CSS', 'Python', 'Bash', 'SQL', 'C', 'C++'];

export function NotebookCodeBlock({ node, updateAttributes }: NodeViewProps) {
  useLocale();
  const [feedback, setFeedback] = useState<'idle' | 'copied' | 'failed'>('idle');
  const mounted = useRef(false);
  const attempt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(timer.current); };
  }, []);

  async function copy() {
    const id = ++attempt.current;
    let result: 'copied' | 'failed';
    try { await navigator.clipboard.writeText(node.textContent); result = 'copied'; }
    catch { result = 'failed'; }
    if (!mounted.current || attempt.current !== id) return;
    clearTimeout(timer.current);
    setFeedback(result);
    timer.current = setTimeout(() => setFeedback('idle'), 1400);
  }

  return <NodeViewWrapper className="notebook-code-block">
    <div className="notebook-code-header" contentEditable={false}>
      <select aria-label={t('Code language')} value={node.attrs.language ?? 'plaintext'}
        onChange={event => updateAttributes({ language: event.target.value })}>
        {NOTEBOOK_CODE_LANGUAGES.map((language, index) =>
          <option key={language} value={language}>{index ? languages[index] : t('Plain text')}</option>)}
      </select>
      <button type="button" className="quiet-button" onMouseDown={event => event.preventDefault()} onClick={() => void copy()}>
        <span role="status">{feedback === 'copied' ? <><Check size={13} aria-hidden="true" /> {t('Copied')}</>
          : feedback === 'failed' ? t('Copy failed') : t('Copy')}</span>
      </button>
    </div>
    <NodeViewContent<'pre'> as="pre" style={{ whiteSpace: 'pre' }} />
  </NodeViewWrapper>;
}
