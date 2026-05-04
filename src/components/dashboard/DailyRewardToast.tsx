// DailyRewardToast — Animated daily login reward notification
// Shows on dashboard load if user hasn't claimed today's reward.
// Features Duolingo-style chest-opening animation with tier-based visuals.
// Auto-dismisses after 15 seconds if not claimed (chest idle → auto-open at 1.5s).

import { useState, useEffect, useCallback, useRef } from 'react';
import { Gift, Flame, Sparkles, X, Coins, Star, Crown, Zap } from 'lucide-react';
import { shouldShowDailyReward, claimDailyReward, getDailyRewardInfo, type DailyRewardInfo } from '../../lib/daily-rewards';
import { awardXP } from '../../lib/gamification/xp-engine';
import { useUserStore } from '../../stores/useUserStore';
import './DailyRewardToast.css';

// ── CHEST ANIMATION STATE MACHINE ──
type ChestPhase = 'idle' | 'opening' | 'revealed' | 'claimed';

// ── REWARD TIER CONFIG ──
type ChestTier = 'bronze' | 'silver' | 'gold' | 'diamond';

interface TierConfig {
  glow: string;
  particleColor: string;
  gradient: string;
  bonusXP: number;
  bonusIcon: typeof Coins;
  bonusLabel: string;
  particleCount: number;
}

const TIER_CONFIGS: Record<ChestTier, TierConfig> = {
  bronze: {
    glow: 'rgba(205, 127, 50, 0.6)',
    particleColor: '#cd7f32',
    gradient: 'linear-gradient(135deg, #cd7f32, #b8860b)',
    bonusXP: 0,
    bonusIcon: Coins,
    bonusLabel: 'XP Coins',
    particleCount: 8,
  },
  silver: {
    glow: 'rgba(192, 192, 192, 0.7)',
    particleColor: '#c0c0c0',
    gradient: 'linear-gradient(135deg, #c0c0c0, #a8a8a8)',
    bonusXP: 25,
    bonusIcon: Star,
    bonusLabel: 'Silver Star',
    particleCount: 10,
  },
  gold: {
    glow: 'rgba(255, 215, 0, 0.75)',
    particleColor: '#ffd700',
    gradient: 'linear-gradient(135deg, #ffd700, #ffaa00)',
    bonusXP: 50,
    bonusIcon: Crown,
    bonusLabel: 'Gold Crown',
    particleCount: 12,
  },
  diamond: {
    glow: 'rgba(185, 242, 255, 0.8)',
    particleColor: '#b9f2ff',
    gradient: 'linear-gradient(135deg, #b9f2ff, #e0aaff, #ffd700)',
    bonusXP: 100,
    bonusIcon: Zap,
    bonusLabel: 'Diamond Bolt',
    particleCount: 14,
  },
};

function getChestTier(streakDay: number): ChestTier {
  if (streakDay >= 30) return 'diamond';
  if (streakDay >= 14) return 'gold';
  if (streakDay >= 7) return 'silver';
  return 'bronze';
}

// ── PARTICLE COMPONENT ──
function ChestParticles({ count, color }: { count: number; color: string }) {
  const particles = Array.from({ length: count }, (_, i) => {
    const angle = (360 / count) * i;
    const delay = Math.random() * 0.15;
    const distance = 40 + Math.random() * 30;
    return (
      <span
        key={i}
        className="chest-particle"
        style={{
          '--chest-particle-color': color,
          '--chest-angle': `${angle}deg`,
          '--chest-distance': `${distance}px`,
          animationDelay: `${delay}s`,
        } as React.CSSProperties}
      />
    );
  });
  return <div className="chest-particles">{particles}</div>;
}

// ── XP COUNTER ANIMATION ──
function AnimatedXPCounter({ target, visible }: { target: number; visible: boolean }) {
  const [displayXP, setDisplayXP] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!visible) {
      setDisplayXP(0);
      return;
    }
    const duration = 800;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayXP(Math.round(eased * target));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, visible]);

  return <span className="chest-xp-counter">+{displayXP} XP</span>;
}

