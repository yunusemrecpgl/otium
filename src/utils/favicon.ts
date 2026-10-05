export function getFaviconUrl(url: string): string {
  return new URL('/favicon.ico', url).href;
}

export function getTitleInitial(title: string): string {
  return Array.from(title).find((character) => /[\p{L}\p{N}]/u.test(character))?.toLocaleUpperCase() ?? '?';
}
