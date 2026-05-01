/**
 * LifeCityManager — Multiplayer hub manager for Life City zone
 *
 * Manages zone-specific player interactions, activity tracking,
 * party finder, quick-travel, population counter, and AFK areas.
 */

import { RealmMultiplayer } from './RealmMultiplayer';
import type { PresencePayload, RemotePlayer, EmoteType } from './types';
import { LIFE_CITY_DECORATIONS } from '../data/life-city';
import type { DecorativeElement } from '../data/life-city';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export interface PlayerEmote {
  userId: string;
  emote: LifeCityEmote;
  timestamp: number;
}

export type LifeCityEmote = 'wave' | 'dance' | 'cheer' | 'bow' | 'trade_request' | 'high_five';

export interface ActivityBoardEntry {
  userId: string;
  name: string;
  level: number;
  classIcon: string;
  activity: string;
  activityIcon: string;
  since: number;
}

export interface PartyFinderListing {
  id: string;
  leaderId: string;
  leaderName: string;
  leaderLevel: number;
  leaderClassIcon: string;
  title: string;
  description: string;
  category: 'quest' | 'boss' | 'challenge' | 'social';
  maxMembers: number;
  currentMembers: number;
  memberIds: string[];
  createdAt: number;
  expiresAt: number;
}

export interface QuickTravelDestination {
  zoneId: string;
  zoneName: string;
  icon: string;
  tileX: number;
  tileY: number;
  targetX: number;
  targetY: number;
  unlocked: boolean;
  unlockCondition?: string;
}

export interface AFKSpot {
  id: string;
  name: string;
  tileX: number;
  tileY: number;
  type: 'bench' | 'fountain' | 'fireplace' | 'garden';
  capacity: number;
  occupiedBy: string[];
}

// ═══════════════════════════════════════════════════
// EMOTE DEFINITIONS
// ═══════════════════════════════════════════════════

export const LIFE_CITY_EMOTES: Record<string, LifeCityEmote> = {
  '/wave': 'wave',
  '/dance': 'dance',
  '/cheer': 'cheer',
  '/bow': 'bow',
  '/trade': 'trade_request',
  '/highfive': 'high_five',
};

export const LIFE_CITY_EMOTE_LABELS: Record<LifeCityEmote, { label: string; icon: string; broadcast: string }> = {
  wave: { label: 'Wave', icon: '👋', broadcast: 'waves at everyone' },
  dance: { label: 'Dance', icon: '💃', broadcast: 'busts a move!' },
  cheer: { label: 'Cheer', icon: '🎉', broadcast: 'cheers enthusiastically!' },
  bow: { label: 'Bow', icon: '🤝', broadcast: 'bows gracefully' },
  trade_request: { label: 'Trade', icon: '🔄', broadcast: 'wants to trade!' },
  high_five: { label: 'High Five', icon: '🙌', broadcast: 'raises their hand for a high five!' },
};

// ═══════════════════════════════════════════════════
// LIFE CITY MANAGER CLASS
// ═══════════════════════════════════════════════════

export class LifeCityManager {
  private multiplayer: RealmMultiplayer;
  private userId: string;

  private emoteHistory: PlayerEmote[] = [];
  private activityBoard: Map<string, ActivityBoardEntry> = new Map();
  private partyListings: Map<string, PartyFinderListing> = new Map();
  private afkSpots: AFKSpot[] = [];

  private listeners: Set<() => void> = new Set();

  constructor(multiplayer: RealmMultiplayer, userId: string) {
    this.multiplayer = multiplayer;
    this.userId = userId;
    this.initializeAFKSpots();
  }

  // ─── Emote System ───

  sendEmote(emote: LifeCityEmote): void {
    const def = LIFE_CITY_EMOTE_LABELS[emote];
    if (!def) return;

    this.multiplayer.sendChat(`/${emote === 'trade_request' ? 'trade' : emote === 'high_five' ? 'highfive' : emote}`);

    const entry: PlayerEmote = {
      userId: this.userId,
      emote,
      timestamp: Date.now(),
    };
    this.emoteHistory.push(entry);
    if (this.emoteHistory.length > 50) this.emoteHistory.shift();
    this.notifyListeners();
  }

  /** Parse a chat command for Life City emotes */
  parseEmoteCommand(text: string): LifeCityEmote | null {
    return LIFE_CITY_EMOTES[text.toLowerCase()] ?? null;
  }

  getEmoteHistory(): PlayerEmote[] {
    return this.emoteHistory;
  }

  // ─── Activity Board ───

  updatePlayerActivity(userId: string, activity: string, activityIcon: string = '⚡'): void {
    const players = this.multiplayer.getRemotePlayers();
    const player = players.find(p => p.userId === userId);
    if (!player) return;

    this.activityBoard.set(userId, {
      userId,
      name: player.name,
      level: player.level,
      classIcon: player.classIcon,
      activity,
      activityIcon,
      since: Date.now(),
    });
    this.notifyListeners();
  }

  getActivityBoard(): ActivityBoardEntry[] {
    return Array.from(this.activityBoard.values()).sort((a, b) => b.since - a.since);
  }

  // ─── Party Finder ───

