/**
 * Schedule Event Factory — Single Source of Truth
 * 
 * ALL schedule event creation MUST go through this module.
 * Whether from manual UI, AI chat, intent engine, Telegram bot,
 * or any future source — this ensures every event has consistent
 * fields, proper defaults, colour coding, and is renderable by
 * the timeline overlap algorithm.
 * 
 * v1.4.0 — Three Schedule Layers: primary, operations, sacred
 * 
 * Usage:
 *   import { createScheduleEvent, buildScheduleEvent } from '@/lib/schedule-events';
 *   
 *   // Insert directly:
 *   await createScheduleEvent(supabase, { userId, title, startTime, ... });
 *   
 *   // Or build the row object (for batch inserts):
 *   const row = buildScheduleEvent({ userId, title, startTime, ... });
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LucideIcon } from 'lucide-react';
import { logger } from '../utils/logger';
import {
  Briefcase, BookOpen, Dumbbell, UtensilsCrossed, Moon, Users, Car, Home,
  Heart, DollarSign, Calendar, PawPrint, Shirt, Warehouse, Truck, Droplets,
  Pill, Star, Church, Brain, Flame, Cross,
} from 'lucide-react';

// ── Schedule Layers ──

export type ScheduleLayer = 'primary' | 'operations' | 'sacred';

export type EventSource = 'webapp' | 'telegram' | 'api' | 'system' | 'cron';

// ── Event Types per Layer ──

export type PrimaryEventType = 'work' | 'education' | 'exercise' | 'meal' | 'sleep' | 'social' | 'travel' | 'personal' | 'health' | 'financial' | 'general';
export type OperationsEventType = 'pet_care' | 'clothes' | 'home' | 'vehicle' | 'hydration' | 'medication' | 'custom';
export type SacredEventType = 'prayer' | 'meditation' | 'fasting' | 'observance';

export type EventType = PrimaryEventType | OperationsEventType | SacredEventType;

// ── Colour System (fixed per type) ──

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  // Primary
  work:       '#00D4FF',
  education:  '#A855F7',
  exercise:   '#22C55E',
  meal:       '#F97316',
  sleep:      '#818CF8',
  social:     '#EC4899',
  travel:     '#06B6D4',
  personal:   '#39FF14',
  health:     '#EF4444',
  financial:  '#10B981',
  general:    '#64748B',
  // Operations
  pet_care:   '#F59E0B',
  clothes:    '#94A3B8',
  home:       '#78716C',
  vehicle:    '#475569',
  hydration:  '#38BDF8',
  medication: '#EC4899',
  custom:     '#64748B',
  // Sacred
  prayer:     '#D4AF37',
  meditation: '#D4AF37',
  fasting:    '#D4AF37',
  observance: '#D4AF37',
};

// ── Event Type Metadata ──

export interface EventTypeInfo {
  id: EventType;
  label: string;
  icon: LucideIcon;
  emoji: string;
  color: string;
  layer: ScheduleLayer;
}

export const EVENT_TYPES: EventTypeInfo[] = [
  // Primary
  { id: 'work',       label: 'Work',       icon: Briefcase,         emoji: '💼', color: '#00D4FF', layer: 'primary' },
  { id: 'education',  label: 'Education',  icon: BookOpen,          emoji: '📚', color: '#A855F7', layer: 'primary' },
  { id: 'exercise',   label: 'Exercise',   icon: Dumbbell,          emoji: '🏋️', color: '#22C55E', layer: 'primary' },
  { id: 'meal',       label: 'Meal',       icon: UtensilsCrossed,   emoji: '🍽️', color: '#F97316', layer: 'primary' },
  { id: 'sleep',      label: 'Sleep',      icon: Moon,              emoji: '😴', color: '#818CF8', layer: 'primary' },
  { id: 'social',     label: 'Social',     icon: Users,             emoji: '🎉', color: '#EC4899', layer: 'primary' },
  { id: 'travel',     label: 'Travel',     icon: Car,               emoji: '🚗', color: '#06B6D4', layer: 'primary' },
  { id: 'personal',   label: 'Personal',   icon: Home,              emoji: '🏠', color: '#39FF14', layer: 'primary' },
  { id: 'health',     label: 'Health',     icon: Heart,             emoji: '💊', color: '#EF4444', layer: 'primary' },
  { id: 'financial',  label: 'Financial',  icon: DollarSign,        emoji: '💰', color: '#10B981', layer: 'primary' },
  { id: 'general',    label: 'General',    icon: Calendar,          emoji: '📅', color: '#64748B', layer: 'primary' },
  // Operations
  { id: 'pet_care',   label: 'Pet Care',   icon: PawPrint,          emoji: '🐾', color: '#F59E0B', layer: 'operations' },
  { id: 'clothes',    label: 'Clothes',    icon: Shirt,             emoji: '👔', color: '#94A3B8', layer: 'operations' },
  { id: 'home',       label: 'Home',       icon: Warehouse,         emoji: '🏡', color: '#78716C', layer: 'operations' },
  { id: 'vehicle',    label: 'Vehicle',    icon: Truck,             emoji: '🚙', color: '#475569', layer: 'operations' },
  { id: 'hydration',  label: 'Hydration',  icon: Droplets,          emoji: '💧', color: '#38BDF8', layer: 'operations' },
  { id: 'medication', label: 'Medication', icon: Pill,              emoji: '💊', color: '#EC4899', layer: 'operations' },
  { id: 'custom',     label: 'Custom',     icon: Star,              emoji: '⭐', color: '#64748B', layer: 'operations' },
  // Sacred
  { id: 'prayer',     label: 'Prayer',     icon: Church,            emoji: '🙏', color: '#D4AF37', layer: 'sacred' },
  { id: 'meditation', label: 'Meditation', icon: Brain,             emoji: '🧘', color: '#D4AF37', layer: 'sacred' },
  { id: 'fasting',    label: 'Fasting',    icon: Flame,             emoji: '🕯️', color: '#D4AF37', layer: 'sacred' },
  { id: 'observance', label: 'Observance', icon: Cross,             emoji: '✝️', color: '#D4AF37', layer: 'sacred' },
];

export const PRIMARY_TYPES = EVENT_TYPES.filter(t => t.layer === 'primary');
export const OPERATIONS_TYPES = EVENT_TYPES.filter(t => t.layer === 'operations');
export const SACRED_TYPES = EVENT_TYPES.filter(t => t.layer === 'sacred');

// ── Layer from Event Type ──

export function getLayerForType(eventType: EventType): ScheduleLayer {
  const info = EVENT_TYPES.find(t => t.id === eventType);
  return info?.layer || 'primary';
}

export function getColorForType(eventType: EventType): string {
  return EVENT_TYPE_COLORS[eventType] || '#64748B';
}

// ── Legacy Category System (backward compat) ──

export type ScheduleCategory = 'work' | 'education' | 'personal' | 'health' | 'social' | 'general';

export const CATEGORY_COLORS: Record<ScheduleCategory, string> = {
  work:      '#00D4FF',
  education: '#A855F7',
  personal:  '#39FF14',
  health:    '#F97316',
  social:    '#EC4899',
  general:   '#64748B',
};

/** Infer event type from title using keyword matching */
export function inferEventType(title: string): EventType {
  const t = title.toLowerCase();
  // Sacred
  if (/\b(pray|prayer|salat|tefila|kidase)\b/i.test(t)) return 'prayer';
  if (/\b(meditat|mindful|contemplat)\b/i.test(t)) return 'meditation';
  if (/\b(fast|fasting|tsom)\b/i.test(t)) return 'fasting';
  // Operations
  if (/\b(pet|dog|cat|feed|walk the|vet|groom)\b/i.test(t)) return 'pet_care';
  if (/\b(laundry|wash|iron|clothes|mend|dry clean)\b/i.test(t)) return 'clothes';
  if (/\b(clean house|dishes|garden|bins|vacuum|mop|home maint)\b/i.test(t)) return 'home';
  if (/\b(car|vehicle|rego|fuel|servic|mechanic)\b/i.test(t)) return 'vehicle';
  if (/\b(water|hydrat|drink)\b/i.test(t)) return 'hydration';
  if (/\b(pill|medication|medicine|prescription)\b/i.test(t)) return 'medication';
  // Primary
  if (/\b(clean|work|job|shift|security|client|meeting|deliver|invoice|office|business|shop|store)\b/i.test(t)) return 'work';
  if (/\b(study|learn|read|course|class|education|bible|book|lecture|tutorial|homework)\b/i.test(t)) return 'education';
  if (/\b(gym|exercise|run|workout|physio|sport|lift|squat|bench)\b/i.test(t)) return 'exercise';
  if (/\b(breakfast|lunch|dinner|meal|snack|cook|eat|food)\b/i.test(t)) return 'meal';
  if (/\b(sleep|nap|bed|rest|wake)\b/i.test(t)) return 'sleep';
  if (/\b(friend|family|call|party|social|hang|meet|catchup|church|mosque)\b/i.test(t)) return 'social';
  if (/\b(travel|drive|commute|flight|trip|uber|taxi)\b/i.test(t)) return 'travel';
  if (/\b(doctor|dentist|health|hospital|checkup|medical)\b/i.test(t)) return 'health';
  if (/\b(bank|tax|financ|budget|invest|pay|bill)\b/i.test(t)) return 'financial';
  if (/\b(errand|personal|admin|appointment)\b/i.test(t)) return 'personal';
  return 'general';
}

