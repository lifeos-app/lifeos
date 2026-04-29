/**
 * ambient-computing.ts — Geolocation-triggered ambient suggestions for LifeOS
 *
 * Uses the browser Geolocation API to detect location changes and
 * surface contextual suggestions based on the user's context (HOME, WORK, GYM, etc.).
 *
 * Geofences are stored in localStorage (small dataset).
 * Geolocation is OPT-IN — watchPosition is never called without user consent.
 * Rate limit: max 1 ambient suggestion per location per 30 minutes.
 */

import { type ProactiveSuggestion, type SuggestionType } from './proactive-suggestions';

// ── Types ─────────────────────────────────────────────────────────────

export type LocationContext =
  | 'HOME'
  | 'WORK'
  | 'GYM'
  | 'COMMUTE'
  | 'OUTDOORS'
  | 'UNKNOWN';

export interface Geofence {
  label: LocationContext;
  lat: number;
  lng: number;
  radius: number; // meters
}

export interface LocationState {
  context: LocationContext;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  lastUpdated: string | null;
  watching: boolean;
  error: string | null;
}

export type AmbientListener = (state: LocationState) => void;

// ── Constants ──────────────────────────────────────────────────────────

const GEOFENCE_STORAGE_KEY = 'lifeos_geofences';
const AMBIENT_COOLDOWN_KEY = 'lifeos_ambient_cooldown';
const AMBIENT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const MIN_GEOFENCE_RADIUS = 50; // 50m minimum radius
const MAX_GEOFENCE_RADIUS = 5000; // 5km maximum radius

const LOCATION_LABELS: Record<LocationContext, string> = {
  HOME: 'Home',
  WORK: 'Work',
  GYM: 'Gym',
  COMMUTE: 'Commute',
  OUTDOORS: 'Outdoors',
  UNKNOWN: 'Unknown',
};

// Location-specific suggestion configurations
interface AmbientSuggestionConfig {
  type: SuggestionType;
  title: string;
  message: string;
  actionLabel: string;
  intentType: string;
  intentData: Record<string, unknown>;
  intentSummary: string;
  confidence: number;
}

