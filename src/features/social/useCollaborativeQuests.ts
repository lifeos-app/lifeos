// LifeOS Social — Collaborative Quests Hook
// Group quests where guild members work together toward collective goals

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/data-access';
import { logger } from '../../utils/logger';
import { awardXP } from '../../lib/gamification/xp-engine';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export type CollaborativeQuestType = 'collective_goal' | 'chain_challenge' | 'boss_raid' | 'knowledge_quest';
export type QuestDifficulty = 'easy' | 'medium' | 'hard' | 'legendary';
export type QuestStatus = 'active' | 'completed' | 'failed' | 'cancelled';
export type XPDistribution = 'equal' | 'proportional';

export interface QuestContribution {
  user_id: string;
  amount: number;
  last_updated: string;
}

export interface CollaborativeQuest {
  id: string;
  guild_id: string;
  created_by: string;
  name: string;
  description: string;
  type: CollaborativeQuestType;
  difficulty: QuestDifficulty;
  status: QuestStatus;
  target: number;
  unit: string;
  current_progress: number;
  contributions: QuestContribution[];
  xp_reward: number;
  xp_distribution: XPDistribution;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════
// QUEST TYPE CONFIG
// ═══════════════════════════════════════════════════

export const QUEST_TYPE_CONFIG: Record<CollaborativeQuestType, { icon: string; label: string; color: string; description: string }> = {
  collective_goal: {
    icon: '🎯',
    label: 'Collective Goal',
    color: '#3B82F6',
    description: 'Guild earns a collective target together',
  },
  chain_challenge: {
    icon: '🔗',
    label: 'Chain Challenge',
    color: '#F97316',
    description: '7-day habit streak challenge',
  },
  boss_raid: {
    icon: '🐉',
    label: 'Boss Raid',
    color: '#EF4444',
    description: 'Defeat the Procrastination Dragon — everyone hits their habits',
  },
  knowledge_quest: {
    icon: '📚',
    label: 'Knowledge Quest',
    color: '#A855F7',
    description: 'Everyone completes Academy lessons together',
  },
};

export const DIFFICULTY_CONFIG: Record<QuestDifficulty, { label: string; color: string; xpMultiplier: number; icon: string }> = {
  easy: { label: 'Easy', color: '#10B981', xpMultiplier: 1, icon: '⭐' },
  medium: { label: 'Medium', color: '#F59E0B', xpMultiplier: 1.5, icon: '⭐⭐' },
  hard: { label: 'Hard', color: '#EF4444', xpMultiplier: 2, icon: '⭐⭐⭐' },
  legendary: { label: 'Legendary', color: '#8B5CF6', xpMultiplier: 3, icon: '👑' },
};

// ═══════════════════════════════════════════════════
// QUEST TEMPLATES
// ═══════════════════════════════════════════════════

export const QUEST_TEMPLATES: Omit<CollaborativeQuest, 'id' | 'guild_id' | 'created_by' | 'contributions' | 'current_progress' | 'status' | 'completed_at' | 'created_at' | 'updated_at'>[] = [
  {
    name: '10K XP Sprint',
    description: 'Guild earns 10,000 XP together!',
    type: 'collective_goal',
    difficulty: 'medium',
    target: 10000,
    unit: 'XP',
    xp_reward: 500,
    xp_distribution: 'proportional',
    deadline: null,
  },
  {
    name: 'Week of Habits',
    description: 'Every member logs habits for 7 consecutive days',
    type: 'chain_challenge',
    difficulty: 'hard',
    target: 7,
    unit: 'days',
    xp_reward: 750,
    xp_distribution: 'equal',
    deadline: null,
  },
  {
    name: 'Defeat the Procrastination Dragon',
    description: 'Every member hits their daily habits — the dragon loses HP with each completion!',
    type: 'boss_raid',
    difficulty: 'legendary',
    target: 100,
    unit: 'habits',
    xp_reward: 1500,
    xp_distribution: 'equal',
    deadline: null,
  },
  {
    name: 'Academy Sprint',
    description: 'Everyone completes 3 Academy lessons this week',
    type: 'knowledge_quest',
    difficulty: 'easy',
    target: 15,
    unit: 'lessons',
    xp_reward: 300,
    xp_distribution: 'equal',
    deadline: null,
  },
];

// ═══════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════

interface UseCollaborativeQuestsReturn {
  quests: CollaborativeQuest[];
  loading: boolean;
  error: string | null;
  createQuest: (quest: Omit<CollaborativeQuest, 'id' | 'created_at' | 'updated_at' | 'contributions' | 'current_progress' | 'status' | 'completed_at'>) => Promise<CollaborativeQuest | null>;
  updateQuest: (questId: string, updates: Partial<CollaborativeQuest>) => Promise<boolean>;
  cancelQuest: (questId: string) => Promise<boolean>;
  contributeToQuest: (questId: string, amount: number) => Promise<boolean>;
  completeQuest: (questId: string) => Promise<boolean>;
  deleteQuest: (questId: string) => Promise<boolean>;
  refreshQuests: () => Promise<void>;
  getActiveQuests: () => CollaborativeQuest[];
  getCompletedQuests: () => CollaborativeQuest[];
  getQuestProgress: (questId: string) => { current: number; target: number; percentage: number };
  getMemberContribution: (questId: string, memberId: string) => number;
  isQuestExpired: (quest: CollaborativeQuest) => boolean;
}

export function useCollaborativeQuests(guildId: string, userId: string): UseCollaborativeQuestsReturn {
  const [quests, setQuests] = useState<CollaborativeQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load Quests ──────────────────────────────────────────────────
  const loadQuests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('guild_collaborative_quests')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setQuests((data ?? []) as CollaborativeQuest[]);
    } catch (err: any) {
      logger.error('[useCollaborativeQuests] loadQuests error:', err);
      setError(err.message || 'Failed to load quests');
      setQuests([]);
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => { void loadQuests(); }, [loadQuests]);

