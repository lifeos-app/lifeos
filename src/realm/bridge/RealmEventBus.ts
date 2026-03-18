/**
 * Realm Event Bus — Global event system for Realm integration
 *
 * This is the nervous system connecting LifeOS actions to Realm reactions.
 * When XP is awarded, habits logged, goals completed, etc., events fire here
 * and The Realm reacts — plants grow, shadows dispel, buildings upgrade.
 *
 * Design: pub/sub with typed events. Components subscribe, actions publish.
 * Works whether or not The Realm is currently open.
 */

// ── Event Types ──────────────────────────────────

export type RealmEventType =
  | 'xp_gained'
  | 'level_up'
  | 'habit_logged'
  | 'habit_streak_milestone'
  | 'habit_streak_broken'
  | 'goal_completed'
  | 'task_completed'
  | 'journal_written'
  | 'health_logged'
  | 'finance_logged'
  | 'achievement_unlocked'
  | 'quest_completed'
  | 'zone_unlocked'
  | 'building_upgraded'
  | 'shadow_spawned'
  | 'shadow_dispelled';

export interface RealmEvent {
  type: RealmEventType;
  data: Record<string, unknown>;
  timestamp: number;
}

// ── Specific Event Data Types ────────────────────

export interface XPGainedEvent extends RealmEvent {
  type: 'xp_gained';
  data: { amount: number; action: string; total: number };
}

export interface LevelUpEvent extends RealmEvent {
  type: 'level_up';
  data: { oldLevel: number; newLevel: number; newTitle: string };
}

export interface HabitLoggedEvent extends RealmEvent {
  type: 'habit_logged';
  data: { habitId: string; habitName: string; category: string; newStreak: number };
}

export interface HabitStreakMilestoneEvent extends RealmEvent {
  type: 'habit_streak_milestone';
  data: { habitId: string; habitName: string; milestone: number };
}

export interface GoalCompletedEvent extends RealmEvent {
  type: 'goal_completed';
  data: { goalId: string; goalTitle: string; category: string };
}

export interface JournalWrittenEvent extends RealmEvent {
  type: 'journal_written';
  data: { entryId: string; title: string; totalEntries: number };
}

export interface ZoneUnlockedEvent extends RealmEvent {
  type: 'zone_unlocked';
  data: { zoneId: string; zoneName: string; trigger: string };
}

// ── Event Bus Implementation ─────────────────────

type RealmEventListener = (event: RealmEvent) => void;

class RealmEventBusImpl {
  private listeners = new Map<RealmEventType | '*', Set<RealmEventListener>>();
  private eventLog: RealmEvent[] = [];
  private maxLogSize = 50;

  /**
   * Subscribe to a specific event type (or '*' for all)
   * Returns unsubscribe function
   */
  on(type: RealmEventType | '*', listener: RealmEventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  /**
   * Publish an event
   */
  emit(event: RealmEvent): void {
    // Log it
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    // Notify specific listeners
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach(listener => {
        // BUG-105: Log errors instead of silently swallowing them
        try { listener(event); } catch (e) { console.warn(`[RealmEventBus] Listener error for ${event.type}:`, e); }
      });
    }

    // Notify wildcard listeners
    const allListeners = this.listeners.get('*');
    if (allListeners) {
      allListeners.forEach(listener => {
        // BUG-105: Log errors instead of silently swallowing them
        try { listener(event); } catch (e) { console.warn(`[RealmEventBus] Wildcard listener error:`, e); }
      });
    }
  }

  /**
   * Get recent events (for Realm to process on open)
   */
  getRecentEvents(since?: number): RealmEvent[] {
    if (!since) return [...this.eventLog];
    return this.eventLog.filter(e => e.timestamp > since);
  }

  /**
   * Convenience emitters
   */
  emitXPGained(amount: number, action: string, total: number): void {
    this.emit({ type: 'xp_gained', data: { amount, action, total }, timestamp: Date.now() });
  }

  emitLevelUp(oldLevel: number, newLevel: number, newTitle: string): void {
    this.emit({ type: 'level_up', data: { oldLevel, newLevel, newTitle }, timestamp: Date.now() });
  }

  emitHabitLogged(habitId: string, habitName: string, category: string, newStreak: number): void {
    this.emit({ type: 'habit_logged', data: { habitId, habitName, category, newStreak }, timestamp: Date.now() });

    // Check streak milestones
    const milestones = [7, 14, 30, 60, 100, 365];
    if (milestones.includes(newStreak)) {
      this.emit({
        type: 'habit_streak_milestone',
        data: { habitId, habitName, milestone: newStreak },
        timestamp: Date.now(),
      });
    }
  }

  emitHabitStreakBroken(habitId: string, habitName: string): void {
    this.emit({ type: 'habit_streak_broken', data: { habitId, habitName }, timestamp: Date.now() });
  }

  emitGoalCompleted(goalId: string, goalTitle: string, category: string): void {
    this.emit({ type: 'goal_completed', data: { goalId, goalTitle, category }, timestamp: Date.now() });
  }

  emitJournalWritten(entryId: string, title: string, totalEntries: number): void {
    this.emit({ type: 'journal_written', data: { entryId, title, totalEntries }, timestamp: Date.now() });
  }

  emitHealthLogged(): void {
    this.emit({ type: 'health_logged', data: {}, timestamp: Date.now() });
  }

  emitFinanceLogged(type: 'income' | 'expense', amount: number): void {
    this.emit({ type: 'finance_logged', data: { type, amount }, timestamp: Date.now() });
  }

  emitAchievementUnlocked(achievementId: string, title: string): void {
    this.emit({ type: 'achievement_unlocked', data: { achievementId, title }, timestamp: Date.now() });
  }

  emitZoneUnlocked(zoneId: string, zoneName: string, trigger: string): void {
    this.emit({ type: 'zone_unlocked', data: { zoneId, zoneName, trigger }, timestamp: Date.now() });
  }

  clear(): void {
    this.eventLog = [];
  }
}

/** Singleton event bus */
export const RealmEventBus = new RealmEventBusImpl();
