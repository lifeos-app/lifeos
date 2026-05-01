/**
 * Family Store — Zustand + Persist
 *
 * Central store for Family Circles with offline-first persistence.
 * Manages circle lifecycle, membership, shared goals/habits/budgets,
 * achievements, and per-circle encryption keys.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { genId } from '../utils/date';
import { logger } from '../utils/logger';

// ── Types ────────────────────────────────────────────────────────────

export type MemberRole = 'parent' | 'partner' | 'child' | 'guardian' | 'other';

export type MemberPermission =
  | 'view_budget'
  | 'edit_budget'
  | 'view_goals'
  | 'edit_goals'
  | 'view_habits'
  | 'edit_habits'
  | 'manage_members'
  | 'nudge'
  | 'view_schedule'
  | 'manage_allowance';

export interface FamilyMember {
  id: string;
  name: string;
  avatar: string;
  role: MemberRole;
  joinedAt: string;
  permissions: MemberPermission[];
  streakContribution: number;
}

export interface SharedGoal {
  id: string;
  title: string;
  assignedTo: string[];
  progressByMember: Record<string, number>;
  deadline: string;
  category: 'family' | 'health' | 'finance' | 'education' | 'household';
  createdAt: string;
}

export interface SharedHabit {
  id: string;
  title: string;
  emoji: string;
  assignedTo: string[];
  completionsByMember: Record<string, string[]>; // member ID -> date strings
  frequency: 'daily' | 'weekly';
  createdAt: string;
}

export interface BudgetTransaction {
  id: string;
  amount: number;
  category: string;
  description: string;
  memberId: string;
  date: string;
  isIncome: boolean;
}

export interface SavingsGoal {
  id: string;
  title: string;
  emoji: string;
  target: number;
  current: number;
  deadline?: string;
  contributors: string[];
}

export interface BudgetCategory {
  name: string;
  limit: number;
  spent: number;
  color: string;
}

export interface Allowance {
  memberId: string;
  amount: number;
  frequency: 'weekly' | 'monthly';
  lastGiven: string;
  balance: number;
}

export interface SharedBudget {
  categories: BudgetCategory[];
  transactions: BudgetTransaction[];
  savingsGoals: SavingsGoal[];
  allowances: Allowance[];
  monthlyIncome: number;
}

export interface FamilyAchievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  unlockedAt?: string;
  xpReward: number;
  condition: string; // serialized condition check
}

export interface ActivityEntry {
  id: string;
  circleId: string;
  memberId: string;
  memberName: string;
  type: 'habit' | 'goal' | 'budget' | 'nudge' | 'achievement' | 'member';
  description: string;
  timestamp: string;
}

export interface FamilyCircle {
  id: string;
  name: string;
  emoji: string;
  members: FamilyMember[];
  sharedGoals: SharedGoal[];
  sharedHabits: SharedHabit[];
  sharedBudget: SharedBudget;
  inviteCode: string;
  createdAt: string;
  familyStreak: number;
  achievements: FamilyAchievement[];
  encryptionKey: string;
}

// ── Role Permission Defaults ────────────────────────────────────────

const ROLE_PERMISSIONS: Record<MemberRole, MemberPermission[]> = {
  parent: ['view_budget', 'edit_budget', 'view_goals', 'edit_goals', 'view_habits', 'edit_habits', 'manage_members', 'nudge', 'view_schedule', 'manage_allowance'],
  partner: ['view_budget', 'edit_budget', 'view_goals', 'edit_goals', 'view_habits', 'edit_habits', 'manage_members', 'nudge', 'view_schedule'],
  guardian: ['view_budget', 'edit_budget', 'view_goals', 'edit_goals', 'view_habits', 'edit_habits', 'manage_members', 'nudge', 'view_schedule', 'manage_allowance'],
  child: ['view_budget', 'view_goals', 'view_habits', 'edit_habits', 'view_schedule'],
  other: ['view_goals', 'view_habits'],
};

// ── Default Achievements ────────────────────────────────────────────

const DEFAULT_ACHIEVEMENTS: FamilyAchievement[] = [
  {
    id: 'all-on-track',
    title: 'All On Track',
    description: 'Everyone hit their habit targets for 7 days straight!',
    emoji: '🎯',
    xpReward: 200,
    condition: 'streak_7',
  },
  {
    id: 'budget-masters',
    title: 'Budget Masters',
    description: 'Stayed under budget for a full month!',
    emoji: '💰',
    xpReward: 300,
    condition: 'budget_under_month',
  },
  {
    id: 'goal-crushers',
    title: 'Goal Crushers',
    description: 'Completed 5 shared goals together!',
    emoji: '🏆',
    xpReward: 400,
    condition: 'goals_completed_5',
  },
  {
    id: 'streak-family',
    title: 'Streak Family',
    description: '30-day family streak — unstoppable!',
    emoji: '🔥',
    xpReward: 500,
    condition: 'streak_30',
  },
  {
    id: 'first-circle',
    title: 'Family Founded',
    description: 'Created your first Family Circle!',
    emoji: '🏠',
    xpReward: 50,
    condition: 'circle_created',
  },
  {
    id: 'full-house',
    title: 'Full House',
    description: 'Your circle has 4+ members!',
    emoji: '👨‍👩‍👧‍👦',
    xpReward: 100,
    condition: 'members_4',
  },
];

// ── Default Budget ──────────────────────────────────────────────────

const DEFAULT_BUDGET: SharedBudget = {
  categories: [
    { name: 'Groceries', limit: 600, spent: 0, color: '#10B981' },
    { name: 'Dining Out', limit: 300, spent: 0, color: '#F59E0B' },
    { name: 'Transport', limit: 200, spent: 0, color: '#3B82F6' },
    { name: 'Entertainment', limit: 150, spent: 0, color: '#A855F7' },
    { name: 'Healthcare', limit: 300, spent: 0, color: '#EF4444' },
    { name: 'Education', limit: 200, spent: 0, color: '#06B6D4' },
    { name: 'Utilities', limit: 250, spent: 0, color: '#F97316' },
    { name: 'Other', limit: 200, spent: 0, color: '#6B7280' },
  ],
  transactions: [],
  savingsGoals: [],
  allowances: [],
  monthlyIncome: 0,
};

// ── Helpers ─────────────────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generateEncryptionKey(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 32; i++) array[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// ── Store Interface ─────────────────────────────────────────────────

interface FamilyState {
  circles: FamilyCircle[];
  activeCircleId: string | null;
  activityLog: ActivityEntry[];
  isLoaded: boolean;

  // Circle lifecycle
  createCircle: (name: string, emoji: string, creator: Omit<FamilyMember, 'id' | 'joinedAt' | 'permissions' | 'streakContribution'>) => FamilyCircle;
  joinCircle: (inviteCode: string, member: Omit<FamilyMember, 'id' | 'joinedAt' | 'permissions' | 'streakContribution'>) => FamilyCircle | null;
  leaveCircle: (circleId: string) => void;
  setActiveCircle: (circleId: string) => void;

  // Member management
  addMember: (circleId: string, member: Omit<FamilyMember, 'id' | 'joinedAt' | 'permissions' | 'streakContribution'>) => FamilyMember;
  removeMember: (circleId: string, memberId: string) => void;
  updateMemberRole: (circleId: string, memberId: string, role: MemberRole) => void;
  updateMemberPermissions: (circleId: string, memberId: string, permissions: MemberPermission[]) => void;

  // Shared goals
  addSharedGoal: (circleId: string, goal: Omit<SharedGoal, 'id' | 'progressByMember' | 'createdAt'>) => SharedGoal;
  updateGoalProgress: (circleId: string, goalId: string, memberId: string, progress: number) => void;
  removeSharedGoal: (circleId: string, goalId: string) => void;

  // Shared habits
  addSharedHabit: (circleId: string, habit: Omit<SharedHabit, 'id' | 'completionsByMember' | 'createdAt'>) => SharedHabit;
  logHabitCompletion: (circleId: string, habitId: string, memberId: string, date: string) => void;

  // Budget
  addTransaction: (circleId: string, tx: Omit<BudgetTransaction, 'id'>) => void;
  addSavingsGoal: (circleId: string, goal: Omit<SavingsGoal, 'id' | 'current'>) => void;
  contributeToSavings: (circleId: string, goalId: string, amount: number) => void;
  setAllowance: (circleId: string, memberId: string, amount: number, frequency: 'weekly' | 'monthly') => void;
  updateMonthlyIncome: (circleId: string, income: number) => void;

  // Nudge
  nudgeMember: (circleId: string, memberId: string, fromMemberId: string) => void;

  // Achievements
  checkAchievements: (circleId: string) => FamilyAchievement[];

  // Activity
  logActivity: (entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => void;

  // Selectors
  getActiveCircle: () => FamilyCircle | undefined;
  getCircleHealth: (circleId: string) => number; // 0-100
  getFallingBehindMembers: (circleId: string) => { memberId: string; name: string; goalTitle: string; progress: number }[];
}

export const useFamilyStore = create<FamilyState>()(
  persist(
    (set, get) => ({
      circles: [],
      activeCircleId: null,
      activityLog: [],
      isLoaded: false,

      // ── Circle Lifecycle ──────────────────────────────────────

      createCircle: (name, emoji, creator) => {
        const now = new Date().toISOString();
        const creatorMember: FamilyMember = {
          id: genId(),
          name: creator.name,
          avatar: creator.avatar,
          role: creator.role,
          joinedAt: now,
          permissions: [...ROLE_PERMISSIONS[creator.role]],
          streakContribution: 0,
        };
        const circle: FamilyCircle = {
          id: genId(),
          name,
          emoji,
          members: [creatorMember],
          sharedGoals: [],
          sharedHabits: [],
          sharedBudget: { ...DEFAULT_BUDGET, categories: DEFAULT_BUDGET.categories.map(c => ({ ...c })) },
          inviteCode: generateInviteCode(),
          createdAt: now,
          familyStreak: 0,
          achievements: DEFAULT_ACHIEVEMENTS.map(a => ({ ...a })),
          encryptionKey: generateEncryptionKey(),
        };
        set(s => ({
          circles: [circle, ...s.circles],
          activeCircleId: circle.id,
        }));
        get().logActivity({
          circleId: circle.id,
          memberId: creatorMember.id,
          memberName: creatorMember.name,
          type: 'member',
          description: `Created the family circle "${name}"`,
        });
        // Unlock "Family Founded"
        const ach = circle.achievements.find(a => a.condition === 'circle_created');
        if (ach && !ach.unlockedAt) {
          set(s => ({
            circles: s.circles.map(c =>
              c.id === circle.id
                ? { ...c, achievements: c.achievements.map(a => a.id === 'first-circle' ? { ...a, unlockedAt: now } : a) }
                : c
            ),
          }));
        }
        logger.info('[family] Created circle:', circle.id);
        return circle;
      },

      joinCircle: (inviteCode, memberData) => {
        const circle = get().circles.find(c => c.inviteCode === inviteCode);
        if (!circle) return null;
        const now = new Date().toISOString();
        const newMember: FamilyMember = {
          id: genId(),
          name: memberData.name,
          avatar: memberData.avatar,
          role: memberData.role,
          joinedAt: now,
          permissions: [...ROLE_PERMISSIONS[memberData.role]],
          streakContribution: 0,
        };
        set(s => ({
          circles: s.circles.map(c =>
            c.id === circle.id
              ? { ...c, members: [...c.members, newMember] }
              : c
          ),
        }));
        get().logActivity({
          circleId: circle.id,
          memberId: newMember.id,
          memberName: newMember.name,
          type: 'member',
          description: `Joined the family circle!`,
        });
        // Check "Full House"
        get().checkAchievements(circle.id);
        logger.info('[family] Member joined circle:', circle.id, newMember.id);
        return { ...circle, members: [...circle.members, newMember] };
      },

      leaveCircle: (circleId) => {
        set(s => ({
          circles: s.circles.filter(c => c.id !== circleId),
          activeCircleId: s.activeCircleId === circleId ? (s.circles.find(c => c.id !== circleId)?.id ?? null) : s.activeCircleId,
        }));
        logger.info('[family] Left circle:', circleId);
      },

      setActiveCircle: (circleId) => {
        set({ activeCircleId: circleId });
      },

      // ── Member Management ──────────────────────────────────

      addMember: (circleId, memberData) => {
        const now = new Date().toISOString();
        const newMember: FamilyMember = {
          id: genId(),
          name: memberData.name,
          avatar: memberData.avatar,
          role: memberData.role,
          joinedAt: now,
          permissions: [...ROLE_PERMISSIONS[memberData.role]],
          streakContribution: 0,
        };
        set(s => ({
          circles: s.circles.map(c =>
            c.id === circleId
              ? { ...c, members: [...c.members, newMember] }
              : c
          ),
        }));
        get().logActivity({
          circleId,
          memberId: newMember.id,
          memberName: newMember.name,
          type: 'member',
          description: `Was added to the circle`,
        });
        get().checkAchievements(circleId);
        return newMember;
      },

      removeMember: (circleId, memberId) => {
        const circle = get().circles.find(c => c.id === circleId);
        const member = circle?.members.find(m => m.id === memberId);
        set(s => ({
          circles: s.circles.map(c =>
            c.id === circleId
              ? { ...c, members: c.members.filter(m => m.id !== memberId) }
              : c
          ),
        }));
        if (member) {
          get().logActivity({
            circleId,
            memberId,
            memberName: member.name,
            type: 'member',
            description: `Left the circle`,
          });
        }
      },

      updateMemberRole: (circleId, memberId, role) => {
        set(s => ({
          circles: s.circles.map(c =>
            c.id === circleId
              ? {
                  ...c,
                  members: c.members.map(m =>
                    m.id === memberId
                      ? { ...m, role, permissions: [...ROLE_PERMISSIONS[role]] }
                      : m
                  ),
                }
              : c
          ),
        }));
      },

      updateMemberPermissions: (circleId, memberId, permissions) => {
        set(s => ({
          circles: s.circles.map(c =>
            c.id === circleId
              ? { ...c, members: c.members.map(m => m.id === memberId ? { ...m, permissions } : m) }
              : c
          ),
        }));
      },

      // ── Shared Goals ────────────────────────────────────────

      addSharedGoal: (circleId, goalData) => {
        const now = new Date().toISOString();
        const goal: SharedGoal = {
          id: genId(),
          title: goalData.title,
          assignedTo: goalData.assignedTo,
          progressByMember: Object.fromEntries(goalData.assignedTo.map(id => [id, 0])),
          deadline: goalData.deadline,
          category: goalData.category,
          createdAt: now,
        };
        set(s => ({
          circles: s.circles.map(c =>
            c.id === circleId
              ? { ...c, sharedGoals: [...c.sharedGoals, goal] }
              : c
          ),
        }));
        get().logActivity({
          circleId,
          memberId: goal.assignedTo[0] || '',
          memberName: '',
          type: 'goal',
          description: `New shared goal: "${goalData.title}"`,
        });
        return goal;
      },

      updateGoalProgress: (circleId, goalId, memberId, progress) => {
        set(s => ({
          circles: s.circles.map(c =>
            c.id === circleId
              ? {
                  ...c,
                  sharedGoals: c.sharedGoals.map(g =>
                    g.id === goalId
                      ? { ...g, progressByMember: { ...g.progressByMember, [memberId]: Math.min(100, Math.max(0, progress)) } }
                      : g
                  ),
                }
              : c
          ),
        }));
        if (progress === 100) {
          get().checkAchievements(circleId);
        }
      },

      removeSharedGoal: (circleId, goalId) => {
        set(s => ({
          circles: s.circles.map(c =>
            c.id === circleId
              ? { ...c, sharedGoals: c.sharedGoals.filter(g => g.id !== goalId) }
              : c
          ),
        }));
      },

      // ── Shared Habits ────────────────────────────────────────

      addSharedHabit: (circleId, habitData) => {
        const now = new Date().toISOString();
        const habit: SharedHabit = {
          id: genId(),
          title: habitData.title,
          emoji: habitData.emoji,
          assignedTo: habitData.assignedTo,
          completionsByMember: Object.fromEntries(habitData.assignedTo.map(id => [id, []])),
          frequency: habitData.frequency,
          createdAt: now,
        };
        set(s => ({
          circles: s.circles.map(c =>
            c.id === circleId
              ? { ...c, sharedHabits: [...c.sharedHabits, habit] }
              : c
          ),
        }));
        return habit;
      },

      logHabitCompletion: (circleId, habitId, memberId, date) => {
        set(s => ({
          circles: s.circles.map(c => {
            if (c.id !== circleId) return c;
            return {
              ...c,
              sharedHabits: c.sharedHabits.map(h => {
                if (h.id !== habitId) return h;
                const existing = h.completionsByMember[memberId] || [];
                if (existing.includes(date)) return h;
                return {
                  ...h,
                  completionsByMember: {
                    ...h.completionsByMember,
                    [memberId]: [...existing, date],
                  },
                };
              }),
            };
          }),
        }));
        const circle = get().circles.find(c => c.id === circleId);
        const habit = circle?.sharedHabits.find(h => h.id === habitId);
        const member = circle?.members.find(m => m.id === memberId);
        get().logActivity({
          circleId,
          memberId,
          memberName: member?.name || 'Unknown',
          type: 'habit',
          description: `Completed "${habit?.emoji || ''} ${habit?.title || ''}"`,
        });
        get().checkAchievements(circleId);
      },

      // ── Budget ───────────────────────────────────────────────

      addTransaction: (circleId, txData) => {
        const tx: BudgetTransaction = { id: genId(), ...txData };
        set(s => ({
          circles: s.circles.map(c => {
            if (c.id !== circleId) return c;
            const categories = c.sharedBudget.categories.map(cat =>
              cat.name === tx.category
                ? { ...cat, spent: cat.spent + (tx.isIncome ? 0 : tx.amount) }
                : cat
            );
            return {
              ...c,
              sharedBudget: {
                ...c.sharedBudget,
                categories,
                transactions: [tx, ...c.sharedBudget.transactions],
              },
            };
          }),
        }));
        const member = get().circles.find(c => c.id === circleId)?.members.find(m => m.id === tx.memberId);
        get().logActivity({
          circleId,
          memberId: tx.memberId,
          memberName: member?.name || 'Unknown',
          type: 'budget',
          description: `${tx.isIncome ? 'Received' : 'Spent'} $${tx.amount.toFixed(2)} on ${tx.category}`,
        });
      },

      addSavingsGoal: (circleId, goalData) => {
        const goal: SavingsGoal = { id: genId(), current: 0, ...goalData };
        set(s => ({
          circles: s.circles.map(c =>
            c.id === circleId
              ? { ...c, sharedBudget: { ...c.sharedBudget, savingsGoals: [...c.sharedBudget.savingsGoals, goal] } }
              : c
          ),
        }));
      },

      contributeToSavings: (circleId, goalId, amount) => {
        set(s => ({
          circles: s.circles.map(c => {
            if (c.id !== circleId) return c;
            return {
              ...c,
              sharedBudget: {
                ...c.sharedBudget,
                savingsGoals: c.sharedBudget.savingsGoals.map(g =>
                  g.id === goalId ? { ...g, current: Math.min(g.target, g.current + amount) } : g
                ),
              },
            };
          }),
        }));
      },

      setAllowance: (circleId, memberId, amount, frequency) => {
        set(s => ({
          circles: s.circles.map(c => {
            if (c.id !== circleId) return c;
            const existing = c.sharedBudget.allowances.find(a => a.memberId === memberId);
            const newAllowance: Allowance = {
              memberId,
              amount,
              frequency,
              lastGiven: existing?.lastGiven || new Date().toISOString(),
              balance: existing?.balance ?? amount,
            };
            return {
              ...c,
              sharedBudget: {
                ...c.sharedBudget,
                allowances: existing
                  ? c.sharedBudget.allowances.map(a => a.memberId === memberId ? newAllowance : a)
                  : [...c.sharedBudget.allowances, newAllowance],
              },
            };
          }),
        }));
      },

      updateMonthlyIncome: (circleId, income) => {
        set(s => ({
          circles: s.circles.map(c =>
            c.id === circleId
              ? { ...c, sharedBudget: { ...c.sharedBudget, monthlyIncome: income } }
              : c
          ),
        }));
      },

      // ── Nudge ────────────────────────────────────────────────

      nudgeMember: (circleId, memberId, fromMemberId) => {
        const circle = get().circles.find(c => c.id === circleId);
        const member = circle?.members.find(m => m.id === memberId);
        const from = circle?.members.find(m => m.id === fromMemberId);
        get().logActivity({
          circleId,
          memberId: fromMemberId,
          memberName: from?.name || 'Someone',
          type: 'nudge',
          description: `Nudged ${member?.name || 'a member'} 💕`,
        });
      },

      // ── Achievements ─────────────────────────────────────────

      checkAchievements: (circleId) => {
        const circle = get().circles.find(c => c.id === circleId);
        if (!circle) return [];
        const now = new Date().toISOString();
        const newlyUnlocked: FamilyAchievement[] = [];
        let updated = false;

        const newAchievements = circle.achievements.map(a => {
          if (a.unlockedAt) return a;
          let shouldUnlock = false;

          switch (a.condition) {
            case 'circle_created':
              shouldUnlock = true;
              break;
            case 'members_4':
              shouldUnlock = circle.members.length >= 4;
              break;
            case 'streak_7':
              shouldUnlock = circle.familyStreak >= 7;
              break;
            case 'streak_30':
              shouldUnlock = circle.familyStreak >= 30;
              break;
            case 'goals_completed_5': {
              const completed = circle.sharedGoals.filter(g =>
                g.assignedTo.every(id => (g.progressByMember[id] ?? 0) >= 100)
              ).length;
              shouldUnlock = completed >= 5;
              break;
            }
            case 'budget_under_month': {
              const totalSpent = circle.sharedBudget.categories.reduce((sum, c) => sum + c.spent, 0);
              const totalLimit = circle.sharedBudget.categories.reduce((sum, c) => sum + c.limit, 0);
              shouldUnlock = totalLimit > 0 && totalSpent <= totalLimit;
              break;
            }
          }

          if (shouldUnlock) {
            updated = true;
            newlyUnlocked.push({ ...a, unlockedAt: now });
            return { ...a, unlockedAt: now };
          }
          return a;
        });

        if (updated) {
          set(s => ({
            circles: s.circles.map(c =>
              c.id === circleId
                ? { ...c, achievements: newAchievements }
                : c
            ),
          }));
          newlyUnlocked.forEach(a => {
            get().logActivity({
              circleId,
              memberId: '',
              memberName: 'Family',
              type: 'achievement',
              description: `Unlocked "${a.emoji} ${a.title}"! +${a.xpReward} XP`,
            });
          });
        }

        return newlyUnlocked;
      },

      // ── Activity ─────────────────────────────────────────────

      logActivity: (entry) => {
        const fullEntry: ActivityEntry = {
          id: genId(),
          ...entry,
          timestamp: new Date().toISOString(),
        };
        set(s => ({
          activityLog: [fullEntry, ...s.activityLog].slice(0, 200),
        }));
      },

      // ── Selectors ───────────────────────────────────────────

      getActiveCircle: () => {
        const { circles, activeCircleId } = get();
        return circles.find(c => c.id === activeCircleId);
      },

      getCircleHealth: (circleId) => {
        const circle = get().circles.find(c => c.id === circleId);
        if (!circle || circle.members.length === 0) return 0;

        // Health based on: streak contribution, goal progress, habit completion
        let score = 0;
        let factors = 0;

        // Family streak factor (max 25)
        score += Math.min(25, circle.familyStreak * 2.5);
        factors++;

        // Goal completion factor (max 25)
        if (circle.sharedGoals.length > 0) {
          const avgGoalProgress = circle.sharedGoals.reduce((sum, g) => {
            const memberProgs = g.assignedTo.map(id => g.progressByMember[id] ?? 0);
            const avg = memberProgs.length > 0 ? memberProgs.reduce((a, b) => a + b, 0) / memberProgs.length : 0;
            return sum + avg;
          }, 0) / circle.sharedGoals.length;
          score += (avgGoalProgress / 100) * 25;
          factors++;
        }

        // Habit completion factor (max 25)
        if (circle.sharedHabits.length > 0) {
          const today = new Date().toISOString().split('T')[0];
          const habitedToday = circle.sharedHabits.filter(h =>
            h.assignedTo.some(id => (h.completionsByMember[id] || []).includes(today))
          ).length;
          const totalAssignments = circle.sharedHabits.reduce((sum, h) => sum + h.assignedTo.length, 0);
          score += totalAssignments > 0 ? (habitedToday / circle.sharedHabits.length) * 25 : 0;
          factors++;
        }

        // Budget health factor (max 25)
        const totalLimit = circle.sharedBudget.categories.reduce((s, c) => s + c.limit, 0);
        const totalSpent = circle.sharedBudget.categories.reduce((s, c) => s + c.spent, 0);
        if (totalLimit > 0) {
          const budgetRatio = Math.max(0, 1 - totalSpent / totalLimit);
          score += budgetRatio * 25;
          factors++;
        }

        return Math.round(Math.min(100, score));
      },

      getFallingBehindMembers: (circleId) => {
        const circle = get().circles.find(c => c.id === circleId);
        if (!circle) return [];

        const behind: { memberId: string; name: string; goalTitle: string; progress: number }[] = [];
        circle.sharedGoals.forEach(goal => {
          goal.assignedTo.forEach(memberId => {
            const progress = goal.progressByMember[memberId] ?? 0;
            const others = goal.assignedTo
              .filter(id => id !== memberId)
              .map(id => goal.progressByMember[id] ?? 0);
            const avgOthers = others.length > 0 ? others.reduce((a, b) => a + b, 0) / others.length : 0;
            if (progress < avgOthers - 20 && progress < 80) {
              const member = circle.members.find(m => m.id === memberId);
              behind.push({
                memberId,
                name: member?.name || 'Unknown',
                goalTitle: goal.title,
                progress,
              });
            }
          });
        });
        return behind;
      },
    }),
    {
      name: 'lifeos-family-store',
      onRehydrateStorage: () => (state) => {
        if (state) state.isLoaded = true;
        logger.info('[family] Store rehydrated');
      },
    }
  )
);