const LOCATION_SUGGESTIONS: Record<LocationContext, AmbientSuggestionConfig[]> = {
  HOME: [
    {
      type: 'habit_nudge',
      title: 'Home Habit Check',
      message: 'You\'re home — a great time for your habits. Log your daily routine.',
      actionLabel: 'Log Habit',
      intentType: 'habit_log',
      intentData: {},
      intentSummary: 'Log habit from home',
      confidence: 0.8,
    },
    {
      type: 'habit_nudge',
      title: 'Journal Moment',
      message: 'Settling in at home? Take a moment to journal your thoughts.',
      actionLabel: 'Open Journal',
      intentType: 'navigate',
      intentData: { route: '/sage?prompt=journal' },
      intentSummary: 'Open journal at home',
      confidence: 0.7,
    },
  ],
  WORK: [
    {
      type: 'schedule_reminder',
      title: 'Focus Block',
      message: 'You\'re at work — time to enter a focus block and tackle deep work.',
      actionLabel: 'Start Focus',
      intentType: 'navigate',
      intentData: { route: '/schedule?focus=true' },
      intentSummary: 'Start focus block',
      confidence: 0.85,
    },
    {
      type: 'schedule_reminder',
      title: 'Task Reminder',
      message: 'At your workspace — review your priority tasks for the day.',
      actionLabel: 'View Tasks',
      intentType: 'navigate',
      intentData: { route: '/schedule' },
      intentSummary: 'Review tasks at work',
      confidence: 0.75,
    },
  ],
  GYM: [
    {
      type: 'health_warning',
      title: 'Health Log',
      message: 'You\'re at the gym — log your workout and track your progress.',
      actionLabel: 'Log Workout',
      intentType: 'health_log',
      intentData: {},
      intentSummary: 'Log workout at gym',
      confidence: 0.9,
    },
    {
      type: 'health_warning',
      title: 'Workout Session',
      message: 'Gym time! Start a timed workout session to track your exercises.',
      actionLabel: 'Start Workout',
      intentType: 'navigate',
      intentData: { route: '/health?workout=true' },
      intentSummary: 'Start workout at gym',
      confidence: 0.85,
    },
  ],
  COMMUTE: [
    {
      type: 'schedule_reminder',
      title: 'Podcast Time',
      message: 'On the move? Listen to a podcast or review your day ahead.',
      actionLabel: 'Plan Commute',
      intentType: 'navigate',
      intentData: { route: '/insights' },
      intentSummary: 'Review during commute',
      confidence: 0.7,
    },
    {
      type: 'schedule_reminder',
      title: 'Day Review',
      message: 'Commuting — a perfect moment to review your goals for the day.',
      actionLabel: 'Review Goals',
      intentType: 'navigate',
      intentData: { route: '/goals' },
      intentSummary: 'Review goals on commute',
      confidence: 0.65,
    },
  ],
  OUTDOORS: [
    {
      type: 'habit_nudge',
      title: 'Mindfulness',
      message: 'You\'re outside — a great time for a mindful moment or walk.',
      actionLabel: 'Start Walk',
      intentType: 'navigate',
      intentData: { route: '/health?walk=true' },
      intentSummary: 'Mindful outdoor moment',
      confidence: 0.7,
    },
    {
      type: 'habit_nudge',
      title: 'Photo Journal',
      message: 'Out and about — capture this moment in your journal.',
      actionLabel: 'Open Journal',
      intentType: 'navigate',
      intentData: { route: '/insights?journal=true' },
      intentSummary: 'Photo journal entry',
      confidence: 0.6,
    },
  ],
  UNKNOWN: [],
};

// ── Geofence Persistence ──────────────────────────────────────────────

