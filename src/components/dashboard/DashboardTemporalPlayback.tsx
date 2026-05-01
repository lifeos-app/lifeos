// ═══════════════════════════════════════════════════════════
// DashboardTemporalPlayback — Week scrubber with daily snapshots
// "Rewind your week, see patterns emerge" — VISION-v2
// A horizontal timeline of the last 7 days with a scrubber that
// shows each day's key metrics when you hover/tap.
// ═══════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from 'react';
import {
  Rewind, Play, Pause, SkipBack, SkipForward, CalendarDays,
  TrendingUp, TrendingDown, Activity,
} from 'lucide-react';
import './DashboardTemporalPlayback.css';

// ═══ Types ═══
interface DaySnapshot {
  date: string;
  dayLabel: string;
  mood: number | null;     // 1-5
  energy: number | null;  // 1-5
  sleepHours: number | null;
  habitsCompleted: number;
  habitsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  xpEarned: number;
  score: number;          // 0-100 computed
}

interface DashboardTemporalPlaybackProps {
  /** Pre-computed day snapshots (parent provides data) */
  snapshots: DaySnapshot[];
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#39FF14';
  if (score >= 50) return '#00D4FF';
  if (score >= 30) return '#EAB308';
  return '#F43F5E';
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en', { weekday: 'short' });
}

