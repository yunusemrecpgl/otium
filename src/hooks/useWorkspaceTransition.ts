import { useEffect, useRef, useState } from 'react';

export function useWorkspaceTransition() {
  const [containerId, setContainerId] = useState('home');
  const [phase, setPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);
  function navigate(id: string) {
    if (pending.current || id === containerId) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setContainerId(id); return; }
    pending.current = true; setPhase('out');
    timer.current = setTimeout(() => {
      setContainerId(id); setPhase('in');
      timer.current = setTimeout(() => { setPhase('idle'); pending.current = false; timer.current = null; }, 140);
    }, 120);
  }
  function resetHome() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null; pending.current = false; setPhase('idle'); setContainerId('home');
  }
  return { containerId, phase, navigate, resetHome };
}
