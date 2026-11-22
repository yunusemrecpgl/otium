import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t, useLocale } from '../../i18n';
import { bookmarkImportOnboarding } from '../../services/bookmarkImportOnboarding';
import { chromeStorageProvider } from '../../services/storage/provider';
import { websiteIconsOnboarding } from '../../services/websiteIconsOnboarding';
import { clampFloating, floatingBounds } from '../projects/floatingBounds';

// Device-local preference armed only by product-tour-install.js.
const TOUR_KEY = 'productTourState';
const steps = [
  { target: 'home', title: 'Home', description: 'Organize your saved websites and folders here.' },
  { target: 'projects', title: 'Projects', description: 'Organize resources and use widgets in separate workspaces.' },
  { target: 'notebook', title: 'Notebook', description: 'Write notes, organize them into sections, and reuse templates.' },
  { target: 'widgets', title: 'Widgets', description: 'Browse widgets and manage their permissions.' },
];

export function ProductTour({ workspaceEmpty }: { workspaceEmpty: boolean }) {
  const [onboarding, setOnboarding] = useState<{ eligible: boolean; iconsDone: boolean; bookmarksPending: boolean }>();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    let revision = 0;
    const stop: (() => void)[] = [];
    function refresh() {
      const current = ++revision;
      void Promise.all([chromeStorageProvider.read([TOUR_KEY]), websiteIconsOnboarding.completed(), bookmarkImportOnboarding.pending()])
        .then(([values, iconsDone, bookmarksPending]) => {
          if (active && revision === current) setOnboarding({ eligible: values[TOUR_KEY] === 'pending', iconsDone, bookmarksPending });
        }).catch(cause => console.warn('Product tour state could not be read.', cause));
    }
    try {
      stop.push(chromeStorageProvider.subscribe!(TOUR_KEY, refresh));
      stop.push(websiteIconsOnboarding.subscribe(refresh));
      stop.push(bookmarkImportOnboarding.subscribe(refresh));
      refresh();
    } catch (cause) { console.warn('Product tour synchronization is unavailable.', cause); }
    return () => { active = false; stop.forEach(unsubscribe => unsubscribe()); };
  }, []);

  if (dismissed || !onboarding?.eligible || !onboarding.iconsDone || (workspaceEmpty && onboarding.bookmarksPending)) return null;
  return <TourCard onDismiss={() => {
    setDismissed(true);
    void chromeStorageProvider.write({ [TOUR_KEY]: 'seen' })
      .catch(cause => console.warn('Product tour completion could not be saved.', cause));
  }} />;
}

function TourCard({ onDismiss }: { onDismiss: () => void }) {
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const card = useRef<HTMLElement>(null);
  const step = steps[index];

  useLayoutEffect(() => {
    const previous = document.activeElement;
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, []);

  useLayoutEffect(() => {
    const panel = card.current;
    const target = document.querySelector<HTMLElement>(`[data-tour-target="${step.target}"]`);
    if (!panel || !target) return;
    const sideGap = 12;
    const position = () => {
      const bounds = floatingBounds();
      const rect = target.getBoundingClientRect();
      const beside = bounds.right - rect.right - sideGap;
      panel.style.maxWidth = `${Math.max(0, beside >= 160 ? beside : bounds.right - bounds.left)}px`;
      panel.style.maxHeight = `${Math.max(0, bounds.bottom - bounds.top)}px`;
      panel.style.left = `${clampFloating(rect.right + sideGap, bounds.left, bounds.right - panel.offsetWidth)}px`;
      const centered = rect.top + (rect.height - panel.offsetHeight) / 2;
      panel.style.top = `${clampFloating(centered, bounds.top, bounds.bottom - panel.offsetHeight)}px`;
    };
    target.dataset.tourHighlight = '';
    position();
    panel.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    observer.observe(panel);
    observer.observe(target);
    if (target.parentElement) observer.observe(target.parentElement);
    window.addEventListener('resize', position);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      delete target.dataset.tourHighlight;
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [step]);

  const number = new Intl.NumberFormat(locale);
  return <section ref={card} className="product-tour" role="dialog" tabIndex={-1}
    aria-labelledby="product-tour-title" aria-describedby="product-tour-step product-tour-description"
    onKeyDown={event => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); onDismiss();
    }}>
    <div className="product-tour-header">
      <h2 id="product-tour-title">{t(step.title)}</h2>
      <span id="product-tour-step">{t('{step} / {total}', { step: number.format(index + 1), total: number.format(steps.length) })}</span>
    </div>
    <p id="product-tour-description">{t(step.description)}</p>
    <div className="product-tour-actions">
      <button type="button" className="text-button" onClick={onDismiss}>{t('Skip')}</button>
      <button type="button" className="quiet-button" disabled={index === 0} onClick={() => setIndex(index - 1)}>{t('Back')}</button>
      {index === steps.length - 1
        ? <button type="button" className="quiet-button" onClick={onDismiss}>{t('Finish')}</button>
        : <button type="button" className="quiet-button" onClick={() => setIndex(index + 1)}>{t('Next')}</button>}
    </div>
  </section>;
}
