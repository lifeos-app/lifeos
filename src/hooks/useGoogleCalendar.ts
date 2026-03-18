/**
 * useGoogleCalendar — Fetches Google Calendar events and merges with LifeOS schedule.
 *
 * Polls every 5 minutes when connected. Transforms CalendarEvent[] into
 * ScheduleEvent-compatible shape with source: 'google'.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchUpcomingEvents, type CalendarEvent } from '../lib/integrations/google-calendar';
import { useGoogleIntegration } from './useGoogleIntegration';
import { logger } from '../utils/logger';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface GoogleScheduleEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  date: string;
  location?: string;
  color: string;
  source: 'google';
  htmlLink?: string;
  is_deleted: boolean;
  is_recurring: boolean;
  status: 'scheduled';
  event_type: 'google';
}

export function useGoogleCalendar(enabled = true) {
  const { isCalendarConnected } = useGoogleIntegration();
  const [events, setEvents] = useState<GoogleScheduleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!isCalendarConnected || !enabled) {
      setEvents([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const raw = await fetchUpcomingEvents(14); // 2 weeks
      const mapped: GoogleScheduleEvent[] = raw.map(transformEvent);
      setEvents(mapped);
      setLastSynced(new Date());
    } catch (err) {
      logger.error('[GoogleCalendar] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch Google events');
      // Keep existing events on error
    } finally {
      setLoading(false);
    }
  }, [isCalendarConnected, enabled]);

  // Fetch on mount + poll
  useEffect(() => {
    if (!isCalendarConnected || !enabled) return;

    fetchEvents();
    intervalRef.current = setInterval(fetchEvents, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isCalendarConnected, enabled, fetchEvents]);

  return {
    googleEvents: events,
    loading,
    lastSynced,
    error,
    eventCount: events.length,
    isConnected: isCalendarConnected,
    refetch: fetchEvents,
  };
}

function transformEvent(event: CalendarEvent): GoogleScheduleEvent {
  const startDate = event.start ? event.start.split('T')[0] : new Date().toISOString().split('T')[0];

  return {
    id: `gcal-${event.id}`,
    title: event.summary || 'Untitled',
    description: event.description,
    start_time: event.start,
    end_time: event.end,
    date: startDate,
    location: event.location,
    color: '#4285F4', // Google blue
    source: 'google',
    htmlLink: event.htmlLink,
    is_deleted: false,
    is_recurring: false,
    status: 'scheduled',
    event_type: 'google',
  };
}
