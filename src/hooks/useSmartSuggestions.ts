// ═══════════════════════════════════════════════════════════
// useSmartSuggestions — Free-Time Smart Suggestions Hook
// Checks habits, tasks, health metrics, AND spiritual practices
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useHealthStore } from '../stores/useHealthStore';
import { analyzeGoalCoach, getGoalNudgesForDashboard } from '../lib/llm/goal-coach';
import { logger } from '../utils/logger';

export interface Suggestion {
  id: string;
  icon: string;
  label: string;
  detail?: string;
  action?: 'navigate';
  actionTarget?: string; // route to navigate to
  priority: number; // lower = higher priority
}

export function useSmartSuggestions(enabled: boolean): { suggestions: Suggestion[]; loading: boolean } {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);

    const today = new Date().toISOString().split('T')[0];

    // Use store data for habits, tasks, health (already loaded)
    const habits = useHabitsStore.getState().habits;
    const habitLogs = useHabitsStore.getState().logs.filter(l => l.date === today);
    const tasks = useScheduleStore.getState().tasks.filter(t => t.status !== 'done');
    const todayMetrics = useHealthStore.getState().todayMetrics;

    try {
      // Junction data not in stores — keep supabase calls for these
      const [junctionRes, junctionLogRes] = await Promise.all([
        supabase.from('user_junction').select('tradition_id, junction_xp').eq('is_active', true).limit(1),
        supabase.from('user_junction_log').select('practice_id').eq('date', today),
      ]);

      const results: Suggestion[] = [];

      // ── Spiritual practice suggestion (highest priority when time-appropriate) ──
      const ujData = junctionRes.data?.[0];
      if (ujData?.tradition_id) {
        const now = new Date();
        const hour = now.getHours();
        // Map current time to practice time_of_day
        let timeContext = 'morning';
        if (hour < 6) timeContext = 'dawn';
        else if (hour < 9) timeContext = 'morning';
        else if (hour < 12) timeContext = 'midmorning';
        else if (hour < 15) timeContext = 'noon';
        else if (hour < 18) timeContext = 'afternoon';
        else if (hour < 21) timeContext = 'evening';
        else timeContext = 'night';

        // Calculate current tier from XP
        const xp = ujData.junction_xp || 0;
        const currentTier = xp >= 500 ? 3 : xp >= 200 ? 2 : xp >= 50 ? 1 : 0;

        const { data: practices } = await supabase
          .from('junction_practices')
          .select('id, name, icon, type, time_of_day, xp_value')
          .eq('tradition_id', ujData.tradition_id)
          .lte('tier_required', currentTier);

        if (practices?.length) {
          const loggedPracticeIds = new Set((junctionLogRes.data || []).map((l: any) => l.practice_id));
          // Find practices for current time that haven't been logged today
          const timePractices = practices.filter((p: any) =>
            p.time_of_day?.toLowerCase() === timeContext && !loggedPracticeIds.has(p.id)
          );
          // Also get any unlogged practices as fallback
          const anyUnlogged = practices.filter((p: any) => !loggedPracticeIds.has(p.id));
          const bestPractice = timePractices[0] || anyUnlogged[0];

          if (bestPractice) {
            const isTimely = timePractices.length > 0;
            results.push({
              id: `sacred-${bestPractice.id}`,
              icon: bestPractice.icon || '🙏',
              label: bestPractice.name,
              detail: isTimely
                ? `${timeContext} practice · +${bestPractice.xp_value || 10} XP`
                : `Spiritual practice · +${bestPractice.xp_value || 10} XP`,
              action: 'navigate',
              actionTarget: '/junction',
              priority: isTimely ? 0 : 2, // Highest priority if time-matched
            });
          }
        }
      }

      // ── Habit suggestions ──
      if (habits.length > 0) {
        const loggedIds = new Set(habitLogs.map(l => l.habit_id));
        const incomplete = habits.filter(h => !loggedIds.has(h.id));
        if (incomplete.length > 0) {
          const top = incomplete[0];
          results.push({
            id: `habit-${top.id}`,
            icon: top.icon || '✅',
            label: `Log "${top.title}"`,
            detail: `${incomplete.length} habit${incomplete.length > 1 ? 's' : ''} not logged today`,
            action: 'navigate',
            actionTarget: '/habits',
            priority: 1,
          });
        }
      }

      // ── Health metric suggestion ──
      if (!todayMetrics) {
        results.push({
          id: 'health-metrics',
          icon: '❤️',
          label: 'Log health metrics',
          detail: 'Mood, energy, weight not tracked today',
          action: 'navigate',
          actionTarget: '/health',
          priority: 3,
        });
      }

      // ── Overdue tasks ──
      {
        const now = new Date();
        const overdue = tasks.filter(t => {
          if (!t.due_date) return false;
          return new Date(t.due_date + 'T00:00:00') < now;
        });
        if (overdue.length > 0) {
          results.push({
            id: 'overdue-tasks',
            icon: '⚠️',
            label: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`,
            detail: overdue[0]?.title || 'Tasks need attention',
            action: 'navigate',
            actionTarget: '/goals',
            priority: 4,
          });
        } else {
          // Show upcoming tasks if no overdue
          const upcoming = tasks.filter(t => t.due_date).slice(0, 1);
          if (upcoming.length > 0) {
            results.push({
              id: 'upcoming-tasks',
              icon: '📋',
              label: upcoming[0].title,
              detail: 'Upcoming task',
              action: 'navigate',
              actionTarget: '/goals',
              priority: 5,
            });
          }
        }
      }

      // ── Goal Coach nudges ──
      try {
        const userId = useUserStore.getState().user?.id;
        if (userId) {
          const coachResult = await analyzeGoalCoach(userId, supabase, 'free');
          const goalNudges = getGoalNudgesForDashboard(coachResult.insights);
          for (const nudge of goalNudges) {
            results.push({
              id: nudge.id,
              icon: nudge.icon,
              label: nudge.label,
              detail: nudge.detail,
              action: 'navigate',
              actionTarget: '/goals',
              priority: nudge.priority + 1, // slightly below spiritual/habit priority
            });
          }
        }
      } catch (e) {
        logger.warn('Goal coach nudges error:', e);
      }

      // Sort by priority and take top 3
      results.sort((a, b) => a.priority - b.priority);
      setSuggestions(results.slice(0, 3));
    } catch (e) {
      logger.warn('useSmartSuggestions error:', e);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Refresh when app refreshes
  useEffect(() => {
    const handler = () => fetchSuggestions();
    window.addEventListener('lifeos-refresh', handler);
    return () => window.removeEventListener('lifeos-refresh', handler);
  }, [fetchSuggestions]);

  return { suggestions, loading };
}