export function getGeofences(): Geofence[] {
  try {
    const raw = localStorage.getItem(GEOFENCE_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Geofence[];
  } catch {
    return [];
  }
}

export function saveGeofences(fences: Geofence[]): void {
  try {
    localStorage.setItem(GEOFENCE_STORAGE_KEY, JSON.stringify(fences));
  } catch { /* ignore */ }
}

export function addGeofence(fence: Omit<Geofence, 'radius'> & { radius?: number }): Geofence {
  const fences = getGeofences();
  // Remove existing fence with same label (overwrite)
  const filtered = fences.filter(f => f.label !== fence.label);
  const newFence: Geofence = {
    ...fence,
    radius: fence.radius ?? Math.max(MIN_GEOFENCE_RADIUS, 100),
  };
  filtered.push(newFence);
  saveGeofences(filtered);
  return newFence;
}

export function removeGeofence(label: LocationContext): void {
  const fences = getGeofences().filter(f => f.label !== label);
  saveGeofences(fences);
}

// ── Distance Calculation (Haversine) ─────────────────────────────────

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── Context Detection ─────────────────────────────────────────────────

function detectContext(lat: number, lng: number, fences: Geofence[]): LocationContext {
  for (const fence of fences) {
    const distance = haversineDistance(lat, lng, fence.lat, fence.lng);
    if (distance <= fence.radius) {
      return fence.label;
    }
  }
  return 'UNKNOWN';
}

// ── Ambient Cooldown ──────────────────────────────────────────────────

interface AmbientCooldownEntry {
  at: number; // timestamp
}

function getAmbientCooldown(): Record<string, AmbientCooldownEntry> {
  try {
    const raw = localStorage.getItem(AMBIENT_COOLDOWN_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function isInAmbientCooldown(context: LocationContext): boolean {
  if (context === 'UNKNOWN') return true; // Never trigger for unknown
  const map = getAmbientCooldown();
  const entry = map[context];
  if (!entry) return false;
  return Date.now() - entry.at < AMBIENT_COOLDOWN_MS;
}

function markAmbientCooldown(context: LocationContext): void {
  const map = getAmbientCooldown();
  map[context] = { at: Date.now() };
  // Prune old entries
  const cutoff = Date.now() - AMBIENT_COOLDOWN_MS * 2;
  for (const [k, v] of Object.entries(map)) {
    if (v.at < cutoff) delete map[k];
  }
  try {
    localStorage.setItem(AMBIENT_COOLDOWN_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

// ── Suggestion Emission ──────────────────────────────────────────────

let lastEmittedContext: LocationContext | null = null;

function emitAmbientSuggestions(context: LocationContext, userId: string): void {
  if (context === 'UNKNOWN') return;
  if (context === lastEmittedContext && isInAmbientCooldown(context)) return;

  const configs = LOCATION_SUGGESTIONS[context] || [];
  if (configs.length === 0) return;

  // Pick the first suggestion for this context
  const config = configs[0];

  const suggestion: ProactiveSuggestion = {
    id: `ambient_${context}_${Date.now()}`,
    type: config.type,
    priority: 5, // Lower priority than time-critical suggestions
    title: config.title,
    message: config.message,
    action: {
      label: config.actionLabel,
      intent: {
        type: config.intentType,
        data: {
          ...config.intentData,
          location_context: context,
          user_id: userId,
        },
        summary: config.intentSummary,
        confidence: config.confidence,
      },
    },
    dismissed: false,
    timestamp: new Date().toISOString(),
  };

  // Add to proactive suggestions via the exported function
  addAmbientSuggestion(suggestion);

  // Mark cooldown
  markAmbientCooldown(context);
  lastEmittedContext = context;
}

// ── Ambient Suggestion Store (shared state for components) ────────────

/** In-memory store for ambient suggestions consumed by the component */
const ambientSuggestions: ProactiveSuggestion[] = [];
const listeners: Set<() => void> = new Set();

function addAmbientSuggestion(suggestion: ProactiveSuggestion): void {
  // Limit to 3 ambient suggestions max
  if (ambientSuggestions.length >= 3) {
    ambientSuggestions.shift();
  }
  ambientSuggestions.push(suggestion);
  notifyListeners();
}

export function dismissAmbientSuggestion(id: string): void {
  const idx = ambientSuggestions.findIndex(s => s.id === id);
  if (idx >= 0) {
    ambientSuggestions.splice(idx, 1);
    notifyListeners();
  }
}

export function getAmbientSuggestions(): ProactiveSuggestion[] {
  return [...ambientSuggestions];
}

export function subscribeAmbientSuggestions(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notifyListeners(): void {
  listeners.forEach(fn => {
    try { fn(); } catch { /* ignore */ }
  });
}

// ── LocationMonitor Class ─────────────────────────────────────────────

class LocationMonitor {
  private watchId: number | null = null;
  private state: LocationState = {
    context: 'UNKNOWN',
    lat: null,
    lng: null,
    accuracy: null,
    lastUpdated: null,
    watching: false,
    error: null,
  };
  private stateListeners: Set<AmbientListener> = new Set();
  private userId: string = '';

  /** Start monitoring. Requires user consent. */
  start(userId: string): void {
    if (!navigator.geolocation) {
      this.state.error = 'Geolocation not supported';
      this.notifyState();
      return;
    }

    this.userId = userId;
    this.state.watching = true;
    this.state.error = null;
    this.notifyState();

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onPosition(pos),
      (err) => this.onError(err),
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 },
    );
  }

  /** Stop monitoring and release resources. */
  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.state.watching = false;
    this.state.context = 'UNKNOWN';
    this.state.lat = null;
    this.state.lng = null;
    this.state.accuracy = null;
    this.notifyState();
  }

  /** Get current state (read-only copy). */
  getState(): LocationState {
    return { ...this.state };
  }

  /** Subscribe to state changes. Returns unsubscribe function. */
  subscribe(listener: AmbientListener): () => void {
    this.stateListeners.add(listener);
    return () => { this.stateListeners.delete(listener); };
  }

  /** Tag current location as a specific context. Creates/updates a geofence. */
  tagCurrentLocation(label: LocationContext, customRadius?: number): Geofence | null {
    if (this.state.lat === null || this.state.lng === null) {
      return null;
    }
    return addGeofence({
      label,
      lat: this.state.lat,
      lng: this.state.lng,
      radius: customRadius ?? Math.max(MIN_GEOFENCE_RADIUS, 100),
    });
  }

  /** Get current location context label. */
  getCurrentContext(): { label: LocationContext; lastUpdated: string | null } {
    return {
      label: this.state.context,
      lastUpdated: this.state.lastUpdated,
    };
  }

  private onPosition(pos: GeolocationPosition): void {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    this.state.lat = lat;
    this.state.lng = lng;
    this.state.accuracy = accuracy;
    this.state.lastUpdated = new Date().toISOString();
    this.state.error = null;

    // Detect context from geofences
    const fences = getGeofences();
    const context = detectContext(lat, lng, fences);
    const prevContext = this.state.context;
    this.state.context = context;

    this.notifyState();

    // Emit suggestions if context changed or cooldown expired
    if (context !== 'UNKNOWN' && context !== prevContext) {
      emitAmbientSuggestions(context, this.userId);
    } else if (context !== 'UNKNOWN' && !isInAmbientCooldown(context)) {
      emitAmbientSuggestions(context, this.userId);
    }
  }

  private onError(err: GeolocationPositionError): void {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        this.state.error = 'Location permission denied';
        this.state.watching = false;
        break;
      case err.POSITION_UNAVAILABLE:
        this.state.error = 'Location unavailable';
        break;
      case err.TIMEOUT:
        this.state.error = 'Location request timed out';
        break;
      default:
        this.state.error = 'Unknown location error';
    }
    this.notifyState();
  }

  private notifyState(): void {
    const snapshot = { ...this.state };
    this.stateListeners.forEach(fn => {
      try { fn(snapshot); } catch { /* ignore */ }
    });
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let instance: LocationMonitor | null = null;

export function getLocationMonitor(): LocationMonitor {
  if (!instance) {
    instance = new LocationMonitor();
  }
  return instance;
}

/** Convenience: start geolocation monitoring (opt-in). */
export function startLocationMonitoring(userId: string): void {
  getLocationMonitor().start(userId);
}

/** Convenience: stop geolocation monitoring. */
export function stopLocationMonitoring(): void {
  getLocationMonitor().stop();
}

/** Tag current location as a specific context. */
export function tagCurrentLocation(label: LocationContext, customRadius?: number): Geofence | null {
  return getLocationMonitor().tagCurrentLocation(label, customRadius);
}

/** Get current location context info. */
export function getCurrentContext(): { label: LocationContext; lastUpdated: string | null } {
  return getLocationMonitor().getCurrentContext();
}

/** Get the label display name for a context. */
export function getContextLabel(context: LocationContext): string {
  return LOCATION_LABELS[context] || 'Unknown';
}

/** Get all available location context types for the geofence setup UI. */
export function getLocationContextTypes(): LocationContext[] {
  return ['HOME', 'WORK', 'GYM', 'COMMUTE', 'OUTDOORS'];
}

/** Check if geolocation is available in this browser. */
export function isGeolocationAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/** Delete a geofence by label. */
export function deleteGeofence(label: LocationContext): void {
  removeGeofence(label);
}

/** Get the suggestion configs for a given location context (for UI preview). */
export function getContextSuggestions(context: LocationContext): AmbientSuggestionConfig[] {
  return LOCATION_SUGGESTIONS[context] || [];
}