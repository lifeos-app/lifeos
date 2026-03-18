// LifeOS Social — Accountability Partner Goal Features

import { supabase } from '../supabase';
import type { PartnerGoal, GoalComment, WeeklyProgress } from './types';
import { logger } from '../../utils/logger';

/** Get a partner's goals (if they're your accountability partner) */
export async function getPartnerGoals(userId: string, partnerId: string): Promise<PartnerGoal[]> {
  // First verify they are accountability partners
  const { data: partnership } = await supabase
    .from('partnerships')
    .select('*')
    .or(
      `and(requester_id.eq.${userId},responder_id.eq.${partnerId}),` +
      `and(requester_id.eq.${partnerId},responder_id.eq.${userId})`,
    )
    .eq('status', 'accepted')
    .eq('connection_type', 'accountability_partner')
    .maybeSingle();

  if (!partnership) {
    logger.warn('[social/partner-goals] Not accountability partners');
    return [];
  }

  // Fetch partner's goals
  const { data, error } = await supabase
    .from('goals')
    .select('id, title, description, category, progress, status, icon, color, target_date, created_at, updated_at')
    .eq('user_id', partnerId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    logger.error('[social/partner-goals] getPartnerGoals error:', error);
    return [];
  }

  return (data || []) as PartnerGoal[];
}

/** Get comments on a goal */
export async function getGoalComments(goalId: string): Promise<GoalComment[]> {
  const { data, error } = await supabase
    .from('goal_comments')
    .select('*')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('[social/partner-goals] getGoalComments error:', error);
    return [];
  }

  const comments = (data || []) as GoalComment[];
  const userIds = [...new Set(comments.map(c => c.user_id))];

  if (userIds.length === 0) return comments;

  // Fetch user profiles
  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('*')
    .in('user_id', userIds);

  const profileMap = new Map((profiles || []).map((p: Record<string, unknown>) => [p.user_id as string, p]));

  return comments.map(c => ({
    ...c,
    user_profile: (profileMap.get(c.user_id) as any) || null,
  }));
}

/** Add a comment to a goal */
export async function addGoalComment(
  goalId: string,
  userId: string,
  content: string,
): Promise<GoalComment | null> {
  const { data, error } = await supabase
    .from('goal_comments')
    .insert({
      goal_id: goalId,
      user_id: userId,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    logger.error('[social/partner-goals] addGoalComment error:', error);
    return null;
  }

  return data as GoalComment;
}

/** Delete a comment (own comments only) */
export async function deleteGoalComment(commentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('goal_comments')
    .delete()
    .eq('id', commentId);

  if (error) {
    logger.error('[social/partner-goals] deleteGoalComment error:', error);
    return false;
  }
  return true;
}

/** Get weekly progress for a user */
export async function getWeeklyProgress(userId: string): Promise<WeeklyProgress> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekStart = oneWeekAgo.toISOString();

  // Tasks completed this week
  const { count: tasksCompleted } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'done')
    .gte('completed_at', weekStart);

  // Habits logged this week
  const { count: habitsLogged } = await supabase
    .from('habit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', weekStart);

  // Goals with progress increase this week (rough estimate via updated_at)
  const { count: goalsAdvanced } = await supabase
    .from('goals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gt('progress', 0)
    .gte('updated_at', weekStart);

  // XP gained this week
  const { data: xpEvents } = await supabase
    .from('xp_events')
    .select('xp_amount')
    .eq('user_id', userId)
    .gte('created_at', weekStart);

  const xpGained = (xpEvents || []).reduce((sum: number, e: { xp_amount: number }) => sum + e.xp_amount, 0);

  return {
    tasks_completed: tasksCompleted || 0,
    habits_logged: habitsLogged || 0,
    goals_advanced: goalsAdvanced || 0,
    xp_gained: xpGained,
  };
}

/** Subscribe to new comments on a goal */
export function subscribeToGoalComments(
  goalId: string,
  onComment: (comment: GoalComment) => void,
) {
  const channel = supabase
    .channel(`goal-comments:${goalId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'goal_comments',
        filter: `goal_id=eq.${goalId}`,
      },
      async (payload) => {
        const comment = payload.new as GoalComment;
        // Fetch user profile
        const { data: profile } = await supabase
          .from('public_profiles')
          .select('*')
          .eq('user_id', comment.user_id)
          .single();
        onComment({ ...comment, user_profile: profile });
      },
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}
