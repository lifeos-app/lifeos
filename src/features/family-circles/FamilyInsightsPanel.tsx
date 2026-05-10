/**
 * FamilyInsightsPanel.tsx — Cross-person intelligence insights
 *
 * Analyzes patterns across family members: shared rhythms, goal synergies,
 * family wellness pulse, and AI-generated activity suggestions.
 * No emoji in UI — Lucide icons used throughout.
 */

import { useMemo } from 'react';
import { Users, Heart, Target, Sparkles, TrendingUp, Activity } from 'lucide-react';
import { useFamilyCircles } from './useFamilyCircles';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useHealthStore } from '../../stores/useHealthStore';
import type { FamilyMember, SharedHabit, SharedGoal } from '../../stores/familyStore';

// ── Types ────────────────────────────────────────────────────────────

interface SharedRhythm {
  memberNames: string[];
  habitNames: string[];
  timeOfDay: string;
  alignment: number; // 0-100
}

interface GoalSynergy {
  goalTitle: string;
  members: string[];
  averageProgress: number;
  tag: 'complementary' | 'aligned' | 'supportive';
}

interface FamilyPulsePoint {
  label: string;
  value: number;
  color: string;
}

interface InsightSuggestion {
  title: string;
  description: string;
  icon: React.ReactNode;
}

// ── Helpers ──────────────────────────────────────────────────────────

function getTimeLabel(tod?: string): string {
  if (!tod) return 'unspecified time';
  const lower = tod.toLowerCase();
  if (lower.includes('morn') || lower === 'am') return 'the morning';
  if (lower.includes('after')) return 'the afternoon';
  if (lower.includes('even') || lower === 'pm') return 'the evening';
  if (lower.includes('night')) return 'the night';
  return tod;
}

function getHabitTimeOfDay(habit: { time_of_day?: string; title?: string }): string {
  if (habit.time_of_day) return habit.time_of_day;
  const title = (habit.title || '').toLowerCase();
  if (title.includes('morning') || title.includes('wake') || title.includes('meditat')) return 'morning';
  if (title.includes('lunch') || title.includes('noon') || title.includes('afternoon')) return 'afternoon';
  if (title.includes('evening') || title.includes('dinner') || title.includes('read') || title.includes('sleep') || title.includes('night')) return 'evening';
  return 'unspecified';
}

// ── Analyzers ───────────────────────────────────────────────────────

function findSharedRhythms(
  members: FamilyMember[],
  sharedHabits: SharedHabit[],
): SharedRhythm[] {
  if (members.length < 2 || sharedHabits.length === 0) return [];

  // Group habits by approximate time-of-day bucket
  const timeGroups: Record<string, { habitIds: Set<string>; habitNames: Set<string> }> = {};
  for (const habit of sharedHabits) {
    const tod = getHabitTimeOfDay(habit as any);
    if (!timeGroups[tod]) {
      timeGroups[tod] = { habitIds: new Set(), habitNames: new Set() };
    }
    timeGroups[tod].habitIds.add(habit.id);
    timeGroups[tod].habitNames.add(habit.title);
  }

  const rhythms: SharedRhythm[] = [];

  for (const [tod, group] of Object.entries(timeGroups)) {
    // Check which members are assigned to habits in this time bucket
    const memberHabitCounts: Record<string, number> = {};
    for (const member of members) {
      let count = 0;
      for (const hId of group.habitIds) {
        const habit = sharedHabits.find(h => h.id === hId);
        if (habit && habit.assignedTo.includes(member.id)) {
          count++;
        }
      }
      if (count > 0) memberHabitCounts[member.id] = count;
    }

    const activeMembers = Object.keys(memberHabitCounts);
    if (activeMembers.length >= 2) {
      // Compute alignment as average completion rate across active members over last 7 days
      const today = new Date();
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });

      let totalPossible = 0;
      let totalDone = 0;

      for (const mId of activeMembers) {
        const memberHabits = sharedHabits.filter(
          h => group.habitIds.has(h.id) && h.assignedTo.includes(mId),
        );
        for (const h of memberHabits) {
          for (const dateStr of last7) {
            totalPossible++;
            if ((h.completionsByMember[mId] || []).includes(dateStr)) {
              totalDone++;
            }
          }
        }
      }

      const alignment = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

      rhythms.push({
        memberNames: activeMembers.map(id => members.find(m => m.id === id)?.name || 'Unknown'),
        habitNames: Array.from(group.habitNames),
        timeOfDay: getTimeLabel(tod),
        alignment,
      });
    }
  }

  return rhythms.sort((a, b) => b.alignment - a.alignment).slice(0, 4);
}

