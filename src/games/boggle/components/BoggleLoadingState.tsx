import type { ConnectionStatus } from '../../../types';

interface BoggleLoadingStateProps {
  isMultiplayerViewer: boolean;
  connectionStatus: ConnectionStatus;
  errorMessage: string;
}

export function BoggleLoadingState({
  isMultiplayerViewer,
  connectionStatus,
  errorMessage,
}: BoggleLoadingStateProps) {
  if (errorMessage) {
    return (
      <div className="partner-status error" role="alert">
        {errorMessage}
      </div>
    );
  }

  if (!isMultiplayerViewer) {
    return <div className="loading">Loading dictionary...</div>;
  }

  if (connectionStatus === 'error') {
    return (
      <div className="partner-status error" role="alert">
        Unable to connect to the host.
      </div>
    );
  }

  return (
    <div className="partner-status waiting" role="status">
      {connectionStatus === 'connected' ? 'Waiting for game state...' : 'Connecting to host...'}
    </div>
  );
}
