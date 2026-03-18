/**
 * TravelDetailPanel — Rich travel event view with live map
 * 
 * Shows inside EventDrawer Details tab when event_type is 'travel'.
 * Features:
 * - Embedded Google Map with current location + destination
 * - Route info (distance, ETA, duration)
 * - Vehicle info from equipped vehicle
 * - Fuel cost estimate
 * - ATO deduction preview
 * 
 * Location is ONLY requested when user opens this panel (progressive permissions).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Navigation, Car, Fuel, Clock, DollarSign,
  Gauge, Route, Loader2, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLocation, type LocationReason } from '../hooks/useLocation';
import { useUserStore } from '../stores/useUserStore';
import type { ScheduleEvent } from '../hooks/useCurrentEvent';
import './TravelDetailPanel.css';

// ── Types ──

interface Vehicle {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  fuel_type: string;
  fuel_grade: string | null;
  tank_capacity_litres: number | null;
  avg_consumption_per_100km: number | null;
  current_odometer: number | null;
  ato_rate_per_km: number;
}

interface TravelStats {
  distanceKm: number | null;
  durationMin: number | null;
  fuelCostEstimate: number | null;
  atoDeduction: number | null;
}

// ── Helpers ──

/** Extract destination from event title — "Travel to Work" → "Work" */
function extractDestination(title: string): string | null {
  const patterns = [
    /(?:travel|drive|driving|going|headed?|heading|commut(?:e|ing))\s+to\s+(.+)/i,
    /(?:to|towards?|heading)\s+(.+)/i,
  ];
  for (const pat of patterns) {
    const m = title.match(pat);
    if (m) return m[1].trim();
  }
  return null;
}

/** Fuel type emoji */
function fuelEmoji(type: string): string {
  switch (type?.toLowerCase()) {
    case 'electric': return '⚡';
    case 'diesel': return '🛢️';
    case 'hybrid': return '🔋';
    default: return '⛽';
  }
}

// ── Map Component ──

