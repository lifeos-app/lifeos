// LifeOS Social — War Rewards Showcase
// Trophy case, cosmetics, XP bonuses, titles, season championship badge

import { useState, useMemo } from 'react';
import { Trophy, Star, Sparkles, Crown, Flame, Gift, Shield, Zap } from 'lucide-react';
import type { WarReward } from '../../stores/guildWarStore';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface WarRewardsProps {
  rewards: WarReward[];
  warWins: number;
  guildName?: string;
  compact?: boolean;
}

interface TrophyCaseProps {
  warWins: number;
  guildName?: string;
}

// ═══════════════════════════════════════════════════
// REWARD TYPE CONFIG
// ═══════════════════════════════════════════════════

const REWARD_TYPE_CONFIG: Record<WarReward['type'], {
  icon: React.ReactNode;
  color: string;
  background: string;
  borderColor: string;
  label: string;
}> = {
  cosmetic: {
    icon: <Sparkles size={14} />,
    color: '#A855F7',
    background: 'rgba(168,85,247,0.08)',
    borderColor: 'rgba(168,85,247,0.25)',
    label: 'Cosmetic',
  },
  xp_bonus: {
    icon: <Zap size={14} />,
    color: '#FACC15',
    background: 'rgba(250,204,21,0.08)',
    borderColor: 'rgba(250,204,21,0.25)',
    label: 'XP Bonus',
  },
  title: {
    icon: <Crown size={14} />,
    color: '#FFD700',
    background: 'rgba(255,215,0,0.08)',
    borderColor: 'rgba(255,215,0,0.25)',
    label: 'Title',
  },
  realm_decoration: {
    icon: <Star size={14} />,
    color: '#06B6D4',
    background: 'rgba(6,182,212,0.08)',
    borderColor: 'rgba(6,182,212,0.25)',
    label: 'Realm Item',
  },
};

// ═══════════════════════════════════════════════════
// TROPHY CASE
// ═══════════════════════════════════════════════════

