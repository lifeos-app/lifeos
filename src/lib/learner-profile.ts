/**
 * learner-profile.ts — Learner Profile Builder for Academy 2.0
 *
 * Computes session-derived learner attributes: average study duration,
 * preferred study time, weekly completion rate.
 * Persists to local-db (learner_profile table).
 */

import { localInsert, localUpdate, localGetAll } from './local-db';
import { genId } from '../utils/date';

// ── Types (inline) ──

interface StudySession2 {
  id: string;
  userId: string;
  learningGoalId: string;
  lessonId: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  completed: boolean;
  [key: string]: unknown;
}

interface LearningGoal {
  id: string;
  userId: string;
  topic: string;
  domain: string;
  weeklyTargetLessons: number;
  lessonsCompletedThisWeek: number;
  lessonsScheduledThisWeek: number;
  lastPacingEvalDate: string | null;
  pacingStatus: string;
  [key: string]: unknown;
}

export interface LearnerProfile {
  id: string;
  userId: string;
  averageSessionMinutes: number;
  completionRateWeekly: number;
  preferredStudyTime: 'morning' | 'afternoon' | 'evening' | 'night';
  totalSessions: number;
  updatedAt: string;
}

// ── Helpers ──

function getHourBucket(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

// ── Public API ──

/**
 * Build a learner profile from recent study sessions and goals.
 */
export async function buildLearnerProfile(
  userId: string,
  sessions: StudySession2[],
  goals: LearningGoal[],
): Promise<LearnerProfile> {
  // Use last 30 sessions for averages
  const recentSessions = sessions
    .filter(s => s.userId === userId)
    .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))
    .slice(0, 30);

  // Average session duration
  const avgMinutes = recentSessions.length > 0
    ? recentSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / recentSessions.length
    : 30;

  // Weekly completion rate from goals
  const activeGoals = goals.filter(g => (g as Record<string, unknown>).userId === userId);
  let completionRate = 0;
  if (activeGoals.length > 0) {
    const rates = activeGoals.map(g => {
      const scheduled = Math.max(g.lessonsScheduledThisWeek, 1);
      return g.lessonsCompletedThisWeek / scheduled;
    });
    completionRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
  }

  // Preferred study time from session start hours
  const hourCounts: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const s of recentSessions) {
    if (s.startedAt) {
      const hour = new Date(s.startedAt).getHours();
      hourCounts[getHourBucket(hour)]++;
    }
  }
  const preferredTime = (Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'morning') as LearnerProfile['preferredStudyTime'];

  const now = new Date().toISOString();

  const profile: LearnerProfile = {
    id: '', // set below
    userId,
    averageSessionMinutes: Math.round(avgMinutes),
    completionRateWeekly: Math.round(completionRate * 100) / 100,
    preferredStudyTime: preferredTime,
    totalSessions: sessions.filter(s => s.userId === userId).length,
    updatedAt: now,
  };

  // Save
  await saveProfile(profile);

  return profile;
}

/**
 * Save or update a learner profile in local DB.
 */
export async function saveProfile(profile: LearnerProfile): Promise<void> {
  try {
    const existing = await loadProfile(profile.userId);
    if (existing) {
      await localUpdate('learner_profile', existing.id, {
        averageSessionMinutes: profile.averageSessionMinutes,
        completionRateWeekly: profile.completionRateWeekly,
        preferredStudyTime: profile.preferredStudyTime,
        totalSessions: profile.totalSessions,
        updatedAt: profile.updatedAt,
      });
      profile.id = existing.id;
    } else {
      const id = genId();
      profile.id = id;
      await localInsert('learner_profile', {
        id,
        user_id: profile.userId,
        ...profile,
      });
    }
  } catch {
    // Silently fail — profile is enhancement, not critical
  }
}

/**
 * Load a learner profile from local DB.
 */
export async function loadProfile(userId: string): Promise<LearnerProfile | null> {
  try {
    const all = await localGetAll<LearnerProfile & { user_id?: string }>('learner_profile');
    return all.find(p => p.userId === userId || p.user_id === userId) ?? null;
  } catch {
    return null;
  }
}