/** Legacy: infer category from event type (backward compat for day_type) */
export function inferCategory(title: string): ScheduleCategory {
  const eventType = inferEventType(title);
  // Map event types back to legacy categories
  switch (eventType) {
    case 'work': return 'work';
    case 'education': return 'education';
    case 'exercise': case 'meal': case 'sleep': case 'health': case 'medication': return 'health';
    case 'social': case 'prayer': case 'meditation': case 'fasting': case 'observance': return 'social';
    case 'personal': case 'travel': case 'pet_care': case 'clothes': case 'home': case 'vehicle': case 'hydration': case 'custom': return 'personal';
    case 'financial': return 'work';
    default: return 'general';
  }
}

// ── Input Type ──

export interface ScheduleEventInput {
  userId: string;
  title: string;
  startTime: string;           // ISO 8601
  endTime?: string | null;     // defaults to startTime + 1hr
  description?: string | null;
  location?: string | null;
  category?: ScheduleCategory | string | null;  // day_type (legacy)
  eventType?: EventType | null;  // NEW: specific event type
  scheduleLayer?: ScheduleLayer | null;  // NEW: primary/operations/sacred
  source?: EventSource | null;  // NEW: webapp/telegram/api/system/cron
  color?: string | null;       // auto-derived from event type if missing
  allDay?: boolean;
  recurrenceRule?: string | null;
  isTemplate?: boolean;
  goalTag?: string | null;     // e.g. "[goal:abc123]"
  priority?: string | null;    // e.g. "high", "critical"
}

