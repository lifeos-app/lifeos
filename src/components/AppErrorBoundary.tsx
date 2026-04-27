import { Component, type ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { reportError } from '../lib/error-reporter';
import { captureError } from '../lib/error-monitor';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
  isChunkError: boolean;
}

const HERMETIC_QUOTES = [
  '"The lips of wisdom are closed, except to the ears of understanding."',
  '"Every cause has its effect; every effect has its cause."',
  '"As above, so below; as below, so above."',
];

function getRandomQuote() {
  return HERMETIC_QUOTES[Math.floor(Math.random() * HERMETIC_QUOTES.length)];
}

function isChunkLoadError(error: Error): boolean {
  const msg = error?.message || '';
  const name = error?.name || '';
  return (
    name === 'ChunkLoadError' ||
    name === 'DynamicImportError' ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    msg.includes('chunk failed') ||
    msg.includes('dynamically imported module') ||
    /Loading script .* failed/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  );
}

/**
 * App-level ErrorBoundary — wraps the entire application.
 * Catches any unhandled errors that escape page-level or feature-level boundaries.
 * Shows a friendly dark-themed full-page error screen with reload + report options.
 */
export class AppErrorBoundary extends Component<Props, State> {
  private quote = getRandomQuote();

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: '', isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('[AppErrorBoundary] Unhandled error:', error, errorInfo);
    this.setState({ errorInfo: errorInfo.componentStack || '' });

    // Set crash flag in sessionStorage for crash persistence detection
    try {
      sessionStorage.setItem('lifeos_crashed', 'true');
    } catch {}

    // Report to Supabase error_logs
    reportError({
      error_message: `[AppErrorBoundary] ${error.message}`,
      error_stack: error.stack,
      component_stack: errorInfo.componentStack || undefined,
      metadata: { type: 'AppErrorBoundary', isChunkError: isChunkLoadError(error) },
    });

    // Also capture to local error monitor
    captureError(error, {
      componentStack: errorInfo.componentStack || undefined,
      severity: 'critical',
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReportIssue = () => {
    const title = encodeURIComponent(`App Error: ${this.state.error?.message?.slice(0, 80) || 'Unknown'}`);
    const body = encodeURIComponent(
      `**Error:** ${this.state.error?.message || 'Unknown'}\n\n` +
      `**Stack:**\n\`\`\`\n${this.state.error?.stack?.slice(0, 2000) || 'N/A'}\n\`\`\`\n\n` +
      `**Component Stack:**\n\`\`\`\n${this.state.errorInfo?.slice(0, 2000) || 'N/A'}\n\`\`\`\n\n` +
      `**URL:** ${window.location.href}\n` +
      `**User Agent:** ${navigator.userAgent}\n` +
      `**Time:** ${new Date().toISOString()}`
    );
    // Open GitHub issue template
    window.open(`https://github.com/nous-research/lifeos/issues/new?title=${title}&body=${body}`, '_blank');
  };

  render() {
    if (this.state.hasError) {
      const { error, isChunkError } = this.state;

      return (
        <div style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050E1A',
          fontFamily: "'Poppins', sans-serif",
          padding: '24px',
        }}>
          {/* Icon */}
          <div style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: isChunkError
              ? 'rgba(0, 212, 255, 0.08)'
              : 'rgba(244, 63, 94, 0.08)',
            border: isChunkError
              ? '1px solid rgba(0, 212, 255, 0.15)'
              : '1px solid rgba(244, 63, 94, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}>
            <AlertTriangle
              size={36}
              color={isChunkError ? '#00D4FF' : '#F43F5E'}
            />
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 24,
            fontWeight: 600,
            color: '#F9FAFB',
            marginBottom: 8,
            textAlign: 'center',
          }}>
            {isChunkError ? 'New version available' : 'Something went wrong'}
          </h1>

          {/* Description */}
          <p style={{
            fontSize: 15,
            color: '#9CA3AF',
            maxWidth: 420,
            lineHeight: 1.6,
            marginBottom: 8,
            textAlign: 'center',
          }}>
            {isChunkError
              ? 'The app has been updated. A quick reload will get you the latest version.'
              : "Don't worry — your data is safe. This is just a display issue."}
          </p>

          {/* Hermetic quote */}
          <p style={{
            fontSize: 13,
            color: 'rgba(0, 212, 255, 0.4)',
            fontStyle: 'italic',
            maxWidth: 380,
            textAlign: 'center',
            marginBottom: 28,
            lineHeight: 1.5,
          }}>
            {this.quote}
          </p>

          {/* Error details (collapsed) */}
          {error && (
            <details style={{
              marginBottom: 28,
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 10,
              maxWidth: 520,
              width: '100%',
              textAlign: 'left',
            }}>
              <summary style={{
                color: '#6B7280',
                fontSize: 12,
                cursor: 'pointer',
                userSelect: 'none',
              }}>
                Error details (for debugging)
              </summary>
              <pre style={{
                fontSize: 11,
                color: '#F43F5E',
                marginTop: 8,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 180,
                overflow: 'auto',
              }}>
                {error.message}
                {error.stack && `\n\n${error.stack.slice(0, 2000)}`}
              </pre>
            </details>
          )}

          {/* Buttons */}
          <div style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            {/* Primary: Reload App */}
            <button
              onClick={this.handleReload}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '14px 28px',
                background: '#00D4FF',
                border: 'none',
                borderRadius: 12,
                color: '#050E1A',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: 48,
                boxShadow: '0 4px 14px rgba(0, 212, 255, 0.3)',
              }}
            >
              <RefreshCw size={18} /> Reload App
            </button>

            {/* Secondary: Report Issue */}
            <button
              onClick={this.handleReportIssue}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '14px 28px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                color: '#6B7280',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                minHeight: 48,
              }}
            >
              Report Issue
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}