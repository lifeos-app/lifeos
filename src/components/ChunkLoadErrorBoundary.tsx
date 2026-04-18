import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
  retried: boolean;
}

/**
 * Detects chunk load failures (ChunkLoadError, DynamicImportError)
 * from lazy-loaded routes and shows a "New version available" banner
 * instead of a blank screen. Auto-retries once before showing the error.
 *
 * Non-chunk errors are NOT caught — they bubble to the parent ErrorBoundary/AppErrorBoundary.
 */
export class ChunkLoadErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isChunkError: false, retried: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> | null {
    const isChunk = isChunkLoadError(error);
    if (!isChunk) {
      // Not a chunk error — don't update state, let parent handle it
      return null;
    }
    return { hasError: true, isChunkError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (!isChunkLoadError(error)) {
      // This shouldn't happen since getDerivedStateFromError returns null for non-chunk errors,
      // but if it does, we just ignore it — the parent boundary will catch it.
      return;
    }

    logger.warn('[ChunkLoadErrorBoundary] Chunk load failed:', error.message);

    // Auto-retry once before showing the error UI
    if (!this.state.retried) {
      // Use a short timeout so state update doesn't conflict with render
      setTimeout(() => {
        this.setState({ retried: true, hasError: false, isChunkError: false });
      }, 1000);
    }
  }

  handleReload = () => {
    // Clear caches and reload to pick up new chunks
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(n => caches.delete(n)));
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.isChunkError) {
      return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9998,
          background: 'rgba(5, 14, 26, 0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          fontFamily: "'Poppins', sans-serif",
        }}>
          <span style={{
            fontSize: 13,
            color: '#9CA3AF',
          }}>
            New version available
          </span>
          <button
            onClick={this.handleReload}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              background: 'rgba(0, 212, 255, 0.12)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: 8,
              color: '#00D4FF',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Click to reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
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