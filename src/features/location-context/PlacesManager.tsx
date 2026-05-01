/**
 * PlacesManager.tsx — Manage saved locations
 *
 * Add/edit/remove places with name, type, address,
 * geofence radius slider, GPS coordinates, and
 * "Use current location" button.
 */

import { useState, useEffect } from 'react';
import { useLocationContext, haversineDistance } from './useLocationContext';
import { LOCATION_TYPE_CONFIG, type LocationType, type SavedLocation } from '../../stores/locationStore';

export function PlacesManager() {
  const ctx = useLocationContext();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-white/80">Your Places</h2>
          <p className="text-[10px] text-white/30 mt-0.5">
            {ctx.places.length} saved · Geofences keep you context-aware
          </p>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setEditingId(null); }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-cyan-600/60 to-blue-600/60 hover:from-cyan-500/70 hover:to-blue-500/70 border border-cyan-500/30 transition-all"
        >
          + Add Place
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <PlaceForm
          existingId={editingId}
          onClose={() => { setShowAddForm(false); setEditingId(null); }}
        />
      )}

      {/* Places List */}
      {ctx.places.length === 0 && !showAddForm ? (
        <div className="text-center py-12 text-white/30 text-sm">
          <div className="text-3xl mb-3">🗺️</div>
          <p>No places saved yet.</p>
          <p className="text-[10px] mt-1">Add your home, work, and client sites to enable location automations.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ctx.places.map(place => (
            <PlaceCard
              key={place.id}
              place={place}
              currentLat={ctx.currentLat}
              currentLng={ctx.currentLng}
              isActive={ctx.activeGeofences.includes(place.id)}
              onEdit={() => { setEditingId(place.id); setShowAddForm(true); }}
              onRemove={() => ctx.removePlace(place.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Place Card ───────────────────────────────────────────────────────

function PlaceCard({ place, currentLat, currentLng, isActive, onEdit, onRemove }: {
  place: SavedLocation;
  currentLat: number | null;
  currentLng: number | null;
  isActive: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dist = currentLat !== null && currentLng !== null
    ? haversineDistance(currentLat, currentLng, place.lat, place.lng)
    : null;

  return (
    <div className={`p-3 rounded-xl border transition-all ${
      isActive
        ? 'bg-cyan-900/20 border-cyan-500/30'
        : 'bg-[#111132]/60 border-white/5 hover:border-white/10'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
            style={{ backgroundColor: place.color + '25', border: `1px solid ${place.color}40` }}
          >
            {place.icon}
          </div>
          <div>
            <div className="text-sm font-medium text-white">{place.name}</div>
            <div className="text-[10px] text-white/40">
              {LOCATION_TYPE_CONFIG[place.type]?.label || place.type}
              {place.address && ` · ${place.address}`}
            </div>
            <div className="text-[10px] text-white/30 font-mono mt-0.5">
              {place.lat.toFixed(6)}, {place.lng.toFixed(6)} · {place.radius}m radius
            </div>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          {isActive && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              HERE
            </span>
          )}
          {dist !== null && (
            <span className="text-[10px] text-white/40">
              {dist < 1000 ? `${Math.round(dist)}m away` : `${(dist/1000).toFixed(1)}km away`}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
        <button
          onClick={onEdit}
          className="px-2.5 py-1 rounded text-[10px] text-white/50 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
        >
          ✏️ Edit
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={onRemove}
              className="px-2.5 py-1 rounded text-[10px] text-red-300 bg-red-900/40 hover:bg-red-900/60 transition-all"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2.5 py-1 rounded text-[10px] text-white/50 bg-white/5 transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-2.5 py-1 rounded text-[10px] text-red-300/50 hover:text-red-300 hover:bg-red-900/30 transition-all"
          >
            🗑️
          </button>
        )}
        {place.automations.length > 0 && (
          <span className="ml-auto text-[9px] text-white/30">
            ⚡ {place.automations.length} automation{place.automations.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Place Form ───────────────────────────────────────────────────────

function PlaceForm({ existingId, onClose }: { existingId: string | null; onClose: () => void }) {
  const ctx = useLocationContext();
  const existing = existingId ? ctx.places.find(p => p.id === existingId) : null;

  const [name, setName] = useState(existing?.name || '');
  const [type, setType] = useState<LocationType>(existing?.type || 'other');
  const [address, setAddress] = useState(existing?.address || '');
  const [lat, setLat] = useState(existing?.lat?.toString() || '');
  const [lng, setLng] = useState(existing?.lng?.toString() || '');
  const [radius, setRadius] = useState(existing?.radius || 100);

  const typeConfig = LOCATION_TYPE_CONFIG[type];

  const handleUseCurrentLocation = () => {
    const pos = ctx.useCurrentLocation();
    if (pos) {
      setLat(pos.lat.toFixed(6));
      setLng(pos.lng.toFixed(6));
    }
  };

  const handleSave = () => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!name.trim() || isNaN(latNum) || isNaN(lngNum)) return;

    if (existingId) {
      ctx.updatePlace(existingId, {
        name: name.trim(),
        type,
        address: address.trim() || undefined,
        lat: latNum,
        lng: lngNum,
        radius,
        color: typeConfig.color,
        icon: typeConfig.icon,
      });
    } else {
      ctx.addPlace({
        name: name.trim(),
        type,
        address: address.trim() || undefined,
        lat: latNum,
        lng: lngNum,
        radius,
        color: typeConfig.color,
        icon: typeConfig.icon,
      });
    }
    onClose();
  };

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-b from-[#111132] to-[#0d0d24] border border-cyan-500/15">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-cyan-200">
          {existingId ? 'Edit Place' : 'Add Place'}
        </h3>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/60 text-xs transition-all"
        >
          ✕
        </button>
      </div>

      {/* Name */}
      <div className="mb-3">
        <label className="text-[10px] uppercase tracking-widest text-cyan-400/60 mb-1 block">
          Place Name
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Sonder Office"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-500/40 transition-all"
        />
      </div>

      {/* Type */}
      <div className="mb-3">
        <label className="text-[10px] uppercase tracking-widest text-cyan-400/60 mb-1.5 block">
          Place Type
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(LOCATION_TYPE_CONFIG) as [LocationType, typeof typeConfig][]).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setType(key)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                type === key
                  ? 'border-opacity-100 text-white'
                  : 'border-white/10 text-white/40 hover:text-white/60'
              }`}
              style={{
                backgroundColor: type === key ? config.color + '30' : 'transparent',
                borderColor: type === key ? config.color + '60' : undefined,
              }}
            >
              {config.icon} {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Address */}
      <div className="mb-3">
        <label className="text-[10px] uppercase tracking-widest text-cyan-400/60 mb-1 block">
          Address (optional)
        </label>
        <input
          type="text"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="Street address for reference"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-500/40 transition-all"
        />
      </div>

      {/* Coordinates */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] uppercase tracking-widest text-cyan-400/60">
            GPS Coordinates
          </label>
          <button
            onClick={handleUseCurrentLocation}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-all"
          >
            📍 Use Current Location
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={lat}
            onChange={e => setLat(e.target.value)}
            placeholder="Latitude"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-white/20 outline-none focus:border-cyan-500/40 transition-all"
          />
          <input
            type="text"
            value={lng}
            onChange={e => setLng(e.target.value)}
            placeholder="Longitude"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-white/20 outline-none focus:border-cyan-500/40 transition-all"
          />
        </div>
      </div>

      {/* Radius Slider */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] uppercase tracking-widest text-cyan-400/60">
            Geofence Radius
          </label>
          <span className="text-xs font-mono text-cyan-200">{radius}m</span>
        </div>
        <input
          type="range"
          min={50}
          max={500}
          step={25}
          value={radius}
          onChange={e => setRadius(Number(e.target.value))}
          className="w-full h-2 bg-gradient-to-r from-slate-800 via-cyan-800 to-emerald-800 rounded-full appearance-none cursor-pointer accent-cyan-500"
        />
        <div className="flex justify-between text-[9px] text-cyan-500/40 mt-0.5">
          <span>50m (room)</span>
          <span>200m (building)</span>
          <span>500m (block)</span>
        </div>
      </div>

      {/* Map Preview Placeholder */}
      {lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng)) && (
        <div className="mb-4 relative h-32 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/5 overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`h${i}`} className="absolute w-full border-t border-white/10" style={{ top: `${(i + 1) * 16.6}%` }} />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`v${i}`} className="absolute h-full border-l border-white/10" style={{ left: `${(i + 1) * 16.6}%` }} />
            ))}
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div
              className="rounded-full border-2 border-dashed"
              style={{
                width: `${Math.min(radius / 3, 80)}px`,
                height: `${Math.min(radius / 3, 80)}px`,
                borderColor: typeConfig.color + '60',
                backgroundColor: typeConfig.color + '15',
              }}
            />
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
          </div>
          <div className="absolute bottom-1.5 right-1.5 text-[9px] text-white/30 font-mono">
            {parseFloat(lat).toFixed(4)}, {parseFloat(lng).toFixed(4)}
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!name.trim() || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))}
          className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          {existingId ? '💾 Update Place' : '📍 Save Place'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-white/50 transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}