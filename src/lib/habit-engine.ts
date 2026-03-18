/**
 * habit-engine.ts — Habit Intelligence Engine
 * 
 * Three modes of habit generation:
 * 1. FROM ONBOARDING: Extract habits from life foundation, health, and finance conversations
 * 2. FROM PATTERNS: Detect repeated task completions and suggest converting to habits
 * 3. FROM GOALS: Analyze goals and suggest supporting habits
 * 
 * Also provides:
 * - Habit impact scoring (which habits correlate with goal progress)
 * - Smart scheduling (morning/evening/anytime based on context)
 */

import { supabase } from './supabase';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface HabitSuggestion {
  title: string;
  description: string;
  icon: string;
  category: 'health' | 'finance' | 'productivity' | 'learning' | 'lifestyle';
  reason: string;
  sourceType: 'task_pattern' | 'goal' | 'health' | 'finance' | 'onboarding';
  sourceId?: string;
  frequency: 'daily' | 'weekdays' | 'weekly' | '3x_week';
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
  durationMinutes?: number;
  confidence: number; // 0-1
  patternData?: Record<string, unknown>;
}

interface TaskPattern {
  normalizedTitle: string;
  count: number;
  lastDone: string;
  taskIds: string[];
  avgGapDays: number;
}

// ═══════════════════════════════════════════════════════════════
// PATTERN DETECTION — Analyze completed tasks for repeating patterns
// ═══════════════════════════════════════════════════════════════

/**
 * Scan completed tasks for patterns that suggest habitual behavior.
 * A pattern = same/similar task completed 3+ times in the last 30 days.
 */
