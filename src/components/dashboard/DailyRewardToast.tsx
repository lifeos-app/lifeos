// DailyRewardToast — Animated daily login reward notification
// Shows on dashboard load if user hasn't claimed today's reward.
// Auto-dismisses after 5 seconds if no interaction.

import { useState, useEffect, useCallback } from 'react';
import { Gift, Flame, Sparkles, X } from 'lucide-react';
import { shouldShowDailyReward, claimDailyReward, getDailyRewardInfo, type DailyRewardInfo } from '../../lib/daily-rewards';
import { awardXP } from '../../lib/gamification/xp-engine';
import { useUserStore } from '../../stores/useUserStore';
import './DailyRewardToast.css';

const AUTO_DISMISS_MS = 5000;

export function DailyRewardToast() {
  const user = useUserStore(s => s.user);
  const [visible, setVisible] = useState(false);
  const [info, setInfo] = useState<DailyRewardInfo | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (shouldShowDailyReward()) {
      const rewardInfo = getDailyRewardInfo();
      setInfo(rewardInfo);
      setVisible(true);
    }
  }, []);

  // Auto-dismiss timer
  useEffect(() => {
    if (!visible || claimed) return;
    const timer = setTimeout(() => {
      handleDismiss();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible, claimed]);

  const handleDismiss = useCallback(() => {
    setDismissing(true);
    setTimeout(() => {
      setVisible(false);
      setDismissing(false);
    }, 300); // match CSS transition duration
  }, []);

  const handleClaim = useCallback(async () => {
    if (!info || claimed || !user?.id) return;
    const xpAmount = claimDailyReward();
    if (xpAmount > 0) {
      // Award daily reward XP through xp-engine with exact tier amount.
      // The 'daily_reward' action type + dailyRewardXP metadata tells
      // calculateXP to use the tier amount as the base XP.
      await awardXP(null, user.id, 'daily_reward', {
        dailyRewardXP: xpAmount,
        description: `Daily login reward — Day ${info.streakDay} streak`,
      });
    }
    setClaimed(true);
    setTimeout(() => handleDismiss(), 1500);
  }, [info, claimed, user?.id, handleDismiss]);

  if (!visible || !info) return null;

  return (
    <div
      className={`daily-reward-toast ${dismissing ? 'dismiss' : ''} ${claimed ? 'claimed' : ''}`}
      role="alert"
      aria-label={`Daily reward: Day ${info.streakDay} streak`}
    >
      {/* Streak fire animation for 7+ days */}
      {info.isOnFire && !claimed && (
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

      <div className="daily-reward-icon">
        {info.isOnFire ? (
          <Flame size={28} style={{ color: 'var(--accent-orange)' }} />
        ) : (
          <Gift size={28} style={{ color: 'var(--accent-gold)' }} />
        )}
      </div>

      <div className="daily-reward-content">
        <div className="daily-reward-title">
          {claimed ? (
            <>
              <Sparkles size={16} style={{ color: 'var(--accent-neon)', verticalAlign: 'middle' }} />
              {' '}Claimed!
            </>
          ) : (
            <>Day {info.streakDay} Streak!</>
          )}
        </div>
        <div className="daily-reward-xp">
          +{info.xpReward} XP {claimed ? 'earned' : 'available'}
        </div>
        {info.isOnFire && (
          <div className="daily-reward-badge">WEEKLY BONUS</div>
        )}
      </div>

      {!claimed && (
        <button
          className="daily-reward-claim-btn"
          onClick={handleClaim}
          aria-label="Claim daily reward"
        >
          Claim
        </button>
      )}

      {claimed && (
        <div className="daily-reward-check" aria-label="Reward claimed">
          ✓
        </div>
      )}
    </div>
  );
}