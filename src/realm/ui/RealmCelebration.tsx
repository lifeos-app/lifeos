/**
 * Realm Celebration — Reward overlay that invites users into The Realm
 *
 * Shows after significant achievements with a preview of what changed
 * in their world, and a "Visit Realm" CTA.
 *
 * This is what makes The Realm a REWARD — not just a feature.
 * The celebration says: "Something grew in your world. Come see."
 */

import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RealmEventBus, type RealmEvent, type RealmEventType } from '../bridge/RealmEventBus';
import './RealmCelebration.css';

interface CelebrationData {
  id: string;
  type: RealmEventType;
  title: string;
  subtitle: string;
  emoji: string;
  color: string;
}

const EVENT_CELEBRATIONS: Partial<Record<RealmEventType, (data: Record<string, unknown>) => CelebrationData | null>> = {
  habit_streak_milestone: (data) => ({
    id: `streak-${Date.now()}`,
    type: 'habit_streak_milestone',
    title: `${data.milestone}-Day Streak!`,
    subtitle: `"${data.habitName}" evolved in your garden 🌱`,
    emoji: (data.milestone as number) >= 100 ? '🔥' : (data.milestone as number) >= 30 ? '🌳' : '🌿',
    color: '#4CAF50',
  }),
  level_up: (data) => ({
    id: `levelup-${Date.now()}`,
    type: 'level_up',
    title: `Level ${data.newLevel}!`,
    subtitle: `Your house grew in Life Town`,
    emoji: '⬆️',
    color: '#FFD700',
  }),
  goal_completed: (data) => ({
    id: `goal-${Date.now()}`,
    type: 'goal_completed',
    title: 'Quest Complete!',
    subtitle: `"${data.goalTitle}" — a monument rises`,
    emoji: '🏆',
    color: '#F97316',
  }),
  zone_unlocked: (data) => ({
    id: `zone-${Date.now()}`,
    type: 'zone_unlocked',
    title: 'New Zone Discovered!',
    subtitle: `${data.zoneName} has opened its gates`,
    emoji: '🗺️',
    color: '#00D4FF',
  }),
  achievement_unlocked: (data) => ({
    id: `ach-${Date.now()}`,
    type: 'achievement_unlocked',
    title: 'Achievement Unlocked!',
    subtitle: `"${data.title}" — check your trophy case`,
    emoji: '🏅',
    color: '#A855F7',
  }),
};

/** Events that should trigger celebration (not everything — only significant moments) */
const CELEBRATION_EVENTS: RealmEventType[] = [
  'habit_streak_milestone',
  'level_up',
  'goal_completed',
  'zone_unlocked',
  'achievement_unlocked',
];

export const RealmCelebration = memo(function RealmCelebration() {
  const navigate = useNavigate();
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const unsubs = CELEBRATION_EVENTS.map(eventType =>
      RealmEventBus.on(eventType, (event: RealmEvent) => {
        const factory = EVENT_CELEBRATIONS[event.type];
        if (!factory) return;
        const data = factory(event.data);
        if (data) setCelebration(data);
      }),
    );

    return () => unsubs.forEach(u => u());
  }, []);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setCelebration(null);
      setExiting(false);
    }, 400);
  }, []);

  const visitRealm = useCallback(() => {
    dismiss();
    // Small delay so the dismiss animation plays
    setTimeout(() => {
      navigate('/character?tab=realm');
    }, 200);
  }, [dismiss, navigate]);

  if (!celebration) return null;

  return (
    <div
      className={`realm-celeb-backdrop ${exiting ? 'realm-celeb-exit' : ''}`}
      onClick={dismiss}
    >
      <div
        className="realm-celeb-card"
        style={{ '--celeb-color': celebration.color } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        {/* Particle burst */}
        <div className="realm-celeb-particles">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="realm-celeb-particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1 + Math.random() * 1.5}s`,
                backgroundColor: celebration.color,
              }}
            />
          ))}
        </div>

        <div className="realm-celeb-emoji">{celebration.emoji}</div>
        <div className="realm-celeb-title">{celebration.title}</div>
        <div className="realm-celeb-subtitle">{celebration.subtitle}</div>

        <div className="realm-celeb-actions">
          <button className="realm-celeb-visit" onClick={visitRealm}>
            🏰 Visit Realm
          </button>
          <button className="realm-celeb-dismiss" onClick={dismiss}>
            Later
          </button>
        </div>
      </div>
    </div>
  );
});
