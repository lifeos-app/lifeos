/**
 * DashboardMorningBrief — AI-powered personalized morning brief card.
 *
 * Replaces the simple greeting with a rich, LLM-generated daily overview.
 * - Calls generateMorningBrief() to gather data from across LifeOS
 * - Sends that data to the LLM proxy for a conversational summary
 * - Caches the result in localStorage for the current day
 * - Falls back to static greeting if offline or on free tier
 * - Awards 5 XP daily "check-in" on first view
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, RefreshCw, Calendar, CheckSquare, Flame, Target,
  ArrowRight, Zap, Sun, Moon, CloudSun, ChevronRight, ChevronDown,
} from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { supabase } from '../../lib/supabase';
import { generateMorningBrief, type LLMMorningBrief } from '../../lib/llm/morning-brief';
import { callLLMSimple } from '../../lib/llm-proxy';
import { agentChat, agentHealthCheck } from '../../lib/zeroclaw-client';
import { awardXP } from '../../lib/gamification/xp-engine';
import { localDateStr } from '../../utils/date';
import { logger } from '../../utils/logger';
import { GamificationModal } from '../GamificationModal';

// ── TYPES ──────────────────────────────────────────────────────────────────────

interface CachedBrief {
  date: string;
  briefData: LLMMorningBrief;
  aiSummary: string;
  generatedAt: number;
}

// ── CACHE HELPERS ──────────────────────────────────────────────────────────────

const CACHE_KEY_PREFIX = 'lifeos-morning-brief-';
const XP_CACHE_KEY = 'lifeos-morning-brief-xp-';

function getCachedBrief(userId: string, date: string): CachedBrief | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${userId}-${date}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBrief;
    if (parsed.date !== date) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCachedBrief(userId: string, date: string, briefData: LLMMorningBrief, aiSummary: string) {
  const cached: CachedBrief = { date, briefData, aiSummary, generatedAt: Date.now() };
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${userId}-${date}`, JSON.stringify(cached));
  } catch {
    // localStorage full — silently fail
  }
}

function hasAwardedXPToday(userId: string, date: string): boolean {
  try {
    return localStorage.getItem(`${XP_CACHE_KEY}${userId}-${date}`) === 'true';
  } catch {
    return false;
  }
}

function markXPAwarded(userId: string, date: string) {
  try {
    localStorage.setItem(`${XP_CACHE_KEY}${userId}-${date}`, 'true');
  } catch {
    // silently fail
  }
}

// ── LLM PROMPT ─────────────────────────────────────────────────────────────────

function buildBriefPrompt(brief: LLMMorningBrief, firstName: string): string {
  const scheduleSummary = brief.todaySchedule.length > 0
    ? brief.todaySchedule.map(e => `  - ${e.time}: ${e.title}${e.location ? ` @ ${e.location}` : ''}`).join('\n')
    : '  No events scheduled';

  const questsSummary = brief.activeQuests.length > 0
    ? brief.activeQuests.map(q => `  - [${q.priority}] ${q.icon} ${q.title} (+${q.reward_xp} XP)`).join('\n')
    : '  No active quests';

  const finSummary = brief.financeSummary
    ? `This week: $${brief.financeSummary.income.toFixed(0)} income, $${brief.financeSummary.expenses.toFixed(0)} expenses (net: $${brief.financeSummary.net.toFixed(0)})`
    : 'No financial data this week';

  const partnerInfo = brief.partnerUpdates.length > 0
    ? brief.partnerUpdates.join('; ')
    : 'No partner updates';

  return `You are the LifeOS AI assistant. Generate a brief, personalized morning brief for ${firstName}.

TODAY'S DATA:
- Date: ${brief.date}
- Schedule (${brief.stats.upcomingEvents} events):
${scheduleSummary}
- Active quests (${brief.activeQuests.length}):
${questsSummary}
- Habits: ${brief.stats.habitsNotLogged} habits not yet logged today
- Best streak: ${brief.streakStatus.days} days (${brief.streakStatus.label})
- XP earned today: ${brief.xpToday}
- Finance: ${finSummary}
- Partners: ${partnerInfo}
- Suggested focus: ${brief.suggestedFocus}

RULES:
- Write 3-5 SHORT sentences max. Be conversational, warm, and motivating.
- Start with a brief greeting/observation about their day ahead.
- Mention the most important 1-2 things: key event, habit streak, or quest.
- End with one punchy motivational line.
- Don't list everything — highlight what matters most.
- Be specific to their data, not generic.
- Don't use emojis excessively — max 2-3.
- Don't mention "LifeOS" or sound like an AI assistant.
- Sound like a sharp, supportive friend who knows their goals.
- If the user has no events, quests, or habits, don't mention them. Focus on suggesting what they could do to get started with their day.`;
}

// ── TIME-BASED ICON ────────────────────────────────────────────────────────────

function getTimeIcon() {
  const h = new Date().getHours();
  if (h < 6) return <Moon size={18} style={{ color: '#A78BFA' }} />;
  if (h < 12) return <Sun size={18} style={{ color: '#FACC15' }} />;
  if (h < 17) return <CloudSun size={18} style={{ color: '#F97316' }} />;
  return <Moon size={18} style={{ color: '#A78BFA' }} />;
}

// ── COMPONENT ──────────────────────────────────────────────────────────────────

export function DashboardMorningBrief() {
  const user = useUserStore(s => s.user);
  const firstName = useUserStore(s => s.firstName);
  const navigate = useNavigate();

  const [briefData, setBriefData] = useState<LLMMorningBrief | null>(null);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [gamModalOpen, setGamModalOpen] = useState(false);
  const xpAwardedRef = useRef(false);

  const today = localDateStr();

  // Award check-in XP (once per day)
  const awardCheckinXP = useCallback(async () => {
    if (!user?.id || xpAwardedRef.current || hasAwardedXPToday(user.id, today)) return;
    xpAwardedRef.current = true;
    markXPAwarded(user.id, today);
    try {
      await awardXP(supabase, user.id, 'page_visit', {
        description: 'Morning brief check-in',
      });
    } catch {
      // Non-critical — don't break the brief
    }
  }, [user?.id, today]);

  // Generate the brief
  const generateBrief = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = getCachedBrief(user.id, today);
      if (cached) {
        setBriefData(cached.briefData);
        setAiSummary(cached.aiSummary);
        setLoading(false);
        setVisible(true);
        awardCheckinXP();
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
      const data = await generateMorningBrief(user.id, supabase);
      setBriefData(data);

      // Step 2: Check if data is entirely empty (first-time user) — skip LLM
      const isEmpty = data.todaySchedule.length === 0
        && data.activeQuests.length === 0
        && data.stats.habitsNotLogged === 0
        && data.streakStatus.days === 0
        && data.xpToday === 0;

      if (isEmpty) {
        const summary = `Hey ${firstName || 'there'}! Welcome — your dashboard is a blank canvas right now. Start by setting a goal or adding a habit, and this brief will light up with your day ahead.`;
        setAiSummary(summary);
        setCachedBrief(user.id, today, data, summary);
        awardCheckinXP();
        return;
      }

      // Step 3: Call ZeroClaw first, fall back to LLM proxy, then static
      let summary: string;
      try {
        const zcOnline = await agentHealthCheck();
        if (zcOnline) {
          const prompt = buildBriefPrompt(data, firstName || 'there');
          const zcRes = await agentChat({
            userId: user.id,
            message: prompt,
            context: { currentPage: 'dashboard' },
          });
          summary = zcRes.message;
          // Try to extract a primary action from ZeroClaw's response
          if (!data.primaryAction && zcRes.actions?.length) {
            const navAction = zcRes.actions.find(a => a.type === 'navigate');
            if (navAction?.payload?.path) {
              data.primaryAction = {
                label: navAction.label,
                path: navAction.payload.path as string,
              };
            }
          }
        } else {
          throw new Error('ZeroClaw offline');
        }
      } catch {
        // ZeroClaw unavailable — fall back to LLM proxy
        try {
          const prompt = buildBriefPrompt(data, firstName || 'there');
          summary = await callLLMSimple(prompt, { timeoutMs: 15000 });
        } catch {
          summary = buildFallbackSummary(data, firstName || 'there');
        }
      }

      setAiSummary(summary);
      setCachedBrief(user.id, today, data, summary);
      awardCheckinXP();
    } catch (err) {
      logger.error('[MorningBrief] Generation failed:', err);
      setError('Could not load your morning brief');
      // Try to show cached version even if stale
      const cached = getCachedBrief(user.id, today);
      if (cached) {
        setBriefData(cached.briefData);
        setAiSummary(cached.aiSummary);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      // Animate in after a short delay
      setTimeout(() => setVisible(true), 100);
    }
  }, [user?.id, today, firstName, awardCheckinXP]);

  useEffect(() => {
    generateBrief();
  }, [generateBrief]);

  // ── LOADING SHIMMER ──
  if (loading) {
    return (
      <section className="dash-card" style={{
        background: 'linear-gradient(135deg, rgba(124,92,252,0.08) 0%, rgba(0,212,255,0.05) 100%)',
        border: '1px solid rgba(124,92,252,0.15)',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 160,
        gridColumn: '1 / -1',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div className="shimmer-line" style={{ width: 20, height: 20, borderRadius: '50%' }} />
          <div className="shimmer-line" style={{ width: 180, height: 16, borderRadius: 8 }} />
        </div>
        <div className="shimmer-line" style={{ width: '90%', height: 14, borderRadius: 6, marginBottom: 8 }} />
        <div className="shimmer-line" style={{ width: '75%', height: 14, borderRadius: 6, marginBottom: 8 }} />
        <div className="shimmer-line" style={{ width: '60%', height: 14, borderRadius: 6, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="shimmer-line" style={{ width: 80, height: 28, borderRadius: 14 }} />
          <div className="shimmer-line" style={{ width: 80, height: 28, borderRadius: 14 }} />
          <div className="shimmer-line" style={{ width: 80, height: 28, borderRadius: 14 }} />
        </div>

        {/* Shimmer animation overlay */}
        <div style={{
          position: 'absolute',
          top: 0, left: '-100%',
          width: '200%', height: '100%',
          background: 'linear-gradient(90deg, transparent 25%, rgba(124,92,252,0.03) 50%, transparent 75%)',
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
  if (error && !briefData) {
    return (
      <section className="dash-card" style={{
        gridColumn: '1 / -1',
        textAlign: 'center',
        padding: '24px 20px',
      }}>
        <p style={{ color: '#8BA4BE', fontSize: 13 }}>{error}</p>
        <button
          onClick={() => generateBrief(true)}
          style={{
            background: 'rgba(0,212,255,0.1)',
            border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: 8,
            padding: '6px 14px',
            color: '#00D4FF',
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

  if (!briefData) return null;

  // ── MAIN CARD ──
  return (
    <section
      className="dash-card morning-brief-card"
      style={{
        gridColumn: '1 / -1',
        background: 'linear-gradient(135deg, rgba(124,92,252,0.08) 0%, rgba(0,212,255,0.05) 50%, rgba(124,92,252,0.04) 100%)',
        border: '1px solid rgba(124,92,252,0.18)',
        padding: 0,
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
        position: 'relative',
      }}
    >
      {/* Subtle glow effect */}
      <div style={{
        position: 'absolute',
        top: -40, right: -40,
        width: 120, height: 120,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,92,252,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: -30, left: -30,
        width: 100, height: 100,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)',
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
          {getTimeIcon()}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#E8F0FE' }}>
                Your Daily Brief
              </h2>
              <Sparkles size={14} style={{ color: '#7C5CFC', opacity: 0.8 }} />
            </div>
            {collapsed && aiSummary ? (
              <p style={{
                margin: 0, fontSize: 12, color: '#8BA4BE',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}>
                {aiSummary.split(/[.!?]/)[0]}…
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 11, color: '#5A7A9A' }}>{briefData.date}</p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={(e) => { e.stopPropagation(); generateBrief(true); }}
            disabled={refreshing}
            title="Refresh brief"
            style={{
              background: 'rgba(124,92,252,0.1)',
              border: '1px solid rgba(124,92,252,0.2)',
              borderRadius: 8,
              padding: '6px 8px',
              color: '#7C5CFC',
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

      {/* Collapsible content — smooth expand/collapse */}
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

          {/* Quick Stats Pills — clickable */}
          <div style={{
            padding: '0 20px 14px',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            {briefData.stats.upcomingEvents > 0 && (
              <BriefPill
                icon={<Calendar size={11} />}
                label={`${briefData.stats.upcomingEvents} event${briefData.stats.upcomingEvents !== 1 ? 's' : ''}`}
                color="#A855F7"
                onClick={() => navigate('/schedule')}
              />
            )}
            {briefData.activeQuests.length > 0 && (
              <BriefPill
                icon={<CheckSquare size={11} />}
                label={`${briefData.activeQuests.length} quest${briefData.activeQuests.length !== 1 ? 's' : ''}`}
                color="#00D4FF"
                onClick={() => navigate('/character?tab=quests')}
              />
            )}
            {briefData.streakStatus.days > 0 && (
              <BriefPill
                icon={<Flame size={11} />}
                label={`${briefData.streakStatus.days}d streak`}
                color="#F97316"
                onClick={() => navigate('/habits')}
              />
            )}
            {briefData.stats.habitsNotLogged > 0 && (
              <BriefPill
                icon={<Target size={11} />}
                label={`${briefData.stats.habitsNotLogged} habit${briefData.stats.habitsNotLogged !== 1 ? 's' : ''} left`}
                color="#EAB308"
                onClick={() => navigate('/habits')}
              />
            )}
            {briefData.xpToday > 0 && (
              <BriefPill
                icon={<Zap size={11} />}
                label={`+${briefData.xpToday} XP`}
                color="#22C55E"
                onClick={() => setGamModalOpen(true)}
              />
            )}
          </div>

          {/* Primary Action */}
          {briefData.primaryAction && (
            <div style={{
              padding: '0 20px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <button
                onClick={() => {
                  if (briefData.primaryAction) navigate(briefData.primaryAction.path);
                }}
                style={{
                  background: 'linear-gradient(135deg, rgba(124,92,252,0.15) 0%, rgba(0,212,255,0.1) 100%)',
                  border: '1px solid rgba(124,92,252,0.25)',
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
                  e.currentTarget.style.borderColor = 'rgba(124,92,252,0.5)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(124,92,252,0.25)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {briefData.primaryAction.label}
                <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Gamification Modal for XP pill */}
      <GamificationModal open={gamModalOpen} onClose={() => setGamModalOpen(false)} />

      {/* Gradient border glow at top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '5%',
        right: '5%',
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(124,92,252,0.4), rgba(0,212,255,0.3), transparent)',
        pointerEvents: 'none',
      }} />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .morning-brief-card:hover {
          border-color: rgba(124,92,252,0.28) !important;
        }
      `}</style>
    </section>
  );
}

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────────

function BriefPill({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick?: () => void }) {
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

// ── FALLBACK SUMMARY (when LLM is unavailable) ─────────────────────────────────

function buildFallbackSummary(brief: LLMMorningBrief, firstName: string): string {
  const parts: string[] = [];

  // Greeting
  parts.push(brief.greeting);

  // Schedule
  if (brief.todaySchedule.length > 0) {
    const first = brief.todaySchedule[0];
    parts.push(
      brief.todaySchedule.length === 1
        ? `You've got "${first.title}" at ${first.time} today.`
        : `You have ${brief.todaySchedule.length} events today, starting with "${first.title}" at ${first.time}.`
    );
  } else {
    parts.push("Your schedule is clear today — perfect time to make progress on your goals.");
  }

  // Streak
  if (brief.streakStatus.days > 0) {
    parts.push(`Your ${brief.streakStatus.days}-day streak is going strong — keep it alive.`);
  }

  // Habits
  if (brief.stats.habitsNotLogged > 0) {
    parts.push(`${brief.stats.habitsNotLogged} habit${brief.stats.habitsNotLogged !== 1 ? 's' : ''} still to log today.`);
  }

  // Quests
  if (brief.activeQuests.length > 0) {
    parts.push(`${brief.activeQuests.length} quest${brief.activeQuests.length !== 1 ? 's' : ''} waiting for you.`);
  }

  // Finance
  if (brief.financeSummary && brief.financeSummary !== 'No data') {
    parts.push(brief.financeSummary);
  }

  // XP
  if (brief.xpToday > 0) {
    parts.push(`You've earned ${brief.xpToday} XP so far today.`);
  }

  // Focus
  if (brief.suggestedFocus) {
    parts.push(`Suggested focus: ${brief.suggestedFocus}.`);
  } else {
    parts.push(brief.motivationalNote);
  }

  return parts.join(' ');
}
