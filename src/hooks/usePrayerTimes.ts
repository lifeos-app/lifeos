/**
 * usePrayerTimes — Hook for prayer/devotion time markers
 * 
 * Reads user's junction tradition, gets location (cached),
 * calculates prayer times, and determines next/current prayer.
 * Recalculates every minute.
 */

import { useState, useEffect, useMemo } from 'react';
import { useJunction } from './useJunction';
import { calculatePrayerTimes, type PrayerTime } from '../lib/prayer-times';

// Default location: Melbourne, Australia
const DEFAULT_LAT = -37.8136;
const DEFAULT_LNG = 144.9631;
const LOCATION_CACHE_KEY = 'lifeos-prayer-location';

interface CachedLocation {
  lat: number;
  lng: number;
  timestamp: number;
}

function getCachedLocation(): CachedLocation | null {
  try {
    const raw = localStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedLocation;
    // Cache for 24 hours
    if (Date.now() - cached.timestamp > 24 * 3600 * 1000) return null;
    return cached;
  } catch {
    return null;
  }
}

function setCachedLocation(lat: number, lng: number) {
  try {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ lat, lng, timestamp: Date.now() }));
  } catch { /* ignore */ }
}

export function usePrayerTimes(): {
  prayerTimes: PrayerTime[];
  nextPrayer: PrayerTime | null;
  currentPrayer: PrayerTime | null;
  loading: boolean;
  tradition: string | null;
} {
  const { tradition, isEquipped, loading: junctionLoading } = useJunction();
  const [location, setLocation] = useState<{ lat: number; lng: number }>(() => {
    const cached = getCachedLocation();
    return cached ? { lat: cached.lat, lng: cached.lng } : { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
  });
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  // Only use geolocation if already granted — NEVER prompt the user
  useEffect(() => {
    const cached = getCachedLocation();
    if (cached) {
      setLocation({ lat: cached.lat, lng: cached.lng });
      setLocationLoaded(true);
      return;
    }

    // Check permission state first — only proceed if already 'granted'
    if (navigator.permissions && navigator.geolocation) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              setCachedLocation(pos.coords.latitude, pos.coords.longitude);
              setLocationLoaded(true);
            },
            () => setLocationLoaded(true),
            { timeout: 5000, maximumAge: 3600000 }
          );
        } else {
          // Not granted — use Melbourne default, don't prompt
          setLocationLoaded(true);
        }
      }).catch(() => setLocationLoaded(true));
    } else {
      setLocationLoaded(true);
    }
  }, []);

  // Recalculate every minute
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate prayer times
  const prayerTimes = useMemo(() => {
    if (!isEquipped || !tradition?.slug) return [];
    const today = new Date();
    return calculatePrayerTimes(tradition.slug, today, location.lat, location.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEquipped, tradition?.slug, location.lat, location.lng, tick]);

  // Determine next and current prayer
  const { nextPrayer, currentPrayer } = useMemo(() => {
    if (prayerTimes.length === 0) return { nextPrayer: null, currentPrayer: null };

    const now = new Date();
    let next: PrayerTime | null = null;
    let current: PrayerTime | null = null;

    for (const pt of prayerTimes) {
      const prayerEnd = new Date(pt.time.getTime() + pt.duration_minutes * 60000);

      // Is this prayer currently active?
      if (now >= pt.time && now < prayerEnd) {
        current = pt;
      }

      // Is this the next upcoming prayer?
      if (pt.time > now && !next) {
        next = pt;
      }
    }

    return { nextPrayer: next, currentPrayer: current };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prayerTimes, tick]);

  const loading = junctionLoading || (!locationLoaded && !getCachedLocation());

  return {
    prayerTimes,
    nextPrayer,
    currentPrayer,
    loading,
    tradition: tradition?.slug || null,
  };
}
