/**
 * AI Reschedule Logic
 *
 * Builds context of overdue items + current schedule, asks LLM for suggested
 * new dates, returns structured reschedule suggestions.
 *
 * Uses the LLM proxy (server-side, rate-limited) so API keys stay safe.
 */

import { callLLMJson } from '../llm-proxy';
import { supabase } from '../supabase';
import { localUpdate } from '../local-db';
import { localDateStr } from '../../utils/date';
import type { OverdueTask, MissedEvent } from '../../hooks/useOverdueItems';
import { logger } from '../../utils/logger';

export interface RescheduleSuggestion {
  itemId: string;
  itemType: 'task' | 'event';
  itemTitle: string;
  originalDate: string;
  suggestedDate: string;
  suggestedTime?: string;
  reason: string;
}

export interface RescheduleResult {
  suggestions: RescheduleSuggestion[];
  summary: string;
  error?: string;
}

/**
 * Ask the AI to suggest new dates for overdue tasks and missed events.
 * Considers the user's current schedule to find free slots.
 */
export async function getAIRescheduleSuggestions(
  userId: string,
  overdueTasks: OverdueTask[],
  missedEvents: MissedEvent[],
): Promise<RescheduleResult> {
  if (overdueTasks.length === 0 && missedEvents.length === 0) {
    return { suggestions: [], summary: 'No overdue items to reschedule.' };
  }

  const today = localDateStr();

  // Fetch the user's upcoming schedule (next 14 days) for context
  const fourteenDaysOut = new Date();
  fourteenDaysOut.setDate(fourteenDaysOut.getDate() + 14);

  // Also fetch tasks that were recently rescheduled (due_date changed in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [eventsRes, tasksRes, recentlyRescheduledRes] = await Promise.all([
    supabase
      .from('schedule_events')
      .select('title, start_time, end_time')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('start_time', new Date().toISOString())
      .lte('start_time', fourteenDaysOut.toISOString())
      .order('start_time')
      .limit(30),
    supabase
      .from('tasks')
      .select('title, due_date, priority')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .neq('status', 'done')
      .gte('due_date', today)
      .lte('due_date', localDateStr(fourteenDaysOut))
      .order('due_date')
      .limit(30),
    supabase
      .from('tasks')
      .select('title, due_date, updated_at, created_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('updated_at', thirtyDaysAgo.toISOString())
      .order('updated_at', { ascending: false })
      .limit(20),
  ]);

  const upcomingEvents = (eventsRes.data || []).map((e: any) =>
    `• ${e.title} — ${new Date(e.start_time).toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })} ${new Date(e.start_time).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}${e.end_time ? ` to ${new Date(e.end_time).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}` : ''}`
  ).join('\n');

  const upcomingTasks = (tasksRes.data || []).map((t: any) =>
    `• [${t.priority}] ${t.title} — due ${t.due_date}`
  ).join('\n');

  // Build overdue items list
  const overdueTasksList = overdueTasks.map(t =>
    `• TASK id="${t.id}": "${t.title}" [${t.priority}] — was due ${t.due_date} (${t.daysOverdue} days overdue)`
  ).join('\n');

  const missedEventsList = missedEvents.map(e =>
    `• EVENT id="${e.id}": "${e.title}" — was scheduled ${new Date(e.start_time).toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })} (${e.daysMissed} days ago)`
  ).join('\n');

  // Build reschedule history — tasks where updated_at significantly differs from created_at
  const rescheduledTasks = (recentlyRescheduledRes.data || []).filter((t: any) => {
    if (!t.updated_at || !t.created_at) return false;
    const updated = new Date(t.updated_at).getTime();
    const created = new Date(t.created_at).getTime();
    return (updated - created) > 86400000; // updated > 1 day after creation
  });
  const rescheduleHistory = rescheduledTasks.length > 0
    ? rescheduledTasks.map((t: any) => `• "${t.title}" — due ${t.due_date}, last updated ${new Date(t.updated_at).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}`).join('\n')
    : '';

  const prompt = `You are LifeOS, helping a user reschedule their overdue tasks and missed events.

Today: ${today} (${new Date().toLocaleDateString('en-AU', { weekday: 'long' })})

## OVERDUE TASKS
${overdueTasksList || '(none)'}

## MISSED EVENTS
${missedEventsList || '(none)'}

## USER'S UPCOMING SCHEDULE (next 14 days)
Events:
${upcomingEvents || '(no events scheduled)'}

Tasks already due:
${upcomingTasks || '(no upcoming tasks)'}

${rescheduleHistory ? `## RECENTLY RESCHEDULED (last 30 days)
These tasks have already been rescheduled before — consider giving them realistic, closer dates:
${rescheduleHistory}

