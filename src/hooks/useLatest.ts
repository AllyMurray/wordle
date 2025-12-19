import { useRef, useLayoutEffect } from 'react';

/**
 * Returns a ref that always holds the latest value.
 *
 * This hook is useful when you need to access the latest value of a prop or state
 * inside a callback or effect, without making that value a dependency.
 *
 * Common use case: You want an effect to run when certain values change,
 * but you also need to access other values (callbacks, conditions) without
 * those triggering the effect.
 *
 * @example
 * ```typescript
 * // Before (requires eslint-disable):
 * useEffect(() => {
 *   if (isHost && partnerConnected) {
 *     sendGameState(getGameState());
 *   }
 *   // eslint-disable-next-line react-hooks/exhaustive-deps
 * }, [solution, guesses]); // Missing isHost, partnerConnected, etc.
 *
 * // After (no disable needed):
 * const syncRef = useLatest({ isHost, partnerConnected, sendGameState, getGameState });
 * useEffect(() => {
 *   const { isHost, partnerConnected, sendGameState, getGameState } = syncRef.current;
 *   if (isHost && partnerConnected) {
 *     sendGameState(getGameState());
 *   }
 * }, [solution, guesses, syncRef]);
 * ```
 */
export function useLatest<T>(value: T): React.RefObject<T> {
  const ref = useRef(value);

  // Use useLayoutEffect to ensure the ref is updated synchronously
  // before any effects that might read it
  useLayoutEffect(() => {
    ref.current = value;
  });

  return ref;
}
