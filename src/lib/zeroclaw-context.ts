/**
 * ZeroClaw Context Engine — Aggregates full user state for LLM awareness.
 *
 * buildUserContext() reads all Zustand stores + async Supabase queries
 * contextToPrompt() converts to ~500-word natural language summary
 * Results cached 60s to avoid redundant work.
 */

import { useScheduleStore } from '../stores/useScheduleStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useHealthStore } from '../stores/useHealthStore';
import { useJournalStore } from '../stores/useJournalStore';
import { useLiveActivityStore } from '../stores/useLiveActivityStore';
import { useUserStore } from '../stores/useUserStore';
import { useAgentStore } from '../stores/useAgentStore';
import { useInventoryStore } from '../stores/useInventoryStore';
import { useAssetsStore } from '../stores/useAssetsStore';
import { localDateStr } from '../utils/date';
import { localGetAll } from './local-db';
import { fetchUpcomingEvents } from './integrations/google-calendar';

// ── Types ───────────────────────────────────────────────────────

export interface UserContext {
  user: { firstName: string; occupation: string | null; primaryFocus: string | null };
  schedule: {
    todayEventCount: number;
    todayEvents: { title: string; startTime: string; endTime: string | null }[];
    todayTaskCount: number;
    overdueTaskCount: number;
    overdueTasks: string[];
  };
  habits: {
    activeCount: number;
    loggedTodayCount: number;
    atRiskStreaks: { title: string; streak: number }[];
    topStreaks: { title: string; streak: number }[];
  };
  goals: {
    activeCount: number;
    staleGoals: string[];
    recentWins: string[];
    topGoals: { title: string; progress: number; status: string }[];
  };
  finance: {
    monthIncomeRange: string;
    monthExpenseRange: string;
    netCashflow: string;
    upcomingBillCount: number;
  };
  health: {
    todayMood: number | null;
    todayEnergy: number | null;
    todaySleep: number | null;
    weekWorkoutCount: number;
    weekSleepAvg: number | null;
  };
  journal: {
    hasEntryToday: boolean;
    recentEntryCount: number;
  };
  liveActivity: {
    isActive: boolean;
    title: string | null;
    elapsedMinutes: number;
  };
  gamification: {
    level: number;
    totalXP: number;
  };
  assets: {
    upcomingMaintenanceCount: number;
    monthlyBillTotal: number;
  };
  inventory: {
    itemCount: number;
  };
  googleCalendar: {
    eventCount: number;
    todayEvents: { title: string; startTime: string }[];
  };
  activeNudgeTypes: string[];
}

// ── Cache ───────────────────────────────────────────────────────

let _cachedContext: UserContext | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

/**
 * Clear cached context — MUST be called on user switch / sign-out
 * to prevent leaking data between accounts.
 */
export function clearContextCache(): void {
  _cachedContext = null;
  _cacheTimestamp = 0;
  _asyncCache = null;
  _asyncCacheTimestamp = 0;
}

// Separate cache for async Supabase queries (health + XP)
let _asyncCache: { weekWorkouts: number; weekSleepAvg: number | null; level: number; totalXP: number; googleEvents: { title: string; startTime: string }[] } | null = null;
let _asyncCacheTimestamp = 0;

// ── Async data fetchers ─────────────────────────────────────────

async function fetchHealthWeekData(): Promise<{ workoutCount: number; sleepAvg: number | null }> {
  try {
    const allMetrics = await localGetAll<{
      date: string; exercise_minutes?: number; sleep_hours?: number; is_deleted?: boolean;
    }>('health_metrics');

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = localDateStr(weekAgo);

    const weekMetrics = allMetrics.filter(m => !m.is_deleted && m.date >= weekAgoStr);

    const workoutCount = weekMetrics.filter(m => m.exercise_minutes && m.exercise_minutes > 0).length;

    const sleepEntries = weekMetrics.filter(m => m.sleep_hours && m.sleep_hours > 0);
    const sleepAvg = sleepEntries.length > 0
      ? sleepEntries.reduce((sum, m) => sum + (m.sleep_hours || 0), 0) / sleepEntries.length
      : null;

    return { workoutCount, sleepAvg };
  } catch {
    return { workoutCount: 0, sleepAvg: null };
  }
}