  // ── Realtime subscription ────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`guild_quests:${guildId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guild_collaborative_quests', filter: `guild_id=eq.${guildId}` }, () => {
        void loadQuests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [guildId, loadQuests]);

  // ── Auto-detect quest completion ──────────────────────────────────
  useEffect(() => {
    quests.forEach(quest => {
      if (quest.status === 'active' && quest.current_progress >= quest.target) {
        void completeQuest(quest.id);
      }
    });
  }, [quests]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Check for expired quests ──────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setQuests(prev => prev.map(q => {
        if (q.status === 'active' && q.deadline && new Date(q.deadline).getTime() < Date.now()) {
          return { ...q, status: 'failed' as QuestStatus };
        }
        return q;
      }));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // ── Create Quest ──────────────────────────────────────────────────
  const createQuest = useCallback(async (
    data: Omit<CollaborativeQuest, 'id' | 'created_at' | 'updated_at' | 'contributions' | 'current_progress' | 'status' | 'completed_at'>
  ): Promise<CollaborativeQuest | null> => {
    try {
      const { data: quest, error: insertError } = await supabase
        .from('guild_collaborative_quests')
        .insert({
          ...data,
          current_progress: 0,
          contributions: [],
          status: 'active',
          completed_at: null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Award XP for creating a quest
      try {
        await awardXP(supabase, userId, 'guild_contribute', { description: `Created collaborative quest: ${data.name}` });
      } catch { /* non-critical */ }

      setQuests(prev => [quest as CollaborativeQuest, ...prev]);
      return quest as CollaborativeQuest;
    } catch (err: any) {
      logger.error('[useCollaborativeQuests] createQuest error:', err);
      setError(err.message || 'Failed to create quest');
      return null;
    }
  }, [guildId, userId]);

  // ── Update Quest ──────────────────────────────────────────────────
  const updateQuest = useCallback(async (questId: string, updates: Partial<CollaborativeQuest>): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('guild_collaborative_quests')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', questId);

      if (updateError) throw updateError;
      setQuests(prev => prev.map(q => q.id === questId ? { ...q, ...updates } : q));
      return true;
    } catch (err: any) {
      logger.error('[useCollaborativeQuests] updateQuest error:', err);
      return false;
    }
  }, []);

  // ── Cancel Quest ──────────────────────────────────────────────────
  const cancelQuest = useCallback(async (questId: string): Promise<boolean> => {
    return updateQuest(questId, { status: 'cancelled' });
  }, [updateQuest]);

  // ── Contribute to Quest ──────────────────────────────────────────
  const contributeToQuest = useCallback(async (questId: string, amount: number): Promise<boolean> => {
    try {
      const quest = quests.find(q => q.id === questId);
      if (!quest || quest.status !== 'active') return false;

      // Update contribution for this user
      const existingContrib = quest.contributions.find(c => c.user_id === userId);
      let newContributions: QuestContribution[];

      if (existingContrib) {
        newContributions = quest.contributions.map(c =>
          c.user_id === userId
            ? { ...c, amount: c.amount + amount, last_updated: new Date().toISOString() }
            : c
        );
      } else {
        newContributions = [
          ...quest.contributions,
          { user_id: userId, amount, last_updated: new Date().toISOString() },
        ];
      }

      const newProgress = Math.min(quest.current_progress + amount, quest.target);

      const { error: contribError } = await supabase
        .from('guild_collaborative_quests')
        .update({
          current_progress: newProgress,
          contributions: newContributions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', questId);

      if (contribError) throw contribError;

      // Award XP for contributing
      try {
        await awardXP(supabase, userId, 'guild_contribute', { description: `Contributed to quest: ${quest.name}` });
      } catch { /* non-critical */ }

      setQuests(prev => prev.map(q =>
        q.id === questId ? { ...q, current_progress: newProgress, contributions: newContributions } : q
      ));
      return true;
    } catch (err: any) {
      logger.error('[useCollaborativeQuests] contributeToQuest error:', err);
      return false;
    }
  }, [quests, userId]);

  // ── Complete Quest (distribute XP) ────────────────────────────────
  const completeQuest = useCallback(async (questId: string): Promise<boolean> => {
    try {
      const quest = quests.find(q => q.id === questId);
      if (!quest) return false;

      const { error: completeError } = await supabase
        .from('guild_collaborative_quests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', questId);

      if (completeError) throw completeError;

      // Distribute XP
      const contributors = quest.contributions.filter(c => c.amount > 0);
      if (contributors.length > 0) {
        if (quest.xp_distribution === 'equal') {
          // Equal distribution
          const perPerson = Math.floor(quest.xp_reward / contributors.length);
          for (const contributor of contributors) {
            try {
              await awardXP(supabase, contributor.user_id, 'guild_contribute', {
                description: `Completed quest: ${quest.name} — ${perPerson} XP reward`,
              });
            } catch { /* non-critical */ }
          }
        } else {
          // Proportional distribution
          const totalContributed = contributors.reduce((sum, c) => sum + c.amount, 0);
          for (const contributor of contributors) {
            const share = totalContributed > 0
              ? Math.floor(quest.xp_reward * (contributor.amount / totalContributed))
              : Math.floor(quest.xp_reward / contributors.length);
            try {
              await awardXP(supabase, contributor.user_id, 'guild_contribute', {
                description: `Completed quest: ${quest.name} — ${share} XP reward`,
              });
            } catch { /* non-critical */ }
          }
        }
      }

      setQuests(prev => prev.map(q =>
        q.id === questId ? { ...q, status: 'completed', completed_at: new Date().toISOString() } : q
      ));
      return true;
    } catch (err: any) {
      logger.error('[useCollaborativeQuests] completeQuest error:', err);
      return false;
    }
  }, [quests]);

  // ── Delete Quest ──────────────────────────────────────────────────
  const deleteQuest = useCallback(async (questId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('guild_collaborative_quests')
        .delete()
        .eq('id', questId);

      if (deleteError) throw deleteError;
      setQuests(prev => prev.filter(q => q.id !== questId));
      return true;
    } catch (err: any) {
      logger.error('[useCollaborativeQuests] deleteQuest error:', err);
      return false;
    }
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────
  const getActiveQuests = useCallback(() => quests.filter(q => q.status === 'active'), [quests]);
  const getCompletedQuests = useCallback(() => quests.filter(q => q.status === 'completed'), [quests]);

  const getQuestProgress = useCallback((questId: string) => {
    const quest = quests.find(q => q.id === questId);
    if (!quest) return { current: 0, target: 1, percentage: 0 };
    return {
      current: quest.current_progress,
      target: quest.target,
      percentage: Math.min(100, (quest.current_progress / quest.target) * 100),
    };
  }, [quests]);

  const getMemberContribution = useCallback((questId: string, memberId: string) => {
    const quest = quests.find(q => q.id === questId);
    if (!quest) return 0;
    const contrib = quest.contributions.find(c => c.user_id === memberId);
    return contrib?.amount ?? 0;
  }, [quests]);

  const isQuestExpired = useCallback((quest: CollaborativeQuest) => {
    if (!quest.deadline) return false;
    return new Date(quest.deadline).getTime() < Date.now();
  }, []);

  // ── Auto-detect progress from member activities ──────────────────
  // This would be called by a background sync or triggered by habit/XP events
  const syncQuestProgress = useCallback(async () => {
    const activeQuests = quests.filter(q => q.status === 'active');
    for (const quest of activeQuests) {
      // For collective_goal quests: auto-track guild XP contributions
      if (quest.type === 'collective_goal' && quest.unit === 'XP') {
        try {
          const { data: contributions } = await supabase
            .from('guild_contributions')
            .select('amount')
            .eq('guild_id', guildId);
          const totalXp = (contributions || []).reduce((sum: number, c: { amount: number }) => sum + c.amount, 0);
          if (totalXp !== quest.current_progress) {
            await updateQuest(quest.id, { current_progress: totalXp });
          }
        } catch { /* best effort */ }
      }
    }
  }, [quests, guildId, updateQuest]);

  // Sync progress periodically
  useEffect(() => {
    const interval = setInterval(() => { void syncQuestProgress(); }, 5 * 60_000);
    return () => clearInterval(interval);
  }, [syncQuestProgress]);

  const refreshQuests = useCallback(async () => { await loadQuests(); }, [loadQuests]);

  return {
    quests,
    loading,
    error,
    createQuest,
    updateQuest,
    cancelQuest,
    contributeToQuest,
    completeQuest,
    deleteQuest,
    refreshQuests,
    getActiveQuests,
    getCompletedQuests,
    getQuestProgress,
    getMemberContribution,
    isQuestExpired,
  };
}