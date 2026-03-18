// LifeOS Social — Goal-based Group Chats

import { supabase } from '../supabase';
import type { GoalGroup, GoalGroupMember, Message } from './types';
import { logger } from '../../utils/logger';

/** Create a new goal group */
export async function createGroup(
  name: string,
  category: string,
  creatorId: string,
  description?: string,
  icon = '🎯',
): Promise<GoalGroup | null> {
  const { data: group, error } = await supabase
    .from('goal_groups')
    .insert({
      name,
      category,
      created_by: creatorId,
      description: description ?? null,
      icon,
    })
    .select()
    .single();

  if (error) {
    logger.error('[social/groups] createGroup error:', error);
    return null;
  }

  // Creator automatically joins as owner
  await supabase.from('goal_group_members').insert({
    group_id: (group as GoalGroup).id,
    user_id: creatorId,
    role: 'owner',
  });

  return group as GoalGroup;
}

/** Join a group */
export async function joinGroup(groupId: string, userId: string): Promise<GoalGroupMember | null> {
  const { data, error } = await supabase
    .from('goal_group_members')
    .insert({ group_id: groupId, user_id: userId, role: 'member' })
    .select()
    .single();

  if (error) {
    logger.error('[social/groups] joinGroup error:', error);
    return null;
  }
  return data as GoalGroupMember;
}

/** Leave a group */
export async function leaveGroup(groupId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('goal_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    logger.error('[social/groups] leaveGroup error:', error);
    return false;
  }
  return true;
}

/** Browse available groups, optionally filtered by category */
export async function getGroups(category?: string): Promise<GoalGroup[]> {
  let query = supabase
    .from('goal_groups')
    .select('*')
    .order('member_count', { ascending: false });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query.limit(50);

  if (error) {
    logger.error('[social/groups] getGroups error:', error);
    return [];
  }
  return (data ?? []) as GoalGroup[];
}

/** Get groups the user is a member of */
export async function getUserGroups(userId: string): Promise<GoalGroup[]> {
  const { data, error } = await supabase
    .from('goal_group_members')
    .select('group_id, goal_groups(*)')
    .eq('user_id', userId);

  if (error) {
    logger.error('[social/groups] getUserGroups error:', error);
    return [];
  }

  return ((data ?? []) as Array<{ goal_groups: unknown }>)
    .map(row => row.goal_groups as GoalGroup | null)
    .filter((g): g is GoalGroup => g !== null);
}

/** Check if user is a member of a group */
export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('goal_group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  return data !== null;
}

/** Get paginated messages for a group */
export async function getGroupMessages(
  groupId: string,
  limit = 50,
  offset = 0,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error('[social/groups] getGroupMessages error:', error);
    return [];
  }

  return ((data ?? []) as Message[]).reverse();
}

/** Send a message to a group */
export async function sendGroupMessage(
  groupId: string,
  senderId: string,
  content: string,
  type: Message['message_type'] = 'text',
  metadata: Record<string, unknown> = {},
): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      group_id: groupId,
      sender_id: senderId,
      content,
      message_type: type,
      metadata,
    })
    .select()
    .single();

  if (error) {
    logger.error('[social/groups] sendGroupMessage error:', error);
    return null;
  }
  return data as Message;
}

/** Subscribe to real-time group messages */
export function subscribeToGroup(
  groupId: string,
  onMessage: (msg: Message) => void,
) {
  const channel = supabase
    .channel(`group:${groupId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `group_id=eq.${groupId}`,
      },
      (payload) => {
        onMessage(payload.new as Message);
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

/** Log a contribution to a guild objective */
export async function logGuildContribution(
  guildId: string,
  userId: string,
  amount: number,
  note?: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('guild_contributions')
    .insert({
      guild_id: guildId,
      user_id: userId,
      amount,
      note: note ?? null,
    });

  if (error) {
    logger.error('[social/groups] logGuildContribution error:', error);
    return false;
  }
  return true;
}

/** Get all contributions for a guild */
export async function getGuildContributions(guildId: string) {
  const { data, error } = await supabase
    .from('guild_contributions')
    .select('*')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('[social/groups] getGuildContributions error:', error);
    return [];
  }
  return data || [];
}

/** Get guild leaderboard (members sorted by total contribution) */
export async function getGuildLeaderboard(guildId: string) {
  // Get all members
  const { data: members, error: membersError } = await supabase
    .from('goal_group_members')
    .select('user_id')
    .eq('group_id', guildId);

  if (membersError) {
    logger.error('[social/groups] getGuildLeaderboard members error:', membersError);
    return [];
  }

  const userIds = (members || []).map((m: { user_id: string }) => m.user_id);
  if (userIds.length === 0) return [];

  // Get profiles
  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('*')
    .in('user_id', userIds);

  const profileMap = new Map((profiles || []).map((p: Record<string, unknown>) => [p.user_id as string, p]));

  // Get contributions grouped by user
  const { data: contributions } = await supabase
    .from('guild_contributions')
    .select('user_id, amount, created_at')
    .eq('guild_id', guildId);

  const contribMap = new Map<string, { total: number; last: string | null }>();
  for (const contrib of (contributions || [])) {
    const existing = contribMap.get(contrib.user_id) || { total: 0, last: null };
    contribMap.set(contrib.user_id, {
      total: existing.total + contrib.amount,
      last: !existing.last || contrib.created_at > existing.last ? contrib.created_at : existing.last,
    });
  }

  // Build leaderboard
  const leaderboard = userIds.map(userId => ({
    user_id: userId,
    profile: profileMap.get(userId) || null,
    total_contribution: contribMap.get(userId)?.total || 0,
    last_contribution: contribMap.get(userId)?.last || null,
  }));

  // Sort by total contribution descending
  leaderboard.sort((a, b) => b.total_contribution - a.total_contribution);

  return leaderboard;
}

/** Get total guild progress toward objective */
export async function getGuildProgress(guildId: string): Promise<{ current: number; target: number; percentage: number }> {
  const { data: contributions } = await supabase
    .from('guild_contributions')
    .select('amount')
    .eq('guild_id', guildId);

  const total = (contributions || []).reduce((sum: number, c: { amount: number }) => sum + c.amount, 0);

  // Get objective target
  const { data: guild } = await supabase
    .from('goal_groups')
    .select('objective')
    .eq('id', guildId)
    .single();

  const target = (guild?.objective as { target_value?: number } | null)?.target_value || 1;
  const percentage = Math.min(100, (total / target) * 100);

  return { current: total, target, percentage };
}

/** Get guild members with profiles */
export async function getGuildMembers(guildId: string) {
  const { data: members, error } = await supabase
    .from('goal_group_members')
    .select('user_id, role, joined_at')
    .eq('group_id', guildId)
    .order('joined_at', { ascending: true });

  if (error) {
    logger.error('[social/groups] getGuildMembers error:', error);
    return [];
  }

  const userIds = (members || []).map((m: { user_id: string }) => m.user_id);
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('*')
    .in('user_id', userIds);

  const profileMap = new Map((profiles || []).map((p: Record<string, unknown>) => [p.user_id as string, p]));

  return (members || []).map((m: { user_id: string; role: string; joined_at: string }) => ({
    ...m,
    profile: profileMap.get(m.user_id) || null,
  }));
}
