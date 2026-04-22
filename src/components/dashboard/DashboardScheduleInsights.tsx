/**
 * DashboardScheduleInsights — Compact predictive scheduling widget.
 *
 * Surfaces overdue tasks, unscheduled items, and energy-aware hints.
 * Provides a "Reschedule" action that calls the AI reschedule engine.
 * Only renders when there are overdue or unscheduled items.
 */

import { useMemo, useState, useCallback } from 'react';
import { Clock, CalendarClock, Zap, RefreshCw, AlertTriangle } from 'lucide-react';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useHealthStore } from '../../stores/useHealthStore';
import { useUserStore } from '../../stores/useUserStore';
import { useOverdueItems } from '../../hooks/useOverdueItems';
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

export function DashboardScheduleInsights() {
  const tasks = useScheduleStore(s => s.tasks);
  const healthMetrics = useHealthStore(s => s.todayMetrics);
  const userId = useUserStore(s => s.user?.id);
  const { overdueTasks, totalCount: overdueCount } = useOverdueItems();

  const [rescheduling, setRescheduling] = useState(false);

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

  // Don't render if nothing to show
  if (overdueCount === 0 && unscheduledCount === 0 && !energyHint) return null;

  const accentColor = overdueCount > 0 ? '#F97316' : '#00D4FF';

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