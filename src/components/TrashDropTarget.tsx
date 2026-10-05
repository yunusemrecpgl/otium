import { t, useLocale } from "../i18n";
import type { RefObject } from 'react';
import { TrashIcon } from './navigation/Icons';

export function TrashDropTarget({ targetRef, visible, active }: { targetRef: RefObject<HTMLDivElement | null>; visible: boolean; active: boolean }) {
  useLocale();
  return <div ref={targetRef} className={`trash-drop-target${visible ? ' is-visible' : ''}${active ? ' is-active' : ''}`}
    aria-hidden={!visible} role="status" aria-label={t("Drop in Trash")}><TrashIcon /><span>{t("Trash")}</span></div>;
}
