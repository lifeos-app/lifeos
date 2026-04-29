/**
 * PushNotificationSetup — UI for enabling push notifications,
 * viewing permission status, schedule preview, and testing.
 *
 * Dark theme, Lucide icons only, no emoji.
 * Permission is OPT-IN — never auto-requests.
 */
import { useState, useEffect, useCallback, type JSX } from 'react';
import {
  Bell, BellOff, Clock, Send, Check, X, AlertTriangle,
  Loader2, RefreshCw, Trash2,
} from 'lucide-react';
import {
  pushManager,
  notificationScheduler,
  type ScheduledNotification,
} from '../lib/web-push';
import {
  getPreferences,
  isQuietHourNow,
  type NotificationPreferences,
} from '../lib/notification-preferences';

// ── Status indicator ──

function StatusBadge({ status }: { status: NotificationPermission }): JSX.Element {
  if (status === 'granted') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
        background: 'rgba(34,197,94,0.12)', color: '#22C55E',
        border: '1px solid rgba(34,197,94,0.2)',
      }}>
        <Check size={12} /> Granted
      </span>
    );
  }
  if (status === 'denied') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
        background: 'rgba(239,68,68,0.12)', color: '#EF4444',
        border: '1px solid rgba(239,68,68,0.2)',
      }}>
        <X size={12} /> Denied
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
      background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <Clock size={12} /> Default
    </span>
  );
}

// ── Notification Type Labels ──

