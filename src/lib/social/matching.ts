// LifeOS Social — Partner Matching Algorithm

import { supabase } from '../supabase';
import { searchProfiles } from './profiles';
import type { MatchResult, PublicProfile } from './types';

interface RawProfileWithActivity extends PublicProfile {
  _lastActive?: Date;
}

/** Find best accountability partner matches for a user */
export async function findMatches(userId: string): Promise<MatchResult[]> {
  // Get current user's profile to compare against
  const { data: myProfile } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!myProfile) return [];

  const me = myProfile as PublicProfile;

  // Fetch all other profiles (active in last 30 days)
  const candidates = await searchProfiles({
    active_days: 30,
    exclude_user_id: userId,
  });

  if (candidates.length === 0) return [];

  // Score each candidate
  const scored: MatchResult[] = candidates.map(candidate => {
    let score = 0;
    const sharedCategories: string[] = [];

    // Shared goal categories: +10 each
    const myCategories = new Set(me.goal_categories ?? []);
    (candidate.goal_categories ?? []).forEach(cat => {
      if (myCategories.has(cat)) {
        score += 10;
        sharedCategories.push(cat);
      }
    });

    // Both looking for partner: +20
    if (me.looking_for_partner && candidate.looking_for_partner) {
      score += 20;
    }

    // Similar level range (within 5 levels): +5
    const levelDiff = Math.abs((me.level ?? 1) - (candidate.level ?? 1));
    if (levelDiff <= 5) {
      score += 5;
    }

    // Active in last 7 days: +10
    const lastActive = new Date(candidate.last_active_at ?? 0);
    const daysSinceActive = (Date.now() - lastActive.getTime()) / 86_400_000;
    if (daysSinceActive <= 7) {
      score += 10;
    }

    // Penalty for very large level gap (demotivating)
    if (levelDiff > 20) {
      score -= 5;
    }

    return { profile: candidate, score, shared_categories: sharedCategories };
  });

  // Sort by score descending, return top 50
  return scored
    .filter(m => m.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

/** Find matches by specific goal categories (fast filter) */
export async function findMatchesByCategory(
  userId: string,
  category: string,
): Promise<MatchResult[]> {
  const candidates = await searchProfiles({
    goal_categories: [category],
    active_days: 14,
    exclude_user_id: userId,
  });

  return candidates.map(p => ({
    profile: p,
    score: p.looking_for_partner ? 30 : 10,
    shared_categories: [category],
  }));
}

/** Calculate compatibility score between two profiles (for display) */
export function calcCompatibility(
  profile: RawProfileWithActivity,
  other: RawProfileWithActivity,
): number {
  let score = 0;

  const myCategories = new Set(profile.goal_categories ?? []);
  (other.goal_categories ?? []).forEach(cat => {
    if (myCategories.has(cat)) score += 10;
  });

  if (profile.looking_for_partner && other.looking_for_partner) score += 20;

  const levelDiff = Math.abs((profile.level ?? 1) - (other.level ?? 1));
  if (levelDiff <= 5) score += 5;

  const lastActive = other._lastActive ?? new Date(other.last_active_at ?? 0);
  const daysSince = (Date.now() - lastActive.getTime()) / 86_400_000;
  if (daysSince <= 7) score += 10;

  return score;
}
