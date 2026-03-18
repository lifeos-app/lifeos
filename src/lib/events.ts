/**
 * Unified Events Service
 * 
 * Central service for the unified_events table — all life events
 * (exercise, meals, finances, journal, habits, etc.) flow through here.
 */

import { supabase } from './supabase';
import { logger } from '../utils/logger';
import type { LucideIcon } from 'lucide-react';
import {
  Moon, UtensilsCrossed, Dumbbell, Briefcase, ScrollText, CheckCircle2,
  Wallet, DollarSign, Calendar, Pill, SmilePlus, FileText, Sun, Star,
} from 'lucide-react';

// ── Types ──

export interface UnifiedEvent {
  id: string;
  user_id: string;
  timestamp: string;       // ISO 8601
  end_timestamp?: string | null;
  type: UnifiedEventType;
  title: string;
  details: Record<string, unknown>;
  module_source?: ModuleSource | null;
  color?: string | null;
  icon?: string | null;
  duration_minutes?: number | null;
  created_at?: string;
  updated_at?: string;
}

export type UnifiedEventType =
  | 'sleep' | 'meal' | 'exercise' | 'work' | 'journal'
  | 'habit' | 'income' | 'expense' | 'event' | 'medication'
  | 'mood' | 'note' | 'morning_brief' | 'custom';

export type ModuleSource =
  | 'schedule' | 'health' | 'finance' | 'journal'
  | 'habits' | 'telegram_bot' | 'ai_chat' | 'manual';

export type CreateEventInput = Omit<UnifiedEvent, 'id' | 'created_at' | 'updated_at'>;

// ── Color & Icon Maps ──

export const EVENT_TYPE_CONFIG: Record<UnifiedEventType, { color: string; icon: string; lucideIcon: LucideIcon; label: string }> = {
  sleep:         { color: '#818CF8', icon: '😴', lucideIcon: Moon,              label: 'Sleep' },
  meal:          { color: '#F97316', icon: '🍽️', lucideIcon: UtensilsCrossed,   label: 'Meal' },
  exercise:      { color: '#22C55E', icon: '🏋️', lucideIcon: Dumbbell,          label: 'Exercise' },
  work:          { color: '#00D4FF', icon: '💼', lucideIcon: Briefcase,         label: 'Work' },
  journal:       { color: '#F59E0B', icon: '📓', lucideIcon: ScrollText,        label: 'Journal' },
  habit:         { color: '#06B6D4', icon: '✅', lucideIcon: CheckCircle2,      label: 'Habit' },
  income:        { color: '#10B981', icon: '💰', lucideIcon: Wallet,            label: 'Income' },
  expense:       { color: '#EF4444', icon: '💸', lucideIcon: DollarSign,        label: 'Expense' },
  event:         { color: '#3B82F6', icon: '📅', lucideIcon: Calendar,          label: 'Event' },
  medication:    { color: '#EC4899', icon: '💊', lucideIcon: Pill,              label: 'Medication' },
  mood:          { color: '#EAB308', icon: '😊', lucideIcon: SmilePlus,         label: 'Mood' },
  note:          { color: '#94A3B8', icon: '📝', lucideIcon: FileText,          label: 'Note' },
  morning_brief: { color: '#F472B6', icon: '🌅', lucideIcon: Sun,              label: 'Morning Brief' },
  custom:        { color: '#64748B', icon: '⭐', lucideIcon: Star,             label: 'Custom' },
};

// ── CRUD Functions ──

/** Fetch events for a specific date (local date string YYYY-MM-DD) */
export async function getEventsByDate(userId: string, date: string): Promise<UnifiedEvent[]> {
  // Convert local date boundaries to UTC for timezone-correct querying.
  // Without this, events between midnight and UTC-offset hours are missed
  // (e.g. 2am AEDT = 3pm previous day UTC, falls outside naive date range).
  const localStart = new Date(`${date}T00:00:00`);
  const localEnd = new Date(`${date}T23:59:59.999`);
  const dayStartUTC = localStart.toISOString();
  const dayEndUTC = localEnd.toISOString();

  const { data, error } = await supabase
    .from('unified_events')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', dayStartUTC)
    .lte('timestamp', dayEndUTC)
    .order('timestamp', { ascending: true });

  if (error) {
    logger.error('[events] getEventsByDate error:', error.message);
    return [];
  }
  return (data || []) as UnifiedEvent[];
}

/** Fetch events for a date range */
export async function getEventsByDateRange(
  userId: string,
  start: string,
  end: string
): Promise<UnifiedEvent[]> {
  const { data, error } = await supabase
    .from('unified_events')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', start)
    .lte('timestamp', end)
    .order('timestamp', { ascending: true });

  if (error) {
    logger.error('[events] getEventsByDateRange error:', error.message);
    return [];
  }
  return (data || []) as UnifiedEvent[];
}

/** Create a unified event */
export async function createEvent(event: CreateEventInput): Promise<UnifiedEvent | null> {
  const config = EVENT_TYPE_CONFIG[event.type];
  const payload = {
    ...event,
    color: event.color || config?.color || '#64748B',
    icon: event.icon || config?.icon || '⭐',
  };

  const { data, error } = await supabase
    .from('unified_events')
    .insert(payload)
    .select()
    .single();

  if (error) {
    logger.error('[events] createEvent error:', error.message);
    return null;
  }
  return data as UnifiedEvent;
}

/** Update a unified event */
export async function updateEvent(
  id: string,
  updates: Partial<UnifiedEvent>
): Promise<boolean> {
  const { error } = await supabase
    .from('unified_events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    logger.error('[events] updateEvent error:', error.message);
    return false;
  }
  return true;
}

/** Delete a unified event */
export async function deleteEvent(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('unified_events')
    .delete()
    .eq('id', id);

  if (error) {
    logger.error('[events] deleteEvent error:', error.message);
    return false;
  }
  return true;
}

// ── Helper: fire-and-forget event creation (used by module integrations) ──

/**
 * Log a unified event in the background. Does not block or throw.
 * Used by Health, Finance, Journal, Habits modules to write cross-cutting events.
 */
export function logUnifiedEvent(event: CreateEventInput): void {
  createEvent(event).catch(err => {
    logger.warn('[events] logUnifiedEvent failed:', err);
  });
}
