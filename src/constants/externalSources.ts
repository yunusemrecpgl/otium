export const EXTERNAL_TEXT_LIMIT = 2_000_000;

export const EXTERNAL_RESPONSE_LIMITS = {
  json: 8_000_000,
  // Preserve the existing character budgets, including three-byte UTF-8 and a BOM.
  rss: EXTERNAL_TEXT_LIMIT * 3 + 3,
  html: EXTERNAL_TEXT_LIMIT * 3 + 3,
  favicon: 2_000_000,
  discoveryHtml: 1_000_000,
  discoveryScript: 500_000,
  discoveryJson: 200_000,
} as const;

export const PAGE_WATCH_DISCOVERY_LIMITS = {
  scripts: 15, candidates: 40, scriptBytes: 3_000_000, timeoutMs: 8_000,
} as const;
