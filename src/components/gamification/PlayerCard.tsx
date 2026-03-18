// LifeOS Gamification — Player Card (Character Sheet)
// v2: Shield level badge, days active, longest streak, cleaner layout
// Mobile-first, fits iPhone SE (320px)

import { useUserStore } from '../../stores/useUserStore';
import { getAchievement, RARITY_COLORS } from '../../lib/gamification';
import type { UserStats } from '../../lib/gamification';
import { XPBar } from './XPBar';
import { StatsRadar } from './StatsRadar';
import { Shield, Flame, Calendar, Zap } from 'lucide-react';
import { CLASS_ICONS, CLASS_NAMES, ROLE_ARCHETYPES, type ClassKey, type RoleKey } from '../../lib/gamification/class-quests';
import './gamification.css';

interface PlayerCardProps {
  level: number;
  title: string;
  xp: number;
  xpProgress: number;
  xpToNext: number;
  stats: UserStats;
  achievements: { achievementId: string; unlockedAt: string | null; progress: number }[];
  daysActive?: number;
  longestStreak?: number;
}

export function PlayerCard({
  level,
  title,
  xp,
  xpProgress,
  xpToNext,
  stats,
  achievements,
  daysActive = 0,
  longestStreak = 0,
}: PlayerCardProps) {
  const profile = useUserStore(s => s.profile);
  const user = useUserStore(s => s.user);
  const displayName = profile?.display_name || user?.user_metadata?.full_name || 'Commander';

  // Get class & role from preferences
  const prefs = (profile?.preferences || {}) as any;
  const userClass: ClassKey | null = prefs.class || null;
  const userRole: RoleKey | null = prefs.role || null;

  // Top 6 unlocked achievements
  const unlockedAchievements = achievements
    .filter(a => a.unlockedAt)
    .map(a => {
      const def = getAchievement(a.achievementId);
      return def ? { ...def, unlockedAt: a.unlockedAt } : null;
    })
    .filter(Boolean)
    .slice(0, 6);

  return (
    <div className="player-card">
      {/* Header: Shield + Name + Title */}
      <div className="player-card__header">
        <div className="player-card__shield">
          <svg viewBox="0 0 40 46" className="player-card__shield-svg">
            <defs>
              <linearGradient id="shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00D4FF" />
                <stop offset="50%" stopColor="#39FF14" />
                <stop offset="100%" stopColor="#FFD700" />
              </linearGradient>
              <linearGradient id="shield-inner" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(0,212,255,0.15)" />
                <stop offset="100%" stopColor="rgba(10,20,40,0.9)" />
              </linearGradient>
            </defs>
            {/* Shield shape */}
            <path
              d="M20 2 L37 10 L37 24 C37 34 28 42 20 45 C12 42 3 34 3 24 L3 10 Z"
              fill="url(#shield-inner)"
              stroke="url(#shield-grad)"
              strokeWidth="2"
            />
            {/* Inner glow */}
            <path
              d="M20 6 L33 12 L33 24 C33 32 26 38 20 41 C14 38 7 32 7 24 L7 12 Z"
              fill="none"
              stroke="rgba(0,212,255,0.15)"
              strokeWidth="0.5"
            />
          </svg>
          <span className="player-card__shield-level">{level}</span>
        </div>
        <div className="player-card__meta">
          <div className="player-card__name">{displayName}</div>
          <div className="player-card__title">{title}</div>
          {(userClass || userRole) && (
            <div className="player-card__class-role" style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.5)',
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              {userRole && ROLE_ARCHETYPES[userRole] && (
                <span>{(() => { const Icon = ROLE_ARCHETYPES[userRole].icon; return <Icon size={14} />; })()} {userRole}</span>
              )}
              {userRole && userClass && <span style={{ opacity: 0.3 }}>·</span>}
              {userClass && (
                <span>{CLASS_ICONS[userClass]} {CLASS_NAMES[userClass]}</span>
              )}
            </div>
          )}
          <div className="player-card__xp-total">
            <Zap size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
            {formatXP(xp)} Total XP
          </div>
        </div>
      </div>

      {/* XP Bar */}
      <XPBar
        level={level}
        title={title}
        xpProgress={xpProgress}
        xpToNext={xpToNext}
        totalXP={xp}
      />

      {/* Stats Radar */}
      <StatsRadar stats={stats} size={180} />

      {/* Quick Stats Row */}
      <div className="player-card__stats-row">
        <div className="player-card__stat">
          <Shield size={13} className="player-card__stat-icon" style={{ color: '#00D4FF' }} />
          <span className="player-card__stat-val">{level}</span>
          <span className="player-card__stat-lbl">Level</span>
        </div>
        <div className="player-card__stat">
          <Calendar size={13} className="player-card__stat-icon" style={{ color: '#A855F7' }} />
          <span className="player-card__stat-val">{daysActive}</span>
          <span className="player-card__stat-lbl">Days Active</span>
        </div>
        <div className="player-card__stat">
          <Flame size={13} className="player-card__stat-icon" style={{ color: '#F97316' }} />
          <span className="player-card__stat-val">{longestStreak}</span>
          <span className="player-card__stat-lbl">Best Streak</span>
        </div>
      </div>

      {/* Achievement Showcase */}
      {unlockedAchievements.length > 0 && (
        <div className="player-card__achievements">
          {unlockedAchievements.map(ach => ach && (
            <div
              key={ach.id}
              className={`player-card__ach-badge ${ach.rarity}`}
              title={`${ach.title}: ${ach.description}`}
              style={{
                borderColor: RARITY_COLORS[ach.rarity],
              }}
            >
              {ach.icon}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatXP(xp: number): string {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
  return String(xp);
}

export default PlayerCard;
