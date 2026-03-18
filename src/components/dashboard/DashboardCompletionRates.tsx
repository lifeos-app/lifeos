/**
 * Dashboard Completion Rates Widget
 * 
 * Shows overall completion rate ring, trend line, best/worst days,
 * category breakdown, and goal velocity.
 */

import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Trophy, AlertTriangle, Target, Zap } from 'lucide-react';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { getCompletionRates } from '../../lib/completion-analytics';
import { useUserStore } from '../../stores/useUserStore';
import { EmojiIcon } from '../../lib/emoji-icon';
import './DashboardCompletionRates.css';

type TimeRange = 'today' | 'week' | 'month';

export function DashboardCompletionRates() {
  const user = useUserStore(s => s.user);
  const tasks = useScheduleStore(s => s.tasks);
  const goals = useGoalsStore(s => s.goals);
  const habits = useHabitsStore(s => s.habits);
  const habitLogs = useHabitsStore(s => s.logs);

  const [timeRange, setTimeRange] = useState<TimeRange>('week');

  // Compute analytics
  const analytics = useMemo(() => {
    if (!user?.id) return null;

    return getCompletionRates(user.id, {
      tasks: tasks.map(t => ({
        id: t.id,
        status: t.status,
        completed_at: t.completed_at || null,
        due_date: t.due_date || null,
        goal_id: t.goal_id || null,
        created_at: t.created_at || new Date().toISOString(),
      })),
      goals: goals.map(g => ({
        id: g.id,
        title: g.title,
        icon: g.icon,
        progress: g.progress || 0,
        target_date: g.target_date,
        domain: g.domain as string | undefined,
        category: g.category as string | undefined,
      })),
      habits: habits.map(h => ({ id: h.id, title: h.title })),
      habitLogs: habitLogs.map(l => ({ habit_id: l.habit_id, date: l.date, completed: l.count > 0 })),
    });
  }, [user?.id, tasks, goals, habits, habitLogs]);

  if (!analytics) {
    return (
      <section className="dcr-widget">
        <div className="dcr-loading">Loading analytics...</div>
      </section>
    );
  }

  // Get rate based on time range
  const currentRate = timeRange === 'today'
    ? (analytics.daily[analytics.daily.length - 1]?.rate || 0)
    : timeRange === 'week'
      ? analytics.weeklyAverage
      : analytics.monthlyAverage;

  // Get trend data (last 14 days)
  const trendData = analytics.daily.slice(-14).map(d => d.rate);
  const trendLabels = analytics.daily.slice(-14).map(d => {
    const date = new Date(d.date + 'T00:00:00');
    return date.toLocaleDateString('en', { weekday: 'short' });
  });

  // Top 3 fastest-moving goals
  const topGoals = analytics.goalVelocity.slice(0, 3);

  return (
    <section className="dcr-widget">
      <div className="dcr-header">
        <div className="dcr-header-left">
          <h2 className="dcr-title"><Target size={16} /> Completion Analytics</h2>
          <p className="dcr-subtitle">Your productivity insights</p>
        </div>
        <div className="dcr-time-toggle">
          {(['today', 'week', 'month'] as TimeRange[]).map(range => (
            <button
              key={range}
              className={`dcr-time-btn ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range === 'today' ? 'Today' : range === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      <div className="dcr-grid">
        {/* Overall completion ring */}
        <div className="dcr-ring-card">
          <div className="dcr-ring-container">
            <svg className="dcr-ring-svg" viewBox="0 0 100 100">
              <circle
                className="dcr-ring-bg"
                cx="50"
                cy="50"
                r="40"
                fill="none"
                strokeWidth="8"
              />
              <circle
                className="dcr-ring-fill"
                cx="50"
                cy="50"
                r="40"
                fill="none"
                strokeWidth="8"
                strokeDasharray={`${(currentRate / 100) * 251.2} 251.2`}
                transform="rotate(-90 50 50)"
                style={{ stroke: currentRate >= 80 ? '#39FF14' : currentRate >= 50 ? '#F97316' : '#F43F5E' }}
              />
            </svg>
            <div className="dcr-ring-text">
              <div className="dcr-ring-pct">{Math.round(currentRate)}%</div>
              <div className="dcr-ring-label">Complete</div>
            </div>
          </div>
          <div className="dcr-ring-stats">
            <div className="dcr-ring-stat">
              <span className="dcr-ring-stat-label">Current Streak</span>
              <span className="dcr-ring-stat-value">{analytics.currentStreak} days</span>
            </div>
            <div className="dcr-ring-stat">
              <span className="dcr-ring-stat-label">Best Streak</span>
              <span className="dcr-ring-stat-value">{analytics.longestStreak} days</span>
            </div>
          </div>
        </div>

        {/* Trend line */}
        <div className="dcr-trend-card">
          <h3 className="dcr-card-title">
            {currentRate >= analytics.monthlyAverage ? (
              <><TrendingUp size={14} style={{ color: '#39FF14' }} /> Trending Up</>
            ) : (
              <><TrendingDown size={14} style={{ color: '#F43F5E' }} /> Trending Down</>
            )}
          </h3>
          <div className="dcr-mini-chart">
            <svg viewBox="0 0 280 80" className="dcr-chart-svg">
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map(y => (
                <line
                  key={y}
                  x1="0"
                  y1={80 - (y * 0.8)}
                  x2="280"
                  y2={80 - (y * 0.8)}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                />
              ))}

              {/* Line chart */}
              <polyline
                points={trendData.map((rate, i) => {
                  const x = (i / (trendData.length - 1)) * 280;
                  const y = 80 - (rate * 0.8);
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke="#00D4FF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Area under line */}
              <polygon
                points={`0,80 ${trendData.map((rate, i) => {
                  const x = (i / (trendData.length - 1)) * 280;
                  const y = 80 - (rate * 0.8);
                  return `${x},${y}`;
                }).join(' ')} 280,80`}
                fill="url(#gradient)"
                opacity="0.2"
              />

              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#00D4FF" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="dcr-trend-labels">
            {trendLabels.map((label, i) => (
              i % 2 === 0 && <span key={i} className="dcr-trend-label">{label}</span>
            ))}
          </div>
        </div>

        {/* Best/Worst Days */}
        <div className="dcr-extremes-card">
          {analytics.bestDay && (
            <div className="dcr-extreme best">
              <Trophy size={16} style={{ color: '#39FF14' }} />
              <div className="dcr-extreme-content">
                <div className="dcr-extreme-label">Best Day</div>
                <div className="dcr-extreme-value">{Math.round(analytics.bestDay.rate)}%</div>
                <div className="dcr-extreme-date">
                  {new Date(analytics.bestDay.date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  {' · '}{analytics.bestDay.count} tasks
                </div>
              </div>
            </div>
          )}
          {analytics.worstDay && (
            <div className="dcr-extreme worst">
              <AlertTriangle size={16} style={{ color: '#F43F5E' }} />
              <div className="dcr-extreme-content">
                <div className="dcr-extreme-label">Needs Work</div>
                <div className="dcr-extreme-value">{Math.round(analytics.worstDay.rate)}%</div>
                <div className="dcr-extreme-date">
                  {new Date(analytics.worstDay.date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  {' · '}{analytics.worstDay.count} tasks
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category Breakdown */}
      {analytics.categoryBreakdown.length > 0 && (
        <div className="dcr-categories">
          <h3 className="dcr-section-title">By Category</h3>
          <div className="dcr-category-bars">
            {analytics.categoryBreakdown.slice(0, 5).map(cat => (
              <div key={cat.category} className="dcr-category-item">
                <div className="dcr-category-header">
                  <span className="dcr-category-label">{cat.label}</span>
                  <span className="dcr-category-stats">
                    {cat.done}/{cat.total} · {Math.round(cat.rate)}%
                  </span>
                </div>
                <div className="dcr-category-bar-bg">
                  <div
                    className="dcr-category-bar-fill"
                    style={{
                      width: `${cat.rate}%`,
                      background: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goal Velocity */}
      {topGoals.length > 0 && (
        <div className="dcr-velocity">
          <h3 className="dcr-section-title">
            <Zap size={14} /> Fastest Moving Goals
          </h3>
          <div className="dcr-velocity-grid">
            {topGoals.map(goal => (
              <div key={goal.goalId} className="dcr-velocity-card">
                <div className="dcr-velocity-icon">
                  <EmojiIcon emoji={goal.goalIcon || '🎯'} size={20} fallbackAsText />
                </div>
                <div className="dcr-velocity-content">
                  <div className="dcr-velocity-title">{goal.goalTitle}</div>
                  <div className="dcr-velocity-stats">
                    <span className="dcr-velocity-rate">
                      {goal.tasksPerWeek.toFixed(1)} tasks/week
                    </span>
                    <span className="dcr-velocity-pct">{Math.round(goal.completionRate)}% done</span>
                  </div>
                </div>
                <div className="dcr-velocity-rank">#{topGoals.indexOf(goal) + 1}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
