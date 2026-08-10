import type { ConnectionStatus } from '../types';

interface ConnectionAlertProps {
  status: ConnectionStatus;
  message: string;
}

export function ConnectionAlert({ status, message }: ConnectionAlertProps) {
  if (status !== 'error') return null;

  return (
    <span className="partner-status error" role="alert">
      {message || 'Unable to connect. Please try again.'}
    </span>
  );
}
