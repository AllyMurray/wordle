import { useEffect } from 'react';

/** Runs a stable cleanup callback when the game route unmounts. */
export const useGameRouteCleanup = (cleanup: () => void): void => {
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
};
