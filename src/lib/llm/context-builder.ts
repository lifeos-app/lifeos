/**
 * LifeOS LLM Context Builder
 *
 * Gathers relevant data based on the current page and user question,
 * then formats it as a compact string to inject into LLM prompts.
 *
 * The goal: give the AI just enough context to answer intelligently
 * without flooding the prompt with irrelevant data.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { detectCorrelations, formatCorrelationsForLLM } from './correlation-engine';
import type { CorrelationInput } from './correlation-engine';

// ── TYPES ──────────────────────────────────────────────────────────────────────

export interface ContextSection {
  label: string;
  data: string;
}

// ── PAGE → RELEVANT TABLES MAP ─────────────────────────────────────────────────

type PageContextLoader = (
  userId: string,
  supabase: SupabaseClient
) => Promise<ContextSection[]>;

/** Each page knows which data is most relevant to its context */
const PAGE_LOADERS: Record<string, PageContextLoader> = {
  '/':           loadDashboardContext,
  '/finances':   loadFinanceContext,
  '/goals':      loadGoalsContext,
  '/habits':     loadHabitsContext,
  '/health':     loadHealthContext,
  '/schedule':   loadScheduleContext,
  '/social':     loadSocialContext,
  '/work':       loadWorkContext,
  '/journal':    loadJournalContext,
  '/settings':   loadSettingsContext,
};

// ── MAIN FUNCTION ──────────────────────────────────────────────────────────────

/**
 * Build a compact LLM context string for the given page + user question.
 *
 * @param userId       - LifeOS user ID
 * @param currentPage  - Current route path (e.g. '/finances')
 * @param userMessage  - The user's question (used for intent detection)
 * @param supabase     - Authenticated Supabase client
 * @returns            A formatted string to prepend to the LLM prompt
 */
export async function buildLLMContext(
  userId: string,
  currentPage: string,
  userMessage: string,
  supabase: SupabaseClient
): Promise<string> {
  const today = new Date().toISOString().split('T')[0];

  // Normalise path (remove query params)
  const basePath = currentPage.split('?')[0];

  // Load page-specific context + any extra sections triggered by the message
  const loader = PAGE_LOADERS[basePath] ?? PAGE_LOADERS['/'];
  const messageLower = userMessage.toLowerCase();

  // Run page loader + any cross-cutting sections in parallel
  const [pageSections, crossSections] = await Promise.all([
    loader(userId, supabase),
    loadCrossCuttingContext(userId, messageLower, supabase),
  ]);

  const sections = [...pageSections, ...crossSections];

  if (sections.length === 0) {
    return `User ID: ${userId}\nDate: ${today}\nCurrent page: ${basePath}\n`;
  }

  const lines = [
    `User ID: ${userId}`,
    `Date: ${today}`,
    `Current page: ${basePath}`,
    '',
    '=== CONTEXT ===',
    ...sections.flatMap(s => [`[${s.label}]`, s.data, '']),
  ];

  return lines.join('\n');
}

// ── CROSS-CUTTING CONTEXT ──────────────────────────────────────────────────────

