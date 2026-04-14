/**
 * JobCompleteButton — One-tap job completion for TCS
 *
 * Marks a schedule event as 'completed', auto-creates an income entry + transaction,
 * awards XP, and provides visual feedback. Uses venue rate from TCS_CONFIG.
 */

import { useState, useCallback } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/data-access';
import { TCS_CONFIG } from '../../lib/tcs-config';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useUserStore } from '../../stores/useUserStore';
import { useGamificationContext } from '../../lib/gamification/context';
import { genId, todayStr, fmtCurrency } from '../../utils/date';
import './JobCompleteButton.css';

export interface JobCompleteButtonProps {
  /** Schedule event ID to mark completed */
  eventId: string;
  /** Venue name — matched against TCS_CONFIG.venues to find the rate */
  venueName: string;
  /** Current status of the schedule event */
  currentStatus: string;
  /** Optional callback after successful completion */
  onCompleted?: () => void;
}

export function JobCompleteButton({
  eventId,
  venueName,
  currentStatus,
  onCompleted,
}: JobCompleteButtonProps) {
  const user = useUserStore(s => s.user);
  const { awardXP } = useGamificationContext();
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Look up venue rate from TCS_CONFIG
  const venue = TCS_CONFIG.venues.find(
    v => v.name.toLowerCase() === venueName.toLowerCase()
  );
  const rate = venue ? venue.rate : 0;

  // Already completed — show static green check
  if (currentStatus === 'completed') {
    return (
      <div className="job-complete-done">
        <CheckCircle2 size={20} className="job-complete-done-icon" />
      </div>
    );
  }

  // No matching venue — rate unknown
  if (!venue) {
    return (
      <div className="job-complete-unknown">
        <span className="job-complete-unknown-text">No rate for {venueName}</span>
      </div>
    );
  }

  const handleComplete = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    setFeedback(null);

    try {
      const dateStr = todayStr();

      // 1. Mark schedule event as completed
      const { error: updateErr } = await supabase
        .from('schedule_events')
        .update({ status: 'completed' })
        .eq('id', eventId);

      if (updateErr) {
        setFeedback('Failed to mark event complete');
        setProcessing(false);
        return;
      }

      // 2. Insert income + transaction rows
      const incId = genId();
      const txId = genId();
      const description = `Cleaning - ${venueName}`;

      const [incErr, txErr] = await Promise.all([
        supabase.from('income').insert({
          id: incId,
          user_id: user?.id,
          amount: rate,
          date: dateStr,
          description,
          source: 'TCS Cleaning',
          client_id: null,
          is_recurring: false,
        }).then(r => r.error),
        supabase.from('transactions').insert({
          id: txId,
          user_id: user?.id,
          type: 'income',
          amount: rate,
          title: description,
          date: dateStr,
          business_id: null,
          client_id: null,
          recurring: false,
          notes: JSON.stringify({ auto_from_job: true }),
        }).then(r => r.error),
      ]);

      if (incErr || txErr) {
        setFeedback('Failed to create income entry');
        setProcessing(false);
        return;
      }

      // 3. Award 50 XP (non-critical)
      try {
        await awardXP('job_complete', { venue: venueName, amount: rate });
      } catch {
        // Don't block on gamification failure
      }

      // 4. Invalidate caches
      useScheduleStore.getState().invalidate();
      useFinanceStore.getState().invalidate();

      // 5. Visual feedback
      setFeedback(`${fmtCurrency(rate)} recorded`);
      setTimeout(() => setFeedback(null), 2500);

      // 6. Callback
      onCompleted?.();
    } catch (err) {
      setFeedback('Something went wrong');
    } finally {
      setProcessing(false);
    }
  }, [processing, eventId, venueName, rate, user?.id, awardXP, onCompleted]);

  return (
    <div className="job-complete-wrapper">
      <button
        className="job-complete-btn"
        onClick={handleComplete}
        disabled={processing}
        type="button"
      >
        {processing ? (
          <Loader2 size={16} className="job-complete-spinner" />
        ) : (
          <CheckCircle2 size={16} />
        )}
        <span className="job-complete-btn-text">Done</span>
        <span className="job-complete-btn-rate">{fmtCurrency(rate)}</span>
      </button>
      {feedback && (
        <div className="job-complete-feedback">
          <CheckCircle2 size={14} />
          <span>{feedback}</span>
        </div>
      )}
    </div>
  );
}