/**
 * OnlinePlayersHUD — Compact overlay showing online player count
 *
 * Appears in top-right of Realm canvas. Click to see player list.
 */

import { useState, useCallback } from 'react';
import { Users, X, ChevronDown } from 'lucide-react';
import type { RemotePlayer } from '../multiplayer/types';

interface OnlinePlayersHUDProps {
  onlineCount: number;
  remotePlayers: RemotePlayer[];
}

export function OnlinePlayersHUD({ onlineCount, remotePlayers }: OnlinePlayersHUDProps) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => {
    setExpanded(p => !p);
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 4,
    }}>
      {/* Compact badge */}
      <button
        onClick={toggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: 'rgba(10, 22, 40, 0.85)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: 20,
          color: '#00D4FF',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: "'Orbitron', monospace",
          letterSpacing: '0.04em',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s',
        }}
      >
        {/* Pulsing green dot */}
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#39FF14',
          boxShadow: '0 0 6px rgba(57, 255, 20, 0.5)',
          animation: 'pulse 2s infinite',
        }} />
        <Users size={12} />
        <span>{onlineCount}</span>
        <ChevronDown
          size={10}
          style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        />
      </button>

      {/* Expanded player list */}
      {expanded && (
        <div style={{
          background: 'rgba(10, 22, 40, 0.92)',
          border: '1px solid rgba(0, 212, 255, 0.15)',
          borderRadius: 12,
          padding: 12,
          minWidth: 180,
          maxHeight: 240,
          overflowY: 'auto',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
            paddingBottom: 8,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.5)',
              fontFamily: "'Orbitron', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Online Players
            </span>
            <button
              onClick={toggle}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.3)',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
              }}
            >
              <X size={12} />
            </button>
          </div>

          {/* You */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 0',
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#39FF14',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, color: '#39FF14', fontWeight: 600 }}>
              You
            </span>
          </div>

          {/* Remote players */}
          {remotePlayers.length === 0 ? (
            <div style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.3)',
              fontStyle: 'italic',
              padding: '8px 0',
            }}>
              No other players in this zone
            </div>
          ) : (
            remotePlayers.map(player => (
              <div
                key={player.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 0',
                }}
              >
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: player.status === 'active' ? '#00D4FF'
                    : player.status === 'idle' ? '#F59E0B'
                    : 'rgba(255,255,255,0.2)',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.7)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {player.name}
                </span>
                <span style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.3)',
                  fontFamily: "'Orbitron', monospace",
                }}>
                  Lv.{player.level}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