/** Fetch raw data from all domains for the correlation engine */
async function loadCorrelationInput(
  userId: string,
  supabase: SupabaseClient
): Promise<CorrelationInput> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyStr = thirtyDaysAgo.toISOString().split('T')[0];

  const [
    habitsRes,
    habitLogsRes,
    tasksRes,
    eventsRes,
    goalsRes,
    transactionsRes,
    billsRes,
    healthRes,
  ] = await Promise.all([
    supabase
      .from('habits')
      .select('id, title, is_active, is_deleted, frequency, target_count, streak_current, goal_id')
      .eq('user_id', userId)
      .eq('is_deleted', false),
    supabase
      .from('habit_logs')
      .select('id, habit_id, date, count')
      .eq('user_id', userId)
      .gte('date', thirtyStr),
    supabase
      .from('tasks')
      .select('id, title, status, due_date, scheduled_date, completed_at')
      .eq('user_id', userId)
      .eq('is_deleted', false),
    supabase
      .from('schedule_events')
      .select('id, title, start_time, end_time, event_type, is_deleted')
      .eq('user_id', userId)
      .gte('start_time', thirtyStr),
    supabase
      .from('goals')
      .select('id, title, status, progress, updated_at, is_deleted, financial_type, category, domain')
      .eq('user_id', userId)
      .eq('is_deleted', false),
    supabase
      .from('transactions')
      .select('id, type, amount, date')
      .eq('user_id', userId)
      .gte('date', thirtyStr),
    supabase
      .from('bills')
      .select('id, title, amount, due_date, status, is_deleted')
      .eq('user_id', userId)
      .eq('is_deleted', false),
    supabase
      .from('health_metrics')
      .select('id, date, mood_score, energy_score, stress_score, sleep_hours, sleep_quality, water_glasses, exercise_minutes')
      .eq('user_id', userId)
      .gte('date', thirtyStr),
  ]);

  return {
    habits: (habitsRes.data ?? []) as CorrelationInput['habits'],
    habitLogs: (habitLogsRes.data ?? []) as CorrelationInput['habitLogs'],
    tasks: (tasksRes.data ?? []) as CorrelationInput['tasks'],
    events: (eventsRes.data ?? []) as CorrelationInput['events'],
    goals: (goalsRes.data ?? []) as CorrelationInput['goals'],
    transactions: (transactionsRes.data ?? []) as CorrelationInput['transactions'],
    bills: (billsRes.data ?? []) as CorrelationInput['bills'],
    healthMetrics: (healthRes.data ?? []) as CorrelationInput['healthMetrics'],
  };
}

/** Load extra sections based on keywords in the user's message */
async function loadCrossCuttingContext(
  userId: string,
  messageLower: string,
  supabase: SupabaseClient
): Promise<ContextSection[]> {
  const sections: ContextSection[] = [];

  // Cross-domain correlations (always compute, lightweight with cached data)
  try {
    const corrInput = await loadCorrelationInput(userId, supabase);
    const correlations = detectCorrelations(corrInput);
    if (correlations.length > 0) {
      sections.push({
        label: 'Cross-Domain Correlations',
        data: formatCorrelationsForLLM(correlations),
      });
    }
  } catch {
    // Correlation engine is optional — never break context building
  }

  // XP / level always useful for gamification questions
  if (messageLower.match(/\b(xp|level|rank|points|streak)\b/)) {
    const { data: xp } = await supabase
      .from('user_xp')
      .select('total_xp, level, title')
      .eq('user_id', userId)
      .maybeSingle();

    if (xp) {
      sections.push({
        label: 'XP & Level',
        data: `Level ${xp.level} (${xp.title}) · ${xp.total_xp.toLocaleString()} total XP`,
      });
    }
  }

  // Plugin activity if user asks about cleaning, TCS, invoices, Shopify
  if (messageLower.match(/\b(clean|tcs|shopify|invoice|job|client)\b/)) {
    const { data: activity } = await supabase
      .from('plugin_activity')
      .select('title, created_at, xp_earned')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (activity && activity.length > 0) {
      const lines = activity.map((a: { title: string; created_at: string; xp_earned: number }) =>
        `• ${a.title} (${new Date(a.created_at).toLocaleDateString('en-AU')})`
      );
      sections.push({ label: 'Recent Plugin Activity', data: lines.join('\n') });
    }
  }

  return sections;
}

// ── PAGE-SPECIFIC LOADERS ──────────────────────────────────────────────────────

