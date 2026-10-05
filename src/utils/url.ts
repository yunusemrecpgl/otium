export function normalizeUrl(input: string): string | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;

  try {
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value) && !/^[^/:]+:\d+(?:[/?#]|$)/.test(value);
    const url = new URL(hasScheme ? value : `https://${value}`);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname;
    if (host !== 'localhost' && !host.includes('.') && !host.startsWith('[')) return null;
    if (host.includes('.') && host.split('.').some((part) => !part || !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(part))) return null;
    return url.href;
  } catch {
    return null;
  }
}

