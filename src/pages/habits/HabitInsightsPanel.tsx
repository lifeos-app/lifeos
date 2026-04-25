/**
 * HabitInsightsPanel — 4-tab intelligence panel for the Habits page
 *
 * Tabs: Grit | Keystone | Difficulty | Confidence
 * Compact, collapsible, max 300px per tab.
 */

import { useState, useMemo } from 'react';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useHealthStore } from '../../stores/useHealthStore';
import {
  ChevronDown, ChevronUp, Brain, Key, TrendingUp, ShieldCheck,
  Gauge,
} from 'lucide-react';
import { calculateGritScore, getGritInsight, getCachedGritScore } from '../../lib/grit-score';
import { detectKeystoneHabits, getKeystoneInsight } from '../../lib/keystone-habits';
import { getAllDifficultyAnalyses, DIFFICULTY_COLORS } from '../../lib/habit-difficulty';
import {
  getConfidenceDistribution, getDailyConfidenceStats,
  CONFIDENCE_COLORS,
} from '../../lib/data-confidence';
import type { ConfidenceLevel } from '../../lib/data-confidence';
import type { DifficultyTier } from '../../lib/habit-difficulty';
import type { GritLevel } from '../../lib/grit-score';

// ── Tab types ──────────────────────────────────────────────────

type TabId = 'grit' | 'keystone' | 'difficulty' | 'confidence';

const TABS: { id: TabId; label: string; icon: typeof Brain }[] = [
  { id: 'grit', label: 'Grit', icon: Gauge },
  { id: 'keystone', label: 'Keystone', icon: Key },
  { id: 'difficulty', label: 'Difficulty', icon: TrendingUp },
  { id: 'confidence', label: 'Confidence', icon: ShieldCheck },
];

// ── Grit level colors ──────────────────────────────────────────

const GRIT_COLORS: Record<GritLevel, string> = {
  nascent: '#F43F5E',
  developing: '#D4AF37',
  strong: '#00D4FF',
  exemplary: '#39FF14',
};

// ── Component ──────────────────────────────────────────────────

export function HabitInsightsPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('grit');

  const habits = useHabitsStore(s => s.habits);
  const logs = useHabitsStore(s => s.logs);
  const tasks = useScheduleStore(s => s.tasks);
  const todayMetrics = useHealthStore(s => s.todayMetrics);

  // ── Computed data ──────────────────────────────────────────

  const gritScore = useMemo(() => {
    const cached = getCachedGritScore();
    if (cached) return cached;
    return calculateGritScore(habits, logs, []);
  }, [habits, logs]);

  const keystoneResults = useMemo(() => {
    const healthMetrics = todayMetrics ? [todayMetrics] : [];
    return detectKeystoneHabits(habits, logs, tasks, healthMetrics);
  }, [habits, logs, tasks, todayMetrics]);

  const difficultyAnalyses = useMemo(() => {
    return getAllDifficultyAnalyses(habits, logs);
  }, [habits, logs]);

  const readyToProgress = useMemo(() => {
    return difficultyAnalyses.filter(a => a.readyToProgress);
  }, [difficultyAnalyses]);

  const confidenceStats = useMemo(() => {
    // Get logs from the last 7 days
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const weekLogs = logs.filter(l => l.date >= weekAgoStr);
    const dist = getConfidenceDistribution(weekLogs);
    const daily = getDailyConfidenceStats(weekLogs);
    const avgScore = daily.length > 0
      ? daily.reduce((s, d) => s + d.avgConfidence, 0) / daily.length
      : 0;
    return { distribution: dist, avgScore, totalLogs: weekLogs.length };
  }, [logs]);

  if (habits.length === 0) return null;

  // ── Styles ─────────────────────────────────────────────────

  const panelStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    marginTop: 16,
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    cursor: 'pointer',
    userSelect: 'none',
  };

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: 4,
    padding: '0 12px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  };

  const contentStyle: React.CSSProperties = {
    maxHeight: 300,
    overflowY: 'auto',
    padding: '12px 16px',
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 8,
    border: 'none',
    background: isActive ? 'rgba(0,212,255,0.15)' : 'transparent',
    color: isActive ? '#00D4FF' : 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: isActive ? 600 : 400,
    transition: 'all 0.2s',
  });

  return (
    <div style={panelStyle}>
      <div style={headerStyle} onClick={() => setCollapsed(!collapsed)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={16} style={{ color: '#00D4FF' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            Habit Intelligence
          </span>
        </div>
        {collapsed ? <ChevronDown size={16} style={{ color: 'rgba(255,255,255,0.4)' }} /> : <ChevronUp size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />}
      </div>

      {!collapsed && (
        <>
          <div style={tabBarStyle}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                style={tabStyle(activeTab === tab.id)}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>

          <div style={contentStyle}>
            {activeTab === 'grit' && <GritTab score={gritScore} />}
            {activeTab === 'keystone' && <KeystoneTab results={keystoneResults} />}
            {activeTab === 'difficulty' && <DifficultyTab analyses={readyToProgress} allAnalyses={difficultyAnalyses} />}
            {activeTab === 'confidence' && <ConfidenceTab stats={confidenceStats} />}
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function GritTab({ score }: { score: ReturnType<typeof calculateGritScore> }) {
  const insight = getGritInsight(score);
  const pct = (score.overall / 5) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Gauge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', width: 64, height: 64 }}>
          <svg width={64} height={64} viewBox="0 0 64 64">
            <circle cx={32} cy={32} r={28} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
            <circle
              cx={32} cy={32} r={28}
              fill="none"
              stroke={GRIT_COLORS[score.level]}
              strokeWidth={6}
              strokeDasharray={`${pct * 1.76} ${176 - pct * 1.76}`}
              strokeDashoffset={44}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.5s' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 16, fontWeight: 700, color: GRIT_COLORS[score.level],
          }}>
            {score.overall.toFixed(1)}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: GRIT_COLORS[score.level], textTransform: 'capitalize', marginBottom: 4 }}>
            {score.level}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Scale 0-5</div>
        </div>
      </div>

      {/* Passion vs Perseverance bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <BarMeter label="Passion" value={score.passion} max={5} color="#D4AF37" />
        <BarMeter label="Perseverance" value={score.perseverance} max={5} color="#39FF14" />
      </div>

      {/* Insight */}
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, margin: 0 }}>
        {insight}
      </p>
    </div>
  );
}