  createPartyListing(
    title: string,
    description: string,
    category: PartyFinderListing['category'],
    maxMembers: number = 4,
  ): PartyFinderListing {
    const players = this.multiplayer.getRemotePlayers();
    // We need the current user info — use a simple approach
    const id = `party-${this.userId}-${Date.now()}`;
    const listing: PartyFinderListing = {
      id,
      leaderId: this.userId,
      leaderName: 'You',
      leaderLevel: 1,
      leaderClassIcon: '⚔️',
      title,
      description,
      category,
      maxMembers,
      currentMembers: 1,
      memberIds: [this.userId],
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 min expiry
    };
    this.partyListings.set(id, listing);
    this.notifyListeners();
    return listing;
  }

  joinPartyListing(listingId: string, userId: string): PartyFinderListing | null {
    const listing = this.partyListings.get(listingId);
    if (!listing) return null;
    if (listing.currentMembers >= listing.maxMembers) return null;
    if (listing.memberIds.includes(userId)) return listing;

    listing.memberIds.push(userId);
    listing.currentMembers++;
    this.notifyListeners();
    return listing;
  }

  leavePartyListing(listingId: string, userId: string): boolean {
    const listing = this.partyListings.get(listingId);
    if (!listing) return false;

    listing.memberIds = listing.memberIds.filter(id => id !== userId);
    listing.currentMembers--;
    if (listing.currentMembers === 0) {
      this.partyListings.delete(listingId);
    }
    this.notifyListeners();
    return true;
  }

  getPartyListings(): PartyFinderListing[] {
    const now = Date.now();
    return Array.from(this.partyListings.entries())
      .filter(([, listing]) => listing.expiresAt >= now)
      .map(([id, listing]) => listing)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // ─── Quick Travel ───

  getQuickTravelDestinations(): QuickTravelDestination[] {
    // From Life City zone definition portals
    return [
      { zoneId: 'genesis_garden', zoneName: 'Genesis Garden', icon: '🌱', tileX: 25, tileY: 1, targetX: 9, targetY: 13, unlocked: true },
      { zoneId: 'life_town', zoneName: 'Life Town', icon: '🏠', tileX: 1, tileY: 20, targetX: 15, targetY: 27, unlocked: true },
      { zoneId: 'wisdom_summit', zoneName: 'Wisdom Summit', icon: '📚', tileX: 48, tileY: 10, targetX: 14, targetY: 22, unlocked: true },
      { zoneId: 'ironworks', zoneName: 'Ironworks', icon: '⚒️', tileX: 1, tileY: 35, targetX: 28, targetY: 12, unlocked: true },
      { zoneId: 'healers_sanctuary', zoneName: "Healer's Sanctuary", icon: '🏥', tileX: 1, tileY: 28, targetX: 1, targetY: 12, unlocked: true },
      { zoneId: 'market_quarter', zoneName: 'Market Quarter', icon: '💰', tileX: 48, tileY: 20, targetX: 14, targetY: 22, unlocked: true },
      { zoneId: 'social_square', zoneName: 'Social Square', icon: '🏛️', tileX: 48, tileY: 36, targetX: 14, targetY: 22, unlocked: true },
    ];
  }

  // ─── Zone Population ───

  getPopulationCount(): number {
    return this.multiplayer.getOnlineCount();
  }

  // ─── AFK Sitting Areas ───

  private initializeAFKSpots(): void {
    const benches = LIFE_CITY_DECORATIONS.filter(d => d.type === 'bench');
    this.afkSpots = benches.map(bench => ({
      id: bench.id,
      name: bench.name,
      tileX: bench.tileX,
      tileY: bench.tileY,
      type: 'bench' as const,
      capacity: 3,
      occupiedBy: [],
    }));

    // Add fountain sitting spot
    this.afkSpots.push({
      id: 'lc_fountain_sit',
      name: 'Grand Fountain',
      tileX: 25,
      tileY: 20,
      type: 'fountain',
      capacity: 6,
      occupiedBy: [],
    });
  }

  sitAtSpot(spotId: string, userId: string): AFKSpot | null {
    const spot = this.afkSpots.find(s => s.id === spotId);
    if (!spot) return null;
    if (spot.occupiedBy.length >= spot.capacity) return null;
    if (spot.occupiedBy.includes(userId)) return spot;

    spot.occupiedBy.push(userId);
    this.notifyListeners();
    return spot;
  }

  leaveSpot(spotId: string, userId: string): void {
    const spot = this.afkSpots.find(s => s.id === spotId);
    if (!spot) return;
    spot.occupiedBy = spot.occupiedBy.filter(id => id !== userId);
    this.notifyListeners();
  }

  getAFKSpots(): AFKSpot[] {
    return this.afkSpots;
  }

  // ─── Decorative Elements ───

  getActiveDecorations(season?: string): DecorativeElement[] {
    return LIFE_CITY_DECORATIONS.filter(d => {
      if (d.season && d.season !== season) return false;
      return true;
    });
  }

  // ─── Listener Pattern ───

  onUpdate(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notifyListeners(): void {
    const cbs = Array.from(this.listeners);
    for (const cb of cbs) cb();
  }

  // ─── Cleanup ───

  destroy(): void {
    this.emoteHistory = [];
    this.activityBoard.clear();
    this.partyListings.clear();
    this.afkSpots = [];
    this.listeners.clear();
  }
}