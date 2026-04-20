/**
 * LifeOS Intent Engine — Context Loader
 *
 * Loads user data from stores and Supabase to build the
 * IntentContext object used by the system prompt and intent engine.
 */

import { supabase } from '../data-access';
import { useUserStore } from '../../stores/useUserStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useHealthStore } from '../../stores/useHealthStore';
import type { IntentContext } from './types';

// ─── Context Loader ──────────────────────────────────────────────

export async function loadIntentContext(userId: string): Promise<IntentContext> {
  // Use Australia/Melbourne timezone for all date/time calculations
  const melbTZ = 'Australia/Melbourne';
  const nowMelb = new Date();
  const today = nowMelb.toLocaleDateString('en-CA', { timeZone: melbTZ }); // YYYY-MM-DD in Melbourne
  const tomorrowDate = new Date(nowMelb.getTime() + 86400000);
  const tomorrow = tomorrowDate.toLocaleDateString('en-CA', { timeZone: melbTZ });
  const currentTime = nowMelb.toLocaleTimeString('en-GB', { timeZone: melbTZ, hour: '2-digit', minute: '2-digit', hour12: false }); // HH:MM
  // Calculate UTC offset for Melbourne (handles DST automatically)
  const utcOffset = (() => {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: melbTZ, timeZoneName: 'shortOffset' });
    const parts = fmt.formatToParts(nowMelb);
    const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '+11:00';
    // Format like "GMT+11" → "+11:00"
    const m = tzPart.match(/GMT([+-])(\d+)/);
    return m ? `${m[1]}${m[2].padStart(2, '0')}:00` : '+11:00';
  })();
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA');

  // ── Hydrate stores (they deduplicate/cache internally) ──
  await Promise.all([
    useScheduleStore.getState().fetchAll(),
    useGoalsStore.getState().fetchAll(),
    useHabitsStore.getState().fetchAll(),
    useFinanceStore.getState().fetchAll(),
    useHealthStore.getState().fetchToday(),
  ]);

  // ── Read from stores (instant, no network) ──
  const schedStore = useScheduleStore.getState();
  const goalsStore = useGoalsStore.getState();
  const habitsStore = useHabitsStore.getState();
  const finStore = useFinanceStore.getState();
  const healthStore = useHealthStore.getState();

  // User profile — still needs direct query (no store for profiles)
  const profileRes = await supabase.from('user_profiles')
    .select('display_name').eq('user_id', userId).maybeSingle();
  const userName = profileRes.data?.display_name || '';

  // Grocery lists — still needs direct query (no store for grocery)
  const groceryRes = await supabase.from('grocery_lists').select('id,name,store,grocery_items(id)')
    .eq('user_id', userId).eq('is_active', true).eq('is_deleted', false);

  // ── Build context from store data ──

  // Categories from finance store (deduplicated)
  const seenCats = new Set<string>();
  const categories = finStore.categories
    .map(c => ({ id: c.id, name: c.name, icon: c.icon || '📦', scope: c.scope || 'personal' }))
    .filter(c => {
      const key = `${c.name}-${c.scope}`;
      if (seenCats.has(key)) return false;
      seenCats.add(key);
      return true;
    });

  // Businesses from goals store (deduplicated)
  const seenBiz = new Set<string>();
  const businesses = goalsStore.businesses
    .map(b => ({ id: b.id, name: b.name, type: b.type || 'other', icon: b.icon || '💼' }))
    .filter(b => {
      if (seenBiz.has(b.name)) return false;
      seenBiz.add(b.name);
      return true;
    });

  // Goals from store
  const allGoals = goalsStore.goals;
  const topGoals = allGoals
    .filter(g => !g.parent_goal_id || g.category === 'objective')
    .map(g => ({ id: g.id, title: g.title, category: g.category || 'goal' }));
  const goalTree = allGoals
    .filter(g => g.status === 'active')
    .map(g => ({
      id: g.id, title: g.title, category: g.category || 'goal',
      domain: (g as { domain?: string }).domain || null, parent_goal_id: g.parent_goal_id || null,
      target_date: g.target_date || null, status: g.status || 'active',
    }));

  // Tasks from schedule store (recent, todo/in_progress)
  const recentTasks = schedStore.tasks
    .filter(t => t.status === 'todo' || t.status === 'in_progress')
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 20)
    .map(t => ({ id: t.id, title: t.title, status: t.status, due_date: t.due_date || null, priority: t.priority || 'medium' }));

  // Events from schedule store (upcoming 7 days)
  const nowIso = new Date().toISOString();
  const recentEvents = schedStore.events
    .filter(e => e.start_time && e.start_time >= nowIso && e.start_time <= weekAhead)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
    .slice(0, 15)
    .map(e => ({ id: e.id, title: e.title, start_time: e.start_time || '', location: (e as { location?: string }).location || null }));

  // Expenses from finance store (last 7 days)
  const recentExpenses = finStore.expenses
    .filter(e => e.date >= sevenDaysAgo)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 15)
    .map(e => ({ id: e.id, description: e.description || '', amount: e.amount, date: e.date, category_id: e.category_id || null }));

  // Habits from store
  const habits = habitsStore.habits
    .slice(0, 20)
    .map(h => ({ id: h.id, title: h.title, streak_current: h.streak_current || null }));

  // Today's health from store
  const todayHealth = healthStore.todayMetrics ? {
    mood_score: healthStore.todayMetrics.mood_score ?? null,
    energy_score: healthStore.todayMetrics.energy_score ?? null,
    sleep_hours: healthStore.todayMetrics.sleep_hours ?? null,
    water_glasses: healthStore.todayMetrics.water_glasses ?? null,
    weight_kg: healthStore.todayMetrics.weight_kg ?? null,
  } : null;

  return {
    userId,
    userName,
    today,
    tomorrow,
    currentTime,
    utcOffset,
    timezone: 'Australia/Melbourne',
    categories,
    businesses,
    topGoals,
    goalTree,
    recentTasks,
    recentEvents,
    recentExpenses,
    activeGroceryLists: (groceryRes.data || []).map((l: { name: string; id: string; items?: { name: string; checked: boolean }[] }) => ({
      id: l.id, name: l.name, store: l.store,
      item_count: l.grocery_items?.length || 0,
    })),
    todayHealth,
    habits,
    financialSummary: await buildFinancialSummary(userId),
    habitSuggestions: await buildHabitSuggestionsList(userId),
  };
}

