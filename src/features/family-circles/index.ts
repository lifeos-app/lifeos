/**
 * Family Circles — Barrel Export
 *
 * Private family groups with shared goals, encrypted data sync,
 * and collaborative features. Shared habit tracking, family budget,
 * partner schedules, kids' chores — all synced in real-time.
 */

export { FamilyCircles } from './FamilyCircles';
export { CircleDashboard } from './CircleDashboard';
export { SharedGoalsPanel } from './SharedGoalsPanel';
export { SharedBudgetPanel } from './SharedBudgetPanel';
export { MemberManager } from './MemberManager';
export { FamilyAchievements } from './FamilyAchievements';
export { useFamilyCircles } from './useFamilyCircles';
export type {
  FamilyMember,
  FamilyCircle,
  SharedGoal,
  SharedHabit,
  SharedBudget,
  BudgetTransaction,
  SavingsGoal,
  FamilyAchievement,
  ActivityEntry,
  MemberRole,
  MemberPermission,
} from '../../stores/familyStore';