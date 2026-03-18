/**
 * Realm Transition — Enter/Exit Animation
 *
 * Displays real user data (XP, habits, goals) morphing into the pixel world.
 * Enter: data particles converge → Realm fades in
 * Exit: Realm fades out → data particles disperse back
 */

import { useEffect, useState } from 'react';
import { useUserStore } from '../../stores/useUserStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { loadCharacter } from '../../rpg/engine/CharacterManager';
import './RealmTransition.css';

interface DataParticle {
  id: string;
  text: string;
  x: number;
  y: number;
  delay: number;
}

interface RealmTransitionProps {
  type: 'enter' | 'exit';
  onComplete: () => void;
}

export function RealmTransition({ type, onComplete }: RealmTransitionProps) {
  const [particles, setParticles] = useState<DataParticle[]>([]);
  const [phase, setPhase] = useState<'data' | 'converge' | 'fade'>('data');

  const userId = useUserStore(s => s.session?.user?.id ?? s.localUserId);
  const habits = useHabitsStore(s => s.habits);
  const goals = useGoalsStore(s => s.goals);

  useEffect(() => {
    async function gatherData() {
      const char = userId ? await loadCharacter(userId) : null;
      
      const dataPoints: string[] = [];

      // Character data
      if (char) {
        dataPoints.push(`Level ${char.level}`);
        dataPoints.push(`${char.totalXp.toLocaleString()} XP`);
        dataPoints.push(char.name);
        dataPoints.push(char.characterClass);
      }

      // Habits
      const activeHabits = habits.filter(h => !h.archived);
      if (activeHabits.length > 0) {
        dataPoints.push(`${activeHabits.length} habits`);
        activeHabits.slice(0, 3).forEach(h => {
          if (h.name) dataPoints.push(h.name);
        });
      }

      // Goals
      const activeGoals = goals.filter(g => g.status === 'active');
      if (activeGoals.length > 0) {
        dataPoints.push(`${activeGoals.length} goals`);
        activeGoals.slice(0, 2).forEach(g => {
          if (g.title) dataPoints.push(g.title);
        });
      }

      // Generate particles
      const newParticles: DataParticle[] = dataPoints.map((text, i) => ({
        id: `particle-${i}`,
        text,
        x: Math.random() * 80 + 10, // 10-90% viewport width
        y: Math.random() * 80 + 10, // 10-90% viewport height
        delay: Math.random() * 0.3,
      }));

      setParticles(newParticles);
    }

    gatherData();
  }, [userId, habits, goals]);

  useEffect(() => {
    if (type === 'enter') {
      // Enter animation sequence
      const dataTimer = setTimeout(() => setPhase('converge'), 500);
      const convergeTimer = setTimeout(() => setPhase('fade'), 1200);
      const completeTimer = setTimeout(onComplete, 1800);

      return () => {
        clearTimeout(dataTimer);
        clearTimeout(convergeTimer);
        clearTimeout(completeTimer);
      };
    } else {
      // Exit animation (faster)
      const fadeTimer = setTimeout(() => setPhase('data'), 300);
      const completeTimer = setTimeout(onComplete, 900);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [type, onComplete]);

  return (
    <div className={`realm-transition realm-transition--${type} realm-transition--${phase}`}>
      {/* Data particles */}
      <div className="realm-transition-particles">
        {particles.map(p => (
          <div
            key={p.id}
            className="realm-transition-particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              animationDelay: `${p.delay}s`,
            }}
          >
            {p.text}
          </div>
        ))}
      </div>

      {/* Center convergence point */}
      {type === 'enter' && phase === 'converge' && (
        <div className="realm-transition-portal">
          <div className="realm-transition-portal-ring" />
          <div className="realm-transition-portal-core" />
        </div>
      )}

      {/* Fade overlay */}
      {phase === 'fade' && (
        <div className={`realm-transition-fade realm-transition-fade--${type}`} />
      )}
    </div>
  );
}
