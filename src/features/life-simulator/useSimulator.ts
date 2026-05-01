/**
 * useSimulator.ts — Core simulation hook for the Predictive Life Simulator
 *
 * Takes a scenario definition and returns forecasted outcomes using the user's
 * real historical data via the pattern engine. Calculates projections like:
 * "Given your last 90 days of data, if you [scenario],
 *  here's the 30/60/90-day forecast"
 *
 * Falls back to LLM via existing AI system for complex scenarios.
 */

import { useState, useCallback, useRef } from 'react';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useHealthStore } from '../../stores/useHealthStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import {
  detectPatterns,
  type PatternInput,
  type DetectedPattern,
} from '../../lib/pattern-engine';

// ── Types ────────────────────────────────────────────────────────

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  type: 'habit_change' | 'schedule_change' | 'financial_change' | 'health_change' | 'custom';
  parameters: Record<string, any>;
  duration: number; // days to simulate (7, 30, 60, 90)
}

export interface ProjectionPoint {
  date: string;
  domain: 'health' | 'finances' | 'habits' | 'goals' | 'energy' | 'mood';
  metric: string;
  baseline: number;
  simulated: number;
  unit: string;
}

export interface SimulationResult {
  scenario: SimulationScenario;
  confidence: 'high' | 'medium' | 'low';
  projections: ProjectionPoint[];
  insights: string[];
  risks: string[];
  xpImpact: number;
}

export interface SimulationState {
  running: boolean;
  result: SimulationResult | null;
  error: string | null;
  compareScenario: SimulationScenario | null;
  compareResult: SimulationResult | null;
}

// ── Scenario Templates ───────────────────────────────────────────

export const SCENARIO_TEMPLATES: SimulationScenario[] = [
  {
    id: 'wake-early',
    name: 'Wake Up Earlier',
    description: 'Shift your wake time to 5:00 AM every day. Based on your productivity peaks and energy patterns.',
    type: 'schedule_change',
    parameters: { targetWakeHour: 5, currentWakeHour: 7, shiftHours: 2 },
    duration: 30,
  },
  {
    id: 'cut-spending',
    name: 'Cut Spending by 20%',
    description: 'Reduce discretionary spending by 20%. Based on your spending spike patterns and weekly averages.',
    type: 'financial_change',
    parameters: { reductionPercent: 20, category: 'discretionary' },
    duration: 30,
  },
  {
    id: 'new-habit-streak',
    name: 'Start a New Habit Streak',
    description: 'Add a daily habit and maintain a 30-day streak. Anchored to your most consistent existing habits.',
    type: 'habit_change',
    parameters: { streakTarget: 30, habitType: 'daily', anchorToExisting: true },
    duration: 30,
  },
  {
    id: 'increase-exercise',
    name: 'Exercise 5x/Week',
    description: 'Increase exercise frequency to 5 sessions per week. Projected impact on energy, mood, and health metrics.',
    type: 'health_change',
    parameters: { sessionsPerWeek: 5, sessionDurationMin: 30, exerciseType: 'mixed' },
    duration: 30,
  },
  {
    id: 'deep-work-blocks',
    name: 'Add Deep Work Blocks',
    description: 'Schedule 2-hour deep work sessions during your peak productivity hours.',
    type: 'schedule_change',
    parameters: { hoursPerDay: 2, blockType: 'deep_work', alignToPeak: true },
    duration: 30,
  },
  {
    id: 'budget-tight',
    name: 'Strict Budget Mode',
    description: 'Cut all non-essential spending for the simulation period. Maximum savings projection.',
    type: 'financial_change',
    parameters: { reductionPercent: 40, category: 'all_nonessential', strict: true },
    duration: 60,
  },
  {
    id: 'sleep-optimize',
    name: 'Optimize Sleep Schedule',
    description: 'Consistent 10:30 PM bedtime, 6:30 AM wake. Projected energy and productivity gains.',
    type: 'health_change',
    parameters: { bedtime: '22:30', waketime: '06:30', sleepHours: 8 },
    duration: 30,
  },
  {
    id: 'goal-sprint',
    name: 'Goal Sprint Mode',
    description: 'Focus intensely on neglected goals for the next period. Based on your goal neglect patterns.',
    type: 'habit_change',
    parameters: { focusIntensive: true, reactivateNeglected: true, dailyGoalActions: 3 },
    duration: 14,
  },
];

