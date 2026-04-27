/**
 * Natural Language Query Engine — Pattern-matching query engine for LifeOS data
 *
 * Maps common analytical question patterns to data queries against Zustand stores.
 * Not a full NL2SQL — uses regex pattern matching for reliable, instant responses.
 * Saves API costs by answering data questions locally without LLM calls.
 */

import { localGetAll, localQuery } from './local-db';
import type { HealthMetric } from '../types/database';
import { logger } from '../utils/logger';

// ─── Types ──────────────────────────────────────────────────────

export interface StoreAccess {
  journal: any;   // useJournalStore
  habits: any;    // useHabitsStore
  health: any;    // useHealthStore
  goals: any;     // useGoalsStore
  finance: any;   // useFinanceStore
  schedule: any;  // useScheduleStore
}

export interface QueryResult {
  answer: string;                                               // natural language answer
  data?: any[];                                                 // raw data for visualization
  chartType?: 'line' | 'bar' | 'table' | 'stat';               // suggested visualization
  question: string;                                             // the original question
  confidence: number;                                           // 0-1, how confident we are
}

export interface QueryPattern {
  id: string;
  patterns: RegExp[];
  description: string;
  execute: (matches: RegExpMatchArray, stores: StoreAccess) => Promise<QueryResult>;
}

// ─── Helpers ────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); // Monday
  return d.toISOString().split('T')[0];
}

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
}

