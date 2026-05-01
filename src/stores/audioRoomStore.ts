/**
 * Audio Room Store — Zustand with persist middleware
 *
 * Manages audio rooms, participants, and settings.
 * WebRTC signaling and audio tracks handled in useAudioRooms hook.
 * Offline-first with localStorage persistence for favorites and settings.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { genId } from '../utils/date';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export interface AudioParticipant {
  userId: string;
  name: string;
  isMuted: boolean;
  isSpeaking: boolean;
  joinedAt: string;
  role: 'host' | 'speaker' | 'listener';
  avatarColor: string;
}

export interface AudioRoom {
  id: string;
  name: string;
  topic: string;
  type: 'study' | 'social' | 'meditation' | 'coworking' | 'celebration';
  host: string;
  participants: AudioParticipant[];
  maxParticipants: number;
  privacy: 'open' | 'friends' | 'guild';
  createdAt: string;
  isActive: boolean;
  ambientTrack?: string;
  description?: string;
}

export interface AudioRoomMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  message: string;
  timestamp: string;
}

export type RoomType = AudioRoom['type'];

export interface RoomTypeDefinition {
  id: RoomType;
  name: string;
  icon: string;
  description: string;
  color: string;
  bgGradient: string;
  defaultAmbient: string;
  defaultMaxParticipants: number;
}

// ═══════════════════════════════════════════════════
// ROOM TYPE DEFINITIONS
// ═══════════════════════════════════════════════════

export const ROOM_TYPES: RoomTypeDefinition[] = [
  {
    id: 'study',
    name: 'Study Room',
    icon: '📖',
    description: 'Focus together in silence. Ambient library sounds to keep you in the zone.',
    color: '#3B82F6',
    bgGradient: 'from-blue-500/20 to-indigo-500/20',
    defaultAmbient: 'library',
    defaultMaxParticipants: 8,
  },
  {
    id: 'social',
    name: 'Social Lounge',
    icon: '☕',
    description: 'Chat and hang out. Grab a virtual drink and make new friends!',
    color: '#F59E0B',
    bgGradient: 'from-amber-500/20 to-orange-500/20',
    defaultAmbient: 'tavern',
    defaultMaxParticipants: 12,
  },
  {
    id: 'meditation',
    name: 'Meditation Room',
    icon: '🧘',
    description: 'Peaceful space for guided meditation and mindful breathing.',
    color: '#A855F7',
    bgGradient: 'from-purple-500/20 to-violet-500/20',
    defaultAmbient: 'forest',
    defaultMaxParticipants: 6,
  },
  {
    id: 'coworking',
    name: 'Co-working Space',
    icon: '💻',
    description: 'Pomodoro sessions together. Work hard, rest together.',
    color: '#10B981',
    bgGradient: 'from-emerald-500/20 to-teal-500/20',
    defaultAmbient: 'cafe',
    defaultMaxParticipants: 10,
  },
  {
    id: 'celebration',
    name: 'Celebration Hall',
    icon: '🎉',
    description: 'Party time! Celebrate milestones, level ups, and achievements!',
    color: '#EC4899',
    bgGradient: 'from-pink-500/20 to-rose-500/20',
    defaultAmbient: 'party',
    defaultMaxParticipants: 20,
  },
];

// ═══════════════════════════════════════════════════
// AMBIENT TRACKS
// ═══════════════════════════════════════════════════

export const AMBIENT_TRACKS = [
  { id: 'library', name: 'Library Whisper', icon: '📚', description: 'Soft rustling pages and quiet ambiance' },
  { id: 'tavern', name: 'Tavern Hearth', icon: '🔥', description: 'Crackling fireplace and distant chatter' },
  { id: 'forest', name: 'Enchanted Forest', icon: '🌲', description: 'Birds, wind through trees, distant stream' },
  { id: 'cafe', name: 'Cozy Cafe', icon: '☕', description: 'Espresso machine, soft music, murmurs' },
  { id: 'party', name: 'Festive Hall', icon: '🎵', description: 'Upbeat music and party atmosphere' },
  { id: 'rain', name: 'Rainy Window', icon: '🌧️', description: 'Gentle rain on a window pane' },
  { id: 'ocean', name: 'Ocean Waves', icon: '🌊', description: 'Waves lapping on a shore' },
  { id: 'fireplace', name: 'Warm Fireplace', icon: '🔥', description: 'Crackling fire and warmth' },
  { id: 'space', name: 'Deep Space', icon: '🌌', description: 'Ambient cosmic drones and silence' },
  { id: 'none', name: 'Silence', icon: '🔇', description: 'No ambient audio' },
];

// ═══════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════

const AVATAR_COLORS = ['#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#A855F7', '#06B6D4', '#F97316', '#EF4444'];

const DEMO_ROOMS: AudioRoom[] = [
  {
    id: 'room-1',
    name: 'Morning Grind',
    topic: 'Daily habits and morning routines',
    type: 'coworking',
    host: 'mentor-1',
    participants: [
      { userId: 'mentor-1', name: 'DragonSlayer', isMuted: false, isSpeaking: false, joinedAt: new Date().toISOString(), role: 'host', avatarColor: '#3B82F6' },
      { userId: 'u2', name: 'RiseAndShine', isMuted: true, isSpeaking: false, joinedAt: new Date().toISOString(), role: 'speaker', avatarColor: '#EC4899' },
      { userId: 'u3', name: 'EarlyBird', isMuted: true, isSpeaking: false, joinedAt: new Date().toISOString(), role: 'listener', avatarColor: '#10B981' },
    ],
    maxParticipants: 10,
    privacy: 'open',
    createdAt: new Date().toISOString(),
    isActive: true,
    ambientTrack: 'cafe',
    description: 'Join us for the morning pomodoro session!',
  },
  {
    id: 'room-2',
    name: 'Zen Garden',
    topic: 'Guided breathing and mindfulness',
    type: 'meditation',
    host: 'mentor-2',
    participants: [
      { userId: 'mentor-2', name: 'MindfulMaster', isMuted: false, isSpeaking: false, joinedAt: new Date().toISOString(), role: 'host', avatarColor: '#A855F7' },
      { userId: 'u4', name: 'PeaceSeeker', isMuted: true, isSpeaking: false, joinedAt: new Date().toISOString(), role: 'listener', avatarColor: '#06B6D4' },
    ],
    maxParticipants: 6,
    privacy: 'open',
    createdAt: new Date().toISOString(),
    isActive: true,
    ambientTrack: 'forest',
  },
  {
    id: 'room-3',
    name: 'Tavern Tales',
    topic: 'Share your LifeOS stories and adventures',
    type: 'social',
    host: 'u5',
    participants: [
      { userId: 'u5', name: 'BardOfLife', isMuted: false, isSpeaking: true, joinedAt: new Date().toISOString(), role: 'host', avatarColor: '#F59E0B' },
      { userId: 'u6', name: 'Wanderer', isMuted: false, isSpeaking: false, joinedAt: new Date().toISOString(), role: 'speaker', avatarColor: '#F97316' },
      { userId: 'u7', name: 'NightOwl', isMuted: true, isSpeaking: false, joinedAt: new Date().toISOString(), role: 'listener', avatarColor: '#EF4444' },
      { userId: 'u8', name: 'DreamWeaver', isMuted: false, isSpeaking: false, joinedAt: new Date().toISOString(), role: 'speaker', avatarColor: '#10B981' },
    ],
    maxParticipants: 12,
    privacy: 'open',
    createdAt: new Date().toISOString(),
    isActive: true,
    ambientTrack: 'tavern',
  },
  {
    id: 'room-4',
    name: 'Deep Focus',
    topic: 'Silent study session — cameras off, mics muted',
    type: 'study',
    host: 'u9',
    participants: [
      { userId: 'u9', name: 'Scholar', isMuted: true, isSpeaking: false, joinedAt: new Date().toISOString(), role: 'host', avatarColor: '#3B82F6' },
      { userId: 'u10', name: 'BookWorm', isMuted: true, isSpeaking: false, joinedAt: new Date().toISOString(), role: 'listener', avatarColor: '#A855F7' },
      { userId: 'u11', name: 'FocusFox', isMuted: true, isSpeaking: false, joinedAt: new Date().toISOString(), role: 'listener', avatarColor: '#EC4899' },
      { userId: 'u12', name: 'QuietQuill', isMuted: true, isSpeaking: false, joinedAt: new Date().toISOString(), role: 'listener', avatarColor: '#06B6D4' },
      { userId: 'u13', name: 'InkWell', isMuted: true, isSpeaking: false, joinedAt: new Date().toISOString(), role: 'listener', avatarColor: '#F97316' },
    ],
    maxParticipants: 8,
    privacy: 'open',
    createdAt: new Date().toISOString(),
    isActive: true,
    ambientTrack: 'library',
  },
];

// ═══════════════════════════════════════════════════
// STORE INTERFACE
// ═══════════════════════════════════════════════════

interface AudioRoomState {
  rooms: AudioRoom[];
  activeRoomId: string | null;
  favoriteRoomIds: string[];
  messages: AudioRoomMessage[];
  micEnabled: boolean;
  speakerEnabled: boolean;
  speakerVolume: number;
  ambientVolume: number;
  isConnecting: boolean;
  raisedHand: boolean;
  pomodoroState: { isRunning: boolean; workMinutes: number; breakMinutes: number; currentPhase: 'work' | 'break'; secondsLeft: number };
}

interface AudioRoomActions {
  // Room management
  createRoom: (name: string, topic: string, type: RoomType, privacy: AudioRoom['privacy'], maxParticipants: number, ambientTrack?: string) => AudioRoom;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  toggleMic: () => void;
  toggleSpeaker: () => void;
  setSpeakerVolume: (volume: number) => void;
  setAmbientVolume: (volume: number) => void;
  raiseHand: () => void;
  lowerHand: () => void;

  // Participants
  updateParticipant: (roomId: string, userId: string, updates: Partial<AudioParticipant>) => void;
  removeParticipant: (roomId: string, userId: string) => void;

  // Chat
  sendMessage: (roomId: string, message: string) => void;

  // Favorites
  toggleFavorite: (roomId: string) => void;

  // Pomodoro
  startPomodoro: (workMinutes?: number, breakMinutes?: number) => void;
  pausePomodoro: () => void;
  resetPomodoro: () => void;

  // Helpers
  getActiveRoom: () => AudioRoom | undefined;
  getRoomById: (id: string) => AudioRoom | undefined;
  getOpenRooms: () => AudioRoom[];
}

// ═══════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════

export const useAudioRoomStore = create<AudioRoomState & AudioRoomActions>()(
  persist(
    (set, get) => ({
      rooms: DEMO_ROOMS,
      activeRoomId: null,
      favoriteRoomIds: [],
      messages: [],
      micEnabled: false,
      speakerEnabled: true,
      speakerVolume: 80,
      ambientVolume: 40,
      isConnecting: false,
      raisedHand: false,
      pomodoroState: { isRunning: false, workMinutes: 25, breakMinutes: 5, currentPhase: 'work', secondsLeft: 25 * 60 },

      createRoom: (name, topic, type, privacy, maxParticipants, ambientTrack) => {
        const roomType = ROOM_TYPES.find(rt => rt.id === type);
        const room: AudioRoom = {
          id: genId('ar-'),
          name,
          topic,
          type,
          host: 'current-user',
          participants: [{
            userId: 'current-user',
            name: 'You',
            isMuted: false,
            isSpeaking: false,
            joinedAt: new Date().toISOString(),
            role: 'host',
            avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
          }],
          maxParticipants,
          privacy,
          createdAt: new Date().toISOString(),
          isActive: true,
          ambientTrack: ambientTrack || roomType?.defaultAmbient || 'none',
        };
        set(s => ({ rooms: [...s.rooms, room] }));
        return room;
      },

      joinRoom: (roomId) => {
        const state = get();
        const room = state.rooms.find(r => r.id === roomId);
        if (!room) return;
        if (room.participants.length >= room.maxParticipants) {
          logger.warn('[audio-rooms] Room is full');
          return;
        }
        if (room.participants.some(p => p.userId === 'current-user')) {
          set({ activeRoomId: roomId });
          return;
        }

        const newParticipant: AudioParticipant = {
          userId: 'current-user',
          name: 'You',
          isMuted: true,
          isSpeaking: false,
          joinedAt: new Date().toISOString(),
          role: 'listener',
          avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        };

        set(s => ({
          rooms: s.rooms.map(r => r.id === roomId ? { ...r, participants: [...r.participants, newParticipant] } : r),
          activeRoomId: roomId,
          isConnecting: true,
        }));

        // Simulate connection delay
        setTimeout(() => {
          set({ isConnecting: false });
        }, 1500);
      },

      leaveRoom: () => {
        const state = get();
        if (!state.activeRoomId) return;
        set(s => ({
          rooms: s.rooms.map(r =>
            r.id === s.activeRoomId
              ? { ...r, participants: r.participants.filter(p => p.userId !== 'current-user') }
              : r
          ),
          activeRoomId: null,
          micEnabled: false,
          raisedHand: false,
          pomodoroState: { isRunning: false, workMinutes: 25, breakMinutes: 5, currentPhase: 'work', secondsLeft: 25 * 60 },
        }));
      },

      toggleMic: () => {
        const state = get();
        const newMicEnabled = !state.micEnabled;
        set({ micEnabled: newMicEnabled });

        // Update participant status
        if (state.activeRoomId) {
          set(s => ({
            rooms: s.rooms.map(r =>
              r.id === s.activeRoomId
                ? { ...r, participants: r.participants.map(p => p.userId === 'current-user' ? { ...p, isMuted: !newMicEnabled } : p) }
                : r
            ),
          }));
        }
      },

      toggleSpeaker: () => {
        set(s => ({ speakerEnabled: !s.speakerEnabled }));
      },

      setSpeakerVolume: (volume) => {
        set({ speakerVolume: Math.min(100, Math.max(0, volume)) });
      },

      setAmbientVolume: (volume) => {
        set({ ambientVolume: Math.min(100, Math.max(0, volume)) });
      },

      raiseHand: () => {
        set({ raisedHand: true });
      },

      lowerHand: () => {
        set({ raisedHand: false });
      },

      updateParticipant: (roomId, userId, updates) => {
        set(s => ({
          rooms: s.rooms.map(r =>
            r.id === roomId
              ? { ...r, participants: r.participants.map(p => p.userId === userId ? { ...p, ...updates } : p) }
              : r
          ),
        }));
      },

      removeParticipant: (roomId, userId) => {
        set(s => ({
          rooms: s.rooms.map(r =>
            r.id === roomId
              ? { ...r, participants: r.participants.filter(p => p.userId !== userId) }
              : r
          ),
        }));
      },

      sendMessage: (roomId, message) => {
        const msg: AudioRoomMessage = {
          id: genId('am-'),
          roomId,
          userId: 'current-user',
          username: 'You',
          message,
          timestamp: new Date().toISOString(),
        };
        set(s => ({ messages: [...s.messages.slice(-200), msg] }));
      },

      toggleFavorite: (roomId) => {
        set(s => ({
          favoriteRoomIds: s.favoriteRoomIds.includes(roomId)
            ? s.favoriteRoomIds.filter(id => id !== roomId)
            : [...s.favoriteRoomIds, roomId],
        }));
      },

      startPomodoro: (workMinutes = 25, breakMinutes = 5) => {
        set({
          pomodoroState: {
            isRunning: true,
            workMinutes,
            breakMinutes,
            currentPhase: 'work',
            secondsLeft: workMinutes * 60,
          },
        });
      },

      pausePomodoro: () => {
        set(s => ({
          pomodoroState: { ...s.pomodoroState, isRunning: false },
        }));
      },

      resetPomodoro: () => {
        set(s => ({
          pomodoroState: {
            isRunning: false,
            workMinutes: s.pomodoroState.workMinutes,
            breakMinutes: s.pomodoroState.breakMinutes,
            currentPhase: 'work',
            secondsLeft: s.pomodoroState.workMinutes * 60,
          },
        }));
      },

      getActiveRoom: () => {
        const state = get();
        if (!state.activeRoomId) return undefined;
        return state.rooms.find(r => r.id === state.activeRoomId);
      },

      getRoomById: (id) => {
        return get().rooms.find(r => r.id === id);
      },

      getOpenRooms: () => {
        return get().rooms.filter(r => r.isActive && r.privacy === 'open');
      },
    }),
    {
      name: 'lifeos-audio-rooms',
      partialize: (state) => ({
        favoriteRoomIds: state.favoriteRoomIds,
        speakerVolume: state.speakerVolume,
        ambientVolume: state.ambientVolume,
        pomodoroState: state.pomodoroState,
      }),
    }
  )
);