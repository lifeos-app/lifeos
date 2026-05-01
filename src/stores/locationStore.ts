/**
 * Location Store — Zustand + Persist
 *
 * Central store for location-aware context: saved places, geofences,
 * travel logs, automation rules, and location history.
 * Offline-first persistence for when GPS is the only connection.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { genId } from '../utils/date';
import { logger } from '../utils/logger';

// ── Types ────────────────────────────────────────────────────────────

export type LocationType = 'home' | 'work' | 'gym' | 'client' | 'social' | 'other';
export type ContextMode = 'morning' | 'work' | 'evening' | 'night';
export type TravelPurpose = 'work' | 'personal' | 'commute';
export type AutomationTrigger = 'arrive' | 'leave' | 'dwell_5min' | 'dwell_15min' | 'dwell_30min';

export interface SavedLocation {
  id: string;
  name: string;
  type: LocationType;
  address?: string;
  lat: number;
  lng: number;
  radius: number; // meters for geofence
  color: string;
  icon: string;
  automations: string[]; // automation IDs
  createdAt: string;
}

export interface LocationAutomation {
  id: string;
  trigger: AutomationTrigger;
  locationId: string;
  actions: AutomationAction[];
  enabled: boolean;
  lastTriggered?: string;
  createdAt: string;
}

export type AutomationAction =
  | { type: 'log_travel'; metadata: { kms: number } }
  | { type: 'log_work_start' }
  | { type: 'log_work_end' }
  | { type: 'switch_context'; context: ContextMode }
  | { type: 'prompt_checkin'; message: string }
  | { type: 'start_timer'; label: string }
  | { type: 'nudge_habit'; habitId: string }
  | { type: 'send_notification'; message: string };

export interface TravelLog {
  id: string;
  date: string;
  from: string;
  to: string;
  fromLocationId?: string;
  toLocationId?: string;
  kms: number;
  duration: number; // minutes
  purpose: TravelPurpose;
  createdAt: string;
}

export interface LocationHistoryEntry {
  id: string;
  timestamp: string;
  lat: number;
  lng: number;
  accuracy: number;
  locationId?: string; // matched saved location
  label?: string;
}

export interface LocationState {
  isLoaded: boolean;
  currentContext: ContextMode;
  privacyMode: boolean;
  trackingEnabled: boolean;
  gpsAccuracy: number; // meters

  // Collections
  places: SavedLocation[];
  automations: LocationAutomation[];
  travelLog: TravelLog[];
  history: LocationHistoryEntry[];
  activeGeofences: string[]; // location IDs currently inside

  // Current position
  currentLat: number | null;
  currentLng: number | null;
  lastPositionUpdate: string | null;

  // ── Places CRUD ───────────────────────────────────────────────────
  addPlace: (data: Partial<SavedLocation>) => SavedLocation;
  updatePlace: (id: string, updates: Partial<SavedLocation>) => void;
  removePlace: (id: string) => void;

  // ── Automations CRUD ──────────────────────────────────────────────
  addAutomation: (data: Partial<LocationAutomation>) => LocationAutomation;
  updateAutomation: (id: string, updates: Partial<LocationAutomation>) => void;
  removeAutomation: (id: string) => void;
  triggerAutomation: (id: string) => void;

  // ── Travel Log ────────────────────────────────────────────────────
  addTravelLog: (data: Partial<TravelLog>) => TravelLog;
  updateTravelLog: (id: string, updates: Partial<TravelLog>) => void;
  removeTravelLog: (id: string) => void;
  getTravelForDate: (date: string) => TravelLog[];
  getTravelForRange: (start: string, end: string) => TravelLog[];
  getTravelKmsForRange: (start: string, end: string) => { work: number; personal: number; commute: number; total: number };
  getATODeduction: (start: string, end: string, ratePerKm?: number) => { workKms: number; deduction: number };

  // ── Location History ───────────────────────────────────────────────
  addHistoryEntry: (entry: Omit<LocationHistoryEntry, 'id'>) => void;
  getHistoryForDate: (date: string) => LocationHistoryEntry[];
  getHistoryAtTime: (timestamp: string) => LocationHistoryEntry | undefined;
  clearHistoryBefore: (date: string) => void;

  // ── Geofence management ───────────────────────────────────────────
  setActiveGeofences: (ids: string[]) => void;
  enterGeofence: (locationId: string) => void;
  leaveGeofence: (locationId: string) => void;

  // ── Context ───────────────────────────────────────────────────────
  setContext: (ctx: ContextMode) => void;

  // ── Settings ──────────────────────────────────────────────────────
  setPrivacyMode: (on: boolean) => void;
  setTrackingEnabled: (on: boolean) => void;
  updatePosition: (lat: number, lng: number, accuracy: number) => void;

  // ── Pattern detection ─────────────────────────────────────────────
  getArrivalPatterns: () => { locationId: string; locationName: string; avgArrivalTime: string; count: number }[];
}

// ── Type configs ────────────────────────────────────────────────────

export const LOCATION_TYPE_CONFIG: Record<LocationType, { icon: string; color: string; label: string }> = {
  home:    { icon: '🏠', color: '#10B981', label: 'Home' },
  work:    { icon: '💼', color: '#3B82F6', label: 'Work' },
  gym:     { icon: '🏋️', color: '#F97316', label: 'Gym' },
  client:  { icon: '🏢', color: '#8B5CF6', label: 'Client Site' },
  social:  { icon: '🎉', color: '#EC4899', label: 'Social' },
  other:   { icon: '📍', color: '#64748B', label: 'Other' },
};

// ATO cents per km — 2024-25 financial year
export const ATO_CENTS_PER_KM = 88;

// ── Store ────────────────────────────────────────────────────────────

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      isLoaded: false,
      currentContext: 'morning',
      privacyMode: false,
      trackingEnabled: true,
      gpsAccuracy: 0,

      places: [],
      automations: [],
      travelLog: [],
      history: [],
      activeGeofences: [],

      currentLat: null,
      currentLng: null,
      lastPositionUpdate: null,

      // ── Places ───────────────────────────────────────────────────

      addPlace: (data: Partial<SavedLocation>): SavedLocation => {
        const now = new Date().toISOString();
        const typeConfig = LOCATION_TYPE_CONFIG[data.type || 'other'];
        const newPlace: SavedLocation = {
          id: genId(),
          name: data.name || 'Unnamed Place',
          type: data.type || 'other',
          address: data.address,
          lat: data.lat ?? 0,
          lng: data.lng ?? 0,
          radius: data.radius ?? 100,
          color: data.color || typeConfig.color,
          icon: data.icon || typeConfig.icon,
          automations: data.automations || [],
          createdAt: now,
        };
        set(s => ({ places: [...s.places, newPlace] }));
        logger.info('[location] Added place:', newPlace.id, newPlace.name);
        return newPlace;
      },

      updatePlace: (id: string, updates: Partial<SavedLocation>) => {
        set(s => ({
          places: s.places.map(p =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      removePlace: (id: string) => {
        set(s => ({
          places: s.places.filter(p => p.id !== id),
          automations: s.automations.filter(a => a.locationId !== id),
        }));
        logger.info('[location] Removed place:', id);
      },

      // ── Automations ─────────────────────────────────────────────

      addAutomation: (data: Partial<LocationAutomation>): LocationAutomation => {
        const now = new Date().toISOString();
        const newAutomation: LocationAutomation = {
          id: genId(),
          trigger: data.trigger || 'arrive',
          locationId: data.locationId || '',
          actions: data.actions || [],
          enabled: data.enabled ?? true,
          createdAt: now,
        };
        set(s => ({ automations: [...s.automations, newAutomation] }));
        // Link to place
        const place = get().places.find(p => p.id === newAutomation.locationId);
        if (place && !place.automations.includes(newAutomation.id)) {
          get().updatePlace(place.id, {
            automations: [...place.automations, newAutomation.id],
          });
        }
        logger.info('[location] Added automation:', newAutomation.id);
        return newAutomation;
      },

      updateAutomation: (id: string, updates: Partial<LocationAutomation>) => {
        set(s => ({
          automations: s.automations.map(a =>
            a.id === id ? { ...a, ...updates } : a
          ),
        }));
      },

      removeAutomation: (id: string) => {
        const auto = get().automations.find(a => a.id === id);
        set(s => ({
          automations: s.automations.filter(a => a.id !== id),
        }));
        if (auto) {
          const place = get().places.find(p => p.id === auto.locationId);
          if (place) {
            get().updatePlace(place.id, {
              automations: place.automations.filter(aid => aid !== id),
            });
          }
        }
        logger.info('[location] Removed automation:', id);
      },

      triggerAutomation: (id: string) => {
        set(s => ({
          automations: s.automations.map(a =>
            a.id === id ? { ...a, lastTriggered: new Date().toISOString() } : a
          ),
        }));
        logger.info('[location] Triggered automation:', id);
      },

      // ── Travel Log ──────────────────────────────────────────────

      addTravelLog: (data: Partial<TravelLog>): TravelLog => {
        const now = new Date().toISOString();
        const entry: TravelLog = {
          id: genId(),
          date: data.date || now.split('T')[0],
          from: data.from || 'Unknown',
          to: data.to || 'Unknown',
          fromLocationId: data.fromLocationId,
          toLocationId: data.toLocationId,
          kms: data.kms ?? 0,
          duration: data.duration ?? 0,
          purpose: data.purpose || 'work',
          createdAt: now,
        };
        set(s => ({ travelLog: [entry, ...s.travelLog] }));
        logger.info('[location] Added travel log:', entry.id, `${entry.kms}km`);
        return entry;
      },

      updateTravelLog: (id: string, updates: Partial<TravelLog>) => {
        set(s => ({
          travelLog: s.travelLog.map(t =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }));
      },

      removeTravelLog: (id: string) => {
        set(s => ({ travelLog: s.travelLog.filter(t => t.id !== id) }));
      },

      getTravelForDate: (date: string) => {
        return get().travelLog.filter(t => t.date === date);
      },

      getTravelForRange: (start: string, end: string) => {
        return get().travelLog.filter(t => t.date >= start && t.date <= end);
      },

      getTravelKmsForRange: (start: string, end: string) => {
        const entries = get().getTravelForRange(start, end);
        return {
          work: entries.filter(t => t.purpose === 'work').reduce((s, t) => s + t.kms, 0),
          personal: entries.filter(t => t.purpose === 'personal').reduce((s, t) => s + t.kms, 0),
          commute: entries.filter(t => t.purpose === 'commute').reduce((s, t) => s + t.kms, 0),
          total: entries.reduce((s, t) => s + t.kms, 0),
        };
      },

      getATODeduction: (start: string, end: string, ratePerKm = ATO_CENTS_PER_KM / 100) => {
        const entries = get().getTravelForRange(start, end);
        const workKms = entries.filter(t => t.purpose === 'work').reduce((s, t) => s + t.kms, 0);
        return {
          workKms,
          deduction: Math.round(workKms * ratePerKm * 100) / 100,
        };
      },

      // ── Location History ─────────────────────────────────────────

      addHistoryEntry: (entry: Omit<LocationHistoryEntry, 'id'>) => {
        const newEntry: LocationHistoryEntry = { ...entry, id: genId() };
        set(s => ({ history: [newEntry, ...s.history].slice(0, 5000) })); // Cap at 5000
      },

      getHistoryForDate: (date: string) => {
        return get().history.filter(h => h.timestamp.startsWith(date));
      },

      getHistoryAtTime: (timestamp: string) => {
        const target = new Date(timestamp).getTime();
        let closest: LocationHistoryEntry | undefined;
        let closestDist = Infinity;
        for (const entry of get().history) {
          const dist = Math.abs(new Date(entry.timestamp).getTime() - target);
          if (dist < closestDist) {
            closestDist = dist;
            closest = entry;
          }
        }
        // Only return if within 15 minutes
        return closestDist < 15 * 60 * 1000 ? closest : undefined;
      },

      clearHistoryBefore: (date: string) => {
        set(s => ({
          history: s.history.filter(h => h.timestamp >= date),
        }));
      },

      // ── Geofence ────────────────────────────────────────────────

      setActiveGeofences: (ids: string[]) => {
        set({ activeGeofences: ids });
      },

      enterGeofence: (locationId: string) => {
        set(s => ({
          activeGeofences: s.activeGeofences.includes(locationId)
            ? s.activeGeofences
            : [...s.activeGeofences, locationId],
        }));
      },

      leaveGeofence: (locationId: string) => {
        set(s => ({
          activeGeofences: s.activeGeofences.filter(id => id !== locationId),
        }));
      },

      // ── Context ─────────────────────────────────────────────────

      setContext: (ctx: ContextMode) => {
        set({ currentContext: ctx });
        logger.info('[location] Context switched to:', ctx);
      },

      // ── Settings ────────────────────────────────────────────────

      setPrivacyMode: (on: boolean) => {
        set({ privacyMode: on });
      },

      setTrackingEnabled: (on: boolean) => {
        set({ trackingEnabled: on });
      },

      updatePosition: (lat: number, lng: number, accuracy: number) => {
        set({
          currentLat: lat,
          currentLng: lng,
          gpsAccuracy: accuracy,
          lastPositionUpdate: new Date().toISOString(),
        });
      },

      // ── Pattern detection ────────────────────────────────────────

      getArrivalPatterns: () => {
        const { history, places } = get();
        const patterns: Record<string, { times: number[]; count: number }> = {};

        // Group history entries by matched location
        for (const entry of history) {
          if (!entry.locationId) continue;
          if (!patterns[entry.locationId]) {
            patterns[entry.locationId] = { times: [], count: 0 };
          }
          const hour = new Date(entry.timestamp).getHours();
          const minute = new Date(entry.timestamp).getMinutes();
          patterns[entry.locationId].times.push(hour * 60 + minute);
          patterns[entry.locationId].count++;
        }

        return Object.entries(patterns)
          .filter(([, data]) => data.count >= 3)
          .map(([locationId, data]) => {
            const avgMinutes = Math.round(
              data.times.reduce((a, b) => a + b, 0) / data.times.length
            );
            const h = Math.floor(avgMinutes / 60);
            const m = avgMinutes % 60;
            const place = places.find(p => p.id === locationId);
            return {
              locationId,
              locationName: place?.name || 'Unknown',
              avgArrivalTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
              count: data.count,
            };
          })
          .sort((a, b) => b.count - a.count);
      },
    }),
    {
      name: 'lifeos-location-store',
      onRehydrateStorage: () => (state) => {
        if (state) state.isLoaded = true;
        logger.info('[location] Store rehydrated');
      },
    }
  )
);