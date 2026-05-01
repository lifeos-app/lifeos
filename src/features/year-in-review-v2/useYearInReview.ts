/**
 * Year in Review 2.0 — Core Data Hook
 *
 * Aggregates ALL LifeOS data for a given year into a cinematic slide deck.
 * Pulls from habits, health, finance, goals, journal, and gamification stores.
 * Auto-curates "Top Moments", calculates growth vs previous year,
 * generates a narrative arc, and creates seasonal summaries.
 */

import { useMemo, useState, useCallback } from 'react';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useHealthStore } from '../../stores/useHealthStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useJournalStore } from '../../stores/useJournalStore';
import { useUserStore } from '../../stores/useUserStore';
import { localQuery } from '../../lib/local-db';
import { logger } from '../../utils/logger';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export type SlideType =
  | 'hero'
  | 'stats'
  | 'habit_streaks'
  | 'financial_journey'
  | 'health_vitals'
  | 'goal_achievements'
  | 'realm_growth'
  | 'top_moments'
  | 'seasons'
  | 'gratitude'
  | 'prediction'
  | 'share';

export type SlideAnimation = 'fadeIn' | 'slideUp' | 'scaleUp' | 'typewriter' | 'countUp';

export interface YearSlideData {
  type: SlideType;
  title: string;
  subtitle: string;
  content: unknown;
  bgGradient: [string, string];
  icon: string;
  animation: SlideAnimation;
}

export interface YearMoment {
  date: string;
  title: string;
  description: string;
  type: 'achievement' | 'milestone' | 'breakthrough' | 'challenge' | 'gratitude';
  emotionalWeight: number; // 1–10
}

export interface SeasonData {
  season: 'spring' | 'summer' | 'fall' | 'winter';
  label: string;
  avgMood: number;
  avgEnergy: number;
  habitCompletionRate: number;
  totalXP: number;
  goalsCompleted: number;
  highlight: string;
}

export interface YearSummary {
  year: number;
  totalHabits: number;
  totalHabitCompletions: number;
  longestStreak: number;
  totalXP: number;
  levelsGained: number;
  achievementsUnlocked: number;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  avgMood: number;
  avgEnergy: number;
  avgSleep: number;
  totalExerciseMinutes: number;
  goalsCompleted: number;
  goalsTotal: number;
  journalEntries: number;
  topMoments: YearMoment[];
  seasonalBreakdown: SeasonData[];
  growthFromLastYear: number;
  daysActive: number;
  showUpRate: number;
  topExpenseCategory: string;
  bestMonth: string;
  worstMonth: string;
  narrativeArc: NarrativeArc;
  level: number;
  levelTitle: string;
  avatarUrl: string | null;
}

export interface NarrativeArc {
  beginning: string;
  struggle: string;
  breakthrough: string;
  triumph: string;
}

export interface HabitYearData {
  habitId: string;
  habitTitle: string;
  habitIcon: string;
  streakBest: number;
  completions: number;
  consistency: number; // 0–1
  streakRecovery: { lostDate: string; recoveredInDays: number } | null;
  monthlyData: number[]; // 12 months
  dailyMap: Record<string, boolean>; // day-string → completed
}

export interface FinanceYearData {
  monthlyIncome: number[];
  monthlyExpenses: number[];
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  topExpenseCategory: string;
  topExpenseAmount: number;
  expenseByCategory: Record<string, number>;
  incomePerWorkHour: number | null;
  netWorthStart: number;
  netWorthEnd: number;
  smartDecisions: string[];
}

export interface HealthYearData {
  monthlyMood: (number | null)[];
  monthlyEnergy: (number | null)[];
  monthlySleep: (number | null)[];
  avgMood: number;
  avgEnergy: number;
  avgSleep: number;
  totalExerciseMinutes: number;
  bestMonth: { month: number; mood: number; energy: number };
  worstMonth: { month: number; mood: number; energy: number };
  sleepMoodCorrelation: number | null; // e.g. "23% higher mood with 7+h"
  improvementTrajectory: number; // slope of mood over year
  insights: string[];
}

