/**
 * LifeOS LLM Morning Brief Generator
 *
 * Generates a rich, data-driven morning brief by aggregating user data
 * from across the entire LifeOS database.
 *
 * Note: The existing `src/lib/ai/coach.ts` has a simpler MorningBrief type.
 * This module extends it with partner updates, quest data, plugin income,
 * and a suggested focus — designed for the new LLM chat interface.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getStreakLabel } from '../gamification/xp-engine';

// ── TYPES ──────────────────────────────────────────────────────────────────────

export interface ScheduleItem {
  id: string;
  title: string;
  time: string;
  location?: string;
  type?: string;
}

export interface ActiveQuest {
  id: string;
  title: string;
  icon: string;
  reward_xp: number;
  priority: string;
  expires_at: string;
}

export interface LLMMorningBrief {
  greeting: string;
  date: string;
  /** Today's schedule items */
  todaySchedule: ScheduleItem[];
  /** Active (incomplete) quests for today */
  activeQuests: ActiveQuest[];
  /** Longest active streak across all habits */
  streakStatus: { days: number; label: string };
  /** What accountability partners did yesterday */
  partnerUpdates: string[];
  /** This week's finance summary from transactions table */
  financeSummary?: { income: number; expenses: number; net: number };
  /** One-line motivational note */
  motivationalNote: string;
  /** AI-generated focus suggestion (e.g. stale goal) */
  suggestedFocus: string;
  /** The most important item to start with */
  primaryAction?: { label: string; path: string };
  /** Total XP earned today (for "day has started" context) */
  xpToday: number;
  /** Stats to show at the top */
  stats: {
    tasksToday: number;
    habitsNotLogged: number;
    upcomingEvents: number;
  };
}

// ── HELPERS ────────────────────────────────────────────────────────────────────

import { localDateStr } from '../../utils/date';
const localDate = localDateStr;

function formatDateFull(d: Date = new Date()): string {
  return d.toLocaleDateString('en-AU', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  });
}

