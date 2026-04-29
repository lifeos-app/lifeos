/**
 * Realm HUD — Minimal heads-up display overlay
 *
 * Shows: zone name, minimap indicator, controls hint, back button
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Map, ZoomIn, ZoomOut, Volume2, VolumeX, MessageCircle, Palette } from 'lucide-react';
import type { RealmState } from '../RealmEngine';
import { getRealmTimeToday } from '../bridge/RealmSessionGuard';

interface RealmHUDProps {
  zoneName: string;
  playerLevel: number;
  playerName: string;
  questCount: number;
  state: RealmState;
  onBack: () => void;
  onToggleZoom: () => void;
  onToggleMusic: () => void;
  musicEnabled: boolean;
  onToggleMinimap?: () => void;
  minimapVisible?: boolean;
  onToggleChat?: () => void;
  chatVisible?: boolean;
  onlineCount?: number;
  onToggleWorldMap?: () => void;
  worldMapOpen?: boolean;
  onToggleBiomePicker?: () => void;
  biomePickerOpen?: boolean;
  /** Extra action buttons rendered in the HUD actions area */
  extraActions?: React.ReactNode;
}

export function RealmHUD({
  zoneName,
  playerLevel,
  playerName,
  questCount,
  state,
  onBack,
  onToggleZoom,
  onToggleMusic,
  musicEnabled,
  onToggleMinimap,
  minimapVisible,
  onToggleChat,
  chatVisible,
  onlineCount,
  onToggleWorldMap,
  worldMapOpen,
  onToggleBiomePicker,
  biomePickerOpen,
  extraActions,
}: RealmHUDProps) {
  const [showControls, setShowControls] = useState(true);
  const [realmMinutes, setRealmMinutes] = useState(() => getRealmTimeToday());

  useEffect(() => {
    const interval = setInterval(() => {
      setRealmMinutes(getRealmTimeToday());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="realm-hud">
      {/* Top bar */}
      <div className="realm-hud-top">
        <button className="realm-hud-btn" onClick={onBack} title="Back to Character Hub">
          <ArrowLeft size={18} />
        </button>

        <div className="realm-hud-zone">
          <span className="realm-hud-zone-name">{zoneName}</span>
          {realmMinutes > 0 && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', display: 'block', marginTop: 2 }}>
              Today: {realmMinutes}m in The Realm
            </span>
          )}
        </div>

        <div className="realm-hud-actions">
          {onToggleChat && (
            <button
              className="realm-hud-btn realm-hud-chat-btn"
              onClick={onToggleChat}
              title="Toggle chat"
              style={chatVisible ? { background: 'rgba(255,215,0,0.2)' } : undefined}
            >
              <MessageCircle size={16} />
              {onlineCount != null && onlineCount > 1 && (
                <span className="realm-hud-badge">{onlineCount}</span>
              )}
            </button>
          )}
          {onToggleWorldMap && (
            <button
              className="realm-hud-btn"
              onClick={onToggleWorldMap}
              title="Open world map"
              style={worldMapOpen ? { background: 'rgba(255,215,0,0.2)' } : undefined}
            >
              <Map size={16} />
            </button>
          )}
          {onToggleMinimap && !onToggleWorldMap && (
            <button
              className="realm-hud-btn"
              onClick={onToggleMinimap}
              title="Toggle minimap"
              style={minimapVisible ? { background: 'rgba(255,215,0,0.2)' } : undefined}
            >
              <Map size={16} />
            </button>
          )}
          {onToggleBiomePicker && (
            <button
              className="realm-hud-btn"
              onClick={onToggleBiomePicker}
              title="Change biome"
              style={biomePickerOpen ? { background: 'rgba(255,215,0,0.2)' } : undefined}
            >
              <Palette size={16} />
            </button>
          )}
          <button className="realm-hud-btn" onClick={onToggleZoom} title="Toggle zoom">
            <ZoomIn size={16} />
          </button>
          <button className="realm-hud-btn" onClick={onToggleMusic} title="Toggle music">
            {musicEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          {extraActions}
        </div>
      </div>

      {/* Quest indicator */}
      {questCount > 0 && (
        <div className="realm-hud-quests">
          📜 {questCount} active quest{questCount !== 1 ? 's' : ''}
        </div>
      )}

      {/* Controls hint (dismissible) */}
      {showControls && state === 'playing' && (
        <div className="realm-hud-controls" onClick={() => setShowControls(false)}>
          <span>🎮 WASD or tap to move • Tap NPCs to talk</span>
          <span className="realm-hud-dismiss">✕</span>
        </div>
      )}
    </div>
  );
}
