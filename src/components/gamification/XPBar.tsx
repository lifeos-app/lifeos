// LifeOS Gamification — XP Progress Bar
// Animated, glowing, with compact/expanded modes

import { useEffect, useState, useRef } from 'react';
import { getTierForLevel } from '../../lib/gamification/tier-colors';
import './gamification.css';

interface XPBarProps {
  level: number;
  title: string;
  xpProgress: number; // 0–1
  xpToNext: number;
  totalXP: number;
  compact?: boolean;
}

export function XPBar({ level, title, xpProgress, xpToNext, totalXP, compact = false }: XPBarProps) {
  const tier = getTierForLevel(level);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const prevProgress = useRef(0);

  useEffect(() => {
    // Animate from previous to new progress
    const timer = setTimeout(() => {
      setAnimatedProgress(xpProgress);
    }, 100);
    prevProgress.current = xpProgress;
    return () => clearTimeout(timer);
  }, [xpProgress]);

  const pct = Math.round(animatedProgress * 100);

  return (
    <div className={`xp-bar ${compact ? 'xp-bar--compact' : ''} ${tier.cssClass}`}>
      <div className="xp-bar__level" style={{ background: tier.primary, boxShadow: `0 0 8px ${tier.glowColor}` }}>{level}</div>
      <div className="xp-bar__content">
        <div className="xp-bar__labels">
          <span className="xp-bar__title">{title}</span>
          <span className="xp-bar__xp">
            {compact
              ? `${formatXP(totalXP)} XP`
              : `${formatXP(xpToNext)} to Lv.${level + 1}`
            }
          </span>
        </div>
        <div className="xp-bar__track">
          <div
            className="xp-bar__glow"
            style={{ width: `${pct}%`, background: tier.gradient }}
          />
          <div
            className="xp-bar__fill"
            style={{ width: `${pct}%`, background: tier.gradient }}
          />
        </div>
      </div>
    </div>
  );
}

function formatXP(xp: number): string {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
  return String(xp);
}

export default XPBar;
