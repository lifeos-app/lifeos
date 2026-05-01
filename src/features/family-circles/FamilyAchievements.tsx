/**
 * FamilyAchievements.tsx — Family-level achievements
 *
 * "All On Track", "Budget Masters", "Goal Crushers", "Streak Family",
 * and more. Unlock animations, XP contribution, progress indicators.
 * Warm and celebratory design.
 */

import { useState, useMemo } from 'react';
import { useFamilyCircles } from './useFamilyCircles';
import type { FamilyAchievement } from '../../stores/familyStore';

const ACHIEVEMENT_COLORS: Record<string, { bg: string; border: string; glow: string }> = {
  'all-on-track': { bg: 'from-emerald-900/30 to-teal-900/30', border: 'border-emerald-500/25', glow: '#10B981' },
  'budget-masters': { bg: 'from-amber-900/30 to-yellow-900/30', border: 'border-amber-500/25', glow: '#F59E0B' },
  'goal-crushers': { bg: 'from-violet-900/30 to-purple-900/30', border: 'border-violet-500/25', glow: '#8B5CF6' },
  'streak-family': { bg: 'from-orange-900/30 to-red-900/30', border: 'border-orange-500/25', glow: '#F97316' },
  'first-circle': { bg: 'from-amber-900/30 to-rose-900/30', border: 'border-amber-500/25', glow: '#F59E0B' },
  'full-house': { bg: 'from-pink-900/30 to-rose-900/30', border: 'border-pink-500/25', glow: '#EC4899' },
};

