/**
 * AmbientSuggestions — Dashboard Widget
 *
 * Shows current location context and surfaces geolocation-triggered
 * suggestions based on the user's context (HOME, WORK, GYM, etc.).
 *
 * Opt-in: geolocation tracking only starts after explicit user consent.
 * Geofence setup UI lets users tag their current location.
 * Compact display when no active suggestion.
 *
 * Dark theme: #050E1A bg, #0F2D4A card, #00D4FF accent.
 */

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Building2, Dumbbell, Car, Trees, X, ChevronDown, ChevronUp, Play } from 'lucide-react';
import {
  getLocationMonitor,
  getGeofences,
  addGeofence,
  removeGeofence,
  getAmbientSuggestions,
  dismissAmbientSuggestion,
  subscribeAmbientSuggestions,
  isGeolocationAvailable,
  getContextLabel,
  getLocationContextTypes,
  type LocationContext,
  type LocationState,
  type Geofence,
} from '../../lib/ambient-computing';
import { executeIntent } from '../../lib/intent/action-executor';
import { useUserStore } from '../../stores/useUserStore';
import { showToast } from '../Toast';

// ── Icon mapping ─────────────────────────────────────────────────────

const CONTEXT_ICONS: Record<LocationContext, React.ReactNode> = {
  HOME: <MapPin size={16} />,
  WORK: <Building2 size={16} />,
  GYM: <Dumbbell size={16} />,
  COMMUTE: <Car size={16} />,
  OUTDOORS: <Trees size={16} />,
  UNKNOWN: <Navigation size={16} />,
};

const CONTEXT_COLORS: Record<LocationContext, string> = {
  HOME: '#00D4FF',    // cyan
  WORK: '#F59E0B',    // amber
  GYM: '#39FF14',     // green
  COMMUTE: '#A78BFA', // purple
  OUTDOORS: '#34D399', // emerald
  UNKNOWN: '#6B7280', // gray
};

// ── Component ────────────────────────────────────────────────────────

