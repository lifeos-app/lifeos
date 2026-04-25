/**
 * Motivation Scoring — Daniel Pink's Drive framework
 *
 * Intrinsic motivation = Autonomy + Mastery + Purpose
 * Scores each dimension 0-100 based on user behavior data.
 * Pure functions — no React imports.
 */

import type { Goal, Habit, HabitLog } from '../types/database';

// ── TYPES ──

export interface MotivationScore {
  autonomy: number;
  mastery: number;
  purpose: number;
  overall: number;
  dominant: 'autonomy' | 'mastery' | 'purpose';
}

// ── HELPERS ──

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Count unique domains across goals and habits */
function countUniqueDomains(goals: Goal[], habits: Habit[]): number {
  const domains = new Set<string>();
  for (const g of goals) {
    if (g.domain) domains.add(g.domain);
    if (g.category) domains.add(g.category);
  }
  for (const h of habits) {
    if (h.category) domains.add(h.category);
  }
  return domains.size;
}

/** Count positive/growth words in text */
function countGrowthWords(text: string): number {
  const lower = text.toLowerCase();
  const growthWords = [
    'grateful', 'thankful', 'progress', 'learned', 'grew', 'improved',
    'achieved', 'accomplished', 'proud', 'excited', 'motivated',
    'inspired', 'breakthrough', 'milestone', 'success', 'better',
    'stronger', 'wiser', 'growth', 'opportunity', 'blessed',
    'love', 'happy', 'joy', 'fulfilled', 'meaningful',
  ];
  let count = 0;
  for (const word of growthWords) {
    if (lower.includes(word)) count++;
  }
  return count;
}

// ── DIMENSION CALCULATORS ──

/**
 * Autonomy (0-100): % of goals/habits user created vs AI-suggested,
 * variety of domains, self-directed scheduling patterns.
 */
function calculateAutonomy(goals: Goal[], habits: Habit[]): number {
  if (goals.length === 0 && habits.length === 0) return 50; // neutral baseline

  // Factor 1: Manual vs AI-created (40% weight)
  const totalItems = goals.length + habits.length;
  const manualGoals = goals.filter(g => g.source !== 'onboarding_ai').length;
  const manualHabits = habits.filter(h => h.source !== 'onboarding_ai').length;
  const manualRatio = totalItems > 0 ? (manualGoals + manualHabits) / totalItems : 0.5;
  const manualScore = manualRatio * 100;

  // Factor 2: Domain variety (30% weight) — more domains = more autonomous exploration
  const domainCount = countUniqueDomains(goals, habits);
  const domainScore = clamp(domainCount * 15, 0, 100); // 7+ domains = 100

  // Factor 3: Active goal count (30% weight) — more goals = more self-directed
  const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'in_progress').length;
  const goalScore = clamp(activeGoals * 12, 0, 100); // 8+ active goals = 100

  return Math.round(manualScore * 0.4 + domainScore * 0.3 + goalScore * 0.3);
}

/**
 * Mastery (0-100): XP growth rate, skill progression, habit difficulty advancement.
 */
function calculateMastery(goals: Goal[], habits: Habit[], logs: HabitLog[], profile: Record<string, unknown>): number {
  if (habits.length === 0 && goals.length === 0) return 30; // low baseline

  // Factor 1: Habit consistency (40% weight) — best streaks indicate mastery pursuit
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak_best || 0), 0);
  const currentStreaks = habits.reduce((sum, h) => sum + (h.streak_current || 0), 0);
  const streakScore = clamp(bestStreak * 5 + currentStreaks * 2, 0, 100);

  // Factor 2: XP/Level from profile (30% weight)
  const level = typeof profile?.level === 'number' ? profile.level : 1;
  const levelScore = clamp((level as number) * 8, 0, 100); // level 12+ = 100

  // Factor 3: Recent log frequency (30% weight) — consistent logging = mastery mindset
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyStr = thirtyDaysAgo.toISOString().split('T')[0];
  const recentLogs = logs.filter(l => l.date >= thirtyStr).length;
  const logScore = clamp(recentLogs * 3, 0, 100); // 33+ logs in 30 days = 100

  return Math.round(streakScore * 0.4 + levelScore * 0.3 + logScore * 0.3);
}

/**
 * Purpose (0-100): goal alignment with values, journal sentiment, longest streaks.
 */
