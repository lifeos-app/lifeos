import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { EmojiIcon } from '../lib/emoji-icon';
import './Toast.css';

interface ToastProps {
  message: string;
  icon?: string;
  color?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
  onClose: () => void;
}

export function Toast({ message, icon = 'sparkles', color = '#39FF14', duration = 3000, action, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto-dismiss
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade-out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`toast ${isVisible ? 'toast-visible' : ''}`}>
      <div className="toast-content">
        <span className="toast-icon" style={{ color }}>
          <EmojiIcon emoji={icon} size={16} color={color} fallbackAsText />
        </span>
        <span className="toast-message">{message}</span>
        {action && (
          <button
            className="toast-action-btn"
            onClick={() => { action.onClick(); setIsVisible(false); setTimeout(onClose, 300); }}
            style={{ color, borderColor: `${color}40` }}
          >
            {action.label}
          </button>
        )}
        <Sparkles size={14} className="toast-sparkle" style={{ color }} />
      </div>
      <button className="toast-close" onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }} aria-label="Dismiss notification">
        <X size={14} />
      </button>
    </div>
  );
}

// Toast container for managing multiple toasts
interface ToastMessage {
  id: string;
  message: string;
  icon?: string;
  color?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

let toastId = 0;
const toastListeners: ((toast: ToastMessage) => void)[] = [];

export function showToast(
  message: string,
  icon?: string,
  color?: string,
  options?: { duration?: number; action?: { label: string; onClick: () => void } },
) {
  const id = `toast-${toastId++}`;
  const toast: ToastMessage = { id, message, icon, color, ...options };
  toastListeners.forEach((listener) => listener(toast));
}

const MAX_VISIBLE_TOASTS = 3;

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (toast: ToastMessage) => {
      setToasts((prev) => {
        const next = [...prev, toast];
        // If over limit, drop the oldest ones
        if (next.length > MAX_VISIBLE_TOASTS) {
          return next.slice(next.length - MAX_VISIBLE_TOASTS);
        }
        return next;
      });
    };
    toastListeners.push(listener);
    return () => {
      const idx = toastListeners.indexOf(listener);
      if (idx > -1) toastListeners.splice(idx, 1);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          icon={toast.icon}
          color={toast.color}
          duration={toast.duration}
          action={toast.action}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}
