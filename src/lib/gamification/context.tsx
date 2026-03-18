// LifeOS Gamification — React Context Provider
// Wraps the app to provide gamification state everywhere

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useGamification, type GamificationState, type GamificationActions } from '../../hooks/useGamification';
import { RealmEventBus } from '../../realm/bridge/RealmEventBus';
// Achievement, ActiveQuest types used in PendingNotification.data (typed as any)

interface PendingNotification {
  type: 'level_up' | 'achievement' | 'quest_complete' | 'xp_gain';
  data: any;
  id: string;
}

interface GamificationContextValue extends GamificationState, GamificationActions {
  /** Pending notifications (level ups, achievements, etc.) */
  notifications: PendingNotification[];
  /** Dismiss a notification */
  dismissNotification: (id: string) => void;
  /** Clear all notifications */
  clearNotifications: () => void;
}

const GamificationContext = createContext<GamificationContextValue | null>(null);

let notifCounter = 0;

export function GamificationProvider({ children }: { children: ReactNode }) {
  const gamification = useGamification();
  const [notifications, setNotifications] = useState<PendingNotification[]>([]);

  const addNotification = useCallback((type: PendingNotification['type'], data: any) => {
    const id = `notif-${++notifCounter}-${Date.now()}`;
    setNotifications(prev => [...prev, { type, data, id }]);
    // Auto-dismiss after 10s
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 10000);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Wrap awardXP to also trigger notifications
  const wrappedAwardXP: GamificationActions['awardXP'] = useCallback(async (action, metadata) => {
    const result = await gamification.awardXP(action, metadata);

    // XP gain notification
    if (result.xpAwarded > 0) {
      addNotification('xp_gain', {
        amount: result.xpAwarded,
        action,
      });
      // → Realm: XP gained event
      RealmEventBus.emitXPGained(result.xpAwarded, action, result.xpAwarded);
    }

    // Level up notification
    if (result.leveledUp) {
      addNotification('level_up', {
        newLevel: result.newLevel,
        newTitle: result.newTitle,
      });
      // → Realm: Level up event
      RealmEventBus.emitLevelUp(result.newLevel - 1, result.newLevel, result.newTitle);
    }

    // Achievement notifications
    for (const ach of result.unlockedAchievements) {
      addNotification('achievement', ach);
      // → Realm: Achievement unlocked event
      RealmEventBus.emitAchievementUnlocked(ach.id, ach.title);
    }

    // Quest complete notifications
    for (const quest of result.completedQuests) {
      addNotification('quest_complete', quest);
    }

    return result;
  }, [gamification.awardXP, addNotification]);

  const value: GamificationContextValue = {
    ...gamification,
    awardXP: wrappedAwardXP,
    notifications,
    dismissNotification,
    clearNotifications,
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamificationContext(): GamificationContextValue {
  const ctx = useContext(GamificationContext);
  if (!ctx) {
    throw new Error('useGamificationContext must be used within a GamificationProvider');
  }
  return ctx;
}
