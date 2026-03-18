/**
 * DashboardNPCInsight — Daily rotating NPC insight card for the Dashboard
 */

import { useNavigate } from 'react-router-dom';
import { useHealthStore } from '../../stores/useHealthStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useJournalStore } from '../../stores/useJournalStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useCharacterAppearanceStore } from '../../stores/useCharacterAppearanceStore';
import type { NPCDialogueContext } from '../../realm/data/dialogue';
import { getDailyInsight } from '../../realm/bridge/RealmInsightLeaker';

export function DashboardNPCInsight() {
  const navigate = useNavigate();
  const charStore = useCharacterAppearanceStore();

  // Build dialogue context from stores (same pattern as DataBridge)
  const health = useHealthStore(s => s.todayMetrics);
  const habits = useHabitsStore(s => s.habits);
  const goals = useGoalsStore(s => s.goals);
  const entries = useJournalStore(s => s.entries);
  const finance = useFinanceStore();
  const schedule = useScheduleStore();

  const activeGoals = goals
    .filter(g => g.status === 'active' || g.status === 'in_progress')
    .map(g => ({ title: g.title || 'Goal', progress: 0 }));

  const ctx: NPCDialogueContext = {
    moodScore: health?.mood_score ?? 3,
    energyScore: health?.energy_level ?? 3,
    sleepHours: health?.sleep_hours ?? null,
    exerciseMinutes: health?.exercise_minutes ?? null,
    activeGoals,
    completedGoals: goals.filter(g => g.status === 'completed').length,
    habits: habits.filter(h => !h.is_deleted).map(h => ({
      name: h.title || 'Habit',
      streak: h.streak_current || 0,
      category: h.category || 'other',
    })),
    bestStreak: habits.reduce((max, h) => Math.max(max, h.streak_current || 0), 0),
    journalCount: entries.length,
    overdueTasks: schedule.getOverdueTasks().length,
    netBalance: finance.netCashflow?.() ?? 0,
    playerLevel: charStore.level,
    playerClass: charStore.characterClass,
  };

  const { npcName, npcIcon, insight } = getDailyInsight(new Date().getDay(), ctx);

  return (
    <section
      className="dash-card"
      onClick={() => navigate('/character?tab=realm')}
      style={{ cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{npcIcon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
          {npcName}
        </span>
      </div>
      <p style={{
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        margin: 0,
        lineHeight: 1.5,
        fontStyle: 'italic',
      }}>
        {insight}
      </p>
    </section>
  );
}
