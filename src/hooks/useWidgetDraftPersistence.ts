import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Portaled widget editors retain this context; selection is still Canvas-owned.
export const WidgetDraftBoundary = createContext<{ selected: boolean; inspectorOpen: boolean } | null>(null);

export function useWidgetDraftPersistence<T extends object>({ value, save, preview, equals, errorMessage }: {
  value: T;
  save: (draft: T) => Promise<void>;
  preview?: (draft: T) => void;
  equals?: (a: T, b: T) => boolean;
  errorMessage: string;
}) {
  const [config, setConfig] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(config);
  const version = useRef(0), savedVersion = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const mounted = useRef(true);
  const options = useRef({ save, preview, equals, errorMessage });
  options.current = { save, preview, equals, errorMessage };
  const boundary = useContext(WidgetDraftBoundary);
  const previousBoundary = useRef(boundary);
  const equal = useCallback((a: T, b: T) => options.current.equals?.(a, b) ?? JSON.stringify(a) === JSON.stringify(b), []);
  const cancelTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const flush = useCallback((): Promise<boolean> => {
    cancelTimer();
    if (inFlight.current) return inFlight.current;
    if (version.current === savedVersion.current) return Promise.resolve(true);
    const run = async () => {
      while (version.current !== savedVersion.current) {
        const generation = version.current;
        const snapshot = latest.current;
        try {
          await options.current.save(snapshot);
          savedVersion.current = generation;
          if (mounted.current) setError(null);
        } catch {
          // A failed generation remains dirty, including any newer draft.
          if (mounted.current) setError(options.current.errorMessage);
          return false;
        }
        // New edits during this save are serialized next, never cleared by the
        // acknowledgement of an older version or a delayed debounce callback.
        cancelTimer();
      }
      return true;
    };
    const pending = run();
    inFlight.current = pending;
    void pending.then(success => {
      if (inFlight.current === pending) inFlight.current = null;
      // A lifecycle callback can produce one last edit as a save settles.
      if (success && version.current !== savedVersion.current) void flush();
    });
    return pending;
  }, [cancelTimer]);

  const replace = useCallback((next: T) => {
    if (equal(latest.current, next)) return;
    latest.current = next;
    version.current++;
    if (mounted.current) setConfig(next);
    options.current.preview?.(next);
    cancelTimer();
    timer.current = setTimeout(() => { void flush(); }, 450);
  }, [cancelTimer, equal, flush]);
  const edit = useCallback((patch: Partial<T>) => replace({ ...latest.current, ...patch }), [replace]);

  useLayoutEffect(() => {
    // Shared Project previews already include our pending edits and may merge
    // changes from the other editing surface. Persisted-only updates must wait
    // until our local draft is clean. Neither branch schedules a write.
    if ((version.current !== savedVersion.current || inFlight.current) && !options.current.preview) return;
    if (!equal(latest.current, value)) { latest.current = value; setConfig(value); }
  }, [value, equal]);
  useLayoutEffect(() => {
    const previous = previousBoundary.current;
    previousBoundary.current = boundary;
    if ((previous?.selected && !boundary?.selected) || (previous?.inspectorOpen && !boundary?.inspectorOpen)) void flush();
  }, [boundary?.selected, boundary?.inspectorOpen, flush]);
  useEffect(() => {
    mounted.current = true;
    const hidden = () => { if (document.visibilityState === 'hidden') void flush(); };
    const leaving = () => { void flush(); };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', leaving);
    window.addEventListener('beforeunload', leaving);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', leaving);
      window.removeEventListener('beforeunload', leaving);
      mounted.current = false;
      // Best effort only: stable blur/selection/document boundaries flush first.
      void flush();
    };
  }, [flush]);

  return { config, latest, error, flush, edit, replace };
}
