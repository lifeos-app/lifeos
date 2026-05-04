/**
 * DashboardSmartSchedule — Compact one-tap smart scheduling widget.
 *
 * Detects overdue/unscheduled tasks and shows a single "Auto-Schedule"
 * button that runs computeSmartSchedule and auto-creates events.
 * Uses glass card style consistent with other Dashboard widgets.
 */

import { useMemo, useState, useCallback } from 'react';
import { CalendarClock, Zap, CheckCircle2, Loader2 } from 'lucide-react';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useUserStore } from '../../stores/useUserStore';
import { computeSmartSchedule, DEFAULT_CONSTRAINTS, type ScheduleSlot } from '../../lib/smart-scheduler';
import { scheduleTaskAtTime } from '../../lib/task-scheduler';
import { supabase } from '../../lib/data-access';
import { showToast } from '../Toast';

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(17, 24, 39, 0.5)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 16,
  padding: 16,
  position: 'relative',
  overflow: 'hidden',
};

export function DashboardSmartSchedule() {
  const tasks = useScheduleStore(s => s.tasks);
  const events = useScheduleStore(s => s.events);
  const userId = useUserStore(s => s.user?.id);

  const [scheduling, setScheduling] = useState(false);
  const [lastScheduled, setLastScheduled] = useState<number | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Count overdue tasks
  const overdueCount = useMemo(() =>
    tasks.filter(t => {
      if (t.is_deleted || t.status === 'done' || t.status === 'completed') return false;
      return t.due_date && t.due_date < todayStr;
    }).length,
    [tasks, todayStr]
  );

  // Count unscheduled tasks
  const unscheduledCount = useMemo(() =>
    tasks.filter(t => {
      if (t.is_deleted || t.status === 'done' || t.status === 'completed') return false;
      return !t.due_date && !t.suggested_week && !t.scheduled_start;
    }).length,
    [tasks]
  );

  const totalActionable = overdueCount + unscheduledCount;

  // Don't render if nothing to schedule
  if (totalActionable === 0) return null;

  const handleAutoSchedule = useCallback(async () => {
    if (!userId || scheduling) return;
    setScheduling(true);
    setLastScheduled(null);

    try {
      const { data: { session } } = await useUserStore.getState().getSessionCached();
      if (!session?.user) {
        showToast('Not authenticated', '', '#F43F5E');
        return;
      }

      const actionable = tasks.filter((t: any) => {
        if (t.is_deleted || t.status === 'done' || t.status === 'completed') return false;
        const isOverdue = t.due_date && t.due_date < todayStr;
        const isUnscheduled = !t.due_date && !t.suggested_week && !t.scheduled_start;
        return isOverdue || isUnscheduled;
      });

      if (actionable.length === 0) {
        showToast('No tasks need scheduling', '', '#8BA4BE');
        return;
      }

      const slots = computeSmartSchedule(actionable, events, DEFAULT_CONSTRAINTS);
      let scheduled = 0;

      for (const slot of slots) {
        if (slot.conflict) continue; // Skip conflict slots in auto mode
        const task = actionable.find((t: any) => t.id === slot.taskId);
        if (!task) continue;
        const startTime = `${slot.suggestedDate}T${slot.suggestedStartTime}:00`;
        const endTime = `${slot.suggestedDate}T${slot.suggestedEndTime}:00`;
        const result = await scheduleTaskAtTime(supabase, session.user.id, task, startTime, endTime);
        if (result) scheduled++;
      }

      if (scheduled > 0) {
        showToast(`Auto-scheduled ${scheduled} task${scheduled !== 1 ? 's' : ''}`, '', '#39FF14');
        window.dispatchEvent(new Event('lifeos-refresh'));
        useScheduleStore.getState().invalidate();
        setLastScheduled(scheduled);
      } else {
        showToast('No tasks could be auto-scheduled', '', '#8BA4BE');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Auto-schedule failed';
      showToast(msg, '', '#F43F5E');
    } finally {
      setScheduling(false);
    }
  }, [userId, scheduling, tasks, events, todayStr]);

  const accentColor = overdueCount > 0 ? '#F97316' : '#39FF14';

  return (
    <div className="dash-card" style={{
      ...CARD_STYLE,
      border: `1px solid ${accentColor}18`,
    }}>
      {/* Subtle glow */}
      <div style={{
        position: 'absolute', top: -15, right: -15,
        width: 60, height: 60, borderRadius: '50%',
        background: `radial-gradient(circle, ${accentColor}12 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{
        fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 10,
      }}>
        <CalendarClock size={14} color={accentColor} />
        Smart Schedule
      </div>

      {/* Task summary */}
      <div style={{ marginBottom: 10 }}>
        {overdueCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 4, fontSize: 12, color: 'rgba(255,255,255,0.7)',
          }}>
            <Zap size={11} color="#F97316" style={{ flexShrink: 0 }} />
            <span>
              <strong style={{ color: '#F97316' }}>{overdueCount}</strong>
              {' '}overdue task{overdueCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {unscheduledCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 4, fontSize: 12, color: 'rgba(255,255,255,0.7)',
          }}>
            <CalendarClock size={11} color="#00D4FF" style={{ flexShrink: 0 }} />
            <span>
              <strong style={{ color: '#00D4FF' }}>{unscheduledCount}</strong>
              {' '}unscheduled task{unscheduledCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Success message */}
      {lastScheduled !== null && !scheduling && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          marginBottom: 8, fontSize: 11, color: '#39FF14',
        }}>
          <CheckCircle2 size={11} />
          <span>{lastScheduled} task{lastScheduled !== 1 ? 's' : ''} scheduled</span>
        </div>
      )}

      {/* Auto-Schedule button */}
      <button
        onClick={handleAutoSchedule}
        disabled={scheduling || !userId}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '7px 14px',
          background: scheduling ? 'rgba(255,255,255,0.04)' : `${accentColor}15`,
          border: `1px solid ${scheduling ? 'rgba(255,255,255,0.06)' : `${accentColor}30`}`,
          borderRadius: 8,
          color: scheduling ? 'rgba(255,255,255,0.3)' : accentColor,
          fontSize: 12, fontWeight: 600,
          cursor: scheduling || !userId ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          width: '100%',
          justifyContent: 'center',
        }}
      >
        {scheduling ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            Auto-Scheduling...
          </>
        ) : (
          <>
            <Zap size={12} />
            Auto-Schedule ({totalActionable})
          </>
        )}
      </button>
    </div>
  );
}