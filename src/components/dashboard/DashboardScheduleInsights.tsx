/**
 * DashboardScheduleInsights — Compact predictive scheduling widget.
 *
 * Surfaces overdue tasks, unscheduled items, energy-aware hints,
 * and pattern-based schedule predictions with "Schedule" action.
 * Only renders when there are insights to show.
 */

import { useMemo, useState, useCallback } from 'react';
import { Clock, CalendarClock, Zap, RefreshCw, AlertTriangle, Brain, Sparkles, Timer } from 'lucide-react';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useHealthStore } from '../../stores/useHealthStore';
import { useUserStore } from '../../stores/useUserStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useOverdueItems } from '../../hooks/useOverdueItems';
import { predictScheduleSuggestions, type ScheduleSlotSuggestion } from '../../lib/pattern-engine';
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

const SLOT_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  peak_focus: { icon: <Zap size={12} />, color: '#39FF14', label: 'Peak Focus' },
  energy_light: { icon: <Timer size={12} />, color: '#A855F7', label: 'Energy-Aware' },
  habit_anchoring: { icon: <Sparkles size={12} />, color: '#00D4FF', label: 'Habit Stack' },
  goal_neglect_recovery: { icon: <Brain size={12} />, color: '#F97316', label: 'Goal Recovery' },
};