export function AmbientSuggestions() {
  const userId = useUserStore(s => s.user?.id) || '';
  const [locationState, setLocationState] = useState<LocationState>({
    context: 'UNKNOWN',
    lat: null,
    lng: null,
    accuracy: null,
    lastUpdated: null,
    watching: false,
    error: null,
  });
  const [suggestions, setSuggestions] = useState<ReturnType<typeof getAmbientSuggestions>>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [consented, setConsented] = useState(() => {
    try {
      return localStorage.getItem('lifeos_location_consent') === 'true';
    } catch { return false; }
  });
  const [tagging, setTagging] = useState<LocationContext | null>(null);

  const monitor = getLocationMonitor();

  // Subscribe to location state changes
  useEffect(() => {
    const unsub = monitor.subscribe((state) => {
      setLocationState(state);
    });
    // Load current state
    setLocationState(monitor.getState());
    return unsub;
  }, [monitor]);

  // Subscribe to ambient suggestions
  useEffect(() => {
    const unsub = subscribeAmbientSuggestions(() => {
      setSuggestions(getAmbientSuggestions());
    });
    setSuggestions(getAmbientSuggestions());
    return unsub;
  }, []);

  // Load geofences
  useEffect(() => {
    setGeofences(getGeofences());
  }, []);

  // Start/stop monitoring based on consent
  useEffect(() => {
    if (consented && userId) {
      monitor.start(userId);
    } else {
      monitor.stop();
    }
    return () => { monitor.stop(); };
  }, [consented, userId, monitor]);

  const handleConsent = useCallback(() => {
    localStorage.setItem('lifeos_location_consent', 'true');
    setConsented(true);
    showToast('Location tracking enabled');
  }, []);

  const handleRevokeConsent = useCallback(() => {
    localStorage.removeItem('lifeos_location_consent');
    monitor.stop();
    setConsented(false);
    setLocationState({
      context: 'UNKNOWN',
      lat: null,
      lng: null,
      accuracy: null,
      lastUpdated: null,
      watching: false,
      error: null,
    });
    showToast('Location tracking disabled');
  }, [monitor]);

  const handleTagLocation = useCallback((label: LocationContext) => {
    setTagging(label);
    const fence = monitor.tagCurrentLocation(label);
    if (fence) {
      setGeofences(getGeofences());
      setShowSetup(false);
      setTagging(null);
      showToast(`Location tagged as ${getContextLabel(label)}`);
    } else {
      showToast('Cannot tag location — no GPS position available');
      setTagging(null);
    }
  }, [monitor]);

  const handleRemoveGeofence = useCallback((label: LocationContext) => {
    removeGeofence(label);
    setGeofences(getGeofences());
  }, []);

  const handleDismissSuggestion = useCallback((id: string) => {
    dismissAmbientSuggestion(id);
    setSuggestions(getAmbientSuggestions());
  }, []);

  const handleAction = useCallback((suggestion: typeof suggestions[0]) => {
    try {
      executeIntent(suggestion.action.intent as any);
    } catch {
      showToast('Action not available right now');
    }
    dismissAmbientSuggestion(suggestion.id);
    setSuggestions(getAmbientSuggestions());
  }, []);

  const handleRequestPosition = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const fences = getGeofences();
        const { latitude: lat, longitude: lng } = pos.coords;
        // Import haversine-like matching via monitor.getState update
        // The watchPosition callback in LocationMonitor handles this
        // Just trigger a manual state update for immediate feedback
        setLocationState(prev => ({
          ...prev,
          lat,
          lng,
          accuracy: pos.coords.accuracy,
          lastUpdated: new Date().toISOString(),
        }));
      },
      (err) => {
        showToast('Could not get location: ' + err.message);
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 15000 }
    );
  }, []);

  const geoAvailable = isGeolocationAvailable();
  const context = locationState.context;
  const accentColor = CONTEXT_COLORS[context] || '#6B7280';
  const contextIcon = CONTEXT_ICONS[context] || <Navigation size={16} />;
  const activeSuggestion = suggestions.length > 0 ? suggestions[suggestions.length - 1] : null;

  // ── No geolocation support ──
  if (!geoAvailable) {
    return null;
  }

  // ── Consent gate ──
  if (!consented) {
    return (
      <div style={{
        background: 'rgba(15, 45, 74, 0.5)',
        borderRadius: 12,
        padding: '14px 16px',
        border: '1px solid rgba(0, 212, 255, 0.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <MapPin size={16} style={{ color: '#00D4FF' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            Ambient Suggestions
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 10, lineHeight: 1.5 }}>
          Enable location tracking to receive context-aware suggestions when you arrive at home, work, gym, and more.
        </p>
        <button
          onClick={handleConsent}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            padding: '8px 14px',
            borderRadius: 8,
            border: 'none',
            background: 'rgba(0, 212, 255, 0.15)',
            color: '#00D4FF',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          <Navigation size={14} />
          Enable Location
        </button>
      </div>
    );
  }

  // ── Location error ──
  if (locationState.error) {
    return (
      <div style={{
        background: 'rgba(15, 45, 74, 0.5)',
        borderRadius: 12,
        padding: '14px 16px',
        border: '1px solid rgba(244, 63, 94, 0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <MapPin size={16} style={{ color: '#F43F5E' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            Location Unavailable
          </span>
          <button
            onClick={handleRevokeConsent}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              fontSize: 11,
              padding: 0,
            }}
          >
            Disable
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
          {locationState.error}
        </p>
      </div>
    );
  }

  // ── Compact display (no active suggestion) ──
  if (!activeSuggestion && !expanded && !showSetup) {
    return (
      <div style={{
        background: 'rgba(15, 45, 74, 0.5)',
        borderRadius: 12,
        padding: '10px 14px',
        border: `1px solid color-mix(in srgb, ${accentColor} 18%, transparent)`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        transition: 'border-color 0.3s, background 0.3s',
      }}
        onClick={() => setExpanded(true)}
      >
        <div style={{
          color: accentColor,
          display: 'flex',
          alignItems: 'center',
        }}>
          {contextIcon}
        </div>
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.7)',
          flex: 1,
        }}>
          {context !== 'UNKNOWN'
            ? `${getContextLabel(context)}`
            : 'Set a location'
          }
        </span>
        {locationState.watching && (
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#39FF14',
            boxShadow: '0 0 6px #39FF1480',
          }} />
        )}
        <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
      </div>
    );
  }

  // ── Expanded with geofence setup ──
  if (showSetup) {
    const contextTypes = getLocationContextTypes();
    return (
      <div style={{
        background: 'rgba(15, 45, 74, 0.5)',
        borderRadius: 12,
        padding: '14px 16px',
        border: '1px solid rgba(0, 212, 255, 0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} style={{ color: '#00D4FF' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              Tag This Location
            </span>
          </div>
          <button
            onClick={() => setShowSetup(false)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {locationState.lat === null && (
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={handleRequestPosition}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid rgba(0, 212, 255, 0.3)',
                background: 'rgba(0, 212, 255, 0.08)',
                color: '#00D4FF',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Get Current Position First
            </button>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
              Wait for GPS or click above to get your position.
            </p>
          </div>
        )}

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
          {locationState.lat !== null
            ? `Your position: ${locationState.lat.toFixed(4)}, ${locationState.lng?.toFixed(4)}`
            : 'Acquiring position...'
          }
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {contextTypes.map((ctx) => {
            const existingFence = geofences.find(f => f.label === ctx);
            const Icon = CONTEXT_ICONS[ctx];
            const color = CONTEXT_COLORS[ctx];
            const isTagging = tagging === ctx;
            return (
              <button
                key={ctx}
                onClick={() => existingFence ? handleRemoveGeofence(ctx) : handleTagLocation(ctx)}
                disabled={isTagging}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: existingFence ? `1px solid ${color}40` : '1px solid rgba(255,255,255,0.1)',
                  background: existingFence ? `${color}15` : 'rgba(255,255,255,0.04)',
                  color: existingFence ? color : 'rgba(255,255,255,0.7)',
                  fontSize: 12,
                  fontWeight: existingFence ? 600 : 400,
                  cursor: isTagging ? 'wait' : 'pointer',
                  opacity: isTagging ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {Icon}
                {getContextLabel(ctx)}
                {existingFence && <X size={12} />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Expanded view ──
  return (
    <div style={{
      background: 'rgba(15, 45, 74, 0.5)',
      borderRadius: 12,
      padding: '14px 16px',
      border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ color: accentColor, display: 'flex', alignItems: 'center' }}>
            {contextIcon}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            {context !== 'UNKNOWN' ? getContextLabel(context) : 'Location Tracking'}
          </span>
          {locationState.watching && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#39FF14', boxShadow: '0 0 6px #39FF1480',
            }} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setShowSetup(true)}
            style={{
              background: 'none',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              borderRadius: 6,
              padding: '4px 8px',
              color: '#00D4FF',
              fontSize: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <MapPin size={12} />
            Set Location
          </button>
          <button
            onClick={() => setExpanded(false)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 2 }}
          >
            <ChevronUp size={16} />
          </button>
        </div>
      </div>

      {/* Active suggestion card */}
      {activeSuggestion && (
        <div style={{
          background: `color-mix(in srgb, ${CONTEXT_COLORS[context] || '#00D4FF'} 8%, #0F2D4A)`,
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 8,
          border: `1px solid color-mix(in srgb, ${CONTEXT_COLORS[context] || '#00D4FF'} 15%, transparent)`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              {activeSuggestion.title}
            </span>
            <button
              onClick={() => handleDismissSuggestion(activeSuggestion.id)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 0, lineHeight: 1 }}
            >
              <X size={14} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 10 }}>
            {activeSuggestion.message}
          </p>
          <button
            onClick={() => handleAction(activeSuggestion)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              border: 'none',
              background: `color-mix(in srgb, ${CONTEXT_COLORS[context] || '#00D4FF'} 25%, transparent)`,
              color: CONTEXT_COLORS[context] || '#00D4FF',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <Play size={12} />
            {activeSuggestion.action.label}
          </button>
        </div>
      )}

      {/* Geofences list */}
      {geofences.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Saved Locations
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {geofences.map((fence) => (
              <span
                key={fence.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  background: `${CONTEXT_COLORS[fence.label] || '#6B7280'}15`,
                  color: CONTEXT_COLORS[fence.label] || '#6B7280',
                  border: `1px solid ${CONTEXT_COLORS[fence.label] || '#6B7280'}30`,
                }}
              >
                {CONTEXT_ICONS[fence.label]}
                {getContextLabel(fence.label)}
                <button
                  onClick={() => handleRemoveGeofence(fence.label)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Last updated */}
      {locationState.lastUpdated && (
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
          Last updated: {new Date(locationState.lastUpdated).toLocaleTimeString()}
        </p>
      )}

      {/* Revoke consent */}
      <button
        onClick={handleRevokeConsent}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.25)',
          fontSize: 10,
          cursor: 'pointer',
          marginTop: 6,
          padding: 0,
        }}
      >
        Disable location tracking
      </button>
    </div>
  );
}