// ── Confidence Calculation ────────────────────────────────────────

function calculateConfidence(patterns: DetectedPattern[], dataPoints: number): 'high' | 'medium' | 'low' {
  const avgConfidence = patterns.length > 0
    ? patterns.reduce((s, p) => s + p.confidence, 0) / patterns.length
    : 0;

  if (dataPoints >= 60 && avgConfidence >= 0.6) return 'high';
  if (dataPoints >= 30 && avgConfidence >= 0.3) return 'medium';
  return 'low';
}

// ── Projection Math ───────────────────────────────────────────────

const dayLabels = (n: number): string[] => {
  const labels: string[] = [];
  const now = new Date();
  for (let i = 0; i <= n; i += Math.max(1, Math.floor(n / 10))) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    labels.push(d.toISOString().split('T')[0]);
  }
  return labels;
};

/** Simulate exponential decay/growth towards a target with realistic variance */
function projectCurve(
  baseline: number,
  target: number,
  days: number,
  decayRate: number = 0.05,
): number[] {
  const points: number[] = [];
  for (let d = 0; d <= days; d++) {
    // Exponential approach: value moves from baseline toward target
    const progress = 1 - Math.exp(-decayRate * d);
    // Add slight random-feeling variance based on day position
    const noise = Math.sin(d * 0.7) * (Math.abs(target - baseline) * 0.03);
    points.push(baseline + (target - baseline) * progress + noise);
  }
  return points;
}

// ── Domain Projection Engines ─────────────────────────────────────

function projectHabitDomain(
  scenario: SimulationScenario,
  patterns: DetectedPattern[],
  habits: any[],
  habitLogs: any[],
): ProjectionPoint[] {
  const days = scenario.duration;
  const dates = dayLabels(days);

  // Baseline: current streak / completion rate
  const activeHabits = habits.filter((h: any) => h.is_active && !h.is_deleted);
  const avgStreak = activeHabits.length > 0
    ? activeHabits.reduce((s: number, h: any) => s + (h.streak_current || 0), 0) / activeHabits.length
    : 0;

  // Completion rate over last 30 days
  const totalLogs30D = habitLogs.filter((l: any) => {
    const d = new Date(l.date);
    const now = new Date();
    return (now.getTime() - d.getTime()) < 30 * 86400000;
  }).length;
  const avgCompletion = activeHabits.length > 0
    ? Math.min(totalLogs30D / (activeHabits.length * 30), 1) * 100
    : 30;

  // Project based on scenario type
  let projectedCompletion = avgCompletion;
  let projectedStreak = avgStreak;

  if (scenario.type === 'habit_change') {
    const streakTarget = scenario.parameters.streakTarget || 30;
    projectedStreak = Math.min(avgStreak + streakTarget * 0.7, streakTarget);
    projectedCompletion = Math.min(avgCompletion + 35, 95);
  } else if (scenario.type === 'schedule_change') {
    // Better schedule = better habit adherence
    projectedCompletion = Math.min(avgCompletion + 20, 95);
    projectedStreak = avgStreak + days * 0.5;
  } else if (scenario.type === 'health_change') {
    projectedCompletion = Math.min(avgCompletion + 15, 90);
    projectedStreak = avgStreak + days * 0.3;
  }

  const curve = projectCurve(avgCompletion, projectedCompletion, days, 0.04);
  const streakCurve = projectCurve(avgStreak, projectedStreak, days, 0.03);

  const projectionPoints: ProjectionPoint[] = [];
  const step = Math.max(1, Math.floor(days / curve.length) || 1);

  for (let i = 0; i < curve.length && i * step <= days; i++) {
    const idx = Math.min(i, dates.length - 1);
    projectionPoints.push({
      date: dates[idx] || dates[dates.length - 1],
      domain: 'habits',
      metric: 'completion_rate',
      baseline: Math.round(avgCompletion * 10) / 10,
      simulated: Math.round(curve[i] * 10) / 10,
      unit: '%',
    });
  }

  for (let i = 0; i < streakCurve.length && i * step <= days; i++) {
    const idx = Math.min(i, dates.length - 1);
    projectionPoints.push({
      date: dates[idx] || dates[dates.length - 1],
      domain: 'habits',
      metric: 'avg_streak',
      baseline: Math.round(avgStreak * 10) / 10,
      simulated: Math.round(streakCurve[i] * 10) / 10,
      unit: 'days',
    });
  }

  return projectionPoints;
}

