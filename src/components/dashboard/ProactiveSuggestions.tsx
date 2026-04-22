/**
 * ProactiveSuggestions — Dashboard Widget
 *
 * Shows the highest-priority proactive suggestion as a compact card.
 * Action buttons trigger the intent engine; Dismiss hides for 4 hours.
 * Auto-refreshes every 30 minutes. Consistent with dark glass aesthetic.
 */

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, X, ChevronRight } from 'lucide-react';
import {
  generateProactiveSuggestions,
  dismissProactiveSuggestion,
  isSuggestionDismissed,
  type ProactiveSuggestion,
  type SuggestionInput,
} from '../../lib/proactive-suggestions';
import { generateHabitCoaching, coachingToSuggestion } from '../../lib/habit-coaching';
import { executeIntent } from '../../lib/intent/action-executor';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useHealthStore } from '../../stores/useHealthStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useUserStore } from '../../stores/useUserStore';
import { showToast } from '../Toast';
import { useShallow } from 'zustand/react/shallow';

// ── Style constants ───────────────────────────────────────────────────

const TYPE_STYLES: Record<string, { accent: string; icon: string }> = {
  schedule_reminder: { accent: '#00D4FF', icon: '📅' },
  habit_nudge:       { accent: '#FACC15', icon: '🔄' },
  health_warning:    { accent: '#F43F5E', icon: '❤️' },
  goal_progress:     { accent: '#39FF14', icon: '🎯' },
  streak_at_risk:    { accent: '#FF6B2B', icon: '🔥' },
};

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

// ── Component ─────────────────────────────────────────────────────────

export function ProactiveSuggestions() {
  const [suggestion, setSuggestion] = useState<ProactiveSuggestion | null>(null);
  const [executing, setExecuting] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Read store data (shallow for perf)
  const { tasks, events } = useScheduleStore(useShallow(s => ({ tasks: s.tasks, events: s.events })));
  const { habits, logs: habitLogs } = useHabitsStore(useShallow(s => ({ habits: s.habits, logs: s.logs })));
  const goals = useGoalsStore(s => s.goals);
  const healthMetrics = useHealthStore(s => s.todayMetrics);
  const { bills } = useFinanceStore(useShallow(s => ({ bills: s.bills })));
  const userId = useUserStore(s => s.user?.id) || '';

  // Generate suggestions (memoized, refreshed on interval)
  const refreshSuggestions = useCallback(() => {
    if (!userId) return;

    const input: SuggestionInput = {
      tasks,
      habits,
      habitLogs,
      goals,
      events,
      healthMetrics,
      bills,
      userId,
    };

    const all = generateProactiveSuggestions(input);

    // Merge in habit coaching insights
    const coachingInsights = generateHabitCoaching({
      habits,
      habitLogs,
      userId,
    });
    const coachingSuggestions = coachingInsights.map(coachingToSuggestion);

    const merged = [...all, ...coachingSuggestions].sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3));

    // Filter out dismissed ones
    const visible = merged.filter(s => !isSuggestionDismissed(s));
    setSuggestion(visible.length > 0 ? visible[0] : null);
    setHidden(false);
  }, [tasks, habits, habitLogs, goals, events, healthMetrics, bills, userId]);

  // Initial + interval refresh
  useEffect(() => {
    refreshSuggestions();
    const interval = setInterval(refreshSuggestions, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshSuggestions]);

  // Handle action execution
  const handleAction = useCallback(async () => {
    if (!suggestion || executing) return;
    setExecuting(true);
    try {
      const result = await executeIntent(suggestion.action.intent as any);
      if (result.success) {
        showToast(result.message, '✅', '#39FF14');
      } else {
        showToast(result.message, '⚠️', '#F43F5E');
      }
      // Dismiss after successful action
      dismissProactiveSuggestion(suggestion);
      setSuggestion(null);
      setHidden(true);
    } catch (err) {
      showToast('Action failed', '⚠️', '#F43F5E');
    } finally {
      setExecuting(false);
    }
  }, [suggestion, executing]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    if (!suggestion) return;
    dismissProactiveSuggestion(suggestion);
    setSuggestion(null);
    setHidden(true);
  }, [suggestion]);

  // Nothing to show
  if (hidden || !suggestion) return null;

  const style = TYPE_STYLES[suggestion.type] || { accent: '#A855F7', icon: '💡' };

  return (
    <div
      className="proactive-suggestion-card"
      style={{
        position: 'relative',
        padding: '12px 14px',
        marginBottom: 8,
        borderRadius: 12,
        background: `linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.25) 100%)`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid color-mix(in srgb, ${style.accent} 25%, transparent)`,
        boxShadow: `0 0 20px color-mix(in srgb, ${style.accent} 8%, transparent), inset 0 1px 0 rgba(255,255,255,0.04)`,
        overflow: 'hidden',
      }}
    >
      {/* Subtle accent glow in corner */}
      <div
        style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: `radial-gradient(circle, color-mix(in srgb, ${style.accent} 15%, transparent) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>{style.icon}</span>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: style.accent,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {suggestion.title}
        </span>
        <Sparkles size={14} style={{ color: style.accent, opacity: 0.7 }} />
      </div>

      {/* Message */}
      <p style={{
        fontSize: 13,
        color: 'rgba(255,255,255,0.75)',
        lineHeight: 1.5,
        margin: '0 0 10px 0',
      }}>
        {suggestion.message}
      </p>

      {/* Action row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={handleAction}
          disabled={executing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 14px',
            borderRadius: 8,
            border: `1px solid color-mix(in srgb, ${style.accent} 40%, transparent)`,
            background: `color-mix(in srgb, ${style.accent} 15%, transparent)`,
            color: style.accent,
            fontSize: 12,
            fontWeight: 600,
            cursor: executing ? 'wait' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: executing ? 0.6 : 1,
          }}
        >
          {executing ? '…' : suggestion.action.label}
          {!executing && <ChevronRight size={12} />}
        </button>

        <button
          onClick={handleDismiss}
          title="Dismiss for 4 hours"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '5px 8px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.4)',
            fontSize: 11,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Dismiss
        </button>
      </div>

      {/* Dismiss X */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss suggestion"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'rgba(255,255,255,0.05)',
          border: 'none',
          borderRadius: '50%',
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.3)',
          fontSize: 12,
          lineHeight: 1,
          padding: 0,
          transition: 'all 0.2s ease',
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}