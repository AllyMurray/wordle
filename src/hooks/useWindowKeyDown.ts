import { useEffect } from 'react';

export const useWindowKeyDown = (
  enabled: boolean,
  handler: (event: KeyboardEvent) => void
): void => {
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, handler]);
};
