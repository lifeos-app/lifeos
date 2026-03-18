/**
 * Fauna Fetch Hook — The Realm
 *
 * Fetches companion animal species data from the realm_fauna Supabase table.
 * Module-level cache ensures a single fetch across all consumers.
 * Mirrors useFlora.ts pattern.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { FaunaSpecies, UserCompanion } from '../data/companions';
import { logger } from '../../utils/logger';

const faunaCache: Map<string, FaunaSpecies> = new Map();
let companionCache: UserCompanion | null = null;
let faunaFetchPromise: Promise<void> | null = null;
let hasFetchedFauna = false;
let companionFetchPromise: Promise<void> | null = null;
let hasFetchedCompanion = false;

async function fetchFauna(): Promise<void> {
  if (hasFetchedFauna) return;
  if (faunaFetchPromise) return faunaFetchPromise;

  faunaFetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('realm_fauna')
        .select('*');

      if (error) {
        logger.warn('[fauna] Failed to fetch realm_fauna:', error.message);
        return;
      }

      if (data) {
        for (const row of data) {
          faunaCache.set(row.species_key, row as FaunaSpecies);
        }
      }
    } catch (err) {
      logger.warn('[fauna] Error fetching fauna:', err);
    } finally {
      hasFetchedFauna = true;
      faunaFetchPromise = null;
    }
  })();

  return faunaFetchPromise;
}

/** Trigger a fetch if not already done (for non-React contexts) */
export function prefetchFauna(): void {
  fetchFauna();
}

/** Direct access to the fauna cache (for non-React contexts) */
export function getFaunaCache(): Map<string, FaunaSpecies> {
  return faunaCache;
}

/** Direct access to the companion cache */
export function getCompanionCache(): UserCompanion | null {
  return companionCache;
}

/** Fetch the user's companion from Supabase */
export async function fetchCompanion(userId: string): Promise<UserCompanion | null> {
  if (hasFetchedCompanion) return companionCache;
  if (companionFetchPromise) {
    await companionFetchPromise;
    return companionCache;
  }

  companionFetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('realm_companions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        logger.warn('[fauna] Failed to fetch companion:', error.message);
        return;
      }

      companionCache = data as UserCompanion | null;
    } catch (err) {
      logger.warn('[fauna] Error fetching companion:', err);
    } finally {
      hasFetchedCompanion = true;
      companionFetchPromise = null;
    }
  })();

  await companionFetchPromise;
  return companionCache;
}

/** Fire-and-forget bond XP update */
export function updateCompanionBond(userId: string, xpDelta: number): void {
  if (!companionCache) return;

  // Optimistic local update
  companionCache.bond_xp += xpDelta;
  companionCache.last_active_at = new Date().toISOString();

  supabase
    .from('realm_companions')
    .update({
      bond_xp: companionCache.bond_xp,
      last_active_at: companionCache.last_active_at,
    })
    .eq('user_id', userId)
    .then(({ error }) => {
      if (error) logger.warn('[fauna] Failed to update bond:', error.message);
    });
}

/** One-time companion name update */
export async function nameCompanion(userId: string, name: string): Promise<boolean> {
  const { error } = await supabase
    .from('realm_companions')
    .update({ companion_name: name })
    .eq('user_id', userId);

  if (error) {
    logger.warn('[fauna] Failed to name companion:', error.message);
    return false;
  }

  if (companionCache) {
    companionCache.companion_name = name;
  }
  return true;
}

/** Create a new companion for the user */
export async function createCompanion(userId: string, speciesKey: string): Promise<UserCompanion | null> {
  const { data, error } = await supabase
    .from('realm_companions')
    .insert({
      user_id: userId,
      species_key: speciesKey,
      bond_level: 1,
      bond_xp: 0,
      state: 'active',
    })
    .select()
    .single();

  if (error) {
    logger.warn('[fauna] Failed to create companion:', error.message);
    return null;
  }

  companionCache = data as UserCompanion;
  return companionCache;
}

/**
 * React hook returning fauna map. Fire-and-forget fetch on mount.
 */
export function useFauna(): Map<string, FaunaSpecies> {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (hasFetchedFauna && faunaCache.size > 0) return;
    fetchFauna().then(() => setTick(t => t + 1));
  }, []);

  return faunaCache;
}
