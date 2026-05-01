/**
 * Guild War Store — Zustand + Persist
 *
 * Manages guild-vs-guild war state: declarations, active wars,
 * scoreboards, history, and rewards. Offline-first with persistence.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { genId } from '../utils/date';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export type WarType = 'xp_race' | 'habit_showdown' | 'quest_speedrun' | 'arena_challenge';
export type WarStatus = 'pending' | 'accepted' | 'active' | 'completed' | 'declined';

export interface WarReward {
  type: 'cosmetic' | 'xp_bonus' | 'title' | 'realm_decoration';
  name: string;
  description: string;
  icon: string;
}

export interface WarEvent {
  id: string;
  war_id: string;
  guild_id: string;
  user_id: string;
  event_type: 'score' | 'milestone' | 'cheer' | 'declaration' | 'acceptance';
  description: string;
  score_delta: number;
  timestamp: string;
}

export interface GuildWar {
  id: string;
  challenger_guild_id: string;
  defender_guild_id: string;
  type: WarType;
  status: WarStatus;
  start_time: string;
  end_time: string;
  duration_days: number;
  challenger_score: number;
  defender_score: number;
  winner_id: string | null;
  rewards: WarReward[];
  spectators: string[];
  message: string;
  wager_description: string;
  created_at: string;
  updated_at: string;
}

export interface GuildWarRecord {
  guild_id: string;
  wins: number;
  losses: number;
  draws: number;
  total_xp_earned: number;
  titles_won: string[];
}

export interface GuildWarRanking {
  guild_id: string;
  guild_name: string;
  guild_icon: string;
  record: GuildWarRecord;
  points: number; // weighted score: 3*W + 1*D + 0*L
  streak: number; // current win streak (negative = loss streak)
}

// ═══════════════════════════════════════════════════
// WAR TYPE CONFIG
// ═══════════════════════════════════════════════════

export const WAR_TYPE_CONFIG: Record<WarType, {
  icon: string;
  label: string;
  description: string;
  color: string;
  emoji: string;
  defaultDays: number;
}> = {
  xp_race: {
    icon: '⚡',
    label: 'XP Race',
    description: 'Which guild earns the most XP in the time period?',
    color: '#FACC15',
    emoji: '⚡',
    defaultDays: 7,
  },
  habit_showdown: {
    icon: '🔥',
    label: 'Habit Showdown',
    description: 'Highest overall habit completion percentage wins!',
    color: '#F97316',
    emoji: '🔥',
    defaultDays: 7,
  },
  quest_speedrun: {
    icon: '🏁',
    label: 'Quest Speedrun',
    description: 'First guild to complete the quest chain wins!',
    color: '#A855F7',
    emoji: '🏁',
    defaultDays: 14,
  },
  arena_challenge: {
    icon: '⚔️',
    label: 'Arena Challenge',
    description: 'Most mini-game wins in the Arena!',
    color: '#EF4444',
    emoji: '⚔️',
    defaultDays: 7,
  },
};

// ═══════════════════════════════════════════════════
// DEFAULT REWARD POOLS
// ═══════════════════════════════════════════════════

const COSMETIC_REWARDS: WarReward[] = [
  { type: 'cosmetic', name: 'War Banner', description: 'A fiery banner to display on your guild page', icon: '🚩' },
  { type: 'cosmetic', name: 'Champion Aura', description: 'A golden aura effect for your profile', icon: '✨' },
  { type: 'cosmetic', name: 'Phoenix Crown', description: 'A legendary crown that rises from defeat', icon: '👑' },
  { type: 'cosmetic', name: 'Dragon Mount Skin', description: 'A fearsome dragon mount for your companion', icon: '🐉' },
  { type: 'cosmetic', name: 'Victory Cape', description: 'A flowing cape of triumph', icon: '🦸' },
];

const XP_REWARDS: WarReward[] = [
  { type: 'xp_bonus', name: 'Double XP Weekend', description: '2x XP for all guild members for 48 hours', icon: '⚡' },
  { type: 'xp_bonus', name: 'XP Boost (25%)', description: '+25% XP for 7 days for all members', icon: '📈' },
  { type: 'xp_bonus', name: 'XP Rain (500)', description: '500 bonus XP to each member instantly', icon: '🌧️' },
];

const TITLE_REWARDS: WarReward[] = [
  { type: 'title', name: 'Warlord', description: 'Title: Warlord — earned through guild battle', icon: '⚔️' },
  { type: 'title', name: 'Champion', description: 'Title: Champion — proven in competition', icon: '🏆' },
  { type: 'title', name: 'Unbreakable', description: 'Title: Unbreakable — never surrendered', icon: '🛡️' },
  { type: 'title', name: 'Blaze Bringer', description: 'Title: Blaze Bringer — set the war on fire', icon: '🔥' },
];

const REALM_REWARDS: WarReward[] = [
  { type: 'realm_decoration', name: 'War Torch', description: 'A burning torch for your Life City district', icon: '🔥' },
  { type: 'realm_decoration', name: 'Victory Monument', description: 'A stone monument celebrating your win', icon: '🗿' },
  { type: 'realm_decoration', name: 'Battle Flag', description: 'A proud flag flying over your realm', icon: '🎏' },
];

export function generateWarRewards(warType: WarType): WarReward[] {
  const rewards: WarReward[] = [];
  // Always include 1 cosmetic
  rewards.push(COSMETIC_REWARDS[Math.floor(Math.random() * COSMETIC_REWARDS.length)]);
  // Always include 1 XP bonus
  rewards.push(XP_REWARDS[Math.floor(Math.random() * XP_REWARDS.length)]);
  // Include a title for longer wars
  rewards.push(TITLE_REWARDS[Math.floor(Math.random() * TITLE_REWARDS.length)]);
  // Include a realm decoration for arena challenges
  if (warType === 'arena_challenge') {
    rewards.push(REALM_REWARDS[Math.floor(Math.random() * REALM_REWARDS.length)]);
  }
  return rewards;
}

// ═══════════════════════════════════════════════════
// STORE STATE & ACTIONS
// ═══════════════════════════════════════════════════

interface GuildWarState {
  wars: GuildWar[];
  warEvents: WarEvent[];
  warRecords: Record<string, GuildWarRecord>; // guild_id -> record
  warRankings: GuildWarRanking[];
  earnedRewards: WarReward[]; // rewards the current user's guild has won
  loading: boolean;
  error: string | null;

  // Actions
  declareWar: (params: {
    challenger_guild_id: string;
    defender_guild_id: string;
    type: WarType;
    duration_days?: number;
    message?: string;
    wager_description?: string;
  }) => GuildWar;

  acceptWar: (warId: string) => void;
  declineWar: (warId: string) => void;

  updateScores: (warId: string, challengerDelta: number, defenderDelta: number) => void;
  addWarEvent: (event: Omit<WarEvent, 'id' | 'timestamp'>) => void;

  completeWar: (warId: string) => void;
  autoResolveWars: () => void; // check for wars past their end_time

  addSpectator: (warId: string, userId: string) => void;
  removeSpectator: (warId: string, userId: string) => void;

  getActiveWars: (guildId?: string) => GuildWar[];
  getPendingWars: (guildId?: string) => GuildWar[];
  getCompletedWars: (guildId?: string) => GuildWar[];
  getWarRecord: (guildId: string) => GuildWarRecord;
  getWarRankings: () => GuildWarRanking[];

  refreshFromServer: () => Promise<void>;

  setError: (error: string | null) => void;
}

export const useGuildWarStore = create<GuildWarState>()(
  persist(
    (set, get) => ({
      wars: [],
      warEvents: [],
      warRecords: {},
      warRankings: [],
      earnedRewards: [],
      loading: false,
      error: null,

      declareWar: (params) => {
        const id = genId();
        const now = new Date().toISOString();
        const duration = params.duration_days ?? WAR_TYPE_CONFIG[params.type].defaultDays;
        const startDate = new Date();
        // Wars start immediately when accepted; for now store pending
        const endDate = new Date(startDate.getTime() + duration * 86400000);

        const war: GuildWar = {
          id,
          challenger_guild_id: params.challenger_guild_id,
          defender_guild_id: params.defender_guild_id,
          type: params.type,
          status: 'pending',
          start_time: now, // will be updated when accepted
          end_time: endDate.toISOString(),
          duration_days: duration,
          challenger_score: 0,
          defender_score: 0,
          winner_id: null,
          rewards: generateWarRewards(params.type),
          spectators: [],
          message: params.message ?? '',
          wager_description: params.wager_description ?? '',
          created_at: now,
          updated_at: now,
        };

        set((s) => ({ wars: [...s.wars, war] }));

        // Add declaration event
        get().addWarEvent({
          war_id: id,
          guild_id: params.challenger_guild_id,
          user_id: '',
          event_type: 'declaration',
          description: `War declared! ${WAR_TYPE_CONFIG[params.type].icon} ${WAR_TYPE_CONFIG[params.type].label}`,
          score_delta: 0,
        });

        return war;
      },

      acceptWar: (warId) => {
        const now = new Date().toISOString();
        set((s) => ({
          wars: s.wars.map((w) => {
            if (w.id !== warId) return w;
            const startDate = new Date();
            const endDate = new Date(startDate.getTime() + w.duration_days * 86400000);
            return {
              ...w,
              status: 'active' as WarStatus,
              start_time: now,
              end_time: endDate.toISOString(),
              updated_at: now,
            };
          }),
        }));

        const war = get().wars.find((w) => w.id === warId);
        if (war) {
          get().addWarEvent({
            war_id: warId,
            guild_id: war.defender_guild_id,
            user_id: '',
            event_type: 'acceptance',
            description: `War accepted! The battle begins! 🔥`,
            score_delta: 0,
          });
        }
      },

      declineWar: (warId) => {
        const now = new Date().toISOString();
        set((s) => ({
          wars: s.wars.map((w) =>
            w.id === warId ? { ...w, status: 'declined' as WarStatus, updated_at: now } : w
          ),
        }));
      },

      updateScores: (warId, challengerDelta, defenderDelta) => {
        set((s) => ({
          wars: s.wars.map((w) =>
            w.id === warId
              ? {
                  ...w,
                  challenger_score: w.challenger_score + challengerDelta,
                  defender_score: w.defender_score + defenderDelta,
                  updated_at: new Date().toISOString(),
                }
              : w
          ),
        }));
      },

      addWarEvent: (event) => {
        const warEvent: WarEvent = {
          ...event,
          id: genId(),
          timestamp: new Date().toISOString(),
        };
        set((s) => ({ warEvents: [...s.warEvents, warEvent] }));
      },

      completeWar: (warId) => {
        const war = get().wars.find((w) => w.id === warId);
        if (!war) return;

        const winnerId =
          war.challenger_score > war.defender_score
            ? war.challenger_guild_id
            : war.defender_score > war.challenger_score
            ? war.defender_guild_id
            : null; // draw

        const now = new Date().toISOString();

        set((s) => ({
          wars: s.wars.map((w) =>
            w.id === warId
              ? { ...w, status: 'completed' as WarStatus, winner_id: winnerId, updated_at: now }
              : w
          ),
          earnedRewards:
            winnerId && s.earnedRewards.length < 50
              ? [...s.earnedRewards, ...war.rewards]
              : s.earnedRewards,
        }));

        // Update war records
        const challengerRecord = get().getWarRecord(war.challenger_guild_id);
        const defenderRecord = get().getWarRecord(war.defender_guild_id);

        const isChallengerWin = winnerId === war.challenger_guild_id;
        const isDefenderWin = winnerId === war.defender_guild_id;
        const isDraw = winnerId === null;

        set((s) => ({
          warRecords: {
            ...s.warRecords,
            [war.challenger_guild_id]: {
              ...challengerRecord,
              wins: challengerRecord.wins + (isChallengerWin ? 1 : 0),
              losses: challengerRecord.losses + (isDefenderWin ? 1 : 0),
              draws: challengerRecord.draws + (isDraw ? 1 : 0),
            },
            [war.defender_guild_id]: {
              ...defenderRecord,
              wins: defenderRecord.wins + (isDefenderWin ? 1 : 0),
              losses: defenderRecord.losses + (isChallengerWin ? 1 : 0),
              draws: defenderRecord.draws + (isDraw ? 1 : 0),
            },
          },
        }));
      },

      autoResolveWars: () => {
        const now = Date.now();
        const wars = get().wars;
        for (const war of wars) {
          if (war.status === 'active') {
            const endTime = new Date(war.end_time).getTime();
            if (now >= endTime) {
              get().completeWar(war.id);
            }
          }
        }
      },

      addSpectator: (warId, userId) => {
        set((s) => ({
          wars: s.wars.map((w) =>
            w.id === warId && !w.spectators.includes(userId)
              ? { ...w, spectators: [...w.spectators, userId] }
              : w
          ),
        }));
      },

      removeSpectator: (warId, userId) => {
        set((s) => ({
          wars: s.wars.map((w) =>
            w.id === warId
              ? { ...w, spectators: w.spectators.filter((id) => id !== userId) }
              : w
          ),
        }));
      },

      getActiveWars: (guildId) => {
        const wars = get().wars.filter((w) => w.status === 'active');
        return guildId
          ? wars.filter(
              (w) =>
                w.challenger_guild_id === guildId || w.defender_guild_id === guildId
            )
          : wars;
      },

      getPendingWars: (guildId) => {
        const wars = get().wars.filter((w) => w.status === 'pending');
        return guildId
          ? wars.filter(
              (w) =>
                w.challenger_guild_id === guildId || w.defender_guild_id === guildId
            )
          : wars;
      },

      getCompletedWars: (guildId) => {
        const wars = get().wars.filter((w) => w.status === 'completed');
        return guildId
          ? wars.filter(
              (w) =>
                w.challenger_guild_id === guildId || w.defender_guild_id === guildId
            )
          : wars;
      },

      getWarRecord: (guildId) => {
        return (
          get().warRecords[guildId] ?? {
            guild_id: guildId,
            wins: 0,
            losses: 0,
            draws: 0,
            total_xp_earned: 0,
            titles_won: [],
          }
        );
      },

      getWarRankings: () => {
        const records = get().warRecords;
        return Object.entries(records)
          .map(([guildId, record]) => ({
            guild_id: guildId,
            guild_name: '', // populated from server side
            guild_icon: '🏰',
            record,
            points: record.wins * 3 + record.draws,
            streak: 0,
          }))
          .sort((a, b) => b.points - a.points);
      },

      refreshFromServer: async () => {
        set({ loading: true, error: null });
        try {
          const { supabase } = await import('../lib/data-access');
          const { data, error } = await supabase
            .from('guild_wars')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;
          if (data) {
            set({ wars: data as GuildWar[] });
          }
        } catch (err: any) {
          logger.error('[guildWarStore] refreshFromServer error:', err);
          // Keep local data — offline-first
        } finally {
          set({ loading: false });
        }
      },

      setError: (error) => set({ error }),
    }),
    {
      name: 'lifeos-guild-wars',
      partialize: (state) => ({
        wars: state.wars,
        warEvents: state.warEvents,
        warRecords: state.warRecords,
        earnedRewards: state.earnedRewards,
      }),
    }
  )
);