// ─── Financial Summary ────────────────────────────────────────────

async function buildFinancialSummary(userId: string): Promise<string> {
  try {
    const { getFinancialSnapshot } = await import('../financial-engine');
    const snap = await getFinancialSnapshot(userId);
    const lines: string[] = [];
    if (snap.monthlyIncome > 0) lines.push(`Monthly income: $${snap.monthlyIncome.toFixed(0)}`);
    if (snap.costOfLiving > 0) lines.push(`Cost of living: $${snap.costOfLiving.toFixed(0)}/month`);
    if (snap.monthlyExpenses > 0) lines.push(`Expenses this month: $${snap.monthlyExpenses.toFixed(0)}`);
    if (snap.disposableIncome !== 0) lines.push(`Disposable: $${snap.disposableIncome.toFixed(0)}/month`);
    if (snap.savingsRate !== 0) lines.push(`Savings rate: ${snap.savingsRate.toFixed(0)}%`);
    lines.push(`Financial health: ${snap.financialHealthScore}/100`);
    if (snap.alerts.length > 0) {
      lines.push('Alerts: ' + snap.alerts.map(a => a.message).join('; '));
    }
    return lines.join('\n') || '';
  } catch {
    return '';
  }
}

// ─── Habit Suggestions ────────────────────────────────────────────

async function buildHabitSuggestionsList(userId: string): Promise<string[]> {
  try {
    const { getAllSuggestions } = await import('../habit-engine');
    const suggestions = await getAllSuggestions(userId);
    return suggestions.slice(0, 5).map(s => `${s.icon} ${s.title} (${s.reason})`);
  } catch {
    return [];
  }
}