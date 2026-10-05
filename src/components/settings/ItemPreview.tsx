import { LinkItemContent } from '../LinkItemContent';

export function ItemPreview() {
  return (
    <div className="item-preview-area">
      <span className="setting-label muted">Preview</span>
      <div className="workspace-slot link-item item-preview" aria-label="Otium item preview">
        <LinkItemContent title="Otium" />
      </div>
    </div>
  );
}