` : ''}## YOUR JOB
Suggest new dates for each overdue item. Rules:
1. Spread items across the next 7-10 days — don't stack everything on one day
2. Avoid days that already look busy (check upcoming schedule)
3. Higher priority tasks should be scheduled sooner
4. Consider realistic workload — max 3-4 rescheduled items per day
5. Events should be rescheduled to similar days/times as original if possible
6. Give a brief, friendly reason for each suggestion
7. All dates must be YYYY-MM-DD format, in the future (>= today)

Return JSON:
{
  "suggestions": [
    {
      "itemId": "the id",
      "itemType": "task" or "event",
      "itemTitle": "the title",
      "originalDate": "YYYY-MM-DD",
      "suggestedDate": "YYYY-MM-DD",
      "suggestedTime": "HH:MM or null",
      "reason": "brief explanation"
    }
  ],
  "summary": "A friendly 1-2 sentence summary of the reschedule plan"
}`;

  try {
    const result = await callLLMJson<RescheduleResult>(prompt, {
      timeoutMs: 25000,
    });

    // Validate suggestions
    const validSuggestions = (result.suggestions || []).filter(s =>
      s.itemId && s.suggestedDate && s.suggestedDate >= today
    );

    return {
      suggestions: validSuggestions,
      summary: result.summary || `Suggested new dates for ${validSuggestions.length} items.`,
    };
  } catch (err: any) {
    logger.error('[reschedule] AI suggestion failed:', err);
    return {
      suggestions: [],
      summary: '',
      error: err?.message || 'Failed to get AI suggestions. Try again later.',
    };
  }
}

/**
 * Apply a single reschedule suggestion — update the task or event in Supabase.
 */
export async function applyReschedule(
  suggestion: RescheduleSuggestion,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (suggestion.itemType === 'task') {
      const updateData = {
        due_date: suggestion.suggestedDate,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', suggestion.itemId);

      if (error) return { success: false, error: error.message };

      // Also update local IndexedDB so the store reads the new date immediately
      await localUpdate('tasks', suggestion.itemId, updateData).catch(err => {
        logger.warn('[reschedule] Local DB update failed (non-fatal):', err);
      });
    } else if (suggestion.itemType === 'event') {
      // For events, we need to shift start_time and end_time
      const { data: event } = await supabase
        .from('schedule_events')
        .select('start_time, end_time')
        .eq('id', suggestion.itemId)
        .single();

      if (!event) return { success: false, error: 'Event not found' };

      const originalStart = new Date(event.start_time);
      const newStart = new Date(suggestion.suggestedDate + 'T' + (suggestion.suggestedTime || originalStart.toTimeString().slice(0, 5)) + ':00');

      let newEnd: Date | null = null;
      if (event.end_time) {
        const originalEnd = new Date(event.end_time);
        const durationMs = originalEnd.getTime() - originalStart.getTime();
        newEnd = new Date(newStart.getTime() + durationMs);
      }

      const updateData: any = {
        start_time: newStart.toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (newEnd) updateData.end_time = newEnd.toISOString();

      const { error } = await supabase
        .from('schedule_events')
        .update(updateData)
        .eq('id', suggestion.itemId);

      if (error) return { success: false, error: error.message };

      // Also update local IndexedDB
      await localUpdate('events', suggestion.itemId, updateData).catch(err => {
        logger.warn('[reschedule] Local DB update failed (non-fatal):', err);
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unknown error' };
  }
}

/**
 * Apply all reschedule suggestions at once.
 */
export async function applyAllReschedules(
  suggestions: RescheduleSuggestion[],
): Promise<{ successCount: number; failCount: number; errors: string[] }> {
  const results = await Promise.all(suggestions.map(applyReschedule));

  const errors: string[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const r of results) {
    if (r.success) successCount++;
    else {
      failCount++;
      if (r.error) errors.push(r.error);
    }
  }

  return { successCount, failCount, errors };
}