async function loadDashboardContext(
  userId: string,
  supabase: SupabaseClient
): Promise<ContextSection[]> {
  const today = new Date().toISOString().split('T')[0];
  const sections: ContextSection[] = [];

  const [tasksRes, habitsRes, questsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('title, priority, status, due_date')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .neq('status', 'done')
      .lte('due_date', today)
      .limit(5),

    supabase
      .from('habits')
      .select('title, streak_current, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .limit(10),

    supabase
      .from('quests')
      .select('v2_title, quest_data, priority, reward_xp')
      .eq('user_id', userId)
      .is('completed_at', null)
      .gte('expires_at', new Date().toISOString())
      .limit(5),
  ]);

  if (tasksRes.data?.length) {
    const lines = tasksRes.data.map((t: { title: string; priority: string; due_date: string | null }) =>
      `• [${t.priority}] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}`
    );
    sections.push({ label: 'Overdue/Due Today Tasks', data: lines.join('\n') });
  }

  if (habitsRes.data?.length) {
    const lines = habitsRes.data.map((h: { title: string; streak_current: number }) =>
      `• ${h.title} (${h.streak_current}d streak)`
    );
    sections.push({ label: 'Active Habits', data: lines.join('\n') });
  }

  if (questsRes.data?.length) {
    const lines = questsRes.data.map((q: { v2_title?: string; quest_data?: { title: string }; priority: string; reward_xp: number }) =>
      `• [${q.priority}] ${q.v2_title ?? q.quest_data?.title ?? 'Quest'} (+${q.reward_xp} XP)`
    );
    sections.push({ label: 'Active Quests', data: lines.join('\n') });
  }

  return sections;
}

async function loadFinanceContext(
  userId: string,
  supabase: SupabaseClient
): Promise<ContextSection[]> {
  const sections: ContextSection[] = [];
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: transactions } = await supabase
    .from('transactions')
    .select('type, amount, description, date')
    .eq('user_id', userId)
    .gte('date', monthStart.toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(15);

  if (transactions?.length) {
    let income = 0;
    let expenses = 0;
    const recent = transactions.slice(0, 5).map((t: { type: string; amount: number; description: string; date: string }) => {
      if (t.type === 'income') income += t.amount;
      else expenses += t.amount;
      return `• ${t.type === 'income' ? '+' : '-'}$${t.amount.toFixed(2)} ${t.description} (${t.date})`;
    });

    sections.push({
      label: 'This Month Finances',
      data:  `Income: $${income.toFixed(2)} | Expenses: $${expenses.toFixed(2)} | Net: $${(income - expenses).toFixed(2)}\n\nRecent:\n${recent.join('\n')}`,
    });
  }

  return sections;
}

async function loadGoalsContext(
  userId: string,
  supabase: SupabaseClient
): Promise<ContextSection[]> {
  const { data: goals } = await supabase
    .from('goals')
    .select('title, category, progress, updated_at')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .lt('progress', 1)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (!goals?.length) return [];

  const lines = goals.map((g: { title: string; category: string; progress: number }) =>
    `• [${g.category}] ${g.title} — ${Math.round((g.progress ?? 0) * 100)}%`
  );

  return [{ label: 'Active Goals', data: lines.join('\n') }];
}

async function loadHabitsContext(
  userId: string,
  supabase: SupabaseClient
): Promise<ContextSection[]> {
  const today = new Date().toISOString().split('T')[0];
  const [habitsRes, logsRes] = await Promise.all([
    supabase
      .from('habits')
      .select('id, title, icon, streak_current, streak_best')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_deleted', false),
    supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', userId)
      .eq('date', today),
  ]);

  if (!habitsRes.data?.length) return [];

  const loggedIds = new Set((logsRes.data ?? []).map((l: { habit_id: string }) => l.habit_id));
  const lines = habitsRes.data.map((h: { id: string; title: string; icon: string | null; streak_current: number; streak_best: number }) =>
    `• ${h.icon ?? '🔄'} ${h.title} — ${h.streak_current}d streak${loggedIds.has(h.id) ? ' ✅' : ' ⏳'}`
  );

  return [{ label: 'Habits (today)', data: lines.join('\n') }];
}

