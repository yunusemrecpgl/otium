import { t, useLocale } from "../i18n";
export function ArrangeButton({ onArrange, disabled }: { onArrange: () => void; disabled: boolean }) {
  useLocale();
  return <button type="button" className="workspace-control arrange-button" aria-label={t("Arrange workspace")}
    title={t("Arrange workspace")} onClick={onArrange} disabled={disabled}>
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="11" height="7" rx="1" />
      <rect x="18" y="3" width="3" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  </button>;
}
