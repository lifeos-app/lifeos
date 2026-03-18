/**
 * Google Calendar Integration — API scaffolding
 *
 * All calls go through the server-side google-proxy.php endpoint
 * which holds the provider token securely.
 */

import { supabase } from '../supabase';
import { useUserStore } from '../../stores/useUserStore';
import { logger } from '../../utils/logger';

const PROXY_URL = '/api/google-proxy.php';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await useUserStore.getState().getSessionCached();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

async function proxyRequest(action: string, params: Record<string, unknown> = {}) {
  const headers = await getAuthHeaders();
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ service: 'calendar', action, ...params }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `Calendar API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch upcoming events for the next N days
 */
export async function fetchUpcomingEvents(days = 7): Promise<CalendarEvent[]> {
  try {
    const data = await proxyRequest('upcoming_events', { days });
    return data.events || [];
  } catch (err) {
    logger.error('[Calendar] fetchUpcomingEvents failed:', err);
    return [];
  }
}

/**
 * Create a new Google Calendar event from LifeOS schedule
 */
export async function createCalendarEvent(event: NewCalendarEvent): Promise<boolean> {
  try {
    const data = await proxyRequest('create_event', { event });
    return !!data.success;
  } catch (err) {
    logger.error('[Calendar] createCalendarEvent failed:', err);
    return false;
  }
}

/**
 * Push LifeOS scheduled events to Google Calendar
 */
export async function syncScheduleToCalendar(): Promise<{ synced: number; errors: number }> {
  try {
    const data = await proxyRequest('sync_schedule');
    return { synced: data.synced || 0, errors: data.errors || 0 };
  } catch (err) {
    logger.error('[Calendar] syncScheduleToCalendar failed:', err);
    return { synced: 0, errors: 1 };
  }
}

// Types
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string; // ISO datetime
  end: string;
  location?: string;
  htmlLink?: string;
}

export interface NewCalendarEvent {
  summary: string;
  description?: string;
  startTime: string; // ISO datetime
  endTime: string;
  location?: string;
}