async function fetchXPData(): Promise<{ level: number; totalXP: number }> {
  try {
    const xpRows = await localGetAll<{
      level?: number; total_xp?: number; is_deleted?: boolean;
    }>('user_xp');

    const row = xpRows.find(r => !r.is_deleted) || xpRows[0];
    if (row) {
      return { level: row.level || 1, totalXP: row.total_xp || 0 };
    }
    return { level: 1, totalXP: 0 };
  } catch {
    return { level: 1, totalXP: 0 };
  }
}

// ── Main builder ────────────────────────────────────────────────

export async function buildUserContext(): Promise<UserContext> {
  const now = Date.now();

  // Return cached if fresh
  if (_cachedContext && now - _cacheTimestamp < CACHE_TTL_MS) {
    return _cachedContext;
  }

  const today = localDateStr();
  const currentHour = new Date().getHours();

  // ── Sync store reads ──

  const scheduleState = useScheduleStore.getState();
  const habitsState = useHabitsStore.getState();
  const goalsState = useGoalsStore.getState();
  const financeState = useFinanceStore.getState();
  const healthState = useHealthStore.getState();
  const journalState = useJournalStore.getState();
  const liveState = useLiveActivityStore.getState();
  const userState = useUserStore.getState();
  const agentState = useAgentStore.getState();
  const inventoryState = useInventoryStore.getState();
  const assetsState = useAssetsStore.getState();

  // ── Schedule ──
  const todayEvents = (scheduleState.events || []).filter(e =>
    e.start_time?.startsWith(today) && !e.is_deleted
  ).sort((a, b) => a.start_time.localeCompare(b.start_time));

  const todayTasks = (scheduleState.tasks || []).filter(t =>
    (t.due_date === today || t.scheduled_date === today) && !t.is_deleted && t.status !== 'done'
  );

  const overdueTasks = (scheduleState.tasks || []).filter(t =>
    t.due_date && t.due_date < today && t.status !== 'done' && !t.is_deleted
  );

  // ── Habits ──
  const activeHabits = (habitsState.habits || []).filter(h => h.is_active && !h.is_deleted);
  const todayLogs = (habitsState.logs || []).filter(l => l.date === today);
  const loggedTodayIds = new Set(todayLogs.map(l => l.habit_id));

  const atRiskStreaks = currentHour >= 14
    ? activeHabits
        .filter(h => (h.streak_current || 0) > 3 && !loggedTodayIds.has(h.id))
        .sort((a, b) => (b.streak_current || 0) - (a.streak_current || 0))
        .slice(0, 3)
        .map(h => ({ title: h.title, streak: h.streak_current || 0 }))
    : [];

  const topStreaks = activeHabits
    .filter(h => (h.streak_current || 0) > 0)
    .sort((a, b) => (b.streak_current || 0) - (a.streak_current || 0))
    .slice(0, 3)
    .map(h => ({ title: h.title, streak: h.streak_current || 0 }));

  // ── Goals ──
  const nowDate = new Date();
  const activeGoals = (goalsState.goals || []).filter(g => !g.is_deleted && g.status === 'active');

  const staleGoals = activeGoals.filter(g => {
    if (!g.updated_at) return true;
    const daysSince = Math.floor(
      (nowDate.getTime() - new Date(g.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSince >= 7;
  }).slice(0, 3).map(g => g.title);

  const recentWins = (goalsState.goals || []).filter(g => {
    if (g.is_deleted || g.status !== 'completed' || !g.updated_at) return false;
    const hoursSince = (nowDate.getTime() - new Date(g.updated_at).getTime()) / (1000 * 60 * 60);
    return hoursSince <= 72;
  }).map(g => g.title);

  const topGoals = activeGoals
    .slice(0, 5)
    .map(g => ({ title: g.title, progress: g.progress || 0, status: g.status || 'active' }));

  // ── Finance (privacy: ranges, not exact amounts) ──
  const monthIncome = financeState.monthIncome();
  const monthExpenses = financeState.monthExpenses();
  const netCf = financeState.netCashflow();

  // ── Health ──
  const tm = healthState.todayMetrics;

  // ── Journal ──
  const hasEntryToday = journalState.getEntryForDate(today) !== null;
  const recentEntries = (journalState.entries || []).slice(0, 7);

  // ── Live Activity ──
  const la = liveState.activeEvent;

  // ── Assets ──
  const upcomingMaint = assetsState.getUpcomingMaintenance(14);
  const monthlyBillTotal = assetsState.getMonthlyBillTotal();

  // ── Active nudges ──
  const activeNudgeTypes = (agentState.nudges || [])
    .filter(n => !n.dismissed)
    .map(n => n.type);

  // ── Async Supabase queries (cached separately) ──
  let asyncData = _asyncCache;
  if (!asyncData || now - _asyncCacheTimestamp >= CACHE_TTL_MS) {
    const [healthWeek, xp, gcalEvents] = await Promise.all([
      fetchHealthWeekData(),
      fetchXPData(),
      fetchUpcomingEvents(7).catch(() => []),
    ]);

    const todayGcal = gcalEvents
      .filter(e => e.start?.startsWith(today))
      .map(e => ({ title: e.summary || 'Untitled', startTime: e.start }));

    asyncData = {
      weekWorkouts: healthWeek.workoutCount,
      weekSleepAvg: healthWeek.sleepAvg,
      level: xp.level,
      totalXP: xp.totalXP,
      googleEvents: todayGcal,
    };
    _asyncCache = asyncData;
    _asyncCacheTimestamp = now;
  }

  const ctx: UserContext = {
    user: {
      firstName: userState.firstName,
      occupation: userState.profile?.occupation || null,
      primaryFocus: userState.profile?.primary_focus || null,
    },
    schedule: {
      todayEventCount: todayEvents.length,
      todayEvents: todayEvents.slice(0, 8).map(e => ({
        title: e.title,
        startTime: e.start_time,
        endTime: e.end_time || null,
      })),
      todayTaskCount: todayTasks.length,
      overdueTaskCount: overdueTasks.length,
      overdueTasks: overdueTasks.slice(0, 5).map(t => t.title),
    },
    habits: {
      activeCount: activeHabits.length,
      loggedTodayCount: loggedTodayIds.size,
      atRiskStreaks,
      topStreaks,
    },
    goals: {
      activeCount: activeGoals.length,
      staleGoals,
      recentWins,
      topGoals,
    },
    finance: {
      monthIncomeRange: amountToRange(monthIncome),
      monthExpenseRange: amountToRange(monthExpenses),
      netCashflow: netCf >= 0 ? `+${amountToRange(netCf)}` : `-${amountToRange(Math.abs(netCf))}`,
      upcomingBillCount: (assetsState.getUpcomingBills?.(14) || []).length + (financeState.bills || []).length,
    },
    health: {
      todayMood: tm?.mood_score ?? null,
      todayEnergy: tm?.energy_score ?? null,
      todaySleep: tm?.sleep_hours ?? null,
      weekWorkoutCount: asyncData.weekWorkouts,
      weekSleepAvg: asyncData.weekSleepAvg,
    },
    journal: {
      hasEntryToday,
      recentEntryCount: recentEntries.length,
    },
    liveActivity: {
      isActive: !!la,
      title: la?.title || null,
      elapsedMinutes: la ? Math.floor(liveState.elapsedSeconds / 60) : 0,
    },
    gamification: {
      level: asyncData.level,
      totalXP: asyncData.totalXP,
    },
    assets: {
      upcomingMaintenanceCount: upcomingMaint.length,
      monthlyBillTotal,
    },
    inventory: {
      itemCount: (inventoryState.items || []).length,
    },
    googleCalendar: {
      eventCount: asyncData.googleEvents.length,
      todayEvents: asyncData.googleEvents.slice(0, 5),
    },
    activeNudgeTypes,
  };

  _cachedContext = ctx;
  _cacheTimestamp = now;
  return ctx;
}

// ── Privacy helper: convert dollar amount to range string ────────

function amountToRange(amount: number): string {
  if (amount === 0) return '$0';
  if (amount < 100) return '~$' + Math.round(amount / 10) * 10;
  if (amount < 1000) return '~$' + Math.round(amount / 50) * 50;
  if (amount < 10000) return '~$' + (Math.round(amount / 100) * 100).toLocaleString();
  return '~$' + (Math.round(amount / 500) * 500).toLocaleString();
}

// ── Format time helper ──────────────────────────────────────────

function fmtTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return isoStr;
  }
}

// ── Prompt builder ──────────────────────────────────────────────

export function contextToPrompt(ctx: UserContext): string {
  const parts: string[] = [];
  const today = localDateStr();

  // User
  parts.push(`User: ${ctx.user.firstName}${ctx.user.occupation ? ` (${ctx.user.occupation})` : ''}.${ctx.user.primaryFocus ? ` Primary focus: ${ctx.user.primaryFocus}.` : ''} Level ${ctx.gamification.level} (${ctx.gamification.totalXP.toLocaleString()} XP).`);

  // Live activity
  if (ctx.liveActivity.isActive) {
    parts.push(`CURRENTLY IN FOCUS SESSION: "${ctx.liveActivity.title}" for ${ctx.liveActivity.elapsedMinutes} minutes.`);
  }

  // Schedule
  if (ctx.schedule.todayEventCount > 0) {
    const eventList = ctx.schedule.todayEvents
      .map(e => `${fmtTime(e.startTime)} ${e.title}`)
      .join(', ');
    parts.push(`Today's schedule (${today}): ${ctx.schedule.todayEventCount} events — ${eventList}.`);
  } else {
    parts.push(`Today (${today}): No events scheduled.`);
  }

  if (ctx.schedule.todayTaskCount > 0) {
    parts.push(`${ctx.schedule.todayTaskCount} task${ctx.schedule.todayTaskCount !== 1 ? 's' : ''} due today.`);
  }

  if (ctx.schedule.overdueTaskCount > 0) {
    parts.push(`⚠ ${ctx.schedule.overdueTaskCount} overdue task${ctx.schedule.overdueTaskCount !== 1 ? 's' : ''}: ${ctx.schedule.overdueTasks.join(', ')}.`);
  }

  // Habits
  if (ctx.habits.activeCount > 0) {
    parts.push(`Habits: ${ctx.habits.loggedTodayCount}/${ctx.habits.activeCount} done today.`);
    if (ctx.habits.topStreaks.length > 0) {
      parts.push(`Top streaks: ${ctx.habits.topStreaks.map(s => `${s.title} (${s.streak}d)`).join(', ')}.`);
    }
    if (ctx.habits.atRiskStreaks.length > 0) {
      parts.push(`Streaks at risk (not logged today): ${ctx.habits.atRiskStreaks.map(s => `${s.title} (${s.streak}d)`).join(', ')}.`);
    }
  }

  // Goals
  if (ctx.goals.activeCount > 0) {
    const goalList = ctx.goals.topGoals
      .map(g => `${g.title} (${Math.round(g.progress * 100)}%)`)
      .join(', ');
    parts.push(`Goals: ${ctx.goals.activeCount} active — ${goalList}.`);
    if (ctx.goals.staleGoals.length > 0) {
      parts.push(`Stale (no activity 7+ days): ${ctx.goals.staleGoals.join(', ')}.`);
    }
    if (ctx.goals.recentWins.length > 0) {
      parts.push(`Recent wins: ${ctx.goals.recentWins.join(', ')}!`);
    }
  }

  // Finance (privacy-safe ranges)
  if (ctx.finance.monthIncomeRange !== '$0' || ctx.finance.monthExpenseRange !== '$0') {
    parts.push(`Finance this month: income ${ctx.finance.monthIncomeRange}, expenses ${ctx.finance.monthExpenseRange}, net ${ctx.finance.netCashflow}.`);
  }
  if (ctx.finance.upcomingBillCount > 0) {
    parts.push(`${ctx.finance.upcomingBillCount} upcoming bill${ctx.finance.upcomingBillCount !== 1 ? 's' : ''}.`);
  }

  // Health
  const healthParts: string[] = [];
  if (ctx.health.todayMood !== null) healthParts.push(`mood ${ctx.health.todayMood}/10`);
  if (ctx.health.todayEnergy !== null) healthParts.push(`energy ${ctx.health.todayEnergy}/10`);
  if (ctx.health.todaySleep !== null) healthParts.push(`${ctx.health.todaySleep}h sleep`);
  if (healthParts.length > 0) {
    parts.push(`Today's health: ${healthParts.join(', ')}.`);
  }
  if (ctx.health.weekWorkoutCount > 0 || ctx.health.weekSleepAvg !== null) {
    const weekParts: string[] = [];
    if (ctx.health.weekWorkoutCount > 0) weekParts.push(`${ctx.health.weekWorkoutCount} workouts`);
    if (ctx.health.weekSleepAvg !== null) weekParts.push(`avg ${ctx.health.weekSleepAvg.toFixed(1)}h sleep`);
    parts.push(`This week: ${weekParts.join(', ')}.`);
  }

  // Journal
  if (!ctx.journal.hasEntryToday) {
    parts.push(`No journal entry today.`);
  }

  // Google Calendar
  if (ctx.googleCalendar.todayEvents.length > 0) {
    const gcList = ctx.googleCalendar.todayEvents.map(e => `${fmtTime(e.startTime)} ${e.title}`).join(', ');
    parts.push(`Google Calendar today: ${gcList}. (${ctx.googleCalendar.eventCount} total upcoming)`);
  }

  // Assets
  if (ctx.assets.upcomingMaintenanceCount > 0) {
    parts.push(`${ctx.assets.upcomingMaintenanceCount} upcoming maintenance item${ctx.assets.upcomingMaintenanceCount !== 1 ? 's' : ''}.`);
  }

  // Active nudges (avoid repeating)
  if (ctx.activeNudgeTypes.length > 0) {
    parts.push(`Active nudges (don't repeat): ${ctx.activeNudgeTypes.join(', ')}.`);
  }

  return parts.join('\n');
}

// ── Subset builders for insights ────────────────────────────────

export function contextSubset(ctx: UserContext, type: string): string {
  switch (type) {
    case 'habit_check':
      return contextToPrompt({
        ...emptyContext(),
        user: ctx.user,
        habits: ctx.habits,
        gamification: ctx.gamification,
      });
    case 'schedule_optimize':
      return contextToPrompt({
        ...emptyContext(),
        user: ctx.user,
        schedule: ctx.schedule,
        liveActivity: ctx.liveActivity,
      });
    case 'goal_analysis':
      return contextToPrompt({
        ...emptyContext(),
        user: ctx.user,
        goals: ctx.goals,
        finance: ctx.finance,
      });
    default:
      return contextToPrompt(ctx);
  }
}

export function contextForPage(ctx: UserContext, currentPage?: string): string {
  if (!currentPage) return contextToPrompt(ctx);

  const page = currentPage.replace(/^\//, '').split('/')[0];
  switch (page) {
    case 'goals':
      return contextToPrompt({ ...ctx,
        finance: emptyContext().finance,
        health: { ...emptyContext().health, todayMood: ctx.health.todayMood, todayEnergy: ctx.health.todayEnergy },
      });
    case 'health':
      return contextToPrompt({ ...ctx,
        finance: emptyContext().finance,
        goals: { ...emptyContext().goals, activeCount: ctx.goals.activeCount, topGoals: ctx.goals.topGoals.slice(0, 2) },
      });
    case 'finances':
      return contextToPrompt({ ...ctx,
        health: emptyContext().health,
        goals: { ...emptyContext().goals, activeCount: ctx.goals.activeCount, topGoals: ctx.goals.topGoals.slice(0, 2) },
      });
    case 'habits':
      return contextToPrompt({ ...ctx,
        finance: emptyContext().finance,
        goals: { ...emptyContext().goals, activeCount: ctx.goals.activeCount },
      });
    default:
      return contextToPrompt(ctx);
  }
}

function emptyContext(): UserContext {
  return {
    user: { firstName: '', occupation: null, primaryFocus: null },
    schedule: { todayEventCount: 0, todayEvents: [], todayTaskCount: 0, overdueTaskCount: 0, overdueTasks: [] },
    habits: { activeCount: 0, loggedTodayCount: 0, atRiskStreaks: [], topStreaks: [] },
    goals: { activeCount: 0, staleGoals: [], recentWins: [], topGoals: [] },
    finance: { monthIncomeRange: '$0', monthExpenseRange: '$0', netCashflow: '+$0', upcomingBillCount: 0 },
    health: { todayMood: null, todayEnergy: null, todaySleep: null, weekWorkoutCount: 0, weekSleepAvg: null },
    journal: { hasEntryToday: false, recentEntryCount: 0 },
    liveActivity: { isActive: false, title: null, elapsedMinutes: 0 },
    gamification: { level: 1, totalXP: 0 },
    assets: { upcomingMaintenanceCount: 0, monthlyBillTotal: 0 },
    inventory: { itemCount: 0 },
    googleCalendar: { eventCount: 0, todayEvents: [] },
    activeNudgeTypes: [],
  };
}
