/**
 * Rituals — Recurring Activity Patterns
 * 
 * The MIDDLE LAYER between habits (binary daily checks) and scheduled events (specific time slots).
 * A ritual is a recurring pattern — "I sleep 10pm-6am weekdays", "I work out MWF at 6am for 45min".
 * Rituals auto-generate schedule events via syncRitualsToSchedule().
 * 
 * Flow: Define Ritual → Auto-populate Schedule → Daily Review compares scheduled vs actual
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createScheduleEvent, EVENT_TYPE_COLORS, type EventType } from './schedule-events';
import { logger } from '../utils/logger';

// ── Storage Key ──
const STORAGE_KEY = 'lifeos_rituals';

// ── Ritual Interface ──

export interface RitualSchedule {
  days: number[];          // 0=Sun, 1=Mon, ... 6=Sat
  startTime: string;       // "22:00" (24h format)
  endTime?: string;        // "06:00" (for duration-based like sleep)
  durationMinutes?: number; // alternative to endTime
}

export interface Ritual {
  id: string;
  title: string;
  emoji: string;
  type: RitualType;
  eventType: EventType;
  schedule: RitualSchedule;
  weekendOverride?: {
    startTime: string;
    endTime?: string;
    durationMinutes?: number;
  };
  enabled: boolean;
  color: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type RitualType = 'sleep' | 'exercise' | 'meal' | 'meditation' | 'study' | 'work' | 'custom';

// ── Ritual Type Metadata ──

export const RITUAL_TYPES: { id: RitualType; label: string; emoji: string; eventType: EventType }[] = [
  { id: 'sleep',      label: 'Sleep',      emoji: '😴', eventType: 'sleep' },
  { id: 'exercise',   label: 'Exercise',   emoji: '🏋️', eventType: 'exercise' },
  { id: 'meal',       label: 'Meal',       emoji: '🍽️', eventType: 'meal' },
  { id: 'meditation', label: 'Meditation', emoji: '🧘', eventType: 'meditation' },
  { id: 'study',      label: 'Study',      emoji: '📖', eventType: 'education' },
  { id: 'work',       label: 'Work',       emoji: '💼', eventType: 'work' },
  { id: 'custom',     label: 'Custom',     emoji: '⭐', eventType: 'general' },
];

// ── Emoji Presets ──
export const EMOJI_PRESETS = ['😴', '🏋️', '🍽️', '🧘', '📖', '💼', '🎨', '🏃', '☕', '🚿', '💊', '🙏'];

// ── Preset Rituals ──

export interface RitualPreset {
  title: string;
  emoji: string;
  type: RitualType;
  eventType: EventType;
  schedule: RitualSchedule;
  weekendOverride?: Ritual['weekendOverride'];
  color: string;
}

export const RITUAL_PRESETS: RitualPreset[] = [
  {
    title: 'Sleep',
    emoji: '😴',
    type: 'sleep',
    eventType: 'sleep',
    schedule: { days: [1, 2, 3, 4, 5], startTime: '22:00', endTime: '06:00' },
    weekendOverride: { startTime: '23:00', endTime: '08:00' },
    color: EVENT_TYPE_COLORS.sleep,
  },
  {
    title: 'Breakfast',
    emoji: '🍽️',
    type: 'meal',
    eventType: 'meal',
    schedule: { days: [0, 1, 2, 3, 4, 5, 6], startTime: '07:30', durationMinutes: 30 },
    color: EVENT_TYPE_COLORS.meal,
  },
  {
    title: 'Lunch',
    emoji: '🍽️',
    type: 'meal',
    eventType: 'meal',
    schedule: { days: [0, 1, 2, 3, 4, 5, 6], startTime: '12:30', durationMinutes: 30 },
    color: EVENT_TYPE_COLORS.meal,
  },
  {
    title: 'Dinner',
    emoji: '🍽️',
    type: 'meal',
    eventType: 'meal',
    schedule: { days: [0, 1, 2, 3, 4, 5, 6], startTime: '18:30', durationMinutes: 45 },
    color: EVENT_TYPE_COLORS.meal,
  },
  {
    title: 'Workout',
    emoji: '🏋️',
    type: 'exercise',
    eventType: 'exercise',
    schedule: { days: [1, 3, 5], startTime: '06:00', durationMinutes: 45 },
    color: EVENT_TYPE_COLORS.exercise,
  },
  {
    title: 'Meditation',
    emoji: '🧘',
    type: 'meditation',
    eventType: 'meditation',
    schedule: { days: [0, 1, 2, 3, 4, 5, 6], startTime: '06:00', durationMinutes: 15 },
    color: EVENT_TYPE_COLORS.meditation,
  },
];

// ── Helpers ──

function genRitualId(): string {
  return 'rit_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export { DAY_LABELS, DAY_LETTERS };

/** Format time from "HH:MM" to display format */
export function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (h === 0) return `12:${m}am`;
  if (h < 12) return `${h}:${m}am`;
  if (h === 12) return `12:${m}pm`;
  return `${h - 12}:${m}pm`;
}

/** Get duration display for a ritual */
export function getRitualDuration(schedule: RitualSchedule): string {
  if (schedule.durationMinutes) {
    if (schedule.durationMinutes < 60) return `${schedule.durationMinutes}min`;
    const h = Math.floor(schedule.durationMinutes / 60);
    const m = schedule.durationMinutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (schedule.endTime) {
    return `${formatTime12h(schedule.startTime)} – ${formatTime12h(schedule.endTime)}`;
  }
  return formatTime12h(schedule.startTime);
}

// ── CRUD ──

export function getRituals(): Ritual[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Ritual[];
  } catch {
    return [];
  }
}

