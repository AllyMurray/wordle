import { useEffect } from 'react';
import { useMultiplayerStore } from '../stores/multiplayerStore';

/**
 * Hook to handle automatic reconnection for multiplayer games.
 *
 * On iOS Safari, WebRTC connections are suspended when the app is backgrounded
 * (e.g., when switching to WhatsApp to share the game link). This hook restores
 * the connection when the page becomes visible again.
 *
 * This hook should be used by any game component that uses multiplayer functionality
 * directly via useMultiplayerStore (rather than through useGameSession which has
 * this built-in).
 */
export const useMultiplayerReconnection = (): void => {
  const role = useMultiplayerStore((s) => s.role);
  const restoreHostConnection = useMultiplayerStore((s) => s.restoreHostConnection);
  const restoreViewerConnection = useMultiplayerStore((s) => s.restoreViewerConnection);

  const isHost = role === 'host';
  const isViewer = role === 'viewer';

  useEffect(() => {
    if (!isHost && !isViewer) return;

    const restoreConnection = isHost ? restoreHostConnection : restoreViewerConnection;

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        restoreConnection();
      }
    };

    // Handle bfcache restoration (back-forward cache)
    const handlePageShow = (event: PageTransitionEvent): void => {
      if (event.persisted) {
        restoreConnection();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [isHost, isViewer, restoreHostConnection, restoreViewerConnection]);
};
