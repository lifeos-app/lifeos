// ChallengeCard — Shows active weekly & monthly challenges with progress
// Displays below the DailyRewardToast on the dashboard.

import { useState, useEffect, useCallback } from 'react';
import { Trophy, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import {
  getActiveChallenges,
  claimChallengeReward,
  type ActiveChallenge,
} from '../../lib/challenges';
import { awardXP } from '../../lib/gamification/xp-engine';
import { useUserStore } from '../../stores/useUserStore';
import './ChallengeCard.css';

export function ChallengeCard() {
  const user = useUserStore(s => s.user);
  const [challenges, setChallenges] = useState<{ weekly: ActiveChallenge | null; monthly: ActiveChallenge | null } | null>(null);
  const [monthlyExpanded, setMonthlyExpanded] = useState(false);
  const [claimingWeekly, setClaimingWeekly] = useState(false);
  const [claimingMonthly, setClaimingMonthly] = useState(false);
  const [justClaimedWeekly, setJustClaimedWeekly] = useState(false);
  const [justClaimedMonthly, setJustClaimedMonthly] = useState(false);

  // Refresh challenge state on mount and periodically
  const refresh = useCallback(() => {
    setChallenges(getActiveChallenges());
  }, []);

  useEffect(() => {
    refresh();
    // Re-check on window focus
    window.addEventListener('focus', refresh);
    // Poll every 60 seconds for day rollovers
    const interval = setInterval(refresh, 60000);
    return () => {
      window.removeEventListener('focus', refresh);
      clearInterval(interval);
    };
  }, [refresh]);

  // Listen for custom challenge-progress events from xp-engine integration
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('challenge-progress', handler);
    return () => window.removeEventListener('challenge-progress', handler);
  }, [refresh]);

  if (!challenges || (!challenges.weekly && !challenges.monthly)) return null;

  const { weekly, monthly } = challenges;

  const handleClaimWeekly = async () => {
    if (!weekly || !weekly.completed || weekly.claimed || !user?.id) return;
    setClaimingWeekly(true);
    const xpReward = claimChallengeReward(weekly.id);
    if (xpReward > 0) {
      await awardXP(null, user.id, 'daily_reward' as any, {
        dailyRewardXP: xpReward,
        description: `Weekly challenge complete: ${weekly.title}`,
      } as any);
    }
    setJustClaimedWeekly(true);
    setTimeout(() => setJustClaimedWeekly(false), 2000);
    setClaimingWeekly(false);
    refresh();
  };

  const handleClaimMonthly = async () => {
    if (!monthly || !monthly.completed || monthly.claimed || !user?.id) return;
    setClaimingMonthly(true);
    const xpReward = claimChallengeReward(monthly.id);
    if (xpReward > 0) {
      await awardXP(null, user.id, 'daily_reward' as any, {
        dailyRewardXP: xpReward,
        description: `Monthly challenge complete: ${monthly.title}`,
      } as any);
    }
    setJustClaimedMonthly(true);
    setTimeout(() => setJustClaimedMonthly(false), 2000);
    setClaimingMonthly(false);
    refresh();
  };

  return (
    <div className="challenge-card">
      {/* Weekly Challenge */}
      {weekly && (
        <div className="challenge-section challenge-weekly">
          <div className="challenge-header">
            <div className="challenge-icon" style={{ background: `${weekly.accentColor}18`, borderColor: `${weekly.accentColor}30` }}>
              <span className="challenge-emoji">{weekly.icon}</span>
            </div>
            <div className="challenge-info">
              <div className="challenge-label">
                <span className="challenge-type-badge">WEEKLY</span>
                {weekly.daysRemaining > 0 && (
                  <span className="challenge-time-left">{weekly.daysRemaining}d left</span>
                )}
              </div>
              <div className="challenge-title">{weekly.title}</div>
              <div className="challenge-desc">{weekly.description}</div>
            </div>
            <div className="challenge-xp-badge" style={{ color: weekly.accentColor, borderColor: `${weekly.accentColor}30` }}>
              +{weekly.xpReward} XP
            </div>
          </div>

          {/* Progress bar */}
          <div className="challenge-progress-row">
            <div className="challenge-progress-bar">
              <div
                className={`challenge-progress-fill ${weekly.completed ? 'completed' : ''}`}
                style={{
                  width: `${weekly.percentage}%`,
                  background: weekly.completed
                    ? 'linear-gradient(90deg, #39FF14, #00D4FF)'
                    : weekly.accentColor,
                }}
              />
            </div>
            <div className="challenge-progress-text">
              {weekly.completed ? (
                weekly.claimed ? (
                  <span className="challenge-claimed-text">
                    <Sparkles size={12} /> Claimed!
                  </span>
                ) : (
                  <span className="challenge-complete-text">Complete! ✓</span>
                )
              ) : (
                <span>{weekly.progress}/{weekly.target}</span>
              )}
            </div>
          </div>

          {/* Claim button */}
          {weekly.completed && !weekly.claimed && (
            <button
              className={`challenge-claim-btn ${justClaimedWeekly ? 'just-claimed' : ''}`}
              onClick={handleClaimWeekly}
              disabled={claimingWeekly}
              style={{ '--btn-accent': weekly.accentColor } as React.CSSProperties}
            >
              {justClaimedWeekly ? (
                <><Sparkles size={14} /> Claimed!</>
              ) : claimingWeekly ? (
                'Claiming...'
              ) : (
                <><Trophy size={14} /> Claim {weekly.xpReward} XP</>
              )}
            </button>
          )}
        </div>
      )}

      {/* Monthly Challenge (collapsed by default) */}
      {monthly && (
        <div className={`challenge-section challenge-monthly ${monthlyExpanded ? 'expanded' : ''}`}>
          <button
            className="challenge-monthly-toggle"
            onClick={() => setMonthlyExpanded(!monthlyExpanded)}
            aria-expanded={monthlyExpanded}
            aria-label="Toggle monthly challenge details"
          >
            <div className="challenge-header">
              <div className="challenge-icon challenge-icon-monthly" style={{ background: `${monthly.accentColor}18`, borderColor: `${monthly.accentColor}30` }}>
                <span className="challenge-emoji">{monthly.icon}</span>
              </div>
              <div className="challenge-info">
                <div className="challenge-label">
                  <span className="challenge-type-badge monthly-badge">MONTHLY</span>
                  {monthly.daysRemaining > 0 && (
                    <span className="challenge-time-left">{monthly.daysRemaining}d left</span>
                  )}
                </div>
                <div className="challenge-title">{monthly.title}</div>
                {!monthlyExpanded && (
                  <div className="challenge-desc-compact">
                    {monthly.percentage}% — {monthly.progress}/{monthly.target}
                  </div>
                )}
              </div>
              <div className="challenge-xp-badge challenge-xp-monthly" style={{ color: monthly.accentColor, borderColor: `${monthly.accentColor}30` }}>
                +{monthly.xpReward} XP
              </div>
            </div>
            <div className="challenge-expand-icon">
              {monthlyExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {monthlyExpanded && (
            <div className="challenge-monthly-details">
              <div className="challenge-desc">{monthly.description}</div>
              <div className="challenge-progress-row">
                <div className="challenge-progress-bar">
                  <div
                    className={`challenge-progress-fill ${monthly.completed ? 'completed' : ''}`}
                    style={{
                      width: `${monthly.percentage}%`,
                      background: monthly.completed
                        ? 'linear-gradient(90deg, #FFD700, #FFA500)'
                        : monthly.accentColor,
                    }}
                  />
                </div>
                <div className="challenge-progress-text">
                  {monthly.completed ? (
                    monthly.claimed ? (
                      <span className="challenge-claimed-text">
                        <Sparkles size={12} /> Claimed!
                      </span>
                    ) : (
                      <span className="challenge-complete-text">Complete! ✓</span>
                    )
                  ) : (
                    <span>{monthly.progress}/{monthly.target}</span>
                  )}
                </div>
              </div>

              {monthly.completed && !monthly.claimed && (
                <button
                  className={`challenge-claim-btn challenge-claim-monthly ${justClaimedMonthly ? 'just-claimed' : ''}`}
                  onClick={handleClaimMonthly}
                  disabled={claimingMonthly}
                  style={{ '--btn-accent': monthly.accentColor } as React.CSSProperties}
                >
                  {justClaimedMonthly ? (
                    <><Sparkles size={14} /> Claimed!</>
                  ) : claimingMonthly ? (
                    'Claiming...'
                  ) : (
                    <><Trophy size={14} /> Claim {monthly.xpReward} XP</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}