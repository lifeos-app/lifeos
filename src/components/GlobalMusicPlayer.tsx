/**
 * Global Music Player — Floating bar at bottom of screen
 *
 * Persists across all page navigations. Shows a collapsed mini bar
 * when a track is playing, and expands to the full player on click.
 * Visibility state is persisted to localStorage.
 */

import { useState, useEffect, useCallback } from 'react';
import { MusicPlayer } from './academy/MusicPlayer';
import { useMusicPlayerStore } from '../stores/useMusicPlayerStore';

const VISIBILITY_KEY = 'lifeos:music-player-visible';
const SIDEBAR_WIDTH_COLLAPSED = 64;
const SIDEBAR_WIDTH = 240;

function loadVisibility(): boolean {
  try {
    const raw = localStorage.getItem(VISIBILITY_KEY);
    if (raw !== null) return JSON.parse(raw);
  } catch { /* ignore */ }
  return false;
}

function saveVisibility(visible: boolean) {
  try {
    localStorage.setItem(VISIBILITY_KEY, JSON.stringify(visible));
  } catch { /* quota */ }
}

export function GlobalMusicPlayer() {
  const currentTrack = useMusicPlayerStore(s => s.currentTrack);
  const isPlaying = useMusicPlayerStore(s => s.isPlaying);
  
  // States: 'hidden' | 'mini' | 'expanded'
  const [state, setState] = useState<'hidden' | 'mini' | 'expanded'>(() => {
    const saved = loadVisibility();
    if (saved) return 'mini';
    return 'hidden';
  });
  
  // Auto-show mini bar when a track starts playing (but don't auto-hide)
  useEffect(() => {
    if (currentTrack && isPlaying && state === 'hidden') {
      setState('mini');
      saveVisibility(true);
    }
  }, [currentTrack?.path, isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist visibility on change
  useEffect(() => {
    saveVisibility(state !== 'hidden');
  }, [state]);

  const handleExpand = useCallback(() => {
    setState('expanded');
  }, []);

  const handleCollapse = useCallback(() => {
    setState('mini');
  }, []);

  const handleClose = useCallback(() => {
    setState('hidden');
  }, []);

  if (state === 'hidden') return null;

  // Responsive: on mobile (< 769px), full-width at bottom
  // On desktop, offset to the right of the sidebar
  const isExpanded = state === 'expanded';

  return (
    <div style={{
      position: 'fixed' as const,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      transition: 'all 0.3s ease',
    }}>
      <div style={{
        maxWidth: isExpanded ? 800 : 500,
        margin: '0 auto',
        // On desktop, offset from left sidebar
        marginLeft: `clamp(0px, calc(${SIDEBAR_WIDTH}px - 50%), 0px)`,
        padding: isExpanded ? '0 12px 12px' : '0 8px 8px',
      }}>
        {/* Backdrop for expanded state */}
        {isExpanded && (
          <div
            onClick={handleCollapse}
            style={{
              position: 'fixed' as const,
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 99,
            }}
          />
        )}
        <div style={{
          borderRadius: isExpanded ? 12 : 10,
          overflow: 'hidden',
          boxShadow: isExpanded
            ? '0 -4px 40px rgba(0,212,255,0.15), 0 0 0 1px rgba(255,255,255,0.08)'
            : '0 -2px 20px rgba(0,212,255,0.1), 0 0 0 1px rgba(255,255,255,0.06)',
          background: isExpanded
            ? 'rgba(10, 22, 40, 0.97)'
            : 'rgba(10, 22, 40, 0.95)',
          backdropFilter: 'blur(24px)',
          transition: 'all 0.3s ease',
          maxHeight: isExpanded ? '80vh' : 48,
          overflowY: isExpanded ? 'auto' : 'hidden',
        }}>
          <MusicPlayer
            collapsed={!isExpanded}
            onExpand={handleExpand}
            onClose={handleCollapse}
            floating
          />
        </div>
      </div>
    </div>
  );
}