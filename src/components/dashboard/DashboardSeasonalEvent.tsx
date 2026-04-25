/**
 * DashboardSeasonalEvent -- Seasonal quest progress widget
 *
 * Shows current season name + icon, lists 1-2 active quests with progress bars,
 * and a Claim button when a quest is complete.
 * Compact card matching other dashboard widgets.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Sparkles, Gift } from 'lucide-react';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useJournalStore } from '../../stores/useJournalStore';
import { useGamificationContext } from '../../lib/gamification/context';
import {
  getCurrentSeason,
  getSeasonalQuests,
  checkSeasonalQuestProgress,
  loadQuestProgress,
  updateQuestProgress as persistProgress,
  claimQuest,
  type SeasonalQuest,
  type SeasonalQuestProgress,
} from '../../lib/seasonal-events';

/** Compute data counts for each data source within the current season */
function useSeasonalCounts(): Record<string, number> {
  const habits = useHabitsStore(s => s.habits);
  const habitLogs = useHabitsStore(s => s.logs);
  const goals = useGoalsStore(s => s.goals);
  const tasks = useScheduleStore(s => s.tasks);
  const journalEntries = useJournalStore(s => s.entries);

  return useMemo(() => {
    const season = getCurrentSeason();
    const now = new Date();
    const year = now.getFullYear();

    // Season date range (approximate)
    const startMonth = Math.min(...season.months);
    const endMonth = Math.max(...season.months);
    // Handle wrap-around (summer: Dec=11, Jan=0, Feb=1)
    const isWrapped = season.months.includes(11) && season.months.includes(0);

    function isInSeason(dateStr: string | null | undefined): boolean {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const m = d.getMonth();
      if (isWrapped) {
        return season.months.includes(m);
      }
      return m >= startMonth && m <= endMonth && d.getFullYear() === year;
    }

    // Count habits created this season
    const habitsCreated = habits.filter(h => isInSeason(h.created_at)).length;

    // Count consecutive habit days (best streak this season)
    const habitLogsThisSeason = habitLogs.filter(l => isInSeason(l.date));
    const uniqueDates = [...new Set(habitLogsThisSeason.map(l => l.date))].sort();
    let maxStreak = 0;
    let streak = 0;
    for (let i = 0; i < uniqueDates.length; i++) {
      if (i === 0) { streak = 1; }
      else {
        const prev = new Date(uniqueDates[i - 1]);
        const curr = new Date(uniqueDates[i]);
        const diff = (curr.getTime() - prev.getTime()) / 86400000;
        streak = diff === 1 ? streak + 1 : 1;
      }
      maxStreak = Math.max(maxStreak, streak);
    }

    // Count goals completed this season
    const goalsCompleted = goals.filter(
      g => g.status === 'completed' && isInSeason(g.updated_at || g.created_at),
    ).length;

    // Count tasks completed this season
    const tasksCompleted = tasks.filter(
      t => t.status === 'done' && isInSeason(t.completed_at),
    ).length;

    // Count journal entries this season
    const journalCount = journalEntries.filter(e => isInSeason(e.date || e.created_at)).length;

    return {
      habits: habitsCreated,
      habits_streak: maxStreak,
      goals: goalsCompleted,
      tasks: tasksCompleted,
      journal: journalCount,
    };
  }, [habits, habitLogs, goals, tasks, journalEntries]);
}

function getCountForQuest(quest: SeasonalQuest, counts: Record<string, number>): number {
  switch (quest.dataSource) {
    case 'habits':
      // For streak-based quests, use streak count; otherwise habit creation count
      if (quest.title.toLowerCase().includes('consecutive') || quest.title.toLowerCase().includes('straight')) {
        return counts.habits_streak || 0;
      }
      return counts.habits || 0;
    case 'goals':
      return counts.goals || 0;
    case 'tasks':
      return counts.tasks || 0;
    case 'journal':
      return counts.journal || 0;
    default:
      return 0;
  }
}

