import { t, useLocale } from "../../i18n";
import { ITEM_SIZE_MIN, ITEM_SIZE_MAX, ITEM_SIZE_STEP } from '../../domain/settings';
import { ItemPreview } from './ItemPreview';

interface ItemSizeControlProps {
  value: number;
  onChange: (size: number) => void;
  onCommit: () => void;
  disabled?: boolean;
}

export function ItemSizeControl({ value, onChange, onCommit, disabled }: ItemSizeControlProps) {
  useLocale();
  return (
    <div className="item-size-setting">
      <div className="range-setting">
        <div className="setting-line"><label htmlFor="item-size">{t("Item size")}</label><output htmlFor="item-size">{value} px</output></div>
        <input id="item-size" type="range" min={ITEM_SIZE_MIN} max={ITEM_SIZE_MAX} step={ITEM_SIZE_STEP} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} onPointerUp={onCommit} onKeyUp={onCommit} onBlur={onCommit} />
      </div>
      <ItemPreview />
    </div>
  );
}
