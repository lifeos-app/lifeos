// LifeOS Gamification — Local-DB Layer
// All gamification reads/writes go through IndexedDB first.
// Supabase sync happens in the background via syncNow().

import {
  localInsert,
  localUpdate,
  localGetAll,
  localGet,
  type TableName,
} from '../local-db';
import { syncNow } from '../sync-engine';
import { logger } from '../../utils/logger';
import type { ActionType, XPActionMetadata } from './xp-engine';
import type { Achievement } from './achievements';

// ── XP STATUS ──

export interface XPStatus {
  user_id: string;
  total_xp: number;
  level: number;
  title: string;
  stats: Record<string, number>;
  created_at: string;
  updated_at: string;
}

/**
 * Get the user's current XP status from local-db.
 * Falls back to supabase-like data (empty) if no local record exists.
 */
export async function getXPStatus(userId: string): Promise<XPStatus | null> {
  try {
    const record = await localGet<XPStatus>('user_xp', userId);
    return record || null;
  } catch (e) {
    logger.warn('[gamification-db] Failed to get XP status from local-db:', e);
    return null;
  }
}

/**
 * Get all XP events for a user from local-db.
 */
export async function getXPEvents(userId: string): Promise<any[]> {
  try {
    const all = await localGetAll<any>('xp_events');
    return all.filter(e => e.user_id === userId);
  } catch (e) {
    logger.warn('[gamification-db] Failed to get XP events from local-db:', e);
    return [];
  }
}

// ── AWARD XP EVENT ──

/**
 * Write an XP event to local-db and trigger background sync.
 * Returns the created record.
 */
export async function awardXPEvent(
  userId: string,
  actionType: ActionType,
  xpAmount: number,
  multiplier: number,
  description: string
): Promise<any> {
  try {
    const record = await localInsert('xp_events', {
      user_id: userId,
      action_type: actionType,
      xp_amount: xpAmount,
      multiplier,
      description,
    });

    // Trigger background sync (debounced)
    syncNow(userId).catch(() => { /* non-blocking */ });

    return record;
  } catch (e) {
    logger.error('[gamification-db] Failed to award XP event:', e);
    throw e;
  }
}

// ── UPDATE USER XP ──

/**
 * Update (or create) the user_xp row in local-db.
 * Uses user_id as the keyPath.
 */
export async function updateUserXP(
  userId: string,
  updates: {
    total_xp?: number;
    level?: number;
    title?: string;
    stats?: Record<string, number>;
    updated_at?: string;
  }
): Promise<void> {
  try {
    const existing = await localGet<XPStatus>('user_xp', userId);

    if (existing) {
      await localUpdate('user_xp', userId, {
        ...updates,
        updated_at: updates.updated_at || new Date().toISOString(),
      });
    } else {
      // Insert new user_xp record (keyPath is user_id)
      await localInsert('user_xp', {
        user_id: userId,
        total_xp: updates.total_xp || 0,
        level: updates.level || 1,
        title: updates.title || 'Awakened',
        stats: updates.stats || { productivity: 0, consistency: 0, health: 0, finance: 0, knowledge: 0, social: 0 },
        ...updates,
      });
    }

    // Trigger background sync (debounced)
    syncNow(userId).catch(() => { /* non-blocking */ });
  } catch (e) {
    logger.error('[gamification-db] Failed to update user XP:', e);
    throw e;
  }
}

// ── ACHIEVEMENTS ──

/**
 * Get the user's current achievements from local-db.
 */
export async function getUserAchievements(userId: string): Promise<any[]> {
  try {
    const all = await localGetAll<any>('achievements');
    return all.filter(a => a.user_id === userId);
  } catch (e) {
    logger.warn('[gamification-db] Failed to get achievements from local-db:', e);
    return [];
  }
}

/**
 * Upsert an achievement record in local-db and trigger sync.
 */
export async function upsertAchievement(
  userId: string,
  achievementId: string,
  progress: number,
  unlockedAt: string | null
): Promise<void> {
  try {
    // Find existing record by constructing the composite key
    // achievements table uses 'id' as keyPath
    // We use "userId_achievementId" as the local id for composite key
    const localId = `${userId}_${achievementId}`;
    const existing = await localGet<any>('achievements', localId);

    if (existing) {
      await localUpdate('achievements', localId, {
        progress: Math.min(progress, 1),
        unlocked_at: unlockedAt,
        updated_at: new Date().toISOString(),
      });
    } else {
      await localInsert('achievements', {
        id: localId,
        user_id: userId,
        achievement_id: achievementId,
        progress: Math.min(progress, 1),
        unlocked_at: unlockedAt,
      });
    }

    // Trigger background sync (debounced)
    syncNow(userId).catch(() => { /* non-blocking */ });
  } catch (e) {
    logger.error('[gamification-db] Failed to upsert achievement:', e);
    throw e;
  }
}

// ── DATA READS FOR ACHIEVEMENT STATS ──

/**
 * Read records from local-db for tables used in achievement evaluation.
 * Only reads from tables that are synced (in SYNC_TABLES).
 * Falls back to empty arrays on error so achievement checks degrade gracefully.
 */
export async function getLocalRecords<T = any>(table: TableName, userId?: string): Promise<T[]> {
  try {
    const all = await localGetAll<T>(table);
    // localGetAll already filters by effective user, but for achievement evaluation
    // we may want a specific user_id filter
    if (userId && table !== 'user_xp' && table !== 'xp_events' && table !== 'achievements') {
      return all.filter((r: any) => !r.user_id || r.user_id === userId);
    }
    return all;
  } catch (e) {
    logger.warn(`[gamification-db] Failed to get local records for ${table}:`, e);
    return [];
  }
}

/**
 * Count non-deleted records from a synced table in local-db.
 */
export async function countLocalRecords(table: TableName, userId: string): Promise<number> {
  const records = await getLocalRecords<any>(table, userId);
  return records.filter(r => !r.is_deleted && !r.deleted_at).length;
}

// ── CHECK AND AWARD ACHIEVEMENTS ──

/**
 * Convenience: Check all achievements and persist results to local-db.
 * Used by xp-engine after awarding XP.
 */
export async function checkAndPersistAchievements(
  userId: string,
  evaluateFn: (stats: any) => Array<{ achievement: Achievement; unlocked: boolean; progress: number }>
): Promise<Achievement[]> {
  try {
    const results = await evaluateFn(null); // stats passed by caller
    const newlyUnlocked: Achievement[] = [];

    for (const { achievement, unlocked, progress } of results) {
      const unlockedAt = unlocked ? new Date().toISOString() : null;
      await upsertAchievement(userId, achievement.id, progress, unlockedAt);
      if (unlocked) {
        newlyUnlocked.push(achievement);
      }
    }

    return newlyUnlocked;
  } catch (e) {
    logger.error('[gamification-db] Failed to check and persist achievements:', e);
    return [];
  }
}