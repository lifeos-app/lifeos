/**
 * SocialNotificationPanel — Notification center
 *
 * Bell icon with unread count badge, dropdown with categories,
 * tap to mark read and navigate, mark all as read, preferences.
 * Real-time via Supabase Realtime subscription.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  useNotificationStore,
  type NotificationCategory,
  type NotificationType,
  type SocialNotification,
} from '../../stores/notificationStore';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface SocialNotificationPanelProps {
  /** Current user ID for real-time subscriptions */
  userId?: string;
  /** Navigate to a path */
  onNavigate?: (path: string) => void;
}

type FilterTab = 'all' | 'social' | 'achievement' | 'warning' | 'event';

const CATEGORY_ICONS: Record<NotificationCategory, string> = {
  social: '👥',
  achievement: '🏆',
  warning: '⚠️',
  event: '🌌',
};

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  social: 'Social',
  achievement: 'Achievements',
  warning: 'Warnings',
  event: 'Events',
};

const TYPE_LABELS: Record<NotificationType, { label: string; icon: string }> = {
  new_message: { label: 'New Message', icon: '💬' },
  friend_request: { label: 'Friend Request', icon: '🤝' },
  friend_accepted: { label: 'Friend Accepted', icon: '🎉' },
  nudge: { label: 'Nudge', icon: '👆' },
  guild_invite: { label: 'Guild Invite', icon: '⚔️' },
  guild_activity: { label: 'Guild Activity', icon: '📊' },
  achievement_unlocked: { label: 'Achievement Unlocked', icon: '🏆' },
  streak_at_risk: { label: 'Streak at Risk', icon: '🔥' },
  level_up: { label: 'Level Up', icon: '⬆️' },
  realm_event: { label: 'Realm Event', icon: '🌌' },
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'border-l-4 border-l-red-500',
  normal: 'border-l-4 border-l-blue-500/30',
  low: 'border-l-4 border-l-gray-600/30',
};

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════