export function DashboardScheduleInsights() {
  const tasks = useScheduleStore(s => s.tasks);
  const healthMetrics = useHealthStore(s => s.todayMetrics);
  const userId = useUserStore(s => s.user?.id);
  const { habits, logs: habitLogs } = useHabitsStore(s => ({ habits: s.habits, logs: s.logs }));
  const goals = useGoalsStore(s => s.goals);
  const bills = useFinanceStore(s => s.bills);
  const { overdueTasks, totalCount: overdueCount } = useOverdueItems();

  const [rescheduling, setRescheduling] = useState(false);
  const [schedulingSlot, setSchedulingSlot] = useState<string | null>(null);

  // Unscheduled: active tasks with no due_date and no suggested_week
  const unscheduledCount = useMemo(() =>
    tasks.filter(t =>
      !t.is_deleted &&
      t.status !== 'done' &&
      t.status !== 'cancelled' &&
      !t.due_date &&
      !t.suggested_week
    ).length,
    [tasks]
  );

  // Energy-aware hint: energy_score 1-3 on a 1-5 scale → low energy
  const energyHint = useMemo(() => {
    const score = healthMetrics?.energy_score;
    if (score != null && score <= 2) return 'low';
    return null;
  }, [healthMetrics]);

  // Top 2 suggestions — show most overdue tasks as quick insight
  const topOverdue = useMemo(() =>
    overdueTasks.slice(0, 2).map(t => ({
      id: t.id,
      title: t.title,
      daysOverdue: t.daysOverdue,
      priority: t.priority,
    })),
    [overdueTasks]
  );

  // Pattern-based predictive schedule suggestions
  const schedulePredictions = useMemo<ScheduleSlotSuggestion[]>(() => {
    if (!tasks || tasks.length < 3) return [];
    try {
      return predictScheduleSuggestions(
        tasks, habits ?? [], habitLogs ?? [], goals ?? [], bills ?? [],
      ).slice(0, 2); // max 2 predictions shown
    } catch {
      return [];
    }
  }, [tasks, habits, habitLogs, goals, bills]);

  const handleReschedule = useCallback(async () => {
    if (!userId || rescheduling) return;
    setRescheduling(true);

    try {
      const { getAIRescheduleSuggestions, applyAllReschedules } = await import('../../lib/llm/reschedule');

      const result = await getAIRescheduleSuggestions(userId, overdueTasks, []);

      if (result.error) {
        showToast(result.error, '', '#F43F5E');
        return;
      }

      if (result.suggestions.length === 0) {
        showToast('No reschedule suggestions available', '', '#8BA4BE');
        return;
      }

      const { successCount, failCount } = await applyAllReschedules(result.suggestions);

      if (successCount > 0) {
        showToast(`Rescheduled ${successCount} item${successCount !== 1 ? 's' : ''}`, '', '#39FF14');
        useScheduleStore.getState().invalidate();
      }
      if (failCount > 0) {
        showToast(`${failCount} item${failCount !== 1 ? 's' : ''} failed to reschedule`, '', '#F43F5E');
      }

      if (result.summary) {
        showToast(result.summary, '', '#00D4FF');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reschedule failed';
      showToast(msg, '', '#F43F5E');
    } finally {
      setRescheduling(false);
    }
  }, [userId, rescheduling, overdueTasks]);

  // Schedule a predicted time block as a calendar event
  const handleSchedulePrediction = useCallback(async (slot: ScheduleSlotSuggestion) => {
    if (!userId || schedulingSlot) return;
    setSchedulingSlot(slot.id);

    try {
      const db = (await import('../../lib/data-access')).db;
      const now = new Date();
      // Find the next occurrence of the suggested day (or today if any day)
      let targetDate = new Date(now);
      if (slot.dayOfWeek >= 0) {
        const daysUntil = (slot.dayOfWeek - now.getDay() + 7) % 7;
        const isPast = daysUntil === 0 && now.getHours() >= parseInt(slot.startTime.split(':')[0]);
        targetDate.setDate(now.getDate() + (isPast ? 7 : daysUntil));
      }

      const [startH, startM] = slot.startTime.split(':').map(Number);
      const [endH, endM] = slot.endTime.split(':').map(Number);
      const startTime = new Date(targetDate);
      startTime.setHours(startH, startM, 0, 0);
      const endTime = new Date(targetDate);
      endTime.setHours(endH, endM, 0, 0);

      // Map slot type to event type
      const eventTypeMap: Record<string, string> = {
        peak_focus: 'work',
        energy_light: 'personal',
        habit_anchoring: 'health',
        goal_neglect_recovery: 'education',
      };

      const row = {
        user_id: userId,
        title: slot.title,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        description: `AI-suggested based on your patterns. ${slot.description}`,
        event_type: eventTypeMap[slot.type] || 'general',
        schedule_layer: 'primary' as const,
        source: 'system' as const,
        color: slot.type === 'peak_focus' ? '#39FF14' : slot.type === 'energy_light' ? '#A855F7' : slot.type === 'habit_anchoring' ? '#00D4FF' : '#F97316',
        day_type: 'productive',
        is_live: false,
      };

      await db.from('schedule_events').insert(row);
      useScheduleStore.getState().invalidate();
      showToast(`Scheduled: ${slot.title}`, ` ${slot.startTime}–${slot.endTime}`, '#39FF14');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Schedule failed';
      showToast(msg, '', '#F43F5E');
    } finally {
      setSchedulingSlot(null);
    }
  }, [userId, schedulingSlot]);

  // Don't render if nothing to show
  if (overdueCount === 0 && unscheduledCount === 0 && !energyHint && schedulePredictions.length === 0) return null;

  const accentColor = overdueCount > 0 ? '#F97316' : schedulePredictions.length > 0 ? '#39FF14' : '#00D4FF';

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
        Schedule Insights
      </div>

      {/* Predictive schedule suggestions */}
      {schedulePredictions.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: '#39FF14', letterSpacing: '0.5px',
            textTransform: 'uppercase' as const, marginBottom: 4,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Brain size={10} />
            Pattern-Aware
          </div>
          {schedulePredictions.map(slot => {
            const cfg = SLOT_TYPE_CONFIG[slot.type] ?? SLOT_TYPE_CONFIG.peak_focus;
            const isScheduling = schedulingSlot === slot.id;
            return (
              <div key={slot.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 6,
                marginBottom: 6, padding: '6px 8px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{
                  color: cfg.color, marginTop: 1, flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                }}>
                  {cfg.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {slot.title}
                    <span style={{
                      fontSize: 9, color: cfg.color, opacity: 0.8,
                      background: `${cfg.color}15`, padding: '1px 4px', borderRadius: 4,
                    }}>
                      {Math.round(slot.confidence * 100)}%
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#8BA4BE', marginTop: 1 }}>
                    {slot.dayOfWeek >= 0
                      ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][slot.dayOfWeek]
                      : 'Any day'
                    } {slot.startTime}–{slot.endTime}
                  </div>
                  <div style={{ fontSize: 10, color: '#5A7A9A', marginTop: 1, lineHeight: '1.3' }}>
                    {slot.description.length > 80
                      ? slot.description.slice(0, 77) + '...'
                      : slot.description
                    }
                  </div>
                </div>
                <button
                  onClick={() => handleSchedulePrediction(slot)}
                  disabled={isScheduling}
                  style={{
                    flexShrink: 0, padding: '3px 8px',
                    background: isScheduling ? 'rgba(255,255,255,0.04)' : `${cfg.color}15`,
                    border: `1px solid ${isScheduling ? 'rgba(255,255,255,0.06)' : `${cfg.color}30`}`,
                    borderRadius: 6, fontSize: 10, fontWeight: 600,
                    color: isScheduling ? 'rgba(255,255,255,0.3)' : cfg.color,
                    cursor: isScheduling ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap' as const,
                  }}
                >
                  {isScheduling ? '...' : cfg.label}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Overdue line */}
      {overdueCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)',
        }}>
          <AlertTriangle size={11} color="#F97316" style={{ flexShrink: 0 }} />
          <span>
            <strong style={{ color: '#F97316' }}>{overdueCount}</strong>
            {' '}overdue task{overdueCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Top 2 overdue items */}
      {topOverdue.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          marginLeft: 17, marginBottom: 3,
          fontSize: 11, color: '#8BA4BE',
        }}>
          <Clock size={9} style={{ flexShrink: 0, opacity: 0.5 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
            {t.title}
          </span>
          <span style={{ fontSize: 9, color: '#F97316', flexShrink: 0 }}>
            {t.daysOverdue}d
          </span>
        </div>
      ))}

      {/* Unscheduled line */}
      {unscheduledCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)',
        }}>
          <CalendarClock size={11} color="#00D4FF" style={{ flexShrink: 0 }} />
          <span>
            <strong style={{ color: '#00D4FF' }}>{unscheduledCount}</strong>
            {' '}unscheduled task{unscheduledCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Energy hint */}
      {energyHint === 'low' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 8, fontSize: 12, color: 'rgba(255,255,255,0.7)',
        }}>
          <Zap size={11} color="#A855F7" style={{ flexShrink: 0 }} />
          <span style={{ color: '#A855F7' }}>
            Low energy — consider lighter tasks
          </span>
        </div>
      )}

      {/* Reschedule button */}
      {overdueCount > 0 && userId && (
        <button
          onClick={handleReschedule}
          disabled={rescheduling}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            marginTop: 4,
            padding: '5px 12px',
            background: rescheduling ? 'rgba(255,255,255,0.04)' : 'rgba(249,115,22,0.1)',
            border: `1px solid ${rescheduling ? 'rgba(255,255,255,0.06)' : 'rgba(249,115,22,0.2)'}`,
            borderRadius: 8,
            color: rescheduling ? 'rgba(255,255,255,0.3)' : '#F97316',
            fontSize: 11, fontWeight: 600,
            cursor: rescheduling ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s, border-color 0.2s',
          }}
        >
          <RefreshCw size={11} className={rescheduling ? 'animate-spin' : ''} />
          {rescheduling ? 'Rescheduling...' : 'Reschedule'}
        </button>
      )}

      {/* Hermetic touch */}
      <div style={{
        marginTop: 8, fontSize: 9, color: 'rgba(255,255,255,0.15)',
        textAlign: 'center', fontStyle: 'italic',
      }}>
        As above, so scheduled
      </div>
    </div>
  );
}