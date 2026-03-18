import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { logger } from '../utils/logger';
import './FeatureErrorBoundary.css';

interface Props {
  feature: string;
  children: ReactNode;
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Per-feature ErrorBoundary — isolates widget/overlay crashes so siblings keep rendering.
 * Use `compact` for dashboard widgets (smaller card, no icon).
 */
export class FeatureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error(`[${this.props.feature}] Render error:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { feature, compact } = this.props;
      return (
        <div className={`feb-card ${compact ? 'feb-compact' : ''}`}>
          <div className="feb-content">
            <span className="feb-feature">{feature}</span>
            <span className="feb-msg">Something went wrong</span>
            {this.state.error && (
              <span className="feb-detail">{this.state.error.message}</span>
            )}
            <button className="feb-retry" onClick={this.handleRetry}>
              <RefreshCw size={13} /> Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
