// LifeOS Gamification — Global Overlay
// Renders level-up modals, achievement toasts, XP floaters
// Place this ONCE at the app root level

import { useState, useEffect, useCallback } from 'react';
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

export function GamificationOverlay() {
  const { notifications, dismissNotification } = useGamificationContext();
  const [levelUpData, setLevelUpData] = useState<{ level: number } | null>(null);
  const [xpFloats, setXPFloats] = useState<XPFloat[]>([]);

  // Process notifications
  useEffect(() => {
    for (const notif of notifications) {
      switch (notif.type) {
        case 'level_up':
          setLevelUpData({ level: notif.data.newLevel });
          dismissNotification(notif.id);
          break;

        case 'achievement':
          showAchievementToast(notif.data as Achievement);
          dismissNotification(notif.id);
          break;

        case 'xp_gain': {
          const id = `xp-${Date.now()}-${Math.random()}`;
          setXPFloats(prev => [...prev, { id, amount: notif.data.amount }]);
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
