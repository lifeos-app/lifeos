/**
 * Academy Music Player
 * 
 * Floating/docked audio player with playlist, category filters,
 * and keyboard shortcuts. Uses HTML5 Audio API.
 * 
 * Props:
 *   collapsed?: boolean — when true, renders a mini bar (~48px tall)
 *                          with just track title, play/pause, and skip.
 *   onExpand?: () => void — called when collapsed bar is clicked to expand.
 *   onClose?: () => void — called when close/collapse button is clicked in floating mode.
 *   floating?: boolean — when true, renders as a floating bar with close/expand controls.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, VolumeX, ChevronUp, ChevronDown, Music,
  X, Maximize2, GripHorizontal,
} from 'lucide-react';
import { useMusicPlayerStore, wireAudioEvents, getAudioElement } from '../../stores/useMusicPlayerStore';
import {
  MUSIC_CATEGORIES, CATEGORY_COLORS, CATEGORY_EMOJIS,
  type Track, type MusicCategory,
} from '../../data/academy-manifest';

interface MusicPlayerProps {
  collapsed?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
  floating?: boolean;
}

export function MusicPlayer({ collapsed = false, onExpand, onClose, floating = false }: MusicPlayerProps) {
  const {
    currentTrack, isPlaying, volume, shuffle, repeat,
    trackProgress, categoryFilter, playlist,
    playTrack, togglePlay, nextTrack, prevTrack,
    setVolume, toggleShuffle, toggleRepeat,
    setCategoryFilter, setTrackProgress,
    duration, currentTime,
  } = useMusicPlayerStore();

  const [playlistOpen, setPlaylistOpen] = useState(false);

  // Wire up audio events on the singleton audio element (runs once)
  useEffect(() => {
    wireAudioEvents();
  }, []);

  // Sync volume to the singleton audio when it changes
  useEffect(() => {
    const audio = getAudioElement();
    if (audio) audio.volume = volume;
  }, [volume]);

  // Keyboard shortcuts (only when not in an input)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key) {
        case ' ':
          if (currentTrack) { e.preventDefault(); togglePlay(); }
          break;
        case 'n':
          nextTrack();
          break;
        case 'p':
          prevTrack();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentTrack, togglePlay, nextTrack, prevTrack]);

  const seekTo = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = getAudioElement();
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
  }, [duration]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getCategoryGradient = (cat: MusicCategory) => {
    const color = CATEGORY_COLORS[cat];
    return `linear-gradient(135deg, ${color}33, ${color}11)`;
  };

  // ── Collapsed / mini bar ──
  if (collapsed) {
    return (
      <div
        onClick={onExpand}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 16px',
          height: 48,
          cursor: 'pointer',
          background: floating ? 'rgba(10, 22, 40, 0.95)' : '#0A1628',
          backdropFilter: floating ? 'blur(24px)' : undefined,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          transition: 'background 0.2s',
        }}
      >
        {floating && (
          <div style={{ display: 'flex', alignItems: 'center', cursor: 'grab', opacity: 0.4, marginRight: 2 }}>
            <GripHorizontal size={14} />
          </div>
        )}
        <div style={{
          width: 28, height: 28, borderRadius: 6, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
          background: currentTrack
            ? getCategoryGradient(currentTrack.category as MusicCategory)
            : 'rgba(255,255,255,0.05)',
        }}>
          {currentTrack
            ? CATEGORY_EMOJIS[currentTrack.category as MusicCategory]
            : <Music size={14} color="#5A7A9A" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500, color: '#E0E0E0',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {currentTrack?.title || 'No track selected'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} onClick={e => e.stopPropagation()}>
          <IconBtn onClick={prevTrack} title="Previous">
            <SkipBack size={14} />
          </IconBtn>
          <button
            onClick={togglePlay}
            disabled={!currentTrack}
            title="Play/Pause"
            style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', border: 'none',
              background: currentTrack ? '#00D4FF' : 'rgba(255,255,255,0.1)',
              color: currentTrack ? '#0A2540' : '#5A7A9A',
              cursor: currentTrack ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
          </button>
          <IconBtn onClick={nextTrack} title="Next">
            <SkipForward size={14} />
          </IconBtn>
        </div>
        {floating && onExpand && (
          <div onClick={e => e.stopPropagation()}>
            <IconBtn onClick={onExpand} title="Expand player">
              <Maximize2 size={14} />
            </IconBtn>
          </div>
        )}
      </div>
    );
  }

  // ── Expanded / full player ──
  return (
    <div className="academy-music-player" style={{
      position: floating ? 'relative' : 'sticky',
      bottom: 0, left: 0, right: 0, zIndex: floating ? 100 : 50,
      background: floating ? 'rgba(10, 22, 40, 0.95)' : '#0A1628',
      backdropFilter: floating ? 'blur(24px)' : undefined,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      ...(floating ? { borderRadius: 12, overflow: 'hidden' } : {}),
    }}>
      {/* Floating header with close button */}
      {floating && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.4 }}>
            <GripHorizontal size={14} />
            <span style={{ fontSize: 11, color: '#5A7A9A' }}>Music Player</span>
          </div>
          {onClose && (
            <IconBtn onClick={onClose} title="Minimize player">
              <X size={14} />
            </IconBtn>
          )}
        </div>
      )}

      {/* Playlist Panel */}
      {playlistOpen && (
        <div style={{
          maxHeight: 400, overflowY: 'auto', padding: '16px',
          background: floating ? 'rgba(13, 27, 42, 0.95)' : '#0D1B2A',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* Category Filters */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <button
              onClick={() => setCategoryFilter('All')}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                border: categoryFilter === 'All' ? '1px solid #00D4FF' : '1px solid rgba(255,255,255,0.1)',
                background: categoryFilter === 'All' ? 'rgba(0,212,255,0.15)' : 'transparent',
                color: categoryFilter === 'All' ? '#00D4FF' : '#8BA4BE',
                cursor: 'pointer',
              }}
            >
              All ({MUSIC_TRACKS.length})
            </button>
            {MUSIC_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  border: categoryFilter === cat ? `1px solid ${CATEGORY_COLORS[cat]}` : '1px solid rgba(255,255,255,0.1)',
                  background: categoryFilter === cat ? `${CATEGORY_COLORS[cat]}22` : 'transparent',
                  color: categoryFilter === cat ? CATEGORY_COLORS[cat] : '#8BA4BE',
                  cursor: 'pointer',
                }}
              >
                {CATEGORY_EMOJIS[cat]} {cat}
              </button>
            ))}
          </div>

          {/* Track List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {playlist.map((track: Track, idx: number) => (
              <button
                key={track.path}
                onClick={() => playTrack(track)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  background: currentTrack?.path === track.path ? 'rgba(0,212,255,0.1)' : 'transparent',
                  border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                  width: '100%',
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: 6, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
                  background: getCategoryGradient(track.category as MusicCategory),
                }}>
                  {currentTrack?.path === track.path && isPlaying ? '▶' : CATEGORY_EMOJIS[track.category as MusicCategory]}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: currentTrack?.path === track.path ? 600 : 400,
                    color: currentTrack?.path === track.path ? '#00D4FF' : '#E0E0E0',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {track.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#5A7A9A' }}>
                    {track.category}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mini Player Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', minHeight: 56 }}>
        {/* Track Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 200px' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: currentTrack
              ? getCategoryGradient(currentTrack.category as MusicCategory)
              : 'rgba(255,255,255,0.05)',
            fontSize: 18,
          }}>
            {currentTrack
              ? CATEGORY_EMOJIS[currentTrack.category as MusicCategory]
              : <Music size={16} color="#5A7A9A" />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 500, color: '#E0E0E0',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {currentTrack?.title || 'No track selected'}
            </div>
            <div style={{ fontSize: 11, color: '#5A7A9A' }}>
              {currentTrack?.category || 'Pick a track to begin'}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <IconBtn onClick={toggleShuffle} active={shuffle} title="Shuffle (S)">
            <Shuffle size={14} />
          </IconBtn>
          <IconBtn onClick={prevTrack} title="Previous (P)">
            <SkipBack size={16} />
          </IconBtn>
          <button
            onClick={togglePlay}
            disabled={!currentTrack}
            title="Play/Pause (Space)"
            style={{
              width: 36, height: 36, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', border: 'none',
              background: currentTrack ? '#00D4FF' : 'rgba(255,255,255,0.1)',
              color: currentTrack ? '#0A2540' : '#5A7A9A',
              cursor: currentTrack ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
          </button>
          <IconBtn onClick={nextTrack} title="Next (N)">
            <SkipForward size={16} />
          </IconBtn>
          <IconBtn onClick={toggleRepeat} active={repeat} title="Repeat">
            <Repeat size={14} />
          </IconBtn>
        </div>

        {/* Progress Bar */}
        <div style={{ flex: '2 1 200px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
          <span style={{ fontSize: 11, color: '#5A7A9A', minWidth: 32, textAlign: 'right' }}>
            {formatTime(currentTime)}
          </span>
          <div
            onClick={seekTo}
            style={{
              flex: 1, height: 4, background: 'rgba(255,255,255,0.08)',
              borderRadius: 2, cursor: 'pointer', position: 'relative',
            }}
          >
            <div style={{
              width: `${trackProgress * 100}%`, height: '100%',
              background: '#00D4FF', borderRadius: 2,
              transition: 'width 0.1s linear',
            }} />
          </div>
          <span style={{ fontSize: 11, color: '#5A7A9A', minWidth: 32 }}>
            {formatTime(duration)}
          </span>
        </div>

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <IconBtn onClick={() => setVolume(volume > 0 ? 0 : 0.7)} title="Mute">
            {volume > 0 ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </IconBtn>
          <input
            type="range"
            min={0} max={1} step={0.01}
            value={volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            style={{ width: 60, accentColor: '#00D4FF', height: 4 }}
          />
        </div>

        {/* Playlist toggle */}
        <IconBtn onClick={() => setPlaylistOpen(!playlistOpen)} title="Playlist" active={playlistOpen}>
          {playlistOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ onClick, children, active, title, disabled }: {
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 28, height: 28, borderRadius: 6, display: 'flex',
        alignItems: 'center', justifyContent: 'center', border: 'none',
        background: active ? 'rgba(0,212,255,0.15)' : 'transparent',
        color: active ? '#00D4FF' : '#8BA4BE',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.15s',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}