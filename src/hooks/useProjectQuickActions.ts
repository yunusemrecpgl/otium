import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ProjectQuickActions, RegisterProjectQuickActions } from '../components/projects/ProjectContextToolbar';

export function useProjectQuickActions(id: string, register: RegisterProjectQuickActions | undefined, actions: ProjectQuickActions) {
  const latest = useRef(actions); latest.current = actions;
  const snapshot = useCallback(() => latest.current.snapshot!(), []);
  const refresh = useCallback(() => latest.current.refresh?.run(), []);
  const open = useCallback(() => latest.current.open?.run(), []);
  const hasSnapshot = !!actions.snapshot, hasRefresh = !!actions.refresh, hasOpen = !!actions.open;
  const refreshDisabled = actions.refresh?.disabled, openDisabled = actions.open?.disabled, openLabel = actions.open?.label;
  const registration = useMemo<ProjectQuickActions>(() => ({
    snapshot: hasSnapshot ? snapshot : undefined,
    refresh: hasRefresh ? { disabled: !!refreshDisabled, run: refresh } : undefined,
    open: hasOpen ? { disabled: !!openDisabled, label: openLabel!, run: open } : undefined,
  }), [hasSnapshot, hasRefresh, hasOpen, refreshDisabled, openDisabled, openLabel, snapshot, refresh, open]);
  useEffect(() => {
    register?.(id, registration);
  }, [id, register, registration]);
  useEffect(() => () => register?.(id, null), [id, register]);
}
