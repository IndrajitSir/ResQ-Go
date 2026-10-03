'use client';

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Reports whether the viewer has asked for reduced motion.
 *
 * Starts `false` so the first server render and the first client render agree;
 * the real value is applied in an effect immediately after mount. Components use
 * this to skip auto-playing animation rather than merely shortening it.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(QUERY);
    setReduced(list.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    // Safari below 14 only supports the deprecated listener API.
    if (typeof list.addEventListener === 'function') {
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    }
    list.addListener(onChange);
    return () => list.removeListener(onChange);
  }, []);

  return reduced;
}