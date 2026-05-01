/**
 * Mentorship Store — Zustand with persist middleware
 *
 * Manages mentorship pairs, milestones, matching, and XP rewards.
 * Offline-first with localStorage persistence.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { genId } from '../utils/date';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export interface MentorshipMilestone {
  id: string;
  title: string;
  description: string;
  targetDays: number;
  completed: boolean;
  completedAt?: string;
  xpReward: number;
}

export interface MentorshipPair {
  id: string;
  mentor_id: string;
  mentee_id: string;
  status: 'pending' | 'active' | 'paused' | 'completed' | 'ended';
  created_at: string;
  milestones: MentorshipMilestone[];
  sessions_completed: number;
  mentee_progress: number; // 0-100%
  mentor_rating: number; // 1-5 from mentee
  specializations: string[]; // habits, goals, health, finance, etc.
  mentor_notes?: string;
  mentee_goals?: string[];
}

export interface MentorProfile {
  userId: string;
  username: string;
  level: number;
  specializations: string[];
  menteeCount: number; // current active
  maxMentees: number;
  rating: number;
  ratingCount: number;
  availability: 'available' | 'limited' | 'full';
  bio: string;
  completedMentorships: number;
  lastActive: string;
}

export interface MenteeProfile {
  userId: string;
  username: string;
  level: number;
  goals: string[];
  areasNeedingHelp: string[];
  preferredSpecializations: string[];
  bio: string;
  createdAt: string;
}

// ═══════════════════════════════════════════════════
// DEFAULT MILESTONES
// ═══════════════════════════════════════════════════

const DEFAULT_MILESTONES: Omit<MentorshipMilestone, 'id' | 'completed' | 'completedAt'>[] = [
  {
    title: 'First Check-in',
    description: 'Complete your first mentoring session together',
    targetDays: 2,
    xpReward: 15,
  },
  {
    title: '7-Day Streak Together',
    description: 'Both maintain activity for 7 consecutive days',
    targetDays: 7,
    xpReward: 30,
  },
  {
    title: 'Goal Achievement',
    description: 'Mentee completes a goal set at the start of mentorship',
    targetDays: 14,
    xpReward: 50,
  },
  {
    title: 'Level Up Together',
    description: 'Mentee gains enough XP to level up',
    targetDays: 21,
    xpReward: 40,
  },
  {
    title: 'Graduation',
    description: 'Complete 30 days of mentorship and graduate',
    targetDays: 30,
    xpReward: 75,
  },
];

// ═══════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════

const DEMO_MENTORS: MentorProfile[] = [
  {
    userId: 'mentor-1',
    username: 'DragonSlayer',
    level: 25,
    specializations: ['habits', 'goals', 'discipline'],
    menteeCount: 2,
    maxMentees: 3,
    rating: 4.8,
    ratingCount: 12,
    availability: 'limited',
    bio: 'LifeOS veteran since day 1. I love helping new adventurers find their footing. Consistency is key!',
    completedMentorships: 5,
    lastActive: new Date().toISOString(),
  },
  {
    userId: 'mentor-2',
    username: 'MindfulMaster',
    level: 18,
    specializations: ['health', 'habits', 'meditation'],
    menteeCount: 1,
    maxMentees: 3,
    rating: 4.9,
    ratingCount: 8,
    availability: 'available',
    bio: 'Health and wellness enthusiast. Let me help you build sustainable habits that last.',
    completedMentorships: 3,
    lastActive: new Date().toISOString(),
  },
  {
    userId: 'mentor-3',
    username: 'CoinKeeper',
    level: 22,
    specializations: ['finance', 'goals', 'planning'],
    menteeCount: 0,
    maxMentees: 3,
    rating: 4.6,
    ratingCount: 6,
    availability: 'available',
    bio: 'Financial planning nerd. I can help you set budgets, track expenses, and reach your savings goals.',
    completedMentorships: 2,
    lastActive: new Date().toISOString(),
  },
  {
    userId: 'mentor-4',
    username: 'QuestLeader',
    level: 30,
    specializations: ['goals', 'habits', 'productivity', 'finance'],
    menteeCount: 3,
    maxMentees: 3,
    rating: 4.7,
    ratingCount: 15,
    availability: 'full',
    bio: 'Max-level achiever. My mentorships are structured, goal-oriented, and fun. Currently full but check back!',
    completedMentorships: 7,
    lastActive: new Date().toISOString(),
  },
  {
    userId: 'mentor-5',
    username: 'StreakQueen',
    level: 15,
    specializations: ['habits', 'health', 'discipline'],
    menteeCount: 1,
    maxMentees: 3,
    rating: 4.5,
    ratingCount: 4,
    availability: 'available',
    bio: 'I turned my life around with daily habits. Let me help you do the same!',
    completedMentorships: 1,
    lastActive: new Date().toISOString(),
  },
];

// ═══════════════════════════════════════════════════
// STORE INTERFACE
// ═══════════════════════════════════════════════════

interface MentorshipState {
  pairs: MentorshipPair[];
  mentorProfiles: MentorProfile[];
  menteeProfiles: MenteeProfile[];
  currentUserId: string;
  isMentor: boolean; // has registered as a mentor
  applications: { mentorId: string; menteeId: string; status: 'pending' | 'accepted' | 'rejected'; message: string; created_at: string }[];
}

interface MentorshipActions {
  // Pair management
  createPair: (mentorId: string, menteeId: string, specializations: string[], menteeGoals?: string[]) => MentorshipPair;
  acceptPair: (pairId: string) => void;
  rejectPair: (pairId: string) => void;
  pausePair: (pairId: string) => void;
  resumePair: (pairId: string) => void;
  completePair: (pairId: string) => void;
  endPair: (pairId: string) => void;

  // Milestone management
  completeMilestone: (pairId: string, milestoneId: string) => void;
  checkMilestoneProgress: (pairId: string) => void;

  // Mentor profile
  registerAsMentor: (profile: Omit<MentorProfile, 'userId' | 'menteeCount' | 'ratingCount' | 'lastActive' | 'completedMentorships'>) => void;
  updateMentorProfile: (updates: Partial<MentorProfile>) => void;

  // Mentee profile
  registerAsMentee: (profile: Omit<MenteeProfile, 'userId' | 'createdAt'>) => void;

  // Applications
  applyToMentor: (mentorId: string, message: string) => void;
  acceptApplication: (applicationId: string) => void;
  rejectApplication: (applicationId: string) => void;

  // Rating
  rateMentor: (pairId: string, rating: number) => void;

  // Notes
  updateMentorNotes: (pairId: string, notes: string) => void;

  // XP awarding (calls into xp engine)
  awardMilestoneXP: (pairId: string, milestoneId: string) => number;

  // Matching
  calculateCompatibility: (mentorId: string, menteeId: string) => { score: number; reasons: string[] };
  getRecommendedMentors: (menteeId: string) => { mentor: MentorProfile; score: number; reasons: string[] }[];

  // Helpers
  getActivePairsForUser: (userId: string) => MentorshipPair[];
  getMentorProfile: (userId: string) => MentorProfile | undefined;
  getMenteeProfile: (userId: string) => MenteeProfile | undefined;
}

// ═══════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════

export const useMentorshipStore = create<MentorshipState & MentorshipActions>()(
  persist(
    (set, get) => ({
      pairs: [],
      mentorProfiles: DEMO_MENTORS,
      menteeProfiles: [],
      currentUserId: 'current-user',
      isMentor: false,
      applications: [],

      createPair: (mentorId, menteeId, specializations, menteeGoals) => {
        const pair: MentorshipPair = {
          id: genId('mp-'),
          mentor_id: mentorId,
          mentee_id: menteeId,
          status: 'pending',
          created_at: new Date().toISOString(),
          milestones: DEFAULT_MILESTONES.map(m => ({
            ...m,
            id: genId('ms-'),
            completed: false,
          })),
          sessions_completed: 0,
          mentee_progress: 0,
          mentor_rating: 0,
          specializations,
          mentee_goals: menteeGoals,
        };
        set(s => ({ pairs: [...s.pairs, pair] }));
        return pair;
      },

      acceptPair: (pairId) => {
        set(s => ({
          pairs: s.pairs.map(p => p.id === pairId ? { ...p, status: 'active' as const } : p),
        }));
      },

      rejectPair: (pairId) => {
        set(s => ({
          pairs: s.pairs.map(p => p.id === pairId ? { ...p, status: 'ended' as const } : p),
        }));
      },

      pausePair: (pairId) => {
        set(s => ({
          pairs: s.pairs.map(p => p.id === pairId ? { ...p, status: 'paused' as const } : p),
        }));
      },

      resumePair: (pairId) => {
        set(s => ({
          pairs: s.pairs.map(p => p.id === pairId ? { ...p, status: 'active' as const } : p),
        }));
      },

      completePair: (pairId) => {
        set(s => ({
          pairs: s.pairs.map(p => p.id === pairId ? { ...p, status: 'completed' as const, mentee_progress: 100 } : p),
        }));
      },

      endPair: (pairId) => {
        set(s => ({
          pairs: s.pairs.map(p => p.id === pairId ? { ...p, status: 'ended' as const } : p),
        }));
      },

      completeMilestone: (pairId, milestoneId) => {
        set(s => ({
          pairs: s.pairs.map(p => {
            if (p.id !== pairId) return p;
            const milestones = p.milestones.map(m =>
              m.id === milestoneId ? { ...m, completed: true, completedAt: new Date().toISOString() } : m
            );
            const completedCount = milestones.filter(m => m.completed).length;
            const progress = Math.round((completedCount / milestones.length) * 100);
            return { ...p, milestones, mentee_progress: progress };
          }),
        }));
      },

      checkMilestoneProgress: (pairId) => {
        // Auto-check milestone progress would integrate with habit/goal/XP stores
        // For now, this is a placeholder for future integration
        const pair = get().pairs.find(p => p.id === pairId);
        if (!pair) return;
        logger.info('[mentorship] Checking milestone progress for pair', pairId);
      },

      registerAsMentor: (profile) => {
        const state = get();
        const newProfile: MentorProfile = {
          ...profile,
          userId: state.currentUserId,
          menteeCount: 0,
          ratingCount: 0,
          lastActive: new Date().toISOString(),
          completedMentorships: 0,
        };
        set(s => ({
          mentorProfiles: [...s.mentorProfiles, newProfile],
          isMentor: true,
        }));
      },

      updateMentorProfile: (updates) => {
        set(s => ({
          mentorProfiles: s.mentorProfiles.map(m =>
            m.userId === s.currentUserId ? { ...m, ...updates } : m
          ),
        }));
      },

      registerAsMentee: (profile) => {
        const state = get();
        const newProfile: MenteeProfile = {
          ...profile,
          userId: state.currentUserId,
          createdAt: new Date().toISOString(),
        };
        set(s => ({
          menteeProfiles: [...s.menteeProfiles, newProfile],
        }));
      },

      applyToMentor: (mentorId, message) => {
        const state = get();
        const application = {
          mentorId,
          menteeId: state.currentUserId,
          status: 'pending' as const,
          message,
          created_at: new Date().toISOString(),
        };
        set(s => ({ applications: [...s.applications, application] }));
      },

      acceptApplication: (applicationId) => {
        set(s => ({
          applications: s.applications.map(a =>
            a.mentorId + a.menteeId === applicationId ? { ...a, status: 'accepted' as const } : a
          ),
        }));
      },

      rejectApplication: (applicationId) => {
        set(s => ({
          applications: s.applications.map(a =>
            a.mentorId + a.menteeId === applicationId ? { ...a, status: 'rejected' as const } : a
          ),
        }));
      },

      rateMentor: (pairId, rating) => {
        set(s => ({
          pairs: s.pairs.map(p => p.id === pairId ? { ...p, mentor_rating: Math.min(5, Math.max(1, rating)) } : p),
        }));
      },

      updateMentorNotes: (pairId, notes) => {
        set(s => ({
          pairs: s.pairs.map(p => p.id === pairId ? { ...p, mentor_notes: notes } : p),
        }));
      },

      awardMilestoneXP: (pairId, milestoneId) => {
        const pair = get().pairs.find(p => p.id === pairId);
        if (!pair) return 0;
        const milestone = pair.milestones.find(m => m.id === milestoneId);
        if (!milestone) return 0;
        // XP is awarded to both mentor and mentee
        const totalXP = milestone.xpReward * 2;
        logger.info(`[mentorship] Awarding ${milestone.xpReward} XP each to mentor and mentee for milestone: ${milestone.title}`);
        // In a real integration, this would call the XP engine
        return totalXP;
      },

      calculateCompatibility: (mentorId, menteeId) => {
        const mentor = get().mentorProfiles.find(m => m.userId === mentorId);
        const mentee = get().menteeProfiles.find(m => m.userId === menteeId);
        if (!mentor || !mentee) return { score: 0, reasons: [] };

        let score = 0;
        const reasons: string[] = [];

        // Goal category overlap (0-40 points)
        const overlap = mentor.specializations.filter(s => mentee.preferredSpecializations.includes(s));
        if (overlap.length > 0) {
          score += Math.min(40, overlap.length * 15);
          reasons.push(`${overlap.length} matching specializations: ${overlap.join(', ')}`);
        }

        // Level gap (0-30 points, ideal is 5-15)
        const levelGap = Math.abs(mentor.level - mentee.level);
        if (levelGap >= 5 && levelGap <= 15) {
          score += 30;
          reasons.push('Ideal level gap for mentorship');
        } else if (levelGap > 15 && levelGap <= 25) {
          score += 15;
          reasons.push('Moderate level gap');
        } else if (levelGap < 5) {
          score += 5;
          reasons.push('Small level gap — may need more experience difference');
        }

        // Rating (0-20 points)
        if (mentor.rating >= 4.5) {
          score += 20;
          reasons.push(`Excellent mentor rating (${mentor.rating})`);
        } else if (mentor.rating >= 4.0) {
          score += 15;
          reasons.push(`Good mentor rating (${mentor.rating})`);
        }

        // Availability (0-10 points)
        if (mentor.availability === 'available') {
          score += 10;
          reasons.push('Mentor currently available');
        } else if (mentor.availability === 'limited') {
          score += 5;
          reasons.push('Mentor has limited availability');
        }

        return { score: Math.min(100, score), reasons };
      },

      getRecommendedMentors: (menteeId) => {
        const mentors = get().mentorProfiles.filter(m => m.availability !== 'full');
        return mentors
          .map(mentor => {
            const { score, reasons } = get().calculateCompatibility(mentor.userId, menteeId);
            return { mentor, score, reasons };
          })
          .sort((a, b) => b.score - a.score);
      },

      getActivePairsForUser: (userId) => {
        return get().pairs.filter(p =>
          (p.mentor_id === userId || p.mentee_id === userId) &&
          (p.status === 'active' || p.status === 'pending' || p.status === 'paused')
        );
      },

      getMentorProfile: (userId) => {
        return get().mentorProfiles.find(m => m.userId === userId);
      },

      getMenteeProfile: (userId) => {
        return get().menteeProfiles.find(m => m.userId === userId);
      },
    }),
    {
      name: 'lifeos-mentorship',
      partialize: (state) => ({
        pairs: state.pairs,
        mentorProfiles: state.mentorProfiles,
        menteeProfiles: state.menteeProfiles,
        isMentor: state.isMentor,
        applications: state.applications,
        currentUserId: state.currentUserId,
      }),
    }
  )
);