/**
 * LocationContext.tsx — Main page for Location-Aware Context
 *
 * Current location, map view, places list, recent movements,
 * automations, travel log, and privacy controls.
 * Your phone finally understands where you are.
 */

import { useState } from 'react';
import { useLocationContext, haversineDistance } from './useLocationContext';
import { PlacesManager } from './PlacesManager';
import { LocationAutomations } from './LocationAutomations';
import { TravelLogView } from './TravelLogView';
import { LocationHistory } from './LocationHistory';
import { localDateStr } from '../../utils/date';

type Tab = 'overview' | 'places' | 'automations' | 'travel' | 'history';

export function LocationContextPage() {
  const ctx = useLocationContext();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Now', icon: '📍' },
    { id: 'places', label: 'Places', icon: '🏠' },
    { id: 'automations', label: 'Auto', icon: '⚡' },
    { id: 'travel', label: 'Travel', icon: '🚗' },
    { id: 'history', label: 'History', icon: '🕐' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] via-[#0d0d24] to-[#0a0a1a] text-white">
      {/* Header */}
      <div className="px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📍</span>
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300 bg-clip-text text-transparent">
              Location
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* GPS Status */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${
              ctx.isWatching
                ? 'bg-emerald-900/40 border border-emerald-500/30 text-emerald-300'
                : 'bg-red-900/40 border border-red-500/30 text-red-300'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                ctx.isWatching ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
              }`} />
              {ctx.isWatching ? 'GPS Active' : 'GPS Off'}
            </div>
            {/* Battery Impact */}
            <div className={`px-2 py-1 rounded-full text-[10px] font-medium ${
              ctx.batteryImpact === 'low' ? 'bg-green-900/30 text-green-300' :
              ctx.batteryImpact === 'medium' ? 'bg-yellow-900/30 text-yellow-300' :
              'bg-red-900/30 text-red-300'
            }`}>
              🔋 {ctx.batteryImpact}
            </div>
          </div>
        </div>
        <p className="text-xs text-cyan-300/50 ml-9 -mt-1">
          Context-aware. Always where you need to be.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 mb-4">
        <div className="flex gap-1 p-1 rounded-xl bg-[#111132]/60 border border-white/5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-600/40 to-blue-600/40 text-white border border-cyan-500/30'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              <span className="block text-sm mb-0.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 pb-24">
        {activeTab === 'overview' && <OverviewTab ctx={ctx} />}
        {activeTab === 'places' && <PlacesManager />}
        {activeTab === 'automations' && <LocationAutomations />}
        {activeTab === 'travel' && <TravelLogView />}
        {activeTab === 'history' && <LocationHistory />}
      </div>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────

function OverviewTab({ ctx }: { ctx: ReturnType<typeof useLocationContext> }) {
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Accuracy color
  const accuracyColor = ctx.gpsAccuracy <= 10
    ? 'text-emerald-400'
    : ctx.gpsAccuracy <= 50
      ? 'text-yellow-400'
      : 'text-red-400';

  const accuracyLabel = ctx.gpsAccuracy <= 10
    ? 'Excellent'
    : ctx.gpsAccuracy <= 30
      ? 'Good'
      : ctx.gpsAccuracy <= 50
        ? 'Fair'
        : 'Poor';

  return (
    <div className="space-y-4">
      {/* Current Location Card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#111132] to-[#0d0d24] border border-cyan-500/15 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-cyan-200">Current Location</h3>
          {ctx.currentPlace && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-900/40 border border-cyan-500/30 text-cyan-300">
              At {ctx.currentPlace.name}
            </span>
          )}
        </div>

        {ctx.currentLat !== null && ctx.currentLng !== null ? (
          <>
            {/* Map placeholder — visual representation */}
            <div className="relative h-40 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/5 mb-3 overflow-hidden">
              {/* Simulated map grid */}
              <div className="absolute inset-0 opacity-20">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`h${i}`} className="absolute w-full border-t border-white/10" style={{ top: `${(i + 1) * 12.5}%` }} />
                ))}
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`v${i}`} className="absolute h-full border-l border-white/10" style={{ left: `${(i + 1) * 12.5}%` }} />
                ))}
              </div>
              {/* Geofence circles */}
              {ctx.places.map(place => {
                const x = ((place.lng - (ctx.currentLng! - 0.02)) / 0.04) * 100;
                const y = ((place.lat - (ctx.currentLat! - 0.02)) / 0.04) * 100;
                const radiusPx = (place.radius / 2220) * 100; // Rough scale
                if (x < -20 || x > 120 || y < -20 || y > 120) return null;
                return (
                  <div
                    key={place.id}
                    className="absolute rounded-full border-2 opacity-40"
                    style={{
                      left: `${Math.max(0, Math.min(100, x))}%`,
                      top: `${Math.max(0, Math.min(100, y))}%`,
                      width: `${Math.min(radiusPx, 40)}px`,
                      height: `${Math.min(radiusPx, 40)}px`,
                      borderColor: place.color,
                      backgroundColor: place.color + '15',
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] whitespace-nowrap">
                      {place.icon} {place.name}
                    </span>
                  </div>
                );
              })}
              {/* Current position dot */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50" />
                <div className="absolute -inset-3 rounded-full border border-cyan-400/30 animate-ping" />
              </div>
              {/* Context badge */}
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-black/60 text-[10px] text-white/70">
                {ctx.currentContext === 'morning' && '🌅 Morning'}
                {ctx.currentContext === 'work' && '💼 Work'}
                {ctx.currentContext === 'evening' && '🌆 Evening'}
                {ctx.currentContext === 'night' && '🌙 Night'}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-white/50 font-mono">
                {ctx.privacyMode
                  ? `${(Math.round(ctx.currentLat * 100) / 100).toFixed(2)}, ${(Math.round(ctx.currentLng * 100) / 100).toFixed(2)}`
                  : `${ctx.currentLat.toFixed(6)}, ${ctx.currentLng.toFixed(6)}`
                }
              </div>
              <div className={`text-xs font-medium ${accuracyColor}`}>
                📡 {accuracyLabel} ({Math.round(ctx.gpsAccuracy)}m)
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-white/30 text-sm">
            {ctx.positionError ? (
              <>
                <div className="text-2xl mb-2">⚠️</div>
                <div>{ctx.positionError}</div>
              </>
            ) : (
              <>
                <div className="text-2xl mb-2">📡</div>
                <div>Waiting for GPS signal...</div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <QuickStat
          icon="🚗"
          value={`${ctx.todayKms.toFixed(1)}km`}
          label="Today"
          color="from-cyan-600/30 to-blue-900/30"
        />
        <QuickStat
          icon="📍"
          value={ctx.activeGeofences.length}
          label="Active Zones"
          color="from-emerald-600/30 to-green-900/30"
        />
        <QuickStat
          icon="🏠"
          value={ctx.places.length}
          label="Saved Places"
          color="from-violet-600/30 to-purple-900/30"
        />
      </div>

      {/* Places List */}
      {ctx.places.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-cyan-400/60 mb-2 px-1">
            Your Places
          </h3>
          <div className="space-y-2">
            {ctx.places.map(place => {
              const dist = ctx.distanceTo(place);
              const isActive = ctx.activeGeofences.includes(place.id);
              return (
                <div
                  key={place.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isActive
                      ? 'bg-cyan-900/20 border-cyan-500/30'
                      : 'bg-[#111132]/60 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{place.icon}</span>
                      <div>
                        <div className="text-sm font-medium text-white">{place.name}</div>
                        <div className="text-[10px] text-white/40">
                          {place.type} · {place.radius}m radius
                          {place.address && ` · ${place.address}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {dist !== null ? (
                        <div className="text-xs text-white/60">
                          {dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
                        </div>
                      ) : null}
                      {isActive && (
                        <span className="text-[9px] text-cyan-400 font-medium">HERE</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Movements (today) */}
      {ctx.todayHistory.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-cyan-400/60 mb-2 px-1">
            Today's Movements
          </h3>
          <div className="space-y-1">
            {ctx.todayHistory.slice(0, 8).map((entry, i) => (
              <div key={entry.id} className="flex items-center gap-3 px-1 py-1.5">
                <div className="relative">
                  <div className={`w-2 h-2 rounded-full ${
                    i === 0 ? 'bg-cyan-400 animate-pulse' : 'bg-white/20'
                  }`} />
                  {i < ctx.todayHistory.length - 1 && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-px h-4 bg-white/10" />
                  )}
                </div>
                <div className="text-xs text-white/50 flex-1">
                  {entry.label || 'Unknown location'}
                </div>
                <div className="text-[10px] text-white/30 font-mono">
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Travel Summary */}
      {ctx.todayTravel.length > 0 && (
        <div className="p-3 rounded-xl bg-[#111132]/60 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">🚗</span>
            <span className="text-xs font-medium text-white/70">Today's Travel</span>
          </div>
          <div className="space-y-1">
            {ctx.todayTravel.map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs text-white/50">
                <span>{t.from} → {t.to}</span>
                <span className="font-mono">{t.kms}km · {t.purpose}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Arrival Patterns */}
      {ctx.arrivalPatterns.length > 0 && (
        <div className="p-3 rounded-xl bg-gradient-to-r from-violet-900/20 to-indigo-900/20 border border-violet-500/15">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">🧠</span>
            <span className="text-xs font-medium text-violet-200">Detected Patterns</span>
          </div>
          <div className="space-y-1.5">
            {ctx.arrivalPatterns.slice(0, 3).map(pattern => (
              <p key={pattern.locationId} className="text-xs text-violet-300/70">
                You typically arrive at <span className="text-violet-200">{pattern.locationName}</span> at{' '}
                <span className="font-mono text-violet-200">{pattern.avgArrivalTime}</span>
                <span className="text-violet-400/40"> ({pattern.count} observations)</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Privacy Controls */}
      <div>
        <button
          onClick={() => setShowPrivacy(!showPrivacy)}
          className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-all mb-2"
        >
          <span>🔒</span>
          Privacy Controls
          <span className="text-[10px]">{showPrivacy ? '▲' : '▼'}</span>
        </button>
        {showPrivacy && (
          <div className="p-3 rounded-xl bg-[#111132]/60 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-white/70">Location Tracking</div>
                <div className="text-[10px] text-white/30">Track GPS for automations and travel</div>
              </div>
              <button
                onClick={() => ctx.setTrackingEnabled(!ctx.trackingEnabled)}
                className={`w-11 h-6 rounded-full transition-all relative ${
                  ctx.trackingEnabled
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                    : 'bg-slate-700'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                  ctx.trackingEnabled ? 'left-5.5' : 'left-0.5'
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-white/70">Privacy Mode</div>
                <div className="text-[10px] text-white/30">Blurs exact coordinates in history</div>
              </div>
              <button
                onClick={() => ctx.setPrivacyMode(!ctx.privacyMode)}
                className={`w-11 h-6 rounded-full transition-all relative ${
                  ctx.privacyMode
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                    : 'bg-slate-700'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                  ctx.privacyMode ? 'left-5.5' : 'left-0.5'
                }`} />
              </button>
            </div>
            <button
              onClick={() => ctx.clearHistoryBefore(localDateStr(new Date(Date.now() - 7 * 86400000)))}
              className="w-full py-2 text-xs text-red-300/60 hover:text-red-300 bg-red-900/20 hover:bg-red-900/30 rounded-lg transition-all"
            >
              Clear history older than 7 days
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── QuickStat ─────────────────────────────────────────────────────────

function QuickStat({ icon, value, label, color }: {
  icon: string; value: string | number; label: string; color: string;
}) {
  return (
    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} border border-white/5`}>
      <div className="text-lg">{icon}</div>
      <div className="text-sm font-bold text-white mt-0.5">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  );
}