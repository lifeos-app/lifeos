// LifeOS Social — Social Feed Hook
// Aggregates achievement events, reactions, comments, and feeds

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/data-access';
import { logger } from '../../utils/logger';
import { localInsert, localGetAll, localUpdate, localDelete } from '../../lib/local-db';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export type FeedEventType =
  | 'streak_milestone'
  | 'level_up'
  | 'habit_logged'
  | 'goal_completed'
  | 'achievement_unlocked'
  | 'journal_entry'
  | 'community_event'
  | 'boss_defeated'
  | 'zone_visited'
  | 'guild_event'
  | 'quest_completed'
  | 'challenge_joined';

export type ReactionEmoji = '👍' | '🔥' | '👏' | '❤️' | '🤯' | '🎉';
export type FeedVisibility = 'guild' | 'friends' | 'everyone';

export interface FeedComment {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export interface SocialFeedItem {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar_url: string | null;
  user_level: number;
  user_class_icon: string;
  event_type: FeedEventType;
  title: string;
  body: string;
  icon: string;
  milestone_value: number | null;
  visibility: FeedVisibility;
  guild_id: string | null;
  reactions: Record<ReactionEmoji, string[]>;  // emoji → user_ids
  comments: FeedComment[];
  created_at: string;
  updated_at: string;
}

export interface WeeklySummary {
  totalXP: number;
  habitsLogged: number;
  goalsCompleted: number;
  streakDays: number;
  achievementsUnlocked: number;
  rank: number;
}

// ═══════════════════════════════════════════════════
// FEED ITEM CONFIG
// ═══════════════════════════════════════════════════

export const FEED_EVENT_CONFIG: Record<FeedEventType, { icon: string; bgColor: string; verb: string; label: string; isCelebration: boolean }> = {
  streak_milestone: { icon: '🔥', bgColor: '#F97316', verb: 'completed a', label: 'Streak', isCelebration: true },
  level_up: { icon: '⬆️', bgColor: '#3B82F6', verb: 'leveled up to', label: 'Level Up', isCelebration: true },
  habit_logged: { icon: '✅', bgColor: '#10B981', verb: 'logged a habit:', label: 'Habit', isCelebration: false },
  goal_completed: { icon: '🏆', bgColor: '#EAB308', verb: 'completed a goal:', label: 'Goal', isCelebration: true },
  achievement_unlocked: { icon: '🏅', bgColor: '#8B5CF6', verb: 'unlocked an achievement:', label: 'Achievement', isCelebration: true },
  journal_entry: { icon: '📓', bgColor: '#EC4899', verb: 'wrote in their journal', label: 'Journal', isCelebration: false },
  community_event: { icon: '🌌', bgColor: '#06B6D4', verb: 'participated in', label: 'Event', isCelebration: false },
  boss_defeated: { icon: '⚔️', bgColor: '#EF4444', verb: 'defeated the', label: 'Boss', isCelebration: true },
  zone_visited: { icon: '🗺️', bgColor: '#64748B', verb: 'explored', label: 'Zone', isCelebration: false },
  guild_event: { icon: '🏰', bgColor: '#A855F7', verb: 'joined a guild event:', label: 'Guild Event', isCelebration: false },
  quest_completed: { icon: '🎯', bgColor: '#22C55E', verb: 'completed a quest:', label: 'Quest', isCelebration: true },
  challenge_joined: { icon: '💪', bgColor: '#F43F5E', verb: 'joined a challenge:', label: 'Challenge', isCelebration: false },
};

export const REACTION_OPTIONS: ReactionEmoji[] = ['👍', '🔥', '👏', '❤️', '🤯', '🎉'];

// ═══════════════════════════════════════════════════
// FEED ALGORITHM
// ═══════════════════════════════════════════════════

function scoreFeedItem(item: SocialFeedItem): number {
  const age = Date.now() - new Date(item.created_at).getTime();
  const ageHours = age / (1000 * 60 * 60);

  // Recency score (higher for newer, decays over 48 hours)
  const recencyScore = Math.max(0, 48 - ageHours);

  // Celebration boost (reactions from others)
  const totalReactions = Object.values(item.reactions).reduce((sum, ids) => sum + ids.length, 0);
  const celebrationScore = totalReactions * 3;

  // Comment boost
  const commentScore = item.comments.length * 2;

  // Milestone significance
  const milestoneScore = item.milestone_value
    ? Math.min(20, Math.log10(item.milestone_value) * 5)
    : 0;

  // Event type weight
  const config = FEED_EVENT_CONFIG[item.event_type];
  const typeWeight = config?.isCelebration ? 5 : 1;

  return recencyScore + celebrationScore + commentScore + milestoneScore + typeWeight;
}

function sortFeedItems(items: SocialFeedItem[]): SocialFeedItem[] {
  return [...items].sort((a, b) => scoreFeedItem(b) - scoreFeedItem(a));
}

// ═══════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════

interface UseSocialFeedReturn {
  feedItems: SocialFeedItem[];
  weeklySummary: WeeklySummary | null;
  loading: boolean;
  error: string | null;
  addReaction: (itemId: string, emoji: ReactionEmoji) => Promise<boolean>;
  removeReaction: (itemId: string, emoji: ReactionEmoji) => Promise<boolean>;
  addComment: (itemId: string, content: string) => Promise<boolean>;
  shareEvent: (eventType: FeedEventType, title: string, body: string, milestoneValue?: number, visibility?: FeedVisibility, guildId?: string) => Promise<SocialFeedItem | null>;
  deleteItem: (itemId: string) => Promise<boolean>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  refresh: () => Promise<void>;
}

const PAGE_SIZE = 20;

export function useSocialFeed(userId: string, guildId?: string): UseSocialFeedReturn {
  const [feedItems, setFeedItems] = useState<SocialFeedItem[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // ── Load Initial Feed ────────────────────────────────────────────
  const loadFeed = useCallback(async (resetCursor = false) => {
    if (resetCursor) {
      setCursor(null);
      setHasMore(true);
    }
    setLoading(true);
    setError(null);
    try {
      try {
        let query = supabase
          .from('social_feed_items')
          .select('id,user_id,user_name,user_avatar_url,user_level,user_class_icon,event_type,title,body,icon,milestone_value,visibility,guild_id,reactions,comments,created_at,updated_at')
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);

        // Privacy filter
        if (guildId) {
          query = query.or(`visibility.eq.everyone,visibility.eq.friends,visibility.eq.guild.and.guild_id.eq.${guildId}`);
        } else {
          query = query.in('visibility', ['everyone', 'friends']);
        }

        if (!resetCursor && cursor) {
          query = query.lt('created_at', cursor);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        const items = (data ?? []) as SocialFeedItem[];

        if (resetCursor) {
          setFeedItems(sortFeedItems(items));
        } else {
          setFeedItems(prev => sortFeedItems([...prev, ...items]));
        }

        if (items.length < PAGE_SIZE) {
          setHasMore(false);
        } else {
          setCursor(items[items.length - 1]?.created_at ?? null);
        }
      } catch (supabaseErr: any) {
        // Fallback to local DB when offline
        logger.warn('[useSocialFeed] Supabase loadFeed failed, falling back to local:', supabaseErr);
        const allItems = await localGetAll<SocialFeedItem>('social_feed_items');
        const filtered = guildId
          ? allItems.filter(i => i.visibility === 'everyone' || i.visibility === 'friends' || (i.visibility === 'guild' && i.guild_id === guildId))
          : allItems.filter(i => i.visibility === 'everyone' || i.visibility === 'friends');
        const sorted = sortFeedItems(filtered);
        setFeedItems(sorted);
        setHasMore(false);
      }
    } catch (err: any) {
      logger.error('[useSocialFeed] loadFeed error:', err);
      setError(err.message || 'Failed to load feed');
      if (resetCursor) setFeedItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId, guildId, cursor]);

  // ── Load Weekly Summary ──────────────────────────────────────────
  const loadWeeklySummary = useCallback(async () => {
    try {
      // Get this week's stats for the current user
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data: xpEvents } = await supabase
        .from('xp_events')
        .select('xp_amount')
        .eq('user_id', userId)
        .gte('created_at', oneWeekAgo.toISOString());

      const totalXP = (xpEvents || []).reduce((sum: number, e: { xp_amount: number }) => sum + (e.xp_amount || 0), 0);

      // Simplified summary (real implementation would aggregate more)
      setWeeklySummary({
        totalXP,
        habitsLogged: 0,
        goalsCompleted: 0,
        streakDays: 0,
        achievementsUnlocked: 0,
        rank: 0,
      });
    } catch (err: any) {
      logger.error('[useSocialFeed] loadWeeklySummary error:', err);
    }
  }, [userId]);

  useEffect(() => {
    void loadFeed(true);
    void loadWeeklySummary();
  }, [userId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime subscription for new feed items ──────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('social_feed_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_feed_items' }, (payload) => {
        const newItem = payload.new as SocialFeedItem;
        // Privacy filter
        if (newItem.visibility === 'everyone' ||
            newItem.visibility === 'friends' ||
            (newItem.visibility === 'guild' && newItem.guild_id === guildId)) {
          setFeedItems(prev => sortFeedItems([newItem, ...prev]));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [guildId]);

  // ── Add Reaction ──────────────────────────────────────────────────
  const addReaction = useCallback(async (itemId: string, emoji: ReactionEmoji): Promise<boolean> => {
    try {
      const item = feedItems.find(i => i.id === itemId);
      if (!item) return false;

      const reactions = { ...item.reactions };
      const currentUsers = reactions[emoji] || [];

      if (currentUsers.includes(userId)) return true; // Already reacted

      reactions[emoji] = [...currentUsers, userId];

      await localUpdate('social_feed_items', itemId, { reactions, updated_at: new Date().toISOString() });

      setFeedItems(prev => prev.map(i => i.id === itemId ? { ...i, reactions } : i));
      return true;
    } catch (err: any) {
      logger.error('[useSocialFeed] addReaction error:', err);
      return false;
    }
  }, [feedItems, userId]);

  // ── Remove Reaction ──────────────────────────────────────────────
  const removeReaction = useCallback(async (itemId: string, emoji: ReactionEmoji): Promise<boolean> => {
    try {
      const item = feedItems.find(i => i.id === itemId);
      if (!item) return false;

      const reactions = { ...item.reactions };
      const currentUsers = reactions[emoji] || [];
      reactions[emoji] = currentUsers.filter(id => id !== userId);

      await localUpdate('social_feed_items', itemId, { reactions, updated_at: new Date().toISOString() });

      setFeedItems(prev => prev.map(i => i.id === itemId ? { ...i, reactions } : i));
      return true;
    } catch (err: any) {
      logger.error('[useSocialFeed] removeReaction error:', err);
      return false;
    }
  }, [feedItems, userId]);

  // ── Add Comment ──────────────────────────────────────────────────
  const addComment = useCallback(async (itemId: string, content: string): Promise<boolean> => {
    try {
      const item = feedItems.find(i => i.id === itemId);
      if (!item) return false;

      const newComment: FeedComment = {
        id: crypto.randomUUID(),
        user_id: userId,
        user_name: '', // Will be filled by DB trigger or join
        content,
        created_at: new Date().toISOString(),
      };

      const comments = [...item.comments, newComment];

      await localUpdate('social_feed_items', itemId, { comments, updated_at: new Date().toISOString() });

      setFeedItems(prev => prev.map(i => i.id === itemId ? { ...i, comments } : i));
      return true;
    } catch (err: any) {
      logger.error('[useSocialFeed] addComment error:', err);
      return false;
    }
  }, [feedItems, userId]);

  // ── Share Event (create feed item) ───────────────────────────────
  const shareEvent = useCallback(async (
    eventType: FeedEventType,
    title: string,
    body: string,
    milestoneValue?: number,
    visibility: FeedVisibility = 'friends',
    guildId?: string | null,
  ): Promise<SocialFeedItem | null> => {
    try {
      const config = FEED_EVENT_CONFIG[eventType];
      const now = new Date().toISOString();
      const newItem = {
        id: crypto.randomUUID(),
        user_id: userId,
        user_name: '',  // Will be filled by DB
        user_avatar_url: null,
        user_level: 0,
        user_class_icon: config?.icon || '🌟',
        event_type: eventType,
        title,
        body,
        icon: config?.icon || '🌟',
        milestone_value: milestoneValue || null,
        visibility,
        guild_id: guildId || null,
        reactions: {} as Record<ReactionEmoji, string[]>,
        comments: [] as FeedComment[],
        created_at: now,
        updated_at: now,
        synced: 0,
      } as any;

      await localInsert('social_feed_items', newItem);
      setFeedItems(prev => sortFeedItems([newItem as SocialFeedItem, ...prev]));
      return newItem as SocialFeedItem;
    } catch (err: any) {
      logger.error('[useSocialFeed] shareEvent error:', err);
      return null;
    }
  }, [userId]);

  // ── Delete Item ──────────────────────────────────────────────────
  const deleteItem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      await localDelete('social_feed_items', itemId);
      setFeedItems(prev => prev.filter(i => i.id !== itemId));
      return true;
    } catch (err: any) {
      logger.error('[useSocialFeed] deleteItem error:', err);
      return false;
    }
  }, []);

  // ── Load More (pagination) ───────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await loadFeed(false);
  }, [hasMore, loading, loadFeed]);

