/**
 * EventExpiryNudge — "Still going?" prompt when a scheduled event expires
 *
 * Shows for 5 minutes after an event's end_time passes.
 * Options: "Done" (complete + award XP) or "Extend 30m" (push end_time forward)
 * Auto-completes silently after 5 minutes if no interaction.
 */

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Clock, Timer, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { showToast } from './Toast';
import type { ScheduleEvent } from '../hooks/useCurrentEvent';
import './EventExpiryNudge.css';
import { logger } from '../utils/logger';

// Module-level dedup guard: tracks event IDs that recently received XP
const _recentlyAwardedEvents = new Set<string>();

interface Props {
  event: ScheduleEvent;
  onDismiss: () => void;
  onRefresh: () => void;
}

export function EventExpiryNudge({ event, onDismiss, onRefresh }: Props) {
  const [acting, setActing] = useState(false);
  const userId = useUserStore(s => s.user?.id);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem('lifeos-expiry-dismissed');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  // Auto-complete after 5 minutes (the nudge window)
  useEffect(() => {
    const timer = setTimeout(() => {
      handleComplete(true);
    }, 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [event.id]);

  // Already dismissed this event?
  if (dismissed.has(event.id)) return null;

  const persistDismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    try {
      sessionStorage.setItem('lifeos-expiry-dismissed', JSON.stringify([...next]));
    } catch { /* ignore */ }
  };

  const handleComplete = async (silent = false) => {
    setActing(true);
    try {
      // Mark event as completed
      await supabase.from('schedule_events').update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      }).eq('id', event.id);

      // Award XP — use userId from store instead of network call
      if (userId && !_recentlyAwardedEvents.has(event.id)) {
        const startMs = new Date(event.start_time).getTime();
        const endMs = new Date(event.end_time).getTime();
        const durationMin = Math.round((endMs - startMs) / 60000);

        if (durationMin >= 5) {
          const baseXP = Math.max(10, Math.min(100, Math.round(durationMin * 0.5)));

          // Check hourly cap
          const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
          const { data: recent } = await supabase
            .from('event_completions')
            .select('xp_awarded')
            .eq('user_id', userId)
            .gte('completed_at', oneHourAgo);

          const recentXP = (recent || []).reduce((sum, c) => sum + (c.xp_awarded || 0), 0);
          const xpAmount = Math.min(200 - recentXP, baseXP);

          if (xpAmount > 0) {
            // Mark as awarded BEFORE the insert to prevent concurrent attempts
            _recentlyAwardedEvents.add(event.id);
            setTimeout(() => _recentlyAwardedEvents.delete(event.id), 60_000);

            await supabase.from('event_completions').insert({
              user_id: userId,
              schedule_event_id: event.id,
              event_type: event.event_type || 'generic',
              duration_min: durationMin,
              xp_awarded: xpAmount,
              metadata: { title: event.title, auto_completed: silent },
            });

            if (!silent) {
              showToast(`Completed! +${xpAmount} XP`, 'success');
            }
          }
        }
      }

      window.dispatchEvent(new Event('lifeos-refresh'));
    } catch (err) {
      logger.warn('Expiry complete error:', err);
      if (!silent) showToast('Failed to complete event', 'error');
    } finally {
      setActing(false);
      persistDismiss(event.id);
      onDismiss();
      onRefresh();
    }
  };

  const handleExtend = async () => {
    setActing(true);
    try {
      const currentEnd = new Date(event.end_time);
      const newEnd = new Date(currentEnd.getTime() + 30 * 60 * 1000); // +30 minutes

      await supabase.from('schedule_events').update({
        end_time: newEnd.toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', event.id);

      showToast('Extended 30 minutes', 'success');
      window.dispatchEvent(new Event('lifeos-refresh'));
    } catch (err) {
      logger.warn('Expiry extend error:', err);
      showToast('Failed to extend event', 'error');
    } finally {
      setActing(false);
      persistDismiss(event.id);
      onDismiss();
      onRefresh();
    }
  };

  const handleDismissClick = () => {
    persistDismiss(event.id);
    onDismiss();
  };

  // Calculate how long ago it expired
  const expiredAgo = Math.round((Date.now() - new Date(event.end_time).getTime()) / 60000);

  return (
    <div className="expiry-nudge">
      <div className="expiry-nudge-header">
        <Timer size={13} className="expiry-nudge-icon" />
        <span className="expiry-nudge-label">Still going?</span>
        <button className="expiry-nudge-dismiss" onClick={handleDismissClick} aria-label="Dismiss">
          <X size={12} />
        </button>
      </div>

      <div className="expiry-nudge-body">
        <span className="expiry-nudge-title">{event.title}</span>
        <span className="expiry-nudge-meta">
          ended {expiredAgo < 1 ? 'just now' : `${expiredAgo}m ago`}
        </span>
      </div>

      <div className="expiry-nudge-actions">
        <button
          className="expiry-nudge-btn expiry-nudge-btn--done"
          onClick={() => handleComplete(false)}
          disabled={acting}
        >
          <CheckCircle2 size={13} />
          <span>Done</span>
        </button>
        <button
          className="expiry-nudge-btn expiry-nudge-btn--extend"
          onClick={handleExtend}
          disabled={acting}
        >
          <Clock size={13} />
          <span>+30 min</span>
        </button>
      </div>
    </div>
  );
}
