/**
 * Music Player Store — Zustand
 *
 * Dedicated store for global music player state, independent of AcademyStore.
 * The Audio element is managed here as a singleton to prevent duplicate playback.
 * Persists volume, shuffle, repeat to localStorage.
 */

import { create } from 'zustand';
import { MUSIC_TRACKS, type Track, type MusicCategory } from '../data/academy-manifest';
import { loadTrackUrl } from '../lib/academy-data';

// ── Types ──

interface MusicPlayerState {
  currentTrack: Track | null;
  currentTrackIndex: number;
  isPlaying: boolean;
  volume: number;
  shuffle: boolean;
  repeat: boolean;
  trackProgress: number; // 0-1
  categoryFilter: MusicCategory | 'All';
  playlist: Track[];
  duration: number;
  currentTime: number;
}

interface MusicPlayerActions {
  playTrack: (track: Track) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setCategoryFilter: (category: MusicCategory | 'All') => void;
  setTrackProgress: (progress: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  hydrate: () => void;
}

// ── Storage helpers ──

const STORAGE_KEY = 'lifeos:music-player';

function loadPersisted(): { volume: number; shuffle: boolean; repeat: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        volume: typeof parsed.volume === 'number' ? parsed.volume : 0.7,
        shuffle: !!parsed.shuffle,
        repeat: !!parsed.repeat,
      };
    }
  } catch { /* ignore */ }
  return { volume: 0.7, shuffle: false, repeat: false };
}

function persist(state: { volume: number; shuffle: boolean; repeat: boolean }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota */ }
}

// ── Singleton Audio ──

let audioInstance: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audioInstance) {
    try {
      audioInstance = new Audio();
      audioInstance.addEventListener('error', () => {
        // Silently handle audio load errors — file might not exist yet
      });
    } catch {
      console.warn('[MusicPlayerStore] Audio API unavailable');
    }
  }
  return audioInstance!;
}

// ── Store ──