// ═══ Component ═══
export function DashboardTemporalPlayback({ snapshots }: DashboardTemporalPlaybackProps) {
  const [selectedIdx, setSelectedIdx] = useState(snapshots.length - 1);
  const [autoPlaying, setAutoPlaying] = useState(false);

  const selected = snapshots[selectedIdx] ?? null;

  // Auto-play: cycle through days every 2 seconds
  const toggleAutoPlay = useCallback(() => {
    setAutoPlaying(prev => !prev);
  }, []);

  // Simple auto-play via interval (no useEffect for simplicity)
  const handleAutoPlayTick = useCallback(() => {
    setSelectedIdx(prev => (prev + 1) % snapshots.length);
  }, [snapshots.length]);

  const goToPrev = useCallback(() => {
    setSelectedIdx(prev => (prev - 1 + snapshots.length) % snapshots.length);
  }, [snapshots.length]);

  const goToNext = useCallback(() => {
    setSelectedIdx(prev => (prev + 1) % snapshots.length);
  }, [snapshots.length]);

  if (!selected || snapshots.length === 0) return null;

  const habitPct = selected.habitsTotal > 0 ? selected.habitsCompleted / selected.habitsTotal : 0;
  const taskPct = selected.tasksTotal > 0 ? selected.tasksDone / selected.tasksTotal : 0;
  const scoreColor = getScoreColor(selected.score);

  return (
    <section className="dash-card temporal-playback-card" aria-label="Temporal playback — weekly life review">
      <div className="card-top">
        <h2><Rewind size={16} /> Week Playback</h2>
        <span className="temporal-range">
          {snapshots[0]?.dayLabel} — {snapshots[snapshots.length - 1]?.dayLabel}
        </span>
      </div>

      {/* ── Timeline strip ── */}
      <div className="temporal-timeline" role="slider" aria-label="Day selector" aria-valuenow={selectedIdx + 1} aria-valuemin={1} aria-valuemax={snapshots.length}>
        {snapshots.map((day, i) => {
          const dayColor = getScoreColor(day.score);
          const isActive = i === selectedIdx;
          return (
            <button
              key={day.date}
              className={`temporal-day-dot ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedIdx(i)}
              aria-label={`${day.dayLabel}: score ${day.score}`}
              style={{
                background: isActive ? dayColor : `${dayColor}30`,
                borderColor: isActive ? dayColor : 'transparent',
                boxShadow: isActive ? `0 0 8px ${dayColor}40` : 'none',
              }}
            >
              <span className="dot-label">{getDayName(day.date)}</span>
              <span className="dot-score" style={{ color: dayColor }}>{day.score}</span>
            </button>
          );
        })}
      </div>

      {/* ── Playback controls ── */}
      <div className="temporal-controls">
        <button className="temporal-btn" onClick={goToPrev} aria-label="Previous day">
          <SkipBack size={14} />
        </button>
        <button className="temporal-btn" onClick={toggleAutoPlay} aria-label={autoPlaying ? 'Pause playback' : 'Play playback'}>
          {autoPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button className="temporal-btn" onClick={goToNext} aria-label="Next day">
          <SkipForward size={14} />
        </button>
      </div>

      {/* ── Day snapshot ── */}
      <div className="temporal-snapshot" role="region" aria-label={`${selected.dayLabel} snapshot`}>
        <div className="snapshot-header">
          <CalendarDays size={14} color="#00D4FF" />
          <span className="snapshot-date">{selected.dayLabel}</span>
          <span className="snapshot-score" style={{ color: scoreColor }}>
            {selected.score}/100
          </span>
        </div>

        <div className="snapshot-metrics">
          {/* Mood */}
          {selected.mood !== null && (
            <div className="snapshot-metric">
              <span className="metric-label">Mood</span>
              <div className="metric-bar-track">
                <div className="metric-bar-fill" style={{
                  width: `${(selected.mood / 5) * 100}%`,
                  background: 'linear-gradient(90deg, #F97316, #FACC15)',
                }} />
              </div>
              <span className="metric-value">{selected.mood}/5</span>
            </div>
          )}

          {/* Energy */}
          {selected.energy !== null && (
            <div className="snapshot-metric">
              <span className="metric-label">Energy</span>
              <div className="metric-bar-track">
                <div className="metric-bar-fill" style={{
                  width: `${(selected.energy / 5) * 100}%`,
                  background: 'linear-gradient(90deg, #A855F7, #00D4FF)',
                }} />
              </div>
              <span className="metric-value">{selected.energy}/5</span>
            </div>
          )}

          {/* Sleep */}
          {selected.sleepHours !== null && (
            <div className="snapshot-metric">
              <span className="metric-label">Sleep</span>
              <div className="metric-bar-track">
                <div className="metric-bar-fill" style={{
                  width: `${Math.min(100, (selected.sleepHours / 9) * 100)}%`,
                  background: selected.sleepHours >= 7 ? 'linear-gradient(90deg, #39FF14, #00D4FF)' : 'linear-gradient(90deg, #F43F5E, #EAB308)',
                }} />
              </div>
              <span className="metric-value">{selected.sleepHours}h</span>
            </div>
          )}

          {/* Habits */}
          <div className="snapshot-metric">
            <span className="metric-label">Habits</span>
            <div className="metric-bar-track">
              <div className="metric-bar-fill" style={{
                width: `${habitPct * 100}%`,
                background: 'linear-gradient(90deg, #F97316, #39FF14)',
              }} />
            </div>
            <span className="metric-value">{selected.habitsCompleted}/{selected.habitsTotal}</span>
          </div>

          {/* Tasks */}
          <div className="snapshot-metric">
            <span className="metric-label">Tasks</span>
            <div className="metric-bar-track">
              <div className="metric-bar-fill" style={{
                width: `${taskPct * 100}%`,
                background: 'linear-gradient(90deg, #00D4FF, #39FF14)',
              }} />
            </div>
            <span className="metric-value">{selected.tasksDone}/{selected.tasksTotal}</span>
          </div>

          {/* XP */}
          <div className="snapshot-metric">
            <span className="metric-label">XP</span>
            <Activity size={12} color="#A855F7" />
            <span className="metric-value" style={{ color: '#A855F7' }}>
              +{selected.xpEarned}
            </span>
          </div>
        </div>

        {/* Trend vs previous day */}
        {selectedIdx > 0 && (
          <div className="snapshot-trend" role="status">
            {(() => {
              const prev = snapshots[selectedIdx - 1];
              const diff = selected.score - prev.score;
              if (diff > 2) return <><TrendingUp size={14} color="#39FF14" /> <span style={{ color: '#39FF14' }}>+{diff} vs yesterday</span></>;
              if (diff < -2) return <><TrendingDown size={14} color="#F43F5E" /> <span style={{ color: '#F43F5E' }}>{diff} vs yesterday</span></>;
              return <><span style={{ color: 'rgba(255,255,255,0.4)' }}>Stable vs yesterday</span></>;
            })()}
          </div>
        )}
      </div>
    </section>
  );
}

export type { DaySnapshot, DashboardTemporalPlaybackProps };