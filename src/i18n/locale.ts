export const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'tr', name: 'Türkçe' },
  { code: 'es', name: 'Español' }, { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' }, { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'ja', name: '日本語' }, { code: 'zh-CN', name: '简体中文' },
] as const;
export type Locale = typeof LANGUAGES[number]['code'];
export function isLocale(value: unknown): value is Locale { return LANGUAGES.some(language => language.code === value); }
export function browserLocale(): Locale {
  const requested = globalThis.navigator?.languages ?? [globalThis.navigator?.language ?? 'en'];
  for (const language of requested) {
    if (isLocale(language)) return language;
    const base = language.toLowerCase().split('-')[0];
    const match = LANGUAGES.find(language => language.code.toLowerCase().split('-')[0] === base);
    if (match) return match.code;
  }
  return 'en';
}