function findGoalSynergies(
  members: FamilyMember[],
  sharedGoals: SharedGoal[],
): GoalSynergy[] {
  if (sharedGoals.length === 0) return [];

  const synergies: GoalSynergy[] = [];

  for (const goal of sharedGoals) {
    if (goal.assignedTo.length < 2) continue;

    const memberNames = goal.assignedTo.map(
      id => members.find(m => m.id === id)?.name || 'Unknown',
    );

    const avgProgress =
      goal.assignedTo.reduce((sum, id) => sum + (goal.progressByMember[id] ?? 0), 0) /
      goal.assignedTo.length;

    // Determine synergy tag
    const progresses = goal.assignedTo.map(id => goal.progressByMember[id] ?? 0);
    const maxDiff = Math.max(...progresses) - Math.min(...progresses);

    let tag: GoalSynergy['tag'] = 'aligned';
    if (maxDiff <= 15) tag = 'aligned';
    else if (maxDiff <= 40) tag = 'complementary';
    else tag = 'supportive'; // one member pulling the other along

    synergies.push({
      goalTitle: goal.title,
      members: memberNames,
      averageProgress: Math.round(avgProgress),
      tag,
    });
  }

  return synergies.slice(0, 5);
}

function computeFamilyPulse(
  members: FamilyMember[],
  sharedHabits: SharedHabit[],
  sharedGoals: SharedGoal[],
  todayMetrics: import('../../types/database').HealthMetric | null,
): FamilyPulsePoint[] {
  const points: FamilyPulsePoint[] = [];

  // 1. Habit consistency (avg completion % over last 7 days)
  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  let habitTotal = 0;
  let habitDone = 0;
  for (const habit of sharedHabits) {
    for (const mId of habit.assignedTo) {
      for (const dateStr of last7) {
        habitTotal++;
        if ((habit.completionsByMember[mId] || []).includes(dateStr)) {
          habitDone++;
        }
      }
    }
  }
  const habitPct = habitTotal > 0 ? Math.round((habitDone / habitTotal) * 100) : 0;
  points.push({
    label: 'Habit Consistency',
    value: habitPct,
    color: habitPct >= 70 ? '#10B981' : habitPct >= 40 ? '#F59E0B' : '#EF4444',
  });

  // 2. Goal momentum (avg progress across all shared goals)
  let goalAvg = 0;
  if (sharedGoals.length > 0) {
    goalAvg = Math.round(
      sharedGoals.reduce(
        (sum, g) =>
          sum +
          g.assignedTo.reduce((s, id) => s + (g.progressByMember[id] ?? 0), 0) /
            (g.assignedTo.length || 1),
        0,
      ) / sharedGoals.length,
    );
  }
  points.push({
    label: 'Goal Momentum',
    value: goalAvg,
    color: goalAvg >= 60 ? '#10B981' : goalAvg >= 30 ? '#F59E0B' : '#EF4444',
  });

  // 3. Mood/energy if available
  if (todayMetrics) {
    if (todayMetrics.mood_score != null) {
      const mood = Math.round((todayMetrics.mood_score / 10) * 100);
      points.push({
        label: 'Mood',
        value: mood,
        color: mood >= 70 ? '#10B981' : mood >= 40 ? '#F59E0B' : '#EF4444',
      });
    }
    if (todayMetrics.energy_score != null) {
      const energy = Math.round((todayMetrics.energy_score / 10) * 100);
      points.push({
        label: 'Energy',
        value: energy,
        color: energy >= 70 ? '#10B981' : energy >= 40 ? '#F59E0B' : '#EF4444',
      });
    }
  }

  // 4. Family streak
  // Use the first member's streakContribution as a proxy or leave at 0 if unavailable
  const avgStreak =
    members.length > 0
      ? Math.round(
          members.reduce((s, m) => s + m.streakContribution, 0) / members.length,
        )
      : 0;
  if (avgStreak > 0 || members.length > 0) {
    points.push({
      label: 'Streak Strength',
      value: Math.min(avgStreak * 3, 100), // scale: ~33 day streak = 100%
      color: avgStreak >= 14 ? '#10B981' : avgStreak >= 5 ? '#F59E0B' : '#EF4444',
    });
  }

  return points;
}