function TrophyCase({ warWins, guildName }: TrophyCaseProps) {
  const tiers = [
    { threshold: 1, emoji: '🏆', label: 'First Victory', color: '#CD7F32' },
    { threshold: 3, emoji: '🏆🏆', label: 'Warriors', color: '#C0C0C0' },
    { threshold: 5, emoji: '🏆🏆🏆', label: 'Conquerors', color: '#FFD700' },
    { threshold: 10, emoji: '👑', label: 'Domination', color: '#E5E4E2' },
    { threshold: 25, emoji: '🔥', label: 'Legendary', color: '#F97316' },
  ];

  return (
    <div style={trophyCaseStyle}>
      <div style={trophyHeaderStyle}>
        <Trophy size={16} style={{ color: '#FFD700' }} />
        <span style={{ fontWeight: 700, color: '#FFD700' }}>Trophy Case</span>
        <span style={trophyCountStyle}>{warWins} wins</span>
      </div>
      <div style={trophyGridStyle}>
        {tiers.map((tier) => {
          const unlocked = warWins >= tier.threshold;
          return (
            <div
              key={tier.threshold}
              style={trophyItemStyle(unlocked, tier.color)}
            >
              <div style={{ fontSize: 24, opacity: unlocked ? 1 : 0.2, transition: 'opacity 0.3s' }}>
                {tier.emoji}
              </div>
              <div style={{ fontSize: 11, color: unlocked ? tier.color : '#4B5563', fontWeight: 600, textAlign: 'center' }}>
                {tier.label}
              </div>
              <div style={{ fontSize: 10, color: '#64748B' }}>
                {unlocked ? 'Unlocked!' : `${tier.threshold} wins`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// REWARD CARD
// ═══════════════════════════════════════════════════

function RewardCard({ reward }: { reward: WarReward }) {
  const config = REWARD_TYPE_CONFIG[reward.type];
  const [hover, setHover] = useState(false);

  return (
    <div
      className="wr-reward-card"
      style={{
        ...rewardCardStyle,
        background: hover ? `${config.color}11` : config.background,
        borderColor: hover ? `${config.color}55` : config.borderColor,
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={rewardIconStyle(reward.icon, config.color)}>
        {reward.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#F9FAFB', marginBottom: 2 }}>
          {reward.name}
        </div>
        <div style={{ fontSize: 11, color: '#94A3B8' }}>
          {reward.description}
        </div>
      </div>
      <div style={rewardTypeBadgeStyle(config.color, config.background)}>
        {config.icon}
        <span>{config.label}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// SEASON BADGE
// ═══════════════════════════════════════════════════

function SeasonChampionshipBadge({ warWins }: { warWins: number }) {
  if (warWins < 5) return null;

  const tier =
    warWins >= 25 ? { label: 'Legendary Champion', icon: '🔥', color: '#F97316' } :
    warWins >= 10 ? { label: 'Season Champion', icon: '👑', color: '#FFD700' } :
    { label: 'War Veteran', icon: '⚔️', color: '#A855F7' };

  return (
    <div
      className="wr-season-badge"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 18px',
        borderRadius: 12,
        background: `${tier.color}0D`,
        border: `1px solid ${tier.color}33`,
        marginBottom: 16,
      }}
    >
      <span style={{ fontSize: 28 }}>{tier.icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: tier.color }}>{tier.label}</div>
        <div style={{ fontSize: 12, color: '#94A3B8' }}>{warWins} war victories — {guildName || 'This guild'} dominates!</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export function WarRewards({ rewards, warWins, guildName, compact }: WarRewardsProps) {
  const [filterType, setFilterType] = useState<WarReward['type'] | 'all'>('all');

  const filteredRewards = useMemo(() => {
    if (filterType === 'all') return rewards;
    return rewards.filter((r) => r.type === filterType);
  }, [rewards, filterType]);

  // Group rewards by type for stats
  const rewardStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const r of rewards) {
      stats[r.type] = (stats[r.type] || 0) + 1;
    }
    return stats;
  }, [rewards]);

  if (compact) {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {rewards.slice(0, 4).map((reward, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: 13,
            }}
          >
            {reward.icon} {reward.name}
          </div>
        ))}
        {rewards.length > 4 && (
          <div style={{ fontSize: 12, color: '#64748B', alignSelf: 'center' }}>
            +{rewards.length - 4} more
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wr-container" style={containerStyle}>
      {/* Season Badge */}
      <SeasonChampionshipBadge warWins={warWins} />

      {/* Trophy Case */}
      <TrophyCase warWins={warWins} guildName={guildName} />

      {/* Rewards Header */}
      <div style={rewardsHeaderStyle}>
        <Gift size={16} style={{ color: '#F97316' }} />
        <span style={{ fontWeight: 700, color: '#F9FAFB' }}>War Rewards</span>
        <span style={trophyCountStyle}>{rewards.length} earned</span>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['all', 'cosmetic', 'xp_bonus', 'title', 'realm_decoration'] as const).map((type) => {
          const isActive = filterType === type;
          const config = type === 'all'
            ? { color: '#94A3B8', label: 'All' }
            : { color: REWARD_TYPE_CONFIG[type].color, label: REWARD_TYPE_CONFIG[type].label };

          return (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: isActive ? `1px solid ${config.color}55` : '1px solid rgba(255,255,255,0.08)',
                background: isActive ? `${config.color}15` : 'transparent',
                color: isActive ? config.color : '#64748B',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {type === 'all' ? 'All' : config.label}
              {type !== 'all' && rewardStats[type] && (
                <span style={{ marginLeft: 4, opacity: 0.6 }}>({rewardStats[type]})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Reward Cards */}
      {filteredRewards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748B' }}>
          <Shield size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
          <div style={{ fontSize: 13 }}>No {filterType !== 'all' ? REWARD_TYPE_CONFIG[filterType].label.toLowerCase() : ''} rewards yet</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>Win wars to unlock rewards!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredRewards.map((reward, i) => (
            <RewardCard key={`${reward.type}-${i}`} reward={reward} />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════

const containerStyle: React.CSSProperties = {
  background: 'rgba(15,15,20,0.6)',
  borderRadius: 16,
  padding: 20,
  border: '1px solid rgba(255,255,255,0.06)',
};

const trophyCaseStyle: React.CSSProperties = {
  marginBottom: 20,
};

const trophyHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
};

const trophyCountStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#64748B',
  marginLeft: 'auto',
  padding: '2px 8px',
  borderRadius: 4,
  background: 'rgba(255,255,255,0.04)',
};

const trophyGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
  gap: 8,
};

function trophyItemStyle(unlocked: boolean, color: string): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: 12,
    borderRadius: 10,
    background: unlocked ? `${color}0D` : 'rgba(255,255,255,0.02)',
    border: unlocked ? `1px solid ${color}33` : '1px solid rgba(255,255,255,0.04)',
    textAlign: 'center',
  };
}

const rewardCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.08)',
  transition: 'all 0.2s ease-out',
};

function rewardIconStyle(emoji: string, color: string): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    background: `${color}15`,
    border: `1px solid ${color}22`,
    flexShrink: 0,
  };
}

function rewardTypeBadgeStyle(color: string, bg: string): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 6,
    background: bg,
    color,
    fontSize: 10,
    fontWeight: 600,
    flexShrink: 0,
  };
}

const rewardsHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
};

export const warRewardsStyles = `
.wr-reward-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.wr-season-badge {
  animation: wrBadgeGlow 3s ease-in-out infinite;
}

@keyframes wrBadgeGlow {
  0%, 100% { box-shadow: 0 0 0 rgba(0,0,0,0); }
  50% { box-shadow: 0 0 16px rgba(249,115,22,0.15); }
}
`;