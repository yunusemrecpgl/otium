import { useEffect } from 'react';
import { t, useLocale } from '../i18n';

export function useDocumentTitle() {
  const locale = useLocale();
  useEffect(() => { document.title = t('app.documentTitle'); }, [locale]);
}
