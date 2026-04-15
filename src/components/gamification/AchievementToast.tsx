// LifeOS Gamification — Achievement Toast Notifications
// Slides in from right with gold/rarity borders, stacks

import { useState, useEffect, useCallback } from 'react';
import { Trophy } from 'lucide-react';
import type { Achievement } from '../../lib/gamification';
import { RARITY_LABELS } from '../../lib/gamification';
import { EmojiIcon } from '../../lib/emoji-icon';
import './gamification.css';

interface ToastItem {
  id: string;
  achievement: Achievement;
  exiting: boolean;
}

// Global toast system
let toastListeners: ((achievement: Achievement) => void)[] = [];
let toastId = 0;

export function showAchievementToast(achievement: Achievement) {
  toastListeners.forEach(listener => listener(achievement));
}

export function AchievementToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((achievement: Achievement) => {
    const id = `ach-toast-${++toastId}`;
    setToasts(prev => [...prev, { id, achievement, exiting: false }]);

    // Auto-dismiss after 3s (shorter for less intrusion)
    setTimeout(() => {
      setToasts(prev =>
        prev.map(t => t.id === id ? { ...t, exiting: true } : t)
      );
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 400);
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 400);
  }, []);

  useEffect(() => {
    toastListeners.push(addToast);
    return () => {
      toastListeners = toastListeners.filter(l => l !== addToast);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="ach-toast">
      {toasts.map(({ id, achievement, exiting }) => (
        <div
          key={id}
          className={`ach-toast-item ${achievement.rarity} ${exiting ? 'exiting' : ''}`}
          onClick={() => dismissToast(id)}
          style={{ cursor: 'pointer' }}
          title="Click to dismiss"
        >
          <span className="ach-toast-icon"><EmojiIcon emoji={achievement.icon} size={18} fallbackAsText /></span>
          <div className="ach-toast-body">
            <div className={`ach-toast-label ${achievement.rarity}`}>
              <Trophy size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />{RARITY_LABELS[achievement.rarity]} Achievement
            </div>
            <div className="ach-toast-title">{achievement.title}</div>
            <div className="ach-toast-desc">{achievement.description}</div>
          </div>
          <span className="ach-toast-xp">+{achievement.xp_reward} XP</span>
        </div>
      ))}
    </div>
  );
}

export default AchievementToastContainer;