export const useMusicPlayerStore = create<MusicPlayerState & MusicPlayerActions>((set, get) => {
  const persisted = loadPersisted();

  return {
    // Initial state
    currentTrack: null,
    currentTrackIndex: -1,
    isPlaying: false,
    volume: persisted.volume,
    shuffle: persisted.shuffle,
    repeat: persisted.repeat,
    trackProgress: 0,
    categoryFilter: 'All',
    playlist: MUSIC_TRACKS,
    duration: 0,
    currentTime: 0,

    hydrate: () => {
      const p = loadPersisted();
      const audio = getAudio();
      audio.volume = p.volume;
      set({ volume: p.volume, shuffle: p.shuffle, repeat: p.repeat });
    },

    playTrack: (track: Track) => {
      const { playlist } = get();
      const index = playlist.findIndex(t => t.path === track.path);
      set({ currentTrack: track, currentTrackIndex: index, isPlaying: true, trackProgress: 0 });

      // Load and play via the singleton audio element
      const audio = getAudio();
      let cancelled = false;

      loadTrackUrl(track.path).then(url => {
        if (cancelled) return;
        // Revoke previous blob URL to free memory
        if (audio.src && audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
        audio.src = url;
        audio.load();
        audio.play().catch(() => { /* autoplay blocked */ });
      }).catch(() => {
        if (!cancelled) {
          console.warn('[MusicPlayerStore] Failed to load track:', track.path);
        }
      });

      // Return cancel function (not used directly here, but prevents stale loads)
      // The audio singleton handles one track at a time
    },

    togglePlay: () => {
      const { isPlaying } = get();
      const audio = getAudio();
      if (!isPlaying) {
        if (audio.src) {
          audio.play().catch(() => { /* blocked */ });
        }
      } else {
        audio.pause();
      }
      set({ isPlaying: !isPlaying });
    },

    nextTrack: () => {
      const { playlist, currentTrackIndex, shuffle, repeat } = get();
      if (playlist.length === 0) return;

      let nextIdx: number;
      if (shuffle) {
        nextIdx = Math.floor(Math.random() * playlist.length);
      } else if (currentTrackIndex >= playlist.length - 1) {
        nextIdx = repeat ? 0 : currentTrackIndex;
        if (!repeat) {
          set({ isPlaying: false });
          return;
        }
      } else {
        nextIdx = currentTrackIndex + 1;
      }

      const nextTrack = playlist[nextIdx];
      set({ currentTrack: nextTrack, currentTrackIndex: nextIdx, trackProgress: 0 });

      const audio = getAudio();
      loadTrackUrl(nextTrack.path).then(url => {
        if (audio.src && audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
        audio.src = url;
        audio.load();
        if (get().isPlaying) {
          audio.play().catch(() => { /* blocked */ });
        }
      }).catch(() => {
        console.warn('[MusicPlayerStore] Failed to load track:', nextTrack.path);
      });
    },

    prevTrack: () => {
      const { playlist, currentTrackIndex, shuffle } = get();
      if (playlist.length === 0) return;

      let prevIdx: number;
      if (shuffle) {
        prevIdx = Math.floor(Math.random() * playlist.length);
      } else {
        prevIdx = currentTrackIndex <= 0 ? playlist.length - 1 : currentTrackIndex - 1;
      }

      const prevTrack = playlist[prevIdx];
      set({ currentTrack: prevTrack, currentTrackIndex: prevIdx, trackProgress: 0 });

      const audio = getAudio();
      loadTrackUrl(prevTrack.path).then(url => {
        if (audio.src && audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
        audio.src = url;
        audio.load();
        if (get().isPlaying) {
          audio.play().catch(() => { /* blocked */ });
        }
      }).catch(() => {
        console.warn('[MusicPlayerStore] Failed to load track:', prevTrack.path);
      });
    },

    setVolume: (volume: number) => {
      const audio = getAudio();
      audio.volume = volume;
      persist({ volume, shuffle: get().shuffle, repeat: get().repeat });
      set({ volume });
    },

    toggleShuffle: () => {
      const newVal = !get().shuffle;
      persist({ volume: get().volume, shuffle: newVal, repeat: get().repeat });
      set({ shuffle: newVal });
    },

    toggleRepeat: () => {
      const newVal = !get().repeat;
      persist({ volume: get().volume, shuffle: get().shuffle, repeat: newVal });
      set({ repeat: newVal });
    },

    setCategoryFilter: (category: MusicCategory | 'All') => {
      const filtered = category === 'All' ? MUSIC_TRACKS : MUSIC_TRACKS.filter(t => t.category === category);
      set({ categoryFilter: category, playlist: filtered });
    },

    setTrackProgress: (progress: number) => {
      set({ trackProgress: progress });
    },

    setCurrentTime: (time: number) => {
      set({ currentTime: time });
    },

    setDuration: (duration: number) => {
      set({ duration });
    },
  };
});

// ── Audio event wiring (runs once) ──
// Set up ended/timeupdate/loadedmetadata handlers on the singleton audio element.
// This is called from the MusicPlayer component's useEffect, but the logic
// lives here so both the academy-embedded and global players share it.

let audioWired = false;

export function wireAudioEvents() {
  if (audioWired) return;
  audioWired = true;

  const audio = getAudio();
  if (!audio) return;

  audio.addEventListener('ended', () => {
    useMusicPlayerStore.getState().nextTrack();
  });

  audio.addEventListener('timeupdate', () => {
    if (audio && audio.duration) {
      useMusicPlayerStore.getState().setTrackProgress(audio.currentTime / audio.duration);
      useMusicPlayerStore.getState().setCurrentTime(audio.currentTime);
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    if (audio) {
      useMusicPlayerStore.getState().setDuration(audio.duration);
    }
  });
}

/** Expose the singleton audio for components that need seek functionality */
export function getAudioElement(): HTMLAudioElement | null {
  return audioInstance;
}