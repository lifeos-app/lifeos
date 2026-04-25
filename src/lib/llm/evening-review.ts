/**
 * LifeOS LLM Evening Review Generator
 *
 * Generates a rich, data-driven evening review by aggregating user data
 * from across the entire LifeOS database.
 *
 * The yin to morning-brief's yang — focuses on reflection, what went well,
 * and preparation for tomorrow rather than action-oriented planning.
 *
 * Pure functions that take store data as input. No React, no direct Supabase calls.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getStreakLabel } from '../gamification/xp-engine';

// ── TYPES ──────────────────────────────────────────────────────────────────────

export interface LEveningReview {
  greeting: string;
  /** Full date string for display */
  date: string;
  /** Summary of what happened today */
  dateSummary: {
    tasksCompleted: number;
    tasksTotal: number;
    habitsCompleted: number;
    habitsTotal: number;
    moodLogged: boolean;
    moodValue?: number;
    journalEntriesToday: number;
    xpEarned: number;
  };
  /** What went well today — from completed high-XP actions */
  highlights: string[];
  /** AI-generated reflection prompts based on data */
  reflections: string[];
  /** Upcoming events, deadlines, goals needing attention tomorrow */
  tomorrowPreview: {
    events: { title: string; time: string }[];
    deadlines: string[];
    goalsNeedingAttention: string[];
  };
  /** A calming suggestion for winding down */
  windDown: string;
  /** Primary action to take */
  primaryAction?: { label: string; path: string };
  /** Best streak across all habits */
  streakStatus: { days: number; label: string };
  /** Finance activity today */
  financeToday?: { income: number; expenses: number; net: number };
}

// ── HELPERS ────────────────────────────────────────────────────────────────────

import { localDateStr } from '../../utils/date';
const localDate = localDateStr;

