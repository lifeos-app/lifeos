/**
 * Flora Fetch Hook — The Realm
 *
 * Fetches botanical species data from the realm_flora Supabase table.
 * Module-level cache ensures a single fetch across all consumers.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { FloraSpecies } from '../data/flora';
import { logger } from '../../utils/logger';

const floraCache: Map<string, FloraSpecies> = new Map();
let fetchPromise: Promise<void> | null = null;
let hasFetched = false;

async function fetchFlora(): Promise<void> {
  if (hasFetched) return;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('realm_flora')
        .select('*');

      if (error) {
        logger.warn('[flora] Failed to fetch realm_flora:', error.message);
        return;
      }

      if (data) {
        for (const row of data) {
          floraCache.set(row.species_key, row as FloraSpecies);
        }
      }
    } catch (err) {
      logger.warn('[flora] Error fetching flora:', err);
    } finally {
      hasFetched = true;
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

/**
 * Returns a Map of species_key → FloraSpecies.
 * Fire-and-forget fetch on mount; returns whatever is cached (may be empty initially).
 */
export function useFlora(): Map<string, FloraSpecies> {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (hasFetched && floraCache.size > 0) return;
    fetchFlora().then(() => setTick(t => t + 1));
  }, []);

  return floraCache;
}

/** Direct access to the flora cache (for non-React contexts) */
export function getFloraCache(): Map<string, FloraSpecies> {
  return floraCache;
}

/** Trigger a fetch if not already done (for non-React contexts) */
export function prefetchFlora(): Promise<void> {
  return fetchFlora();
}
