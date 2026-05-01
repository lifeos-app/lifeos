/**
 * useAudioRooms — Core hook for the Audio Rooms system
 *
 * Provides room management, WebRTC/Web Audio API integration,
 * microphone toggle, speaking detection, and ambient audio.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  useAudioRoomStore,
  type AudioRoom,
  type AudioParticipant,
  ROOM_TYPES,
  AMBIENT_TRACKS,
  type RoomType,
} from '../../stores/audioRoomStore';

export type { AudioRoom, AudioParticipant, RoomType };
export { ROOM_TYPES, AMBIENT_TRACKS };

export function useAudioRooms() {
  const store = useAudioRoomStore();

  // Local state
  const [isJoining, setIsJoining] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const speakingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Computed state ──
  const activeRoom = useMemo(() => {
    if (!store.activeRoomId) return null;
    return store.rooms.find(r => r.id === store.activeRoomId) ?? null;
  }, [store.rooms, store.activeRoomId]);

  const openRooms = useMemo(() =>
    store.rooms.filter(r => r.isActive && r.privacy === 'open'),
    [store.rooms]
  );

  const isHost = useMemo(() =>
    activeRoom?.host === 'current-user',
    [activeRoom]
  );

  const isInRoom = store.activeRoomId !== null;
  const speakingCount = useMemo(() =>
    activeRoom?.participants.filter(p => p.isSpeaking && !p.isMuted).length ?? 0,
    [activeRoom]
  );

  // ── Room actions ──
  const createRoom = useCallback((name: string, topic: string, type: RoomType, privacy: AudioRoom['privacy'], maxParticipants: number, ambientTrack?: string) => {
    const room = store.createRoom(name, topic, type, privacy, maxParticipants, ambientTrack);
    store.joinRoom(room.id);
    return room;
  }, [store]);

  const joinRoom = useCallback((roomId: string) => {
    setIsJoining(true);
    store.joinRoom(roomId);
    // Simulate connection
    setTimeout(() => setIsJoining(false), 1500);
  }, [store]);

  const leaveRoom = useCallback(() => {
    // Clean up audio
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
    }
    store.leaveRoom();
  }, [store]);

  const toggleMic = useCallback(() => {
    store.toggleMic();
  }, [store]);

  const toggleSpeaker = useCallback(() => {
    store.toggleSpeaker();
  }, [store]);

  const setSpeakerVolume = useCallback((volume: number) => {
    store.setSpeakerVolume(volume);
  }, [store]);

  const setAmbientVolume = useCallback((volume: number) => {
    store.setAmbientVolume(volume);
  }, [store]);

  const raiseHand = useCallback(() => {
    store.raiseHand();
  }, [store]);

  const lowerHand = useCallback(() => {
    store.lowerHand();
  }, [store]);

  const toggleFavorite = useCallback((roomId: string) => {
    store.toggleFavorite(roomId);
  }, [store]);

  // Chat
  const sendMessage = useCallback((message: string) => {
    if (!store.activeRoomId) return;
    store.sendMessage(store.activeRoomId, message);
  }, [store]);

  // Pomodoro
  const startPomodoro = useCallback((workMinutes?: number, breakMinutes?: number) => {
    store.startPomodoro(workMinutes, breakMinutes);
  }, [store]);

  const pausePomodoro = useCallback(() => {
    store.pausePomodoro();
  }, [store]);

  const resetPomodoro = useCallback(() => {
    store.resetPomodoro();
  }, [store]);

  // Room messages (filtered for active room)
  const roomMessages = useMemo(() =>
    store.activeRoomId
      ? store.messages.filter(m => m.roomId === store.activeRoomId).slice(-50)
      : [],
    [store.messages, store.activeRoomId]
  );

  // Favorites set
  const favoriteRoomIds = useMemo(() =>
    new Set(store.favoriteRoomIds),
    [store.favoriteRoomIds]
  );

  return {
    // State
    rooms: store.rooms,
    openRooms,
    activeRoom,
    activeRoomId: store.activeRoomId,
    isHost,
    isInRoom,
    isConnecting: store.isConnecting || isJoining,
    isMuted: !store.micEnabled,
    isSpeakerOn: store.speakerEnabled,
    speakerVolume: store.speakerVolume,
    ambientVolume: store.ambientVolume,
    isHandRaised: store.raisedHand,
    pomodoro: store.pomodoroState,
    roomMessages,
    favoriteRoomIds,
    speakingCount,

    // Room types and tracks
    roomTypes: ROOM_TYPES,
    ambientTracks: AMBIENT_TRACKS,

    // Actions
    createRoom,
    joinRoom,
    leaveRoom,
    toggleMic,
    toggleSpeaker,
    setSpeakerVolume,
    setAmbientVolume,
    raiseHand,
    lowerHand,
    toggleFavorite,
    sendMessage,
    startPomodoro,
    pausePomodoro,
    resetPomodoro,
  };
}