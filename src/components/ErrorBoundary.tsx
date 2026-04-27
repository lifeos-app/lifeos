import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { reportError } from '../lib/error-reporter';
import { captureError } from '../lib/error-monitor';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ errorInfo: errorInfo.componentStack || '' });
    
    // Report to Supabase error_logs
    reportError({
      error_message: error.message,
      error_stack: error.stack,
      component_stack: errorInfo.componentStack || undefined,
      metadata: { type: 'ErrorBoundary' },
    });

    // Also capture to local error monitor
    captureError(error, {
      componentStack: errorInfo.componentStack || undefined,
      severity: 'error',
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/app/';
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          padding: '24px',
          textAlign: 'center',
          fontFamily: "'Poppins', sans-serif",
        }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: 'rgba(244, 63, 94, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}>
            <AlertTriangle size={32} color="#F43F5E" />
          </div>
          
          <h2 style={{
            fontSize: 20,
            fontWeight: 600,
            color: '#F9FAFB',
            marginBottom: 8,
          }}>
            Something went wrong
          </h2>
          
          <p style={{
            fontSize: 14,
            color: '#9CA3AF',
            maxWidth: 400,
            lineHeight: 1.6,
            marginBottom: 24,
          }}>
            Don't worry — your data is safe. This is just a display issue.
          </p>

          {this.state.error && (
            <details style={{
              marginBottom: 24,
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
              maxWidth: 500,
              width: '100%',
              textAlign: 'left',
            }}>
              <summary style={{ color: '#6B7280', fontSize: 12, cursor: 'pointer' }}>
                Error details
              </summary>
              <pre style={{
                fontSize: 11,
                color: '#F43F5E',
                marginTop: 8,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 150,
                overflow: 'auto',
              }}>
                {this.state.error.message}
              </pre>
            </details>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleRetry}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 24px',
                background: 'rgba(0, 212, 255, 0.1)',
                border: '1px solid rgba(0, 212, 255, 0.25)',
                borderRadius: 10,
                color: '#00D4FF',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              <RefreshCw size={16} /> Try Again
            </button>
            <button
              onClick={this.handleGoHome}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 24px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 10,
                color: '#9CA3AF',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              <Home size={16} /> Go Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
