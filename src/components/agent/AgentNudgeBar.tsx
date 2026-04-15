import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAgentStore } from '../../stores/useAgentStore';
import { useUserStore } from '../../stores/useUserStore';
import type { AgentAction } from '../../lib/zeroclaw-client';
import './AgentNudgeBar.css';

const PRIORITY_ICONS: Record<string, string> = {
  urgent: '🚨',
  high: '⚡',
  medium: '💡',
  low: 'ℹ️',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#F43F5E',
  high: '#F97316',
  medium: '#00D4FF',
  low: '#5A7A9A',
};

const SNOOZE_KEY = 'lifeos-nudge-snoozed-';
const DISMISSED_KEY = 'lifeos-nudge-dismissed';

function isSnoozed(nudgeType: string): boolean {
  try {
    const until = localStorage.getItem(`${SNOOZE_KEY}${nudgeType}`);
    if (!until) return false;
    return Date.now() < Number(until);
  } catch { return false; }
}

function snoozeNudge(nudgeType: string, durationMs = 60 * 60 * 1000) {
  try {
    localStorage.setItem(`${SNOOZE_KEY}${nudgeType}`, String(Date.now() + durationMs));
  } catch { /* silent */ }
}

// Persistent dismissed IDs — survive page reload / re-navigation
function getDismissedIds(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (!stored) return new Set();
    return new Set(JSON.parse(stored));
  } catch { return new Set(); }
}

function saveDismissedId(nudgeType: string) {
  try {
    const ids = getDismissedIds();
    // Store by type (not ID) so same-type nudges from re-fetches are also blocked
    ids.add(nudgeType);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch { /* silent */ }
}

function isPersistentlyDismissed(nudgeType: string): boolean {
  return getDismissedIds().has(nudgeType);
}

export function AgentNudgeBar() {
  const { user, profile } = useUserStore();
  const { nudges, fetchNudges, dismissNudge, executeAction } = useAgentStore();
  const navigate = useNavigate();
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const mountedRef = useRef(true);

  // Don't show nudges for new/unboarded users — poor first experience
  if (!profile?.onboarding_complete) return null;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!user) return;

    fetchNudges(user.id);
    const interval = setInterval(() => fetchNudges(user.id), 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, fetchNudges]);

  const handleDismiss = useCallback((nudgeId: string, nudgeType: string) => {
    setDismissingIds(prev => new Set(prev).add(nudgeId));
    // Persist the dismissal so it doesn't reappear on next dashboard visit
    saveDismissedId(nudgeType);
    // Wait for slide-out animation, then actually dismiss
    setTimeout(() => {
      dismissNudge(nudgeId);
      if (mountedRef.current) {
        setDismissingIds(prev => { const next = new Set(prev); next.delete(nudgeId); return next; });
      }
    }, 300);
  }, [dismissNudge]);

  const handleSnooze = useCallback((nudgeId: string, nudgeType: string) => {
    snoozeNudge(nudgeType);
    handleDismiss(nudgeId, nudgeType);
  }, [handleDismiss]);

  const handleAskAI = useCallback((nudgeTitle: string, nudgeSummary: string) => {
    // Open AI chat with context about this nudge
    const message = `Tell me more about this: "${nudgeTitle}" — ${nudgeSummary}`;
    const event = new CustomEvent('voice-fab-to-chat', { detail: { message } });
    document.dispatchEvent(event);
  }, []);

  const handleActionClick = async (action: AgentAction, nudgeId: string, nudgeType: string) => {
    if (!user) return;

    if (action.requiresConfirm && !confirm(`${action.label}?`)) return;

    // Handle navigate actions directly
    if (action.type === 'navigate' && action.payload?.path) {
      navigate(action.payload.path as string);
      handleDismiss(nudgeId, nudgeType);
      return;
    }

    const success = await executeAction(user.id, action);
    if (success) {
      handleDismiss(nudgeId, nudgeType);
    }
  };

  // Filter out snoozed, persistently dismissed, and already-dismissed nudges;
  // show max 1 nudge to avoid blocking the dashboard
  const activeNudges = nudges
    .filter(n => !n.dismissed && !isSnoozed(n.type) && !isPersistentlyDismissed(n.type))
    .slice(0, 1);

  if (activeNudges.length === 0) return null;

  return (
    <div className="agent-nudge-bar">
      {activeNudges.map((nudge) => {
        const isUrgent = nudge.priority === 'urgent';
        const isDismissing = dismissingIds.has(nudge.id);

        return (
          <div
            key={nudge.id}
            className={`agent-nudge${isDismissing ? ' agent-nudge-exit' : ''}${isUrgent ? ' agent-nudge-urgent' : ''}`}
            style={{ borderLeftColor: PRIORITY_COLORS[nudge.priority] || PRIORITY_COLORS.medium }}
          >
            <div className="agent-nudge-icon">
              {PRIORITY_ICONS[nudge.priority] || PRIORITY_ICONS.medium}
            </div>
            <div className="agent-nudge-content">
              <div className="agent-nudge-header">
                <h4 className="agent-nudge-title">{nudge.title}</h4>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    className="agent-nudge-snooze"
                    onClick={() => handleSnooze(nudge.id, nudge.type)}
                    title="Snooze for 1 hour"
                  >
                    💤
                  </button>
                  <button
                    className="agent-nudge-dismiss"
                    onClick={() => handleDismiss(nudge.id, nudge.type)}
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
              </div>
              <p className="agent-nudge-summary">{nudge.summary}</p>
              <div className="agent-nudge-actions">
                {nudge.actions && nudge.actions.map((action, i) => (
                  <button
                    key={i}
                    className="agent-nudge-action-btn"
                    onClick={() => handleActionClick(action, nudge.id, nudge.type)}
                    style={{ borderColor: PRIORITY_COLORS[nudge.priority] }}
                  >
                    {action.label}
                  </button>
                ))}
                <button
                  className="agent-nudge-action-btn agent-nudge-ask-ai"
                  onClick={() => handleAskAI(nudge.title, nudge.summary)}
                  title="Ask AI about this nudge"
                >
                  <Sparkles size={12} /> Ask AI
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
