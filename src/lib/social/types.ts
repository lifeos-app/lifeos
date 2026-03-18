// LifeOS Social Layer — Shared TypeScript Types

import type { LadderKey } from '../gamification/ladder';

export interface PublicProfile {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  level: number;
  title: string;
  total_xp: number;
  current_streak: number;
  featured_goal: string | null;
  featured_badges: string[];
  show_goals: boolean;
  show_habits: boolean;
  show_stats: boolean;
  show_streak: boolean;
  show_level: boolean;
  goal_categories: string[];
  looking_for_partner: boolean;
  last_active_at: string;
  // v2 additions
  ladder: LadderKey | null;
  ladder_rank: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PublicProfileUpdate = Partial<Omit<PublicProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export interface PartnershipStatus {
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
}

export interface Partnership {
  id: string;
  requester_id: string;
  responder_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  connection_type: 'friend' | 'accountability_partner';
  message: string | null;
  blocked_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Convenience alias for pending friend/partner requests */
export type ConnectionRequest = Partnership & { partner_profile: PublicProfile | null };

export interface PartnerWithProfile extends Partnership {
  partner_profile: PublicProfile | null;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  group_id: string | null;
  content: string;
  message_type: 'text' | 'achievement' | 'milestone' | 'nudge' | 'system';
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface ConversationPreview {
  partner_id: string;
  partner_profile: PublicProfile | null;
  last_message: Message | null;
  unread_count: number;
}

export interface GroupConversationPreview {
  group: GoalGroup;
  last_message: Message | null;
  unread_count: number;
}

export interface GuildObjective {
  title: string;
  target_value: number;
  unit: string;
  deadline?: string;
}

export interface GoalGroup {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string;
  member_count: number;
  created_by: string;
  created_at: string;
  objective?: GuildObjective | null;
}

export interface GuildContribution {
  id: string;
  guild_id: string;
  user_id: string;
  amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuildMemberWithContribution {
  user_id: string;
  profile: PublicProfile | null;
  total_contribution: number;
  last_contribution: string | null;
}

export interface GoalGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'member' | 'admin' | 'owner';
  joined_at: string;
}

export interface Nudge {
  id: string;
  sender_id: string;
  receiver_id: string;
  nudge_type: 'encourage' | 'challenge' | 'celebrate';
  message: string | null;
  created_at: string;
}

export interface MatchResult {
  profile: PublicProfile;
  score: number;
  shared_categories: string[];
}

export type GoalCategory =
  | 'fitness'
  | 'business'
  | 'education'
  | 'health'
  | 'creative'
  | 'finance'
  | 'spiritual'
  | 'social';

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, { label: string; icon: string; lucideIcon: string; color: string }> = {
  fitness:   { label: 'Fitness',   icon: 'fitness',   lucideIcon: 'Dumbbell',    color: '#F43F5E' },
  business:  { label: 'Business',  icon: 'business',  lucideIcon: 'Briefcase',   color: '#FACC15' },
  education: { label: 'Education', icon: 'education', lucideIcon: 'BookOpen',    color: '#A855F7' },
  health:    { label: 'Health',    icon: 'health',    lucideIcon: 'Heart',       color: '#F43F5E' },
  creative:  { label: 'Creative',  icon: 'creative',  lucideIcon: 'Palette',     color: '#EC4899' },
  finance:   { label: 'Finance',   icon: 'finance',   lucideIcon: 'TrendingUp',  color: '#39FF14' },
  spiritual: { label: 'Spiritual', icon: 'spiritual', lucideIcon: 'Sparkles',    color: '#00D4FF' },
  social:    { label: 'Social',    icon: 'social',    lucideIcon: 'Users',       color: '#06B6D4' },
};

export const ALL_GOAL_CATEGORIES: GoalCategory[] = [
  'fitness', 'business', 'education', 'health', 'creative', 'finance', 'spiritual', 'social',
];

export interface PartnerActivity {
  type: 'quest_complete' | 'achievement' | 'streak' | 'level_up';
  description: string;
  icon: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface GoalComment {
  id: string;
  goal_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_profile?: PublicProfile | null;
}

export interface PartnerGoal {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  progress: number;
  status: string;
  icon: string | null;
  color: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyProgress {
  tasks_completed: number;
  habits_logged: number;
  goals_advanced: number;
  xp_gained: number;
}