// ── FLY-UP ITEMS COMPONENT ──
function ChestFlyUpItems({ tier, xpReward }: { tier: ChestTier; xpReward: number }) {
  const config = TIER_CONFIGS[tier];
  const BonusIcon = config.bonusIcon;
  const flyItems = [
    { Icon: Coins, label: `${xpReward} XP`, delay: '0s', x: '-30px' },
    { Icon: Flame, label: 'Streak', delay: '0.1s', x: '0px' },
    { Icon: BonusIcon, label: config.bonusLabel, delay: '0.2s', x: '30px' },
  ];
  return (
    <div className="chest-fly-up-items">
      {flyItems.map((item, i) => (
        <div
          key={i}
          className="chest-fly-up-item"
          style={{ animationDelay: item.delay, '--fly-x': item.x } as React.CSSProperties}
        >
          <item.Icon size={18} />
          <span className="chest-fly-up-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── MAIN COMPONENT ──
const AUTO_DISMISS_MS = 15000;
const CHEST_AUTO_OPEN_MS = 1500;
const CHEST_OPEN_DURATION = 600;
const CHEST_REVEAL_DELAY = 400;

export function DailyRewardToast() {
  const user = useUserStore(s => s.user);
  const [visible, setVisible] = useState(false);
  const [info, setInfo] = useState<DailyRewardInfo | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [chestPhase, setChestPhase] = useState<ChestPhase>('idle');
  const [screenFlash, setScreenFlash] = useState(false);
  const autoOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tier = info ? getChestTier(info.streakDay) : 'bronze';
  const tierConfig = TIER_CONFIGS[tier];
  const totalXP = info ? info.xpReward + tierConfig.bonusXP : 0;

  // Show toast if eligible
  useEffect(() => {
    if (shouldShowDailyReward()) {
      const rewardInfo = getDailyRewardInfo();
      setInfo(rewardInfo);
      setVisible(true);
    }
  }, []);

  // Auto-open chest after 1.5s, auto-dismiss after 15s
  useEffect(() => {
    if (!visible || claimed) return;

    autoOpenTimer.current = setTimeout(() => {
      if (chestPhase === 'idle') {
        handleOpenChest();
      }
    }, CHEST_AUTO_OPEN_MS);

    autoDismissTimer.current = setTimeout(() => {
      handleDismiss();
    }, AUTO_DISMISS_MS);

    return () => {
      if (autoOpenTimer.current) clearTimeout(autoOpenTimer.current);
      if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    };
  }, [visible, claimed, chestPhase]);

  const handleOpenChest = useCallback(() => {
    if (chestPhase !== 'idle') return;
    setChestPhase('opening');
    // Brief screen flash
    setScreenFlash(true);
    setTimeout(() => setScreenFlash(false), 150);
    // After opening animation, reveal items
    setTimeout(() => {
      setChestPhase('revealed');
    }, CHEST_OPEN_DURATION + CHEST_REVEAL_DELAY);
  }, [chestPhase]);

  const handleClaim = useCallback(async () => {
    if (!info || claimed || !user?.id) return;
    const xpAmount = claimDailyReward();
    if (xpAmount > 0) {
      await awardXP(null, user.id, 'daily_reward', {
        dailyRewardXP: xpAmount,
        description: `Daily login reward — Day ${info.streakDay} streak`,
      });
    }
    setChestPhase('claimed');
    setClaimed(true);
    setTimeout(() => handleDismiss(), 1500);
  }, [info, claimed, user?.id, handleDismiss]);

  const handleDismiss = useCallback(() => {
    setDismissing(true);
    setTimeout(() => {
      setVisible(false);
      setDismissing(false);
    }, 300);
  }, []);

  const handleChestTap = useCallback(() => {
    // Haptic-like pulse is handled via CSS :active
    if (chestPhase === 'idle') {
      handleOpenChest();
    }
  }, [chestPhase, handleOpenChest]);

  if (!visible || !info) return null;

  const showOriginalContent = chestPhase === 'claimed' || chestPhase === 'revealed';

  return (
    <>
      {/* Screen flash overlay */}
      {screenFlash && <div className="chest-screen-flash" />}

      <div
        className={`daily-reward-toast ${dismissing ? 'dismiss' : ''} ${claimed ? 'claimed' : ''} chest-tier-${tier}`}
        role="alert"
        aria-label={`Daily reward: Day ${info.streakDay} streak`}
        style={{
          '--chest-glow': tierConfig.glow,
          '--chest-particle-color': tierConfig.particleColor,
          '--chest-gradient': tierConfig.gradient,
        } as React.CSSProperties}
      >
        {/* Streak fire animation for 7+ days — shown before/after chest */}
        {info.isOnFire && !claimed && chestPhase === 'idle' && (
          <div className="daily-reward-fire" aria-hidden="true">
            <span className="fire-particle" style={{ left: '20%', animationDelay: '0s' }}>🔥</span>
            <span className="fire-particle" style={{ left: '50%', animationDelay: '0.3s' }}>🔥</span>
            <span className="fire-particle" style={{ left: '80%', animationDelay: '0.6s' }}>🔥</span>
          </div>
        )}

        <button
          className="daily-reward-close"
          onClick={handleDismiss}
          aria-label="Dismiss daily reward"
        >
          <X size={14} />
        </button>

        {/* ── CHEST ANIMATION AREA ── */}
        {chestPhase !== 'claimed' && (
          <div className="chest-container">
            {/* Idle: closed chest */}
            {chestPhase === 'idle' && (
              <button
                className="chest-icon-btn chest-idle"
                onClick={handleChestTap}
                aria-label="Open daily reward chest"
                style={{ background: tierConfig.gradient }}
              >
                <Gift size={32} className="chest-icon-inner" />
                <div className="chest-lid-line" />
                <div className="chest-idle-pulse" />
              </button>
            )}

            {/* Opening: bounce + glow pulse */}
            {chestPhase === 'opening' && (
              <div className="chest-opening">
                <div className="chest-opening-inner" style={{ background: tierConfig.gradient }}>
                  <Gift size={32} className="chest-icon-inner chest-opening-icon" />
                  <div className="chest-lid-line chest-lid-lifting" />
                  <div className="chest-glow" />
                </div>
                <ChestParticles count={tierConfig.particleCount} color={tierConfig.particleColor} />
              </div>
            )}

            {/* Revealed: light burst + items fly up */}
            {chestPhase === 'revealed' && (
              <div className="chest-revealed">
                <div className="chest-revealed-glow" style={{ background: `radial-gradient(circle, ${tierConfig.glow} 0%, transparent 70%)` }} />
                <div className="chest-opened-icon" style={{ background: tierConfig.gradient }}>
                  <Gift size={28} className="chest-icon-inner" />
                </div>
                <ChestFlyUpItems tier={tier} xpReward={info.xpReward} />
                <AnimatedXPCounter target={totalXP} visible />
              </div>
            )}
          </div>
        )}

        {/* Post-claim: original format with check */}
        {chestPhase === 'claimed' && (
          <>
            <div className="daily-reward-icon">
              <Sparkles size={28} style={{ color: 'var(--accent-neon)' }} />
            </div>
            <div className="daily-reward-content">
              <div className="daily-reward-title">
                <Sparkles size={16} style={{ color: 'var(--accent-neon)', verticalAlign: 'middle' }} />
                {' '}Claimed!
              </div>
              <div className="daily-reward-xp">
                +{totalXP} XP earned
              </div>
            </div>
            <div className="daily-reward-check" aria-label="Reward claimed">
              ✓
            </div>
          </>
        )}

        {/* Claim button — slides up after reveal */}
        {chestPhase === 'revealed' && !claimed && (
          <button
            className="daily-reward-claim-btn chest-claim-btn"
            onClick={handleClaim}
            aria-label="Claim daily reward"
          >
            Claim
          </button>
        )}

        {/* Tier badge for silver+ */}
        {chestPhase === 'revealed' && tier !== 'bronze' && (
          <div className={`chest-tier-badge chest-tier-badge-${tier}`}>
            {tier.charAt(0).toUpperCase() + tier.slice(1)} Chest
          </div>
        )}
      </div>

      {/* Chest animation CSS styles */}
      <style>{`
        /* ── CHEST CONTAINER ── */
        .chest-container {
          position: relative;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          min-height: 56px;
        }

        /* ── IDLE CHEST ── */
        .chest-icon-btn.chest-idle {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          border: 2px solid rgba(255, 215, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          cursor: pointer;
          position: relative;
          overflow: visible;
          -webkit-tap-highlight-color: transparent;
          transition: transform 0.1s ease-out;
        }

        .chest-icon-btn.chest-idle:active {
          transform: scale(0.92);
        }

        .chest-icon-inner {
          color: #fff;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
        }

        .chest-lid-line {
          position: absolute;
          top: 38%;
          left: 20%;
          right: 20%;
          height: 2px;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 1px;
        }

        .chest-idle-pulse {
          position: absolute;
          inset: -6px;
          border-radius: 16px;
          border: 2px solid var(--chest-glow);
          animation: chest-idle-pulse 1.8s ease-out infinite;
          pointer-events: none;
        }

        @keyframes chest-idle-pulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.08); opacity: 0.4; }
          100% { transform: scale(1.15); opacity: 0; }
        }

        /* ── OPENING CHEST ── */
        .chest-opening {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
        }

        .chest-opening-inner {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          position: relative;
          overflow: visible;
          animation: chest-bounce 0.6s cubic-bezier(0.21, 1.2, 0.73, 1) forwards;
          border: 2px solid rgba(255, 215, 0, 0.5);
        }

        .chest-opening-icon {
          animation: chest-icon-pop 0.4s ease-out 0.2s forwards;
        }

        @keyframes chest-bounce {
          0% { transform: scale(1); }
          30% { transform: scale(1.2); }
          50% { transform: scale(0.95); }
          70% { transform: scale(1.08); }
          100% { transform: scale(1.04); }
        }

        @keyframes chest-icon-pop {
          0% { transform: scale(1) translateY(0); }
          50% { transform: scale(0.8) translateY(-4px); }
          100% { transform: scale(1) translateY(0); }
        }

        .chest-lid-lifting {
          animation: chest-lid-lift 0.5s ease-out forwards;
        }

        @keyframes chest-lid-lift {
          0% { top: 38%; opacity: 1; }
          100% { top: 18%; opacity: 0.3; }
        }

        /* ── GLOW EFFECT ── */
        .chest-glow {
          position: absolute;
          inset: -12px;
          border-radius: 24px;
          animation: chest-glow-pulse 0.6s ease-out forwards;
          pointer-events: none;
        }

        @keyframes chest-glow-pulse {
          0% { box-shadow: 0 0 0 0 var(--chest-glow); }
          50% { box-shadow: 0 0 30px 10px var(--chest-glow); }
          100% { box-shadow: 0 0 15px 3px var(--chest-glow); }
        }

        /* ── PARTICLES ── */
        .chest-particles {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 5;
        }

        .chest-particle {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--chest-particle-color);
          top: 50%;
          left: 50%;
          margin-left: -3px;
          margin-top: -3px;
          animation: chest-particle-burst 0.7s cubic-bezier(0.21, 1.02, 0.73, 1) forwards;
          opacity: 0;
          z-index: 5;
        }

        @keyframes chest-particle-burst {
          0% {
            transform: rotate(var(--chest-angle)) translateY(0);
            opacity: 1;
          }
          60% {
            opacity: 0.9;
          }
          100% {
            transform: rotate(var(--chest-angle)) translateY(var(--chest-distance));
            opacity: 0;
          }
        }

        /* ── REVEALED STATE ── */
        .chest-revealed {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          animation: chest-reveal-fadein 0.3s ease-out forwards;
        }

        @keyframes chest-reveal-fadein {
          0% { opacity: 0; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }

        .chest-revealed-glow {
          position: absolute;
          inset: -30px;
          border-radius: 50%;
          animation: chest-light-burst 0.5s ease-out forwards;
          pointer-events: none;
          z-index: 0;
        }

        @keyframes chest-light-burst {
          0% { transform: scale(0.3); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }

        .chest-opened-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 2;
          animation: chest-opened-pop 0.4s cubic-bezier(0.21, 1.2, 0.73, 1) forwards;
          box-shadow: 0 0 16px var(--chest-glow);
        }

        @keyframes chest-opened-pop {
          0% { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        /* ── FLY UP ITEMS ── */
        .chest-fly-up-items {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 6px;
          pointer-events: none;
          z-index: 10;
        }

        .chest-fly-up-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          animation: chest-fly-up 0.6s cubic-bezier(0.21, 1.02, 0.73, 1) forwards;
          opacity: 0;
          color: var(--accent-gold);
          font-size: 10px;
          font-weight: 600;
          transform: translateX(var(--fly-x));
        }

        @keyframes chest-fly-up {
          0% { transform: translateX(var(--fly-x)) translateY(0) scale(0.5); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateX(var(--fly-x)) translateY(-50px) scale(1); opacity: 0; }
        }

        .chest-fly-up-label {
          white-space: nowrap;
        }

        /* ── XP COUNTER ── */
        .chest-xp-counter {
          font-size: 14px;
          font-weight: 700;
          color: var(--accent-gold);
          letter-spacing: 0.5px;
          text-shadow: 0 0 8px var(--chest-glow);
          animation: chest-xp-pop 0.3s ease-out forwards;
        }

        @keyframes chest-xp-pop {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        /* ── CLAIM BUTTON SHIMMER ── */
        .chest-claim-btn {
          animation: chest-claim-slide-up 0.4s cubic-bezier(0.21, 1.02, 0.73, 1) forwards,
                     chest-shimmer 2s linear infinite;
          background-size: 200% 100%;
          background-image: linear-gradient(
            90deg,
            var(--accent-gold) 0%,
            #fff4b0 25%,
            var(--accent-gold) 50%,
            #fff4b0 75%,
            var(--accent-gold) 100%
          );
        }

        @keyframes chest-claim-slide-up {
          0% { transform: translateY(8px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        @keyframes chest-shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }

        /* ── TIER BADGE ── */
        .chest-tier-badge {
          position: absolute;
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.6px;
          padding: 1px 6px;
          border-radius: 4px;
          animation: chest-badge-pop 0.3s ease-out 0.3s forwards;
          opacity: 0;
          white-space: nowrap;
        }

        .chest-tier-badge-silver {
          background: rgba(192, 192, 192, 0.2);
          color: #c0c0c0;
          border: 1px solid rgba(192, 192, 192, 0.4);
        }

        .chest-tier-badge-gold {
          background: rgba(255, 215, 0, 0.2);
          color: #ffd700;
          border: 1px solid rgba(255, 215, 0, 0.4);
        }

        .chest-tier-badge-diamond {
          background: linear-gradient(90deg, rgba(185, 242, 255, 0.2), rgba(224, 170, 255, 0.2), rgba(255, 215, 0, 0.2));
          color: #b9f2ff;
          border: 1px solid rgba(185, 242, 255, 0.4);
        }

        @keyframes chest-badge-pop {
          0% { transform: translateX(-50%) scale(0.7); opacity: 0; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }

        /* ── TIERS ── */
        .chest-tier-bronze .chest-icon-btn.chest-idle {
          border-color: rgba(205, 127, 50, 0.4);
        }

        .chest-tier-silver .chest-icon-btn.chest-idle {
          border-color: rgba(192, 192, 192, 0.4);
        }

        .chest-tier-gold .chest-icon-btn.chest-idle {
          border-color: rgba(255, 215, 0, 0.5);
        }

        .chest-tier-diamond .chest-icon-btn.chest-idle {
          border-color: rgba(185, 242, 255, 0.5);
          animation: chest-diamond-rainbow 3s linear infinite;
        }

        @keyframes chest-diamond-rainbow {
          0% { border-color: rgba(185, 242, 255, 0.5); }
          33% { border-color: rgba(224, 170, 255, 0.5); }
          66% { border-color: rgba(255, 215, 0, 0.5); }
          100% { border-color: rgba(185, 242, 255, 0.5); }
        }

        /* ── SCREEN FLASH ── */
        .chest-screen-flash {
          position: fixed;
          inset: 0;
          background: radial-gradient(circle, rgba(255, 215, 0, 0.15) 0%, transparent 70%);
          animation: chest-flash 0.15s ease-out forwards;
          pointer-events: none;
          z-index: 10000;
        }

        @keyframes chest-flash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </>
  );
}