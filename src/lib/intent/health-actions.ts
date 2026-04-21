/**
 * LifeOS Intent Engine — Health & Wellness Actions
 *
 * Handles health_log, meal_log, meditation_log, gratitude,
 * journal, log_workout, body_marker actions.
 */

import { supabase } from '../data-access';
import { logger } from '../../utils/logger';
import { genId } from '../../utils/date';
import { localInsert, localUpdate, localQuery } from '../local-db';
import type { IntentAction } from './types';
import { parseTimeToToday } from './shorthand-parser';

// ─── Companion Event Helper (local copy for decoupling) ─────────

async function createCompanionEvent(opts: {
  userId: string;
  title: string;
  color?: string;
  durationMin?: number;
  startTime?: string;
}) {
  try {
    const now = new Date();
    const dur = opts.durationMin || 60;
    let start: Date;
    if (opts.startTime) {
      start = opts.startTime.includes('T') ? new Date(opts.startTime) : parseTimeToToday(opts.startTime);
    } else {
      start = now;
    }
    const end = new Date(start.getTime() + dur * 60 * 1000);
    await supabase.from('schedule_events').insert({
      user_id: opts.userId, title: opts.title,
      start_time: start.toISOString(), end_time: end.toISOString(),
      color: opts.color || '#A855F7', is_deleted: false, sync_status: 'synced',
    });
  } catch (err) {
    logger.warn('Companion event creation failed:', err);
  }
}

// ─── Health Actions ──────────────────────────────────────────────

export async function executeHealthLog(
  data: Record<string, unknown>,
  action: IntentAction,
  successes: string[],
  failures: string[],
): Promise<void> {
  const healthUserId = data.user_id as string;
  const healthDate = (data.date as string) || new Date().toLocaleDateString('en-CA');

  // Build metrics object from action data
  const metrics: Record<string, unknown> = {};
  for (const k of ['weight_kg', 'mood_score', 'energy_score', 'sleep_hours', 'sleep_quality', 'water_glasses', 'notes']) {
    if (data[k] !== undefined && data[k] !== null) metrics[k] = data[k];
  }

  // ── Local-first: write via local DB so store can read it immediately ──
  try {
    const existingResults = await localQuery('health_metrics', 'date', healthDate);
    const existing = (existingResults as { user_id: string; id: string }[])
      .find(r => r.user_id === healthUserId);

    if (existing) {
      metrics.updated_at = new Date().toISOString();
      await localUpdate('health_metrics', existing.id, metrics);
    } else {
      await localInsert('health_metrics', {
        id: genId(),
        user_id: healthUserId,
        date: healthDate,
        ...metrics,
      });
    }

    // Invalidate health store so UI refreshes locally
    const { useHealthStore } = await import('../../stores/useHealthStore');
    useHealthStore.getState().invalidate();
  } catch (localErr) {
    logger.warn('[health_log] Local DB write failed, falling back to Supabase:', localErr);
    // ── Fallback: direct Supabase write ──
    const { data: existing } = await supabase.from('health_metrics')
      .select('id').eq('user_id', healthUserId).eq('date', healthDate).limit(1);
    if (existing?.length) {
      metrics.updated_at = new Date().toISOString();
      const { error: hErr } = await supabase.from('health_metrics').update(metrics).eq('id', existing[0].id);
      if (hErr) throw hErr;
    } else {
      metrics.user_id = healthUserId;
      metrics.date = healthDate;
      const { error: hErr } = await supabase.from('health_metrics').insert(metrics);
      if (hErr) throw hErr;
    }
  }

  successes.push(`💪 ${action.summary}`);
  const healthTitle = data.sleep_hours ? `😴 Sleep: ${data.sleep_hours}h` : `💪 Health check-in`;
  await createCompanionEvent({
    userId: healthUserId, title: healthTitle, color: '#F43F5E',
    durationMin: (data.sleep_hours as number) ? (data.sleep_hours as number) * 60 : undefined,
  });
}

export async function executeMealLog(
  data: Record<string, unknown>,
  action: IntentAction,
  successes: string[],
): Promise<void> {
  const { error: mlErr } = await supabase.from('meals').insert(data);
  if (mlErr) throw mlErr;
  successes.push(`🍽️ ${action.summary}`);
  const mealEmoji: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍿' };
  const mealType = (data.meal_type as string) || 'meal';
  await createCompanionEvent({
    userId: data.user_id as string,
    title: `${mealEmoji[mealType] || '🍽️'} ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}`,
    color: '#FDCB6E', durationMin: 30,
  });
}

export async function executeMeditationLog(
  data: Record<string, unknown>,
  action: IntentAction,
  successes: string[],
): Promise<void> {
  const { error: medErr } = await supabase.from('meditation_logs').insert(data);
  if (medErr) throw medErr;
  successes.push(`🧘 ${action.summary}`);
  await createCompanionEvent({
    userId: data.user_id as string, title: `🧘 Meditation`,
    color: '#A855F7', durationMin: (data.duration_min as number) || undefined,
  });
}

export async function executeGratitude(
  data: Record<string, unknown>,
  action: IntentAction,
  successes: string[],
): Promise<void> {
  const { error: grErr } = await supabase.from('gratitude_entries').insert(data);
  if (grErr) throw grErr;
  successes.push(`🙏 ${action.summary}`);
  await createCompanionEvent({
    userId: data.user_id as string, title: `🙏 Gratitude`,
    color: '#EC4899', durationMin: 15,
  });
}

export async function executeJournal(
  data: Record<string, unknown>,
  action: IntentAction,
  successes: string[],
): Promise<void> {
  // ── Local-first: write through useJournalStore so UI updates immediately ──
  try {
    const { useJournalStore } = await import('../../stores/useJournalStore');
    const entry = await useJournalStore.getState().addEntry({
      date: (data.date as string) || new Date().toISOString().split('T')[0],
      title: (data.title as string) || '',
      content: (data.content as string) || '',
      mood: data.mood as number | undefined,
      energy: data.energy as number | undefined,
      tags: data.tags as string | undefined,
      user_id: data.user_id as string,
    });
    if (!entry) throw new Error('Journal addEntry returned null');
  } catch (storeErr) {
    logger.warn('[journal] Store write failed, falling back to Supabase:', storeErr);
    const { error: jErr } = await supabase.from('journal_entries').insert(data);
    if (jErr) throw jErr;
  }
  successes.push(`📖 ${action.summary}`);
  await createCompanionEvent({
    userId: data.user_id as string, title: `📖 Journal`,
    color: '#EC4899', durationMin: 30,
  });
}

export async function executeLogWorkout(
  data: Record<string, unknown>,
  action: IntentAction,
  successes: string[],
): Promise<void> {
  const wData: Record<string, unknown> = { ...data };
  wData.started_at = new Date().toISOString();
  if (wData.completed) wData.completed_at = new Date().toISOString();
  const { error: wErr } = await supabase.from('exercise_logs').insert(wData);
  if (wErr) throw wErr;
  successes.push(`🏋️ ${action.summary}`);
  await createCompanionEvent({
    userId: data.user_id as string, title: `🏋️ Workout`,
    color: '#39FF14', durationMin: (data.duration_min as number) || 45,
  });
}

export async function executeBodyMarker(
  data: Record<string, unknown>,
  action: IntentAction,
  successes: string[],
): Promise<void> {
  const { error: bmErr } = await supabase.from('body_markers').insert(data);
  if (bmErr) throw bmErr;
  successes.push(`🩹 ${action.summary}`);
}