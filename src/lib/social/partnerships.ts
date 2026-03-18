// LifeOS Social — Partnership / Accountability Partner Operations

import { supabase } from '../supabase';
import { sendMessage } from './messaging';
import type { Partnership, PartnerWithProfile, PartnerActivity } from './types';
import { logger } from '../../utils/logger';

/** Send a friend request from fromId → toId */
export async function sendFriendRequest(
  fromId: string,
  toId: string,
  message?: string,
): Promise<Partnership | null> {
  const { data, error } = await supabase
    .from('partnerships')
    .insert({
      requester_id: fromId,
      responder_id: toId,
      status: 'pending',
      connection_type: 'friend',
      message: message ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error('[social/partnerships] sendFriendRequest error:', error);
    return null;
  }
  return data as Partnership;
}

/** Send an accountability partner request from fromId → toId */
export async function sendPartnerRequest(
  fromId: string,
  toId: string,
  message?: string,
): Promise<Partnership | null> {
  const { data, error } = await supabase
    .from('partnerships')
    .insert({
      requester_id: fromId,
      responder_id: toId,
      status: 'pending',
      connection_type: 'accountability_partner',
      message: message ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error('[social/partnerships] sendPartnerRequest error:', error);
    return null;
  }
  return data as Partnership;
}

/** Accept or decline a partnership request */
export async function respondToPartnerRequest(
  requestId: string,
  accept: boolean,
): Promise<Partnership | null> {
  const newStatus = accept ? 'accepted' : 'declined';
  const { data, error } = await supabase
    .from('partnerships')
    .update({ status: newStatus })
    .eq('id', requestId)
    .select()
    .single();

  if (error) {
    logger.error('[social/partnerships] respondToPartnerRequest error:', error);
    return null;
  }

  // If accepted, create an initial conversation message so they appear in Messages tab
  if (accept && data) {
    const partnership = data as Partnership;
    const connectionType = partnership.connection_type === 'friend' ? 'friend' : 'accountability partner';
    
    // Send a system message to initialize the conversation
    await sendMessage(
      partnership.responder_id,
      partnership.requester_id,
      `You are now connected as ${connectionType}s! 🎉`,
      'system',
      { connection_type: partnership.connection_type }
    ).catch(err => {
      logger.warn('[social/partnerships] Failed to create initial conversation message:', err);
    });
  }

  return data as Partnership;
}

/** Internal helper: fetch accepted connections of a given type */
async function getConnectionsByType(
  userId: string,
  type: 'friend' | 'accountability_partner' | 'all' = 'all',
): Promise<PartnerWithProfile[]> {
  // Note: partnerships.requester_id/responder_id FK to auth.users, not public_profiles.
  // So we can't use FK hint joins. Fetch partnerships then enrich with profiles separately.
  let query = supabase
    .from('partnerships')
    .select('*')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},responder_id.eq.${userId}`);

  if (type !== 'all') {
    query = query.eq('connection_type', type);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('[social/partnerships] getConnectionsByType error:', error);
    return [];
  }

  // Enrich with public_profiles (separate query since FK goes to auth.users not public_profiles)
  const partnerships = (data ?? []) as Partnership[];
  if (partnerships.length === 0) return [];

  const partnerIds = partnerships.map(p =>
    p.requester_id === userId ? p.responder_id : p.requester_id
  );
  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('*')
    .in('user_id', partnerIds);

  const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

  return partnerships.map(row => {
    const partnerId = row.requester_id === userId ? row.responder_id : row.requester_id;
    return {
      ...row,
      partner_profile: (profileMap.get(partnerId) ?? null) as PartnerWithProfile['partner_profile'],
    };
  });
}

/** Get all accepted accountability partners for a user */
export async function getPartners(userId: string): Promise<PartnerWithProfile[]> {
  return getConnectionsByType(userId, 'accountability_partner');
}

/** Get all accepted friends for a user */
export async function getFriends(userId: string): Promise<PartnerWithProfile[]> {
  return getConnectionsByType(userId, 'friend');
}

/** Get all accepted connections (friends + partners) */
export async function getAllConnections(userId: string): Promise<PartnerWithProfile[]> {
  return getConnectionsByType(userId, 'all');
}

/** Get pending incoming requests for a user, optionally filtered by type */
export async function getPartnerRequests(
  userId: string,
  type: 'friend' | 'accountability_partner' | 'all' = 'all',
): Promise<PartnerWithProfile[]> {
  let query = supabase
    .from('partnerships')
    .select('*')
    .eq('responder_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (type !== 'all') {
    query = query.eq('connection_type', type);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('[social/partnerships] getPartnerRequests error:', error);
    return [];
  }

  const items = (data ?? []) as Partnership[];
  const requesterIds = items.map(p => p.requester_id);

  if (requesterIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('*')
    .in('user_id', requesterIds);

  const profileMap = new Map((profiles ?? []).map((p: Record<string, unknown>) => [p.user_id, p]));

  return items.map(p => ({
    ...p,
    partner_profile: (profileMap.get(p.requester_id) ?? null) as PartnerWithProfile['partner_profile'],
  }));
}

/** Get pending friend requests only */
export async function getFriendRequests(userId: string): Promise<PartnerWithProfile[]> {
  return getPartnerRequests(userId, 'friend');
}

/** Block a user (update existing connection or create blocked entry) */
export async function blockUser(
  userId: string,
  targetId: string,
): Promise<boolean> {
  // Check if there's an existing partnership
  const existing = await getPartnershipStatus(userId, targetId);

  if (existing) {
    const { error } = await supabase
      .from('partnerships')
      .update({ status: 'blocked', blocked_by: userId })
      .eq('id', existing.id);
    return !error;
  }

  // Create a blocked record
  const { error } = await supabase
    .from('partnerships')
    .insert({
      requester_id: userId,
      responder_id: targetId,
      status: 'blocked',
      blocked_by: userId,
      connection_type: 'friend',
    });

  return !error;
}

/** Get recent activity for a partner (their XP events, achievements) */
export async function getPartnerActivity(partnerId: string): Promise<PartnerActivity[]> {
  // Fetch recent XP events
  const { data: xpEvents } = await supabase
    .from('xp_events')
    .select('action_type, description, xp_amount, created_at')
    .eq('user_id', partnerId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch recent achievements
  const { data: achievements } = await supabase
    .from('user_achievements')
    .select('achievement_id, unlocked_at')
    .eq('user_id', partnerId)
    .order('unlocked_at', { ascending: false })
    .limit(5);

  const activities: PartnerActivity[] = [];

  (xpEvents ?? []).forEach((ev: {
    action_type: string;
    description: string | null;
    xp_amount: number;
    created_at: string;
  }) => {
    const iconMap: Record<string, string> = {
      task_complete: '🎯',
      habit_log: '🔥',
      goal_complete: '🏆',
      journal_entry: '📓',
      health_log: '❤️',
      financial_entry: '💰',
    };
    activities.push({
      type: 'quest_complete',
      description: ev.description ?? `Completed a ${ev.action_type.replace(/_/g, ' ')} (+${ev.xp_amount} XP)`,
      icon: iconMap[ev.action_type] ?? '⚡',
      timestamp: ev.created_at,
      metadata: { action_type: ev.action_type, xp_amount: ev.xp_amount },
    });
  });

  (achievements ?? []).forEach((ach: { achievement_id: string; unlocked_at: string }) => {
    activities.push({
      type: 'achievement',
      description: `Unlocked achievement: ${ach.achievement_id}`,
      icon: '🏅',
      timestamp: ach.unlocked_at,
      metadata: { achievement_id: ach.achievement_id },
    });
  });

  // Sort by timestamp desc
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return activities.slice(0, 20);
}

/** Remove / cancel a partnership */
export async function removePartner(partnershipId: string): Promise<boolean> {
  const { error } = await supabase
    .from('partnerships')
    .delete()
    .eq('id', partnershipId);

  if (error) {
    logger.error('[social/partnerships] removePartner error:', error);
    return false;
  }
  return true;
}

/** Check existing partnership status between two users */
export async function getPartnershipStatus(
  userId: string,
  otherUserId: string,
): Promise<Partnership | null> {
  const { data } = await supabase
    .from('partnerships')
    .select('*')
    .or(
      `and(requester_id.eq.${userId},responder_id.eq.${otherUserId}),` +
      `and(requester_id.eq.${otherUserId},responder_id.eq.${userId})`,
    )
    .maybeSingle();

  return (data as Partnership | null) ?? null;
}