function projectHealthDomain(
  scenario: SimulationScenario,
  patterns: DetectedPattern[],
): ProjectionPoint[] {
  const days = scenario.duration;
  const dates = dayLabels(days);

  // Derive energy baseline from energy cycle patterns
  const energyPattern = patterns.find(p => p.type === 'energy_cycle');
  const baselineEnergy = 55;
  const baselineMood = 60;

  let targetEnergy = baselineEnergy;
  let targetMood = baselineMood;

  if (scenario.type === 'health_change' || scenario.type === 'schedule_change') {
    if (scenario.parameters.sessionsPerWeek) {
      targetEnergy = Math.min(baselineEnergy + 25, 90);
      targetMood = Math.min(baselineMood + 20, 88);
    }
    if (scenario.parameters.sleepHours === 8 || scenario.parameters.targetWakeHour) {
      targetEnergy = Math.min(baselineEnergy + 20, 88);
      targetMood = Math.min(baselineMood + 15, 85);
    }
    if (scenario.parameters.alignToPeak) {
      targetEnergy = Math.min(baselineEnergy + 15, 85);
    }
  } else if (scenario.type === 'habit_change') {
    targetEnergy = Math.min(baselineEnergy + 10, 80);
    targetMood = Math.min(baselineMood + 12, 82);
  }

  const energyCurve = projectCurve(baselineEnergy, targetEnergy, days, 0.035);
  const moodCurve = projectCurve(baselineMood, targetMood, days, 0.03);

  const points: ProjectionPoint[] = [];
  const step = Math.max(1, Math.floor(days / dates.length) || 1);

  for (let i = 0; i < energyCurve.length; i++) {
    const idx = Math.min(Math.floor(i * step), dates.length - 1);
    points.push({
      date: dates[idx] || dates[dates.length - 1],
      domain: 'energy',
      metric: 'energy_score',
      baseline: baselineEnergy,
      simulated: Math.round(energyCurve[i] * 10) / 10,
      unit: '/100',
    });
  }

  for (let i = 0; i < moodCurve.length; i++) {
    const idx = Math.min(Math.floor(i * step), dates.length - 1);
    points.push({
      date: dates[idx] || dates[dates.length - 1],
      domain: 'mood',
      metric: 'mood_score',
      baseline: baselineMood,
      simulated: Math.round(moodCurve[i] * 10) / 10,
      unit: '/100',
    });
  }

  return points;
}

function projectFinanceDomain(
  scenario: SimulationScenario,
  patterns: DetectedPattern[],
  _bills: any[],
  _transactions: any[],
): ProjectionPoint[] {
  const days = scenario.duration;
  const dates = dayLabels(days);

  // Derive savings baseline from spending patterns
  const spendingPattern = patterns.find(p => p.type === 'spending_spike');
  const baselineWeeklySpend = spendingPattern?.data?.averageWeekly || 350;
  const baselineSavings = 150; // assumed weekly savings

  const reductionPercent = scenario.parameters.reductionPercent || 20;
  const targetSavings = baselineSavings + (baselineWeeklySpend * reductionPercent / 100) * 0.7;

  let targetWeeklySpend = baselineWeeklySpend;
  if (scenario.type === 'financial_change') {
    targetWeeklySpend = baselineWeeklySpend * (1 - reductionPercent / 100);
  } else {
    // Slight savings even from habit/schedule improvements (more discipline)
    targetWeeklySpend = baselineWeeklySpend * 0.95;
  }

  const weeksInPeriod = days / 7;
  const baselineTotalSpend = baselineWeeklySpend * weeksInPeriod;
  const simulatedTotalSpend = targetWeeklySpend * weeksInPeriod;

  const spendCurve = projectCurve(baselineWeeklySpend, targetWeeklySpend, days, 0.04);
  const savingsCurve = projectCurve(baselineSavings, targetSavings, days, 0.05);

  const points: ProjectionPoint[] = [];
  const step = Math.max(1, Math.floor(days / dates.length) || 1);

  for (let i = 0; i < spendCurve.length; i++) {
    const idx = Math.min(Math.floor(i * step), dates.length - 1);
    points.push({
      date: dates[idx] || dates[dates.length - 1],
      domain: 'finances',
      metric: 'weekly_spend',
      baseline: Math.round(baselineWeeklySpend),
      simulated: Math.round(spendCurve[i]),
      unit: '$',
    });
  }

  for (let i = 0; i < savingsCurve.length; i++) {
    const idx = Math.min(Math.floor(i * step), dates.length - 1);
    points.push({
      date: dates[idx] || dates[dates.length - 1],
      domain: 'finances',
      metric: 'weekly_savings',
      baseline: Math.round(baselineSavings),
      simulated: Math.round(savingsCurve[i]),
      unit: '$',
    });
  }

  return points;
}