async function loadHealthContext(
  userId: string,
  supabase: SupabaseClient
): Promise<ContextSection[]> {
  const { data: logs } = await supabase
    .from('health_metrics')
    .select('mood_score, energy_score, sleep_hours, sleep_quality, water_glasses, weight_kg, notes, date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(10);

  if (!logs?.length) return [];

  const lines = logs.map((l: { mood_score: number | null; energy_score: number | null; sleep_hours: number | null; sleep_quality: number | null; water_glasses: number | null; weight_kg: number | null; notes: string | null; date: string }) => {
    const parts: string[] = [];
    if (l.mood_score) parts.push(`mood: ${l.mood_score}/5`);
    if (l.energy_score) parts.push(`energy: ${l.energy_score}/5`);
    if (l.sleep_hours) parts.push(`sleep: ${l.sleep_hours}h`);
    if (l.water_glasses) parts.push(`water: ${l.water_glasses} glasses`);
    if (l.weight_kg) parts.push(`weight: ${l.weight_kg}kg`);
    if (l.notes) parts.push(l.notes);
    return `• ${new Date(l.date).toLocaleDateString('en-AU')}: ${parts.join(', ') || 'no data'}`;
  }
  );

  return [{ label: 'Recent Health Logs', data: lines.join('\n') }];
}

async function loadScheduleContext(
  userId: string,
  supabase: SupabaseClient
): Promise<ContextSection[]> {
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: events } = await supabase
    .from('schedule_events')
    .select('title, start_time, end_time, location')
    .eq('user_id', userId)
    .gte('start_time', now.toISOString())
    .lte('start_time', weekEnd.toISOString())
    .order('start_time')
    .limit(10);

  if (!events?.length) return [{ label: 'Schedule', data: 'No events in the next 7 days.' }];

  const lines = events.map((e: { title: string; start_time: string; location?: string }) =>
    `• ${new Date(e.start_time).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })} ${new Date(e.start_time).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })} — ${e.title}${e.location ? ` @ ${e.location}` : ''}`
  );

  return [{ label: 'Upcoming Schedule (7 days)', data: lines.join('\n') }];
}

async function loadSocialContext(
  userId: string,
  supabase: SupabaseClient
): Promise<ContextSection[]> {
  const { data: partners } = await supabase
    .from('partnerships')
    .select('responder_id, status, responder:public_profiles!responder_id(display_name, bio)')
    .eq('requester_id', userId)
    .eq('status', 'accepted')
    .limit(10);

  if (!partners?.length) return [{ label: 'Partners', data: 'No active accountability partners yet.' }];

  const lines = (partners as unknown as { responder: { display_name: string; bio?: string } | null }[]).map(p =>
    `• ${p.responder?.display_name ?? 'Partner'}${p.responder?.bio ? ` — "${p.responder.bio}"` : ''}`
  );

  return [{ label: 'Accountability Partners', data: lines.join('\n') }];
}

async function loadWorkContext(
  userId: string,
  supabase: SupabaseClient
): Promise<ContextSection[]> {
  const { data: activity } = await supabase
    .from('plugin_activity')
    .select('title, description, created_at, xp_earned')
    .eq('user_id', userId)
    .eq('plugin_id', 'tcs')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!activity?.length) return [{ label: 'TCS Activity', data: 'No TCS events logged yet.' }];

  const lines = activity.map((a: { title: string; description: string | null; created_at: string; xp_earned: number }) =>
    `• ${a.title}${a.description ? ` — ${a.description}` : ''} (${new Date(a.created_at).toLocaleDateString('en-AU')})`
  );

  return [{ label: 'Recent TCS Activity', data: lines.join('\n') }];
}

async function loadJournalContext(
  userId: string,
  supabase: SupabaseClient
): Promise<ContextSection[]> {
  const { data: entries } = await supabase
    .from('journal_entries')
    .select('title, created_at, mood')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!entries?.length) return [{ label: 'Journal', data: 'No journal entries yet.' }];

  const lines = entries.map((e: { title?: string; created_at: string; mood?: string }) =>
    `• ${new Date(e.created_at).toLocaleDateString('en-AU')}${e.title ? ` — ${e.title}` : ''}${e.mood ? ` (${e.mood})` : ''}`
  );

  return [{ label: 'Recent Journal Entries', data: lines.join('\n') }];
}

