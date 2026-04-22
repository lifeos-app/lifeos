/**
 * Live Activity Store — Zustand
 *
 * Tracks active live sessions (e.g., "Working at Site A", "Driving to work").
 * Handles start/stop/update lifecycle and distributes data on completion.
 *
 * ALL writes go through local-db first (offline-first), then sync to Supabase.
 * No direct Supabase writes in distribution engine.
 */

import { create } from 'zustand';
import { db as supabase } from '../lib/data-access';
import { genId } from '../utils/date';
import { logger } from '../utils/logger';
import { isOnline } from '../lib/offline';
import { localInsert, localUpdate, localQuery, localGet, getEffectiveUserId } from '../lib/local-db';
import { syncNow } from '../lib/sync-engine';

// ─── Types ──────────────────────────────────────────

export interface LiveEventMetadata {
  odometer_start?: number;
  odometer_end?: number;
  expected_income?: number;
  actual_income?: number;
  notes?: string[];
  mood?: string;
  business_id?: string;
  client_id?: string;
  category?: string;
  location?: string;
  km_driven?: number;
  is_deductible?: boolean;
  [key: string]: unknown;
}

export interface LiveEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  status: string;
  is_live: boolean;
  metadata: LiveEventMetadata;
  user_id: string;
  color?: string;
  location?: string | null;
  category?: string;
  [key: string]: unknown;
}

interface LiveActivityState {
  activeEvent: LiveEvent | null;
  elapsedSeconds: number;
  metadata: LiveEventMetadata;
  _intervalId: ReturnType<typeof setInterval> | null;
  _recentlyStopped: string | null; // event ID guard to prevent hydrate re-pickup

  // Actions
  startActivity: (title: string, category?: string, startTime?: string, location?: string) => Promise<LiveEvent | null>;
  stopActivity: (endTime?: string, notes?: string) => Promise<void>;
  updateMetadata: (key: string, value: unknown) => Promise<void>;
  tick: () => void;
  hydrate: () => Promise<void>;
  reset: () => void;
}

// ─── ATO Mileage Rate (2025-26) ─────────────────────
const ATO_RATE_PER_KM = 0.88;

// ─── Mood → Score Map ───────────────────────────────
const MOOD_SCORES: Record<string, number> = {
  great: 5, good: 4, neutral: 3, okay: 3,
  bad: 2, terrible: 1, tired: 2, stressed: 2,
  energised: 5, focused: 4, happy: 5, sad: 2,
};

// ─── Distribution Engine (all local-first) ─────────────