function TravelMap({ 
  destination,
  userLat,
  userLng,
}: { 
  destination: string | null;
  userLat: number | null;
  userLng: number | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Use the free Google Maps embed (no API key required)
    // The Embed API v1 needs "Maps Embed API" enabled per-project — which we don't have.
    // The classic /maps?output=embed works without any key.
    
    let embedUrl: string | null = null;

    if (userLat && userLng && destination) {
      // Directions: origin → destination
      embedUrl = `https://www.google.com/maps?saddr=${userLat},${userLng}&daddr=${encodeURIComponent(destination)}&dirflg=d&output=embed`;
    } else if (destination) {
      // Just show destination pin
      embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(destination)}&t=m&z=13&output=embed`;
    }

    if (embedUrl) {
      const iframe = document.createElement('iframe');
      iframe.src = embedUrl;
      iframe.className = 'travel-map-iframe';
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('loading', 'lazy');
      iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      iframe.onload = () => setMapLoaded(true);
      iframe.onerror = () => setMapError('Failed to load map');
      
      mapRef.current.innerHTML = '';
      mapRef.current.appendChild(iframe);
    } else {
      setMapError('No destination detected');
    }
  }, [destination, userLat, userLng]);

  return (
    <div className="travel-map-container">
      {!mapLoaded && !mapError && (
        <div className="travel-map-loading">
          <Loader2 size={20} className="spin" />
          <span>Loading map...</span>
        </div>
      )}
      {mapError && (
        <div className="travel-map-error">
          <AlertCircle size={16} />
          <span>{mapError}</span>
        </div>
      )}
      <div ref={mapRef} className="travel-map-embed" />
    </div>
  );
}

// ── Main Component ──

interface TravelDetailPanelProps {
  event: ScheduleEvent;
}

export function TravelDetailPanel({ event }: TravelDetailPanelProps) {
  const user = useUserStore(s => s.user);
  const location = useLocation();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [stats, setStats] = useState<TravelStats>({ distanceKm: null, durationMin: null, fuelCostEstimate: null, atoDeduction: null });
  const [showVehicle, setShowVehicle] = useState(true);
  const [locationRequested, setLocationRequested] = useState(false);

  const destination = extractDestination(event.title);
  
  // Fetch equipped vehicle
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_equipped', true)
      .eq('is_deleted', false)
      .limit(1)
      .then(({ data }) => {
        if (data?.length) setVehicle(data[0] as Vehicle);
      });
  }, [user?.id]);

  // Request location when panel opens (progressive permission)
  useEffect(() => {
    if (!locationRequested) {
      setLocationRequested(true);
      location.requestLocation('travel_map' as LocationReason);
    }
  }, []);

  // Calculate stats when we have vehicle + distance
  useEffect(() => {
    if (!vehicle) return;
    // If we have odometer data from live event metadata, use that
    const meta = (event as any).metadata;
    if (meta?.odometer_start && meta?.odometer_end) {
      const km = meta.odometer_end - meta.odometer_start;
      const fuelCost = vehicle.avg_consumption_per_100km
        ? (km / 100) * vehicle.avg_consumption_per_100km * 2.05 // ~$2.05/L avg petrol price
        : null;
      const atoDeduction = km * vehicle.ato_rate_per_km;

      setStats({
        distanceKm: km,
        durationMin: null,
        fuelCostEstimate: fuelCost ? Math.round(fuelCost * 100) / 100 : null,
        atoDeduction: Math.round(atoDeduction * 100) / 100,
      });
    }
  }, [vehicle, event]);

  // Format time
  const startTime = new Date(event.start_time);
  const endTime = event.end_time ? new Date(event.end_time) : null;
  const formatT = (d: Date) => {
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  return (
    <div className="travel-detail-panel">
      {/* Map */}
      <TravelMap
        destination={destination}
        userLat={location.latitude}
        userLng={location.longitude}
      />

      {/* Route Info */}
      <div className="travel-route-info">
        <div className="travel-route-row">
          <Navigation size={13} className="travel-icon" />
          <span className="travel-destination">
            {destination || event.title}
          </span>
        </div>
        
        <div className="travel-time-row">
          <Clock size={12} />
          <span>{formatT(startTime)}{endTime ? ` → ${formatT(endTime)}` : ' → in progress'}</span>
        </div>

        {stats.distanceKm && (
          <div className="travel-stats-row">
            <div className="travel-stat">
              <Route size={12} />
              <span>{stats.distanceKm} km</span>
            </div>
            {stats.fuelCostEstimate && (
              <div className="travel-stat">
                <Fuel size={12} />
                <span>${stats.fuelCostEstimate.toFixed(2)}</span>
              </div>
            )}
            {stats.atoDeduction && (
              <div className="travel-stat deduction">
                <DollarSign size={12} />
                <span>-${stats.atoDeduction.toFixed(2)} ATO</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Vehicle Card */}
      {vehicle && (
        <div className="travel-vehicle-card">
          <button
            className="travel-vehicle-header"
            onClick={() => setShowVehicle(!showVehicle)}
          >
            <Car size={13} />
            <span className="travel-vehicle-name">{vehicle.name}</span>
            <span className="travel-vehicle-year">{vehicle.year}</span>
            {showVehicle ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showVehicle && (
            <div className="travel-vehicle-body">
              <div className="travel-vehicle-stats">
                <div className="travel-v-stat">
                  <span className="travel-v-label">{fuelEmoji(vehicle.fuel_type)} Fuel</span>
                  <span className="travel-v-value">{vehicle.fuel_grade || vehicle.fuel_type}</span>
                </div>
                {vehicle.avg_consumption_per_100km && (
                  <div className="travel-v-stat">
                    <span className="travel-v-label">Avg consumption</span>
                    <span className="travel-v-value">{vehicle.avg_consumption_per_100km}L/100km</span>
                  </div>
                )}
                {vehicle.current_odometer && (
                  <div className="travel-v-stat">
                    <span className="travel-v-label"><Gauge size={11} /> Odometer</span>
                    <span className="travel-v-value">{vehicle.current_odometer.toLocaleString()} km</span>
                  </div>
                )}
                {vehicle.tank_capacity_litres && (
                  <div className="travel-v-stat">
                    <span className="travel-v-label">Tank</span>
                    <span className="travel-v-value">{vehicle.tank_capacity_litres}L</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!vehicle && (
        <div className="travel-no-vehicle">
          <Car size={14} />
          <span>No vehicle equipped — add one in Settings</span>
        </div>
      )}

      {/* Location permission status */}
      {location.permission === 'denied' && (
        <div className="travel-location-denied">
          <AlertCircle size={12} />
          <span>Location denied — map shows destination only</span>
        </div>
      )}
    </div>
  );
}