export function FamilyAchievements() {
  const { activeCircle, checkAchievements } = useFamilyCircles();
  const [showUnlockAnimation, setShowUnlockAnimation] = useState<string | null>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<FamilyAchievement | null>(null);

  const circle = activeCircle;
  if (!circle) return null;

  const unlocked = useMemo(
    () => circle.achievements.filter(a => a.unlockedAt),
    [circle.achievements]
  );
  const locked = useMemo(
    () => circle.achievements.filter(a => !a.unlockedAt),
    [circle.achievements]
  );
  const totalXP = useMemo(
    () => unlocked.reduce((sum, a) => sum + a.xpReward, 0),
    [unlocked]
  );

  const handleCheck = () => {
    const newly = checkAchievements(circle.id);
    if (newly.length > 0) {
      setNewlyUnlocked(newly[0]);
      setShowUnlockAnimation(newly[0].id);
      setTimeout(() => {
        setShowUnlockAnimation(null);
        setNewlyUnlocked(null);
      }, 4000);
    }
  };

  const getProgressHint = (achievement: FamilyAchievement): string => {
    switch (achievement.condition) {
      case 'streak_7':
        return `${Math.min(circle.familyStreak, 7)}/7 day streak`;
      case 'streak_30':
        return `${Math.min(circle.familyStreak, 30)}/30 day streak`;
      case 'goals_completed_5': {
        const completed = circle.sharedGoals.filter(g =>
          g.assignedTo.every(id => (g.progressByMember[id] ?? 0) >= 100)
        ).length;
        return `${completed}/5 goals completed`;
      }
      case 'budget_under_month': {
        const totalSpent = circle.sharedBudget.categories.reduce((s, c) => s + c.spent, 0);
        const totalLimit = circle.sharedBudget.categories.reduce((s, c) => s + c.limit, 0);
        return totalLimit > 0
          ? `${Math.round((totalSpent / totalLimit) * 100)}% of budget used`
          : 'Set up budget first';
      }
      case 'members_4':
        return `${circle.members.length}/4 members`;
      case 'circle_created':
        return 'Unlocked!';
      default:
        return '';
    }
  };

  const getProgressPercent = (achievement: FamilyAchievement): number => {
    switch (achievement.condition) {
      case 'streak_7':
        return Math.min(100, (circle.familyStreak / 7) * 100);
      case 'streak_30':
        return Math.min(100, (circle.familyStreak / 30) * 100);
      case 'goals_completed_5': {
        const completed = circle.sharedGoals.filter(g =>
          g.assignedTo.every(id => (g.progressByMember[id] ?? 0) >= 100)
        ).length;
        return Math.min(100, (completed / 5) * 100);
      }
      case 'budget_under_month': {
        const totalSpent = circle.sharedBudget.categories.reduce((s, c) => s + c.spent, 0);
        const totalLimit = circle.sharedBudget.categories.reduce((s, c) => s + c.limit, 0);
        return totalLimit > 0
          ? Math.min(100, Math.max(0, (1 - totalSpent / totalLimit) * 100))
          : 0;
      }
      case 'members_4':
        return Math.min(100, (circle.members.length / 4) * 100);
      case 'circle_created':
        return 100;
      default:
        return 0;
    }
  };

  return (
    <div className="space-y-4">
      {/* Unlock Animation Overlay */}
      {showUnlockAnimation && newlyUnlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center animate-bounce">
            <div
              className="w-24 h-24 mx-auto rounded-2xl flex items-center justify-center text-5xl mb-4 shadow-lg"
              style={{
                boxShadow: `0 0 40px ${ACHIEVEMENT_COLORS[showUnlockAnimation]?.glow || '#F59E0B'}40`,
                background: `linear-gradient(135deg, ${ACHIEVEMENT_COLORS[showUnlockAnimation]?.glow || '#F59E0B'}30, transparent)`,
                border: `2px solid ${ACHIEVEMENT_COLORS[showUnlockAnimation]?.glow || '#F59E0B'}60`,
              }}
            >
              {newlyUnlocked.emoji}
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Achievement Unlocked!</h2>
            <p className="text-lg font-semibold text-amber-200 mb-2">{newlyUnlocked.title}</p>
            <p className="text-sm text-white/50 max-w-xs mx-auto mb-3">{newlyUnlocked.description}</p>
            <div
              className="inline-block px-4 py-2 rounded-xl font-bold text-sm"
              style={{
                backgroundColor: (ACHIEVEMENT_COLORS[showUnlockAnimation]?.glow || '#F59E0B') + '30',
                color: ACHIEVEMENT_COLORS[showUnlockAnimation]?.glow || '#F59E0B',
              }}
            >
              +{newlyUnlocked.xpReward} Family XP
            </div>
            <div className="mt-4 text-3xl animate-pulse">✨🎉✨</div>
          </div>
        </div>
      )}

      {/* XP Summary */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-900/20 to-rose-900/20 border border-amber-500/15">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <div>
              <div className="text-lg font-bold text-amber-100">{totalXP} XP</div>
              <div className="text-[10px] text-amber-300/50 uppercase tracking-wider">Family XP Earned</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-amber-200/70">{unlocked.length}/{circle.achievements.length}</div>
            <div className="text-[10px] text-amber-300/40">unlocked</div>
          </div>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-400 transition-all duration-700"
            style={{ width: `${circle.achievements.length > 0 ? (unlocked.length / circle.achievements.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Check Achievements Button */}
      <button
        onClick={handleCheck}
        className="w-full py-2.5 rounded-xl text-xs font-medium bg-gradient-to-r from-amber-600/20 to-rose-600/20 border border-amber-500/15 text-amber-200 hover:from-amber-500/30 hover:to-rose-500/30 transition-all"
      >
        ✨ Check for New Achievements
      </button>

      {/* Unlocked Achievements */}
      {unlocked.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-2">Unlocked 🎉</h3>
          <div className="space-y-2">
            {unlocked.map(achievement => {
              const colors = ACHIEVEMENT_COLORS[achievement.id] || ACHIEVEMENT_COLORS['first-circle'];
              return (
                <div
                  key={achievement.id}
                  className={`p-4 rounded-xl bg-gradient-to-r ${colors.bg} ${colors.border} border relative overflow-hidden`}
                >
                  {/* Glow effect */}
                  <div
                    className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-20 blur-2xl"
                    style={{ backgroundColor: colors.glow }}
                  />
                  <div className="flex items-center gap-3 relative">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{
                        backgroundColor: colors.glow + '20',
                        border: `1px solid ${colors.glow}40`,
                      }}
                    >
                      {achievement.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white">{achievement.title}</h4>
                      <p className="text-[10px] text-white/40 mt-0.5">{achievement.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono" style={{ color: colors.glow }}>+{achievement.xpReward} XP</div>
                      <div className="text-[9px] text-white/25">
                        {achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString() : ''}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Locked Achievements */}
      {locked.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-2">Locked 🔒</h3>
          <div className="space-y-2">
            {locked.map(achievement => {
              const colors = ACHIEVEMENT_COLORS[achievement.id] || ACHIEVEMENT_COLORS['first-circle'];
              const progress = getProgressPercent(achievement);
              const hint = getProgressHint(achievement);

              return (
                <div
                  key={achievement.id}
                  className="p-4 rounded-xl bg-white/[0.03] border border-white/5 relative overflow-hidden"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl opacity-40 grayscale">
                      {achievement.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white/40">{achievement.title}</h4>
                      <p className="text-[10px] text-white/20 mt-0.5">{achievement.description}</p>
                      {hint && (
                        <p className="text-[9px] text-white/25 mt-1">{hint}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono text-white/25">+{achievement.xpReward} XP</div>
                      <div className="text-[9px] text-white/15">{Math.round(progress)}%</div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  {progress > 0 && (
                    <div className="mt-3 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${progress}%`,
                          background: `linear-gradient(90deg, ${colors.glow}80, ${colors.glow})`,
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}