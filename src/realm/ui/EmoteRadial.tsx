/**
 * EmoteRadial — Bottom-right radial emote menu
 *
 * Tap the trigger button to show 5 emote options in a semicircle.
 * Each option is a text label in a circular button (44px+ touch targets).
 */

import { useState, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import type { EmoteType } from '../multiplayer/types';

interface EmoteRadialProps {
  onEmote: (emote: EmoteType) => void;
}

const EMOTES: { type: EmoteType; label: string }[] = [
  { type: 'wave', label: 'Wave' },
  { type: 'cheer', label: 'Cheer' },
  { type: 'gg', label: 'GG' },
  { type: 'brb', label: 'BRB' },
  { type: 'focus', label: 'Focus' },
];

export function EmoteRadial({ onEmote }: EmoteRadialProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback((emote: EmoteType) => {
    onEmote(emote);
    setOpen(false);
  }, [onEmote]);

  const handleToggle = useCallback(() => {
    setOpen(prev => !prev);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        right: 16,
        zIndex: 90,
      }}
    >
      {/* Radial options */}
      {open && (
        <>
          {/* Backdrop to close */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: -1,
            }}
            onClick={() => setOpen(false)}
          />
          {EMOTES.map((e, i) => {
            // Semicircle above the trigger: angles from -150° to -30°
            const angle = (-150 + i * 30) * (Math.PI / 180);
            const radius = 80;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <button
                key={e.type}
                onClick={() => handleSelect(e.type)}
                style={{
                  position: 'absolute',
                  bottom: 52 - y,
                  right: 4 - x,
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: '2px solid rgba(255,215,0,0.4)',
                  background: 'rgba(20,20,40,0.85)',
                  color: '#FFD700',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  animation: 'emote-pop 0.15s ease-out',
                  animationDelay: `${i * 30}ms`,
                  animationFillMode: 'both',
                }}
              >
                {e.label}
              </button>
            );
          })}
        </>
      )}

      {/* Trigger button */}
      <button
        onClick={handleToggle}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: open ? '2px solid #FFD700' : '2px solid rgba(255,255,255,0.2)',
          background: open ? 'rgba(255,215,0,0.15)' : 'rgba(20,20,40,0.7)',
          color: open ? '#FFD700' : '#C8D6E5',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
        title="Emotes"
      >
        <Sparkles size={18} />
      </button>

      <style>{`
        @keyframes emote-pop {
          from { transform: scale(0.3); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
