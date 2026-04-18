import { useEffect, useState, useCallback } from 'react';
import { registerAsyncErrorToastDispatcher } from '../lib/error-reporter';

interface ToastEntry {
  id: number;
  message: string;
  timestamp: number;
}

let toastListeners: Array<(toast: ToastEntry) => void> = [];
let toastIdCounter = 0;

/**
 * Show a subtle toast for an async error.
 * Called from the global unhandledrejection handler.
 */
export function showAsyncErrorToast(message: string) {
  const toast: ToastEntry = {
    id: ++toastIdCounter,
    message: message.slice(0, 200), // Truncate long messages
    timestamp: Date.now(),
  };
  toastListeners.forEach(listener => listener(toast));
}

/**
 * AsyncErrorToast — listens for async errors reported via showAsyncErrorToast()
 * and displays them as subtle non-crashing toasts at the bottom of the screen.
 * Auto-dismisses after 5 seconds.
 */
export function AsyncErrorToast() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => {
    // Register the dispatcher so the global error handler can call it
    registerAsyncErrorToastDispatcher(showAsyncErrorToast);

    const listener = (toast: ToastEntry) => {
      setToasts(prev => [...prev.slice(-4), toast]); // Keep max 5 toasts

      // Auto-dismiss after 5s
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 5000);
    };

    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: 8,
      maxWidth: 380,
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          role="alert"
          onClick={() => dismissToast(toast.id)}
          style={{
            pointerEvents: 'auto',
            padding: '10px 16px',
            background: 'rgba(5, 14, 26, 0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(244, 63, 94, 0.12)',
            borderRadius: 10,
            fontFamily: "'Poppins', sans-serif",
            fontSize: 12,
            color: '#9CA3AF',
            lineHeight: 1.5,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            animation: 'asyncToastIn 0.25s ease-out',
          }}
        >
          <style>{`
            @keyframes asyncToastIn {
              from { transform: translateY(10px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
          <span style={{ color: 'rgba(244, 63, 94, 0.7)', fontWeight: 600, marginRight: 6 }}>
            ⚠
          </span>
          {toast.message}
        </div>
      ))}
    </div>
  );
}