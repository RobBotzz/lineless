import { useCallback, useRef } from 'react';

// Guards against a single tap firing the handler twice (duplicate/ghost events
// on some touch browsers). The lock releases on the next frame, so genuine
// repeated taps still each run once. Returns a wrapper: call it with the action
// to run guarded.
export function useAddGuard(): (action: () => void) => void {
  const lockedRef = useRef(false);
  return useCallback((action: () => void) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    requestAnimationFrame(() => {
      lockedRef.current = false;
    });
    action();
  }, []);
}