export function SocialNotificationPanel({
  userId,
  onNavigate,
}: SocialNotificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showPreferences, setShowPreferences] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    preferences,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updatePreferences,
    toggleType,
    getUnreadCount,
    getByCategory,
    subscribeToRealtime,
  } = useNotificationStore();

  const unreadCount = getUnreadCount();

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToRealtime(userId);
    return unsub;
  }, [userId, subscribeToRealtime]);

  // Close panel on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [isOpen]);

  // Filter notifications
  const filteredNotifications = activeFilter === 'all'
    ? notifications
    : getByCategory(activeFilter as NotificationCategory);

  const handleNotificationClick = useCallback((notif: SocialNotification) => {
    if (!notif.read) {
      markAsRead(notif.id);
    }
    if (notif.actionLink && onNavigate) {
      onNavigate(notif.actionLink);
    }
    setIsOpen(false);
  }, [markAsRead, onNavigate]);

  const handleMarkAllRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  const formatTimeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div className="social-notif-panel" ref={panelRef}>
      {/* Bell button */}
      <button
        className="social-notif-bell"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        🔔
        {unreadCount > 0 && (
          <span className="social-notif-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="social-notif-dropdown">
          {/* Header */}
          <div className="social-notif-header">
            <h3 className="social-notif-title">Notifications</h3>
            <div className="social-notif-header-actions">
              {unreadCount > 0 && (
                <button className="social-notif-action-btn" onClick={handleMarkAllRead}>
                  ✓ Mark all read
                </button>
              )}
              <button
                className="social-notif-action-btn"
                onClick={() => setShowPreferences(!showPreferences)}
              >
                ⚙️
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="social-notif-filters">
            {(['all', 'social', 'achievement', 'warning', 'event'] as FilterTab[]).map(tab => (
              <button
                key={tab}
                className={`social-notif-filter ${activeFilter === tab ? 'social-notif-filter--active' : ''}`}
                onClick={() => setActiveFilter(tab)}
              >
                {tab === 'all' ? 'All' : CATEGORY_ICONS[tab as NotificationCategory]}{' '}
                {tab === 'all' ? '' : CATEGORY_LABELS[tab as NotificationCategory]}
                {tab !== 'all' && (
                  <span className="social-notif-filter-count">
                    {getByCategory(tab as NotificationCategory).filter(n => !n.read).length || ''}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Preferences panel */}
          {showPreferences && (
            <div className="social-notif-prefs">
              <h4 className="social-notif-prefs-title">Notification Settings</h4>
              <label className="social-notif-pref-row">
                <input
                  type="checkbox"
                  checked={preferences.enabled}
                  onChange={(e) => updatePreferences({ enabled: e.target.checked })}
                />
                <span>Enable notifications</span>
              </label>
              <label className="social-notif-pref-row">
                <input
                  type="checkbox"
                  checked={preferences.pushEnabled}
                  onChange={(e) => updatePreferences({ pushEnabled: e.target.checked })}
                />
                <span>Push notifications</span>
              </label>
              <label className="social-notif-pref-row">
                <input
                  type="checkbox"
                  checked={preferences.soundEnabled}
                  onChange={(e) => updatePreferences({ soundEnabled: e.target.checked })}
                />
                <span>Sound</span>
              </label>
              <label className="social-notif-pref-row">
                <input
                  type="checkbox"
                  checked={preferences.digestEnabled}
                  onChange={(e) => updatePreferences({ digestEnabled: e.target.checked })}
                />
                <span>Daily digest</span>
              </label>
              <div className="social-notif-pref-divider" />
              <p className="social-notif-pref-subtitle">Notification types</p>
              {(Object.keys(TYPE_LABELS) as NotificationType[]).map(type => (
                <label key={type} className="social-notif-pref-row">
                  <input
                    type="checkbox"
                    checked={preferences.types[type]}
                    onChange={() => toggleType(type)}
                  />
                  <span>{TYPE_LABELS[type].icon} {TYPE_LABELS[type].label}</span>
                </label>
              ))}
            </div>
          )}

          {/* Notification list */}
          <div className="social-notif-list">
            {filteredNotifications.length === 0 && (
              <div className="social-notif-empty">
                {activeFilter === 'all' ? 'No notifications yet' : `No ${CATEGORY_LABELS[activeFilter as NotificationCategory]?.toLowerCase()} notifications`}
              </div>
            )}
            {filteredNotifications.slice(0, 30).map(notif => (
              <div
                key={notif.id}
                className={`social-notif-item ${!notif.read ? 'social-notif-item--unread' : ''} ${PRIORITY_STYLES[notif.priority] || ''}`}
                onClick={() => handleNotificationClick(notif)}
              >
                <div className="social-notif-item-icon">{notif.icon}</div>
                <div className="social-notif-item-content">
                  <div className="social-notif-item-title">{notif.title}</div>
                  <div className="social-notif-item-body">{notif.body}</div>
                  <div className="social-notif-item-time">{formatTimeAgo(notif.createdAt)}</div>
                </div>
                <button
                  className="social-notif-item-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notif.id);
                  }}
                  aria-label="Delete"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .social-notif-panel {
          position: relative;
          display: inline-flex;
        }
        .social-notif-bell {
          position: relative;
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.25rem;
          line-height: 1;
        }
        .social-notif-badge {
          position: absolute;
          top: -4px;
          right: -6px;
          background: #ef4444;
          color: white;
          font-size: 0.65rem;
          font-weight: 700;
          min-width: 1.25rem;
          height: 1.25rem;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          line-height: 1;
        }
        .social-notif-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          width: 380px;
          max-height: 500px;
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 0.75rem;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
          z-index: 100;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .social-notif-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .social-notif-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: white;
        }
        .social-notif-header-actions {
          display: flex;
          gap: 0.5rem;
        }
        .social-notif-action-btn {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 0.75rem;
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          border-radius: 0.375rem;
          transition: all 0.15s;
        }
        .social-notif-action-btn:hover {
          color: white;
          background: rgba(255,255,255,0.08);
        }
        .social-notif-filters {
          display: flex;
          overflow-x: auto;
          gap: 0.25rem;
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .social-notif-filter {
          font-size: 0.7rem;
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .social-notif-filter--active {
          background: rgba(59,130,246,0.2);
          color: #60a5fa;
          border-color: rgba(59,130,246,0.4);
        }
        .social-notif-filter:hover:not(.social-notif-filter--active) {
          background: rgba(255,255,255,0.05);
        }
        .social-notif-filter-count {
          margin-left: 0.25rem;
          background: rgba(239,68,68,0.8);
          color: white;
          font-size: 0.6rem;
          padding: 0 5px;
          border-radius: 9999px;
          min-width: 1rem;
          display: inline-block;
          text-align: center;
          line-height: 1.2;
        }
        .social-notif-list {
          overflow-y: auto;
          max-height: 320px;
          padding: 0.5rem 0;
        }
        .social-notif-empty {
          text-align: center;
          color: #64748b;
          font-size: 0.85rem;
          padding: 2rem 1rem;
        }
        .social-notif-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.6rem 1rem;
          cursor: pointer;
          transition: background 0.1s;
          position: relative;
        }
        .social-notif-item:hover {
          background: rgba(255,255,255,0.05);
        }
        .social-notif-item--unread {
          background: rgba(59,130,246,0.08);
        }
        .social-notif-item--unread:hover {
          background: rgba(59,130,246,0.15);
        }
        .social-notif-item-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
        }
        .social-notif-item-content {
          flex: 1;
          min-width: 0;
        }
        .social-notif-item-title {
          font-size: 0.8rem;
          font-weight: 600;
          color: white;
        }
        .social-notif-item-body {
          font-size: 0.7rem;
          color: #94a3b8;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .social-notif-item-time {
          font-size: 0.6rem;
          color: #64748b;
          margin-top: 0.15rem;
        }
        .social-notif-item-delete {
          position: absolute;
          right: 0.5rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #64748b;
          font-size: 1rem;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s;
          padding: 0.25rem;
        }
        .social-notif-item:hover .social-notif-item-delete {
          opacity: 1;
        }
        .social-notif-item-delete:hover {
          color: #ef4444;
        }
        /* Preferences */
        .social-notif-prefs {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          max-height: 250px;
          overflow-y: auto;
        }
        .social-notif-prefs-title {
          font-size: 0.8rem;
          font-weight: 600;
          color: white;
          margin: 0 0 0.5rem 0;
        }
        .social-notif-pref-subtitle {
          font-size: 0.7rem;
          font-weight: 600;
          color: #94a3b8;
          margin: 0.5rem 0 0.25rem 0;
        }
        .social-notif-pref-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: #e2e8f0;
          padding: 0.2rem 0;
          cursor: pointer;
        }
        .social-notif-pref-row input[type="checkbox"] {
          accent-color: #3b82f6;
        }
        .social-notif-pref-divider {
          height: 1px;
          background: rgba(255,255,255,0.08);
          margin: 0.5rem 0;
        }
      `}</style>
    </div>
  );
}