async function distributeActivityData(event: LiveEvent) {
  const meta = event.metadata || {};
  const userId = event.user_id;
  const promises: Promise<unknown>[] = [];

  // 1. Auto-log income + transaction (via finance store for offline-first)
  if (meta.expected_income || meta.actual_income) {
    const amount = (meta.actual_income || meta.expected_income) as number;
    const date = event.start_time.slice(0, 10);
    promises.push(
      (async () => {
        try {
          const { useFinanceStore } = await import('./useFinanceStore');
          await useFinanceStore.getState().addIncome({
            user_id: userId,
            amount,
            date,
            description: `${event.title}`,
            source: 'Cleaning',
            business_id: meta.business_id || undefined,
            client_id: meta.client_id || undefined,
            is_recurring: false,
          });
          logger.log(`✅ Income distributed: $${amount}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn('Income distribution failed:', msg);
        }
      })()
    );
  }

  // 2. Auto-log mileage expense + transaction (ATO 88c/km, via finance store)
  if (meta.odometer_start && meta.odometer_end) {
    const km = (meta.odometer_end as number) - (meta.odometer_start as number);
    if (km > 0) {
      const mileageAmount = km * ATO_RATE_PER_KM;
      const date = event.start_time.slice(0, 10);
      promises.push(
        (async () => {
          try {
            const { useFinanceStore } = await import('./useFinanceStore');
            await useFinanceStore.getState().addExpense({
              user_id: userId,
              amount: parseFloat(mileageAmount.toFixed(2)),
              date,
              description: `Mileage: ${km}km (${event.title})`,
              category_id: null,
              is_deductible: true,
              is_recurring: false,
            });
            logger.log(`✅ Mileage distributed: ${km}km = $${mileageAmount.toFixed(2)}`);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn('Mileage distribution failed:', msg);
          }
        })()
      );
    }
  }

  // 3. Auto-log health/mood — LOCAL-FIRST via localInsert/localUpdate
  if (meta.mood) {
    const moodScore = MOOD_SCORES[String(meta.mood).toLowerCase()] || 3;
    const today = new Date().toISOString().slice(0, 10);

    promises.push(
      (async () => {
        try {
          // Check for existing health metric for today (local first)
          const existing = await localQuery<Record<string, unknown>>('health_metrics', 'date', today);
          const userEntry = existing.find(r => r.user_id === userId);

          if (userEntry) {
            // Update existing entry
            await localUpdate('health_metrics', userEntry.id as string, {
              mood_score: moodScore,
              updated_at: new Date().toISOString(),
              synced: false,
            });
          } else {
            // Insert new entry
            await localInsert('health_metrics', {
              id: genId(),
              user_id: userId,
              date: today,
              mood_score: moodScore,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              synced: false,
            });
          }
          logger.log(`✅ Mood distributed: ${meta.mood} (${moodScore}/5)`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn('Mood distribution failed:', msg);
        }
      })()
    );
  }

  // 4. Log to unified_events — LOCAL-FIRST via localInsert
  promises.push(
    (async () => {
      try {
        await localInsert('unified_events', {
          id: genId(),
          user_id: userId,
          type: 'activity',
          timestamp: event.start_time,
          title: event.title,
          details: {
            ...meta,
            end_time: event.end_time,
            duration_seconds: event.end_time
              ? Math.round((new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 1000)
              : null,
          },
          source: 'live_activity',
          is_deleted: false,
          module_source: 'live_activity',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          synced: false,
        });
        logger.log('✅ Unified event logged locally');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn('Unified event insert failed:', msg);
      }
    })()
  );

  await Promise.allSettled(promises);
}

// ─── Store ──────────────────────────────────────────

export const useLiveActivityStore = create<LiveActivityState>((set, get) => ({
  activeEvent: null,
  elapsedSeconds: 0,
  metadata: {},
  _intervalId: null,
  _recentlyStopped: null,

  startActivity: async (title, category, startTime, location) => {
    let userId: string;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || getEffectiveUserId();
    } catch {
      userId = getEffectiveUserId();
    }
    if (!userId) return null;

    const now = startTime || new Date().toISOString();
    const eventId = genId();

    const eventData = {
      id: eventId,
      user_id: userId,
      title: title.trim(),
      start_time: now,
      end_time: null,
      status: 'live',
      is_live: true,
      event_type: category || 'general',
      metadata: { category: category || 'general', location: location || null },
      color: '#00D4FF',
      location: location || null,
      is_deleted: false,
      sync_status: 'synced',
    };

    // Write to IndexedDB first (always succeeds offline)
    try {
      await localInsert('schedule_events', eventData);
    } catch (e) {
      logger.warn('Local insert for live activity failed:', e);
    }

    // Trigger background sync if online; otherwise queue for later
    if (isOnline()) {
      syncNow(userId).catch(() => {});
    }

    const liveEvent: LiveEvent = {
      ...eventData,
      metadata: eventData.metadata as LiveEventMetadata,
    };

    // Start tick interval
    const existingInterval = get()._intervalId;
    if (existingInterval) clearInterval(existingInterval);

    const intervalId = setInterval(() => get().tick(), 1000);

    const elapsed = Math.round((Date.now() - new Date(now).getTime()) / 1000);

    set({
      activeEvent: liveEvent,
      elapsedSeconds: Math.max(0, elapsed),
      metadata: liveEvent.metadata,
      _intervalId: intervalId,
    });

    // Dispatch refresh for other stores
    window.dispatchEvent(new Event('lifeos-refresh'));

    return liveEvent;
  },

  stopActivity: async (endTime, notes) => {
    const { activeEvent, _intervalId, metadata } = get();
    if (!activeEvent) return;

    // Mark as stopping to prevent hydrate() from re-picking up
    const stoppedEventId = activeEvent.id;
    if (_intervalId) clearInterval(_intervalId);
    set({ _intervalId: null, _recentlyStopped: stoppedEventId });

    const finalEndTime = endTime || new Date().toISOString();
    const finalMetadata = { ...metadata };
    if (notes) {
      const existing = Array.isArray(finalMetadata.notes) ? finalMetadata.notes : [];
      finalMetadata.notes = [...existing, notes];
    }

    // Calculate km if odometer data present
    if (finalMetadata.odometer_start && finalMetadata.odometer_end) {
      finalMetadata.km_driven = (finalMetadata.odometer_end as number) - (finalMetadata.odometer_start as number);
      finalMetadata.is_deductible = true;
    }

    const updatedEvent: LiveEvent = {
      ...activeEvent,
      end_time: finalEndTime,
      status: 'completed',
      is_live: false,
      metadata: finalMetadata,
    };

    const updatePayload = {
      end_time: finalEndTime,
      status: 'completed',
      is_live: false,
      metadata: finalMetadata,
      updated_at: new Date().toISOString(),
    };

    // Write to IndexedDB first (always succeeds offline)
    try {
      await localUpdate('schedule_events', activeEvent.id, {
        ...updatePayload,
        synced: false,
      });
    } catch (e) {
      logger.warn('Local update for stop activity failed:', e);
    }

    // Reset UI state
    set({
      activeEvent: null,
      elapsedSeconds: 0,
      metadata: {},
    });

    // Run distribution engine
    try {
      await distributeActivityData(updatedEvent);
    } catch (err) {
      logger.warn('Distribution engine error:', err);
    }

    // Award XP via gamification system with anti-abuse guards — LOCAL-FIRST
    try {
      const durationMin = Math.round((new Date(finalEndTime).getTime() - new Date(activeEvent.start_time).getTime()) / 60000);

      // Guard 1: Minimum duration (5 minutes)
      if (durationMin < 5) {
        logger.log(`⚠️ XP denied: event too short (${durationMin}min, need 5min minimum)`);
      } else {
        // Guard 2: Rate limiting — check recent completions from local DB
        const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
        const recentCompletions = await localQuery<Record<string, unknown>>('event_completions', 'user_id', activeEvent.user_id);

        const recentXP = recentCompletions
          .filter(c => {
            const completedAt = c.completed_at as string;
            return completedAt && completedAt >= oneHourAgo;
          })
          .reduce((sum, c) => sum + ((c.xp_awarded as number) || 0), 0);
        const recentCount = recentCompletions.filter(c => {
          const completedAt = c.completed_at as string;
          return completedAt && completedAt >= oneHourAgo;
        }).length;

        // Guard 3: Max 200 XP per hour, max 10 completions per hour
        if (recentXP >= 200) {
          logger.log(`⚠️ XP denied: hourly XP cap reached (${recentXP}/200)`);
        } else if (recentCount >= 10) {
          logger.log(`⚠️ XP denied: hourly completion cap reached (${recentCount}/10)`);
        } else {
          // Guard 4: Cap XP to remaining hourly budget
          const baseXP = Math.max(10, Math.min(100, Math.round(durationMin * 0.5)));
          const xpAmount = Math.min(200 - recentXP, baseXP);

          // Write XP to local DB first
          await localInsert('event_completions', {
            id: genId(),
            user_id: activeEvent.user_id,
            schedule_event_id: activeEvent.id,
            event_type: finalMetadata.category || 'live_activity',
            duration_min: durationMin,
            xp_awarded: xpAmount,
            metadata: { title: activeEvent.title, ...finalMetadata },
            completed_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            synced: false,
          });

          logger.log(`✅ XP awarded: +${xpAmount} XP for ${activeEvent.title}`);
        }
      }
    } catch (xpErr) {
      logger.warn('XP award error (non-fatal):', xpErr);
    }

    // Clear the recently-stopped guard after 10s
    setTimeout(() => {
      if (get()._recentlyStopped === stoppedEventId) {
        set({ _recentlyStopped: null });
      }
    }, 10000);

    window.dispatchEvent(new Event('lifeos-refresh'));
  },

  updateMetadata: async (key, value) => {
    const { activeEvent, metadata } = get();
    if (!activeEvent) return;

    const newMetadata = { ...metadata };

    // Special handling for notes — append to array
    if (key === 'notes') {
      const existing = Array.isArray(newMetadata.notes) ? newMetadata.notes : [];
      newMetadata.notes = [...existing, String(value)];
    } else {
      (newMetadata as Record<string, unknown>)[key] = value;
    }

    set({ metadata: newMetadata });

    const updatePayload = {
      metadata: newMetadata,
      updated_at: new Date().toISOString(),
      synced: false,
    };

    // Write to IndexedDB first
    try {
      await localUpdate('schedule_events', activeEvent.id, updatePayload);
    } catch (e) {
      logger.warn('Local metadata update failed:', e);
    }
  },

  tick: () => {
    set(state => ({ elapsedSeconds: state.elapsedSeconds + 1 }));
  },

  hydrate: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    // Check for any live events
    const { data: liveEvents } = await supabase
      .from('schedule_events')
      .select('id,title,start_time,end_time,status,is_live,metadata,user_id,color,location,category')
      .eq('user_id', userData.user.id)
      .eq('is_live', true)
      .eq('is_deleted', false)
      .limit(1);

    if (!liveEvents?.length) return;

    const event = liveEvents[0] as LiveEvent;

    // Guard: don't re-pickup an event we just stopped (race condition with Supabase)
    if (get()._recentlyStopped === event.id) return;
    // Also skip if we already have this event active
    if (get().activeEvent?.id === event.id) return;
    const elapsed = Math.round((Date.now() - new Date(event.start_time).getTime()) / 1000);

    // Clear any existing interval
    const existingInterval = get()._intervalId;
    if (existingInterval) clearInterval(existingInterval);

    const intervalId = setInterval(() => get().tick(), 1000);

    set({
      activeEvent: event,
      elapsedSeconds: Math.max(0, elapsed),
      metadata: event.metadata || {},
      _intervalId: intervalId,
    });
  },

  reset: () => {
    const { _intervalId } = get();
    if (_intervalId) clearInterval(_intervalId);
    set({
      activeEvent: null,
      elapsedSeconds: 0,
      metadata: {},
      _intervalId: null,
    });
  },
}));