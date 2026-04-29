/**
 * TemporalPlayback.tsx — Rewind / Replay life data over time
 *
 * Features:
 * - Time range selector tabs: This Week / This Month / Last Month / Custom
 * - Timeline scrubber — horizontal slider across date range
 * - Compact snapshot cards per domain
 * - Domain trend arrows (ArrowUp green, ArrowDown red, Minus gray)
 * - Auto-play mode with 2s interval
 * - Comparison mode: select 2 dates, show delta cards
 * - Dark theme: bg #050E1A, card #0F2D4A, accent #00D4FF
 * - Responsive: full width on mobile, max-w-4xl centered on desktop
 * - No emoji, Lucide icons only
 * - Graceful empty state with Calendar icon
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Minus,
  Play,
  Pause,
  Calendar,
  Clock,
  TrendingUp,
  Flame,
  Target,
  Wallet,
  Heart,
  BookOpen,
  Zap,
  Timer,
  GitCompare,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import {
  type DataSnapshot,
  type SnapshotDelta,
  type TrendResult,
  type TrendKey,
  generateTimeline,
  compareSnapshots,
  calculateTrends,
  type TimeRange,
} from '../lib/temporal-playback';

// ─── Constants ─────────────────────────────────────────────────────

const BG = '#050E1A';
const CARD = '#0F2D4A';
const ACCENT = '#00D4FF';
const TEXT_PRIMARY = '#E2E8F0';
const TEXT_SECONDARY = '#8BA4BE';
const BORDER = '#1A3A5C';

const AUTO_PLAY_INTERVAL_MS = 2000;

type TabOption = 'this-week' | 'this-month' | 'last-month' | 'custom';

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getStartOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function getStartOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

// ─── Trend Arrow Component ────────────────────────────────────────

function TrendArrow({ trend }: { trend: TrendResult }) {
  if (trend.direction === 'up') {
    return (
      <span style={{ color: '#22C55E', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <ArrowUp size={14} />
        {trend.changePct !== 0 && <small style={{ fontSize: 11 }}>+{Math.abs(trend.changePct).toFixed(1)}%</small>}
      </span>
    );
  }
  if (trend.direction === 'down') {
    return (
      <span style={{ color: '#EF4444', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <ArrowDown size={14} />
        {trend.changePct !== 0 && <small style={{ fontSize: 11 }}>{trend.changePct.toFixed(1)}%</small>}
      </span>
    );
  }
  return (
    <span style={{ color: TEXT_SECONDARY, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <Minus size={14} />
      <small style={{ fontSize: 11 }}>stable</small>
    </span>
  );
}

// ─── Domain Card ──────────────────────────────────────────────────

interface DomainCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend: TrendResult;
}

function DomainCard({ label, value, icon, trend }: DomainCardProps) {
  return (
    <div style={{
      background: CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: ACCENT }}>
          {icon}
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        </div>
        <TrendArrow trend={trend} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: TEXT_PRIMARY }}>{value}</div>
    </div>
  );
}

// ─── Delta Card ────────────────────────────────────────────────────

interface DeltaCardProps {
  label: string;
  delta: number;
  icon: React.ReactNode;
  suffix?: string;
}

function DeltaCard({ label, delta, icon, suffix = '' }: DeltaCardProps) {
  const isPositive = delta > 0;
  const isNeutral = delta === 0;
  const color = isNeutral ? TEXT_SECONDARY : isPositive ? '#22C55E' : '#EF4444';
  const prefix = isPositive ? '+' : '';

  return (
    <div style={{
      background: CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
    }}>
      <div style={{ color: ACCENT, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color }}>{prefix}{delta.toFixed(1)}{suffix}</div>
      </div>
      {isPositive && <ArrowUp size={16} color="#22C55E" />}
      {!isNeutral && !isPositive && <ArrowDown size={16} color="#EF4444" />}
      {isNeutral && <Minus size={16} color={TEXT_SECONDARY} />}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export default function TemporalPlayback() {
  const [activeTab, setActiveTab] = useState<TabOption>('this-week');
  const [timeline, setTimeline] = useState<DataSnapshot[]>([]);
  const [trends, setTrends] = useState<Record<TrendKey, TrendResult> | null>(null);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [compareStart, setCompareStart] = useState<number | null>(null);
  const [compareEnd, setCompareEnd] = useState<number | null>(null);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compute start date from tab
  const getRangeForTab = useCallback((tab: TabOption): { range: TimeRange; start: string } => {
    const today = new Date();
    switch (tab) {
      case 'this-week':
        return { range: 'week', start: toISODate(getStartOfWeek(today)) };
      case 'this-month':
        return { range: 'month', start: toISODate(getStartOfMonth(today)) };
      case 'last-month': {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        return { range: 'month', start: toISODate(lastMonth) };
      }
      case 'custom':
        return { range: 'custom', start: customStart || toISODate(getStartOfWeek(today)) };
    }
  }, [customStart]);

  // Load timeline data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setSliderIndex(0);
      setCompareStart(null);
      setCompareEnd(null);
      try {
        const { range, start } = getRangeForTab(activeTab);
        if (activeTab === 'custom' && !customStart) {
          setTimeline([]);
          setTrends(null);
          setLoading(false);
          return;
        }
        const data = await generateTimeline(range, start);

        // For custom, filter to customEnd if provided
        let filtered = data;
        if (activeTab === 'custom' && customEnd && data.length > 0) {
          filtered = data.filter(s => s.date <= customEnd);
        }

        if (!cancelled) {
          setTimeline(filtered);
          setTrends(calculateTrends(filtered));
          setLoading(false);
        }
      } catch (err) {
        console.error('[TemporalPlayback] Failed to load timeline:', err);
        if (!cancelled) {
          setTimeline([]);
          setTrends(null);
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activeTab, getRangeForTab, customStart, customEnd]);

  // Auto-play
  useEffect(() => {
    if (autoPlay && timeline.length > 1) {
      autoPlayRef.current = setInterval(() => {
        setSliderIndex(prev => {
          if (prev >= timeline.length - 1) return 0;
          return prev + 1;
        });
      }, AUTO_PLAY_INTERVAL_MS);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [autoPlay, timeline.length]);

  const currentSnapshot = timeline[sliderIndex] ?? null;

  // Comparison delta
  let delta: SnapshotDelta | null = null;
  if (comparisonMode && compareStart !== null && compareEnd !== null && timeline[compareStart] && timeline[compareEnd]) {
    delta = compareSnapshots(timeline[compareStart], timeline[compareEnd]);
  }

  // Empty state
  const hasNoData = !loading && timeline.length === 0;

  const tabs: { key: TabOption; label: string }[] = [
    { key: 'this-week', label: 'This Week' },
    { key: 'this-month', label: 'This Month' },
    { key: 'last-month', label: 'Last Month' },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <div style={{
      background: BG,
      minHeight: '100vh',
      color: TEXT_PRIMARY,
      fontFamily: "'Poppins', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 896, // max-w-4xl equivalent
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: CARD,
            border: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Clock size={20} color={ACCENT} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: TEXT_PRIMARY }}>Temporal Playback</h1>
            <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: 0 }}>Rewind and replay your life data over time</p>
          </div>
        </div>

        {/* Tab selector */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setAutoPlay(false); }}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${activeTab === tab.key ? ACCENT : BORDER}`,
                background: activeTab === tab.key ? `${ACCENT}1A` : 'transparent',
                color: activeTab === tab.key ? ACCENT : TEXT_SECONDARY,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Custom date range inputs */}
        {activeTab === 'custom' && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5 }}>Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                style={{
                  background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
                  padding: '8px 12px', color: TEXT_PRIMARY, fontSize: 14,
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5 }}>End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                style={{
                  background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
                  padding: '8px 12px', color: TEXT_PRIMARY, fontSize: 14,
                }}
              />
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 0', gap: 12,
          }}>
            <Loader2 size={32} color={ACCENT} className="animate-spin" />
            <span style={{ color: TEXT_SECONDARY, fontSize: 14 }}>Loading timeline...</span>
          </div>
        )}

        {/* Empty state */}
        {hasNoData && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '80px 0', gap: 12,
          }}>
            <Calendar size={40} color={TEXT_SECONDARY} />
            <p style={{ fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY, margin: 0 }}>
              Start tracking to see your timeline
            </p>
            <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: 0, textAlign: 'center', maxWidth: 300 }}>
              Log habits, journal entries, health data, or finances to populate your temporal playback.
            </p>
          </div>
        )}

        {/* Main content */}
        {!loading && timeline.length > 0 && currentSnapshot && (
          <>
            {/* Controls row: Scrubber + Auto-play + Comparison toggle */}
            <div style={{
              background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
              padding: '16px 20px', marginBottom: 20,
            }}>
              {/* Date header + navigation */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button
                  onClick={() => setSliderIndex(Math.max(0, sliderIndex - 1))}
                  disabled={sliderIndex === 0}
                  style={{
                    background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 6,
                    padding: '6px 8px', cursor: sliderIndex === 0 ? 'not-allowed' : 'pointer',
                    color: sliderIndex === 0 ? TEXT_SECONDARY : TEXT_PRIMARY, opacity: sliderIndex === 0 ? 0.5 : 1,
                  }}
                  aria-label="Previous day"
                >
                  <ChevronLeft size={18} />
                </button>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: ACCENT }}>
                    {formatDateLabel(currentSnapshot.date)}
                  </div>
                  <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                    {formatWeekday(currentSnapshot.date)} — Day {sliderIndex + 1} of {timeline.length}
                  </div>
                </div>

                <button
                  onClick={() => setSliderIndex(Math.min(timeline.length - 1, sliderIndex + 1))}
                  disabled={sliderIndex === timeline.length - 1}
                  style={{
                    background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 6,
                    padding: '6px 8px', cursor: sliderIndex === timeline.length - 1 ? 'not-allowed' : 'pointer',
                    color: sliderIndex === timeline.length - 1 ? TEXT_SECONDARY : TEXT_PRIMARY, opacity: sliderIndex === timeline.length - 1 ? 0.5 : 1,
                  }}
                  aria-label="Next day"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Slider */}
              <input
                type="range"
                min={0}
                max={timeline.length - 1}
                value={sliderIndex}
                onChange={e => setSliderIndex(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: ACCENT,
                  marginBottom: 4,
                }}
                aria-label="Timeline scrubber"
              />

              {/* Day labels under slider */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 10, color: TEXT_SECONDARY, marginTop: 2,
              }}>
                {timeline.length <= 10 ? (
                  timeline.map((s, i) => (
                    <span key={s.date} style={{ opacity: i === sliderIndex ? 1 : 0.5, color: i === sliderIndex ? ACCENT : TEXT_SECONDARY }}>
                      {formatDateLabel(s.date)}
                    </span>
                  ))
                ) : (
                  <>
                    <span>{formatDateLabel(timeline[0].date)}</span>
                    <span>{formatDateLabel(timeline[Math.floor(timeline.length / 2)].date)}</span>
                    <span>{formatDateLabel(timeline[timeline.length - 1].date)}</span>
                  </>
                )}
              </div>

              {/* Auto-play & Comparison toggle */}
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setAutoPlay(!autoPlay)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 8,
                    border: `1px solid ${autoPlay ? '#22C55E' : BORDER}`,
                    background: autoPlay ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                    color: autoPlay ? '#22C55E' : TEXT_SECONDARY,
                    cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  }}
                >
                  {autoPlay ? <Pause size={14} /> : <Play size={14} />}
                  {autoPlay ? 'Pause' : 'Play'}
                </button>

                <button
                  onClick={() => {
                    setComparisonMode(!comparisonMode);
                    setCompareStart(null);
                    setCompareEnd(null);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 8,
                    border: `1px solid ${comparisonMode ? ACCENT : BORDER}`,
                    background: comparisonMode ? `${ACCENT}1A` : 'transparent',
                    color: comparisonMode ? ACCENT : TEXT_SECONDARY,
                    cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  }}
                >
                  <GitCompare size={14} />
                  {comparisonMode ? 'Exit Compare' : 'Compare'}
                </button>
              </div>

              {/* Comparison day selector */}
              {comparisonMode && (
                <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%', background: ACCENT,
                      display: 'inline-block',
                    }} />
                    <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>Start:</span>
                    <select
                      value={compareStart ?? ''}
                      onChange={e => setCompareStart(e.target.value ? Number(e.target.value) : null)}
                      style={{
                        background: BG, border: `1px solid ${BORDER}`, borderRadius: 6,
                        padding: '4px 8px', color: TEXT_PRIMARY, fontSize: 13,
                      }}
                    >
                      <option value="">Select day</option>
                      {timeline.map((s, i) => (
                        <option key={s.date} value={i}>{formatDateLabel(s.date)}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%', background: '#A855F7',
                      display: 'inline-block',
                    }} />
                    <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>End:</span>
                    <select
                      value={compareEnd ?? ''}
                      onChange={e => setCompareEnd(e.target.value ? Number(e.target.value) : null)}
                      style={{
                        background: BG, border: `1px solid ${BORDER}`, borderRadius: 6,
                        padding: '4px 8px', color: TEXT_PRIMARY, fontSize: 13,
                      }}
                    >
                      <option value="">Select day</option>
                      {timeline.map((s, i) => (
                        <option key={s.date} value={i}>{formatDateLabel(s.date)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Comparison delta cards */}
            {comparisonMode && delta && (
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                }}>
                  <GitCompare size={16} color={ACCENT} />
                  <span style={{ fontWeight: 600, fontSize: 15, color: TEXT_PRIMARY }}>
                    Delta: {formatDateLabel(delta.start)} to {formatDateLabel(delta.end)}
                  </span>
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10,
                }}>
                  <DeltaCard label="Habits" delta={delta.habitsCompletedCountDelta} icon={<Flame size={16} color={ACCENT} />} />
                  <DeltaCard label="Goals %" delta={delta.goalsProgressDelta} icon={<Target size={16} color={ACCENT} />} suffix="%" />
                  <DeltaCard label="Income" delta={delta.financeIncomeDelta} icon={<Wallet size={16} color={ACCENT} />} />
                  <DeltaCard label="Expense" delta={delta.financeExpenseDelta} icon={<Wallet size={16} color={ACCENT} />} />
                  <DeltaCard label="Mood" delta={delta.healthAvgMoodDelta} icon={<Heart size={16} color={ACCENT} />} />
                  <DeltaCard label="Sleep" delta={delta.healthAvgSleepDelta} icon={<Heart size={16} color={ACCENT} />} suffix="h" />
                  <DeltaCard label="Journal" delta={delta.journalWordCountDelta} icon={<BookOpen size={16} color={ACCENT} />} suffix=" words" />
                  <DeltaCard label="XP" delta={delta.xpTotalDelta} icon={<Zap size={16} color={ACCENT} />} />
                  <DeltaCard label="Streak" delta={delta.longestStreakDelta} icon={<Timer size={16} color={ACCENT} />} />
                </div>
              </div>
            )}

            {/* Snapshot domain cards */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10,
              marginBottom: 20,
            }}>
              <DomainCard
                label="Habits"
                value={`${currentSnapshot.habitsCompletedCount}/${currentSnapshot.habitsTotalActive}`}
                icon={<Flame size={16} />}
                trend={trends?.habitsCompletedCount ?? { direction: 'stable', changePct: 0 }}
              />
              <DomainCard
                label="Goals"
                value={`${currentSnapshot.goalsProgressPct.toFixed(1)}%`}
                icon={<Target size={16} />}
                trend={trends?.goalsProgressPct ?? { direction: 'stable', changePct: 0 }}
              />
              <DomainCard
                label="Income"
                value={`$${currentSnapshot.financeIncomeTotal.toFixed(2)}`}
                icon={<Wallet size={16} />}
                trend={trends?.financeIncomeTotal ?? { direction: 'stable', changePct: 0 }}
              />
              <DomainCard
                label="Expenses"
                value={`$${currentSnapshot.financeExpenseTotal.toFixed(2)}`}
                icon={<Wallet size={16} />}
                trend={trends?.financeExpenseTotal ?? { direction: 'stable', changePct: 0 }}
              />
              <DomainCard
                label="Mood"
                value={currentSnapshot.healthAvgMood === -1 ? '--' : currentSnapshot.healthAvgMood.toFixed(1)}
                icon={<Heart size={16} />}
                trend={trends?.healthAvgMood ?? { direction: 'stable', changePct: 0 }}
              />
              <DomainCard
                label="Sleep"
                value={currentSnapshot.healthAvgSleep === -1 ? '--' : `${currentSnapshot.healthAvgSleep.toFixed(1)}h`}
                icon={<Heart size={16} />}
                trend={trends?.healthAvgSleep ?? { direction: 'stable', changePct: 0 }}
              />
              <DomainCard
                label="Journal"
                value={`${currentSnapshot.journalWordCount} words`}
                icon={<BookOpen size={16} />}
                trend={trends?.journalWordCount ?? { direction: 'stable', changePct: 0 }}
              />
              <DomainCard
                label="XP"
                value={currentSnapshot.xpTotal.toLocaleString()}
                icon={<Zap size={16} />}
                trend={trends?.xpTotal ?? { direction: 'stable', changePct: 0 }}
              />
              <DomainCard
                label="Streak"
                value={`${currentSnapshot.longestStreak} days`}
                icon={<Timer size={16} />}
                trend={trends?.longestStreak ?? { direction: 'stable', changePct: 0 }}
              />
            </div>

            {/* Trend summary bar */}
            {trends && (
              <div style={{
                background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
                padding: '14px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <TrendingUp size={16} color={ACCENT} />
                  <span style={{ fontWeight: 600, fontSize: 14, color: TEXT_PRIMARY }}>Overall Trends</span>
                </div>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '12px 24px',
                }}>
                  {([
                    ['Habits', trends.habitsCompletedCount],
                    ['Goals', trends.goalsProgressPct],
                    ['Income', trends.financeIncomeTotal],
                    ['Expenses', trends.financeExpenseTotal],
                    ['Mood', trends.healthAvgMood],
                    ['Sleep', trends.healthAvgSleep],
                    ['Journal', trends.journalWordCount],
                    ['XP', trends.xpTotal],
                    ['Streak', trends.longestStreak],
                  ] as [string, TrendResult][]).map(([label, trend]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 90 }}>
                      <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>{label}</span>
                      <TrendArrow trend={trend} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}