// ── Row Type (what goes into Supabase) ──

export interface ScheduleEventRow {
  user_id: string;
  title: string;
  start_time: string;
  end_time: string;
  description: string | null;
  location: string | null;
  color: string;
  day_type: string;
  event_type: string;
  schedule_layer: ScheduleLayer;
  source: EventSource;
  all_day: boolean;
  recurrence_rule: string | null;
  is_template: boolean;
  is_deleted: boolean;
  sync_status: string;
  status: string;
  is_live: boolean;
}

// ── Builder ──

/**
 * Build a normalized schedule_events row from any input.
 * Fills in ALL required fields with sensible defaults.
 * Does NOT insert — returns the plain object.
 */
export function buildScheduleEvent(input: ScheduleEventInput): ScheduleEventRow {
  const title = (input.title || 'Event').trim();
  const startTime = input.startTime || new Date().toISOString();

  // Default end_time: start + 1 hour
  let endTime = input.endTime;
  if (!endTime) {
    const start = new Date(startTime);
    if (isNaN(start.getTime())) {
      endTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    } else {
      endTime = new Date(start.getTime() + 60 * 60 * 1000).toISOString();
    }
  }

  // Event type: use provided, or infer from title
  const eventType: EventType = (input.eventType && input.eventType in EVENT_TYPE_COLORS)
    ? input.eventType
    : inferEventType(title);

  // Layer: use provided, or derive from event type
  const scheduleLayer: ScheduleLayer = input.scheduleLayer || getLayerForType(eventType);

  // Source: use provided, or default to webapp
  const source: EventSource = input.source || 'webapp';

  // Category (legacy day_type): use provided, or derive from event type
  const category = (input.category && input.category in CATEGORY_COLORS)
    ? input.category as ScheduleCategory
    : inferCategory(title);

  // Color: use provided, or derive from event type
  const color = input.color || getColorForType(eventType);

  // Build description with optional goal/priority tags
  let description = input.description || null;
  if (input.goalTag && description) {
    description = `[goal:${input.goalTag}] ${description}`;
  } else if (input.goalTag) {
    description = `[goal:${input.goalTag}]`;
  }
  if (input.priority && input.priority !== 'medium') {
    description = `[priority:${input.priority}]${description ? ' ' + description : ''}`;
  }

  return {
    user_id:          input.userId,
    title,
    start_time:       startTime,
    end_time:         endTime,
    description,
    location:         input.location || null,
    color,
    day_type:         category,
    event_type:       eventType,
    schedule_layer:   scheduleLayer,
    source,
    all_day:          input.allDay ?? false,
    recurrence_rule:  input.recurrenceRule || null,
    is_template:      input.isTemplate ?? false,
    is_deleted:       false,
    sync_status:      'synced',
    status:           'scheduled',
    is_live:          false,
  };
}

