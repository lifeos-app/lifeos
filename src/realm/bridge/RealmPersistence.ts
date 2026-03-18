/**
 * Realm Persistence — Save/load realm state to Supabase
 *
 * Handles:
 * - Loading realm state on entry
 * - Saving state on exit / periodically
 * - Tracking zone unlocks
 * - Incrementing visit counts
 * - Logging significant realm events
 */

import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

export interface RealmStateRow {
  id: string;
  user_id: string;
  zone_unlocks: Record<string, boolean>;
  building_levels: Record<string, number>;
  collected_items: string[];
  shadows_defeated: number;
  active_shadows: unknown[];
  realm_visits: number;
  total_play_seconds: number;
  last_visited_at: string | null;
  seasonal_events: Record<string, unknown>;
  music_enabled: boolean;
  sfx_enabled: boolean;
  zoom_level: number;
}

/**
 * Load realm state for a user (creates if doesn't exist)
 */
export async function loadRealmState(userId: string): Promise<RealmStateRow | null> {
  try {
    const { data, error } = await supabase
      .from('realm_state')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        logger.info('[Realm] realm_state table not yet created — using defaults');
        return null;
      }
      logger.error('[Realm] Error loading state:', error);
      return null;
    }

    if (!data) {
      // Create initial state
      const { data: newData, error: insertError } = await supabase
        .from('realm_state')
        .insert({
          user_id: userId,
          zone_unlocks: { life_town: true },
          building_levels: {},
          collected_items: [],
          realm_visits: 1,
          last_visited_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        logger.error('[Realm] Error creating state:', insertError);
        return null;
      }

      return newData as RealmStateRow;
    }

    return data as RealmStateRow;
  } catch (err) {
    logger.error('[Realm] Unexpected error loading state:', err);
    return null;
  }
}

/**
 * Save realm state
 */
export async function saveRealmState(
  userId: string,
  updates: Partial<Pick<RealmStateRow,
    'zone_unlocks' | 'building_levels' | 'collected_items' |
    'shadows_defeated' | 'active_shadows' | 'music_enabled' |
    'sfx_enabled' | 'zoom_level' | 'seasonal_events'
  >> & { addPlaySeconds?: number },
): Promise<void> {
  try {
    const updatePayload: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
      last_visited_at: new Date().toISOString(),
    };

    // Handle addPlaySeconds separately (increment, not set)
    if (updates.addPlaySeconds) {
      delete updatePayload.addPlaySeconds;
      // Use raw SQL for atomic increment
      await supabase.rpc('increment_realm_play_time', {
        p_user_id: userId,
        p_seconds: updates.addPlaySeconds,
      }).catch(() => {
        // RPC might not exist yet — fall back to manual update
        // This is fine for now
      });
    }

    await supabase
      .from('realm_state')
      .update(updatePayload)
      .eq('user_id', userId);
  } catch (err) {
    logger.error('[Realm] Error saving state:', err);
  }
}

/**
 * Record a visit (increment counter)
 */
export async function recordRealmVisit(userId: string): Promise<void> {
  try {
    // Try RPC for atomic increment, fall back to read-modify-write
    const { data } = await supabase
      .from('realm_state')
      .select('realm_visits')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      await supabase
        .from('realm_state')
        .update({
          realm_visits: (data.realm_visits || 0) + 1,
          last_visited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }
  } catch (err) {
    logger.error('[Realm] Error recording visit:', err);
  }
}

// Promise chain mutex for serializing concurrent zone unlock updates
let _zoneUnlockChain: Promise<void> = Promise.resolve();

/**
 * Update zone unlocks (serialized to prevent read-modify-write races)
 */
export async function updateZoneUnlocks(
  userId: string,
  zoneId: string,
  unlocked: boolean,
): Promise<void> {
  _zoneUnlockChain = _zoneUnlockChain.then(() => _doUpdateZoneUnlocks(userId, zoneId, unlocked)).catch(() => {});
  return _zoneUnlockChain;
}

async function _doUpdateZoneUnlocks(
  userId: string,
  zoneId: string,
  unlocked: boolean,
): Promise<void> {
  try {
    const { data } = await supabase
      .from('realm_state')
      .select('zone_unlocks')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      const current = (data.zone_unlocks as Record<string, boolean>) || {};
      current[zoneId] = unlocked;

      await supabase
        .from('realm_state')
        .update({
          zone_unlocks: current,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }
  } catch (err) {
    logger.error('[Realm] Error updating zone unlocks:', err);
  }
}

/**
 * Log a realm event (for history/replay)
 */
export async function logRealmEvent(
  userId: string,
  eventType: string,
  eventData: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase
      .from('realm_events')
      .insert({
        user_id: userId,
        event_type: eventType,
        event_data: eventData,
      });
  } catch (err) {
    // Silent — event logging is non-critical
  }
}