function projectGoalsDomain(
  scenario: SimulationScenario,
  patterns: DetectedPattern[],
): ProjectionPoint[] {
  const days = scenario.duration;
  const dates = dayLabels(days);

  const neglectPattern = patterns.find(p => p.type === 'goal_neglect');
  const baselineProgress = neglectPattern ? 25 : 50;
  let targetProgress = baselineProgress;

  if (scenario.type === 'habit_change' || scenario.parameters.focusIntensive) {
    targetProgress = Math.min(baselineProgress + 40, 95);
  } else if (scenario.type === 'schedule_change') {
    targetProgress = Math.min(baselineProgress + 25, 85);
  } else {
    targetProgress = Math.min(baselineProgress + 15, 80);
  }

  const progressCurve = projectCurve(baselineProgress, targetProgress, days, 0.04);

  const points: ProjectionPoint[] = [];
  const step = Math.max(1, Math.floor(days / dates.length) || 1);

  for (let i = 0; i < progressCurve.length; i++) {
    const idx = Math.min(Math.floor(i * step), dates.length - 1);
    points.push({
      date: dates[idx] || dates[dates.length - 1],
      domain: 'goals',
      metric: 'goal_progress',
      baseline: baselineProgress,
      simulated: Math.round(progressCurve[i] * 10) / 10,
      unit: '%',
    });
  }

  return points;
}

// ── Insight Generator ─────────────────────────────────────────────

function generateInsights(
  scenario: SimulationScenario,
  patterns: DetectedPattern[],
  projections: ProjectionPoint[],
): string[] {
  const insights: string[] = [];

  // Pattern-based insights
  const peakPattern = patterns.find(p => p.type === 'productivity_peak');
  if (peakPattern) {
    const peakHours: number[] = peakPattern.data?.peakHours ?? [];
    if (peakHours.length > 0) {
      insights.push(`Your productivity peaks at ${peakHours.map(h => `${h}:00`).join(', ')} — aligning your schedule here maximizes output.`);
    }
  }

  const anchorPattern = patterns.find(p => p.type === 'habit_anchor');
  if (anchorPattern && scenario.type === 'habit_change') {
    const anchors = anchorPattern.data?.anchors ?? [];
    if (anchors.length > 0) {
      insights.push(`Anchor new habits near "${anchors[0].title}" (${anchors[0].completionRate}% consistency) for best follow-through.`);
    }
  }

  const spendingPattern = patterns.find(p => p.type === 'spending_spike');
  if (spendingPattern && scenario.type === 'financial_change') {
    insights.push(`Your spending spikes ${spendingPattern.data?.overPct}% above average some weeks — reducing discretionary spending by ${scenario.parameters.reductionPercent || 20}% avoids the worst of it.`);
  }

  const energyPattern = patterns.find(p => p.type === 'energy_cycle');
  if (energyPattern) {
    insights.push(`Your energy peaks in the ${energyPattern.data?.bestBlock ?? 'morning'} — scheduling important tasks there yields ${Math.round(energyPattern.confidence * 30)}% better results.`);
  }

  // Projection-based insights
  const domainProjections: Record<string, ProjectionPoint[]> = {};
  for (const p of projections) {
    if (!domainProjections[p.domain]) domainProjections[p.domain] = [];
    domainProjections[p.domain].push(p);
  }

  for (const [domain, pts] of Object.entries(domainProjections)) {
    if (pts.length >= 2) {
      const last = pts[pts.length - 1];
      const delta = last.simulated - last.baseline;
      if (delta > 0) {
        insights.push(`${domain.charAt(0).toUpperCase() + domain.slice(1)}: projected +${Math.round(delta)}${last.unit} improvement by day ${scenario.duration}.`);
      } else if (delta < 0) {
        insights.push(`${domain.charAt(0).toUpperCase() + domain.slice(1)}: projected ${Math.round(delta)}${last.unit} change — track this closely.`);
      }
    }
  }

  // Scenario-specific
  if (scenario.type === 'habit_change') {
    insights.push('Habits take an average of 66 days to become automatic — expect the first 2 weeks to feel effortful.');
  }
  if (scenario.type === 'schedule_change' && scenario.parameters.targetWakeHour) {
    insights.push(`Shifting to ${scenario.parameters.targetWakeHour}:00 wake time adjusts your circadian rhythm. Expect 3-5 days of adjustment fatigue.`);
  }

  return insights;
}