function generateSuggestions(
  members: FamilyMember[],
  sharedHabits: SharedHabit[],
  sharedGoals: SharedGoal[],
  rhythms: SharedRhythm[],
  synergies: GoalSynergy[],
  pulse: FamilyPulsePoint[],
): InsightSuggestion[] {
  const suggestions: InsightSuggestion[] = [];

  // Suggest based on shared rhythms
  if (rhythms.length > 0) {
    const topRhythm = rhythms[0];
    suggestions.push({
      title: 'Sync your morning routine',
      description: `${topRhythm.memberNames.slice(0, 3).join(', ')} already share habits in ${topRhythm.timeOfDay}. Try starting the day together for an extra boost.`,
      icon: <Users size={14} />,
    });
  }

  // Suggest based on low habit consistency
  const habitPulse = pulse.find(p => p.label === 'Habit Consistency');
  if (habitPulse && habitPulse.value < 50) {
    suggestions.push({
      title: 'Start a family habit challenge',
      description: 'Habit consistency is below 50%. A friendly 7-day challenge could help everyone stay on track.',
      icon: <Activity size={14} />,
    });
  } else if (habitPulse && habitPulse.value >= 80) {
    suggestions.push({
      title: 'Celebrate your consistency',
      description: 'Habit consistency is above 80%. Take a moment to acknowledge this together — consistency is hard.',
      icon: <Sparkles size={14} />,
    });
  }

  // Suggest based on goal synergies
  if (synergies.some(s => s.tag === 'supportive')) {
    const supportGoal = synergies.find(s => s.tag === 'supportive');
    if (supportGoal) {
      suggestions.push({
        title: 'Close the gap on shared goals',
        description: `"${supportGoal.goalTitle}" has uneven progress across members. A paired session can help the whole family advance together.`,
        icon: <Target size={14} />,
    });
  }
  }

  // Suggest based on goal momentum
  const goalPulse = pulse.find(p => p.label === 'Goal Momentum');
  if (goalPulse && goalPulse.value < 30 && sharedGoals.length > 0) {
    suggestions.push({
      title: 'Break goals into smaller steps',
      description: 'Goal momentum is low. Consider splitting large goals into weekly micro-goals so everyone can see progress.',
      icon: <TrendingUp size={14} />,
    });
  }

  // Suggest mood/activity if we have mood data
  const moodPulse = pulse.find(p => p.label === 'Mood');
  if (moodPulse && moodPulse.value < 50) {
    suggestions.push({
      title: 'Plan a family reset',
      description: 'Mood is low today. A short walk, a shared meal, or a group activity can lift everyone\'s spirits.',
      icon: <Heart size={14} />,
    });
  }

  // If not enough data
  if (suggestions.length === 0) {
    suggestions.push({
      title: 'Log more activities to unlock insights',
      description: 'The more habits and goals your family tracks, the better the cross-person insights become. Start by assigning shared habits and goals.',
      icon: <Sparkles size={14} />,
    });
  }

  return suggestions.slice(0, 4);
}

// ── Component ────────────────────────────────────────────────────────