function BarMeter({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 80 }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 3,
          background: color, transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ fontSize: 11, color, width: 28, textAlign: 'right' }}>{value.toFixed(1)}</span>
    </div>
  );
}

function KeystoneTab({ results }: { results: ReturnType<typeof detectKeystoneHabits> }) {
  if (results.length === 0) {
    return (
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
        Not enough data yet. Keep logging for 14+ days to detect keystone habits.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {results.map((r, i) => (
        <div key={r.habitId} style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          padding: '8px 10px', borderRadius: 8,
          background: i === 0 ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
          border: i === 0 ? '1px solid rgba(0,212,255,0.15)' : '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              {i === 0 ? '>> ' : ''}{r.habitName}
            </span>
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 4,
              background: 'rgba(0,212,255,0.15)', color: '#00D4FF',
            }}>
              Score: {r.score.toFixed(2)}
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.4 }}>
            {getKeystoneInsight(r)}
          </p>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {r.affectedDomains.map(d => (
              <span key={d} style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: 'rgba(57,255,20,0.1)', color: '#39FF14',
              }}>
                {d}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DifficultyTab({
  analyses,
  allAnalyses,
}: {
  analyses: ReturnType<typeof getAllDifficultyAnalyses>;
  allAnalyses: ReturnType<typeof getAllDifficultyAnalyses>;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Tier summary */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['beginner', 'intermediate', 'advanced', 'mastery'] as DifficultyTier[]).map(tier => {
          const count = allAnalyses.filter(a => a.currentTier === tier).length;
          if (count === 0) return null;
          return (
            <span key={tier} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              background: `${DIFFICULTY_COLORS[tier]}20`,
              color: DIFFICULTY_COLORS[tier],
              textTransform: 'capitalize',
            }}>
              {tier}: {count}
            </span>
          );
        })}
      </div>

      {/* Ready to progress */}
      {analyses.length === 0 ? (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
          No habits ready to level up yet. Keep building consistency.
        </p>
      ) : (
        analyses.map(a => {
          const habit = useHabitsStore.getState().habits.find(h => h.id === a.habitId);
          return (
            <div key={a.habitId} style={{
              padding: '8px 10px', borderRadius: 8,
              background: 'rgba(212,175,55,0.08)',
              border: '1px solid rgba(212,175,55,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                  {habit?.title || a.habitId}
                </span>
                <span style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                  background: DIFFICULTY_COLORS[a.currentTier] + '20',
                  color: DIFFICULTY_COLORS[a.currentTier],
                  textTransform: 'capitalize',
                }}>
                  {a.currentTier} ({a.daysAtTier}d)
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.4 }}>
                {a.suggestion}
              </p>
            </div>
          );
        })
      )}
    </div>
  );
}

function ConfidenceTab({ stats }: {
  stats: {
    distribution: Record<ConfidenceLevel, number>;
    avgScore: number;
    totalLogs: number;
  };
}) {
  const { distribution, avgScore, totalLogs } = stats;
  const maxCount = Math.max(1, ...Object.values(distribution));

  if (totalLogs === 0) {
    return (
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
        No logs this week yet. Start logging to see confidence scores.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Average score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Avg Confidence:</span>
        <span style={{
          fontSize: 14, fontWeight: 700,
          color: avgScore >= 0.8 ? '#39FF14' : avgScore >= 0.6 ? '#D4AF37' : '#F43F5E',
        }}>
          {(avgScore * 100).toFixed(0)}%
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          ({totalLogs} logs this week)
        </span>
      </div>

      {/* Distribution bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(['high', 'medium', 'low', 'inferred'] as ConfidenceLevel[]).map(level => {
          const count = distribution[level];
          const pct = (count / maxCount) * 100;
          return (
            <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 11, color: CONFIDENCE_COLORS[level], width: 56,
                textTransform: 'capitalize',
              }}>
                {level}
              </span>
              <div style={{
                flex: 1, height: 8, borderRadius: 4,
                background: 'rgba(255,255,255,0.06)',
              }}>
                <div style={{
                  width: `${pct}%`, height: '100%', borderRadius: 4,
                  background: CONFIDENCE_COLORS[level],
                  transition: 'width 0.3s',
                  minWidth: count > 0 ? 4 : 0,
                }} />
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 20, textAlign: 'right' }}>
                {count}
              </span>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.4 }}>
        Log habits on the same day for maximum confidence and XP.
      </p>
    </div>
  );
}
