import { t, useLocale } from "../../i18n";
import { previewJsonValue } from '../../services/webData';

// Only paths supported by the existing dot-path resolver can be selected.
function leaves(value: unknown): { path: string; value: string }[] {
  const rows: { path: string; value: string }[] = [];
  let visited = 0;
  function visit(node: unknown, path: string, depth: number) {
    if (++visited > 500 || rows.length >= 100 || depth > 12) return;
    if (node === null || ['string', 'number', 'boolean'].includes(typeof node)) {
      rows.push({ path, value: previewJsonValue(node) }); return;
    }
    if (typeof node !== 'object') return;
    for (const key in node) {
      if (++visited > 500 || rows.length >= 100) break;
      if (!Object.prototype.hasOwnProperty.call(node, key) || !/^[a-zA-Z0-9_$-]+$/.test(key) || ['__proto__', 'prototype', 'constructor'].includes(key)) continue;
      visit((node as Record<string, unknown>)[key], path ? path + '.' + key : key, depth + 1);
    }
  }
  visit(value, '', 0); return rows;
}
export function ResponseExplorer({ response, selectedPaths, onToggle, disabled, maxFields = 8 }: {
  response: unknown; selectedPaths: string[]; onToggle: (path: string) => void; disabled?: boolean; maxFields?: number;
}) {
  useLocale();
  const rows = leaves(response);
  return <div className="web-data-explorer" role="group" aria-label={t("Response Explorer")}>
    <span className="muted">{t("Response Explorer")}</span>
    <div className="web-data-explorer-rows">
      {rows.map(row => <label key={row.path} className="web-data-leaf-row" data-selected={selectedPaths.includes(row.path) || undefined} title={row.path || t('Root value')}>
        <input type="checkbox" aria-label={row.path || t('Root value')} checked={selectedPaths.includes(row.path)}
          disabled={disabled || (!selectedPaths.includes(row.path) && selectedPaths.length >= maxFields)} onChange={() => onToggle(row.path)} />
        <span>{row.path || t('Root value')}</span><span>{row.value}</span>
      </label>)}
      {selectedPaths.length >= maxFields && <span className="muted">{t("Maximum")} {maxFields} {t("fields selected.")}</span>}
      {!rows.length && <span className="muted">{t("No selectable values found.")}</span>}
    </div>
  </div>;
}