// ── Creator ──

/**
 * Create a schedule event in Supabase. Single entry point.
 * Writes to both schedule_events (legacy) and unified_events (used by timeline view).
 * Returns the created event or throws on error.
 */
export async function createScheduleEvent(
  supabase: SupabaseClient,
  input: ScheduleEventInput
): Promise<{ id: string; title: string; start_time: string; end_time: string }> {
  const row = buildScheduleEvent(input);

  const { data, error } = await supabase
    .from('schedule_events')
    .insert(row)
    .select('id, title, start_time, end_time')
    .single();

  if (error) throw new Error(`Event creation failed: ${error.message}`);

  // Also write to unified_events so UnifiedTimeline can display it
  const unifiedType = mapEventTypeToUnified(row.event_type);
  const durationMs = new Date(row.end_time).getTime() - new Date(row.start_time).getTime();
  const durationMinutes = Math.round(durationMs / 60000);

  try {
    await supabase.from('unified_events').insert({
      user_id: row.user_id,
      title: row.title,
      timestamp: row.start_time,
      end_timestamp: row.end_time,
      type: unifiedType,
      details: {
        description: row.description || '',
        schedule_event_id: data.id,
        event_type: row.event_type,
        schedule_layer: row.schedule_layer,
        location: row.location,
      },
      module_source: row.source === 'telegram' ? 'telegram_bot' : 'webapp',
      color: row.color,
      icon: EVENT_TYPES.find(t => t.id === row.event_type)?.emoji || '📅',
      duration_minutes: durationMinutes > 0 ? durationMinutes : 60,
      is_deleted: false,
    });
  } catch {
    // Don't fail the primary write if unified_events insert fails
    logger.warn('[schedule-events] Failed to sync to unified_events');
  }

  return data;
}

/** Map schedule event_type to unified_events type */
function mapEventTypeToUnified(eventType: string): string {
  const mapping: Record<string, string> = {
    work: 'work', education: 'event', exercise: 'exercise',
    meal: 'meal', sleep: 'sleep', social: 'event',
    travel: 'event', personal: 'event', health: 'event',
    financial: 'event', general: 'event',
    pet_care: 'event', clothes: 'event', home: 'event',
    vehicle: 'event', hydration: 'event', medication: 'medication',
    custom: 'custom',
    prayer: 'event', meditation: 'event', fasting: 'event', observance: 'event',
  };
  return mapping[eventType] || 'event';
}