async function loadSettingsContext(
  _userId: string,
  _supabase: SupabaseClient
): Promise<ContextSection[]> {
  return [{
    label: 'Settings Page',
    data:  'User is on the settings page. Can configure plugins, AI, profile, and preferences.',
  }];
}

// ── UNIVERSAL CONTEXT (for the AI Brain / orchestrator) ────────────────────────

/**
 * Load a compact universal context spanning ALL domains.
 * Used by the AI Brain widget when no specific page context applies,
 * or when the orchestrator needs a holistic view.
 *
 * Loads data in parallel for speed, keeps each section compact.
 */
export async function loadUniversalContext(
  userId: string,
  supabase: SupabaseClient,
): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const sections: ContextSection[] = [];

  // Load all domain data in parallel
  const [
    dashSections,
    financeSections,
    goalsSections,
    habitsSections,
    healthSections,
    scheduleSections,
    journalSections,
    balanceSection,
    xpSection,
  ] = await Promise.all([
    loadDashboardContext(userId, supabase).catch(() => []),
    loadFinanceContext(userId, supabase).catch(() => []),
    loadGoalsContext(userId, supabase).catch(() => []),
    loadHabitsContext(userId, supabase).catch(() => []),
    loadHealthContext(userId, supabase).catch(() => []),
    loadScheduleContext(userId, supabase).catch(() => []),
    loadJournalContext(userId, supabase).catch(() => []),
    loadBalanceSection(userId, supabase).catch(() => []),
    loadXPSection(userId, supabase).catch(() => []),
  ]);

  // Merge all sections
  sections.push(
    ...dashSections,
    ...financeSections,
    ...goalsSections,
    ...habitsSections,
    ...healthSections,
    ...scheduleSections,
    ...journalSections,
    ...balanceSection,
    ...xpSection,
  );

  // Add cross-domain correlations to universal context
  try {
    const corrInput = await loadCorrelationInput(userId, supabase);
    const correlations = detectCorrelations(corrInput);
    if (correlations.length > 0) {
      sections.push({
        label: 'Cross-Domain Correlations',
        data: formatCorrelationsForLLM(correlations),
      });
    }
  } catch {
    // Correlation engine is optional
  }

  if (sections.length === 0) {
    return `User ID: ${userId}\nDate: ${today}\nContext: Universal (all domains)\n`;
  }

  const lines = [
    `User ID: ${userId}`,
    `Date: ${today}`,
    `Context: Universal (all domains)`,
    '',
    '=== UNIVERSAL CONTEXT ===',
    ...sections.flatMap(s => [`[${s.label}]`, s.data, '']),
  ];

  return lines.join('\n');
}

/** Load balance status as a context section */
async function loadBalanceSection(
  userId: string,
  supabase: SupabaseClient,
): Promise<ContextSection[]> {
  try {
    const { getBalanceStatus, formatBalanceForLLM } = await import('./balance-engine');
    const status = await getBalanceStatus(userId, supabase);
    return [{
      label: 'Life Balance',
      data: formatBalanceForLLM(status),
    }];
  } catch {
    return [];
  }
}

/** Load XP & Level as a context section */
async function loadXPSection(
  userId: string,
  supabase: SupabaseClient,
): Promise<ContextSection[]> {
  const { data: xp } = await supabase
    .from('user_xp')
    .select('total_xp, level, title')
    .eq('user_id', userId)
    .maybeSingle();

  if (!xp) return [];

  return [{
    label: 'XP & Level',
    data: `Level ${xp.level} (${xp.title}) · ${xp.total_xp?.toLocaleString() || 0} total XP`,
  }];
}
