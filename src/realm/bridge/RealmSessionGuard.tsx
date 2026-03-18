/**
 * RealmSessionGuard — Time tracker + nudge system
 *
 * Mounted inside RealmEntry. Tracks how long the user spends in The Realm
 * and delivers gentle productivity nudges via The Guide's dialogue.
 */

import { useEffect, useRef } from 'react';
import { useScheduleStore } from '../../stores/useScheduleStore';

interface RealmSessionGuardProps {
  onNudge: (lines: string[]) => boolean | void;
}

const NUDGE_MESSAGES: Record<number, (overdueTasks: number) => string[]> = {
  10: (overdueTasks) => [
    'The world beyond awaits, adventurer.',
    overdueTasks > 0
      ? `Your quest log shows ${overdueTasks} task${overdueTasks !== 1 ? 's' : ''}.`
      : 'Your habits and quests grow from real-world action.',
  ],
  20: (_overdueTasks) => [
    'The Healer is concerned — extended Realm time won\'t grow your garden.',
    'Return to your habits.',
  ],
  30: (_overdueTasks) => [
    'Consider returning later.',
    'Your plants grow from real-world care, not observation.',
  ],
};

const THRESHOLDS = [10, 20, 30];

export function RealmSessionGuard({ onNudge }: RealmSessionGuardProps) {
  const startTimeRef = useRef(Date.now());
  const firedRef = useRef(new Set<number>());

  useEffect(() => {
    startTimeRef.current = Date.now();
    firedRef.current = new Set();

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 60000); // minutes

      for (const threshold of THRESHOLDS) {
        if (elapsed >= threshold && !firedRef.current.has(threshold)) {
          firedRef.current.add(threshold);
          const overdueTasks = useScheduleStore.getState().getOverdueTasks().length;
          const lines = NUDGE_MESSAGES[threshold](overdueTasks);
          onNudge(lines);
          break; // only fire one per tick
        }
      }
    }, 60_000);

    return () => {
      clearInterval(interval);

      // Log time spent
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 60000);
      if (elapsed > 0) {
        const today = new Date().toISOString().split('T')[0];
        const key = `lifeos-realm-time-${today}`;
        const prev = parseInt(localStorage.getItem(key) || '0', 10);
        localStorage.setItem(key, String(prev + elapsed));
      }
    };
  }, [onNudge]);

  return null;
}

/**
 * Get total Realm time (in minutes) for today.
 */
export function getRealmTimeToday(): number {
  const today = new Date().toISOString().split('T')[0];
  const key = `lifeos-realm-time-${today}`;
  return parseInt(localStorage.getItem(key) || '0', 10);
}
