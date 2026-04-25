/**
 * CharacterCorner -- mini avatar + level + XP bar widget
 *
 * Shows the player's character, level, XP progress, and current streak
 * as a compact glass chip. Non-blocking, purely informational.
 */

import { useEffect } from 'react';
import { MiniCharacter } from '../realm/ui/MiniCharacter';
import { useCharacterAppearanceStore } from '../stores/useCharacterAppearanceStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useUserStore } from '../stores/useUserStore';
import { useGamificationContext } from '../lib/gamification/context';
import { Flame } from 'lucide-react';

interface CharacterCornerProps {
  className?: string;
}

export function CharacterCorner({ className }: CharacterCornerProps) {
  const userId = useUserStore(s => s.session?.user?.id);
  const loaded = useCharacterAppearanceStore(s => s.loaded);
  const charLevel = useCharacterAppearanceStore(s => s.level);
  const charName = useCharacterAppearanceStore(s => s.name);

  const gam = useGamificationContext();
  const level = gam.level || charLevel || 1;
  const xpProgress = gam.xpProgress || 0;

  const habits = useHabitsStore(s => s.habits);
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak_current || 0), 0);

  // Load appearance if needed
  useEffect(() => {
    if (!loaded && userId) {
      useCharacterAppearanceStore.getState().loadFromSupabase(userId);
    }
  }, [loaded, userId]);

  if (!loaded) return null;

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px 4px 4px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        minWidth: 120,
        maxWidth: 200,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {/* Mini avatar */}
      <MiniCharacter size={36} animate={true} fps={10} />

      {/* Level + XP + Streak */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
        {/* Top row: Name + Level */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.85)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          <span style={{
            color: '#00D4FF',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.3,
          }}>
            Lv.{level}
          </span>
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {charName}
          </span>
        </div>

        {/* XP bar */}
        <div style={{
          height: 4,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(xpProgress * 100, 100)}%`,
            background: 'linear-gradient(90deg, #00D4FF, #39FF14)',
            borderRadius: 2,
            transition: 'width 0.6s ease',
          }} />
        </div>

        {/* Streak */}
        {bestStreak > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 10,
            color: bestStreak >= 7 ? '#D4AF37' : 'rgba(255,255,255,0.5)',
            fontWeight: 500,
          }}>
            <Flame size={10} />
            <span>{bestStreak}d streak</span>
          </div>
        )}
      </div>
    </div>
  );
}
