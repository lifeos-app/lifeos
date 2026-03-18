/**
 * Multiplayer Types — The Realm
 *
 * Shared interfaces for presence, remote players, and chat.
 */

export type ActivityStatus = 'active' | 'idle' | 'afk';
export type ChatChannel = 'zone' | 'guild' | 'global' | 'whisper';
export type EmoteType = 'wave' | 'cheer' | 'gg' | 'brb' | 'focus';

/** Single source of truth for emote slash commands */
export const EMOTE_COMMANDS: Record<string, EmoteType> = {
  '/wave': 'wave',
  '/cheer': 'cheer',
  '/gg': 'gg',
  '/brb': 'brb',
  '/focus': 'focus',
};

export interface PresencePayload {
  userId: string;
  name: string;
  level: number;
  classIcon: string;
  skinTone: string;
  hairColor: string;
  bodyColor: string;
  worldX: number;
  worldY: number;
  direction: 'up' | 'down' | 'left' | 'right';
  isMoving: boolean;
  status: ActivityStatus;
  lastActive: number;
}

export interface RemotePlayer {
  userId: string;
  name: string;
  level: number;
  classIcon: string;
  skinTone: string;
  hairColor: string;
  bodyColor: string;
  serverX: number;
  serverY: number;
  renderX: number;
  renderY: number;
  direction: 'up' | 'down' | 'left' | 'right';
  isMoving: boolean;
  status: ActivityStatus;
  lastActive: number;
  lastUpdate: number;
  walkFrame: number;
  walkTimer: number;
  chatBubble: string | null;
  chatBubbleTime: number;
  emote: EmoteType | null;
  emoteStartTime: number;
}

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  isEmote?: boolean;
  emoteType?: EmoteType;
}
