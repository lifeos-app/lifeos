/**
 * DashboardEveningReview — AI-powered evening review card.
 *
 * Shows during evening mode (after 6pm) as a reflection-oriented widget.
 * Aggregates today's data: tasks, habits, mood, XP, finances.
 * Provides reflection prompts, highlights, tomorrow preview, and wind-down suggestions.
 *
 * Dark theme with purple/gold accent for evening feel.
 * No emoji — Lucide icons only.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MoonStar, CheckCircle, Circle, Sparkles, ChevronRight, ChevronDown,
  RefreshCw, Calendar, Flame, ArrowRight, BookOpen, Target,
} from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { supabase } from '../../lib/data-access';
import { generateEveningReview, type LEveningReview } from '../../lib/llm/evening-review';
import { callLLMSimple } from '../../lib/llm-proxy';
import { agentChat, agentHealthCheck } from '../../lib/zeroclaw-client';
import { localDateStr } from '../../utils/date';
import { logger } from '../../utils/logger';
import { useDashboardMode } from '../../hooks/useDashboardMode';

// ── TYPES ──────────────────────────────────────────────────────────────────────

interface CachedReview {
  date: string;
  reviewData: LEveningReview;
  aiSummary: string;
  generatedAt: number;
}

// ── CACHE HELPERS ──────────────────────────────────────────────────────────────

const CACHE_KEY_PREFIX = 'lifeos-evening-review-';

function getCachedReview(userId: string, date: string): CachedReview | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${userId}-${date}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedReview;
    if (parsed.date !== date) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCachedReview(userId: string, date: string, reviewData: LEveningReview, aiSummary: string) {
  const cached: CachedReview = { date, reviewData, aiSummary, generatedAt: Date.now() };
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${userId}-${date}`, JSON.stringify(cached));
  } catch {
    // localStorage full — silently fail
  }
}

// ── LLM PROMPT ─────────────────────────────────────────────────────────────────

function buildReviewPrompt(review: LEveningReview, firstName: string): string {
  const taskSummary = review.dateSummary.tasksTotal > 0
    ? `Completed ${review.dateSummary.tasksCompleted}/${review.dateSummary.tasksTotal} tasks`
    : 'No tasks today';

  const habitSummary = review.dateSummary.habitsTotal > 0
    ? `Completed ${review.dateSummary.habitsCompleted}/${review.dateSummary.habitsTotal} habits`
    : 'No habits tracked';

  const moodSummary = review.dateSummary.moodLogged
    ? `Mood: ${review.dateSummary.moodValue}/5`
    : 'Mood not logged';

  const xpSummary = review.dateSummary.xpEarned > 0
    ? `Earned ${review.dateSummary.xpEarned} XP`
    : 'No XP earned';

  const finSummary = review.financeToday
    ? `Spent $${review.financeToday.expenses.toFixed(0)}, earned $${review.financeToday.income.toFixed(0)} (net: $${review.financeToday.net.toFixed(0)})`
    : 'No financial activity';

  const tomorrowSummary = review.tomorrowPreview.events.length > 0
    ? review.tomorrowPreview.events.map(e => `${e.time}: ${e.title}`).join('; ')
    : 'Nothing scheduled';

  const reflectionsStr = review.reflections.join(' ');
  const highlightsStr = review.highlights.join('. ');

  return `You are the LifeOS evening coach. Generate a brief, warm, reflective evening review for ${firstName}.

TODAY'S SUMMARY:
- Date: ${review.date}
- Tasks: ${taskSummary}
- Habits: ${habitSummary}
- Mood: ${moodSummary}
- XP: ${xpSummary}
- Finance: ${finSummary}
- Journal entries: ${review.dateSummary.journalEntriesToday}
- Best streak: ${review.streakStatus.days} days (${review.streakStatus.label})

HIGHLIGHTS: ${highlightsStr}
REFLECTION POINTS: ${reflectionsStr}
TOMORROW: ${tomorrowSummary}
WIND-DOWN SUGGESTION: ${review.windDown}

RULES:
- Write 3-5 SHORT sentences. Be warm, reflective, coaching — not commanding.
- Start with a brief evening greeting/observation about their day.
- Acknowledge what went well. If little went well, be genuinely encouraging.
- Suggest one small thing to do before bed (habit, mood log, journal).
- End with a calming, forward-looking note about tomorrow.
- Be specific to their data, not generic.
- No emoji. No "LifeOS" references. Sound like a wise, supportive coach.
- If the user had a low-activity day, reframe it positively.`;
}

// ── FALLBACK SUMMARY ────────────────────────────────────────────────────────────

function buildFallbackSummary(review: LEveningReview, firstName: string): string {
  const parts: string[] = [];

  parts.push(review.greeting);

  if (review.dateSummary.tasksCompleted > 0 || review.dateSummary.habitsCompleted > 0) {
    const completed = [];
    if (review.dateSummary.tasksCompleted > 0) {
      completed.push(`${review.dateSummary.tasksCompleted} task${review.dateSummary.tasksCompleted !== 1 ? 's' : ''}`);
    }
    if (review.dateSummary.habitsCompleted > 0) {
      completed.push(`${review.dateSummary.habitsCompleted} habit${review.dateSummary.habitsCompleted !== 1 ? 's' : ''}`);
    }
    parts.push(`Today you completed ${completed.join(' and ')}. ${review.highlights[0] ?? 'Solid work.'}`);
  } else {
    parts.push('A quieter day — rest is productive too.');
  }

  if (review.dateSummary.xpEarned > 0) {
    parts.push(`You earned ${review.dateSummary.xpEarned} XP.`);
  }

  if (review.streakStatus.days > 0) {
    parts.push(`Your ${review.streakStatus.days}-day streak is intact.`);
  }

  if (review.tomorrowPreview.events.length > 0) {
    parts.push(`${review.tomorrowPreview.events.length} event${review.tomorrowPreview.events.length !== 1 ? 's' : ''} on tomorrow's schedule.`);
  }

  parts.push(review.windDown);

  return parts.join(' ');
}

// ── COMPONENT ──────────────────────────────────────────────────────────────────

export function DashboardEveningReview() {
  const user = useUserStore(s => s.user);
  const firstName = useUserStore(s => s.firstName);
  const navigate = useNavigate();
  const dashMode = useDashboardMode(firstName);

  const [reviewData, setReviewData] = useState<LEveningReview | null>(null);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  const today = localDateStr();

  // Only show in evening/night mode
  const isEveningMode = dashMode.mode === 'evening' || dashMode.mode === 'night';
  // Also show if after 6pm regardless of exact mode classification
  const currentHour = new Date().getHours();
  const shouldShow = isEveningMode || currentHour >= 18;

  // Generate the review
  const generateReview = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = getCachedReview(user.id, today);
      if (cached) {
        setReviewData(cached.reviewData);
        setAiSummary(cached.aiSummary);
        setLoading(false);
        setVisible(true);
        return;
      }
    }

    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Step 1: Gather data from across LifeOS
      const data = await generateEveningReview(user.id, supabase);
      setReviewData(data);

      // Step 2: Check if data is entirely empty — show simplified message
      const isEmpty = data.dateSummary.tasksTotal === 0
        && data.dateSummary.habitsTotal === 0
        && data.dateSummary.xpEarned === 0
        && data.highlights.length <= 1
        && data.tomorrowPreview.events.length === 0;

      if (isEmpty) {
        const summary = `Nothing tracked yet today, ${firstName || 'there'}. Start by logging a habit or mood, and this review will fill with insights tomorrow.`;
        setAiSummary(summary);
        setCachedReview(user.id, today, data, summary);
        return;
      }

      // Step 3: Try ZeroClaw, fall back to LLM proxy, then static
      let summary: string;
      try {
        const zcOnline = await agentHealthCheck();
        if (zcOnline) {
          const prompt = buildReviewPrompt(data, firstName || 'there');
          const zcRes = await agentChat({
            userId: user.id,
            message: prompt,
            context: { currentPage: 'dashboard' },
          });
          summary = zcRes.message;
        } else {
          throw new Error('ZeroClaw offline');
        }
      } catch {
        try {
          const prompt = buildReviewPrompt(data, firstName || 'there');
          summary = await callLLMSimple(prompt, { timeoutMs: 15000 });
        } catch {
          summary = buildFallbackSummary(data, firstName || 'there');
        }
      }

      setAiSummary(summary);
      setCachedReview(user.id, today, data, summary);
    } catch (err) {
      logger.error('[EveningReview] Generation failed:', err);
      setError('Could not load your evening review');
      const cached = getCachedReview(user.id, today);
      if (cached) {
        setReviewData(cached.reviewData);
        setAiSummary(cached.aiSummary);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setTimeout(() => setVisible(true), 100);
    }
  }, [user?.id, today, firstName]);

  useEffect(() => {
    if (shouldShow) {
      generateReview();
    }
  }, [generateReview, shouldShow]);

  // Don't render at all during non-evening hours
  if (!shouldShow) return null;

  // Purple/gold accent colors
  const purpleAccent = '#A78BFA'; // violet-400
  const goldAccent = '#F59E0B';   // amber-400

  const cardGradient = 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(59,130,246,0.05) 50%, rgba(245,158,11,0.03) 100%)';
  const borderColor = 'rgba(167,139,250,0.18)';
  const glowColor = 'rgba(167,139,250,0.12)';

  // ── LOADING SHIMMER ──
  if (loading) {
    return (
      <section className="dash-card" style={{
        background: cardGradient,
        border: `1px solid ${borderColor}`,
        position: 'relative',
        overflow: 'hidden',
        minHeight: 140,
        borderRadius: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div className="shimmer-line" style={{ width: 20, height: 20, borderRadius: '50%' }} />
          <div className="shimmer-line" style={{ width: 180, height: 16, borderRadius: 8 }} />
        </div>
        <div className="shimmer-line" style={{ width: '90%', height: 14, borderRadius: 6, marginBottom: 8 }} />
        <div className="shimmer-line" style={{ width: '75%', height: 14, borderRadius: 6 }} />

        <div style={{
          position: 'absolute',
          top: 0, left: '-100%',
          width: '200%', height: '100%',
          background: 'linear-gradient(90deg, transparent 25%, rgba(167,139,250,0.03) 50%, transparent 75%)',
          animation: 'shimmerSlide 2s infinite',
        }} />

        <style>{`
          .shimmer-line {
            background: rgba(255,255,255,0.04);
            position: relative;
            overflow: hidden;
          }
          .shimmer-line::after {
            content: '';
            position: absolute;
            top: 0; left: -100%;
            width: 200%; height: 100%;
            background: linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.04) 50%, transparent 75%);
            animation: shimmerSlide 1.8s infinite;
          }
          @keyframes shimmerSlide {
            0% { transform: translateX(-50%); }
            100% { transform: translateX(50%); }
          }
        `}</style>
      </section>
    );
  }

  // ── ERROR STATE ──
  if (error && !reviewData) {
    return (
      <section className="dash-card" style={{
        textAlign: 'center',
        padding: '24px 20px',
        background: cardGradient,
        border: `1px solid ${borderColor}`,
        borderRadius: 16,
      }}>
        <MoonStar size={20} style={{ color: purpleAccent, marginBottom: 8 }} />
        <p style={{ color: '#8BA4BE', fontSize: 13 }}>{error}</p>
        <button
          onClick={() => generateReview(true)}
          style={{
            background: `rgba(167,139,250,0.1)`,
            border: `1px solid rgba(167,139,250,0.2)`,
            borderRadius: 8,
            padding: '6px 14px',
            color: purpleAccent,
            fontSize: 12,
            cursor: 'pointer',
            marginTop: 8,
          }}
        >
          Try again
        </button>
      </section>
    );
  }

  if (!reviewData) return null;

  const { dateSummary, highlights, reflections, tomorrowPreview, windDown } = reviewData;

  // ── MAIN CARD ──
  return (
    <section
      className="dash-card evening-review-card"
      style={{
        background: cardGradient,
        border: `1px solid ${borderColor}`,
        padding: 0,
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
        position: 'relative',
        borderRadius: 16,
      }}
    >
      {/* Glow effects */}
      <div style={{
        position: 'absolute',
        top: -40, right: -40,
        width: 120, height: 120,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: -30, left: -30,
        width: 100, height: 100,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Header — clickable to collapse/expand */}
      <div
        style={{
          padding: '16px 20px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed(c => !c)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setCollapsed(c => !c)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <MoonStar size={18} style={{ color: purpleAccent }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#E8F0FE' }}>
                Evening Review
              </h2>
              <Sparkles size={14} style={{ color: goldAccent, opacity: 0.8 }} />
            </div>
            {collapsed && aiSummary ? (
              <p style={{
                margin: 0, fontSize: 12, color: '#8BA4BE',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}>
                {aiSummary.split(/[.!?]/)[0]}...
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 11, color: '#5A7A9A' }}>{reviewData.date}</p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={(e) => { e.stopPropagation(); generateReview(true); }}
            disabled={refreshing}
            title="Refresh review"
            style={{
              background: 'rgba(167,139,250,0.1)',
              border: '1px solid rgba(167,139,250,0.2)',
              borderRadius: 8,
              padding: '6px 8px',
              color: purpleAccent,
              cursor: refreshing ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 500,
              transition: 'all 0.2s',
              opacity: refreshing ? 0.6 : 1,
            }}
          >
            <RefreshCw size={12} style={{
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
            }} />
          </button>
          {collapsed
            ? <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
            : <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.3)', transform: 'rotate(90deg)' }} />
          }
        </div>
      </div>

      {/* Collapsible content */}
      <div className={`collapsible-wrapper${!collapsed ? ' expanded' : ''}`}>
        <div className="collapsible-inner">
          {/* AI Summary */}
          <div style={{ padding: '0 20px 14px', position: 'relative' }}>
            <p style={{
              fontSize: 13,
              color: '#C5D5E8',
              lineHeight: 1.65,
              margin: 0,
              fontStyle: 'normal',
              letterSpacing: '0.01em',
            }}>
              {aiSummary}
            </p>
          </div>

          {/* Quick Stats */}
          <div style={{
            padding: '0 20px 12px',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            {dateSummary.tasksTotal > 0 && (
              <ReviewPill
                icon={dateSummary.tasksCompleted === dateSummary.tasksTotal
                  ? <CheckCircle size={11} />
                  : <Circle size={11} />}
                label={`${dateSummary.tasksCompleted}/${dateSummary.tasksTotal} tasks`}
                color={dateSummary.tasksCompleted === dateSummary.tasksTotal ? '#22C55E' : goldAccent}
                onClick={() => navigate('/schedule')}
              />
            )}
            {dateSummary.habitsTotal > 0 && (
              <ReviewPill
                icon={dateSummary.habitsCompleted === dateSummary.habitsTotal
                  ? <CheckCircle size={11} />
                  : <Circle size={11} />}
                label={`${dateSummary.habitsCompleted}/${dateSummary.habitsTotal} habits`}
                color={dateSummary.habitsCompleted === dateSummary.habitsTotal ? '#22C55E' : '#F97316'}
                onClick={() => navigate('/habits')}
              />
            )}
            {dateSummary.xpEarned > 0 && (
              <ReviewPill
                icon={<Sparkles size={11} />}
                label={`+${dateSummary.xpEarned} XP`}
                color={goldAccent}
              />
            )}
            {reviewData.streakStatus.days > 0 && (
              <ReviewPill
                icon={<Flame size={11} />}
                label={`${reviewData.streakStatus.days}d streak`}
                color="#F97316"
                onClick={() => navigate('/habits')}
              />
            )}
            {dateSummary.moodLogged && dateSummary.moodValue !== undefined && (
              <ReviewPill
                icon={<Target size={11} />}
                label={`Mood: ${dateSummary.moodValue}/5`}
                color={dateSummary.moodValue >= 4 ? '#22C55E' : dateSummary.moodValue >= 3 ? goldAccent : '#EF4444'}
              />
            )}
          </div>

          {/* Highlights section */}
          {highlights.length > 0 && (
            <div style={{ padding: '0 20px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Sparkles size={13} style={{ color: goldAccent }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#E8F0FE' }}>Highlights</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#C5D5E8', lineHeight: 1.6 }}>
                {highlights.slice(0, 3).map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Reflections section */}
          {reflections.length > 0 && (
            <div style={{ padding: '0 20px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <BookOpen size={13} style={{ color: purpleAccent }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#E8F0FE' }}>Reflections</span>
              </div>
              <div style={{ fontSize: 12, color: '#A0B4C8', lineHeight: 1.6 }}>
                {reflections.slice(0, 2).map((r, i) => (
                  <p key={i} style={{ margin: '0 0 6px', fontStyle: 'italic' }}>"{r}"</p>
                ))}
              </div>
            </div>
          )}

          {/* Tomorrow Preview */}
          {(tomorrowPreview.events.length > 0 || tomorrowPreview.goalsNeedingAttention.length > 0) && (
            <div style={{ padding: '0 20px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Calendar size={13} style={{ color: '#00D4FF' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#E8F0FE' }}>Tomorrow</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#C5D5E8', lineHeight: 1.6 }}>
                {tomorrowPreview.events.slice(0, 3).map((e, i) => (
                  <li key={i}>{e.time} — {e.title}</li>
                ))}
                {tomorrowPreview.goalsNeedingAttention.slice(0, 2).map((g, i) => (
                  <li key={`g-${i}`} style={{ color: goldAccent }}>{g} needs attention</li>
                ))}
              </ul>
            </div>
          )}

          {/* Wind Down */}
          <div style={{
            padding: '0 20px 12px',
            background: 'rgba(167,139,250,0.04)',
            borderRadius: 8,
            margin: '0 20px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <MoonStar size={13} style={{ color: purpleAccent }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#E8F0FE' }}>Wind Down</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#A0B4C8', lineHeight: 1.5 }}>
              {windDown}
            </p>
          </div>

          {/* Primary Action */}
          {reviewData.primaryAction && (
            <div style={{
              padding: '0 20px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <button
                onClick={() => {
                  navigate('/sage?prompt=evening%20review');
                }}
                style={{
                  background: 'linear-gradient(135deg, rgba(167,139,250,0.15) 0%, rgba(245,158,11,0.1) 100%)',
                  border: '1px solid rgba(167,139,250,0.25)',
                  borderRadius: 10,
                  padding: '8px 16px',
                  color: '#E8F0FE',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(167,139,250,0.5)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(167,139,250,0.25)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Start Evening Review
                <ArrowRight size={12} />
              </button>
              <button
                onClick={() => {
                  if (reviewData.primaryAction) navigate(reviewData.primaryAction.path);
                }}
                style={{
                  background: 'transparent',
                  border: `1px solid rgba(167,139,250,0.2)`,
                  borderRadius: 10,
                  padding: '8px 16px',
                  color: purpleAccent,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(167,139,250,0.2)';
                }}
              >
                {reviewData.primaryAction.label}
                <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Gradient border glow at top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '5%',
        right: '5%',
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.4), rgba(245,158,11,0.3), transparent)',
        pointerEvents: 'none',
      }} />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </section>
  );
}

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────────

function ReviewPill({ icon, label, color, onClick }: {
  icon: React.ReactNode; label: string; color: string; onClick?: () => void;
}) {
  return (
    <span
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
      style={{
        fontSize: 11,
        color,
        background: `${color}12`,
        border: `1px solid ${color}25`,
        borderRadius: 20,
        padding: '4px 10px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontWeight: 500,
        transition: 'all 0.2s',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {icon} {label}
    </span>
  );
}