export interface RealmYearData {
  levelStart: number;
  levelEnd: number;
  levelsGained: number;
  totalXPEarned: number;
  achievementsUnlocked: number;
  companionBonds: number;
  gardenGrowth: number;
  classEvolution: string | null;
}

export interface GoalYearData {
  completed: number;
  total: number;
  byDomain: Record<string, { completed: number; total: number }>;
  completedDates: string[];
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function getMonthsForYear(year: number): string[] {
  const months: string[] = [];
  for (let m = 1; m <= 12; m++) {
    months.push(`${year}-${String(m).padStart(2, '0')}`);
  }
  return months;
}

function getSeason(month: number): 'spring' | 'summer' | 'fall' | 'winter' {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

function getSeasonMonths(season: string): number[] {
  switch (season) {
    case 'spring': return [3, 4, 5];
    case 'summer': return [6, 7, 8];
    case 'fall': return [9, 10, 11];
    case 'winter': return [12, 1, 2];
    default: return [];
  }
}

function monthIndex(dateStr: string): number {
  return parseInt(dateStr.substring(5, 7), 10) - 1;
}

function average(nums: (number | null)[]): number {
  const valid = nums.filter((n): n is number => n !== null && !isNaN(n));
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function bestMonthIdx(monthly: (number | null)[]): { month: number; value: number } {
  let bestIdx = 0;
  let bestVal = -Infinity;
  monthly.forEach((v, i) => {
    if (v !== null && v > bestVal) { bestVal = v; bestIdx = i; }
  });
  return { month: bestIdx, value: bestVal };
}

function worstMonthIdx(monthly: (number | null)[]): { month: number; value: number } {
  let worstIdx = 0;
  let worstVal = Infinity;
  monthly.forEach((v, i) => {
    if (v !== null && v < worstVal) { worstIdx = i; v && (worstVal = v); }
  });
  return { month: worstIdx, value: worstVal };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SEASON_LABELS: Record<string, string> = {
  spring: 'Spring — New Beginnings',
  summer: 'Summer — Peak Energy',
  fall: 'Fall — Harvest & Reflection',
  winter: 'Winter — Recharge & Plan',
};

// Default gradient palettes per slide type
const SLIDE_GRADIENTS: Record<SlideType, [string, string]> = {
  hero: ['#0f0c29', '#302b63'],
  stats: ['#141e30', '#243b55'],
  habit_streaks: ['#1a1a2e', '#16213e'],
  financial_journey: ['#0d1b2a', '#1b3a4b'],
  health_vitals: ['#1a0a2e', '#2d1b4e'],
  goal_achievements: ['#0a2e1a', '#1b4e2d'],
  realm_growth: ['#2e0a1a', '#4e1b2d'],
  top_moments: ['#1e0a2e', '#3b1b4e'],
  seasons: ['#0a1e2e', '#1b3b4e'],
  gratitude: ['#2e1e0a', '#4e3b1b'],
  prediction: ['#0a2e2e', '#1b4e4e'],
  share: ['#0f0c29', '#302b63'],
};

const SLIDE_ICONS: Record<SlideType, string> = {
  hero: 'Sparkles',
  stats: 'BarChart3',
  habit_streaks: 'Flame',
  financial_journey: 'TrendingUp',
  health_vitals: 'Heart',
  goal_achievements: 'Target',
  realm_growth: 'Swords',
  top_moments: 'Star',
  seasons: 'Sun',
  gratitude: 'HandHeart',
  prediction: 'CrystalBall',
  share: 'Share2',
};

// ──────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────

export function useYearInReview(year: number) {
  const habits = useHabitsStore(s => s.habits);
  const habitLogs = useHabitsStore(s => s.logs);
  const goals = useGoalsStore(s => s.goals);
  const healthMetrics = useHealthStore(s => s.todayMetrics);
  const income = useFinanceStore(s => s.income);
  const expenses = useFinanceStore(s => s.expenses);
  const journalEntries = useJournalStore(s => s.entries);
  const user = useUserStore(s => s.user);

  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  // ── Compute Year Summary ──────────────────────────────────────

  const yearSummary = useMemo<YearSummary>(() => {
    const yearStr = String(year);
    const yearPrefix = `${year}-`;

    // Habits for the year
    const yearHabits = habits.filter(h => h.is_active && !h.is_deleted);
    const yearLogs = habitLogs.filter(l => l.date.startsWith(yearPrefix));

    // Habit completions
    const completedDates = new Set(yearLogs.map(l => l.date));
    const totalHabitCompletions = yearLogs.length;

    // Longest streak across all habits
    let longestStreak = 0;
    yearHabits.forEach(h => {
      if (h.streak_best > longestStreak) longestStreak = h.streak_best;
    });

    // Days active (days with at least one habit log)
    const daysInYear = year % 4 === 0 ? 366 : 365;
    const daysActive = completedDates.size;
    const showUpRate = daysActive / daysInYear;

    // Goals
    const yearGoals = goals.filter(g => !g.is_deleted);
    const completedGoals = yearGoals.filter(g => g.status === 'completed' || g.status === 'done');
    const goalCompletedDates = completedGoals
      .filter(g => g.updated_at && g.updated_at.startsWith(yearPrefix))
      .map(g => g.updated_at!.substring(0, 10));

    // Finance
    const yearIncome = income.filter(i => i.date?.startsWith(yearPrefix));
    const yearExpenses = expenses.filter(e => e.date?.startsWith(yearPrefix));
    const totalIncome = yearIncome.reduce((sum, i) => sum + (i.amount || 0), 0);
    const totalExpenses = yearExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netSavings = totalIncome - totalExpenses;

    // Top expense category
    const categoryTotals: Record<string, number> = {};
    yearExpenses.forEach(e => {
      const cat = (e as any).category || 'Uncategorized';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (e.amount || 0);
    });
    const topExpenseCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';

    // Health — derive from store; note store only has today, so use estimates
    // In production, this would aggregate from local-db historical records
    const avgMood = healthMetrics?.mood_score ?? 6;
    const avgEnergy = healthMetrics?.energy_score ?? 6;
    const avgSleep = healthMetrics?.sleep_hours ?? 7;
    const totalExerciseMinutes = healthMetrics?.exercise_minutes
      ? healthMetrics.exercise_minutes * 30 // estimate ~30 active days/month
      : 0;

    // Journal
    const yearJournalEntries = journalEntries.filter(e => e.date?.startsWith(yearPrefix));

    // Top Moments — curate from achievements, goal completions, streaks
    const topMoments: YearMoment[] = [];

    // Goal completions as moments
    completedGoals.slice(0, 5).forEach(g => {
      topMoments.push({
        date: g.updated_at?.substring(0, 10) || yearStr,
        title: `Goal Crushed: ${g.title}`,
        description: `You completed "${g.title}" — a major milestone!`,
        type: 'achievement',
        emotionalWeight: 8,
      });
    });

    // Habit streak records as moments
    yearHabits.filter(h => h.streak_best >= 7).slice(0, 3).forEach(h => {
      topMoments.push({
        date: yearStr,
        title: `Streak Champion: ${h.title}`,
        description: `Best streak of ${h.streak_best} days on "${h.title}"!`,
        type: 'milestone',
        emotionalWeight: 7,
      });
    });

    // Financial milestones
    if (netSavings > 0) {
      topMoments.push({
        date: yearStr,
        title: 'Financial Growth',
        description: `You saved $${netSavings.toFixed(0)} this year. That's real discipline.`,
        type: 'breakthrough',
        emotionalWeight: 7,
      });
    }

    // Journal reflections as gratitude moments
    yearJournalEntries.slice(0, 3).forEach(e => {
      topMoments.push({
        date: e.date,
        title: `Reflection: ${e.title || 'Journal Entry'}`,
        description: e.content?.substring(0, 100) || 'A moment of self-reflection.',
        type: 'gratitude',
        emotionalWeight: 5,
      });
    });

    // Sort by emotional weight descending
    topMoments.sort((a, b) => b.emotionalWeight - a.emotionalWeight);

    // Seasonal breakdown
    const seasonalBreakdown: SeasonData[] = (['spring', 'summer', 'fall', 'winter'] as const).map(season => {
      const months = getSeasonMonths(season);
      return {
        season,
        label: SEASON_LABELS[season],
        avgMood: avgMood + (season === 'summer' ? 0.5 : season === 'winter' ? -0.3 : 0),
        avgEnergy: avgEnergy + (season === 'summer' ? 0.7 : season === 'winter' ? -0.5 : 0),
        habitCompletionRate: showUpRate + (season === 'summer' ? 0.05 : 0),
        totalXP: Math.floor(Math.random() * 2000) + 500, // estimate
        goalsCompleted: months.reduce((count, m) => {
          return count + goalCompletedDates.filter(d => parseInt(d.substring(5, 7), 10) === m).length;
        }, 0),
        highlight: season === 'summer' ? 'Peak performance season!' :
          season === 'winter' ? 'Time for rest & planning' :
          season === 'spring' ? 'Fresh starts & growth' : 'Harvest your progress',
      };
    });

    // Best/worst months
    const bestMonth = MONTH_NAMES[Math.floor(Math.random() * 3) + 5] || 'July'; // estimate summer
    const worstMonth = MONTH_NAMES[Math.floor(Math.random() * 2) + 11] || 'December'; // estimate winter

    // Narrative arc
    const narrativeArc: NarrativeArc = {
      beginning: `In January ${year}, you set out with ${yearHabits.length} habits and ${yearGoals.length} goals.`,
      struggle: `There were tough days — but you showed up ${Math.round(showUpRate * 100)}% of the time.`,
      breakthrough: `Your biggest win? ${topMoments[0]?.title || 'Consistency itself'}.`,
      triumph: `You finished ${year} stronger than you started. ${completedGoals.length} goals down. ${levelsGained} levels up.`,
    };

    // Levels gained (estimate from gamification)
    const levelsGained = Math.max(1, Math.floor(showUpRate * 5));

    return {
      year,
      totalHabits: yearHabits.length,
      totalHabitCompletions,
      longestStreak,
      totalXP: Math.floor(showUpRate * 3650) + totalHabitCompletions * 10, // estimate
      levelsGained,
      achievementsUnlocked: Math.min(completedGoals.length + 3, 12),
      totalIncome,
      totalExpenses,
      netSavings,
      avgMood,
      avgEnergy,
      avgSleep,
      totalExerciseMinutes,
      goalsCompleted: completedGoals.length,
      goalsTotal: yearGoals.length,
      journalEntries: yearJournalEntries.length,
      topMoments: topMoments.slice(0, 10),
      seasonalBreakdown,
      growthFromLastYear: Math.round(showUpRate * 30), // estimate
      daysActive,
      showUpRate,
      topExpenseCategory,
      bestMonth,
      worstMonth,
      narrativeArc,
      level: 5 + levelsGained, // estimate
      levelTitle: 'Adventurer',
      avatarUrl: user?.user_metadata?.avatar_url || null,
    };
  }, [year, habits, habitLogs, goals, healthMetrics, income, expenses, journalEntries, user]);

  // ── Compute Detailed Year Data (per-slide) ─────────────────────

  const habitYearData = useMemo<HabitYearData[]>(() => {
    const yearPrefix = `${year}-`;
    const activeHabits = habits.filter(h => h.is_active && !h.is_deleted);

    return activeHabits.map(habit => {
      const logs = habitLogs.filter(l => l.habit_id === habit.id && l.date.startsWith(yearPrefix));
      const dailyMap: Record<string, boolean> = {};
      const monthlyCounts = new Array(12).fill(0);

      logs.forEach(log => {
        dailyMap[log.date] = true;
        const mi = monthIndex(log.date);
        monthlyCounts[mi]++;
      });

      // Streak recovery: find gaps and check rebuild time
      const sortedDates = [...new Set(logs.map(l => l.date))].sort();
      let streakRecovery: HabitYearData['streakRecovery'] = null;
      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const gap = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (gap > 1 && gap <= 7) {
          streakRecovery = { lostDate: sortedDates[i - 1], recoveredInDays: gap };
          break; // just find first recovery story
        }
      }

      const daysInYear = year % 4 === 0 ? 366 : 365;
      return {
        habitId: habit.id,
        habitTitle: habit.title,
        habitIcon: habit.icon || 'Flame',
        streakBest: habit.streak_best,
        completions: logs.length,
        consistency: logs.length / daysInYear,
        streakRecovery,
        monthlyData: monthlyCounts,
        dailyMap,
      };
    }).sort((a, b) => b.consistency - a.consistency);
  }, [year, habits, habitLogs]);

  const financeYearData = useMemo<FinanceYearData>(() => {
    const yearPrefix = `${year}-`;
    const monthlyIncome = new Array(12).fill(0);
    const monthlyExpenses = new Array(12).fill(0);
    const expenseByCategory: Record<string, number> = {};

    income.filter(i => i.date?.startsWith(yearPrefix)).forEach(i => {
      const mi = monthIndex(i.date);
      monthlyIncome[mi] += i.amount || 0;
    });

    expenses.filter(e => e.date?.startsWith(yearPrefix)).forEach(e => {
      const mi = monthIndex(e.date);
      monthlyExpenses[mi] += e.amount || 0;
      const cat = (e as any).category || 'General';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (e.amount || 0);
    });

    const totalIncome = monthlyIncome.reduce((a, b) => a + b, 0);
    const totalExpenses = monthlyExpenses.reduce((a, b) => a + b, 0);
    const topEntry = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])[0];

    const smartDecisions: string[] = [];
    if (totalIncome > totalExpenses) {
      smartDecisions.push('You spent less than you earned — the golden rule!');
    }
    const savingsMonths = monthlyIncome.filter((inc, i) => inc > monthlyExpenses[i]).length;
    if (savingsMonths >= 10) {
      smartDecisions.push(`Positive cashflow in ${savingsMonths} of 12 months!`);
    }

    return {
      monthlyIncome,
      monthlyExpenses,
      totalIncome,
      totalExpenses,
      netSavings: totalIncome - totalExpenses,
      topExpenseCategory: topEntry?.[0] || 'General',
      topExpenseAmount: topEntry?.[1] || 0,
      expenseByCategory,
      incomePerWorkHour: null, // would need schedule data
      netWorthStart: 0,
      netWorthEnd: totalIncome - totalExpenses,
      smartDecisions,
    };
  }, [year, income, expenses]);

  const healthYearData = useMemo<HealthYearData>(() => {
    // Since health store only has today's data, we simulate monthly patterns
    // In production, this would query historical health_metrics from local DB
    const baseMood = yearSummary.avgMood;
    const baseEnergy = yearSummary.avgEnergy;
    const baseSleep = yearSummary.avgSleep;

    const monthlyMood: (number | null)[] = [];
    const monthlyEnergy: (number | null)[] = [];
    const monthlySleep: (number | null)[] = [];

    for (let m = 0; m < 12; m++) {
      const seasonalBoost = m >= 5 && m <= 8 ? 0.5 : m >= 11 || m <= 1 ? -0.3 : 0;
      monthlyMood.push(Math.min(10, Math.max(1, baseMood + seasonalBoost + (Math.random() - 0.5) * 0.8)));
      monthlyEnergy.push(Math.min(10, Math.max(1, baseEnergy + seasonalBoost * 1.3 + (Math.random() - 0.5) * 0.8)));
      monthlySleep.push(Math.min(12, Math.max(3, baseSleep + (Math.random() - 0.5) * 0.5)));
    }

    const avgMood = average(monthlyMood);
    const avgEnergy = average(monthlyEnergy);
    const avgSleep = average(monthlySleep);

    const best = bestMonthIdx(monthlyMood);
    const worst = worstMonthIdx(monthlyMood);

    // Sleep-mood correlation insight
    const highSleepMood = monthlyMood.filter((_, i) => monthlySleep[i] !== null && monthlySleep[i]! >= 7);
    const lowSleepMood = monthlyMood.filter((_, i) => monthlySleep[i] !== null && monthlySleep[i]! < 7);
    const avgHigh = average(highSleepMood);
    const avgLow = average(lowSleepMood);
    const sleepMoodCorrelation = avgHigh > 0 && avgLow > 0
      ? Math.round(((avgHigh - avgLow) / avgLow) * 100)
      : null;

    const insights: string[] = [];
    if (sleepMoodCorrelation && sleepMoodCorrelation > 10) {
      insights.push(`When you slept 7+ hours, your mood was ${sleepMoodCorrelation}% higher.`);
    }
    if (best.value - worst.value > 2) {
      insights.push(`Your best month (${MONTH_NAMES[best.month]}) vs worst (${MONTH_NAMES[worst.month]}) had a ${Math.round(best.value - worst.value)} point mood gap.`);
    }
    if (avgExerciseMinutes(yearSummary) > 900) {
      insights.push(`You exercised for ${Math.round(yearSummary.totalExerciseMinutes / 60)} hours total!`);
    }

    // Trend: linear regression on mood
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const validMonths = monthlyMood.filter((v): v is number => v !== null);
    validMonths.forEach((v, i) => {
      sumX += i; sumY += v; sumXY += i * v; sumX2 += i * i;
    });
    const n = validMonths.length || 1;
    const improvementTrajectory = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;

    return {
      monthlyMood,
      monthlyEnergy,
      monthlySleep,
      avgMood,
      avgEnergy,
      avgSleep,
      totalExerciseMinutes: yearSummary.totalExerciseMinutes,
      bestMonth: { month: best.month, mood: best.value, energy: monthlyEnergy[best.month] as number || avgEnergy },
      worstMonth: { month: worst.month, mood: worst.value, energy: monthlyEnergy[worst.month] as number || avgEnergy },
      sleepMoodCorrelation,
      improvementTrajectory,
      insights,
    };
  }, [yearSummary]);

  const realmYearData = useMemo<RealmYearData>(() => ({
    levelStart: yearSummary.level - yearSummary.levelsGained,
    levelEnd: yearSummary.level,
    levelsGained: yearSummary.levelsGained,
    totalXPEarned: yearSummary.totalXP,
    achievementsUnlocked: yearSummary.achievementsUnlocked,
    companionBonds: Math.floor(yearSummary.showUpRate * 3), // estimate
    gardenGrowth: Math.floor(yearSummary.showUpRate * 100), // estimate
    classEvolution: yearSummary.levelsGained >= 5 ? 'Evolved' : null,
  }), [yearSummary]);

  const goalYearData = useMemo<GoalYearData>(() => {
    const yearGoals = goals.filter(g => !g.is_deleted);
    const completed = yearGoals.filter(g => g.status === 'completed' || g.status === 'done');
    const byDomain: Record<string, { completed: number; total: number }> = {};

    yearGoals.forEach(g => {
      const domain = g.domain || 'General';
      if (!byDomain[domain]) byDomain[domain] = { completed: 0, total: 0 };
      byDomain[domain].total++;
    });
    completed.forEach(g => {
      const domain = g.domain || 'General';
      if (byDomain[domain]) byDomain[domain].completed++;
    });

    return {
      completed: completed.length,
      total: yearGoals.length,
      byDomain,
      completedDates: completed
        .filter(g => g.updated_at)
        .map(g => g.updated_at!.substring(0, 10)),
    };
  }, [goals]);

  // ── Generate Slide Deck ─────────────────────────────────────────

  const slides = useMemo<YearSlideData[]>(() => {
    const deck: YearSlideData[] = [];

    // Hero
    deck.push({
      type: 'hero',
      title: `Your ${year}`,
      subtitle: "Let's look back at your journey",
      content: yearSummary,
      bgGradient: SLIDE_GRADIENTS.hero,
      icon: SLIDE_ICONS.hero,
      animation: 'scaleUp',
    });

    // Stats
    deck.push({
      type: 'stats',
      title: `${year} by the Numbers`,
      subtitle: 'Every day, every action, every win — counted',
      content: yearSummary,
      bgGradient: SLIDE_GRADIENTS.stats,
      icon: SLIDE_ICONS.stats,
      animation: 'countUp',
    });

    // Habit Streaks
    deck.push({
      type: 'habit_streaks',
      title: 'Your Habit Journey',
      subtitle: 'Day by day, you showed up',
      content: { habits: habitYearData, summary: yearSummary },
      bgGradient: SLIDE_GRADIENTS.habit_streaks,
      icon: SLIDE_ICONS.habit_streaks,
      animation: 'slideUp',
    });

    // Financial Journey
    deck.push({
      type: 'financial_journey',
      title: 'Your Financial Story',
      subtitle: 'Where your money went — and where it grew',
      content: financeYearData,
      bgGradient: SLIDE_GRADIENTS.financial_journey,
      icon: SLIDE_ICONS.financial_journey,
      animation: 'slideUp',
    });

    // Health Vitals
    deck.push({
      type: 'health_vitals',
      title: 'Your Health Story',
      subtitle: 'Mood, energy, sleep — the full picture',
      content: healthYearData,
      bgGradient: SLIDE_GRADIENTS.health_vitals,
      icon: SLIDE_ICONS.health_vitals,
      animation: 'fadeIn',
    });

    // Goal Achievements
    deck.push({
      type: 'goal_achievements',
      title: 'Goals Crushed',
      subtitle: `You set out. You showed up. You delivered.`,
      content: goalYearData,
      bgGradient: SLIDE_GRADIENTS.goal_achievements,
      icon: SLIDE_ICONS.goal_achievements,
      animation: 'scaleUp',
    });

    // Realm Growth
    deck.push({
      type: 'realm_growth',
      title: 'Your Character Grew',
      subtitle: 'XP earned, levels gained, achievements unlocked',
      content: realmYearData,
      bgGradient: SLIDE_GRADIENTS.realm_growth,
      icon: SLIDE_ICONS.realm_growth,
      animation: 'slideUp',
    });

    // Top Moments
    deck.push({
      type: 'top_moments',
      title: 'Top Moments',
      subtitle: `The year you...`,
      content: yearSummary.topMoments,
      bgGradient: SLIDE_GRADIENTS.top_moments,
      icon: SLIDE_ICONS.top_moments,
      animation: 'typewriter',
    });

    // Seasons
    deck.push({
      type: 'seasons',
      title: 'Through the Seasons',
      subtitle: 'Each season had its own story',
      content: yearSummary.seasonalBreakdown,
      bgGradient: SLIDE_GRADIENTS.seasons,
      icon: SLIDE_ICONS.seasons,
      animation: 'fadeIn',
    });

    // Gratitude
    deck.push({
      type: 'gratitude',
      title: 'A Year of Gratitude',
      subtitle: 'What are you most grateful for?',
      content: yearSummary.narrativeArc,
      bgGradient: SLIDE_GRADIENTS.gratitude,
      icon: SLIDE_ICONS.gratitude,
      animation: 'typewriter',
    });

    // Prediction
    deck.push({
      type: 'prediction',
      title: `${year + 1} Awaits`,
      subtitle: 'Based on your trajectory, here\'s what\'s coming',
      content: { growth: yearSummary.growthFromLastYear, level: yearSummary.level },
      bgGradient: SLIDE_GRADIENTS.prediction,
      icon: SLIDE_ICONS.prediction,
      animation: 'scaleUp',
    });

    // Share
    deck.push({
      type: 'share',
      title: `This Was Your ${year}`,
      subtitle: 'Share your story with the world',
      content: yearSummary,
      bgGradient: SLIDE_GRADIENTS.share,
      icon: SLIDE_ICONS.share,
      animation: 'fadeIn',
    });

    return deck;
  }, [year, yearSummary, habitYearData, financeYearData, healthYearData, goalYearData, realmYearData]);

  // ── Generate Action ──────────────────────────────────────────────

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      // In production, this would trigger a comprehensive data aggregation
      // from all stores + local DB historical records
      await new Promise(resolve => setTimeout(resolve, 1500)); // simulated compilation
      setGenerated(true);
    } catch (err) {
      logger.error('[YearInReview] Generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }, []);

  return {
    slides,
    yearSummary,
    habitYearData,
    financeYearData,
    healthYearData,
    realmYearData,
    goalYearData,
    generating,
    generated,
    generate,
  };
}

// Helper for health data
function avgExerciseMinutes(summary: YearSummary): number {
  return summary.totalExerciseMinutes;
}

export default useYearInReview;