export function DashboardSeasonalEvent() {
  const season = getCurrentSeason();
  const quests = getSeasonalQuests();
  const counts = useSeasonalCounts();
  const gam = useGamificationContext();
  const [questProgress, setQuestProgress] = useState<SeasonalQuestProgress[]>(() => loadQuestProgress());
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());

  // Update progress on mount and when counts change
  useEffect(() => {
    const updated: SeasonalQuestProgress[] = [];
    for (const quest of quests) {
      const count = getCountForQuest(quest, counts);
      const pct = checkSeasonalQuestProgress(quest, count);
      const entry = persistProgress(quest.id, pct);
      updated.push(entry);
    }
    setQuestProgress(updated);
    setClaimedIds(new Set(updated.filter(p => p.claimed).map(p => p.questId)));
  }, [counts, quests]);

  const handleClaim = useCallback((quest: SeasonalQuest) => {
    const success = claimQuest(quest.id);
    if (success) {
      gam.awardXP('quest_complete', { description: quest.title });
      setClaimedIds(prev => new Set([...prev, quest.id]));
    }
  }, [gam]);

  // Show top 2 quests (prefer unclaimed, then highest progress)
  const visibleQuests = useMemo(() => {
    const sorted = quests
      .map(q => {
        const prog = questProgress.find(p => p.questId === q.id);
        return { quest: q, progress: prog?.progress || 0, claimed: prog?.claimed || false };
      })
      .sort((a, b) => {
        // Unclaimed complete quests first, then by progress desc
        if (a.progress >= 100 && !a.claimed && !(b.progress >= 100 && !b.claimed)) return -1;
        if (b.progress >= 100 && !b.claimed && !(a.progress >= 100 && !a.claimed)) return 1;
        if (a.claimed && !b.claimed) return 1;
        if (!a.claimed && b.claimed) return -1;
        return b.progress - a.progress;
      });
    return sorted.slice(0, 2);
  }, [quests, questProgress]);

  // Hide if all quests are claimed
  const allClaimed = visibleQuests.every(v => v.claimed);
  if (allClaimed && visibleQuests.length > 0) return null;

  return (
    <section style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: 14,
    }}>
      {/* Season header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 18 }}>{season.icon}</span>
        <div>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: season.color,
          }}>
            {season.name}
          </div>
          <div style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.45)',
            fontStyle: 'italic',
          }}>
            {season.theme}
          </div>
        </div>
        <Sparkles size={14} style={{ marginLeft: 'auto', color: season.color, opacity: 0.6 }} />
      </div>

      {/* Quest list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleQuests.map(({ quest, progress, claimed }) => (
          <div
            key={quest.id}
            style={{
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              border: progress >= 100 && !claimed
                ? `1px solid ${season.color}40`
                : '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 4,
            }}>
              <span style={{ fontSize: 14 }}>{quest.icon}</span>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: claimed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)',
                flex: 1,
                textDecoration: claimed ? 'line-through' : 'none',
              }}>
                {quest.title}
              </span>
              <span style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.4)',
              }}>
                +{quest.xpReward} XP
              </span>
            </div>

            <div style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.45)',
              marginBottom: 6,
            }}>
              {quest.description}
            </div>

            {/* Progress bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <div style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.08)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(progress, 100)}%`,
                  background: progress >= 100
                    ? season.color
                    : `linear-gradient(90deg, ${season.color}80, ${season.color})`,
                  borderRadius: 2,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: progress >= 100 ? season.color : 'rgba(255,255,255,0.5)',
                minWidth: 32,
                textAlign: 'right',
              }}>
                {progress}%
              </span>
            </div>

            {/* Claim button */}
            {progress >= 100 && !claimed && (
              <button
                onClick={() => handleClaim(quest)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  marginTop: 6,
                  width: '100%',
                  padding: '5px 0',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: `linear-gradient(135deg, ${season.color}30, ${season.color}15)`,
                  color: season.color,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                }}
              >
                <Gift size={12} />
                Claim Reward
              </button>
            )}
          </div>
        ))}
      </div>

      {/* XP multiplier note */}
      <div style={{
        marginTop: 8,
        fontSize: 10,
        color: 'rgba(255,255,255,0.35)',
        textAlign: 'center',
      }}>
        Seasonal XP bonus: +{Math.round((season.xpMultiplier - 1) * 100)}%
      </div>
    </section>
  );
}
