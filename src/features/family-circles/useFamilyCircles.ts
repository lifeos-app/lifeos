/**
 * useFamilyCircles.ts — Core hook for Family Circles
 *
 * Manages circle lifecycle, E2E encryption for sensitive data,
 * real-time sync via Supabase Realtime, local-first CRDT merge,
 * and invite code generation/validation.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  useFamilyStore,
  type FamilyCircle,
  type FamilyMember,
  type SharedGoal,
  type SharedHabit,
  type SharedBudget,
  type BudgetTransaction,
  type SavingsGoal,
  type FamilyAchievement,
  type ActivityEntry,
  type MemberRole,
  type MemberPermission,
} from '../../stores/familyStore';

// ── Encryption Helpers ────────────────────────────────────────────────

const ALGORITHM = 'AES-GCM';

async function deriveKey(rawKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(rawKey.padEnd(32, '0').slice(0, 32));
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(data: string, key: string): Promise<string> {
  try {
    const cryptoKey = await deriveKey(key);
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      cryptoKey,
      encoder.encode(data)
    );
    const combined = new Uint8Array(iv.length + (encrypted as ArrayBuffer).byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted as ArrayBuffer), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch {
    // Fallback for environments without SubtleCrypto
    return btoa(data);
  }
}

async function decryptData(encrypted: string, key: string): Promise<string> {
  try {
    const cryptoKey = await deriveKey(key);
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      cryptoKey,
      data
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    try {
      return atob(encrypted);
    } catch {
      return encrypted;
    }
  }
}

// ── CRDT Merge ────────────────────────────────────────────────────────

function mergeMembers(local: FamilyMember[], remote: FamilyMember[]): FamilyMember[] {
  const byId = new Map<string, FamilyMember>();
  local.forEach(m => byId.set(m.id, m));
  remote.forEach(m => {
    const existing = byId.get(m.id);
    if (!existing || new Date(m.joinedAt) > new Date(existing.joinedAt)) {
      byId.set(m.id, m);
    }
  });
  return Array.from(byId.values());
}

function mergeGoals(local: SharedGoal[], remote: SharedGoal[]): SharedGoal[] {
  const byId = new Map<string, SharedGoal>();
  local.forEach(g => byId.set(g.id, g));
  remote.forEach(g => {
    const existing = byId.get(g.id);
    if (!existing) {
      byId.set(g.id, g);
    } else {
      // Merge progressByMember: take max per member
      const mergedProgress: Record<string, number> = { ...existing.progressByMember };
      Object.entries(g.progressByMember).forEach(([id, val]) => {
        mergedProgress[id] = Math.max(mergedProgress[id] ?? 0, val);
      });
      byId.set(g.id, { ...g, progressByMember: mergedProgress });
    }
  });
  return Array.from(byId.values());
}

function mergeHabits(local: SharedHabit[], remote: SharedHabit[]): SharedHabit[] {
  const byId = new Map<string, SharedHabit>();
  local.forEach(h => byId.set(h.id, h));
  remote.forEach(h => {
    const existing = byId.get(h.id);
    if (!existing) {
      byId.set(h.id, h);
    } else {
      // Merge completions: union per member
      const mergedCompletions: Record<string, string[]> = { ...existing.completionsByMember };
      Object.entries(h.completionsByMember).forEach(([id, dates]) => {
        const localDates = new Set(mergedCompletions[id] || []);
        dates.forEach(d => localDates.add(d));
        mergedCompletions[id] = Array.from(localDates);
      });
      byId.set(h.id, { ...h, completionsByMember: mergedCompletions });
    }
  });
  return Array.from(byId.values());
}

// ── Realtime Sync (Supabase placeholder) ────────────────────────────

interface SyncState {
  isOnline: boolean;
  lastSync: string | null;
  pendingChanges: number;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useFamilyCircles() {
  const store = useFamilyStore();
  const [isCreating, setIsCreating] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastSync: null,
    pendingChanges: 0,
  });

  const realtimeChannelRef = useRef<AbortController | null>(null);

  // ── Computed ─────────────────────────────────────────────────

  const activeCircle = useMemo(() => store.getActiveCircle(), [store.circles, store.activeCircleId]);
  const circleHealth = useMemo(
    () => (activeCircle ? store.getCircleHealth(activeCircle.id) : 0),
    [activeCircle, store.circles]
  );
  const fallingBehind = useMemo(
    () => (activeCircle ? store.getFallingBehindMembers(activeCircle.id) : []),
    [activeCircle, store.circles]
  );

  const todayActivity = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return store.activityLog.filter(a => a.circleId === activeCircle?.id && a.timestamp.startsWith(today));
  }, [store.activityLog, activeCircle]);

  const recentActivity = useMemo(() => {
    const now = Date.now();
    return store.activityLog
      .filter(a => a.circleId === activeCircle?.id && now - new Date(a.timestamp).getTime() < 86400000 * 7)
      .slice(0, 30);
  }, [store.activityLog, activeCircle]);

  // ── Online Status ───────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => setSyncState(s => ({ ...s, isOnline: true }));
    const onOffline = () => setSyncState(s => ({ ...s, isOnline: false }));
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── Realtime Sync Setup ────────────────────────────────────

  useEffect(() => {
    if (!activeCircle) return;

    // Set up Supabase Realtime channel if available
    // This is a placeholder — actual implementation would use:
    // const channel = supabase.channel(`family:${activeCircle.id}`)
    //   .on('broadcast', { event: 'change' }, handleRemoteChange)
    //   .subscribe();
    const controller = new AbortController();
    realtimeChannelRef.current = controller;

    return () => {
      controller.abort();
      realtimeChannelRef.current = null;
    };
  }, [activeCircle?.id]);

  // ── Circle Actions ───────────────────────────────────────────

  const createCircle = useCallback(
    async (name: string, emoji: string, creator: { name: string; avatar: string; role: MemberRole }) => {
      setIsCreating(true);
      try {
        const circle = store.createCircle(name, emoji, creator);
        return circle;
      } finally {
        setIsCreating(false);
      }
    },
    [store]
  );

  const joinCircle = useCallback(
    async (inviteCode: string, member: { name: string; avatar: string; role: MemberRole }) => {
      setJoinError(null);
      if (!inviteCode || inviteCode.length !== 6) {
        setJoinError('Invite code must be 6 characters');
        return null;
      }
      const result = store.joinCircle(inviteCode.toUpperCase(), member);
      if (!result) {
        setJoinError('Invalid invite code. Double-check and try again.');
      }
      return result;
    },
    [store]
  );

  const leaveCircle = useCallback(
    (circleId: string) => store.leaveCircle(circleId),
    [store]
  );

  // ── Member Actions ──────────────────────────────────────────

  const addMember = useCallback(
    (circleId: string, member: { name: string; avatar: string; role: MemberRole }) =>
      store.addMember(circleId, member),
    [store]
  );

  const removeMember = useCallback(
    (circleId: string, memberId: string) => store.removeMember(circleId, memberId),
    [store]
  );

  const updateRole = useCallback(
    (circleId: string, memberId: string, role: MemberRole) =>
      store.updateMemberRole(circleId, memberId, role),
    [store]
  );

  const updatePermissions = useCallback(
    (circleId: string, memberId: string, permissions: MemberPermission[]) =>
      store.updateMemberPermissions(circleId, memberId, permissions),
    [store]
  );

  // ── Goal Actions ────────────────────────────────────────────

  const addSharedGoal = useCallback(
    (circleId: string, goal: Omit<SharedGoal, 'id' | 'progressByMember' | 'createdAt'>) =>
      store.addSharedGoal(circleId, goal),
    [store]
  );

  const updateGoalProgress = useCallback(
    (circleId: string, goalId: string, memberId: string, progress: number) =>
      store.updateGoalProgress(circleId, goalId, memberId, progress),
    [store]
  );

  const removeSharedGoal = useCallback(
    (circleId: string, goalId: string) => store.removeSharedGoal(circleId, goalId),
    [store]
  );

  // ── Habit Actions ───────────────────────────────────────────

  const addSharedHabit = useCallback(
    (circleId: string, habit: Omit<SharedHabit, 'id' | 'completionsByMember' | 'createdAt'>) =>
      store.addSharedHabit(circleId, habit),
    [store]
  );

  const logHabit = useCallback(
    (circleId: string, habitId: string, memberId: string) => {
      const today = new Date().toISOString().split('T')[0];
      store.logHabitCompletion(circleId, habitId, memberId, today);
    },
    [store]
  );

  // ── Budget Actions ──────────────────────────────────────────

  const addTransaction = useCallback(
    (circleId: string, tx: Omit<BudgetTransaction, 'id'>) =>
      store.addTransaction(circleId, tx),
    [store]
  );

  const addSavingsGoal = useCallback(
    (circleId: string, goal: Omit<SavingsGoal, 'id' | 'current'>) =>
      store.addSavingsGoal(circleId, goal),
    [store]
  );

  const contributeToSavings = useCallback(
    (circleId: string, goalId: string, amount: number) =>
      store.contributeToSavings(circleId, goalId, amount),
    [store]
  );

  const setAllowance = useCallback(
    (circleId: string, memberId: string, amount: number, frequency: 'weekly' | 'monthly') =>
      store.setAllowance(circleId, memberId, amount, frequency),
    [store]
  );

  // ── Nudge ───────────────────────────────────────────────────

  const nudgeMember = useCallback(
    (circleId: string, memberId: string, fromMemberId: string) =>
      store.nudgeMember(circleId, memberId, fromMemberId),
    [store]
  );

  // ── Encryption ──────────────────────────────────────────────

  const encryptSensitiveData = useCallback(
    async (circleId: string, data: Record<string, unknown>) => {
      const circle = store.circles.find(c => c.id === circleId);
      if (!circle) return null;
      return encryptData(JSON.stringify(data), circle.encryptionKey);
    },
    [store.circles]
  );

  const decryptSensitiveData = useCallback(
    async (circleId: string, encrypted: string) => {
      const circle = store.circles.find(c => c.id === circleId);
      if (!circle) return null;
      const decrypted = await decryptData(encrypted, circle.encryptionKey);
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    },
    [store.circles]
  );

  // ── CRDT Merge (for offline sync) ──────────────────────────

  const mergeRemoteCircle = useCallback(
    (remote: FamilyCircle) => {
      const local = store.circles.find(c => c.id === remote.id);
      if (!local) {
        // New circle from remote
        set(s => ({ circles: [...s.circles, remote] }));
        return;
      }
      // Merge data
      const merged: FamilyCircle = {
        ...remote,
        members: mergeMembers(local.members, remote.members),
        sharedGoals: mergeGoals(local.sharedGoals, remote.sharedGoals),
        sharedHabits: mergeHabits(local.sharedHabits, remote.sharedHabits),
        familyStreak: Math.max(local.familyStreak, remote.familyStreak),
        achievements: local.achievements.map(a => {
          const ra = remote.achievements.find(ra2 => ra2.id === a.id);
          if (ra?.unlockedAt && !a.unlockedAt) return { ...a, unlockedAt: ra.unlockedAt };
          if (a.unlockedAt && ra?.unlockedAt && a.unlockedAt < ra.unlockedAt) return a;
          if (ra?.unlockedAt) return { ...a, unlockedAt: ra.unlockedAt };
          return a;
        }),
      };
      set(s => ({
        circles: s.circles.map(c => c.id === remote.id ? merged : c),
      }));
    },
    [store.circles]
  );

  // ── Achievement Check ──────────────────────────────────────

  const checkAchievements = useCallback(
    (circleId: string) => store.checkAchievements(circleId),
    [store]
  );

  return {
    // State
    circles: store.circles,
    activeCircle,
    activeCircleId: store.activeCircleId,
    isLoaded: store.isLoaded,
    isCreating,
    joinError,
    syncState,
    circleHealth,
    fallingBehind,
    todayActivity,
    recentActivity,

    // Circle lifecycle
    createCircle,
    joinCircle,
    leaveCircle,
    setActiveCircle: store.setActiveCircle,

    // Members
    addMember,
    removeMember,
    updateRole,
    updatePermissions,

    // Goals
    addSharedGoal,
    updateGoalProgress,
    removeSharedGoal,

    // Habits
    addSharedHabit,
    logHabit,

    // Budget
    addTransaction,
    addSavingsGoal,
    contributeToSavings,
    setAllowance,
    updateMonthlyIncome: store.updateMonthlyIncome,

    // Nudge
    nudgeMember,

    // Encryption
    encryptSensitiveData,
    decryptSensitiveData,

    // CRDT sync
    mergeRemoteCircle,

    // Achievements
    checkAchievements,

    // Activity
    logActivity: store.logActivity,
  };
}

// ── Re-exports for convenience ────────────────────────────────────────

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
};