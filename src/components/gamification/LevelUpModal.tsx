// LifeOS Gamification — Level Up Celebration Modal
// Full-screen with particles, glow animations, title reveal, character jump

import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUnlocksForLevel, getTitleForLevel } from '../../lib/gamification';
import { getTierForLevel } from '../../lib/gamification/tier-colors';
import { MiniCharacter } from '../../realm/ui/MiniCharacter';
import './gamification.css';

interface LevelUpModalProps {
  level: number;
  onClose: () => void;
}

export function LevelUpModal({ level, onClose }: LevelUpModalProps) {
  const title = getTitleForLevel(level);
  const unlocks = getUnlocksForLevel(level);
  const tier = getTierForLevel(level);
  const navigate = useNavigate();

  // Generate particles
  const particles = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      size: 2 + Math.random() * 4,
      color: [tier.primary, '#FFD700', '#FFF', 'rgba(255,255,255,0.5)'][Math.floor(Math.random() * 4)],
    }));
  }, []);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className={`levelup-overlay ${tier.cssClass}`} onClick={onClose}>
      <div className="levelup-card" onClick={e => e.stopPropagation()}>
        {/* Particle effects */}
        <div className="levelup-particles">
          {particles.map(p => (
            <div
              key={p.id}
              className="levelup-particle"
              style={{
                left: `${p.left}%`,
                bottom: '0%',
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            />
          ))}
        </div>

        <div className="levelup-label">Level Up!</div>

        {/* Character with jump animation */}
        <div className="levelup-character" style={{
          animation: 'levelupBounce 1.2s ease-out',
          margin: '8px auto',
        }}>
          <MiniCharacter size={200} animate fps={30} />
        </div>

        <div className="levelup-number" style={{ background: tier.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{level}</div>
        <div className="levelup-title" style={{ color: tier.primary }}>{title}</div>

        {unlocks.length > 0 && (
          <div className="levelup-unlocks">
            {unlocks.map((unlock, i) => (
              <div
                key={unlock}
                className="levelup-unlock"
                style={{ animationDelay: `${0.3 + i * 0.15}s` }}
              >
                {unlock}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
          <button className="levelup-btn" onClick={onClose} style={{ background: tier.gradient }}>
            Continue
          </button>
          <button
            className="levelup-btn"
            onClick={() => { onClose(); navigate('/character?tab=realm'); }}
            style={{ background: 'linear-gradient(135deg, #27ae60, #2ecc71)' }}
          >
            Enter Your Realm
          </button>
        </div>
      </div>
    </div>
  );
}

export default LevelUpModal;