export async function detectTaskPatterns(userId: string): Promise<HabitSuggestion[]> {
  // Get completed tasks from last 60 days
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  
  const { data: doneTasks } = await supabase
    .from('tasks')
    .select('id, title, completed_at, goal_id')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .eq('status', 'done')
    .gte('completed_at', sixtyDaysAgo.toISOString())
    .order('completed_at');
  
  if (!doneTasks?.length) return [];

  // Get existing habits to avoid duplicates
  const { data: existingHabits } = await supabase
    .from('habits')
    .select('title')
    .eq('user_id', userId)
    .eq('is_deleted', false);
  
  const existingTitles = new Set(
    (existingHabits || []).map(h => normalizeTitle(h.title))
  );

  // Group by normalized title
  const patterns: Record<string, TaskPattern> = {};
  
  for (const task of doneTasks) {
    const norm = normalizeTitle(task.title);
    if (!patterns[norm]) {
      patterns[norm] = { normalizedTitle: norm, count: 0, lastDone: '', taskIds: [], avgGapDays: 0 };
    }
    patterns[norm].count++;
    patterns[norm].lastDone = task.completed_at;
    patterns[norm].taskIds.push(task.id);
  }

  // Calculate average gap between completions
  for (const key of Object.keys(patterns)) {
    const p = patterns[key];
    if (p.count < 2) continue;
    const tasks = doneTasks
      .filter(t => normalizeTitle(t.title) === key)
      .map(t => new Date(t.completed_at!).getTime())
      .sort();
    
    let totalGap = 0;
    for (let i = 1; i < tasks.length; i++) {
      totalGap += (tasks[i] - tasks[i - 1]) / (1000 * 60 * 60 * 24);
    }
    p.avgGapDays = totalGap / (tasks.length - 1);
  }

  // Filter: 3+ completions, not already a habit
  const suggestions: HabitSuggestion[] = [];
  
  for (const [key, pattern] of Object.entries(patterns)) {
    if (pattern.count < 3) continue;
    if (existingTitles.has(key)) continue;
    
    // Determine frequency from gap
    let frequency: HabitSuggestion['frequency'] = 'daily';
    if (pattern.avgGapDays > 5) frequency = 'weekly';
    else if (pattern.avgGapDays > 2) frequency = '3x_week';
    else if (pattern.avgGapDays > 1.5) frequency = 'weekdays';
    
    // Find a representative task for context
    const sample = doneTasks.find(t => normalizeTitle(t.title) === key);
    
    suggestions.push({
      title: prettifyTitle(key),
      description: `You've completed "${prettifyTitle(key)}" ${pattern.count} times in the last 60 days. Make it official?`,
      icon: guessIcon(key),
      category: guessCategory(key),
      reason: `Completed ${pattern.count} times (avg every ${Math.round(pattern.avgGapDays)} days)`,
      sourceType: 'task_pattern',
      sourceId: sample?.goal_id || undefined,
      frequency,
      timeOfDay: guessTimeOfDay(key),
      confidence: Math.min(pattern.count / 10, 1),
      patternData: {
        taskCount: pattern.count,
        avgGapDays: Math.round(pattern.avgGapDays * 10) / 10,
        lastDone: pattern.lastDone,
      },
    });
  }
  
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════
// GOAL-ALIGNED HABITS — Suggest habits that support active goals
// ═══════════════════════════════════════════════════════════════

/**
 * Analyze user's goals and suggest habits that would support achievement.
 */
export async function suggestGoalHabits(userId: string): Promise<HabitSuggestion[]> {
  const { data: goals } = await supabase
    .from('goals')
    .select('id, title, description, domain, category, status')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .in('status', ['active', 'in_progress'])
    .in('category', ['epic', 'goal']);
  
  if (!goals?.length) return [];

  // Get existing habits to avoid duplicates
  const { data: existingHabits } = await supabase
    .from('habits')
    .select('title')
    .eq('user_id', userId)
    .eq('is_deleted', false);
  
  const existingTitles = new Set(
    (existingHabits || []).map(h => normalizeTitle(h.title))
  );

  const suggestions: HabitSuggestion[] = [];

  for (const goal of goals) {
    const title = (goal.title || '').toLowerCase();
    const domain = (goal.domain || '').toLowerCase();
    const desc = (goal.description || '').toLowerCase();
    const combined = `${title} ${domain} ${desc}`;
    
    // Health domain habits
    if (domain.includes('health') || domain.includes('fitness')) {
      addIfNew(suggestions, existingTitles, {
        title: 'Daily Exercise',
        description: `Supporting your goal: ${goal.title}`,
        icon: '💪', category: 'health', frequency: 'daily', timeOfDay: 'morning',
        reason: `Aligned with: ${goal.title}`,
        sourceType: 'goal', sourceId: goal.id, confidence: 0.8,
        durationMinutes: 30,
      });
      if (combined.includes('water') || combined.includes('hydrat')) {
        addIfNew(suggestions, existingTitles, {
          title: 'Drink 8 Glasses Water',
          description: 'Stay hydrated throughout the day',
          icon: '💧', category: 'health', frequency: 'daily', timeOfDay: 'anytime',
          reason: `Aligned with: ${goal.title}`,
          sourceType: 'goal', sourceId: goal.id, confidence: 0.7,
        });
      }
      if (combined.includes('sleep')) {
        addIfNew(suggestions, existingTitles, {
          title: 'Sleep by 10:30pm',
          description: 'Consistent bedtime for better recovery',
          icon: '😴', category: 'health', frequency: 'daily', timeOfDay: 'evening',
          reason: `Aligned with: ${goal.title}`,
          sourceType: 'goal', sourceId: goal.id, confidence: 0.8,
        });
      }
    }
    
    // Finance domain habits
    if (domain.includes('financ') || combined.includes('budget') || combined.includes('savings')) {
      addIfNew(suggestions, existingTitles, {
        title: 'Log Daily Expenses',
        description: 'Track every purchase to stay budget-aware',
        icon: '📊', category: 'finance', frequency: 'daily', timeOfDay: 'evening',
        reason: `Aligned with: ${goal.title}`,
        sourceType: 'goal', sourceId: goal.id, confidence: 0.8,
      });
      if (combined.includes('sav')) {
        addIfNew(suggestions, existingTitles, {
          title: 'No-Spend Check',
          description: 'Pause before any non-essential purchase',
          icon: '💰', category: 'finance', frequency: 'daily', timeOfDay: 'anytime',
          reason: `Aligned with: ${goal.title}`,
          sourceType: 'goal', sourceId: goal.id, confidence: 0.7,
        });
      }
    }
    
    // Education / Learning domain
    if (domain.includes('education') || domain.includes('learning') || combined.includes('learn') || combined.includes('study')) {
      addIfNew(suggestions, existingTitles, {
        title: 'Study Session',
        description: `Dedicated learning time for: ${goal.title}`,
        icon: '📚', category: 'learning', frequency: 'daily', timeOfDay: 'morning',
        reason: `Aligned with: ${goal.title}`,
        sourceType: 'goal', sourceId: goal.id, confidence: 0.8,
        durationMinutes: 45,
      });
    }
    
    // Business / Career domain
    if (domain.includes('career') || domain.includes('business') || combined.includes('grow') || combined.includes('revenue')) {
      addIfNew(suggestions, existingTitles, {
        title: 'Business Review',
        description: 'Review KPIs and progress on business goals',
        icon: '💼', category: 'productivity', frequency: 'weekly', timeOfDay: 'morning',
        reason: `Aligned with: ${goal.title}`,
        sourceType: 'goal', sourceId: goal.id, confidence: 0.7,
        durationMinutes: 30,
      });
    }

    // General productivity for any goal
    if (combined.includes('plan') || combined.includes('organiz') || combined.includes('productiv')) {
      addIfNew(suggestions, existingTitles, {
        title: 'Morning Planning',
        description: 'Review today\'s tasks and priorities',
        icon: '📋', category: 'productivity', frequency: 'weekdays', timeOfDay: 'morning',
        reason: `Aligned with: ${goal.title}`,
        sourceType: 'goal', sourceId: goal.id, confidence: 0.7,
        durationMinutes: 10,
      });
    }

    // Spiritual / Mindfulness
    if (domain.includes('spiritual') || combined.includes('meditat') || combined.includes('pray') || combined.includes('faith')) {
      addIfNew(suggestions, existingTitles, {
        title: 'Morning Prayer/Meditation',
        description: 'Start the day centered and grounded',
        icon: '🙏', category: 'lifestyle', frequency: 'daily', timeOfDay: 'morning',
        reason: `Aligned with: ${goal.title}`,
        sourceType: 'goal', sourceId: goal.id, confidence: 0.8,
        durationMinutes: 15,
      });
    }
  }
  
  return suggestions.slice(0, 8);
}

// ═══════════════════════════════════════════════════════════════
// HABIT IMPACT SCORING — Correlate habit completion with goal progress
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate how much each habit correlates with goal progress.
 * Higher score = the user tends to make more goal progress on days they do this habit.
 */
export async function calculateHabitImpact(userId: string): Promise<Record<string, number>> {
  const { data: habits } = await supabase
    .from('habits')
    .select('id, title')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .eq('is_active', true);
  
  if (!habits?.length) return {};

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().split('T')[0];
  
  const [{ data: logs }, { data: completedTasks }] = await Promise.all([
    supabase.from('habit_logs').select('habit_id, date')
      .in('habit_id', habits.map(h => h.id))
      .gte('date', cutoff),
    supabase.from('tasks').select('completed_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('status', 'done')
      .gte('completed_at', thirtyDaysAgo.toISOString()),
  ]);
  
  if (!logs?.length || !completedTasks?.length) return {};
  
  // Map: date → number of tasks completed
  const tasksByDate: Record<string, number> = {};
  for (const t of completedTasks) {
    const date = t.completed_at!.split('T')[0];
    tasksByDate[date] = (tasksByDate[date] || 0) + 1;
  }
  
  // For each habit: average tasks completed on habit-done days vs habit-skipped days
  const impact: Record<string, number> = {};
  
  for (const habit of habits) {
    const habitDates = new Set(
      (logs || []).filter(l => l.habit_id === habit.id).map(l => l.date)
    );
    
    let doneTaskAvg = 0, skipTaskAvg = 0;
    let doneDays = 0, skipDays = 0;
    
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const tasks = tasksByDate[ds] || 0;
      
      if (habitDates.has(ds)) {
        doneTaskAvg += tasks;
        doneDays++;
      } else {
        skipTaskAvg += tasks;
        skipDays++;
      }
    }
    
    doneTaskAvg = doneDays > 0 ? doneTaskAvg / doneDays : 0;
    skipTaskAvg = skipDays > 0 ? skipTaskAvg / skipDays : 0;
    
    // Impact = how much more productive on habit days (normalized 0-1)
    const diff = doneTaskAvg - skipTaskAvg;
    const maxPossible = Math.max(doneTaskAvg, skipTaskAvg, 1);
    impact[habit.id] = Math.max(0, Math.min(1, diff / maxPossible));
  }
  
  return impact;
}

// ═══════════════════════════════════════════════════════════════
// ACCEPT / DISMISS SUGGESTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Accept a habit suggestion — create the habit and mark suggestion as accepted.
 */
export async function acceptSuggestion(
  userId: string, suggestion: HabitSuggestion
): Promise<{ habitId: string | null; error: string | null }> {
  // Create the habit
  const { data: habit, error: habitErr } = await supabase.from('habits').insert({
    user_id: userId,
    title: suggestion.title,
    description: suggestion.description,
    icon: suggestion.icon,
    frequency: suggestion.frequency,
    target_count: 1,
    color: getCategoryColor(suggestion.category),
    is_active: true,
    streak_current: 0,
    streak_best: 0,
    source: 'suggested',
    category: suggestion.category,
    time_of_day: suggestion.timeOfDay,
    duration_minutes: suggestion.durationMinutes || null,
    goal_id: suggestion.sourceId || null,
  }).select('id').single();
  
  if (habitErr) return { habitId: null, error: habitErr.message };
  
  // Try to save to habit_suggestions table (may not exist yet)
  try {
    await supabase.from('habit_suggestions').insert({
      user_id: userId,
      title: suggestion.title,
      description: suggestion.description,
      icon: suggestion.icon,
      reason: suggestion.reason,
      source_type: suggestion.sourceType,
      source_id: suggestion.sourceId || null,
      pattern_data: suggestion.patternData || null,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    });
  } catch { /* table may not exist yet */ }
  
  return { habitId: habit?.id || null, error: null };
}

/**
 * Dismiss a suggestion (don't suggest it again).
 */
export async function dismissSuggestion(
  userId: string, suggestion: HabitSuggestion
): Promise<void> {
  try {
    await supabase.from('habit_suggestions').insert({
      user_id: userId,
      title: suggestion.title,
      reason: suggestion.reason,
      source_type: suggestion.sourceType,
      source_id: suggestion.sourceId || null,
      status: 'dismissed',
      dismissed_at: new Date().toISOString(),
    });
  } catch { /* graceful */ }
}

/**
 * Get all suggestions (both from patterns and goals), filtered against dismissed.
 */
export async function getAllSuggestions(userId: string): Promise<HabitSuggestion[]> {
  // Get dismissed suggestions to filter
  let dismissedTitles = new Set<string>();
  try {
    const { data } = await supabase
      .from('habit_suggestions')
      .select('title')
      .eq('user_id', userId)
      .eq('status', 'dismissed');
    dismissedTitles = new Set((data || []).map(d => normalizeTitle(d.title)));
  } catch { /* table may not exist */ }
  
  // Get suggestions from both engines
  const [patterns, goalHabits] = await Promise.all([
    detectTaskPatterns(userId),
    suggestGoalHabits(userId),
  ]);
  
  // Merge and deduplicate
  const all = [...patterns, ...goalHabits];
  const seen = new Set<string>();
  const unique: HabitSuggestion[] = [];
  
  for (const s of all) {
    const key = normalizeTitle(s.title);
    if (seen.has(key) || dismissedTitles.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }
  
  return unique.sort((a, b) => b.confidence - a.confidence).slice(0, 8);
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function normalizeTitle(t: string): string {
  return t.toLowerCase()
    .replace(/[🎯💪📚💰🧠🚀⚡🔥🎨🌍💼❤️📖🧘🏃💧📊📋✨💊😴🏦🥗🧹💻🔵]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function prettifyTitle(t: string): string {
  return t.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function guessIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('exercise') || t.includes('workout') || t.includes('gym') || t.includes('fitness')) return '💪';
  if (t.includes('read')) return '📖';
  if (t.includes('meditat') || t.includes('mindful')) return '🧘';
  if (t.includes('water') || t.includes('hydrat')) return '💧';
  if (t.includes('walk') || t.includes('run') || t.includes('jog')) return '🏃';
  if (t.includes('journal') || t.includes('write') || t.includes('diary')) return '📝';
  if (t.includes('pray') || t.includes('bible') || t.includes('spiritual')) return '🙏';
  if (t.includes('study') || t.includes('learn')) return '📚';
  if (t.includes('code') || t.includes('program') || t.includes('build')) return '💻';
  if (t.includes('sleep') || t.includes('bed')) return '😴';
  if (t.includes('budget') || t.includes('expense') || t.includes('money') || t.includes('finance')) return '💰';
  if (t.includes('clean')) return '🧹';
  if (t.includes('cook') || t.includes('meal') || t.includes('food')) return '🍳';
  if (t.includes('stretch') || t.includes('yoga')) return '🤸';
  if (t.includes('plan') || t.includes('review') || t.includes('organize')) return '📋';
  return '🔄';
}

function guessCategory(title: string): HabitSuggestion['category'] {
  const t = title.toLowerCase();
  if (t.includes('exercise') || t.includes('workout') || t.includes('gym') || t.includes('water') || t.includes('sleep') || t.includes('meditat') || t.includes('walk') || t.includes('run') || t.includes('yoga') || t.includes('stretch')) return 'health';
  if (t.includes('budget') || t.includes('expense') || t.includes('money') || t.includes('savings') || t.includes('invest') || t.includes('finance')) return 'finance';
  if (t.includes('study') || t.includes('learn') || t.includes('read') || t.includes('course')) return 'learning';
  if (t.includes('plan') || t.includes('review') || t.includes('organize') || t.includes('code') || t.includes('build') || t.includes('work')) return 'productivity';
  return 'lifestyle';
}

function guessTimeOfDay(title: string): HabitSuggestion['timeOfDay'] {
  const t = title.toLowerCase();
  if (t.includes('morning') || t.includes('wake') || t.includes('breakfast') || t.includes('prayer') || t.includes('bible')) return 'morning';
  if (t.includes('evening') || t.includes('night') || t.includes('bedtime') || t.includes('sleep') || t.includes('review') || t.includes('journal')) return 'evening';
  if (t.includes('lunch') || t.includes('afternoon')) return 'afternoon';
  return 'anytime';
}

function getCategoryColor(cat: string): string {
  switch (cat) {
    case 'health': return '#4ECB71';
    case 'finance': return '#FFD93D';
    case 'productivity': return '#00D4FF';
    case 'learning': return '#A855F7';
    case 'lifestyle': return '#F97316';
    default: return '#00D4FF';
  }
}

function addIfNew(
  suggestions: HabitSuggestion[],
  existingTitles: Set<string>,
  suggestion: HabitSuggestion
): void {
  const key = normalizeTitle(suggestion.title);
  if (existingTitles.has(key)) return;
  if (suggestions.some(s => normalizeTitle(s.title) === key)) return;
  existingTitles.add(key);
  suggestions.push(suggestion);
}