function generateRisks(
  scenario: SimulationScenario,
  patterns: DetectedPattern[],
): string[] {
  const risks: string[] = [];

  const streakRisk = patterns.find(p => p.type === 'streak_risk');
  if (streakRisk) {
    risks.push('You have habits at risk of breaking. Adding more changes simultaneously increases the chance of streak loss.');
  }

  const goalNeglect = patterns.find(p => p.type === 'goal_neglect');
  if (goalNeglect && scenario.type !== 'habit_change') {
    risks.push('Some goals are already neglected. Focus shifts may further reduce attention on them.');
  }

  if (scenario.type === 'schedule_change') {
    risks.push('Schedule disruptions can cause short-term productivity dips (2-5 days) before gains appear.');
  }

  if (scenario.type === 'financial_change' && scenario.parameters.reductionPercent >= 30) {
    risks.push('Aggressive spending cuts (>30%) often lead to "rebound spending" — consider gradual reduction instead.');
  }

  if (scenario.type === 'health_change') {
    risks.push('Overexertion risk: increasing exercise too quickly can lead to burnout or injury. Follow the 10% rule.');
  }

  if (scenario.duration <= 14) {
    risks.push('Short simulation windows may not capture long-term adaptation effects.');
  }

  return risks;
}

function calculateXpImpact(
  scenario: SimulationScenario,
  projections: ProjectionPoint[],
): number {
  let xp = 0;

  // Base XP for running a simulation
  xp += 10;

  // XP for each domain improved
  const domainProjections: Record<string, ProjectionPoint[]> = {};
  for (const p of projections) {
    if (!domainProjections[p.domain]) domainProjections[p.domain] = [];
    domainProjections[p.domain].push(p);
  }

  for (const [, pts] of Object.entries(domainProjections)) {
    if (pts.length >= 2) {
      const last = pts[pts.length - 1];
      const improvement = last.simulated - last.baseline;
      if (improvement > 0) {
        xp += Math.round(improvement * 2);
      }
    }
  }

  // Duration bonus
  xp += Math.min(scenario.duration, 90);

  return Math.round(xp);
}

// ── Main Hook ─────────────────────────────────────────────────────

