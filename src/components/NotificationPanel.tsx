import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ChevronDown } from 'lucide-react';
import type { Notification, NotificationPriority } from '../hooks/useNotifications';
import './NotificationPanel.css';

interface NotificationPanelProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  history: Notification[];
  onClose: () => void;
  onNavigate: (route: string) => void;
}

const PRIORITY_COLORS: Record<NotificationPriority, string> = {
  high: '#EF4444',
  medium: '#F97316',
  low: '#6B7280',
};

const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
};

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return 'yesterday';
}

export function NotificationPanel({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onClearAll,
  history,
  onClose,
  onNavigate,
}: NotificationPanelProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleItemClick = (notif: Notification) => {
    onMarkRead(notif.id);
    if (notif.route) onNavigate(notif.route);
  };

  return createPortal(
    <>
      <div className="notif-backdrop" onClick={onClose} />
      <div className="notif-panel" role="dialog" aria-label="Notifications">
        {/* Header */}
        <div className="notif-header">
          <div className="notif-header-left">
            <span className="notif-header-title">Notifications</span>
            {unreadCount > 0 && (
              <span className="notif-header-badge">{unreadCount}</span>
            )}
          </div>
          <button className="notif-close-btn" onClick={onClose} aria-label="Close notifications">
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="notif-list">
          {notifications.length === 0 ? (
            <div className="notif-empty">
              <span className="notif-empty-icon">✓</span>
              <span>All caught up!</span>
            </div>
          ) : (
            notifications.map(notif => (
              <div
                key={notif.id}
                className={`notif-item ${notif.read ? 'notif-item--read' : 'notif-item--unread'}`}
                onClick={() => handleItemClick(notif)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') handleItemClick(notif); }}
              >
                <div className="notif-icon">{notif.icon}</div>
                <div className="notif-text">
                  <div className="notif-title">
                    {notif.title}
                    <span
                      className="notif-priority-badge"
                      style={{ background: `${PRIORITY_COLORS[notif.priority]}20`, color: PRIORITY_COLORS[notif.priority], borderColor: `${PRIORITY_COLORS[notif.priority]}30` }}
                    >
                      {PRIORITY_LABELS[notif.priority]}
                    </span>
                  </div>
                  <div className="notif-subtitle">{notif.subtitle}</div>
                </div>
                <span className="notif-time">{relativeTime(notif.timestamp)}</span>
                <ChevronRight size={14} style={{ color: '#6B7280', flexShrink: 0 }} />
                <button
                  className="notif-dismiss-btn"
                  onClick={e => { e.stopPropagation(); onDismiss(notif.id); }}
                  aria-label="Dismiss notification"
                >
                  <X size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer actions */}
        {(unreadCount > 0 || notifications.length > 0) && (
          <div className="notif-footer">
            {unreadCount > 0 && (
              <button className="notif-footer-btn" onClick={onMarkAllRead}>Mark all read</button>
            )}
            {notifications.length > 0 && (
              <button className="notif-footer-btn notif-footer-btn--clear" onClick={onClearAll}>Dismiss all</button>
            )}
          </div>
        )}

        {/* History section */}
        {history.length > 0 && (
          <div className="notif-history">
            <button
              className="notif-history-toggle"
              onClick={() => setHistoryOpen(p => !p)}
            >
              <ChevronDown size={14} className={`notif-history-chevron ${historyOpen ? 'notif-history-chevron--open' : ''}`} />
              <span>History ({history.length})</span>
            </button>
            {historyOpen && (
              <div className="notif-history-list">
                {history.map(notif => (
                  <div
                    key={notif.id}
                    className="notif-item notif-item--history"
                    onClick={() => { if (notif.route) onNavigate(notif.route); }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="notif-icon">{notif.icon}</div>
                    <div className="notif-text">
                      <div className="notif-title">{notif.title}</div>
                      <div className="notif-subtitle">{notif.subtitle}</div>
                    </div>
                    <span className="notif-time">{relativeTime(notif.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}