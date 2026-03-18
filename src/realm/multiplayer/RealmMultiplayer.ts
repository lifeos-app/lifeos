/**
 * RealmMultiplayer — Real-time multiplayer networking
 *
 * Uses Supabase Realtime Presence for player positions
 * and broadcast for zone chat. No database writes.
 */

import { supabase } from '../../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  EMOTE_COMMANDS,
  type PresencePayload,
  type RemotePlayer,
  type ChatMessage,
  type EmoteType,
  type ActivityStatus,
} from './types';

const POSITION_THROTTLE_MS = 200;
const CHAT_RATE_LIMIT_MS = 1000;
const CHAT_MAX_LENGTH = 200;
const CHAT_HISTORY_MAX = 50;
const AFK_CHECK_INTERVAL_MS = 5000;
const IDLE_THRESHOLD_MS = 30_000;
const AFK_THRESHOLD_MS = 5 * 60_000;
const AUTO_LEAVE_THRESHOLD_MS = 30 * 60_000;
const CHAT_BUBBLE_DURATION_MS = 5000;

export class RealmMultiplayer {
  private userId: string;
  private channel: RealtimeChannel | null = null;
  private zoneId: string | null = null;
  private currentPayload: PresencePayload | null = null;

  private remotePlayers = new Map<string, RemotePlayer>();
  private chatMessages: ChatMessage[] = [];
  private chatListeners: Set<(msg: ChatMessage) => void> = new Set();

  private lastTrackTime = 0;
  private lastChatTime = 0;
  private lastInputTime = Date.now();
  private afkCheckInterval: ReturnType<typeof setInterval> | null = null;
  private paused = false;

  // Track last broadcast values to avoid redundant sends
  private lastBroadcastX = 0;
  private lastBroadcastY = 0;
  private lastBroadcastDir = '';
  private lastBroadcastMoving = false;
  private pendingStopUpdate = false;

  constructor(userId: string) {
    this.userId = userId;
  }

