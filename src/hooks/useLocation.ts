/**
 * useLocation — Progressive Location Permission Hook
 * 
 * PRIVACY-FIRST: Never requests location on its own.
 * Only triggers when a feature explicitly needs it:
 * - Travel events (map view)
 * - Prayer times (Junction with time-based faith like Islam)
 * 
 * Falls back to manual city selection if denied.
 * Caches last known location to reduce API calls.
 */

import { useState, useCallback, useRef } from 'react';

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: number | null;
  /** Permission status: prompt | granted | denied | unavailable */
  permission: 'prompt' | 'granted' | 'denied' | 'unavailable';
  loading: boolean;
  error: string | null;
}

interface UseLocationReturn extends LocationState {
  /** Request location — only call from a user-initiated action */
  requestLocation: (reason: LocationReason) => Promise<{ lat: number; lng: number } | null>;
  /** Check if we have a cached location (no permission prompt) */
  hasCachedLocation: () => boolean;
  /** Get cached location without prompting */
  getCached: () => { lat: number; lng: number } | null;
  /** Clear cached location */
  clearCache: () => void;
}

/** Why we're requesting location — shown to user if needed */
export type LocationReason = 'prayer_times' | 'travel_map' | 'weather';

const LOCATION_CACHE_KEY = 'lifeos-location-cache';
const CACHE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

function getCachedLocation(): { lat: number; lng: number; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_MAX_AGE_MS) {
      localStorage.removeItem(LOCATION_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setCachedLocation(lat: number, lng: number) {
  try {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({
      lat, lng, timestamp: Date.now(),
    }));
  } catch { /* ignore */ }
}

export function useLocation(): UseLocationReturn {
  const [state, setState] = useState<LocationState>(() => {
    // Check if geolocation API exists
    if (!navigator.geolocation) {
      return {
        latitude: null, longitude: null, accuracy: null,
        timestamp: null, permission: 'unavailable', loading: false, error: null,
      };
    }

    // Check cached location
    const cached = getCachedLocation();

    return {
      latitude: cached?.lat ?? null,
      longitude: cached?.lng ?? null,
      accuracy: null,
      timestamp: cached?.timestamp ?? null,
      permission: 'prompt',
      loading: false,
      error: null,
    };
  });

  const requestingRef = useRef(false);

  const requestLocation = useCallback(async (_reason: LocationReason): Promise<{ lat: number; lng: number } | null> => {
    if (requestingRef.current) return null;
    if (!navigator.geolocation) {
      setState(s => ({ ...s, permission: 'unavailable', error: 'Geolocation not supported' }));
      return null;
    }

    // Return cached if fresh enough
    const cached = getCachedLocation();
    if (cached) {
      setState(s => ({
        ...s,
        latitude: cached.lat,
        longitude: cached.lng,
        timestamp: cached.timestamp,
        permission: 'granted',
      }));
      return { lat: cached.lat, lng: cached.lng };
    }

    requestingRef.current = true;
    setState(s => ({ ...s, loading: true, error: null }));

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          setCachedLocation(latitude, longitude);
          setState({
            latitude, longitude, accuracy,
            timestamp: position.timestamp,
            permission: 'granted',
            loading: false,
            error: null,
          });
          requestingRef.current = false;
          resolve({ lat: latitude, lng: longitude });
        },
        (err) => {
          const permission = err.code === err.PERMISSION_DENIED ? 'denied' : 'prompt';
          setState(s => ({
            ...s,
            permission,
            loading: false,
            error: err.message,
          }));
          requestingRef.current = false;
          resolve(null);
        },
        {
          enableHighAccuracy: false, // coarse is fine for prayer times / maps
          timeout: 10000,
          maximumAge: CACHE_MAX_AGE_MS,
        }
      );
    });
  }, []);

  const hasCachedLocation = useCallback(() => {
    return getCachedLocation() !== null;
  }, []);

  const getCached = useCallback((): { lat: number; lng: number } | null => {
    const cached = getCachedLocation();
    return cached ? { lat: cached.lat, lng: cached.lng } : null;
  }, []);

  const clearCache = useCallback(() => {
    localStorage.removeItem(LOCATION_CACHE_KEY);
    setState(s => ({
      ...s,
      latitude: null, longitude: null, accuracy: null,
      timestamp: null, permission: 'prompt',
    }));
  }, []);

  return {
    ...state,
    requestLocation,
    hasCachedLocation,
    getCached,
    clearCache,
  };
}

/**
 * Auto-detect timezone from browser (no location needed).
 * Used for international support — works everywhere without permissions.
 */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Get timezone offset string (e.g. "+11:00" for AEDT)
 */
export function getTimezoneOffset(): string {
  const offset = -new Date().getTimezoneOffset();
  const h = Math.floor(Math.abs(offset) / 60);
  const m = Math.abs(offset) % 60;
  const sign = offset >= 0 ? '+' : '-';
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