function calculatePurpose(goals: Goal[], habits: Habit[], logs: HabitLog[], profile: Record<string, unknown>): number {
  if (goals.length === 0) return 30; // low baseline

  // Factor 1: Goals with descriptions/purpose (35% weight)
  const goalsWithDesc = goals.filter(g => g.description && g.description.length > 20).length;
  const descRatio = goals.length > 0 ? goalsWithDesc / goals.length : 0;
  const purposeArticulationScore = descRatio * 100;

  // Factor 2: Journal/profile sentiment (35% weight) — growth words indicate purpose alignment
  let sentimentScore = 50; // neutral default
  if (profile && typeof profile === 'object') {
    const profileStr = JSON.stringify(profile);
    const growthCount = countGrowthWords(profileStr);
    sentimentScore = clamp(growthCount * 10, 0, 100);
  }

  // Factor 3: Longest streaks (30% weight) — sustained effort reflects deep purpose
  const longestStreak = habits.reduce((max, h) => Math.max(max, h.streak_best || 0), 0);
  const streakPurpose = clamp(longestStreak * 4, 0, 100); // 25+ day best streak = 100

  return Math.round(purposeArticulationScore * 0.35 + sentimentScore * 0.35 + streakPurpose * 0.3);
}

// ── PUBLIC API ──

/**
 * Calculate the full motivation score across all three Drive dimensions.
 */
export function calculateMotivationScore(
  goals: Goal[],
  habits: Habit[],
  logs: HabitLog[],
  profile: Record<string, unknown>,
): MotivationScore {
  const autonomy = calculateAutonomy(goals, habits);
  const mastery = calculateMastery(goals, habits, logs, profile);
  const purpose = calculatePurpose(goals, habits, logs, profile);
  const overall = Math.round((autonomy + mastery + purpose) / 3);

  let dominant: 'autonomy' | 'mastery' | 'purpose' = 'autonomy';
  if (mastery >= autonomy && mastery >= purpose) dominant = 'mastery';
  else if (purpose >= autonomy && purpose >= mastery) dominant = 'purpose';

  return { autonomy, mastery, purpose, overall, dominant };
}

/**
 * Get a tailored insight based on the dominant motivation driver.
 */
export function getMotivationInsight(score: MotivationScore): string {
  if (score.overall < 30) {
    return 'Your motivation profile is still forming. Keep logging habits and working on goals to build your intrinsic drive baseline.';
  }

  switch (score.dominant) {
    case 'autonomy':
      return `You are driven by autonomy (${score.autonomy}/100). You thrive when you have control over your choices and direction. Protect your freedom to choose how you work and what you pursue.`;
    case 'mastery':
      return `You are driven by mastery (${score.mastery}/100). You find deep satisfaction in getting better at things that matter. Keep pushing your skills and tracking your progression.`;
    case 'purpose':
      return `You are driven by purpose (${score.purpose}/100). You are most motivated when your actions connect to something larger than yourself. Keep your goals aligned with your core values.`;
  }
}

/**
 * Get 2-3 actionable recommendations based on the motivation score.
 */
export function getMotivationRecommendations(score: MotivationScore): string[] {
  const recs: string[] = [];

  // Address the weakest dimension
  const weakest = score.autonomy <= score.mastery && score.autonomy <= score.purpose
    ? 'autonomy'
    : score.mastery <= score.purpose
      ? 'mastery'
      : 'purpose';

  switch (weakest) {
    case 'autonomy':
      recs.push('Create a goal in a new domain you have never explored. Expanding your range strengthens autonomy.');
      if (score.autonomy < 40) {
        recs.push('Review your current goals. Are any of them someone else\'s expectations? Replace one with something purely yours.');
      }
      break;
    case 'mastery':
      recs.push('Pick one habit and increase its difficulty slightly. Mastery comes from progressive challenge.');
      if (score.mastery < 40) {
        recs.push('Start a learning streak: commit to 15 minutes of deliberate practice daily for the next 7 days.');
      }
      break;
    case 'purpose':
      recs.push('Write a one-sentence purpose statement for your top goal. Why does it matter to you deeply?');
      if (score.purpose < 40) {
        recs.push('Journal about what kind of person you want to become. Align one goal to that vision.');
      }
      break;
  }

  // General recommendation based on overall score
  if (score.overall >= 70) {
    recs.push('Your intrinsic motivation is strong. Consider mentoring or sharing your systems with someone who is starting out.');
  } else if (score.overall >= 40) {
    recs.push('Build on your strength in ' + score.dominant + ' while developing the other dimensions for balanced drive.');
  }

  return recs.slice(0, 3);
}
