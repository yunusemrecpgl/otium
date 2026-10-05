import { t, useLocale } from "../../i18n";
import { LinkItemContent } from '../LinkItemContent';

export function ItemPreview() {
  useLocale();
  return (
    <div className="item-preview-area">
      <span className="setting-label muted">{t("Preview")}</span>
      <div className="workspace-slot link-item item-preview" aria-label={t("Otium item preview")}>
        <LinkItemContent title="Otium" />
      </div>
    </div>
  );
}