  async joinZone(zoneId: string, payload: PresencePayload): Promise<void> {
    this.leaveZone();
    this.zoneId = zoneId;
    this.currentPayload = payload;

    const channel = supabase.channel(`realm:zone:${zoneId}`, {
      config: { presence: { key: this.userId } },
    });

    // Presence sync — rebuild remote players map
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresencePayload>();
      const seen = new Set<string>();

      for (const [key, presences] of Object.entries(state)) {
        if (key === this.userId) continue;
        const p = presences[0] as unknown as PresencePayload;
        if (!p?.userId) continue;
        seen.add(p.userId);

        const existing = this.remotePlayers.get(p.userId);
        if (existing) {
          existing.serverX = p.worldX;
          existing.serverY = p.worldY;
          existing.direction = p.direction;
          existing.isMoving = p.isMoving;
          existing.status = p.status;
          existing.lastActive = p.lastActive;
          existing.lastUpdate = Date.now();
          existing.name = p.name;
          existing.level = p.level;
          existing.classIcon = p.classIcon;
          existing.skinTone = p.skinTone;
          existing.hairColor = p.hairColor;
          existing.bodyColor = p.bodyColor;
        } else {
          this.remotePlayers.set(p.userId, {
            userId: p.userId,
            name: p.name,
            level: p.level,
            classIcon: p.classIcon,
            skinTone: p.skinTone,
            hairColor: p.hairColor,
            bodyColor: p.bodyColor,
            serverX: p.worldX,
            serverY: p.worldY,
            renderX: p.worldX,
            renderY: p.worldY,
            direction: p.direction,
            isMoving: p.isMoving,
            status: p.status,
            lastActive: p.lastActive,
            lastUpdate: Date.now(),
            walkFrame: 0,
            walkTimer: 0,
            chatBubble: null,
            chatBubbleTime: 0,
            emote: null,
            emoteStartTime: 0,
          });
        }
      }

      // Remove players no longer in presence
      for (const id of this.remotePlayers.keys()) {
        if (!seen.has(id)) this.remotePlayers.delete(id);
      }
    });

    // Chat broadcast
    channel.on('broadcast', { event: 'chat' }, ({ payload: msg }) => {
      if (!msg || msg.senderId === this.userId) return;
      const chatMsg = msg as ChatMessage;
      this.chatMessages.push(chatMsg);
      if (this.chatMessages.length > CHAT_HISTORY_MAX) {
        this.chatMessages.shift();
      }

      // Set chat bubble on remote player
      const player = this.remotePlayers.get(chatMsg.senderId);
      if (player) {
        player.chatBubble = chatMsg.content;
        player.chatBubbleTime = Date.now();
        if (chatMsg.isEmote && chatMsg.emoteType) {
          player.emote = chatMsg.emoteType;
          player.emoteStartTime = Date.now();
        }
      }

      for (const cb of this.chatListeners) cb(chatMsg);
    });

    this.channel = channel;
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track(payload);
      }
    });

    // AFK detection interval
    this.afkCheckInterval = setInterval(() => this.checkActivity(), AFK_CHECK_INTERVAL_MS);
  }

  leaveZone(): void {
    if (this.afkCheckInterval) {
      clearInterval(this.afkCheckInterval);
      this.afkCheckInterval = null;
    }
    if (this.channel) {
      this.channel.unsubscribe();
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.zoneId = null;
    this.remotePlayers.clear();
    this.chatMessages = [];
    this.currentPayload = null;
  }

  broadcastPosition(
    x: number,
    y: number,
    dir: 'up' | 'down' | 'left' | 'right',
    isMoving: boolean,
  ): void {
    if (!this.channel || !this.currentPayload || this.paused) return;

    // When player stops, send one final update
    if (!isMoving && this.lastBroadcastMoving) {
      this.pendingStopUpdate = true;
    }

    const now = Date.now();
    const elapsed = now - this.lastTrackTime;

    // Throttle: only send every 200ms, unless it's the stop update
    if (elapsed < POSITION_THROTTLE_MS && !this.pendingStopUpdate) return;

    // Skip if nothing changed
    if (
      !this.pendingStopUpdate &&
      x === this.lastBroadcastX &&
      y === this.lastBroadcastY &&
      dir === this.lastBroadcastDir &&
      isMoving === this.lastBroadcastMoving
    ) {
      return;
    }

    this.currentPayload.worldX = x;
    this.currentPayload.worldY = y;
    this.currentPayload.direction = dir;
    this.currentPayload.isMoving = isMoving;

    this.channel.track(this.currentPayload);
    this.lastTrackTime = now;
    this.lastBroadcastX = x;
    this.lastBroadcastY = y;
    this.lastBroadcastDir = dir;
    this.lastBroadcastMoving = isMoving;
    this.pendingStopUpdate = false;
  }

  getRemotePlayers(): RemotePlayer[] {
    return Array.from(this.remotePlayers.values());
  }

  getOnlineCount(): number {
    return this.remotePlayers.size + 1; // include self
  }

  sendChat(content: string): boolean {
    if (!this.channel || !this.currentPayload) return false;

    const now = Date.now();
    if (now - this.lastChatTime < CHAT_RATE_LIMIT_MS) return false;

    // Sanitize
    let text = content.replace(/<[^>]*>/g, '').trim();
    if (!text) return false;
    if (text.length > CHAT_MAX_LENGTH) text = text.slice(0, CHAT_MAX_LENGTH);

    // Check for emote commands
    const emoteType = EMOTE_COMMANDS[text.toLowerCase()];

    const msg: ChatMessage = {
      id: `${this.userId}-${now}`,
      channel: 'zone',
      senderId: this.userId,
      senderName: this.currentPayload.name,
      content: emoteType ? `${this.currentPayload.name} ${emoteType}s` : text,
      timestamp: now,
      isEmote: !!emoteType,
      emoteType: emoteType || undefined,
    };

    this.channel.send({
      type: 'broadcast',
      event: 'chat',
      payload: msg,
    });

    // Add to local history
    this.chatMessages.push(msg);
    if (this.chatMessages.length > CHAT_HISTORY_MAX) this.chatMessages.shift();
    for (const cb of this.chatListeners) cb(msg);

    this.lastChatTime = now;
    return true;
  }

  getRecentChat(): ChatMessage[] {
    return this.chatMessages;
  }

  onChatMessage(cb: (msg: ChatMessage) => void): () => void {
    this.chatListeners.add(cb);
    return () => this.chatListeners.delete(cb);
  }

  sendEmote(emote: EmoteType): void {
    this.sendChat(`/${emote}`);
  }

  reportActivity(): void {
    this.lastInputTime = Date.now();
  }

  updateInterpolation(deltaMs: number): void {
    const now = Date.now();

    for (const player of this.remotePlayers.values()) {
      // Lerp position
      const dx = player.serverX - player.renderX;
      const dy = player.serverY - player.renderY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 200) {
        // Teleport snap
        player.renderX = player.serverX;
        player.renderY = player.serverY;
      } else {
        const factor = 1 - Math.pow(0.001, deltaMs / 1000);
        player.renderX += dx * factor;
        player.renderY += dy * factor;
      }

      // Walk animation
      if (player.isMoving) {
        player.walkTimer++;
        if (player.walkTimer > 8) {
          player.walkFrame = (player.walkFrame + 1) % 4;
          player.walkTimer = 0;
        }
      } else {
        player.walkFrame = 0;
        player.walkTimer = 0;
      }

      // Expire chat bubbles
      if (player.chatBubble && now - player.chatBubbleTime > CHAT_BUBBLE_DURATION_MS) {
        player.chatBubble = null;
      }

      // Expire emotes (3s)
      if (player.emote && now - player.emoteStartTime > 3000) {
        player.emote = null;
      }
    }
  }

  private checkActivity(): void {
    if (!this.channel || !this.currentPayload) return;
    const elapsed = Date.now() - this.lastInputTime;

    let newStatus: ActivityStatus;
    if (elapsed < IDLE_THRESHOLD_MS) {
      newStatus = 'active';
    } else if (elapsed < AFK_THRESHOLD_MS) {
      newStatus = 'idle';
    } else {
      newStatus = 'afk';
    }

    // Auto-leave after 30 minutes of inactivity
    if (elapsed > AUTO_LEAVE_THRESHOLD_MS) {
      this.leaveZone();
      return;
    }

    // Re-track if status changed
    if (newStatus !== this.currentPayload.status) {
      this.currentPayload.status = newStatus;
      this.currentPayload.lastActive = Date.now();
      this.channel.track(this.currentPayload);
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    // Re-track current position on resume
    if (this.channel && this.currentPayload) {
      this.channel.track(this.currentPayload);
    }
  }

  destroy(): void {
    this.leaveZone();
    this.chatListeners.clear();
  }
}
