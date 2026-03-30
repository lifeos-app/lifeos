/**
 * Academy Music Player
 * 
 * Floating/docked audio player with playlist, category filters,
 * and keyboard shortcuts. Uses HTML5 Audio API.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, VolumeX, ChevronUp, ChevronDown, Music,
} from 'lucide-react';
import { useAcademyStore } from '../../stores/useAcademyStore';
import { loadTrackUrl } from '../../lib/academy-data';
import {
  MUSIC_CATEGORIES, CATEGORY_COLORS, CATEGORY_EMOJIS,
  type Track, type MusicCategory,
} from '../../data/academy-manifest';

export function MusicPlayer() {
  const {
    currentTrack, isPlaying, volume, shuffle, repeat,
    trackProgress, categoryFilter, playlist,
    playTrack, togglePlay, nextTrack, prevTrack,
    setVolume, toggleShuffle, toggleRepeat,
    setCategoryFilter, setTrackProgress,
  } = useAcademyStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Create/update audio element — wrapped in try/catch for WebKitGTK on ARM64
  useEffect(() => {
    if (!audioRef.current) {
      try {
        audioRef.current = new Audio();
        audioRef.current.addEventListener('ended', () => {
          nextTrack();
        });
        audioRef.current.addEventListener('timeupdate', () => {
          const audio = audioRef.current;
          if (audio && audio.duration) {
            setCurrentTime(audio.currentTime);
            setTrackProgress(audio.currentTime / audio.duration);
          }
        });
        audioRef.current.addEventListener('loadedmetadata', () => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        });
        audioRef.current.addEventListener('error', () => {
          // Silently handle audio load errors — file might not exist yet
        });
      } catch {
        // Audio API not available — player will be visual-only
        console.warn('[MusicPlayer] Audio API unavailable');
      }
    }
    return () => {
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch { /* ignore */ }
        audioRef.current = null;
      }
    };
  }, []);

  // Handle track changes — load audio via async blob URL (Tauri) or HTTP URL (browser)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    let cancelled = false;

    loadTrackUrl(currentTrack.path).then(url => {
      if (cancelled) return;
      // Revoke previous blob URL to free memory
      if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }
      audio.src = url;
      audio.load();
      if (isPlaying) {
        audio.play().catch(() => { /* autoplay blocked */ });
      }
    }).catch(() => {
      if (!cancelled) {
        console.warn('[MusicPlayer] Failed to load track:', currentTrack.path);
      }
    });

    return () => { cancelled = true; };
  }, [currentTrack?.path]);

  // Handle play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    try {
      if (isPlaying) {
        audio.play().catch(() => { /* blocked */ });
      } else {
        audio.pause();
      }
    } catch {
      // Ignore audio play/pause errors
    }
  }, [isPlaying]);

  // Handle volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
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
    const audio = audioRef.current;
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

  return (
    <div className="academy-music-player" style={{
      position: 'sticky', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: '#0A1628', borderTop: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Playlist Panel */}
      {playlistOpen && (
        <div style={{
          maxHeight: 400, overflowY: 'auto', padding: '16px',
          background: '#0D1B2A', borderTop: '1px solid rgba(255,255,255,0.06)',
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
              All ({60})
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
            {playlist.map((track, idx) => (
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
