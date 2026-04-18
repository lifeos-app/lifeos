import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  /** Feature/wiget name for logging */
  feature: string;
  /** Compact mode for dashboard widgets */
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** Incremented on retry — changes the key to force remount */
  retryCount: number;
}

/**
 * Per-feature ErrorBoundary — isolates widget/overlay crashes so siblings keep rendering.
 * Use `compact` for dashboard widgets (smaller card, no icon).
 *
 * Improvements over naive boundary:
 * - Logs errors with feature name
 * - Shows a placeholder card so layout doesn't shift
 * - Retry button remounts the component via key change
 */
export class FeatureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error(
      `[FeatureErrorBoundary:${this.props.feature}] Render error:`,
      error,
      errorInfo
    );
  }

  handleRetry = () => {
    // Increment retryCount to change the key on the children wrapper,
    // which forces React to remount the child tree
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      const { feature, compact } = this.props;

      return (
        <div
          className={`feb-card ${compact ? 'feb-compact' : ''}`}
          role="alert"
          aria-label={`${feature} encountered an error`}
        >
          <div className="feb-content">
            {!compact && (
              <div className="feb-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(244,63,94,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
            )}
            <span className="feb-feature">{feature}</span>
            <span className="feb-msg">This feature encountered an issue</span>
            {this.state.error && (
              <span className="feb-detail">{this.state.error.message}</span>
            )}
            <button className="feb-retry" onClick={this.handleRetry}>
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        </div>
      );
    }

    // Use key to force remount when retrying
    return (
      <div key={this.state.retryCount}>
        {this.props.children}
      </div>
    );
  }
}