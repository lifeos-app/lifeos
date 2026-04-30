/**
 * gcal-sync.ts — Google Calendar Sync Framework
 *
 * Provides a framework for syncing Google Calendar events with LifeOS Schedule.
 * Uses Google Calendar API via OAuth (similar to existing Google Auth flow).
 *
 * STUB MODE: Since real Google OAuth credentials are not configured, all API
 * calls return mock data. The UI clearly indicates "Preview Mode" status.
 * When real credentials are available, the stub layer is bypassed.
 */

import { localInsert, localGetAll, getEffectiveUserId } from './local-db';
import { logger } from '../utils/logger';
import { genId } from '../utils/date';
import type { ScheduleEvent } from '../types/database';

// ──────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────

export interface GoogleCalendarConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  calendarId: string;
}

const DEFAULT_CONFIG: GoogleCalendarConfig = {
  clientId: '',
  redirectUri: '',
  scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  calendarId: 'primary',
};

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface CalendarSummary {
  id: string;
  name: string;
  primary: boolean;
  color: string;
}

export interface GCalEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
  status?: string;
  isRecurring?: boolean;
  recurringEventId?: string;
}

export type ConflictResolution = 'keep_both' | 'local_wins' | 'remote_wins';

export interface ConflictPair {
  localEvent: ScheduleEvent;
  gcalEvent: GCalEvent;
  conflictType: 'exact_overlap' | 'partial_overlap' | 'same_title';
}

export interface SyncedEvent {
  event: ScheduleEvent;
  source: 'local' | 'remote' | 'merged';
  conflict?: ConflictPair;
}

export interface GCalSyncState {
  connected: boolean;
  calendars: CalendarSummary[];
  selectedCalendars: string[];
  syncFrequency: 'manual' | 'daily' | 'hourly';
  conflictResolution: ConflictResolution;
  lastSyncAt: string | null;
  isStub: boolean;
}

// ──────────────────────────────────────────────────────────────
// Persistence
// ──────────────────────────────────────────────────────────────

const GCAL_STORAGE_KEY = 'lifeos_gcal_config';

