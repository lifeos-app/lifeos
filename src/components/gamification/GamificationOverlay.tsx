// LifeOS Gamification — Global Overlay
// Renders level-up modals, achievement toasts, XP floaters
// Place this ONCE at the app root level

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGamificationContext } from '../../lib/gamification/context';
import { LevelUpModal } from './LevelUpModal';
import { AchievementToastContainer, showAchievementToast } from './AchievementToast';
import type { Achievement } from '../../lib/gamification';
import { ComboIndicator } from './ComboIndicator';
import './gamification.css';

interface XPFloat {
  id: string;
  amount: number;
}

// Track which notification IDs we've already processed,
// so we don't re-show toasts on re-renders / re-mounts
const processedIds = new Set<string>();

export function GamificationOverlay() {
  const { notifications, dismissNotification } = useGamificationContext();
  const [levelUpData, setLevelUpData] = useState<{ level: number } | null>(null);
  const [xpFloats, setXPFloats] = useState<XPFloat[]>([]);
  const mountedRef = useRef(false);

  // Only process notifications that we haven't seen yet
  useEffect(() => {
    // Skip notifications that were already in the queue when we first mounted
    // (prevents re-showing on every dashboard navigation)
    if (!mountedRef.current) {
      mountedRef.current = true;
      // Mark all existing notifications as processed without showing them
      for (const notif of notifications) {
        processedIds.add(notif.id);
        dismissNotification(notif.id);
      }
      return;
    }

    for (const notif of notifications) {
      if (processedIds.has(notif.id)) continue;
      processedIds.add(notif.id);

      switch (notif.type) {
        case 'level_up':
          setLevelUpData({ level: notif.data.newLevel as number });
          dismissNotification(notif.id);
          break;

        case 'achievement':
          showAchievementToast(notif.data as Achievement);
          dismissNotification(notif.id);
          break;

        case 'xp_gain': {
          const id = `xp-${Date.now()}-${Math.random()}`;
          setXPFloats(prev => [...prev, { id, amount: notif.data.amount as number }]);
          dismissNotification(notif.id);
          // Remove after animation
          setTimeout(() => {
            setXPFloats(prev => prev.filter(f => f.id !== id));
          }, 2500);
          break;
        }

        case 'quest_complete':
          // Could show a quest-specific toast here
          dismissNotification(notif.id);
          break;
      }
    }
  }, [notifications, dismissNotification]);

  const handleLevelUpClose = useCallback(() => {
    setLevelUpData(null);
  }, []);

  return (
    <>
      {/* Level Up Modal */}
      {levelUpData && (
        <LevelUpModal
          level={levelUpData.level}
          onClose={handleLevelUpClose}
        />
      )}

      {/* Achievement Toasts */}
      <AchievementToastContainer />

      {/* XP Floaters */}
      {xpFloats.length > 0 && (
        <div className="xp-float">
          {xpFloats.map(f => (
            <div key={f.id} className="xp-float-item">
              +{f.amount} XP
            </div>
          ))}
        </div>
      )}

      {/* Combo Counter */}
      <ComboIndicator />
    </>
  );
}

export default GamificationOverlay;
