// LifeOS Gamification Hook — provides all gamification state + actions
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import {
  awardXP as doAwardXP,
  recalcUserStats,
  getLevelInfo,
  getLevelProgress,
  checkAchievements as doCheckAchievements,
  generateDailyQuests,
  generateWeeklyQuests,
  generateEpicQuests,
  updateQuestProgress,
  getActiveQuests,
} from '../lib/gamification';
import { logger } from '../utils/logger';
import type {
  ActionType,
  XPActionMetadata,
  LevelInfo,
  UserStats,
  Achievement,
  ActiveQuest,
} from '../lib/gamification';

export interface GamificationState {
  // Core
  level: number;
  xp: number;
  xpProgress: number; // 0–1 within current level
  xpToNext: number;
  title: string;
  stats: UserStats;
  levelInfo: LevelInfo;

  // Achievements
  achievements: { achievementId: string; unlockedAt: string | null; progress: number }[];
  unlockedCount: number;

  // Quests
  dailyQuests: ActiveQuest[];
  weeklyQuests: ActiveQuest[];
  epicQuests: ActiveQuest[];

  // Recent XP events
  recentXP: { action: string; amount: number; description: string; createdAt: string }[];

  // Loading
  loading: boolean;
}

export interface GamificationActions {
  /** Award XP for an action. Returns level-up info. */
  awardXP: (action: ActionType, metadata?: XPActionMetadata) => Promise<{
    xpAwarded: number;
    leveledUp: boolean;
    newLevel: number;
    newTitle: string;
    unlockedAchievements: Achievement[];
    completedQuests: ActiveQuest[];
  }>;
  /** Force re-check all achievements */
  checkAchievements: () => Promise<Achievement[]>;
  /** Refresh all gamification data */
  refresh: () => Promise<void>;
}

const DEFAULT_STATS: UserStats = {
  productivity: 0, consistency: 0, health: 0, finance: 0, knowledge: 0, social: 0,
};

