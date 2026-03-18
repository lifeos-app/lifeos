/**
 * LifeOS Orchestrator — The Unified AI Brain
 *
 * Connects the AI chat widget to ALL AI engines in LifeOS.
 * Each "tool" wraps one of the 7 AI engines + the balance engine,
 * returning structured data that the chat can render as rich cards.
 *
 * The orchestrator is invoked by the intent engine when the LLM detects
 * a tool-use intent (e.g., "how are my goals?", "give me a workout").
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { analyzeGoalCoach, type GoalCoachResult } from './goal-coach';
import { generateWeeklyInsights, type WeeklyInsightsData } from './weekly-insights';
import { generateMealSuggestions, type MealSuggestionsResult } from './meal-suggestions';
import { generateAIWorkout, type GeneratedWorkout, type WorkoutRequest } from './workout-ai';
import { runAIOptimization, detectGaps, detectConflicts, type OptimizerResult } from './schedule-optimizer';
import { generateMorningBrief, type LLMMorningBrief } from './morning-brief';
import { getAIRescheduleSuggestions, type RescheduleResult } from './reschedule';
import { getBalanceStatus, formatBalanceForLLM, type BalanceStatus } from './balance-engine';
import { localDateStr } from '../../utils/date';

// ── Tool Types ─────────────────────────────────────────────────────────────────

export type OrchestratorToolName =
  | 'analyze_goals'
  | 'weekly_insights'
  | 'meal_suggestions'
  | 'generate_workout'
  | 'optimize_schedule'
  | 'morning_brief'
  | 'reschedule_overdue'
  | 'check_balance';

export interface OrchestratorToolResult {
  tool: OrchestratorToolName;
  success: boolean;
  /** Structured data — the chat can render this as a rich card */
  data: unknown;
  /** Human-readable summary for the LLM to weave into its reply */
  summary: string;
  /** Error message if something went wrong */
  error?: string;
}

// ── Tool Definitions (for system prompt injection) ─────────────────────────────

export interface ToolDefinition {
  name: OrchestratorToolName;
  description: string;
  triggerPhrases: string[];
  parameters?: Record<string, string>;
}

export const ORCHESTRATOR_TOOLS: ToolDefinition[] = [
  {
    name: 'analyze_goals',
    description: 'Analyze all active goals — find neglected goals, goals behind schedule, and suggest next actions. Returns goal coaching insights.',
    triggerPhrases: [
      'how are my goals', 'analyze my goals', 'goal progress', 'which goals need attention',
      'am I on track', 'goals status', 'goal coach', 'neglected goals',
    ],
  },
  {
    name: 'weekly_insights',
    description: 'Generate a comprehensive weekly review — task completion rate, habit streaks, time allocation, financial summary, and AI narrative.',
    triggerPhrases: [
      'how was my week', 'weekly review', 'weekly insights', 'this week summary',
      'week in review', 'weekly report', 'what did I accomplish',
    ],
  },
  {
    name: 'meal_suggestions',
    description: 'Get personalized meal suggestions based on recent nutrition, health metrics, and diet preferences.',
    triggerPhrases: [
      'what should I eat', 'meal suggestions', 'suggest meals', 'food ideas',
      'what to cook', 'nutrition advice', 'meal plan', 'healthy meal',
    ],
  },
  {
    name: 'generate_workout',
    description: 'Generate a personalized workout plan based on fitness level, goals, equipment, and recent workout history.',
    triggerPhrases: [
      'give me a workout', 'generate workout', 'workout plan', 'exercise routine',
      'what should I train', 'gym session', 'create workout', 'training plan',
    ],
    parameters: {
      goal: 'lose_weight | build_muscle | stay_fit | flexibility | endurance (optional)',
      workoutType: 'cardio | strength | hiit | mixed | flexibility (optional)',
      durationMin: 'number (optional, default 45)',
    },
  },
  {
    name: 'optimize_schedule',
    description: 'Analyze today\'s schedule — find gaps, detect conflicts, suggest how to fill free time with habits/tasks/goals.',
    triggerPhrases: [
      'optimize my schedule', 'optimize my tomorrow', 'schedule suggestions', 'fill my gaps',
      'what should I do today', 'time management', 'schedule analysis', 'free time',
    ],
  },
  {
    name: 'morning_brief',
    description: 'Generate a full morning briefing — today\'s schedule, active quests, streak status, partner updates, finance summary, and AI focus suggestion.',
    triggerPhrases: [
      'good morning', 'morning brief', 'morning briefing', 'what\'s my day',
      'start my day', 'daily brief', 'today\'s plan',
    ],
  },
  {
    name: 'reschedule_overdue',
    description: 'Find all overdue tasks and missed events, then suggest smart new dates based on schedule availability.',
    triggerPhrases: [
      'reschedule overdue', 'overdue tasks', 'what did I miss', 'catch up',
      'reschedule my tasks', 'missed deadlines', 'behind schedule',
    ],
  },
  {
    name: 'check_balance',
    description: 'Check life balance across 6 domains (Physical, Mental, Spiritual, Financial, Social, Creative). Shows where you\'re thriving and where you need attention.',
    triggerPhrases: [
      'am I balanced', 'life balance', 'where should I focus', 'balance check',
      'which areas need work', 'domain balance', 'what am I neglecting',
      'balance score', 'how balanced am I',
    ],
  },
];