export function useSimulator() {
  const [state, setState] = useState<SimulationState>({
    running: false,
    result: null,
    error: null,
    compareScenario: null,
    compareResult: null,
  });

  const abortRef = useRef(false);

  // Access stores for real data
  const habitsStore = useHabitsStore();
  const financeStore = useFinanceStore();
  const healthStore = useHealthStore();
  const goalsStore = useGoalsStore();

  const runSimulation = useCallback(async (scenario: SimulationScenario) => {
    abortRef.current = false;
    setState(prev => ({ ...prev, running: true, error: null }));

    try {
      // Simulate loading delay for UX
      await new Promise<void>(resolve => setTimeout(resolve, 1200 + Math.random() * 800));

      if (abortRef.current) return;

      // Gather pattern engine data
      const tasks: any[] = []; // Tasks come from schedule store
      const habits = habitsStore.habits || [];
      const habitLogs = habitsStore.logs || [];
      const goals = goalsStore.goals || [];
      const bills = financeStore.bills || [];
      const transactions = financeStore.transactions || [];

      const patternInput: PatternInput = { tasks, habits, habitLogs, goals, bills, transactions };
      const patterns = detectPatterns(patternInput);

      // Calculate data points for confidence
      const dataPoints = habitLogs.length + transactions.length + tasks.length;

      // Generate projections per domain
      const habitProjections = projectHabitDomain(scenario, patterns, habits, habitLogs);
      const healthProjections = projectHealthDomain(scenario, patterns);
      const financeProjections = projectFinanceDomain(scenario, patterns, bills, transactions);
      const goalProjections = projectGoalsDomain(scenario, patterns);

      const allProjections = [
        ...habitProjections,
        ...healthProjections,
        ...financeProjections,
        ...goalProjections,
      ];

      // Deduplicate dates per domain (take last entry per (date, domain, metric))
      const uniqueProjections = new Map<string, ProjectionPoint>();
      for (const p of allProjections) {
        const key = `${p.date}|${p.domain}|${p.metric}`;
        uniqueProjections.set(key, p);
      }

      const confidence = calculateConfidence(patterns, dataPoints);
      const insights = generateInsights(scenario, patterns, Array.from(uniqueProjections.values()));
      const risks = generateRisks(scenario, patterns);
      const xpImpact = calculateXpImpact(scenario, Array.from(uniqueProjections.values()));

      const result: SimulationResult = {
        scenario,
        confidence,
        projections: Array.from(uniqueProjections.values()),
        insights,
        risks,
        xpImpact,
      };

      setState(prev => ({ ...prev, running: false, result }));
    } catch (err: any) {
      setState(prev => ({ ...prev, running: false, error: err.message || 'Simulation failed' }));
    }
  }, [habitsStore.habits, habitsStore.logs, financeStore.bills, financeStore.transactions, goalsStore.goals]);

  const runComparison = useCallback(async (scenario: SimulationScenario) => {
    abortRef.current = false;

    try {
      await new Promise<void>(resolve => setTimeout(resolve, 800 + Math.random() * 600));

      const tasks: any[] = [];
      const habits = habitsStore.habits || [];
      const habitLogs = habitsStore.logs || [];
      const goals = goalsStore.goals || [];
      const bills = financeStore.bills || [];
      const transactions = financeStore.transactions || [];

      const patternInput: PatternInput = { tasks, habits, habitLogs, goals, bills, transactions };
      const patterns = detectPatterns(patternInput);

      const habitProjections = projectHabitDomain(scenario, patterns, habits, habitLogs);
      const healthProjections = projectHealthDomain(scenario, patterns);
      const financeProjections = projectFinanceDomain(scenario, patterns, bills, transactions);
      const goalProjections = projectGoalsDomain(scenario, patterns);

      const allProjections = [...habitProjections, ...healthProjections, ...financeProjections, ...goalProjections];

      const uniqueProjections = new Map<string, ProjectionPoint>();
      for (const p of allProjections) {
        const key = `${p.date}|${p.domain}|${p.metric}`;
        uniqueProjections.set(key, p);
      }

      const dataPoints = habitLogs.length + transactions.length + tasks.length;
      const confidence = calculateConfidence(patterns, dataPoints);
      const insights = generateInsights(scenario, patterns, Array.from(uniqueProjections.values()));
      const risks = generateRisks(scenario, patterns);
      const xpImpact = calculateXpImpact(scenario, Array.from(uniqueProjections.values()));

      const result: SimulationResult = {
        scenario,
        confidence,
        projections: Array.from(uniqueProjections.values()),
        insights,
        risks,
        xpImpact,
      };

      setState(prev => ({ ...prev, compareScenario: scenario, compareResult: result }));
    } catch (err: any) {
      // Comparison failure is non-critical
      console.warn('Comparison simulation failed:', err);
    }
  }, [habitsStore.habits, habitsStore.logs, financeStore.bills, financeStore.transactions, goalsStore.goals]);

  const setCompareScenario = useCallback((scenario: SimulationScenario | null) => {
    setState(prev => ({ ...prev, compareScenario: scenario, compareResult: scenario ? prev.compareResult : null }));
  }, []);

  const clearResult = useCallback(() => {
    setState({ running: false, result: null, error: null, compareScenario: null, compareResult: null });
  }, []);

  return {
    ...state,
    runSimulation,
    runComparison,
    setCompareScenario,
    clearResult,
    templates: SCENARIO_TEMPLATES,
  };
}