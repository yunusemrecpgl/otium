// Only a theme hint is cached here; chrome.storage remains authoritative.
(() => {
  let preference = 'system';
  try {
    const cached = localStorage.getItem('otium:first-paint-theme');
    if (cached === 'light' || cached === 'dark' || cached === 'system') preference = cached;
  } catch { /* Storage restrictions must not block startup. */ }
  document.documentElement.dataset.theme = preference === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference;
})();
