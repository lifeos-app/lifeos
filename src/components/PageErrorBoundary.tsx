import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { captureError } from '../lib/error-monitor';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Per-page ErrorBoundary — lightweight fallback for individual route crashes.
 * The global ErrorBoundary in Layout remains as a last resort.
 */
export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error(`[PageError${this.props.pageName ? `:${this.props.pageName}` : ''}]`, error, errorInfo);

    // Capture to local error monitor
    captureError(error, {
      componentStack: errorInfo.componentStack || undefined,
      severity: 'error',
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '40vh',
          padding: '32px 20px',
          textAlign: 'center',
          fontFamily: "'Poppins', sans-serif",
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}>
            <AlertTriangle size={24} color="#F43F5E" />
          </div>

          <h3 style={{
            fontSize: 17,
            fontWeight: 600,
            color: '#F9FAFB',
            marginBottom: 6,
          }}>
            Something went wrong on this page
          </h3>

          <p style={{
            fontSize: 13,
            color: '#6B7280',
            maxWidth: 340,
            lineHeight: 1.5,
            marginBottom: 20,
          }}>
            The rest of the app still works — try again or navigate to another page.
          </p>

          {this.state.error && (
            <pre style={{
              fontSize: 11,
              color: '#F43F5E',
              background: 'rgba(244, 63, 94, 0.06)',
              border: '1px solid rgba(244, 63, 94, 0.1)',
              borderRadius: 8,
              padding: '8px 12px',
              marginBottom: 20,
              maxWidth: 400,
              width: '100%',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 80,
              overflow: 'auto',
              textAlign: 'left',
            }}>
              {this.state.error.message}
            </pre>
          )}

          <button
            onClick={this.handleRetry}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 22px',
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.25)',
              borderRadius: 10,
              color: '#00D4FF',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              minHeight: 42,
            }}
          >
            <RefreshCw size={15} /> Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
