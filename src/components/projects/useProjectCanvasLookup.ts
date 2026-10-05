import { useMemo, useRef } from 'react';

// Storage notifications replace whole arrays. Reuse unchanged records only in
// this derived render view, without changing authoritative data or persistence.
export function useProjectCanvasLookup<T extends { id: string }>(values: readonly T[]): Map<string, T> {
  const previous = useRef(new Map<string, T>());
  return useMemo(() => {
    const next = new Map<string, T>();
    let unchanged = previous.current.size === values.length;
    const order = previous.current.keys();
    for (const value of values) {
      const cached = previous.current.get(value.id);
      const stable = cached && (cached === value || JSON.stringify(cached) === JSON.stringify(value)) ? cached : value;
      next.set(value.id, stable);
      if (stable !== cached || order.next().value !== value.id) unchanged = false;
    }
    if (unchanged) return previous.current;
    previous.current = next;
    return next;
  }, [values]);
}
