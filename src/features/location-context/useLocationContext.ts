/**
 * useLocationContext.ts — Core hook for Location-Aware Context
 *
 * Manages geolocation, geofencing, distance calculations,
 * automatic travel logging, and location-triggered automations.
 * Your phone finally understands where you are and what you need.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  useLocationStore,
  type SavedLocation,
  type LocationAutomation,
  type AutomationAction,
  type TravelLog,
  type LocationHistoryEntry,
  type ContextMode,
  type AutomationTrigger,
  LOCATION_TYPE_CONFIG,
} from '../../stores/locationStore';
import { localDateStr } from '../../utils/date';
import { logger } from '../../utils/logger';

// ── Haversine Distance Calculation ──────────────────────────────────

/**
 * Calculate distance between two lat/lng points using the Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ── Context Detection ───────────────────────────────────────────────

function inferContextFromTime(): ContextMode {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9) return 'morning';
  if (hour >= 9 && hour < 17) return 'work';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

// ── Dwell Time Tracking ─────────────────────────────────────────────

interface DwellTracker {
  locationId: string;
  enterTime: number;
  lastCheck: number;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useLocationContext() {
  const store = useLocationStore();
  const watchIdRef = useRef<number | null>(null);
  const dwellTrackersRef = useRef<Map<string, DwellTracker>>(new Map());
  const lastKnownGeofencesRef = useRef<Set<string>>(new Set());
  const [isWatching, setIsWatching] = useState(false);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [batteryImpact, setBatteryImpact] = useState<'low' | 'medium' | 'high'>('low');

  // ── Start/Stop GPS Watch ──────────────────────────────────────────

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setPositionError('Geolocation not supported');
      return;
    }
    if (watchIdRef.current !== null) return; // Already watching

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        store.updatePosition(latitude, longitude, accuracy);
        setPositionError(null);

        // Log history (throttled — every 60s minimum)
        const lastUpdate = store.lastPositionUpdate;
        if (!lastUpdate || (Date.now() - new Date(lastUpdate).getTime()) > 55000) {
          // Find matched location
          const matchedPlace = store.places.find(p =>
            haversineDistance(latitude, longitude, p.lat, p.lng) <= p.radius
          );

          store.addHistoryEntry({
            timestamp: new Date().toISOString(),
            lat: store.privacyMode ? Math.round(latitude * 100) / 100 : latitude,
            lng: store.privacyMode ? Math.round(longitude * 100) / 100 : longitude,
            accuracy,
            locationId: matchedPlace?.id,
            label: matchedPlace?.name,
          });
        }

        // Check geofences
        checkGeofences(latitude, longitude);
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setPositionError('Location permission denied');
            break;
          case error.POSITION_UNAVAILABLE:
            setPositionError('Position unavailable');
            break;
          case error.TIMEOUT:
            setPositionError('Location request timed out');
            break;
          default:
            setPositionError('Unknown location error');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );

    watchIdRef.current = watchId;
    setIsWatching(true);
    setBatteryImpact('medium');
    logger.info('[location] Started GPS watch');
  }, [store]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
    setBatteryImpact('low');
    logger.info('[location] Stopped GPS watch');
  }, []);

  // ── Geofence Checking ──────────────────────────────────────────────

  const checkGeofences = useCallback((lat: number, lng: number) => {
    const currentGeofences = new Set<string>();

    for (const place of store.places) {
      const distance = haversineDistance(lat, lng, place.lat, place.lng);
      if (distance <= place.radius) {
        currentGeofences.add(place.id);
      }
    }

    // Detect arrivals
    for (const locationId of currentGeofences) {
      if (!lastKnownGeofencesRef.current.has(locationId)) {
        store.enterGeofence(locationId);
        handleGeofenceEvent(locationId, 'arrive');
        // Start dwell tracking
        dwellTrackersRef.current.set(locationId, {
          locationId,
          enterTime: Date.now(),
          lastCheck: Date.now(),
        });
      }
    }

    // Detect departures
    for (const locationId of lastKnownGeofencesRef.current) {
      if (!currentGeofences.has(locationId)) {
        store.leaveGeofence(locationId);
        handleGeofenceEvent(locationId, 'leave');
        dwellTrackersRef.current.delete(locationId);
      }
    }

    // Check dwell times
    const now = Date.now();
    for (const [locationId, tracker] of dwellTrackersRef.current) {
      if (!currentGeofences.has(locationId)) continue;
      const dwellMinutes = (now - tracker.enterTime) / 60000;

      const dwellTriggers: { minutes: number; trigger: AutomationTrigger }[] = [
        { minutes: 5, trigger: 'dwell_5min' },
        { minutes: 15, trigger: 'dwell_15min' },
        { minutes: 30, trigger: 'dwell_30min' },
      ];

      for (const { minutes, trigger } of dwellTriggers) {
        if (dwellMinutes >= minutes && (now - tracker.lastCheck) > minutes * 60000) {
          handleGeofenceEvent(locationId, trigger);
          tracker.lastCheck = now;
        }
      }
    }

    lastKnownGeofencesRef.current = currentGeofences;
  }, [store]);

  // ── Handle Geofence Events ─────────────────────────────────────────

  const handleGeofenceEvent = useCallback((locationId: string, trigger: AutomationTrigger) => {
    const place = store.places.find(p => p.id === locationId);
    if (!place) return;

    logger.info(`[location] Geofence event: ${trigger} at ${place.name}`);

    // Find matching automations
    const matchingAutomations = store.automations.filter(
      a => a.locationId === locationId && a.trigger === trigger && a.enabled
    );

    for (const automation of matchingAutomations) {
      executeAutomation(automation, place);
      store.triggerAutomation(automation.id);
    }

    // Auto context switching based on place type
    if (trigger === 'arrive') {
      const contextMap: Partial<Record<typeof place.type, ContextMode>> = {
        home: 'evening',
        work: 'work',
        gym: 'work',
        client: 'work',
      };
      const newContext = contextMap[place.type];
      if (newContext && store.currentContext !== newContext) {
        // Only switch if an automation doesn't already handle it
        const hasContextAutomation = matchingAutomations.some(a =>
          a.actions.some(act => act.type === 'switch_context')
        );
        if (!hasContextAutomation) {
          store.setContext(newContext);
        }
      }
    }

    // Auto-log travel on arrival to work/client
    if (trigger === 'arrive' && (place.type === 'work' || place.type === 'client')) {
      // Check if there's a departure from another location in the last 2 hours
      const recentDepartures = store.history
        .filter(h => {
          const timeDiff = Date.now() - new Date(h.timestamp).getTime();
          return timeDiff < 2 * 60 * 60 * 1000;
        })
        .filter(h => h.locationId && h.locationId !== locationId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (recentDepartures.length > 0 && store.currentLat !== null && store.currentLng !== null) {
        const fromPlace = store.places.find(p => p.id === recentDepartures[0].locationId);
        if (fromPlace) {
          const kms = Math.round(haversineDistance(fromPlace.lat, fromPlace.lng, place.lat, place.lng) / 100) / 10;
          if (kms > 0.5) { // Minimum 0.5km to log
            const hasTravelAutomation = matchingAutomations.some(a =>
              a.actions.some(act => act.type === 'log_travel')
            );
            if (!hasTravelAutomation) {
              store.addTravelLog({
                date: localDateStr(),
                from: fromPlace.name,
                to: place.name,
                fromLocationId: fromPlace.id,
                toLocationId: place.id,
                kms,
                duration: Math.round((Date.now() - new Date(recentDepartures[0].timestamp).getTime()) / 60000),
                purpose: place.type === 'client' ? 'work' : 'commute',
              });
            }
          }
        }
      }
    }
  }, [store]);

  // ── Execute Automation ────────────────────────────────────────────

  const executeAutomation = useCallback((automation: LocationAutomation, place: SavedLocation) => {
    for (const action of automation.actions) {
      switch (action.type) {
        case 'log_travel': {
          if (store.currentLat !== null && store.currentLng !== null) {
            store.addTravelLog({
              date: localDateStr(),
              from: 'Previous location',
              to: place.name,
              toLocationId: place.id,
              kms: action.metadata.kms,
              duration: 0,
              purpose: 'work',
            });
          }
          break;
        }
        case 'log_work_start': {
          logger.info(`[location] Work started at ${place.name}`);
          // Integration point: update time-tracking store
          break;
        }
        case 'log_work_end': {
          logger.info(`[location] Work ended at ${place.name}`);
          break;
        }
        case 'switch_context': {
          store.setContext(action.context);
          break;
        }
        case 'prompt_checkin': {
          logger.info(`[location] Check-in prompt: ${action.message}`);
          // Integration point: show notification/prompt
          break;
        }
        case 'start_timer': {
          logger.info(`[location] Timer started: ${action.label}`);
          break;
        }
        case 'nudge_habit': {
          logger.info(`[location] Habit nudge: ${action.habitId}`);
          break;
        }
        case 'send_notification': {
          logger.info(`[location] Notification: ${action.message}`);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('LifeOS Location', { body: action.message });
          }
          break;
        }
      }
    }
  }, [store]);

  // ── Get Current Place ─────────────────────────────────────────────

  const currentPlace = useMemo(() => {
    if (store.activeGeofences.length === 0) return null;
    return store.places.find(p => store.activeGeofences.includes(p.id)) || null;
  }, [store.activeGeofences, store.places]);

  // ── Today's History ────────────────────────────────────────────────

  const todayHistory = useMemo(() => {
    return store.getHistoryForDate(localDateStr());
  }, [store.history, localDateStr()]);

  // ── Today's Travel ─────────────────────────────────────────────────

  const todayTravel = useMemo(() => {
    return store.getTravelForDate(localDateStr());
  }, [store.travelLog]);

  const todayKms = useMemo(() => {
    return todayTravel.reduce((sum, t) => sum + t.kms, 0);
  }, [todayTravel]);

  // ── Arrival Patterns ──────────────────────────────────────────────

  const arrivalPatterns = useMemo(() => {
    return store.getArrivalPatterns();
  }, [store.history, store.places]);

  // ── Auto-start tracking on mount ───────────────────────────────────

  useEffect(() => {
    if (store.trackingEnabled && !isWatching) {
      startWatching();
    }
    return () => {
      // Don't stop watching on unmount — let the app manage lifecycle
    };
  }, [store.trackingEnabled]);

  // ── Request notification permission ───────────────────────────────

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // ── Distance to a place ───────────────────────────────────────────

  const distanceTo = useCallback((place: SavedLocation): number | null => {
    if (store.currentLat === null || store.currentLng === null) return null;
    return haversineDistance(store.currentLat, store.currentLng, place.lat, place.lng);
  }, [store.currentLat, store.currentLng]);

  // ── Use Current Location ───────────────────────────────────────────

  const useCurrentLocation = useCallback((): { lat: number; lng: number } | null => {
    if (store.currentLat !== null && store.currentLng !== null) {
      return { lat: store.currentLat, lng: store.currentLng };
    }
    return null;
  }, [store.currentLat, store.currentLng]);

  return {
    // Store access
    places: store.places,
    automations: store.automations,
    travelLog: store.travelLog,
    history: store.history,
    activeGeofences: store.activeGeofences,
    currentContext: store.currentContext,
    privacyMode: store.privacyMode,
    trackingEnabled: store.trackingEnabled,

    // Current state
    currentPlace,
    currentLat: store.currentLat,
    currentLng: store.currentLng,
    gpsAccuracy: store.gpsAccuracy,
    lastPositionUpdate: store.lastPositionUpdate,
    positionError,
    isWatching,
    batteryImpact,

    // Derived
    todayHistory,
    todayTravel,
    todayKms,
    arrivalPatterns,

    // GPS control
    startWatching,
    stopWatching,

    // Places CRUD
    addPlace: store.addPlace,
    updatePlace: store.updatePlace,
    removePlace: store.removePlace,

    // Automations CRUD
    addAutomation: store.addAutomation,
    updateAutomation: store.updateAutomation,
    removeAutomation: store.removeAutomation,
    triggerAutomation: store.triggerAutomation,

    // Travel Log
    addTravelLog: store.addTravelLog,
    updateTravelLog: store.updateTravelLog,
    removeTravelLog: store.removeTravelLog,
    getTravelForDate: store.getTravelForDate,
    getTravelForRange: store.getTravelForRange,
    getTravelKmsForRange: store.getTravelKmsForRange,
    getATODeduction: store.getATODeduction,

    // History
    addHistoryEntry: store.addHistoryEntry,
    getHistoryForDate: store.getHistoryForDate,
    getHistoryAtTime: store.getHistoryAtTime,
    clearHistoryBefore: store.clearHistoryBefore,

    // Context
    setContext: store.setContext,

    // Settings
    setPrivacyMode: store.setPrivacyMode,
    setTrackingEnabled: store.setTrackingEnabled,

    // Utilities
    distanceTo,
    useCurrentLocation,
    haversineDistance,

    // Config
    LOCATION_TYPE_CONFIG,
  };
}