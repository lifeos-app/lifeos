/**
 * GCalSyncPanel.tsx — Google Calendar Sync UI Component
 *
 * Dark-themed panel for configuring and running Google Calendar sync.
 * Shows Preview Mode indicator when real Google OAuth is not configured.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  Link2,
  Unlink,
  Clock,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import {
  GCalSync,
  getGCalSync,
  loadGcalSyncState,
  saveGcalSyncState,
  resetGcalSync,
  type GCalSyncState,
  type CalendarSummary,
  type GCalEvent,
  type ConflictResolution,
  type ConflictPair,
} from '../lib/gcal-sync';
import { localGetAll } from '../lib/local-db';
import { logger } from '../utils/logger';
import type { ScheduleEvent } from '../types/database';

export function GCalSyncPanel() {
  const [sync, setSync] = useState<GCalSync | null>(null);
  const [state, setState] = useState<GCalSyncState>(loadGcalSyncState());
  const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
  const [previewEvents, setPreviewEvents] = useState<GCalEvent[]>([]);
  const [conflicts, setConflicts] = useState<ConflictPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ imported: number; conflicts: number } | null>(null);

  // Initialize sync engine
  useEffect(() => {
    const gcal = getGCalSync();
    setSync(gcal);
    setState(loadGcalSyncState());
  }, []);

  // Load calendars when connected
  const loadCalendars = useCallback(async () => {
    if (!sync) return;
    setLoading(true);
    setError(null);

    try {
      const cals = await sync.getCalendars();
      setCalendars(cals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendars');
    } finally {
      setLoading(false);
    }
  }, [sync]);

  // Preview sync — show events that would be imported
  const previewSync = useCallback(async () => {
    if (!sync) return;
    setLoading(true);
    setError(null);
    setSyncResult(null);

    try {
      const now = new Date();
      const twoWeeksOut = new Date(now);
      twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);

      const selectedCals = state.selectedCalendars.length > 0
        ? state.selectedCalendars
        : ['primary'];

      let allEvents: GCalEvent[] = [];
      for (const calId of selectedCals) {
        const events = await sync.getEvents(calId, now, twoWeeksOut);
        allEvents = allEvents.concat(events);
      }

      setPreviewEvents(allEvents);

      // Detect conflicts with local events
      const localEvents = await localGetAll<ScheduleEvent>('events');
      const nonDeleted = localEvents.filter(e => !e.is_deleted);
      const detectedConflicts = sync.detectConflicts(nonDeleted, allEvents);
      setConflicts(detectedConflicts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview sync');
    } finally {
      setLoading(false);
    }
  }, [sync, state.selectedCalendars]);

  // Run sync
  const runSync = useCallback(async () => {
    if (!sync) return;
    setSyncing(true);
    setError(null);

    try {
      const now = new Date();
      const twoWeeksOut = new Date(now);
      twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);

      const selectedCals = state.selectedCalendars.length > 0
        ? state.selectedCalendars
        : ['primary'];

      let allEvents: GCalEvent[] = [];
      for (const calId of selectedCals) {
        const events = await sync.getEvents(calId, now, twoWeeksOut);
        allEvents = allEvents.concat(events);
      }

      // Run conflict detection
      const localEvents = await localGetAll<ScheduleEvent>('events');
      const nonDeleted = localEvents.filter(e => !e.is_deleted);
      const detectedConflicts = sync.detectConflicts(nonDeleted, allEvents);
      setConflicts(detectedConflicts);

      // Resolve conflicts
      sync.resolveConflicts(detectedConflicts, state.conflictResolution);

      // Import events
      const imported = await sync.syncToSchedule(allEvents);

      setSyncResult({ imported, conflicts: detectedConflicts.length });

      // Update state with last sync time
      const newState: Partial<GCalSyncState> = {
        lastSyncAt: new Date().toISOString(),
      };
      saveGcalSyncState(newState);
      setState({ ...state, ...newState });

      logger.log(`[GCalSyncPanel] Sync complete: ${imported} imported, ${detectedConflicts.length} conflicts`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [sync, state]);

  // Connect / disconnect
  const handleConnect = useCallback(() => {
    if (!sync) return;
    if (sync.isPreviewMode) {
      // In preview mode, simulate connection
      const newState: Partial<GCalSyncState> = { connected: true };
      saveGcalSyncState(newState);
      setState({ ...state, ...newState });
      loadCalendars();
    } else {
      // Redirect to OAuth
      window.location.href = sync.getAuthUrl();
    }
  }, [sync, state, loadCalendars]);

  const handleDisconnect = useCallback(() => {
    resetGcalSync();
    setState(loadGcalSyncState());
    setCalendars([]);
    setPreviewEvents([]);
    setConflicts([]);
    setSyncResult(null);
    setError(null);
  }, []);

  // Update settings
  const updateSettings = useCallback((updates: Partial<GCalSyncState>) => {
    const newState = { ...state, ...updates };
    setState(newState);
    saveGcalSyncState(updates);
  }, [state]);

  // Format time for display
  const formatTime = (dateTime?: string, date?: string) => {
    if (dateTime) {
      return new Date(dateTime).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
    if (date) return date;
    return 'All day';
  };

  return (
    <div style={{
      padding: '24px',
      maxWidth: '640px',
      margin: '0 auto',
      color: '#e2e8f0',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Calendar size={24} style={{ color: '#4285F4' }} />
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Google Calendar Sync</h2>
      </div>

      {/* Preview Mode Banner */}
      {state.isStub && (
        <div style={{
          background: '#1e1b4b',
          border: '1px solid #4338ca',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
        }}>
          <Info size={18} style={{ color: '#a5b4fc', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 600, color: '#a5b4fc', marginBottom: '4px' }}>
              Preview Mode
            </div>
            <div style={{ fontSize: '13px', color: '#c7d2fe', lineHeight: 1.4 }}>
              Connect your Google Account to enable real calendar sync. Currently showing sample data
              with recurring events (Team Standup, Lunch Break, Focus Time).
            </div>
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div style={{
        background: '#1a1a2e',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {state.connected ? (
              <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
            ) : (
              <XCircle size={18} style={{ color: '#64748b' }} />
            )}
            <span style={{ fontSize: '14px', fontWeight: 500 }}>
              {state.connected ? 'Connected' : 'Not Connected'}
            </span>
            {state.isStub && state.connected && (
              <span style={{
                fontSize: '11px',
                color: '#a5b4fc',
                background: '#312e81',
                padding: '2px 8px',
                borderRadius: '4px',
                marginLeft: '4px',
              }}>
                Preview
              </span>
            )}
          </div>

          {state.connected ? (
            <button
              onClick={handleDisconnect}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: '1px solid #ef4444',
                color: '#ef4444',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <Unlink size={14} />
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#4285F4',
                border: 'none',
                color: '#fff',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Link2 size={14} />
              Connect Google Calendar
            </button>
          )}
        </div>

        {/* Last Sync */}
        {state.lastSyncAt && (
          <div style={{
            fontSize: '12px',
            color: '#94a3b8',
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <Clock size={12} />
            Last synced: {new Date(state.lastSyncAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Settings (visible when connected) */}
      {state.connected && (
        <>
          {/* Calendar Selector */}
          <div style={{
            background: '#1a1a2e',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#cbd5e1' }}>
              Calendar Selection
            </h3>

            {loading ? (
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>Loading calendars...</div>
            ) : calendars.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {calendars.map(cal => (
                  <label
                    key={cal.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={state.selectedCalendars.includes(cal.id)}
                      onChange={() => {
                        const selected = state.selectedCalendars.includes(cal.id)
                          ? state.selectedCalendars.filter(id => id !== cal.id)
                          : [...state.selectedCalendars, cal.id];
                        updateSettings({ selectedCalendars: selected });
                      }}
                      style={{ accentColor: cal.color }}
                    />
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: cal.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: '#e2e8f0' }}>{cal.name}</span>
                    {cal.primary && (
                      <span style={{
                        fontSize: '10px',
                        color: '#94a3b8',
                        background: '#334155',
                        padding: '1px 6px',
                        borderRadius: '3px',
                      }}>
                        Primary
                      </span>
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>No calendars found</div>
            )}

            {!loading && calendars.length === 0 && (
              <button
                onClick={loadCalendars}
                style={{
                  marginTop: '8px',
                  background: '#334155',
                  border: 'none',
                  color: '#e2e8f0',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <RefreshCw size={12} />
                Load Calendars
              </button>
            )}
          </div>

          {/* Sync Settings */}
          <div style={{
            background: '#1a1a2e',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#cbd5e1' }}>
              Sync Settings
            </h3>

            {/* Sync Frequency */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                Sync Frequency
              </label>
              <select
                value={state.syncFrequency}
                onChange={(e) => updateSettings({ syncFrequency: e.target.value as 'manual' | 'daily' | 'hourly' })}
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#e2e8f0',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  width: '100%',
                  cursor: 'pointer',
                }}
              >
                <option value="manual">Manual</option>
                <option value="daily">Daily</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>

            {/* Conflict Resolution */}
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                Conflict Resolution
              </label>
              <select
                value={state.conflictResolution}
                onChange={(e) => updateSettings({ conflictResolution: e.target.value as ConflictResolution })}
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#e2e8f0',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  width: '100%',
                  cursor: 'pointer',
                }}
              >
                <option value="keep_both">Keep Both</option>
                <option value="local_wins">Local Wins</option>
                <option value="remote_wins">Remote Wins</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px',
          }}>
            <button
              onClick={previewSync}
              disabled={loading || syncing}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: '#334155',
                border: '1px solid #475569',
                color: '#e2e8f0',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: loading || syncing ? 'not-allowed' : 'pointer',
                opacity: loading || syncing ? 0.6 : 1,
              }}
            >
              <ChevronRight size={16} />
              Preview Sync
            </button>

            <button
              onClick={runSync}
              disabled={loading || syncing}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: '#4285F4',
                border: 'none',
                color: '#fff',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: loading || syncing ? 'not-allowed' : 'pointer',
                opacity: loading || syncing ? 0.6 : 1,
              }}
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div style={{
              background: '#450a0a',
              border: '1px solid #dc2626',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: '#fca5a5',
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Sync Result */}
          {syncResult && (
            <div style={{
              background: '#052e16',
              border: '1px solid #16a34a',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#86efac',
            }}>
              Sync complete: {syncResult.imported} event(s) imported
              {syncResult.conflicts > 0 && `, ${syncResult.conflicts} conflict(s) detected`}
            </div>
          )}

          {/* Preview Events */}
          {previewEvents.length > 0 && (
            <div style={{
              background: '#1a1a2e',
              borderRadius: '12px',
              padding: '16px',
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#cbd5e1' }}>
                Events to Import ({previewEvents.length})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {previewEvents.slice(0, 20).map(evt => (
                  <div
                    key={evt.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      background: '#0f172a',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  >
                    <Calendar size={14} style={{ color: '#4285F4', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {evt.summary}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {formatTime(evt.start.dateTime, evt.start.date)}
                      </div>
                    </div>
                    {evt.isRecurring && (
                      <span style={{
                        fontSize: '10px',
                        color: '#a78bfa',
                        background: '#1e1b4b',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        flexShrink: 0,
                      }}>
                        Recurring
                      </span>
                    )}
                  </div>
                ))}

                {previewEvents.length > 20 && (
                  <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '4px' }}>
                    ...and {previewEvents.length - 20} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div style={{
              background: '#1a1a2e',
              borderRadius: '12px',
              padding: '16px',
              marginTop: '16px',
              border: '1px solid #f59e0b',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fbbf24' }}>
                  Conflicts ({conflicts.length})
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {conflicts.slice(0, 10).map((conflict, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 10px',
                      background: '#0f172a',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ color: '#fbbf24', fontWeight: 500 }}>
                      {conflict.conflictType.replace('_', ' ')}
                    </div>
                    <div style={{ color: '#94a3b8', marginTop: '2px' }}>
                      Local: {conflict.localEvent.title} vs Google: {conflict.gcalEvent.summary}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default GCalSyncPanel;