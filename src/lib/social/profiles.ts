// LifeOS Social — Public Profile Operations

import { supabase } from '../supabase';
import { inferLadderFromCategories, getLadderRank } from '../gamification/ladder';
import type { LadderKey } from '../gamification/ladder';
import type { PublicProfile, PublicProfileUpdate } from './types';
import { logger } from '../../utils/logger';

/** Fetch any user's public profile */
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('[social/profiles] getPublicProfile error:', error);
    return null;
  }
  return data as PublicProfile | null;
}

/** Upsert own public profile */
export async function updatePublicProfile(
  userId: string,
  updates: PublicProfileUpdate,
): Promise<PublicProfile | null> {
  const payload = {
    user_id: userId,
    ...updates,
    updated_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('public_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    logger.error('[social/profiles] updatePublicProfile error:', error);
    return null;
  }
  return data as PublicProfile;
}

export interface ProfileSearchFilters {
  goal_categories?: string[];
  looking_for_partner?: boolean;
  min_level?: number;
  max_level?: number;
  active_days?: number; // must have been active within last N days
  exclude_user_id?: string;
}

/** Search public profiles with optional filters */
export async function searchProfiles(
  filters: ProfileSearchFilters = {},
): Promise<PublicProfile[]> {
  let query = supabase.from('public_profiles').select('*');

  if (filters.looking_for_partner === true) {
    query = query.eq('looking_for_partner', true);
  }

  if (typeof filters.min_level === 'number') {
    query = query.gte('level', filters.min_level);
  }

  if (typeof filters.max_level === 'number') {
    query = query.lte('level', filters.max_level);
  }

  if (filters.active_days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filters.active_days);
    query = query.gte('last_active_at', cutoff.toISOString());
  }

  if (filters.goal_categories && filters.goal_categories.length > 0) {
    query = query.overlaps('goal_categories', filters.goal_categories);
  }

  if (filters.exclude_user_id) {
    query = query.neq('user_id', filters.exclude_user_id);
  }

  query = query.order('last_active_at', { ascending: false }).limit(200);

  const { data, error } = await query;

  if (error) {
    logger.error('[social/profiles] searchProfiles error:', error);
    return [];
  }
  return (data ?? []) as PublicProfile[];
}

/** Pull level/XP/streak from gamification tables into public profile */
export async function syncProfileFromGameState(userId: string): Promise<void> {
  // Fetch from user_xp table
  const { data: xpData } = await supabase
    .from('user_xp')
    .select('total_xp, level, title')
    .eq('user_id', userId)
    .maybeSingle();

  // Fetch streak from habits or xp_events
  const { data: streakData } = await supabase
    .from('xp_events')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  const lastActivity = streakData?.[0]?.created_at ?? null;
  const daysSinceActive = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86_400_000)
    : 999;

  const updates: PublicProfileUpdate = {
    last_active_at: lastActivity ?? undefined,
  };

  if (xpData) {
    updates.level = xpData.level ?? 1;
    updates.total_xp = xpData.total_xp ?? 0;
    updates.title = xpData.title ?? 'Newcomer';
  }

  // Only update if profile exists (don't force-create it)
  const existing = await getPublicProfile(userId);
  if (!existing) return;

  await supabase
    .from('public_profiles')
    .update({
      ...updates,
      last_active_at: daysSinceActive < 999 ? lastActivity : existing.last_active_at,
    })
    .eq('user_id', userId);
}

/** Sync ladder class from goal_categories or user_profiles.primary_focus */
export async function syncProfileLadder(userId: string): Promise<void> {
  const existing = await getPublicProfile(userId);
  if (!existing) return;

  // Try to infer ladder from goal_categories first
  let ladder: LadderKey | null = null;
  if (existing.goal_categories && existing.goal_categories.length > 0) {
    ladder = inferLadderFromCategories(existing.goal_categories);
  }

  // Fall back to user_profiles.primary_focus
  if (!ladder) {
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('primary_focus')
      .eq('user_id', userId)
      .maybeSingle();

    if (userProfile?.primary_focus) {
      ladder = inferLadderFromCategories([userProfile.primary_focus]);
    }
  }

  if (!ladder) return; // Not enough signal yet

  const level = existing.level ?? 1;
  const ladderRank = getLadderRank(ladder, level);

  await supabase
    .from('public_profiles')
    .update({ ladder, ladder_rank: ladderRank })
    .eq('user_id', userId);
}

/** Update the ladder_rank whenever level changes */
export async function updateLadderRank(userId: string, level: number): Promise<void> {
  const existing = await getPublicProfile(userId);
  if (!existing?.ladder) return;

  const ladderRank = getLadderRank(existing.ladder as LadderKey, level);

  await supabase
    .from('public_profiles')
    .update({ level, ladder_rank: ladderRank })
    .eq('user_id', userId);
}
