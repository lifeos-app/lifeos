/**
 * useFasting — Hook for fasting state and progress
 * 
 * Reads the user's equipped tradition from useJunction(),
 * calculates today's fasting window, and returns progress + encouragement.
 * 
 * Works fully offline — no API calls for fasting calculations.
 * Updates every minute.
 */

import { useState, useEffect, useMemo } from 'react';
import { useJunction } from './useJunction';
import {
  getTodaysFasting,
  isCurrentlyFasting,
  getFastingProgress,
  getFastingEncouragement,
  formatFastingDuration,
  getFastingLabel,
  type FastingPeriod,
  type FastingProgress,
} from '../lib/fasting-engine';

export interface UseFastingResult {
  currentFast: FastingPeriod | null;
  isFasting: boolean;
  progress: FastingProgress | null;
  nextMeal: Date | null;
  encouragement: string;
  fastingLabel: string;
  loading: boolean;
}

// Melbourne default coordinates
const DEFAULT_LAT = -37.8136;
const DEFAULT_LNG = 144.9631;

export function useFasting(): UseFastingResult {
  const { tradition, isEquipped, loading: junctionLoading } = useJunction();
  const [tick, setTick] = useState(0);

  // Update every minute
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const result = useMemo((): Omit<UseFastingResult, 'loading'> => {
    if (!isEquipped || !tradition) {
      return {
        currentFast: null,
        isFasting: false,
        progress: null,
        nextMeal: null,
        encouragement: '',
        fastingLabel: '',
      };
    }

    const now = new Date();
    const slug = tradition.slug;

    // Use Melbourne as default location. Could be extended to read from user profile.
    const lat = DEFAULT_LAT;
    const lng = DEFAULT_LNG;

    const fastingPeriod = getTodaysFasting(slug, now, lat, lng);

    if (!fastingPeriod) {
      return {
        currentFast: null,
        isFasting: false,
        progress: null,
        nextMeal: null,
        encouragement: '',
        fastingLabel: '',
      };
    }

    const fasting = isCurrentlyFasting(fastingPeriod);
    const progress = getFastingProgress(fastingPeriod);
    const encouragement = getFastingEncouragement(progress, slug);
    const label = getFastingLabel(fastingPeriod);

    // Next meal = fasting end time
    const nextMeal = fasting ? fastingPeriod.endTime : null;

    return {
      currentFast: fastingPeriod,
      isFasting: fasting,
      progress,
      nextMeal,
      encouragement,
      fastingLabel: label,
    };
  }, [tradition, isEquipped, tick]);

  return {
    ...result,
    loading: junctionLoading,
  };
}

// Re-export types and utilities for convenience
export { formatFastingDuration, getFastingLabel };
export type { FastingPeriod, FastingProgress };