function formatNumber(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

function isStoreHydrated(store: any): boolean {
  return store && !store.loading && store.lastFetched != null;
}

/** Load historical health metrics from local DB (not cached in store) */
async function loadHealthHistory(days: number): Promise<HealthMetric[]> {
  try {
    const from = daysAgo(days);
    const all = await localGetAll<HealthMetric>('health_metrics');
    return all
      .filter(m => !m.is_deleted && m.date >= from)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    logger.warn('[nl-query] Failed to load health history:', err);
    return [];
  }
}

/** Average of numeric values, ignoring nulls/undefined */
function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

/** Build a simple text bar chart */
function textBarChart(data: { label: string; value: number }[], maxBars = 10): string {
  if (data.length === 0) return '(no data)';
  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const maxBarWidth = 20;
  const lines = data.slice(0, maxBars).map(d => {
    const width = Math.round((Math.abs(d.value) / maxVal) * maxBarWidth);
    const bar = '█'.repeat(Math.max(width, 1));
    const sign = d.value < 0 ? '-' : '';
    return `${d.label.padEnd(12)} ${sign}${bar} ${d.value}`;
  });
  return lines.join('\n');
}

// ─── Query Patterns ─────────────────────────────────────────────

const SLEEP_QUERY: QueryPattern = {
  id: 'sleep',
  patterns: [
    /how many hours (?:did i|have i) sleep\s*(?:last night|yesterday)/i,
    /how much (?:did i|have i) sleep\s*(?:last night|yesterday)/i,
    /how many hours (?:did i|have i) sleep\s*(?:this week|over the past week|in the last week)/i,
    /how (?:many hours much) (?:did i|have i) sleep\s*(?:on weekdays)/i,
    /when (?:did i sleep|have i slept) less than (\d+)\s*hours/i,
    /how (?:much|many hours).+sleep\s*(?:this|this week|lately|recently|average)/i,
  ],
  description: 'Sleep duration queries',
  execute: async (match, stores) => {
    const question = match[0];
    const healthHistory = await loadHealthHistory(30);
    if (healthHistory.length === 0) {
      return { answer: 'No sleep data found. Start logging your health metrics to get sleep insights.', question, confidence: 0.3, chartType: 'stat' as const };
    }

    // "less than N hours" query
    const lessThanMatch = question.match(/less than (\d+)\s*hours/i);
    if (lessThanMatch) {
      const threshold = parseInt(lessThanMatch[1], 10);
      const shortNights = healthHistory.filter(m => m.sleep_hours != null && m.sleep_hours < threshold);
      if (shortNights.length === 0) {
        return { answer: `Great news — you haven't slept less than ${threshold} hours in the past 30 days!`, question, confidence: 0.85, chartType: 'stat', data: shortNights };
      }
      const nightsStr = shortNights.map(m => `${m.date}: ${m.sleep_hours}h`).join(', ');
      return {
        answer: `You slept less than ${threshold} hours on ${shortNights.length} night(s) in the past 30 days: ${nightsStr}`,
        question,
        confidence: 0.85,
        chartType: 'table',
        data: shortNights.map(m => ({ date: m.date, hours: m.sleep_hours })),
      };
    }

    // "last night" query
    const isLastNight = /last night|yesterday/i.test(question);
    if (isLastNight) {
      const yesterday = daysAgo(1);
      const lastNight = healthHistory.find(m => m.date === yesterday);
      if (!lastNight || lastNight.sleep_hours == null) {
        const todayData = healthHistory.find(m => m.date === today());
        if (todayData?.sleep_hours != null) {
          return { answer: `You slept ${formatNumber(todayData.sleep_hours)} hours last night.`, question, confidence: 0.9, chartType: 'stat', data: [{ date: today(), hours: todayData.sleep_hours }] };
        }
        return { answer: "I don't have sleep data for last night yet. Make sure you've logged your health metrics.", question, confidence: 0.3, chartType: 'stat' };
      }
      return { answer: `You slept ${formatNumber(lastNight.sleep_hours)} hours last night.`, question, confidence: 0.9, chartType: 'stat', data: [{ date: yesterday, hours: lastNight.sleep_hours }] };
    }

    // "this week" or average query
    const isThisWeek = /this week|past week|last week/i.test(question);
    const relevant = isThisWeek
      ? healthHistory.filter(m => m.date >= startOfWeek() && m.sleep_hours != null)
      : healthHistory.filter(m => m.sleep_hours != null);

    if (relevant.length === 0) {
      return { answer: 'Not enough sleep data available for the requested period.', question, confidence: 0.3, chartType: 'stat' };
    }

    const avgSleep = avg(relevant.map(m => m.sleep_hours!));
    const chartData = relevant.slice(-7).map(m => ({ label: m.date.slice(5), value: m.sleep_hours! }));
    const totalHours = relevant.reduce((s, m) => s + (m.sleep_hours || 0), 0);

    if (isThisWeek) {
      return {
        answer: `This week you've slept an average of ${formatNumber(avgSleep!)} hours per night (${totalHours.toFixed(0)} hours total over ${relevant.length} nights).`,
        question,
        confidence: 0.85,
        chartType: 'bar',
        data: chartData,
      };
    }

    return {
      answer: `Your average sleep over the past ${relevant.length} recorded days is ${formatNumber(avgSleep!)} hours per night.`,
      question,
      confidence: 0.75,
      chartType: 'bar',
      data: chartData,
    };
  },
};

const MOOD_QUERY: QueryPattern = {
  id: 'mood',
  patterns: [
    /what'?s?\s*(?:is|was)?\s*my average mood/i,
    /how'?s?\s*my mood\s*(?:this week|lately|recently|overall)/i,
    /average mood\s*(?:this week|this month|lately)/i,
    /mood trend/i,
  ],
  description: 'Mood average and trend queries',
  execute: async (match, stores) => {
    const question = match[0];
    const healthHistory = await loadHealthHistory(30);

    // Also check journal entries for mood data
    const journalEntries = stores.journal?.entries || [];
    const journalWithMood = journalEntries.filter((e: any) => e.mood != null);

    // Combine both data sources — prefer health metrics
    let moodData: { date: string; mood: number }[] = [];

    if (healthHistory.length > 0) {
      moodData = healthHistory
        .filter(m => m.mood_score != null)
        .map(m => ({ date: m.date, mood: m.mood_score! }));
    }

    // Fill gaps from journal if available
    if (journalWithMood.length > 0) {
      const datesCovered = new Set(moodData.map(d => d.date));
      for (const e of journalWithMood) {
        if (!datesCovered.has(e.date) && e.mood != null) {
          moodData.push({ date: e.date, mood: e.mood });
          datesCovered.add(e.date);
        }
      }
    }

    moodData.sort((a, b) => a.date.localeCompare(b.date));

    if (moodData.length === 0) {
      return { answer: 'No mood data found. Log your mood in health metrics or journal entries to start tracking.', question, confidence: 0.3, chartType: 'stat' };
    }

    const isThisWeek = /this week/i.test(question);
    const relevant = isThisWeek
      ? moodData.filter(d => d.date >= startOfWeek())
      : moodData;

    if (relevant.length === 0) {
      return { answer: 'Not enough mood data for the requested period.', question, confidence: 0.3, chartType: 'stat' };
    }

    const avgMood = avg(relevant.map(d => d.mood))!;
    const chartData = relevant.slice(-7).map(d => ({ label: d.date.slice(5), value: d.mood }));
    const periodLabel = isThisWeek ? 'this week' : `over ${relevant.length} recorded days`;

    // Determine trend
    let trend = '';
    if (relevant.length >= 3) {
      const firstHalf = relevant.slice(0, Math.floor(relevant.length / 2));
      const secondHalf = relevant.slice(Math.floor(relevant.length / 2));
      const firstAvg = avg(firstHalf.map(d => d.mood))!;
      const secondAvg = avg(secondHalf.map(d => d.mood))!;
      if (secondAvg > firstAvg + 0.3) trend = ' (trending up ↑)';
      else if (secondAvg < firstAvg - 0.3) trend = ' (trending down ↓)';
      else trend = ' (stable →)';
    }

    return {
      answer: `Your average mood ${periodLabel} is ${formatNumber(avgMood)}/10${trend}.`,
      question,
      confidence: 0.8,
      chartType: 'line',
      data: chartData,
    };
  },
};

const MOOD_CORRELATION_QUERY: QueryPattern = {
  id: 'mood-correlation',
  patterns: [
    /how does my mood (?:correlate|relate) with (exercise|sleep|habits|water|stress)/i,
    /(?:does|does) (exercise|sleep|habits|water|stress) (?:affect|impact) my mood/i,
    /mood (?:and|&|vs\.?) (exercise|sleep|habits|water|stress)/i,
  ],
  description: 'Mood correlation queries',
  execute: async (match, stores) => {
    const question = match[0];
    const factor = (match[1] || '').toLowerCase();
    const healthHistory = await loadHealthHistory(30);

    const withMood = healthHistory.filter(m => m.mood_score != null);
    if (withMood.length < 3) {
      return { answer: 'Not enough data to analyze mood correlations. Keep logging your health metrics daily!', question, confidence: 0.2, chartType: 'stat' };
    }

    let correlation = '';
    let chartData: { label: string; value: number }[] = [];

    if (factor === 'exercise') {
      const withBoth = withMood.filter(m => m.exercise_minutes != null);
      if (withBoth.length < 3) {
        return { answer: 'Not enough data with both mood and exercise logged to find a correlation.', question, confidence: 0.25, chartType: 'stat' };
      }
      const medSplit = withBoth.filter(m => (m.exercise_minutes || 0) > 0);
      const noExSplit = withBoth.filter(m => (m.exercise_minutes || 0) === 0);
      const moodWithEx = avg(medSplit.map(m => m.mood_score!));
      const moodNoEx = avg(noExSplit.map(m => m.mood_score!));
      if (moodWithEx != null && moodNoEx != null) {
        correlation = `On days you exercised, your average mood was ${formatNumber(moodWithEx)}/10 vs ${formatNumber(moodNoEx)}/10 on rest days.`;
        if (moodWithEx > moodNoEx + 0.3) correlation += ' Exercise seems to boost your mood! 💪';
        else if (moodWithEx < moodNoEx - 0.3) correlation += ' Surprisingly, rest days have higher mood. Maybe you need recovery days!';
        else correlation += ' There doesn\'t seem to be a strong mood difference.';
      }
      chartData = withBoth.slice(-14).map(m => ({
        label: m.date!.slice(5),
        value: m.mood_score!,
      }));
    } else if (factor === 'sleep') {
      const withBoth = withMood.filter(m => m.sleep_hours != null);
      if (withBoth.length < 3) {
        return { answer: 'Not enough data with both mood and sleep logged to find a correlation.', question, confidence: 0.25, chartType: 'stat' };
      }
      // Split by good sleep (>=7h) vs poor sleep (<7h)
      const goodSleep = withBoth.filter(m => (m.sleep_hours || 0) >= 7);
      const poorSleep = withBoth.filter(m => (m.sleep_hours || 0) < 7);
      const moodGoodSleep = avg(goodSleep.map(m => m.mood_score!));
      const moodPoorSleep = avg(poorSleep.map(m => m.mood_score!));
      if (moodGoodSleep != null || moodPoorSleep != null) {
        const good = moodGoodSleep != null ? formatNumber(moodGoodSleep) : '?';
        const poor = moodPoorSleep != null ? formatNumber(moodPoorSleep) : '?';
        correlation = `After 7+ hours sleep, your mood averages ${good}/10 vs ${poor}/10 on <7h nights.`;
        if (moodGoodSleep != null && moodPoorSleep != null) {
          if (moodGoodSleep > moodPoorSleep + 0.3) correlation += ' Better sleep clearly improves your mood! 😴';
          else if (moodGoodSleep < moodPoorSleep - 0.3) correlation += ' Interestingly, shorter sleep nights have better mood. You might be a night owl!';
          else correlation += ' Sleep duration doesn\'t seem to strongly affect your mood.';
        }
      }
      chartData = withBoth.slice(-14).map(m => ({
        label: m.date!.slice(5),
        value: m.mood_score!,
      }));
    } else {
      correlation = `I can analyze mood correlations with exercise, sleep, water, or stress. Try asking about one of those!`;
      return { answer: correlation, question, confidence: 0.3, chartType: 'stat' };
    }

    return {
      answer: correlation,
      question,
      confidence: 0.7,
      chartType: 'line',
      data: chartData,
    };
  },
};

const HABIT_STREAK_QUERY: QueryPattern = {
  id: 'habit-streak',
  patterns: [
    /how many days (?:in a row|streak|consecutive) (?:for|is|for my)\s+(.+)/i,
    /what(?:'s| is) (?:my|the) streak (?:for|on)\s+(.+)/i,
    /(?:streak|current streak)\s+(?:for|on)\s+(.+)/i,
  ],
  description: 'Habit streak queries',
  execute: async (match, stores) => {
    const question = match[0];
    const habitName = (match[1] || '').trim().toLowerCase();
    if (!habitName) {
      return { answer: 'Which habit would you like to check the streak for?', question, confidence: 0.2, chartType: 'stat' };
    }

    if (!isStoreHydrated(stores.habits)) {
      return { answer: 'Habit data is still loading. Try again in a moment.', question, confidence: 0.1, chartType: 'stat' };
    }

    const habits = stores.habits.habits || [];
    // Find matching habit by title (fuzzy match)
    const matched = habits.find((h: any) =>
      h.title?.toLowerCase().includes(habitName) || habitName.includes(h.title?.toLowerCase())
    );

    if (!matched) {
      // List available habits
      const available = habits.map((h: any) => h.title).join(', ');
      return {
        answer: available
          ? `I couldn't find a habit matching "${habitName}". Your habits: ${available}`
          : 'You don\'t have any habits set up yet. Create some in the Habits page!',
        question,
        confidence: 0.3,
        chartType: 'stat',
      };
    }

    return {
      answer: `Your current streak for "${matched.title}" is ${matched.streak_current || 0} days (best: ${matched.streak_best || 0} days).${matched.streak_current >= 7 ? ' 🔥 Great streak!' : matched.streak_current >= 3 ? ' Keep it going! 💪' : ''}`,
      question,
      confidence: 0.9,
      chartType: 'stat',
      data: [{ habit: matched.title, current: matched.streak_current, best: matched.streak_best }],
    };
  },
};

const HABIT_MISSED_QUERY: QueryPattern = {
  id: 'habit-missed',
  patterns: [
    /which habits (?:have i|did i) miss\s*(?:this week|lately|recently)/i,
    /(?:habits|what habits).+(?:missed|miss|forgot|skipped)\s*(?:this week)?/i,
    /what (?:habits|habits).+i (?:missed|didn'?t do|forgot|skipped)/i,
  ],
  description: 'Missed habits queries',
  execute: async (match, stores) => {
    const question = match[0];
    if (!isStoreHydrated(stores.habits)) {
      return { answer: 'Habit data is still loading. Try again in a moment.', question, confidence: 0.1, chartType: 'stat' };
    }

    const habits = stores.habits.habits || [];
    const logs = stores.habits.logs || [];
    if (habits.length === 0) {
      return { answer: 'You don\'t have any habits set up yet.', question, confidence: 0.3, chartType: 'stat' };
    }

    // Check this week (Monday → today)
    const weekStart = startOfWeek();
    const todayStr = today();
    const missedDays: string[] = [];
    const d = new Date(weekStart);
    while (d.toISOString().split('T')[0] <= todayStr) {
      missedDays.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }

    const missedHabits: { habit: string; missedDates: string[] }[] = [];
    for (const habit of habits) {
      if (habit.frequency !== 'daily' && habit.frequency !== undefined) continue;
      const habitLogs = logs.filter((l: any) => l.habit_id === habit.id);
      const loggedDates = new Set(habitLogs.map((l: any) => l.date));
      const missed = missedDays.filter(day => !loggedDates.has(day));
      // Don't count today if it's still early
      const todayMissed = missed.filter(day => day !== todayStr);
      if (todayMissed.length > 0) {
        missedHabits.push({ habit: habit.title, missedDates: todayMissed });
      }
    }

    if (missedHabits.length === 0) {
      return {
        answer: `Great job! You haven't missed any daily habits this week (since Monday). 🎉`,
        question,
        confidence: 0.85,
        chartType: 'stat',
      };
    }

    const lines = missedHabits.map(m =>
      `• ${m.habit}: missed ${m.missedDates.length} day(s) — ${m.missedDates.map(d => d.slice(5)).join(', ')}`
    );
    return {
      answer: `You missed some habits this week:\n${lines.join('\n')}`,
      question,
      confidence: 0.85,
      chartType: 'table',
      data: missedHabits,
    };
  },
};

const GOAL_PROGRESS_QUERY: QueryPattern = {
  id: 'goal-progress',
  patterns: [
    /how close am i to\s+(.+)/i,
    /what(?:'s| is) (?:my|the) progress (?:on|for)\s+(.+)/i,
    /progress (?:on|for) (?:my|the)?\s*goal\s+(.+)/i,
  ],
  description: 'Goal progress queries',
  execute: async (match, stores) => {
    const question = match[0];
    const goalName = (match[1] || '').trim().toLowerCase();
    if (!goalName) {
      return { answer: 'Which goal would you like to check progress on?', question, confidence: 0.2, chartType: 'stat' };
    }

    if (!isStoreHydrated(stores.goals)) {
      return { answer: 'Goal data is still loading. Try again in a moment.', question, confidence: 0.1, chartType: 'stat' };
    }

    const goals = stores.goals.goals || [];
    const matched = goals.find((g: any) =>
      g.title?.toLowerCase().includes(goalName) || goalName.includes(g.title?.toLowerCase())
    );

    if (!matched) {
      const available = goals.slice(0, 8).map((g: any) => g.title).join(', ');
      return {
        answer: available
          ? `I couldn't find a goal matching "${goalName}". Your goals: ${available}${goals.length > 8 ? '...' : ''}`
          : 'You don\'t have any goals set up yet.',
        question,
        confidence: 0.3,
        chartType: 'stat',
      };
    }

    const progress = matched.progress ?? 0;
    const targetDate = matched.target_date;
    const status = matched.status || matched.health_status || 'unknown';

    let answer = `Your goal "${matched.title}" is ${progress}% complete (${status}).`;
    if (targetDate) {
      const daysLeft = Math.ceil((new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft > 0) {
        answer += ` ${daysLeft} days until the target date (${targetDate}).`;
        const rate = progress / Math.max(1, 30); // rough monthly rate
        if (rate > 0 && progress < 100) {
          const daysNeeded = Math.ceil((100 - progress) / (rate / 30));
          if (daysNeeded > daysLeft) {
            answer += ' ⚠️ You may need to accelerate to meet your deadline.';
          }
        }
      } else {
        answer += ` The target date was ${Math.abs(daysLeft)} days ago.`;
      }
    }

    return {
      answer,
      question,
      confidence: 0.85,
      chartType: progress > 0 ? 'stat' : 'table',
      data: [{ title: matched.title, progress, status, targetDate }],
    };
  },
};

const GOAL_OVERDUE_QUERY: QueryPattern = {
  id: 'goal-overdue',
  patterns: [
    /what goals (?:are|seem) overdue/i,
    /(?:overdue|late|behind)\s+goals/i,
    /which goals (?:are|seem) (?:behind|overdue|late)/i,
    /goals (?:past|missed) (?:their|the) (?:deadline|target|date)/i,
  ],
  description: 'Overdue goals queries',
  execute: async (match, stores) => {
    const question = match[0];
    if (!isStoreHydrated(stores.goals)) {
      return { answer: 'Goal data is still loading. Try again in a moment.', question, confidence: 0.1, chartType: 'stat' };
    }

    const goals = stores.goals.goals || [];
    const todayStr = today();
    const overdue = goals.filter((g: any) =>
      g.target_date &&
      g.target_date < todayStr &&
      g.status !== 'completed' &&
      g.status !== 'done' &&
      (g.progress ?? 0) < 100
    );

    if (overdue.length === 0) {
      return { answer: 'No goals are currently overdue! Everything is on track. 🎯', question, confidence: 0.85, chartType: 'stat' };
    }

    const lines = overdue.map((g: any) => {
      const daysOverdue = Math.ceil((Date.now() - new Date(g.target_date).getTime()) / (1000 * 60 * 60 * 24));
      return `• ${g.title}: ${g.progress ?? 0}% complete, ${daysOverdue} days overdue (due ${g.target_date})`;
    });

    return {
      answer: `${overdue.length} goal(s) are overdue:\n${lines.join('\n')}`,
      question,
      confidence: 0.85,
      chartType: 'table',
      data: overdue.map((g: any) => ({
        title: g.title,
        progress: g.progress ?? 0,
        targetDate: g.target_date,
        status: g.status,
      })),
    };
  },
};

const FINANCE_SPENDING_QUERY: QueryPattern = {
  id: 'finance-spending',
  patterns: [
    /how much (?:did i|have i) spend (?:on|for)\s+(.+)/i,
    /what(?:'s| is) my spending (?:on|for)\s+(.+)/i,
    /(?:spending|expenses?) (?:on|for)\s+(.+)/i,
  ],
  description: 'Spending by category queries',
  execute: async (match, stores) => {
    const question = match[0];
    const category = (match[1] || '').trim().toLowerCase();
    if (!category) {
      return { answer: 'Which category would you like to check spending for?', question, confidence: 0.2, chartType: 'stat' };
    }

    if (!isStoreHydrated(stores.finance)) {
      return { answer: 'Finance data is still loading. Try again in a moment.', question, confidence: 0.1, chartType: 'stat' };
    }

    const expenses = stores.finance.expenses || [];
    const categories = stores.finance.categories || [];
    if (expenses.length === 0) {
      return { answer: 'No expense data found. Start logging expenses to track your spending!', question, confidence: 0.3, chartType: 'stat' };
    }

    // Find matching category
    const matchedCat = categories.find((c: any) =>
      c.name?.toLowerCase().includes(category) || category.includes(c.name?.toLowerCase())
    );

    // Filter expenses this month
    const monthStart = startOfMonth();
    let relevantExpenses = expenses.filter((e: any) => e.date >= monthStart && !e.is_deleted);

    let filtered: any[];
    let catLabel: string;

    if (matchedCat) {
      filtered = relevantExpenses.filter((e: any) => e.category_id === matchedCat.id);
      catLabel = matchedCat.name;
    } else {
      // Fuzzy match on description
      filtered = relevantExpenses.filter((e: any) =>
        e.description?.toLowerCase().includes(category)
      );
      catLabel = category;
    }

    const total = filtered.reduce((s: number, e: any) => s + (e.amount || 0), 0);

    if (filtered.length === 0) {
      // Show all categories for this month as guidance
      const catSpending = categories.map((c: any) => {
        const catTotal = relevantExpenses
          .filter((e: any) => e.category_id === c.id)
          .reduce((s: number, e: any) => s + (e.amount || 0), 0);
        return { name: c.name, total: catTotal };
      }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

      if (catSpending.length === 0) {
        return { answer: `No expenses found for "${catLabel}" this month. Your categories: ${categories.map((c: any) => c.name).join(', ')}`, question, confidence: 0.3, chartType: 'stat' };
      }

      const topCats = catSpending.slice(0, 5).map(c => `${c.name}: $${c.total.toFixed(0)}`).join(', ');
      return {
        answer: `No expenses found for "${catLabel}" this month. Here's where you've spent: ${topCats}`,
        question,
        confidence: 0.4,
        chartType: 'bar',
        data: catSpending.map(c => ({ label: c.name, value: c.total })),
      };
    }

    return {
      answer: `You've spent $${total.toFixed(2)} on ${catLabel} this month (${filtered.length} transaction(s)).`,
      question,
      confidence: 0.85,
      chartType: 'stat',
      data: [{ category: catLabel, amount: total, count: filtered.length }],
    };
  },
};

const FINANCE_INCOME_QUERY: QueryPattern = {
  id: 'finance-income',
  patterns: [
    /what(?:'s| is) my income (?:this|this month|for this month)/i,
    /how much (?:did i|have i) (?:earn|make|get|receive) (?:this month|this month|lately)/i,
    /(?:income|earnings|revenue) (?:this month|this month|overall)/i,
  ],
  description: 'Income queries',
  execute: async (match, stores) => {
    const question = match[0];
    if (!isStoreHydrated(stores.finance)) {
      return { answer: 'Finance data is still loading. Try again in a moment.', question, confidence: 0.1, chartType: 'stat' };
    }

    const monthIncome = typeof stores.finance.monthIncome === 'function' ? stores.finance.monthIncome() : 0;
    const monthExpenses = typeof stores.finance.monthExpenses === 'function' ? stores.finance.monthExpenses() : 0;
    const net = typeof stores.finance.netCashflow === 'function' ? stores.finance.netCashflow() : 0;

    return {
      answer: `This month: Income $${monthIncome.toFixed(2)}, Expenses $${monthExpenses.toFixed(2)}, Net $${net.toFixed(2)} ${net >= 0 ? '✅' : '⚠️'}.`,
      question,
      confidence: 0.9,
      chartType: 'stat',
      data: [{ income: monthIncome, expenses: monthExpenses, net }],
    };
  },
};

const SCHEDULE_WORK_HOURS_QUERY: QueryPattern = {
  id: 'schedule-work-hours',
  patterns: [
    /how many hours (?:did i|have i) work(?:ed)?\s*(?:this week|this week)?/i,
    /(?:work|working) hours\s*(?:this week|lately|recently)?/i,
    /how much (?:time|hours?) (?:did i|have i) (?:spend|work)\s*(?:working|on work)\s*(?:this week)?/i,
  ],
  description: 'Work hours queries from schedule',
  execute: async (match, stores) => {
    const question = match[0];
    if (!isStoreHydrated(stores.schedule)) {
      return { answer: 'Schedule data is still loading. Try again in a moment.', question, confidence: 0.1, chartType: 'stat' };
    }

    const events = stores.schedule.events || [];
    const weekStart = startOfWeek();
    const todayStr = today();

    // Find work-related events this week
    const workEvents = events.filter((e: any) => {
      if (e.is_deleted) return false;
      if (!e.start_time || !e.end_time) return false;
      if (e.start_time < weekStart) return false;
      if (e.start_time > todayStr + 'T23:59:59') return false;
      // Match work-related event types
      const type = (e.event_type || e.category || '').toLowerCase();
      return type === 'work' || type === 'meeting' || e.title?.toLowerCase().includes('work') || e.title?.toLowerCase().includes('meeting') || e.title?.toLowerCase().includes('shift');
    });

    const totalMinutes = workEvents.reduce((sum: number, e: any) => {
      const start = new Date(e.start_time).getTime();
      const end = new Date(e.end_time).getTime();
      return sum + Math.max(0, (end - start) / (1000 * 60));
    }, 0);

    const hours = totalMinutes / 60;

    if (workEvents.length === 0) {
      return {
        answer: `No work events found in your schedule this week. Tag events as "work" or "meeting" to track work hours!`,
        question,
        confidence: 0.4,
        chartType: 'stat',
      };
    }

    return {
      answer: `You have ${formatNumber(hours)} hours of work scheduled this week across ${workEvents.length} event(s).`,
      question,
      confidence: 0.8,
      chartType: 'stat',
      data: [{ hours, events: workEvents.length }],
    };
  },
};

const CORRELATION_QUERY: QueryPattern = {
  id: 'correlation',
  patterns: [
    /does\s+(.+?)\s+(?:affect|impact|influence)\s+(.+)/i,
    /when i\s+(.+?),?\s+what happens to\s+(.+)/i,
    /(?:correlation|relationship|connection)\s+between\s+(.+?)\s+and\s+(.+)/i,
  ],
  description: 'General correlation queries',
  execute: async (match, stores) => {
    const question = match[0];
    const factorX = (match[1] || '').trim().toLowerCase();
    const factorY = (match[2] || '').trim().toLowerCase();

    if (!factorX || !factorY) {
      return { answer: 'I need two factors to check. Try "Does exercise affect my mood?" or "When I sleep 8+ hours, what happens to my energy?"', question, confidence: 0.15, chartType: 'stat' };
    }

    const healthHistory = await loadHealthHistory(30);
    if (healthHistory.length < 5) {
      return { answer: 'Not enough data to find correlations. Keep logging your health metrics daily!', question, confidence: 0.15, chartType: 'stat' };
    }

    // Map common factor names to health metric fields
    const fieldMap: Record<string, string> = {
      'sleep': 'sleep_hours',
      'sleep hours': 'sleep_hours',
      'exercise': 'exercise_minutes',
      'exercise minutes': 'exercise_minutes',
      'workout': 'exercise_minutes',
      'mood': 'mood_score',
      'energy': 'energy_score',
      'stress': 'stress_score',
      'water': 'water_glasses',
      'weight': 'weight_kg',
    };

    const xField = fieldMap[factorX] || fieldMap[factorX.replace(/my /g, '')];
    const yField = fieldMap[factorY] || fieldMap[factorY.replace(/my /g, '')];

    if (!xField || !yField) {
      const known = Object.keys(fieldMap).join(', ');
      return {
        answer: `I can analyze correlations between: ${known}. Try rephrasing with one of these factors!`,
        question,
        confidence: 0.2,
        chartType: 'stat',
      };
    }

    const withBoth = healthHistory.filter(m => (m as any)[xField] != null && (m as any)[yField] != null);
    if (withBoth.length < 5) {
      return { answer: `Only ${withBoth.length} days have both ${factorX} and ${factorY} data. Need at least 5 days for a meaningful analysis.`, question, confidence: 0.2, chartType: 'stat' };
    }

    // Simple correlation: split into high/low for factorX
    const xValues = withBoth.map(m => (m as any)[xField] as number);
    const median = xValues.sort((a, b) => a - b)[Math.floor(xValues.length / 2)];
    const highX = withBoth.filter(m => (m as any)[xField] >= median);
    const lowX = withBoth.filter(m => (m as any)[xField] < median);

    const avgYHigh = avg(highX.map(m => (m as any)[yField] as number));
    const avgYLow = avg(lowX.map(m => (m as any)[yField] as number));

    let analysis = '';
    if (avgYHigh != null && avgYLow != null) {
      const diff = avgYHigh - avgYLow;
      analysis = `When your ${factorX} is high (≥${formatNumber(median)}), your ${factorY} averages ${formatNumber(avgYHigh)}. When low, it averages ${formatNumber(avgYLow)}.`;
      if (Math.abs(diff) > 0.5) {
        analysis += diff > 0
          ? ` Higher ${factorX} tends to come with higher ${factorY}.`
          : ` Higher ${factorX} tends to come with lower ${factorY}.`;
      } else {
        analysis += ` There doesn't seem to be a strong relationship.`;
      }
    }

    return {
      answer: analysis,
      question,
      confidence: 0.65,
      chartType: 'bar',
      data: [
        { label: `High ${factorX}`, value: avgYHigh || 0 },
        { label: `Low ${factorX}`, value: avgYLow || 0 },
      ],
    };
  },
};

const GENERAL_STATUS_QUERY: QueryPattern = {
  id: 'general-status',
  patterns: [
    /how am i doing\s*(?:this week|overall|lately|recently)?/i,
    /how(?:'s| is) (?:everything|life|it) going/i,
    /give me (?:a |my )?(?:status|overview|summary|check-?in)/i,
    /life (?:check|status|overview|summary)/i,
    /weekly (?:review|check-?in|summary|status)/i,
  ],
  description: 'General status/overview queries',
  execute: async (match, stores) => {
    const question = match[0];
    const parts: string[] = [];

    // Sleep
    const healthHistory = await loadHealthHistory(7);
    const sleepEntries = healthHistory.filter(m => m.sleep_hours != null);
    if (sleepEntries.length > 0) {
      const avgSleep = avg(sleepEntries.map(m => m.sleep_hours!));
      parts.push(`😴 Average sleep: ${formatNumber(avgSleep!)}h/night`);
    }

    // Mood
    const moodEntries = healthHistory.filter(m => m.mood_score != null);
    if (moodEntries.length > 0) {
      const avgMood = avg(moodEntries.map(m => m.mood_score!));
      parts.push(`😊 Average mood: ${formatNumber(avgMood!)}/10`);
    }

    // Habits
    if (isStoreHydrated(stores.habits)) {
      const habits = stores.habits.habits || [];
      const activeStreaks = habits.filter((h: any) => (h.streak_current || 0) > 0);
      const longestStreak = habits.reduce((max: number, h: any) => Math.max(max, h.streak_current || 0), 0);
      if (habits.length > 0) {
        parts.push(`⚡ ${activeStreaks.length}/${habits.length} habits active (longest streak: ${longestStreak}d)`);
      }
    }

    // Goals
    if (isStoreHydrated(stores.goals)) {
      const goals = stores.goals.goals || [];
      const inProgress = goals.filter((g: any) => g.status === 'in_progress' || g.status === 'active');
      const completed = goals.filter((g: any) => g.status === 'completed' || g.status === 'done');
      if (goals.length > 0) {
        parts.push(`🎯 ${inProgress.length} goals in progress, ${completed.length} completed`);
      }
    }

    // Finance
    if (isStoreHydrated(stores.finance)) {
      const monthIncome = typeof stores.finance.monthIncome === 'function' ? stores.finance.monthIncome() : 0;
      const monthExpenses = typeof stores.finance.monthExpenses === 'function' ? stores.finance.monthExpenses() : 0;
      const net = monthIncome - monthExpenses;
      parts.push(`💰 Net cashflow: $${net.toFixed(0)} ${net >= 0 ? '✅' : '⚠️'}`);
    }

    // Overdue tasks
    if (isStoreHydrated(stores.schedule)) {
      const tasks = stores.schedule.tasks || [];
      const overdue = tasks.filter((t: any) => t.due_date && t.due_date < today() && t.status !== 'done');
      if (overdue.length > 0) {
        parts.push(`⚠️ ${overdue.length} overdue task(s)`);
      }
    }

    if (parts.length === 0) {
      return {
        answer: "I don't have enough data to give you a status update yet. Start logging health, habits, goals, or finances and I'll give you a great overview!",
        question,
        confidence: 0.2,
        chartType: 'stat',
      };
    }

    const isThisWeek = /this week/i.test(question);
    const header = isThisWeek ? '📊 Your week at a glance:' : '📊 Your status overview:';

    return {
      answer: `${header}\n${parts.map(p => '  ' + p).join('\n')}`,
      question,
      confidence: 0.75,
      chartType: 'table',
      data: parts.map(p => ({ metric: p.split(':')[0]?.trim(), detail: p })),
    };
  },
};

// ─── Pattern Registry ───────────────────────────────────────────

const PATTERNS: QueryPattern[] = [
  SLEEP_QUERY,
  MOOD_QUERY,
  MOOD_CORRELATION_QUERY,
  HABIT_STREAK_QUERY,
  HABIT_MISSED_QUERY,
  GOAL_PROGRESS_QUERY,
  GOAL_OVERDUE_QUERY,
  FINANCE_SPENDING_QUERY,
  FINANCE_INCOME_QUERY,
  SCHEDULE_WORK_HOURS_QUERY,
  CORRELATION_QUERY,
  GENERAL_STATUS_QUERY,
];

// ─── Main Query Processor ───────────────────────────────────────

export const NO_MATCH_RESULT: QueryResult = {
  answer: "I can answer questions about your sleep, mood, habits, goals, finances, and schedule. Try asking something like \"How much did I sleep this week?\" or \"What's my average mood?\"",
  confidence: 0,
  question: '',
};

/**
 * Process a natural language question against registered query patterns.
 * Returns the first matching pattern with confidence > 0.5,
 * or a fallback message if no pattern matches well enough.
 */
export async function processQuery(
  question: string,
  stores: StoreAccess,
): Promise<QueryResult> {
  const normalized = question.trim();
  if (!normalized) return { ...NO_MATCH_RESULT, question };

  for (const pattern of PATTERNS) {
    for (const regex of pattern.patterns) {
      const match = normalized.match(regex);
      if (match) {
        try {
          const result = await pattern.execute(match, stores);
          result.question = normalized;
          return result;
        } catch (err) {
          logger.warn(`[nl-query] Pattern "${pattern.id}" failed:`, err);
          // Continue to next pattern on error
        }
      }
    }
  }

  return { ...NO_MATCH_RESULT, question: normalized };
}

/**
 * Quick check if a message might match an NL query pattern (synchronous).
 * Used to short-circuit LLM calls in AIChat before the full async query.
 */
export function mightMatchNLQuery(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  // Quick heuristic: contains common data-query keywords
  const queryKeywords = [
    'how many', 'how much', 'how close', 'average', 'streak',
    'sleep', 'mood', 'habit', 'goal', 'spend', 'spent', 'income',
    'overdue', 'missed', 'correlat', 'affect', 'how am i doing',
    'work hours', 'this week',
  ];
  return queryKeywords.some(kw => normalized.includes(kw));
}