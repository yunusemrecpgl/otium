import { useSyncExternalStore } from 'react';
import { browserLocale, isLocale } from './locale';
import type { Locale } from './locale';
import en from './locales/en';
import tr from './locales/tr';
import es from './locales/es';
import de from './locales/de';
import fr from './locales/fr';
import pt from './locales/pt-BR';
import ja from './locales/ja';
import zh from './locales/zh-CN';

const dictionaries: Record<Locale, Readonly<Record<string, string>>> = { en, tr, es, de, fr, 'pt-BR': pt, ja, 'zh-CN': zh };
let locale: Locale = browserLocale();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function getLocale(): Locale { return locale; }
export function setLocale(next: Locale) {
  if (!isLocale(next)) return;
  document.documentElement.lang = next;
  if (locale === next) return;
  locale = next;
  listeners.forEach(listener => listener());
}
export function useLocale(): Locale { return useSyncExternalStore(subscribe, getLocale, getLocale); }
export function t(key: string, values?: Record<string, string | number>): string {
  const translated = dictionaries[locale][key] ?? en[key] ?? key;
  return values ? translated.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match)) : translated;
}
export function dateTime(value: number | string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options ?? { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