function persistRituals(rituals: Ritual[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rituals));
  } catch (e) {
    logger.error('[Rituals] Failed to persist:', e);
  }
}

export function saveRitual(ritual: Partial<Ritual> & { title: string }): Ritual {
  const rituals = getRituals();
  const now = new Date().toISOString();

  if (ritual.id) {
    // Update existing
    const idx = rituals.findIndex(r => r.id === ritual.id);
    if (idx >= 0) {
      rituals[idx] = { ...rituals[idx], ...ritual, updatedAt: now };
      persistRituals(rituals);
      return rituals[idx];
    }
  }

  // Create new
  const newRitual: Ritual = {
    id: genRitualId(),
    title: ritual.title,
    emoji: ritual.emoji || '📅',
    type: ritual.type || 'custom',
    eventType: ritual.eventType || 'general',
    schedule: ritual.schedule || { days: [1, 2, 3, 4, 5], startTime: '09:00', durationMinutes: 60 },
    weekendOverride: ritual.weekendOverride,
    enabled: ritual.enabled ?? true,
    color: ritual.color || EVENT_TYPE_COLORS[ritual.eventType || 'general'] || '#64748B',
    notes: ritual.notes,
    createdAt: now,
    updatedAt: now,
  };

  rituals.push(newRitual);
  persistRituals(rituals);
  return newRitual;
}

export function deleteRitual(id: string): void {
  const rituals = getRituals().filter(r => r.id !== id);
  persistRituals(rituals);
}

export function toggleRitual(id: string): Ritual | null {
  const rituals = getRituals();
  const idx = rituals.findIndex(r => r.id === id);
  if (idx < 0) return null;
  rituals[idx].enabled = !rituals[idx].enabled;
  rituals[idx].updatedAt = new Date().toISOString();
  persistRituals(rituals);
  return rituals[idx];
}

export function createRitualFromPreset(preset: RitualPreset): Ritual {
  return saveRitual({
    title: preset.title,
    emoji: preset.emoji,
    type: preset.type,
    eventType: preset.eventType,
    schedule: { ...preset.schedule },
    weekendOverride: preset.weekendOverride ? { ...preset.weekendOverride } : undefined,
    enabled: true,
    color: preset.color,
  });
}

// ── Sync Rituals → Schedule Events ──

/**
 * Syncs all enabled rituals to schedule events for the next 7 days.
 * 1. Reads all enabled rituals
 * 2. Clears existing ritual-generated events (notes contain [ritual:ID])
 * 3. Creates new events via createScheduleEvent()
 * 4. Returns count of events created
 */
export async function syncRitualsToSchedule(
  supabase: SupabaseClient,
  userId: string
): Promise<{ created: number; cleared: number }> {
  const rituals = getRituals().filter(r => r.enabled);
  
  if (rituals.length === 0) {
    return { created: 0, cleared: 0 };
  }

  // Step 1: Find and delete existing ritual-generated events (next 7 days only)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endRange = new Date(today);
  endRange.setDate(endRange.getDate() + 7);
  endRange.setHours(23, 59, 59, 999);

  const { data: existingEvents } = await supabase
    .from('schedule_events')
    .select('id, description')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .gte('start_time', today.toISOString())
    .lte('start_time', endRange.toISOString())
    .like('description', '%[ritual:%');

  let cleared = 0;
  if (existingEvents && existingEvents.length > 0) {
    const ids = existingEvents.map(e => e.id);
    const { error } = await supabase
      .from('schedule_events')
      .update({ is_deleted: true })
      .in('id', ids);
    if (!error) cleared = ids.length;
  }

  // Step 2: Generate events for each ritual for the next 7 days
  let created = 0;

  for (const ritual of rituals) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + dayOffset);
      const dayOfWeek = targetDate.getDay(); // 0=Sun ... 6=Sat

      // Check if ritual is active on this day
      if (!ritual.schedule.days.includes(dayOfWeek)) continue;

      // Determine times: use weekend override for Sat/Sun if available
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const schedTimes = (isWeekend && ritual.weekendOverride)
        ? ritual.weekendOverride
        : ritual.schedule;

      const startTime = schedTimes.startTime;
      const [startH, startM] = startTime.split(':').map(Number);

      // Calculate start datetime
      const startDt = new Date(targetDate);
      startDt.setHours(startH, startM, 0, 0);

      // Calculate end datetime
      let endDt: Date;
      if (schedTimes.endTime) {
        const [endH, endM] = schedTimes.endTime.split(':').map(Number);
        endDt = new Date(targetDate);
        endDt.setHours(endH, endM, 0, 0);
        // Handle overnight events (e.g., 22:00 - 06:00)
        if (endDt <= startDt) {
          endDt.setDate(endDt.getDate() + 1);
        }
      } else if (schedTimes.durationMinutes) {
        endDt = new Date(startDt.getTime() + schedTimes.durationMinutes * 60000);
      } else {
        // Default: 1 hour
        endDt = new Date(startDt.getTime() + 60 * 60000);
      }

      // Create the event
      try {
        await createScheduleEvent(supabase, {
          userId,
          title: `${ritual.emoji} ${ritual.title}`,
          startTime: startDt.toISOString(),
          endTime: endDt.toISOString(),
          description: `[ritual:${ritual.id}] ${ritual.notes || ''}`.trim(),
          eventType: ritual.eventType,
          source: 'webapp',
          color: ritual.color,
        });
        created++;
      } catch (err) {
        logger.error(`[Rituals] Failed to create event for "${ritual.title}" on ${targetDate.toDateString()}:`, err);
      }
    }
  }

  return { created, cleared };
}
