import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  /** Custom title for the error display */
  title?: string;
  /** Custom message for the error display */
  message?: string;
  /** Whether to show compact version (for inline sections) */
  compact?: boolean;
  /** Callback when error occurs (for logging/analytics) */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const {
        title = 'Something went wrong',
        message = 'An unexpected error occurred. Please try again.',
        compact = false,
      } = this.props;

      if (compact) {
        return (
          <div className="error-boundary-compact" role="alert">
            <p className="error-message-compact">{message}</p>
            <button className="error-btn-compact" onClick={this.handleReset}>
              Try Again
            </button>
          </div>
        );
      }

      return (
        <div className="error-boundary">
          <div className="error-content">
            <h1>{title}</h1>
            <p className="error-message">
              {message}
            </p>
            {this.state.error && (
              <details className="error-details">
                <summary>Error details</summary>
                <pre>{this.state.error.message}</pre>
              </details>
            )}
            <div className="error-actions">
              <button className="error-btn primary" onClick={this.handleReload}>
                Reload Page
              </button>
              <button className="error-btn secondary" onClick={this.handleReset}>
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
