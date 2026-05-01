/**
 * CircleDashboard.tsx — The circle overview
 *
 * Family members grid with today's progress, streak counter,
 * shared goals progress, mini calendar, activity feed, and nudge button.
 * Warm and intimate design.
 */

import { useMemo } from 'react';
import { useFamilyCircles } from './useFamilyCircles';

export function CircleDashboard() {
  const { activeCircle, circleHealth, recentActivity, fallingBehind, nudgeMember } = useFamilyCircles();

  const circle = activeCircle;
  if (!circle) return null;

  const today = new Date().toISOString().split('T')[0];

  // ── Computed ────────────────────────────────────────────────

  const memberProgress = useMemo(() => {
    if (!circle) return [];
    return circle.members.map(member => {
      // Habit completion today
      const habitsToday = circle.sharedHabits
        .filter(h => h.assignedTo.includes(member.id))
        .filter(h => (h.completionsByMember[member.id] || []).includes(today))
        .length;
      const totalHabits = circle.sharedHabits.filter(h => h.assignedTo.includes(member.id)).length;

      // Goal progress average
      const assignedGoals = circle.sharedGoals.filter(g => g.assignedTo.includes(member.id));
      const avgGoalProgress = assignedGoals.length > 0
        ? assignedGoals.reduce((sum, g) => sum + (g.progressByMember[member.id] ?? 0), 0) / assignedGoals.length
        : 0;

      const habitPercent = totalHabits > 0 ? (habitsToday / totalHabits) * 100 : 100;
      const overallScore = totalHabits > 0
        ? Math.round((habitPercent * 0.6 + avgGoalProgress * 0.4))
        : Math.round(avgGoalProgress);

      return {
        member,
        habitsDone: habitsToday,
        habitsTotal: totalHabits,
        avgGoalProgress: Math.round(avgGoalProgress),
        overallScore,
      };
    });
  }, [circle, today]);

  const goalProgress = useMemo(() => {
    if (!circle) return [];
    return circle.sharedGoals.map(goal => {
      const avgProgress = goal.assignedTo.length > 0
        ? goal.assignedTo.reduce((sum, id) => sum + (goal.progressByMember[id] ?? 0), 0) / goal.assignedTo.length
        : 0;
      return { goal, avgProgress: Math.round(avgProgress) };
    });
  }, [circle]);

  // ── Week days for mini calendar ─────────────────────────────

  const weekDays = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      days.push({
        label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
        date: d.toISOString().split('T')[0],
        isToday: d.toISOString().split('T')[0] === today,
      });
    }
    return days;
  }, [today]);

  return (
    <div className="space-y-4">
      {/* Streak Counter */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-900/20 to-amber-900/20 border border-orange-500/15">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🔥</span>
            <div>
              <div className="text-2xl font-bold text-amber-100">{circle.familyStreak}</div>
              <div className="text-[10px] text-amber-300/50 uppercase tracking-wider">Day Streak</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-amber-200/70">
              {circle.familyStreak > 0
                ? circle.familyStreak >= 30
                  ? 'Unstoppable!'
                  : circle.familyStreak >= 7
                    ? 'Strong week!'
                    : 'Keep it going!'
                : 'Start your streak today'}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          {weekDays.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-amber-300/40">{d.label}</span>
              <div
                className={`w-full h-1.5 rounded-full ${
                  d.isToday
                    ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                    : i < 6 && circle.familyStreak > (6 - i)
                      ? 'bg-amber-500/40'
                      : 'bg-white/10'
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Member Progress Grid */}
      <div>
        <h3 className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-2">Today's Progress</h3>
        <div className="space-y-2">
          {memberProgress.map(({ member, habitsDone, habitsTotal, avgGoalProgress, overallScore }) => (
            <div key={member.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-600/30 to-rose-600/30 flex items-center justify-center text-base border border-amber-400/15">
                  {member.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-amber-100 truncate">{member.name}</span>
                    <span className="text-xs font-mono" style={{ color: overallScore >= 70 ? '#10B981' : overallScore >= 40 ? '#F59E0B' : '#EF4444' }}>
                      {overallScore}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-1.5">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${overallScore}%`,
                    background: overallScore >= 70
                      ? 'linear-gradient(90deg, #10B981, #34D399)'
                      : overallScore >= 40
                        ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                        : 'linear-gradient(90deg, #EF4444, #F87171)',
                  }}
                />
              </div>
              <div className="flex gap-3 text-[9px] text-white/40">
                <span>✅ {habitsDone}/{habitsTotal} habits</span>
                <span>🎯 {avgGoalProgress}% goals</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shared Goals Progress */}
      {goalProgress.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-2">Shared Goals</h3>
          <div className="space-y-2">
            {goalProgress.slice(0, 5).map(({ goal, avgProgress }) => (
              <div key={goal.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-amber-100 font-medium">{goal.title}</span>
                  <span className="text-xs text-white/40">{avgProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${avgProgress}%`,
                      background: avgProgress >= 80
                        ? 'linear-gradient(90deg, #10B981, #34D399)'
                        : avgProgress >= 50
                          ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                          : 'linear-gradient(90deg, #3B82F6, #60A5FA)',
                    }}
                  />
                </div>
                {/* Per-member breakdown */}
                <div className="flex gap-2 mt-1.5">
                  {goal.assignedTo.map(id => {
                    const member = circle.members.find(m => m.id === id);
                    const progress = goal.progressByMember[id] ?? 0;
                    return (
                      <div key={id} className="flex items-center gap-1">
                        <span className="text-[10px]">{member?.avatar || '👤'}</span>
                        <div className="w-8 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: progress >= 100 ? '#10B981' : progress >= 50 ? '#F59E0B' : '#3B82F6',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Who's Falling Behind */}
      {fallingBehind.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-2">Needs Support</h3>
          <div className="space-y-2">
            {fallingBehind.map((fb, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-amber-900/15 border border-amber-500/10">
                <span className="text-lg">💛</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-amber-100">
                    <span className="font-medium">{fb.name}</span> is behind on "{fb.goalTitle}" ({fb.progress}%)
                  </p>
                </div>
                <button
                  onClick={() => {
                    const fromId = circle.members[0]?.id;
                    if (fromId) nudgeMember(circle.id, fb.memberId, fromId);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] bg-pink-600/20 border border-pink-500/20 text-pink-200 hover:bg-pink-500/30 transition-all"
                >
                  💕 Nudge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mini Calendar */}
      <div>
        <h3 className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-2">This Week</h3>
        <div className="flex gap-1.5">
          {weekDays.map((d, i) => (
            <div key={i} className={`flex-1 text-center py-2 rounded-lg border ${d.isToday ? 'bg-amber-600/20 border-amber-400/30' : 'bg-white/[0.03] border-white/5'}`}>
              <div className="text-[9px] text-white/40 mb-0.5">{d.label}</div>
              <div className={`text-sm font-medium ${d.isToday ? 'text-amber-200' : 'text-white/50'}`}>
                {d.date.split('-')[2]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-2">Recent Activity</h3>
          <div className="space-y-1.5">
            {recentActivity.slice(0, 8).map(a => {
              const typeEmoji: Record<string, string> = { habit: '✅', goal: '🎯', budget: '💵', nudge: '💕', achievement: '🏆', member: '👋' };
              return (
                <div key={a.id} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-[10px] mt-0.5">{typeEmoji[a.type] || '•'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/50">
                      <span className="text-amber-200/70 font-medium">{a.memberName || 'Family'}</span>
                      {' '}{a.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}