export function FamilyInsightsPanel() {
  const { activeCircle } = useFamilyCircles();
  const habitsStore = useHabitsStore();
  const goalsStore = useGoalsStore();
  const healthStore = useHealthStore();

  const circle = activeCircle;
  if (!circle) return null;

  const { members, sharedHabits, sharedGoals } = circle;
  const todayMetrics = healthStore.todayMetrics;

  // ── Compute insights ────────────────────────────────────────

  const sharedRhythms = useMemo(
    () => findSharedRhythms(members, sharedHabits),
    [members, sharedHabits],
  );

  const goalSynergies = useMemo(
    () => findGoalSynergies(members, sharedGoals),
    [members, sharedGoals],
  );

  const familyPulse = useMemo(
    () => computeFamilyPulse(members, sharedHabits, sharedGoals, todayMetrics),
    [members, sharedHabits, sharedGoals, todayMetrics],
  );

  const suggestions = useMemo(
    () => generateSuggestions(members, sharedHabits, sharedGoals, sharedRhythms, goalSynergies, familyPulse),
    [members, sharedHabits, sharedGoals, sharedRhythms, goalSynergies, familyPulse],
  );

  // ── Helpers for rendering ────────────────────────────────────

  const synergyTagStyle: Record<string, { label: string; color: string }> = {
    aligned: { label: 'Aligned', color: '#10B981' },
    complementary: { label: 'Complementary', color: '#F59E0B' },
    supportive: { label: 'Supportive', color: '#8B5CF6' },
  };

  return (
    <div className="space-y-4">
      {/* ── Shared Rhythms ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Users size={14} className="text-amber-300" />
          <h3 className="text-[10px] uppercase tracking-widest text-amber-300/60 font-medium">
            Shared Rhythms
          </h3>
        </div>
        <div className="space-y-2">
          {sharedRhythms.length > 0 ? (
            sharedRhythms.map((rhythm, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-gradient-to-r from-amber-900/15 to-rose-900/15 border border-amber-500/10"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-amber-100">
                    {rhythm.memberNames.slice(0, 3).join(', ')}
                  </span>
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{
                      color: rhythm.alignment >= 70 ? '#10B981' : rhythm.alignment >= 40 ? '#F59E0B' : '#EF4444',
                      background: rhythm.alignment >= 70
                        ? 'rgba(16,185,129,0.15)'
                        : rhythm.alignment >= 40
                          ? 'rgba(245,158,11,0.15)'
                          : 'rgba(239,68,68,0.15)',
                    }}
                  >
                    {rhythm.alignment}% aligned
                  </span>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  {rhythm.memberNames.slice(0, 3).join(', ')} share habits in {rhythm.timeOfDay}
                  {rhythm.habitNames.length > 0 && (
                    <> — including {rhythm.habitNames.slice(0, 3).join(', ')}</>
                  )}
                </p>
                {/* Mini alignment bar */}
                <div className="mt-2 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${rhythm.alignment}%`,
                      background: rhythm.alignment >= 70
                        ? 'linear-gradient(90deg, #10B98180, #10B981)'
                        : rhythm.alignment >= 40
                          ? 'linear-gradient(90deg, #F59E0B80, #F59E0B)'
                          : 'linear-gradient(90deg, #EF444480, #EF4444)',
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center">
              <Users size={18} className="mx-auto mb-1.5 text-white/20" />
              <p className="text-xs text-white/30">
                Assign shared habits to multiple members to discover shared rhythms.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Goal Synergies ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Target size={14} className="text-emerald-300" />
          <h3 className="text-[10px] uppercase tracking-widest text-emerald-300/60 font-medium">
            Goal Synergies
          </h3>
        </div>
        <div className="space-y-2">
          {goalSynergies.length > 0 ? (
            goalSynergies.map((synergy, i) => {
              const tagInfo = synergyTagStyle[synergy.tag];
              return (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-gradient-to-r from-emerald-900/15 to-teal-900/15 border border-emerald-500/10"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-emerald-100">
                      {synergy.goalTitle}
                    </span>
                    <span
                      className="text-[9px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        color: tagInfo.color,
                        background: `${tagInfo.color}20`,
                      }}
                    >
                      {tagInfo.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50">
                    {synergy.members.join(', ')} ({synergy.averageProgress}% avg)
                  </p>
                  {/* Progress bar */}
                  <div className="mt-2 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${synergy.averageProgress}%`,
                        background: `linear-gradient(90deg, ${tagInfo.color}80, ${tagInfo.color})`,
                      }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center">
              <Target size={18} className="mx-auto mb-1.5 text-white/20" />
              <p className="text-xs text-white/30">
                Assign goals to multiple members to see how they complement each other.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Family Pulse ───────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Heart size={14} className="text-pink-300" />
          <h3 className="text-[10px] uppercase tracking-widest text-pink-300/60 font-medium">
            Family Pulse
          </h3>
        </div>
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-pink-900/15 to-rose-900/15 border border-pink-500/10 space-y-2.5">
          {familyPulse.length > 0 ? (
            familyPulse.map((point, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-pink-100">{point.label}</span>
                  <span className="text-xs font-bold" style={{ color: point.color }}>
                    {point.value}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${point.value}%`,
                      background: `linear-gradient(90deg, ${point.color}80, ${point.color})`,
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-white/30 text-center py-2">
              Start logging habits, goals, and health data to see your family pulse.
            </p>
          )}
        </div>
      </section>

      {/* ── Suggestions ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-violet-300" />
          <h3 className="text-[10px] uppercase tracking-widest text-violet-300/60 font-medium">
            Suggestions
          </h3>
        </div>
        <div className="space-y-2">
          {suggestions.map((suggestion, i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-gradient-to-r from-violet-900/15 to-purple-900/15 border border-violet-500/10"
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 text-violet-300 shrink-0">
                  {suggestion.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-violet-100 mb-0.5">
                    {suggestion.title}
                  </p>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    {suggestion.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}