  // ── Refresh ──────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await loadFeed(true);
    await loadWeeklySummary();
  }, [loadFeed, loadWeeklySummary]);

  return {
    feedItems,
    weeklySummary,
    loading,
    error,
    addReaction,
    removeReaction,
    addComment,
    shareEvent,
    deleteItem,
    loadMore,
    hasMore,
    refresh,
  };
}

// ═══════════════════════════════════════════════════
// AUTO-GENERATE FEED ITEMS
// ═══════════════════════════════════════════════════

/**
 * Auto-generate a social feed item from an achievement event.
 * Call this when an achievement is unlocked, a level is gained, etc.
 */
export async function autoGenerateFeedItem(
  userId: string,
  eventType: FeedEventType,
  title: string,
  body: string,
  milestoneValue?: number,
  visibility: FeedVisibility = 'friends',
  guildId?: string,
): Promise<SocialFeedItem | null> {
  try {
    const config = FEED_EVENT_CONFIG[eventType];
    const now = new Date().toISOString();
    const newItem = {
      id: crypto.randomUUID(),
      user_id: userId,
      event_type: eventType,
      title,
      body,
      icon: config?.icon || '🌟',
      milestone_value: milestoneValue || null,
      visibility,
      guild_id: guildId || null,
      reactions: {} as Record<ReactionEmoji, string[]>,
      comments: [] as FeedComment[],
      created_at: now,
      updated_at: now,
      synced: 0,
    } as any;

    await localInsert('social_feed_items', newItem);
    return newItem as SocialFeedItem;
  } catch (err: any) {
    logger.error('[useSocialFeed] autoGenerateFeedItem error:', err);
    return null;
  }
}