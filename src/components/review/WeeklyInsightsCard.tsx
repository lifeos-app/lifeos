/**
 * WeeklyInsightsCard — AI-powered weekly analysis card
 *
 * Shows task completion, habit streaks, most productive day, time allocation,
 * financial summary, goal progress, and an AI narrative.
 *
 * Integrates with:
 * - Feature gates (free = basic stats, pro = AI narrative)
 * - Gamification (10 XP once per week for viewing)
 * - localStorage caching by week key
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Flame,
  Target,
  DollarSign,
  Clock,
  CalendarDays,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { useSubscription } from '../../hooks/useSubscription';
import {
  generateWeeklyInsights,
  getCachedInsights,
  cacheInsights,
  type WeeklyInsightsData,
} from '../../lib/llm/weekly-insights';
import { canAccess } from '../../lib/feature-gates';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

// ── Mini Bar Chart ──

function MiniBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ minWidth: 70, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
      <div style={{
        flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color, borderRadius: 4,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <span style={{ minWidth: 36, textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
        {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value}h
      </span>
    </div>
  );
}

function StatCard({ icon, label, value, subtext, color }: {
  icon: React.ReactNode; label: string; value: string; subtext?: string; color: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, flex: '1 1 140px', minWidth: 140,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}15`, color,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{label}</div>
        {subtext && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{subtext}</div>}
      </div>
    </div>
  );
}

function TrendBadge({ trend, prevRate }: { trend: string; prevRate: number }) {
  if (trend === 'new') return null;
  const color = trend === 'up' ? '#39FF14' : trend === 'down' ? '#F43F5E' : '#5A7A9A';
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px',
      background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 6,
      fontSize: 10, fontWeight: 600, color,
    }}>
      <Icon size={10} /> {trend === 'same' ? 'Same' : `${trend === 'up' ? '+' : ''}${prevRate > 0 ? Math.abs(parseInt(((parseInt(String(prevRate))) as unknown as string))) : ''}%`}
      {trend !== 'same' && ` vs last week`}
    </span>
  );
}

// ── XP Award (once per week) ──

async function awardWeeklyInsightsXP(userId: string, weekKey: string): Promise<boolean> {
  const storageKey = `lifeos_insights_xp_${weekKey}`;
  if (localStorage.getItem(storageKey)) return false;

  try {
    // Check if already awarded server-side
    const { count } = await supabase.from('xp_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_type', 'page_visit')
      .gte('created_at', weekKey + 'T00:00:00')
      .like('description', '%weekly insights%');

    if ((count || 0) > 0) {
      localStorage.setItem(storageKey, '1');
      return false;
    }

    // Award 10 XP
    await supabase.from('xp_events').insert({
      user_id: userId,
      action_type: 'page_visit',
      xp_amount: 10,
      description: 'Viewed weekly insights',
      metadata: { weekKey },
    });

    // Update user_xp total
    const { data: xpRow } = await supabase.from('user_xp')
      .select('total_xp')
      .eq('user_id', userId)
      .maybeSingle();

    if (xpRow) {
      await supabase.from('user_xp')
        .update({ total_xp: (xpRow.total_xp || 0) + 10 })
        .eq('user_id', userId);
    }

    localStorage.setItem(storageKey, '1');
    return true;
  } catch {
    return false;
  }
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────

interface WeeklyInsightsCardProps {
  weekStart: string;
  weekEnd: string;
}

export function WeeklyInsightsCard({ weekStart, weekEnd }: WeeklyInsightsCardProps) {
  const user = useUserStore(s => s.user);
  const { tier } = useSubscription();
  const isPro = canAccess('review_page', tier);

  const [insights, setInsights] = useState<WeeklyInsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [xpAwarded, setXpAwarded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;

    // Check cache first
    if (!forceRefresh) {
      const cached = getCachedInsights(weekStart);
      if (cached) {
        setInsights(cached);
        // Award XP on view
        awardWeeklyInsightsXP(user.id, weekStart).then(awarded => {
          if (awarded) setXpAwarded(true);
        });
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const data = await generateWeeklyInsights(user.id, weekStart, weekEnd, {
        includeAINarrative: isPro,
      });

      setInsights(data);
      cacheInsights(data);

      // Award XP on first view
      const awarded = await awardWeeklyInsightsXP(user.id, weekStart);
      if (awarded) setXpAwarded(true);
    } catch (err: any) {
      logger.error('[WeeklyInsightsCard] Error:', err);
      setError(err?.message || 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  }, [user?.id, weekStart, weekEnd, isPro]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  // ── Loading state ──
  if (loading && !insights) {
    return (
      <section className="review-wk-section" style={{
        background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(139,92,246,0.04))',
        borderColor: 'rgba(0,212,255,0.15)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent, #00D4FF, transparent)',
          animation: 'shimmer 2s infinite',
        }} />
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', gap: 12,
        }}>
          <Loader2 size={28} className="spin" style={{ color: '#00D4FF' }} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            Analyzing your week...
          </span>
        </div>
      </section>
    );
  }

  if (error && !insights) {
    return (
      <section className="review-wk-section" style={{
        background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(139,92,246,0.04))',
        borderColor: 'rgba(244,63,94,0.2)',
      }}>
        <h2 className="review-wk-section-title" style={{ color: '#00D4FF' }}>
          <Brain size={18} /> AI Weekly Insights
        </h2>
        <div style={{
          padding: '12px 16px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
          borderRadius: 10, fontSize: 13, color: '#F43F5E',
        }}>
          {error}
          <button
            onClick={() => loadInsights(true)}
            style={{
              marginLeft: 12, padding: '4px 12px', background: 'rgba(0,212,255,0.1)',
              border: '1px solid rgba(0,212,255,0.3)', borderRadius: 6, color: '#00D4FF',
              fontSize: 12, cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (!insights) return null;

  const { taskCompletion, productiveDay, habitStreaks, goalProgress, timeAllocation, financeSummary, aiNarrative } = insights;

  return (
    <section className="review-wk-section" style={{
      background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(139,92,246,0.04))',
      borderColor: 'rgba(0,212,255,0.15)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Gradient top border */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, #00D4FF, #A855F7, #00D4FF)',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 className="review-wk-section-title" style={{ color: '#00D4FF', margin: 0 }}>
          <Brain size={18} /> AI Weekly Insights
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {xpAwarded && (
            <span style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
              background: 'rgba(57,255,20,0.1)', color: '#39FF14', border: '1px solid rgba(57,255,20,0.2)',
              animation: 'fadeIn 0.3s ease',
            }}>
              +10 XP
            </span>
          )}
          {loading && <Loader2 size={14} className="spin" style={{ color: '#00D4FF' }} />}
          <button
            onClick={() => loadInsights(true)}
            disabled={loading}
            style={{
              padding: 4, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
              cursor: loading ? 'not-allowed' : 'pointer', display: 'flex',
            }}
            title="Refresh insights"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              padding: 4, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer', display: 'flex',
            }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {!expanded && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '4px 0' }}>
          Tasks: {taskCompletion.rate}% · Habits: {habitStreaks.overallRate}% · Net: ${financeSummary.net >= 0 ? '+' : ''}{financeSummary.net.toFixed(0)}
        </div>
      )}

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── AI Narrative ── */}
          {aiNarrative ? (
            <div style={{
              padding: '14px 16px', borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.06))',
              border: '1px solid rgba(0,212,255,0.15)',
              fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.8)',
            }}>
              <Sparkles size={13} style={{ color: '#00D4FF', marginRight: 6, verticalAlign: 'middle' }} />
              {aiNarrative}
            </div>
          ) : !isPro ? (
            <div style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              fontSize: 12, color: 'rgba(255,255,255,0.4)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Lock size={12} /> AI narrative available with Pro
            </div>
          ) : null}

          {/* ── Key Stats Row ── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <StatCard
              icon={<BarChart3 size={16} />}
              label="Tasks Done"
              value={`${taskCompletion.rate}%`}
              subtext={`${taskCompletion.completed}/${taskCompletion.total}`}
              color="#00D4FF"
            />
            <StatCard
              icon={<Flame size={16} />}
              label="Habits"
              value={`${habitStreaks.overallRate}%`}
              subtext="Consistency"
              color="#F97316"
            />
            <StatCard
              icon={<CalendarDays size={16} />}
              label="Best Day"
              value={productiveDay.day !== 'N/A' ? productiveDay.day.slice(0, 3) : '—'}
              subtext={productiveDay.tasksCompleted > 0 ? `${productiveDay.tasksCompleted} items` : 'No activity'}
              color="#A855F7"
            />
            <StatCard
              icon={<DollarSign size={16} />}
              label="Net"
              value={`$${financeSummary.net >= 0 ? '+' : ''}${financeSummary.net.toFixed(0)}`}
              subtext={`$${financeSummary.income.toFixed(0)} in · $${financeSummary.expenses.toFixed(0)} out`}
              color={financeSummary.net >= 0 ? '#39FF14' : '#F43F5E'}
            />
          </div>

          {/* ── Task Trend ── */}
          {taskCompletion.trend !== 'new' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Completion trend:</span>
              <TrendBadge trend={taskCompletion.trend} prevRate={taskCompletion.prevRate} />
            </div>
          )}

          {/* ── Habit Streaks ── */}
          {(habitStreaks.strong.length > 0 || habitStreaks.slipping.length > 0) && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Habit Streaks
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {habitStreaks.strong.map(h => (
                  <div key={h.title} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                    background: 'rgba(57,255,20,0.04)', borderRadius: 8, fontSize: 12,
                  }}>
                    <span>{h.icon || '🔥'}</span>
                    <span style={{ flex: 1, color: 'rgba(255,255,255,0.7)' }}>{h.title}</span>
                    <span style={{ color: '#39FF14', fontWeight: 600, fontSize: 11 }}>
                      {h.streak}d streak 🔥
                    </span>
                  </div>
                ))}
                {habitStreaks.slipping.map(h => (
                  <div key={h.title} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                    background: 'rgba(249,115,22,0.04)', borderRadius: 8, fontSize: 12,
                  }}>
                    <span>{h.icon || '⚡'}</span>
                    <span style={{ flex: 1, color: 'rgba(255,255,255,0.7)' }}>{h.title}</span>
                    <span style={{ color: '#F97316', fontWeight: 600, fontSize: 11 }}>
                      {h.daysLogged}/{h.totalDays}d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Goal Progress ── */}
          {goalProgress.goals.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Target size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Goals ({goalProgress.avgProgress}% avg)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {goalProgress.goals.map(g => (
                  <div key={g.title} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ minWidth: 18, textAlign: 'center' }}>{g.icon || '🎯'}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.6)' }}>
                      {g.title}
                    </span>
                    <div style={{ width: 60, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${g.progress}%`, height: '100%',
                        background: g.progress >= 70 ? '#39FF14' : g.progress >= 40 ? '#00D4FF' : '#F97316',
                        borderRadius: 3, transition: 'width 0.6s ease',
                      }} />
                    </div>
                    <span style={{ minWidth: 28, textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                      {g.progress}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Time Allocation ── */}
          {timeAllocation.categories.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Time Allocation ({timeAllocation.totalHours}h total)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {timeAllocation.categories.map(cat => (
                  <MiniBar
                    key={cat.label}
                    value={cat.hours}
                    max={timeAllocation.totalHours}
                    color={cat.color}
                    label={cat.label}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Footer ── */}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'right' }}>
            Generated {new Date(insights.generatedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </section>
  );
}