function loadGcalState(): Partial<GCalSyncState> {
  try {
    const raw = localStorage.getItem(GCAL_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveGcalState(state: Partial<GCalSyncState>): void {
  try {
    localStorage.setItem(GCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    logger.warn('[gcal-sync] Failed to save state:', e);
  }
}

// ──────────────────────────────────────────────────────────────
// Mock Data (Preview Mode)
// ──────────────────────────────────────────────────────────────

function generateMockEvents(startDate: Date, endDate: Date): GCalEvent[] {
  const events: GCalEvent[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayStr = current.toISOString().split('T')[0];
    const dayOfWeek = current.getDay();

    // Team Standup — weekday mornings
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      events.push({
        id: `mock-standup-${dayStr}`,
        summary: 'Team Standup',
        description: 'Daily team sync meeting',
        start: { dateTime: `${dayStr}T09:00:00` },
        end: { dateTime: `${dayStr}T09:30:00` },
        location: 'Zoom',
        status: 'confirmed',
        isRecurring: true,
        recurringEventId: 'mock-recurring-standup',
      });
    }

    // Lunch Break — every day
    events.push({
      id: `mock-lunch-${dayStr}`,
      summary: 'Lunch Break',
      description: 'Take a break, eat something healthy',
      start: { dateTime: `${dayStr}T12:00:00` },
      end: { dateTime: `${dayStr}T13:00:00` },
      location: '',
      status: 'confirmed',
      isRecurring: true,
      recurringEventId: 'mock-recurring-lunch',
    });

    // Focus Time — weekday afternoons
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      events.push({
        id: `mock-focus-${dayStr}`,
        summary: 'Focus Time',
        description: 'Deep work block — no distractions',
        start: { dateTime: `${dayStr}T14:00:00` },
        end: { dateTime: `${dayStr}T16:00:00` },
        location: '',
        status: 'confirmed',
        isRecurring: true,
        recurringEventId: 'mock-recurring-focus',
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return events;
}

function generateMockCalendars(): CalendarSummary[] {
  return [
    { id: 'primary', name: 'Personal', primary: true, color: '#4285F4' },
    { id: 'work@example.com', name: 'Work', primary: false, color: '#0F9D58' },
    { id: 'family@example.com', name: 'Family', primary: false, color: '#DB4437' },
  ];
}

// ──────────────────────────────────────────────────────────────
// GCalSync Class
// ──────────────────────────────────────────────────────────────

export class GCalSync {
  private config: GoogleCalendarConfig;
  private accessToken: string | null = null;
  private isStub: boolean;

  constructor(config?: Partial<GoogleCalendarConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Stub mode when no real credentials are configured
    this.isStub = !this.config.clientId;
  }

  /** Check if running in stub/preview mode */
  get isPreviewMode(): boolean {
    return this.isStub;
  }

  /** Generate Google OAuth URL for calendar scope */
  getAuthUrl(): string {
    if (this.isStub) {
      // Return a placeholder URL in stub mode
      return `https://accounts.google.com/o/oauth2/v2/auth?stub=true&scope=${encodeURIComponent(this.config.scopes.join(' '))}&preview_mode=true`;
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /** Exchange OAuth code for access token (via proxy to avoid exposing client secret) */
  async handleAuthCallback(code: string): Promise<string> {
    if (this.isStub) {
      // Simulate successful auth in stub mode
      this.accessToken = 'mock-access-token-preview';
      const state = loadGcalState();
      saveGcalState({ ...state, connected: true, lastSyncAt: null });
      return this.accessToken;
    }

    try {
      const response = await fetch('/api/google-proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'calendar',
          action: 'exchange_token',
          code,
          redirect_uri: this.config.redirectUri,
        }),
      });

      if (!response.ok) {
        throw new Error(`Auth exchange failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;

      const state = loadGcalState();
      saveGcalState({ ...state, connected: true, lastSyncAt: null });

      return this.accessToken;
    } catch (err) {
      logger.error('[gcal-sync] Auth callback failed:', err);
      throw err;
    }
  }

  /** List user's calendars */
  async getCalendars(): Promise<CalendarSummary[]> {
    if (this.isStub) {
      return generateMockCalendars();
    }

    if (!this.accessToken) {
      throw new Error('Not authenticated — call handleAuthCallback first');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/users/me/calendarList`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch calendars: ${response.status}`);
      }

      const data = await response.json();
      return (data.items || []).map((cal: any) => ({
        id: cal.id,
        name: cal.summary || cal.id,
        primary: cal.primary || false,
        color: cal.backgroundColor || '#4285F4',
      }));
    } catch (err) {
      logger.error('[gcal-sync] getCalendars failed:', err);
      throw err;
    }
  }

  /** Fetch events in a time range from a calendar */
  async getEvents(
    calendarId: string,
    timeMin: Date,
    timeMax: Date
  ): Promise<GCalEvent[]> {
    if (this.isStub) {
      return generateMockEvents(timeMin, timeMax);
    }

    if (!this.accessToken) {
      throw new Error('Not authenticated — call handleAuthCallback first');
    }

    try {
      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      });

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }

      const data = await response.json();
      return (data.items || []).map((evt: any) => ({
        id: evt.id,
        summary: evt.summary || 'Untitled',
        description: evt.description,
        start: evt.start || {},
        end: evt.end || {},
        location: evt.location,
        htmlLink: evt.htmlLink,
        status: evt.status,
        isRecurring: !!evt.recurringEventId,
        recurringEventId: evt.recurringEventId,
      }));
    } catch (err) {
      logger.error('[gcal-sync] getEvents failed:', err);
      throw err;
    }
  }

  /** Convert a GCalEvent to a ScheduleEvent-compatible record */
  private gcalToScheduleEvent(evt: GCalEvent, userId: string): ScheduleEvent {
    const startDateTime = evt.start.dateTime || (evt.start.date ? `${evt.start.date}T00:00:00` : '');
    const endDateTime = evt.end.dateTime || (evt.end.date ? `${evt.end.date}T23:59:59` : '');
    const dateStr = startDateTime.split('T')[0] || new Date().toISOString().split('T')[0];

    return {
      id: `gcal-${evt.id}`,
      user_id: userId,
      title: evt.summary || 'Untitled Event',
      description: evt.description,
      start_time: startDateTime,
      end_time: endDateTime,
      date: dateStr,
      event_type: 'custom',
      location: evt.location,
      source: 'google',
      htmlLink: evt.htmlLink,
      is_recurring: evt.isRecurring || false,
      status: evt.status === 'cancelled' ? 'cancelled' : 'scheduled',
      color: '#4285F4',
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /** Import GCal events into LifeOS schedule */
  async syncToSchedule(gcalEvents: GCalEvent[]): Promise<number> {
    const userId = getEffectiveUserId();
    let imported = 0;

    // Load existing local events to check for duplicates
    const localEvents = await localGetAll<ScheduleEvent>('events');
    const existingGcalIds = new Set(
      localEvents.filter(e => e.source === 'google').map(e => e.id)
    );

    for (const evt of gcalEvents) {
      // Skip cancelled events
      if (evt.status === 'cancelled') continue;

      const scheduleEvent = this.gcalToScheduleEvent(evt, userId);

      // Skip if already imported
      if (existingGcalIds.has(scheduleEvent.id)) continue;

      try {
        await localInsert('events', {
          ...scheduleEvent,
          synced: false,
        });
        imported++;
      } catch (err) {
        logger.warn(`[gcal-sync] Failed to import event "${evt.summary}":`, err);
      }
    }

    // Update last sync timestamp
    const state = loadGcalState();
    saveGcalState({ ...state, lastSyncAt: new Date().toISOString() });

    logger.log(`[gcal-sync] Imported ${imported} events`);
    return imported;
  }

  /** Detect conflicts between local events and GCal events */
  detectConflicts(
    localEvents: ScheduleEvent[],
    gcalEvents: GCalEvent[]
  ): ConflictPair[] {
    const conflicts: ConflictPair[] = [];

    for (const gcal of gcalEvents) {
      if (gcal.status === 'cancelled') continue;

      const gcalStart = gcal.start.dateTime
        ? new Date(gcal.start.dateTime).getTime()
        : gcal.start.date
          ? new Date(gcal.start.date).getTime()
          : 0;
      const gcalEnd = gcal.end.dateTime
        ? new Date(gcal.end.dateTime).getTime()
        : gcal.end.date
          ? new Date(gcal.end.date).getTime()
          : 0;

      for (const local of localEvents) {
        const localStart = new Date(local.start_time).getTime();
        const localEnd = new Date(local.end_time).getTime();

        // Check time overlap
        const overlaps = localStart < gcalEnd && localEnd > gcalStart;

        // Check same title
        const sameTitle =
          local.title.toLowerCase().trim() ===
          (gcal.summary || '').toLowerCase().trim();

        if (overlaps || sameTitle) {
          const conflictType = sameTitle
            ? 'same_title'
            : overlaps && localStart >= gcalStart && localEnd <= gcalEnd
              ? 'exact_overlap'
              : 'partial_overlap';

          conflicts.push({
            localEvent: local,
            gcalEvent: gcal,
            conflictType,
          });
        }
      }
    }

    return conflicts;
  }

  /** Resolve conflicts based on the chosen strategy */
  resolveConflicts(
    conflicts: ConflictPair[],
    strategy: ConflictResolution
  ): SyncedEvent[] {
    const results: SyncedEvent[] = [];
    const userId = getEffectiveUserId();

    for (const conflict of conflicts) {
      switch (strategy) {
        case 'keep_both':
          results.push({
            event: conflict.localEvent,
            source: 'local',
            conflict,
          });
          results.push({
            event: this.gcalToScheduleEvent(conflict.gcalEvent, userId),
            source: 'remote',
            conflict,
          });
          break;

        case 'local_wins':
          results.push({
            event: conflict.localEvent,
            source: 'local',
            conflict,
          });
          break;

        case 'remote_wins':
          results.push({
            event: this.gcalToScheduleEvent(conflict.gcalEvent, userId),
            source: 'remote',
            conflict,
          });
          break;
      }
    }

    return results;
  }
}

// ──────────────────────────────────────────────────────────────
// Singleton + State Management
// ──────────────────────────────────────────────────────────────

let _instance: GCalSync | null = null;

export function getGCalSync(config?: Partial<GoogleCalendarConfig>): GCalSync {
  if (!_instance) {
    _instance = new GCalSync(config);
  }
  return _instance;
}

export function loadGcalSyncState(): GCalSyncState {
  const saved = loadGcalState();
  const sync = getGCalSync();

  return {
    connected: saved.connected ?? false,
    calendars: [],
    selectedCalendars: saved.selectedCalendars ?? ['primary'],
    syncFrequency: saved.syncFrequency ?? 'manual',
    conflictResolution: saved.conflictResolution ?? 'keep_both',
    lastSyncAt: saved.lastSyncAt ?? null,
    isStub: sync.isPreviewMode,
  };
}

export function saveGcalSyncState(partial: Partial<GCalSyncState>): void {
  const current = loadGcalState();
  saveGcalState({ ...current, ...partial });
}

export function resetGcalSync(): void {
  localStorage.removeItem(GCAL_STORAGE_KEY);
  _instance = null;
}