// LifeOS Social — Guild Wars Hook
// Manages guild-vs-guild competitions: XP races, habit showdowns, quest speedruns, arena challenges

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGuildWarStore, WAR_TYPE_CONFIG } from '../../stores/guildWarStore';
import type { GuildWar, WarType, WarStatus, WarReward, WarEvent, GuildWarRecord, GuildWarRanking } from '../../stores/guildWarStore';
import { supabase } from '../../lib/data-access';
import { logger } from '../../utils/logger';
import { awardXP } from '../../lib/gamification/xp-engine';

// Re-export types and constants for consumers
export type { GuildWar, WarType, WarStatus, WarReward, WarEvent, GuildWarRecord, GuildWarRanking };
export { WAR_TYPE_CONFIG } from '../../stores/guildWarStore';

// ═══════════════════════════════════════════════════
// HOOK RETURN TYPE
// ═══════════════════════════════════════════════════

interface UseGuildWarsReturn {
  // Data
  wars: GuildWar[];
  activeWars: GuildWar[];
  pendingWars: GuildWar[];
  completedWars: GuildWar[];
  warEvents: WarEvent[];
  earnedRewards: WarReward[];
  loading: boolean;
  error: string | null;

  // Guild context
  guildId: string;
  userId: string;

  // War lifecycle
  declareWar: (params: {
    defender_guild_id: string;
    type: WarType;
    duration_days?: number;
    message?: string;
    wager_description?: string;
  }) => GuildWar;
  acceptWar: (warId: string) => void;
  declineWar: (warId: string) => void;

  // Score tracking
  trackXPScore: (warId: string, guildId: string, amount: number) => void;
  trackHabitScore: (warId: string, guildId: string, completionPercent: number) => void;
  trackQuestProgress: (warId: string, guildId: string, questsCompleted: number) => void;
  trackArenaWin: (warId: string, guildId: string) => void;

  // War events
  addWarEvent: (event: Omit<WarEvent, 'id' | 'timestamp'>) => void;
  getWarEvents: (warId: string) => WarEvent[];

  // Spectator
  addSpectator: (warId: string) => void;
  removeSpectator: (warId: string) => void;

  // Time
  getTimeRemaining: (warId: string) => { days: number; hours: number; minutes: number; seconds: number; isPast: boolean };
  getWarProgress: (warId: string) => { challengerPercent: number; defenderPercent: number };

  // Records & rankings
  getWarRecord: (guildId: string) => GuildWarRecord;
  getWarRankings: () => GuildWarRanking[];
  getWinLossDisplay: (guildId: string) => string; // e.g. "5W / 2L"

  // Rewards
  getWarRewards: (warId: string) => WarReward[];

  // War type config
  getWarTypeConfig: (type: WarType) => typeof WAR_TYPE_CONFIG[WarType];

  // Refresh
  refresh: () => Promise<void>;
}

// ═══════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════