const TYPE_LABELS: Record<string, string> = {
  morning_checkin: 'Morning Check-in',
  evening_review: 'Evening Review',
  streak_check: 'Streak Check',
  habit_reminder: 'Habit Reminder',
  goal_checkin: 'Goal Check-in',
  system: 'System',
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── Main Component ──

export function PushNotificationSetup(): JSX.Element {
  const [permission, setPermission] = useState<NotificationPermission>(
    pushManager.getPermissionStatus(),
  );
  const [subscribed, setSubscribed] = useState(pushManager.isSubscribed());
  const [scheduled, setScheduled] = useState<ScheduledNotification[]>(
    notificationScheduler.getScheduledNotifications(),
  );
  const [prefs, setPrefs] = useState<NotificationPreferences>(getPreferences);
  const [requesting, setRequesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [testFailed, setTestFailed] = useState(false);
  const [quietNow, setQuietNow] = useState(isQuietHourNow());

  // Refresh state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setPermission(pushManager.getPermissionStatus());
      setSubscribed(pushManager.isSubscribed());
      setScheduled(notificationScheduler.getScheduledNotifications());
      setQuietNow(isQuietHourNow());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRequestPermission = useCallback(async () => {
    setRequesting(true);
    try {
      const granted = await pushManager.requestPermission();
      setPermission(granted ? 'granted' : 'denied');
      if (granted) {
        await pushManager.subscribe();
        setSubscribed(true);
        // Set up notifications from preferences
        notificationScheduler.scheduleFromPreferences(getPreferences());
        setScheduled(notificationScheduler.getScheduledNotifications());
      }
    } catch {
      setPermission('denied');
    } finally {
      setRequesting(false);
    }
  }, []);

  const handleUnsubscribe = useCallback(async () => {
    await pushManager.unsubscribe();
    setSubscribed(false);
    notificationScheduler.destroy();
    setScheduled([]);
  }, []);

  const handleTestNotification = useCallback(() => {
    setSendingTest(true);
    setTestSent(false);
    setTestFailed(false);

    const delivered = notificationScheduler.deliverNow(
      'LifeOS Test',
      'This is a test notification. If you see this, push notifications are working!',
      { tag: 'test' },
    );

    setTimeout(() => {
      setSendingTest(false);
      if (delivered) {
        setTestSent(true);
        setTimeout(() => setTestSent(false), 3000);
      } else {
        setTestFailed(true);
        setTimeout(() => setTestFailed(false), 4000);
      }
    }, 300);
  }, []);

  const handleCancelNotification = useCallback((id: string) => {
    notificationScheduler.cancelNotification(id);
    setScheduled(notificationScheduler.getScheduledNotifications());
  }, []);

  const handleReschedule = useCallback(() => {
    const currentPrefs = getPreferences();
    notificationScheduler.scheduleFromPreferences(currentPrefs);
    setScheduled(notificationScheduler.getScheduledNotifications());
    setPrefs(currentPrefs);
  }, []);

  const isAvailable = pushManager.isNotificationAvailable();

  return (
    <section className="set-section">
      <div className="set-section-header">
        {subscribed ? <Bell size={18} /> : <BellOff size={18} />}
        <h2>Push Notifications</h2>
        <StatusBadge status={permission} />
      </div>
      <p className="set-section-desc">
        Enable browser notifications to receive reminders and insights even when the app is closed.
      </p>

      {!isAvailable && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 10,
          border: '1px solid rgba(239,68,68,0.2)',
          background: 'rgba(239,68,68,0.06)',
          marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)',
        }}>
          <AlertTriangle size={14} style={{ color: '#EF4444', flexShrink: 0 }} />
          Push notifications are not supported in this browser.
          In-app toasts will be used as a fallback.
        </div>
      )}

      {/* Permission request */}
      {permission !== 'granted' && isAvailable && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderRadius: 12, marginTop: 10,
          border: '1px solid rgba(0,212,255,0.15)',
          background: 'rgba(0,212,255,0.04)',
        }}>
          <Bell size={20} style={{ color: '#00D4FF', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
              Enable Notifications
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              You will be prompted by your browser to allow notifications.
            </div>
          </div>
          <button
            className="set-btn"
            style={{
              background: 'rgba(0,212,255,0.15)',
              border: '1px solid rgba(0,212,255,0.3)',
              color: '#00D4FF', padding: '8px 16px', fontSize: 13,
              borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
            onClick={handleRequestPermission}
            disabled={requesting || permission === 'denied'}
          >
            {requesting ? <Loader2 size={14} className="spin" /> : <Bell size={14} />}
            {permission === 'denied' ? 'Blocked' : 'Enable'}
          </button>
        </div>
      )}

      {permission === 'denied' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 10,
          border: '1px solid rgba(239,68,68,0.2)',
          background: 'rgba(239,68,68,0.06)',
          marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.6)',
        }}>
          <AlertTriangle size={14} style={{ color: '#EF4444', flexShrink: 0 }} />
          Notifications are blocked. To re-enable, update your browser settings for this site.
        </div>
      )}

      {/* Active controls */}
      {permission === 'granted' && (
        <>
          {/* Test notification */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 10, marginTop: 10,
            border: '1px solid rgba(26,58,92,0.15)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <Send size={16} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
              Test Notification
            </span>
            <button
              className="set-btn"
              style={{
                background: 'rgba(0,212,255,0.1)',
                border: '1px solid rgba(0,212,255,0.25)',
                color: '#00D4FF', padding: '6px 14px', fontSize: 12,
                borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
              onClick={handleTestNotification}
              disabled={sendingTest}
            >
              {sendingTest ? <Loader2 size={12} className="spin" /> : <Send size={12} />}
              Send Test
            </button>
            {testSent && (
              <span style={{ fontSize: 12, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Check size={12} /> Sent
              </span>
            )}
            {testFailed && (
              <span style={{ fontSize: 12, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                <X size={12} /> Failed
              </span>
            )}
          </div>

          {/* Reschedule & Unsubscribe */}
          <div style={{
            display: 'flex', gap: 8, marginTop: 10,
          }}>
            <button
              className="set-btn"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(26,58,92,0.2)',
                color: 'rgba(255,255,255,0.7)', padding: '6px 14px', fontSize: 12,
                borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
              onClick={handleReschedule}
            >
              <RefreshCw size={12} /> Reschedule
            </button>
            <button
              className="set-btn"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: 'rgba(239,68,68,0.8)', padding: '6px 14px', fontSize: 12,
                borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
              onClick={handleUnsubscribe}
            >
              <BellOff size={12} /> Disable
            </button>
          </div>

          {/* Quiet hours indicator */}
          {quietNow && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 10,
              border: '1px solid rgba(139,92,246,0.2)',
              background: 'rgba(139,92,246,0.06)',
              marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.6)',
            }}>
              <BellOff size={14} style={{ color: '#8B5CF6', flexShrink: 0 }} />
              Quiet hours are active — notifications will be held until they end.
            </div>
          )}

          {/* Quiet hours info */}
          {prefs.quietHours.enabled && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 10,
              border: '1px solid rgba(26,58,92,0.15)',
              background: 'rgba(255,255,255,0.02)',
              marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)',
            }}>
              <Clock size={14} style={{ flexShrink: 0 }} />
              Quiet hours: {prefs.quietHours.startTime} – {prefs.quietHours.endTime}
            </div>
          )}
        </>
      )}

      {/* Scheduled notifications preview */}
      {scheduled.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
          }}>
            <Clock size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>
              Upcoming Notifications ({scheduled.length})
            </span>
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            maxHeight: 200, overflowY: 'auto',
          }}>
            {scheduled.slice(0, 10).map(n => (
              <div
                key={n.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8,
                  border: '1px solid rgba(26,58,92,0.12)',
                  background: 'rgba(255,255,255,0.015)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 500,
                    color: 'rgba(255,255,255,0.75)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {n.title}
                  </div>
                  <div style={{
                    fontSize: 11, color: 'rgba(255,255,255,0.4)',
                    marginTop: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {n.body}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                    {formatDate(n.scheduledTime)} {formatTime(n.scheduledTime)}
                  </span>
                  <span style={{
                    fontSize: 10, color: 'rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.04)', padding: '1px 6px',
                    borderRadius: 4,
                  }}>
                    {TYPE_LABELS[n.type] || n.type}
                  </span>
                </div>
                {!n.recurring && (
                  <button
                    onClick={() => handleCancelNotification(n.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 4, color: 'rgba(255,255,255,0.25)', flexShrink: 0,
                    }}
                    title="Cancel notification"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
            {scheduled.length > 10 && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', padding: '4px 0', textAlign: 'center' }}>
                +{scheduled.length - 10} more
              </div>
            )}
          </div>
        </div>
      )}

      {subscribed && scheduled.length === 0 && (
        <div style={{
          fontSize: 12, color: 'rgba(255,255,255,0.35)',
          padding: '10px 0', textAlign: 'center',
        }}>
          No upcoming notifications scheduled. Click Reschedule to set up daily reminders.
        </div>
      )}
    </section>
  );
}