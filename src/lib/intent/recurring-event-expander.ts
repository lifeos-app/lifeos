/**
 * LifeOS Intent Engine — Recurring Event Expander
 *
 * Expands a recurring_event pattern into individual schedule_event rows
 * and batch-inserts them into Supabase.
 */

import { supabase } from '../data-access';

const DAY_CODES = ['SU','MO','TU','WE','TH','FR','SA'] as const;

export async function executeRecurringEvent(
  data: Record<string, unknown>,
  successes: string[],
  failures: string[],
): Promise<void> {
  const recData = data as Record<string, any>;
  const recUserId = recData.user_id as string;
  const recTitle = recData.title as string || 'Event';
  const recDesc = recData.description as string | null;
  const recDays = recData.days_of_week as number[] || [];
  const recTime = recData.time as string || '09:00'; // HH:MM
  const recDuration = (recData.duration_minutes as number) || 60;
  const recUntil = recData.until_date as string;
  const recLocation = recData.location as string | null;
  const recColor = recData.color as string || '#00D4FF';
  const recLabel = recData.recurrence_label as string || '';

  if (recDays.length === 0) {
    failures.push(`❌ Recurring event "${recTitle}": no days specified`);
    return;
  }

  // Parse time
  const [hours, minutes] = recTime.split(':').map(Number);

  // Calculate end date (default 12 weeks if not specified)
  const today = new Date();
  const untilDate = recUntil
    ? new Date(recUntil + 'T23:59:59')
    : new Date(today.getTime() + 12 * 7 * 24 * 60 * 60 * 1000);

  // Generate all occurrences
  const eventRows: Record<string, unknown>[] = [];
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);

  // Start from tomorrow if today's time has passed
  const nowTime = today.getHours() * 60 + today.getMinutes();
  const eventTime = hours * 60 + minutes;
  if (nowTime >= eventTime) {
    cursor.setDate(cursor.getDate() + 1);
  }

  while (cursor <= untilDate) {
    const dayOfWeek = cursor.getDay(); // 0=Sun
    if (recDays.includes(dayOfWeek)) {
      const startDt = new Date(cursor);
      startDt.setHours(hours, minutes, 0, 0);
      const endDt = new Date(startDt.getTime() + recDuration * 60 * 1000);

      eventRows.push({
        user_id: recUserId,
        title: recTitle,
        description: recLabel ? `[recurring] ${recLabel}${recDesc ? '\n' + recDesc : ''}` : recDesc,
        start_time: startDt.toISOString(),
        end_time: endDt.toISOString(),
        location: recLocation,
        color: recColor,
        is_deleted: false,
        sync_status: 'synced',
        recurrence_rule: `FREQ=WEEKLY;BYDAY=${recDays.map(d => DAY_CODES[d]).join(',')}`,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (eventRows.length === 0) {
    failures.push(`❌ Recurring event "${recTitle}": no occurrences generated`);
    return;
  }

  // Batch insert (Supabase supports bulk inserts)
  const BATCH_SIZE = 50;
  let inserted = 0;
  for (let i = 0; i < eventRows.length; i += BATCH_SIZE) {
    const batch = eventRows.slice(i, i + BATCH_SIZE);
    const { error: batchErr } = await supabase.from('schedule_events').insert(batch);
    if (batchErr) {
      failures.push(`❌ Failed to insert batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchErr.message}`);
    } else {
      inserted += batch.length;
    }
  }

  if (inserted > 0) {
    successes.push(`📅 Recurring schedule created: "${recTitle}" — ${inserted} events${recLabel ? ` (${recLabel})` : ''}`);
  }
}