function getGreeting(firstName: string): string {
  const h = new Date().getHours();
  if (h < 5)  return "You're up early! Ready to dominate?";
  if (h < 8)  return `Morning ${firstName}! Early bird energy.`;
  if (h < 12) return `Good morning, ${firstName}!`;
  if (h < 17) return `Good afternoon, ${firstName}!`;
  if (h < 20) return `Evening, ${firstName}!`;
  return "Night owl mode";
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('en-AU', {
      hour:   'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

// ── MAIN GENERATOR ─────────────────────────────────────────────────────────────

/**
 * Generate a full morning brief for the given user.
 * Runs all queries in parallel for speed.
 */
export async function generateMorningBrief(
  userId: string,
  supabase: SupabaseClient
): Promise<LLMMorningBrief> {
  const today = localDate();
  const now = new Date();

  // Start of this week (Monday)
  const weekStart = new Date(now);
  const dow = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - ((dow + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  // Fetch user's display name for greeting
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('user_id', userId)
    .maybeSingle();
  const firstName = profileData?.display_name?.split(' ')[0] || 'there';

  // Run all queries in parallel
  const [
    scheduleRes,
    questsRes,
    habitsRes,
    habitLogsRes,
    transactionsRes,
    xpTodayRes,
    partnersRes,
    goalsRes,
  ] = await Promise.all([
    // Today's schedule
    supabase
      .from('schedule_events')
      .select('id, title, start_time, end_time, location, event_type')
      .eq('user_id', userId)
      .gte('start_time', `${today}T00:00:00`)
      .lte('start_time', `${today}T23:59:59`)
      .order('start_time'),

    // Active quests (incomplete, not expired)
    supabase
      .from('quests')
      .select('id, v2_title, quest_data, v2_icon, reward_xp, priority, expires_at')
      .eq('user_id', userId)
      .is('completed_at', null)
      .gte('expires_at', now.toISOString())
      .order('priority', { ascending: false })
      .limit(5),

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
      .select('habit_id')
      .eq('user_id', userId)
      .eq('date', today),

    // This week's transactions
    supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', userId)
      .gte('date', weekStart.toISOString().split('T')[0]),

    // XP earned today
    supabase
      .from('xp_events')
      .select('xp_amount')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00`),

    // Partner activity (yesterday's XP events for connected partners)
    supabase
      .from('partnerships')
      .select(`
        responder_id,
        responder:public_profiles!responder_id(display_name)
      `)
      .eq('requester_id', userId)
      .eq('status', 'accepted')
      .limit(5),

    // Stale goals (for suggestedFocus)
    supabase
      .from('goals')
      .select('id, title, category, progress, updated_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .lt('progress', 1)
      .order('updated_at', { ascending: true })
      .limit(5),
  ]);

  // ── Process schedule ──
  const scheduleItems: ScheduleItem[] = (scheduleRes.data ?? []).map((ev: {
    id: string; title: string; start_time: string; location?: string; event_type?: string;
  }) => ({
    id:       ev.id,
    title:    ev.title,
    time:     formatTime(ev.start_time),
    location: ev.location ?? undefined,
    type:     ev.event_type ?? undefined,
  }));

  // ── Process quests ──
  const activeQuests: ActiveQuest[] = (questsRes.data ?? []).map((q: {
    id: string;
    v2_title?: string;
    quest_data?: { title: string; icon: string };
    v2_icon?: string;
    reward_xp: number;
    priority: string;
    expires_at: string;
  }) => ({
    id:         q.id,
    title:      q.v2_title ?? q.quest_data?.title ?? 'Quest',
    icon:       q.v2_icon ?? q.quest_data?.icon ?? '📋',
    reward_xp:  q.reward_xp,
    priority:   q.priority,
    expires_at: q.expires_at,
  }));

  // ── Process habits ──
  const loggedTodayIds = new Set(
    (habitLogsRes.data ?? []).map((l: { habit_id: string }) => l.habit_id)
  );
  const habits = (habitsRes.data ?? []) as { id: string; title: string; icon: string | null; streak_current: number }[];
  const habitsNotLogged = habits.filter(h => !loggedTodayIds.has(h.id)).length;
  const maxStreak = habits.reduce((max, h) => Math.max(max, h.streak_current ?? 0), 0);

  // ── Process finance ──
  let financeSummary: LLMMorningBrief['financeSummary'] | undefined;
  if (transactionsRes.data && transactionsRes.data.length > 0) {
    let income = 0;
    let expenses = 0;
    for (const t of transactionsRes.data as { type: string; amount: number }[]) {
      if (t.type === 'income') income += t.amount;
      else expenses += t.amount;
    }
    financeSummary = { income, expenses, net: income - expenses };
  }

  // ── XP today ──
  const xpToday = (xpTodayRes.data ?? []).reduce(
    (sum: number, e: { xp_amount: number }) => sum + (e.xp_amount ?? 0),
    0
  );

  // ── Partner updates ──
  const partnerUpdates: string[] = [];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localDate(yesterday);

  const partners = (partnersRes.data ?? []) as unknown as {
    responder_id: string;
    responder: { display_name: string } | null;
  }[];

  for (const p of partners.slice(0, 3)) {
    if (!p.responder) continue;
    const { count } = await supabase
      .from('xp_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', p.responder_id)
      .gte('created_at', `${yesterdayStr}T00:00:00`)
      .lte('created_at', `${yesterdayStr}T23:59:59`);

    const name = p.responder.display_name ?? 'Your partner';
    if ((count ?? 0) > 0) {
      partnerUpdates.push(`${name} earned XP in ${count} action${count !== 1 ? 's' : ''} yesterday`);
    }
  }

  // ── Suggested focus ──
  let suggestedFocus = 'Keep up the momentum — every action compounds.';
  const staleGoals = (goalsRes.data ?? []) as {
    id: string; title: string; category: string; progress: number; updated_at: string | null;
  }[];

  if (staleGoals.length > 0) {
    const stalest = staleGoals[0];
    const daysSince = stalest.updated_at
      ? Math.floor((now.getTime() - new Date(stalest.updated_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    if (daysSince >= 3) {
      const pct = Math.round((stalest.progress ?? 0) * 100);
      suggestedFocus = `Your "${stalest.title}" goal hasn't had progress in ${daysSince} days (${pct}% done). One action today keeps momentum.`;
    }
  }

  // ── Motivational note ──
  const motivationalNotes = [
    'Small consistent actions build extraordinary results.',
    'You\'re building something real. Keep showing up.',
    'The grind is the glory. Every rep counts.',
    'Progress isn\'t always visible — trust the process.',
    'One focused hour beats five distracted ones.',
    `${maxStreak > 0 ? `Your ${maxStreak}-day streak doesn't break today. ` : ''}Let\'s go.`,
  ];
  const motivationalNote = motivationalNotes[now.getDay() % motivationalNotes.length];

  // ── Primary action ──
  let primaryAction: LLMMorningBrief['primaryAction'] | undefined;
  if (activeQuests.length > 0) {
    primaryAction = { label: `Start quest: ${activeQuests[0].title}`, path: '/character?tab=quests' };
  } else if (scheduleItems.length > 0) {
    primaryAction = { label: `View today's schedule`, path: '/schedule' };
  } else if (habitsNotLogged > 0) {
    primaryAction = { label: `Log ${habitsNotLogged} habit${habitsNotLogged !== 1 ? 's' : ''}`, path: '/habits' };
  }

  return {
    greeting:        getGreeting(firstName),
    date:            formatDateFull(),
    todaySchedule:   scheduleItems,
    activeQuests,
    streakStatus: {
      days:  maxStreak,
      label: maxStreak > 0 ? getStreakLabel(maxStreak) : 'No active streak',
    },
    partnerUpdates,
    financeSummary,
    motivationalNote,
    suggestedFocus,
    primaryAction,
    xpToday,
    stats: {
      tasksToday:     scheduleItems.length,
      habitsNotLogged,
      upcomingEvents: scheduleItems.length,
    },
  };
}