// ── Cache Layer ────────────────────────────────────────────────────────────────

const ORCH_CACHE_PREFIX = 'lifeos_orch_';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function getCachedResult(tool: string, userId: string): OrchestratorToolResult | null {
  try {
    const key = `${ORCH_CACHE_PREFIX}${tool}_${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { ts: number; result: OrchestratorToolResult };
    if (Date.now() - cached.ts > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return cached.result;
  } catch {
    return null;
  }
}

function setCachedResult(tool: string, userId: string, result: OrchestratorToolResult) {
  try {
    const key = `${ORCH_CACHE_PREFIX}${tool}_${userId}`;
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), result }));
  } catch { /* ignore */ }
}

export function clearOrchestratorCache() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(ORCH_CACHE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

// ── Tool Executors ─────────────────────────────────────────────────────────────

async function executeAnalyzeGoals(
  userId: string,
  supabase: SupabaseClient,
  tier: 'free' | 'pro',
): Promise<OrchestratorToolResult> {
  try {
    const result: GoalCoachResult = await analyzeGoalCoach(userId, supabase, tier);

    const urgent = result.insights.filter(i => i.status === 'neglected' || i.status === 'behind');
    const onTrack = result.insights.filter(i => i.status === 'on_track' || i.status === 'ahead');

    let summary = `Goal Analysis: ${result.summary}. `;
    if (urgent.length > 0) {
      summary += `${urgent.length} goal(s) need attention: ${urgent.map(i => `"${i.goalTitle}" (${i.status})`).join(', ')}. `;
    }
    if (onTrack.length > 0) {
      summary += `${onTrack.length} goal(s) on track. `;
    }
    summary += result.insights.slice(0, 3).map(i => `${i.goalIcon} "${i.goalTitle}": ${i.nudge}`).join(' | ');

    return { tool: 'analyze_goals', success: true, data: result, summary };
  } catch (err) {
    return { tool: 'analyze_goals', success: false, data: null, summary: 'Failed to analyze goals.', error: String(err) };
  }
}

async function executeWeeklyInsights(
  userId: string,
): Promise<OrchestratorToolResult> {
  try {
    // Calculate this week's range (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const result: WeeklyInsightsData = await generateWeeklyInsights(
      userId,
      localDateStr(weekStart),
      localDateStr(weekEnd),
      { includeAINarrative: true },
    );

    let summary = `Weekly Insights (${result.weekLabel}): `;
    summary += `Tasks: ${result.taskCompletion.completed}/${result.taskCompletion.total} (${result.taskCompletion.rate}% completion). `;
    summary += `Habit rate: ${result.habitStreaks.overallRate}%. `;
    if (result.financeSummary) {
      summary += `Finances: $${result.financeSummary.income} in, $${result.financeSummary.expenses} out. `;
    }
    if (result.productiveDay) {
      summary += `Most productive: ${result.productiveDay.day}. `;
    }
    if (result.aiNarrative) {
      summary += result.aiNarrative;
    }

    return { tool: 'weekly_insights', success: true, data: result, summary };
  } catch (err) {
    return { tool: 'weekly_insights', success: false, data: null, summary: 'Failed to generate weekly insights.', error: String(err) };
  }
}

async function executeMealSuggestions(
  userId: string,
): Promise<OrchestratorToolResult> {
  try {
    const result: MealSuggestionsResult = await generateMealSuggestions();

    let summary = `Meal Suggestions: ${result.summary}. `;
    summary += result.suggestions.slice(0, 3).map(s =>
      `${s.emoji} ${s.name} (${s.meal_type}, ${s.calories} cal, ${s.prep_time_min}min prep)`
    ).join(' | ');
    if (result.nutrient_gaps.length > 0) {
      summary += ` Nutrient gaps: ${result.nutrient_gaps.join(', ')}.`;
    }

    return { tool: 'meal_suggestions', success: true, data: result, summary };
  } catch (err) {
    return { tool: 'meal_suggestions', success: false, data: null, summary: 'Failed to generate meal suggestions.', error: String(err) };
  }
}

async function executeGenerateWorkout(
  params?: Partial<WorkoutRequest>,
): Promise<OrchestratorToolResult> {
  try {
    const request: WorkoutRequest = {
      goal: params?.goal || 'stay_fit',
      workoutType: params?.workoutType || 'mixed',
      durationMin: params?.durationMin || 45,
      equipment: params?.equipment || ['none'],
      fitnessLevel: params?.fitnessLevel || 'intermediate',
    };

    const result: GeneratedWorkout = await generateAIWorkout(request);

    let summary = `Workout: ${result.name} — ${result.description}. `;
    summary += `${result.exercises.length} exercises, ~${result.estimated_duration_min}min, ${result.difficulty} difficulty. `;
    summary += `Muscle groups: ${result.muscle_groups_targeted.join(', ')}. `;
    summary += 'Exercises: ' + result.exercises.slice(0, 4).map(e =>
      `${e.name} (${e.sets}×${e.reps})`
    ).join(', ');

    return { tool: 'generate_workout', success: true, data: result, summary };
  } catch (err) {
    return { tool: 'generate_workout', success: false, data: null, summary: 'Failed to generate workout.', error: String(err) };
  }
}

async function executeOptimizeSchedule(
  userId: string,
  supabase: SupabaseClient,
): Promise<OrchestratorToolResult> {
  try {
    const today = localDateStr();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = localDateStr(tomorrow);

    // Determine which day to optimize (today if before 6pm, otherwise tomorrow)
    const hour = new Date().getHours();
    const targetDate = hour < 18 ? today : tomorrowStr;

    // Fetch events for the target day
    const [eventsRes, weekEventsRes, goalsRes, habitsRes, tasksRes, habitLogsRes] = await Promise.all([
      supabase.from('schedule_events')
        .select('id, title, start_time, end_time, event_type, schedule_layer')
        .eq('user_id', userId).eq('is_deleted', false)
        .gte('start_time', `${targetDate}T00:00:00`)
        .lte('start_time', `${targetDate}T23:59:59`)
        .order('start_time'),
      supabase.from('schedule_events')
        .select('title, start_time, end_time, event_type')
        .eq('user_id', userId).eq('is_deleted', false)
        .gte('start_time', new Date().toISOString())
        .lte('start_time', new Date(Date.now() + 7 * 86400000).toISOString())
        .order('start_time'),
      supabase.from('goals')
        .select('id, title, category, priority, icon, color, domain')
        .eq('user_id', userId).eq('is_deleted', false).eq('status', 'active'),
      supabase.from('habits')
        .select('id, title, icon')
        .eq('user_id', userId).eq('is_active', true).eq('is_deleted', false),
      supabase.from('tasks')
        .select('id, title, priority, due_date, goal_id')
        .eq('user_id', userId).eq('is_deleted', false).neq('status', 'done')
        .lte('due_date', tomorrowStr).order('priority'),
      supabase.from('habit_logs')
        .select('habit_id')
        .eq('user_id', userId).eq('date', targetDate),
    ]);

    const events = (eventsRes.data || []) as { id: string; title: string; start_time: string; end_time: string; event_type: string; schedule_layer?: string }[];
    const loggedHabitIds = new Set((habitLogsRes.data || []).map((l: { habit_id: string }) => l.habit_id));

    const gaps = detectGaps(events, targetDate);
    const conflicts = detectConflicts(events);

    const result = await runAIOptimization({
      date: targetDate,
      events,
      weekEvents: (weekEventsRes.data || []) as { title: string; start_time: string; end_time: string; event_type: string }[],
      goals: (goalsRes.data || []) as { id: string; title: string; category: string; priority: string; icon?: string; color?: string; domain?: string }[],
      habits: ((habitsRes.data || []) as { id: string; title: string; icon?: string }[]).map(h => ({
        ...h,
        completedToday: loggedHabitIds.has(h.id),
      })),
      tasks: ((tasksRes.data || []) as { id: string; title: string; priority: string; due_date?: string; goal_id?: string }[]).map(t => ({
        ...t,
        dueDate: t.due_date,
        goalId: t.goal_id,
      })),
      gaps,
      conflicts,
      sacredBlockMinutes: [],
    } as any);

    let summary = `Schedule Analysis for ${targetDate}: ${result.summary}. `;
    summary += `${gaps.length} free slot(s), ${conflicts.length} conflict(s), ${result.suggestions.length} suggestion(s). `;
    if (result.suggestions.length > 0) {
      summary += 'Top suggestions: ' + result.suggestions.slice(0, 3).map(s =>
        `${s.icon} ${s.title}`
      ).join(', ');
    }

    return { tool: 'optimize_schedule', success: true, data: result, summary };
  } catch (err) {
    return { tool: 'optimize_schedule', success: false, data: null, summary: 'Failed to optimize schedule.', error: String(err) };
  }
}

async function executeMorningBrief(
  userId: string,
  supabase: SupabaseClient,
): Promise<OrchestratorToolResult> {
  try {
    const result: LLMMorningBrief = await generateMorningBrief(userId, supabase);

    let summary = `${result.greeting} ${result.date}. `;
    summary += `📋 ${result.stats.tasksToday} tasks, ${result.stats.habitsNotLogged} habits remaining, ${result.stats.upcomingEvents} events. `;
    summary += `🔥 ${result.streakStatus.days}d streak (${result.streakStatus.label}). `;
    if (result.financeSummary) {
      summary += `💰 Week: +$${result.financeSummary.income} / -$${result.financeSummary.expenses}. `;
    }
    summary += `⚡ ${result.xpToday} XP today. `;
    summary += `🎯 Focus: ${result.suggestedFocus}. `;
    summary += result.motivationalNote;

    return { tool: 'morning_brief', success: true, data: result, summary };
  } catch (err) {
    return { tool: 'morning_brief', success: false, data: null, summary: 'Failed to generate morning brief.', error: String(err) };
  }
}

async function executeRescheduleOverdue(
  userId: string,
): Promise<OrchestratorToolResult> {
  try {
    // We need to import the overdue items hook logic inline since
    // the reschedule function expects OverdueTask[] and MissedEvent[]
    const { supabase } = await import('../supabase');
    const today = localDateStr();

    const [overdueTasksRes, missedEventsRes] = await Promise.all([
      supabase.from('tasks')
        .select('id, title, due_date, priority, status')
        .eq('user_id', userId).eq('is_deleted', false)
        .neq('status', 'done')
        .lt('due_date', today)
        .order('due_date'),
      supabase.from('schedule_events')
        .select('id, title, start_time, end_time')
        .eq('user_id', userId).eq('is_deleted', false)
        .lt('end_time', new Date().toISOString())
        .gte('start_time', new Date(Date.now() - 14 * 86400000).toISOString())
        .order('start_time'),
    ]);

    const overdueTasks = (overdueTasksRes.data || []).map((t: any) => ({
      ...t,
      daysOverdue: Math.floor((Date.now() - new Date(t.due_date + 'T00:00:00').getTime()) / 86400000),
    }));

    const missedEvents = (missedEventsRes.data || []).map((e: any) => ({
      ...e,
      daysMissed: Math.floor((Date.now() - new Date(e.start_time).getTime()) / 86400000),
    }));

    const result: RescheduleResult = await getAIRescheduleSuggestions(
      userId,
      overdueTasks,
      missedEvents,
    );

    let summary = result.summary || '';
    if (result.suggestions.length > 0) {
      summary += ' Suggested reschedules: ' + result.suggestions.slice(0, 3).map(s =>
        `"${s.itemTitle}" → ${s.suggestedDate}`
      ).join(', ');
    } else {
      summary = 'No overdue items found — you\'re all caught up! 🎉';
    }

    return { tool: 'reschedule_overdue', success: true, data: result, summary };
  } catch (err) {
    return { tool: 'reschedule_overdue', success: false, data: null, summary: 'Failed to analyze overdue items.', error: String(err) };
  }
}

async function executeCheckBalance(
  userId: string,
  supabase: SupabaseClient,
): Promise<OrchestratorToolResult> {
  try {
    const status: BalanceStatus = await getBalanceStatus(userId, supabase);
    const summary = formatBalanceForLLM(status);

    return { tool: 'check_balance', success: true, data: status, summary };
  } catch (err) {
    return { tool: 'check_balance', success: false, data: null, summary: 'Failed to check balance.', error: String(err) };
  }
}

// ── Main Dispatch ──────────────────────────────────────────────────────────────

/**
 * Execute an orchestrator tool by name.
 * Returns structured data + a summary for the LLM.
 */
export async function executeTool(
  toolName: OrchestratorToolName,
  userId: string,
  supabase: SupabaseClient,
  tier: 'free' | 'pro' = 'pro',
  params?: Record<string, unknown>,
): Promise<OrchestratorToolResult> {
  // Check cache (except for morning_brief which should be fresh)
  if (toolName !== 'morning_brief') {
    const cached = getCachedResult(toolName, userId);
    if (cached) return cached;
  }

  let result: OrchestratorToolResult;

  switch (toolName) {
    case 'analyze_goals':
      result = await executeAnalyzeGoals(userId, supabase, tier);
      break;
    case 'weekly_insights':
      result = await executeWeeklyInsights(userId);
      break;
    case 'meal_suggestions':
      result = await executeMealSuggestions(userId);
      break;
    case 'generate_workout':
      result = await executeGenerateWorkout(params as Partial<WorkoutRequest> | undefined);
      break;
    case 'optimize_schedule':
      result = await executeOptimizeSchedule(userId, supabase);
      break;
    case 'morning_brief':
      result = await executeMorningBrief(userId, supabase);
      break;
    case 'reschedule_overdue':
      result = await executeRescheduleOverdue(userId);
      break;
    case 'check_balance':
      result = await executeCheckBalance(userId, supabase);
      break;
    default:
      result = { tool: toolName, success: false, data: null, summary: `Unknown tool: ${toolName}` };
  }

  // Cache successful results
  if (result.success && toolName !== 'morning_brief') {
    setCachedResult(toolName, userId, result);
  }

  return result;
}

/**
 * Build the tool description block for the system prompt.
 * This tells the LLM what orchestrator tools are available.
 */
export function buildToolPromptBlock(): string {
  const lines = [
    '## AI BRAIN TOOLS (Orchestrator)',
    'You have access to powerful analysis tools. When the user asks about these topics, respond with the appropriate tool invocation.',
    'To invoke a tool, include this JSON block in your response actions:',
    '{ "type": "orchestrator_tool", "data": { "tool": "<tool_name>", "params": {} }, "summary": "...", "confidence": 0.95 }',
    '',
    'Available tools:',
  ];

  for (const tool of ORCHESTRATOR_TOOLS) {
    lines.push(`### ${tool.name}`);
    lines.push(`  Description: ${tool.description}`);
    lines.push(`  Triggers: "${tool.triggerPhrases.slice(0, 4).join('", "')}"`);
    if (tool.parameters) {
      lines.push(`  Parameters: ${JSON.stringify(tool.parameters)}`);
    }
    lines.push('');
  }

  lines.push('IMPORTANT: Only use these tools when the user specifically asks about these topics. For general chat, just respond normally with type "info".');
  lines.push('When using a tool, your "reply" should acknowledge that you\'re running the analysis. The tool results will be provided to you for summarization.');

  return lines.join('\n');
}

/**
 * Detect if a user message should trigger an orchestrator tool.
 * Returns the tool name if a match is found, null otherwise.
 * This is used as a fast check before/alongside the LLM call.
 */
export function detectToolIntent(message: string): OrchestratorToolName | null {
  const lower = message.toLowerCase().trim();

  for (const tool of ORCHESTRATOR_TOOLS) {
    for (const phrase of tool.triggerPhrases) {
      if (lower.includes(phrase)) {
        return tool.name;
      }
    }
  }

  return null;
}