export function useGamification(): GamificationState & GamificationActions {
  const user = useUserStore(s => s.user);
  const [state, setState] = useState<GamificationState>({
    level: 1,
    xp: 0,
    xpProgress: 0,
    xpToNext: 100,
    title: 'Awakened',
    stats: DEFAULT_STATS,
    levelInfo: getLevelInfo(0),
    achievements: [],
    unlockedCount: 0,
    dailyQuests: [],
    weeklyQuests: [],
    epicQuests: [],
    recentXP: [],
    loading: true,
  });

  const userIdRef = useRef<string | null>(null);

  // ── FETCH ALL DATA ──
  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    userIdRef.current = user.id;

    try {
      // Check if gamification tables exist by trying a simple query
      const testQuery = await supabase.from('user_xp').select('user_id').limit(0);
      if (testQuery.error) {
        // Tables don't exist yet — silently use defaults, no spam
        logger.info('[Gamification] Tables not yet created — using defaults');
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      // Parallel fetches — each wrapped to handle individual failures
      const [userXPRes, achievementsRes, recentXPRes] = await Promise.all([
        supabase.from('user_xp').select('*').eq('user_id', user.id).maybeSingle().then(r => r, () => ({ data: null, error: null })),
        supabase.from('achievements').select('*').eq('user_id', user.id).then(r => r, () => ({ data: [], error: null })),
        supabase.from('xp_events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20).then(r => r, () => ({ data: [], error: null })),
      ]);

      const xpData = userXPRes.data;
      const totalXP = xpData?.total_xp || 0;
      const info = getLevelInfo(totalXP);

      // Generate quests if needed (non-blocking)
      const [dailyQ, weeklyQ, epicQ] = await Promise.all([
        generateDailyQuests(supabase, user.id).catch(() => []),
        generateWeeklyQuests(supabase, user.id).catch(() => []),
        generateEpicQuests(supabase, user.id).catch(() => []),
      ]);

      // Also get current active state (may be updated)
      const quests = await getActiveQuests(supabase, user.id).catch(() => ({
        daily: Array.isArray(dailyQ) ? dailyQ : [],
        weekly: Array.isArray(weeklyQ) ? weeklyQ : [],
        epic: Array.isArray(epicQ) ? epicQ : [],
      }));

      const achData = Array.isArray(achievementsRes.data) ? achievementsRes.data : [];
      const recentData = Array.isArray(recentXPRes.data) ? recentXPRes.data : [];
      const unlockedCount = achData.filter((a: any) => a.unlocked_at).length;

      setState({
        level: info.level,
        xp: totalXP,
        xpProgress: getLevelProgress(totalXP),
        xpToNext: info.xpToNext,
        title: info.title,
        stats: (xpData?.stats as UserStats) || DEFAULT_STATS,
        levelInfo: info,
        achievements: achData.map((a: any) => ({
          achievementId: a.achievement_id,
          unlockedAt: a.unlocked_at,
          progress: a.progress,
        })),
        unlockedCount,
        dailyQuests: Array.isArray(quests.daily) ? quests.daily : [],
        weeklyQuests: Array.isArray(quests.weekly) ? quests.weekly : [],
        epicQuests: Array.isArray(quests.epic) ? quests.epic : [],
        recentXP: recentData.map((e: any) => ({
          action: e.action_type,
          amount: e.xp_amount,
          description: e.description,
          createdAt: e.created_at,
        })),
        loading: false,
      });
    } catch (err) {
      logger.error('[Gamification] Error fetching data:', err);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [user?.id]);

  // ── AWARD XP ──
  const awardXP = useCallback(async (
    action: ActionType,
    metadata: XPActionMetadata = {}
  ) => {
    if (!user?.id) {
      return {
        xpAwarded: 0, leveledUp: false, newLevel: 1,
        newTitle: 'Awakened', unlockedAchievements: [], completedQuests: [],
      };
    }

    // Award XP
    const result = await doAwardXP(supabase, user.id, action, metadata);

    // Update quest progress
    const completedQuests = await updateQuestProgress(supabase, user.id, action);

    // Check achievements on every XP award
    let unlockedAchievements: Achievement[] = [];
    unlockedAchievements = await doCheckAchievements(supabase, user.id);

    // Award XP for completed quests
    for (const quest of completedQuests) {
      await doAwardXP(supabase, user.id, 'task_complete', {
        description: `Quest completed: ${quest.quest_data.title}`,
      });
    }

    // Award XP for achievements
    for (const ach of unlockedAchievements) {
      await doAwardXP(supabase, user.id, 'task_complete', {
        description: `Achievement unlocked: ${ach.title}`,
      });
    }

    // Refresh state
    await fetchAll();

    // Recalc stats (async, non-blocking)
    recalcUserStats(supabase, user.id).catch(err => logger.error('[Gamification] recalcUserStats failed:', err));

    // Sync level to public profile for social matching accuracy
    if (result.leveledUp && user?.id) {
      import('../lib/social/profiles').then(m =>
        m.updateLadderRank(user.id, result.newLevel)
      ).catch(() => { /* non-critical */ });
    }

    const newInfo = getLevelInfo(result.newTotal);

    return {
      xpAwarded: result.xpAwarded,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
      newTitle: newInfo.title,
      unlockedAchievements,
      completedQuests,
    };
  }, [user?.id, fetchAll]);

  // ── CHECK ACHIEVEMENTS ──
  const checkAchievements = useCallback(async () => {
    if (!user?.id) return [];
    const newlyUnlocked = await doCheckAchievements(supabase, user.id);
    if (newlyUnlocked.length > 0) await fetchAll();
    return newlyUnlocked;
  }, [user?.id, fetchAll]);

  // ── INITIAL LOAD ──
  useEffect(() => {
    if (user?.id) fetchAll();
  }, [user?.id, fetchAll]);

  // ── REALTIME SUBSCRIPTION ──
  // Only subscribe if tables exist (checked during fetchAll)
  useEffect(() => {
    if (!user?.id) return;

    // Test if tables exist first before subscribing
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.from('user_xp').select('user_id').limit(0).then(({ error }) => {
      if (error) return; // Tables don't exist — skip realtime

      channel = supabase
        .channel('gamification-realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'xp_events', filter: `user_id=eq.${user.id}` },
          () => { setTimeout(() => fetchAll(), 500); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_xp', filter: `user_id=eq.${user.id}` },
          () => { setTimeout(() => fetchAll(), 500); }
        )
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, fetchAll]);

  return {
    ...state,
    awardXP,
    checkAchievements,
    refresh: fetchAll,
  };
}

// ── GAMIFICATION CONTEXT (for global access) ──
export type { ActionType, XPActionMetadata, Achievement, ActiveQuest };