function formatDateFull(d: Date = new Date()): string {
  return d.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getEveningGreeting(firstName: string): string {
  const h = new Date().getHours();
  if (h < 17) return `Wrapping up early, ${firstName}?`;
  if (h < 20) return `Good evening, ${firstName}`;
  if (h < 22) return `Wrapping up your day, ${firstName}`;
  return `Late night review, ${firstName}`;
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

// ── MAIN GENERATOR ─────────────────────────────────────────────────────────────

/**
 * Generate a full evening review for the given user.
 * Runs all queries in parallel for speed.
 */
export async function generateEveningReview(
  userId: string,
  supabase: SupabaseClient
): Promise<LEveningReview> {
  const today = localDate();
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = localDate(tomorrow);

  // Start of this week (Monday)
  const weekStart = new Date(now);
  const dow = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - ((dow + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  // Fetch user's display name for greeting
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('user_id', userId)
    .maybeSingle();
  const firstName = profileData?.display_name?.split(' ')[0] || 'there';

  // Run all queries in parallel
  const [
    tasksRes,
    habitsRes,
    habitLogsRes,
    moodRes,
    journalRes,
    transactionsRes,
    xpTodayRes,
    tomorrowEventsRes,
    goalsRes,
  ] = await Promise.all([
    // Today's tasks
    supabase
      .from('schedule_events')
      .select('id, title, start_time, end_time, location, event_type, status')
      .eq('user_id', userId)
      .gte('start_time', `${today}T00:00:00`)
      .lte('start_time', `${today}T23:59:59`)
      .order('start_time'),

    // Active habits
    supabase
      .from('habits')
      .select('id, title, icon, streak_current')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('is_active', true),

    // Habits logged today
    supabase
      .from('habit_logs')
      .select('habit_id, count, date')
      .eq('user_id', userId)
      .eq('date', today),

    // Mood logs today (from journal or mood entries)
    supabase
      .from('journal_entries')
      .select('id, mood, created_at')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(1),

    // Journal entries written today
    supabase
      .from('journal_entries')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`),

    // Today's transactions
    supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', userId)
      .gte('date', today)
      .lte('date', today),

    // XP earned today
    supabase
      .from('xp_events')
      .select('xp_amount, description, source')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00`),

    // Tomorrow's events
    supabase
      .from('schedule_events')
      .select('id, title, start_time, end_time, event_type')
      .eq('user_id', userId)
      .gte('start_time', `${tomorrowStr}T00:00:00`)
      .lte('start_time', `${tomorrowStr}T23:59:59`)
      .order('start_time')
      .limit(8),

    // Goals needing attention (low progress, not updated recently)
    supabase
      .from('goals')
      .select('id, title, category, progress, updated_at, status')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .lt('progress', 1)
      .order('updated_at', { ascending: true })
      .limit(5),
  ]);

  // ── Process tasks/schedule ──
  const todayEvents = (tasksRes.data ?? []) as {
    id: string; title: string; start_time: string; end_time?: string;
    location?: string; event_type?: string; status?: string;
  }[];
  const tasksCompleted = todayEvents.filter(e => e.status === 'done').length;
  const tasksTotal = todayEvents.length;

  // ── Process habits ──
  const habits = (habitsRes.data ?? []) as {
    id: string; title: string; icon: string | null; streak_current: number; target_count?: number;
  }[];
  const habitLogs = (habitLogsRes.data ?? []) as {
    habit_id: string; count: number; date: string;
  }[];

  const habitsCompleted = habits.filter(h => {
    const hLogs = habitLogs.filter(l => l.habit_id === h.id);
    const total = hLogs.reduce((sum, l) => sum + (l.count || 1), 0);
    return total >= (h.target_count || 1);
  }).length;
  const habitsTotal = habits.length;

  const maxStreak = habits.reduce((max, h) => Math.max(max, h.streak_current ?? 0), 0);

  // ── Process mood ──
  const moodEntry = (moodRes.data ?? []) as { id: string; mood: number; created_at: string }[];
  const moodLogged = moodEntry.length > 0;
  const moodValue = moodLogged ? moodEntry[0].mood : undefined;

  // ── Process journal ──
  const journalEntriesToday = (journalRes.data ?? [])?.length ?? 0;

  // ── Process finance ──
  let financeToday: LEveningReview['financeToday'] | undefined;
  if (transactionsRes.data && transactionsRes.data.length > 0) {
    let income = 0;
    let expenses = 0;
    for (const t of transactionsRes.data as { type: string; amount: number }[]) {
      if (t.type === 'income') income += t.amount;
      else expenses += t.amount;
    }
    financeToday = { income, expenses, net: income - expenses };
  }

  // ── XP today ──
  const xpEvents = (xpTodayRes.data ?? []) as { xp_amount: number; description?: string; source?: string }[];
  const xpEarned = xpEvents.reduce((sum, e) => sum + (e.xp_amount ?? 0), 0);

  // ── Build highlights ──
  const highlights: string[] = [];
  if (tasksCompleted > 0) {
    highlights.push(`Completed ${tasksCompleted} of ${tasksTotal} task${tasksTotal !== 1 ? 's' : ''} today`);
  }
  if (habitsCompleted === habitsTotal && habitsTotal > 0) {
    highlights.push(`All ${habitsTotal} habits done today — perfect day`);
  } else if (habitsCompleted > 0) {
    highlights.push(`Completed ${habitsCompleted} of ${habitsTotal} habit${habitsTotal !== 1 ? 's' : ''}`);
  }
  if (xpEarned >= 100) {
    highlights.push(`Earned ${xpEarned} XP — strong day`);
  }
  if (moodLogged && moodValue && moodValue >= 4) {
    highlights.push(`Logged a positive mood (${moodValue}/5)`);
  }
  if (journalEntriesToday > 0) {
    highlights.push(`Wrote ${journalEntriesToday} journal entr${journalEntriesToday > 1 ? 'ies' : 'y'}`);
  }
  if (maxStreak >= 7) {
    highlights.push(`${maxStreak}-day best streak going strong`);
  }

  // If nothing went well, provide an encouraging default
  if (highlights.length === 0) {
    highlights.push('You showed up — that counts for everything');
  }

  // ── Build reflections ──
  const reflections: string[] = [];

  // Task-based reflection
  if (tasksCompleted === tasksTotal && tasksTotal > 0) {
    reflections.push('All tasks done — what strategy kept you on track today?');
  } else if (tasksTotal > 0) {
    const incomplete = tasksTotal - tasksCompleted;
    reflections.push(`${incomplete} task${incomplete !== 1 ? 's' : ''} left undone. What got in the way?`);
  }

  // Habit-based reflection
  if (habitsCompleted > habitsTotal / 2 && habitsTotal > 0) {
    reflections.push(`You completed ${habitsCompleted} of ${habitsTotal} habits today. What helped you stay consistent?`);
  } else if (habitsTotal > 0 && habitsCompleted === 0) {
    reflections.push('No habits logged today. Is there one small thing you can do before bed?');
  }

  // Mood-based reflection
  if (moodLogged && moodValue !== undefined) {
    if (moodValue <= 2) {
      reflections.push('Your mood was low today. Be gentle with yourself — what would have helped?');
    } else if (moodValue >= 4) {
      reflections.push('Great mood today — what contributed to that energy?');
    }
  } else {
    reflections.push('You haven\'t logged a mood today. Taking a moment to check in can reveal patterns.');
  }

  // Finance-based reflection
  if (financeToday && financeToday.expenses > financeToday.income) {
    reflections.push('Spending outpaced income today. Is there a pattern you want to adjust?');
  }

  // XP-based reflection
  if (xpEarned === 0) {
    reflections.push('No XP earned today. Even one small action could start building momentum.');
  } else if (xpEarned >= 50) {
    reflections.push(`${xpEarned} XP earned — what actions produced the most progress?`);
  }

  // ── Tomorrow preview ──
  const tomorrowEvents = (tomorrowEventsRes.data ?? []) as {
    id: string; title: string; start_time: string; end_time?: string; event_type?: string;
  }[];
  const tomorrowEventsList = tomorrowEvents.map(e => ({
    title: e.title,
    time: formatTime(e.start_time),
  }));

  const deadlines: string[] = [];

  const goalData = (goalsRes.data ?? []) as {
    id: string; title: string; category: string; progress: number;
    updated_at: string | null; status: string;
  }[];
  const goalsNeedingAttention = goalData
    .filter(g => {
      const daysSince = g.updated_at
        ? Math.floor((now.getTime() - new Date(g.updated_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      return daysSince >= 3 && g.progress < 0.8;
    })
    .map(g => {
      const pct = Math.round((g.progress ?? 0) * 100);
      return `"${g.title}" at ${pct}%`;
    })
    .slice(0, 3);

  // ── Wind down suggestion ──
  const windDownOptions: string[] = [];
  if (journalEntriesToday === 0) {
    windDownOptions.push('Consider journaling about today\'s wins and lessons before bed.');
  }
  if (!moodLogged) {
    windDownOptions.push('Log your mood to close the day mindfully.');
  }
  if (habitsCompleted < habitsTotal && habitsTotal > 0) {
    windDownOptions.push('A quick habit log now could save a streak.');
  }
  windDownOptions.push('Consider a 10-minute meditation before bed to wind down.');
  windDownOptions.push('Reflect on one thing you\'re grateful for from today.');

  const windDown = windDownOptions[new Date().getDay() % windDownOptions.length];

  // ── Primary action ──
  let primaryAction: LEveningReview['primaryAction'] | undefined;
  if (habitsCompleted < habitsTotal && habitsTotal > 0) {
    primaryAction = {
      label: `Log ${habitsTotal - habitsCompleted} remaining habit${(habitsTotal - habitsCompleted) !== 1 ? 's' : ''}`,
      path: '/habits',
    };
  } else if (!moodLogged) {
    primaryAction = { label: 'Log today\'s mood', path: '/reflect/journal' };
  } else if (journalEntriesToday === 0) {
    primaryAction = { label: 'Write a journal entry', path: '/reflect/journal' };
  } else if (tomorrowEventsList.length > 0) {
    primaryAction = { label: 'Review tomorrow\'s schedule', path: '/schedule' };
  } else {
    primaryAction = { label: 'Plan tomorrow\'s intentions', path: '/schedule' };
  }

  return {
    greeting: getEveningGreeting(firstName),
    date: formatDateFull(),
    dateSummary: {
      tasksCompleted,
      tasksTotal,
      habitsCompleted,
      habitsTotal,
      moodLogged,
      moodValue,
      journalEntriesToday,
      xpEarned,
    },
    highlights,
    reflections,
    tomorrowPreview: {
      events: tomorrowEventsList,
      deadlines,
      goalsNeedingAttention,
    },
    windDown,
    primaryAction,
    streakStatus: {
      days: maxStreak,
      label: maxStreak > 0 ? getStreakLabel(maxStreak) : 'No active streak',
    },
    financeToday,
  };
}