export function useGuildWars(guildId: string, userId: string): UseGuildWarsReturn {
  const store = useGuildWarStore();

  // Tick for time-based updates
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-resolve expired wars on mount and periodically
  useEffect(() => {
    store.autoResolveWars();
    const interval = setInterval(() => store.autoResolveWars(), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Simulated score accumulation per tick (in real app, this would pull from XP/habit/quest stores)
  useEffect(() => {
    // Only update active wars — simulate small random score increments for demo
    // In production, this would be replaced by real data from the habit store, XP engine, etc.
    const activeWars = store.wars.filter((w) => w.status === 'active');
    for (const war of activeWars) {
      // Random incremental scoring for demo purposes
      if (Math.random() < 0.15) {
        const delta = Math.floor(Math.random() * 5) + 1;
        const isChallenger = Math.random() > 0.5;
        store.updateScores(
          war.id,
          isChallenger ? delta : 0,
          isChallenger ? 0 : delta
        );
      }
    }
  }, [tick]);

  // ── Derived data ──────────────────────────────────────────

  const activeWars = useMemo(
    () => store.getActiveWars(guildId),
    [store.wars, guildId]
  );

  const pendingWars = useMemo(
    () => store.getPendingWars(guildId),
    [store.wars, guildId]
  );

  const completedWars = useMemo(
    () => store.getCompletedWars(guildId),
    [store.wars, guildId]
  );

  // ── Actions ────────────────────────────────────────────────

  const declareWar = useCallback(
    (params: {
      defender_guild_id: string;
      type: WarType;
      duration_days?: number;
      message?: string;
      wager_description?: string;
    }) => {
      return store.declareWar({
        challenger_guild_id: guildId,
        defender_guild_id: params.defender_guild_id,
        type: params.type,
        duration_days: params.duration_days,
        message: params.message,
        wager_description: params.wager_description,
      });
    },
    [guildId]
  );

  const acceptWar = useCallback(
    (warId: string) => {
      store.acceptWar(warId);
    },
    []
  );

  const declineWar = useCallback(
    (warId: string) => {
      store.declineWar(warId);
    },
    []
  );

  // ── Score tracking ────────────────────────────────────────

  const trackXPScore = useCallback(
    (warId: string, scoreGuildId: string, amount: number) => {
      const war = store.wars.find((w) => w.id === warId);
      if (!war || war.status !== 'active') return;

      const isChallenger = scoreGuildId === war.challenger_guild_id;
      store.updateScores(warId, isChallenger ? amount : 0, isChallenger ? 0 : amount);
    },
    [store.wars]
  );

  const trackHabitScore = useCallback(
    (warId: string, scoreGuildId: string, completionPercent: number) => {
      const war = store.wars.find((w) => w.id === warId);
      if (!war || war.status !== 'active') return;
      // Convert completion % to score points (1-100)
      const score = Math.round(completionPercent);
      const isChallenger = scoreGuildId === war.challenger_guild_id;
      store.updateScores(warId, isChallenger ? score : 0, isChallenger ? 0 : score);
    },
    [store.wars]
  );

  const trackQuestProgress = useCallback(
    (warId: string, scoreGuildId: string, questsCompleted: number) => {
      const war = store.wars.find((w) => w.id === warId);
      if (!war || war.status !== 'active') return;
      const score = questsCompleted * 100;
      const isChallenger = scoreGuildId === war.challenger_guild_id;
      store.updateScores(warId, isChallenger ? score : 0, isChallenger ? 0 : score);
    },
    [store.wars]
  );

  const trackArenaWin = useCallback(
    (warId: string, scoreGuildId: string) => {
      const war = store.wars.find((w) => w.id === warId);
      if (!war || war.status !== 'active') return;
      const isChallenger = scoreGuildId === war.challenger_guild_id;
      store.updateScores(warId, isChallenger ? 10 : 0, isChallenger ? 0 : 10);
    },
    [store.wars]
  );

  // ── Events ─────────────────────────────────────────────────

  const addWarEvent = useCallback(
    (event: Omit<WarEvent, 'id' | 'timestamp'>) => {
      store.addWarEvent(event);
    },
    []
  );

  const getWarEvents = useCallback(
    (warId: string) => {
      return store.warEvents.filter((e) => e.war_id === warId);
    },
    [store.warEvents]
  );

  // ── Spectators ────────────────────────────────────────────

  const addSpectator = useCallback(
    (warId: string) => {
      store.addSpectator(warId, userId);
    },
    [userId]
  );

  const removeSpectator = useCallback(
    (warId: string) => {
      store.removeSpectator(warId, userId);
    },
    [userId]
  );

  // ── Time helpers ──────────────────────────────────────────

  const getTimeRemaining = useCallback(
    (warId: string) => {
      const war = store.wars.find((w) => w.id === warId);
      if (!war) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };

      const now = Date.now();
      const end = new Date(war.end_time).getTime();
      const diff = end - now;

      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
      }

      const days = Math.floor(diff / (86400000));
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      return { days, hours, minutes, seconds, isPast: false };
    },
    [store.wars, tick] // tick ensures re-computation
  );

  const getWarProgress = useCallback(
    (warId: string) => {
      const war = store.wars.find((w) => w.id === warId);
      if (!war) return { challengerPercent: 0, defenderPercent: 0 };

      const total = war.challenger_score + war.defender_score;
      if (total === 0) return { challengerPercent: 50, defenderPercent: 50 };

      return {
        challengerPercent: Math.round((war.challenger_score / total) * 100),
        defenderPercent: Math.round((war.defender_score / total) * 100),
      };
    },
    [store.wars]
  );

  // ── Records & rankings ────────────────────────────────────

  const getWarRecord = useCallback(
    (gId: string) => store.getWarRecord(gId),
    [store.warRecords]
  );

  const getWarRankings = useCallback(
    () => store.getWarRankings(),
    [store.warRecords]
  );

  const getWinLossDisplay = useCallback(
    (gId: string) => {
      const record = store.getWarRecord(gId);
      return `${record.wins}W / ${record.losses}L${record.draws > 0 ? ` / ${record.draws}D` : ''}`;
    },
    [store.warRecords]
  );

  // ── Rewards ───────────────────────────────────────────────

  const getWarRewards = useCallback(
    (warId: string) => {
      const war = store.wars.find((w) => w.id === warId);
      return war?.rewards ?? [];
    },
    [store.wars]
  );

  const getWarTypeConfig = useCallback(
    (type: WarType) => WAR_TYPE_CONFIG[type],
    []
  );

  // ── Refresh from server ────────────────────────────────────

  const refresh = useCallback(async () => {
    await store.refreshFromServer();
  }, []);

  return {
    wars: store.wars,
    activeWars,
    pendingWars,
    completedWars,
    warEvents: store.warEvents,
    earnedRewards: store.earnedRewards,
    loading: store.loading,
    error: store.error,
    guildId,
    userId,

    declareWar,
    acceptWar,
    declineWar,

    trackXPScore,
    trackHabitScore,
    trackQuestProgress,
    trackArenaWin,

    addWarEvent,
    getWarEvents,

    addSpectator,
    removeSpectator,

    getTimeRemaining,
    getWarProgress,

    getWarRecord,
    getWarRankings,
    getWinLossDisplay,

    getWarRewards,
    getWarTypeConfig,

    refresh,
  };
}