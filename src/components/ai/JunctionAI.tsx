/**
 * JunctionAI — Holistic Spiritual/Junction Domain AI Card
 *
 * Sits above the Junctions page content. Shows junction status, balance
 * check across ladders, recommends activities for XP in lagging areas,
 * and explains the Junction system to new users.
 *
 * Glass card, purple → indigo gradient, collapsible, daily cache.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Compass, Sparkles, ChevronDown, ChevronUp, RefreshCw, Loader2,
  Send, BookOpen, Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../stores/useUserStore';
import { useSubscription } from '../../hooks/useSubscription';
import { callLLMSimple } from '../../lib/llm-proxy';
import { canAccess } from '../../lib/feature-gates';
import './JunctionAI.css';
import { logger } from '../../utils/logger';

// ── Cache helpers ──

const CACHE_KEY = 'lifeos_junction_ai_cache';

interface CacheEntry {
  date: string;
  summary: string;
}

function getCached(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];
    if (entry.date === today) return entry;
    return null;
  } catch { return null; }
}

function setCache(summary: string) {
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, summary }));
}

// ── Tier labels ──

const TIER_LABELS: Record<number, string> = {
  0: 'Seeker',
  1: 'Acolyte',
  2: 'Adept',
  3: 'Master',
  4: 'Exalted',
  5: 'Legend',
  6: 'Prophet',
  7: 'Divine',
};

// ── Data types ──

interface JunctionSnapshot {
  isEquipped: boolean;
  traditionName: string | null;
  traditionSlug: string | null;
  traditionIcon: string | null;
  currentFigureName: string | null;
  currentTier: number;
  junctionXP: number;
  nextFigureXP: number;
  nextFigureName: string | null;
  progressPercent: number;
  equippedDaysAgo: number;
  practiceCount: number;
  recentPractices: string;
}

async function loadJunctionSnapshot(userId: string): Promise<JunctionSnapshot> {
  // Get user junction data
  const { data: uj } = await supabase
    .from('user_junction')
    .select('tradition_id, current_figure_id, junction_xp, equipped_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!uj) {
    return {
      isEquipped: false,
      traditionName: null,
      traditionSlug: null,
      traditionIcon: null,
      currentFigureName: null,
      currentTier: 0,
      junctionXP: 0,
      nextFigureXP: 0,
      nextFigureName: null,
      progressPercent: 0,
      equippedDaysAgo: 0,
      practiceCount: 0,
      recentPractices: 'No junction equipped.',
    };
  }

  // Fetch tradition, current figure, next figure, and practice logs in parallel
  const [traditionRes, figureRes, allFiguresRes, practiceLogsRes] = await Promise.all([
    supabase
      .from('junction_traditions')
      .select('name, slug, icon')
      .eq('id', uj.tradition_id)
      .maybeSingle(),
    uj.current_figure_id
      ? supabase
          .from('junction_figures')
          .select('name, title, tier')
          .eq('id', uj.current_figure_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('junction_figures')
      .select('name, xp_required, tier')
      .eq('tradition_id', uj.tradition_id)
      .order('xp_required', { ascending: true })
      .limit(20),
    supabase
      .from('user_junction_log')
      .select('xp_earned, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const tradition = traditionRes.data;
  const currentFigure = figureRes.data;
  const allFigures = allFiguresRes.data || [];
  const practiceLogs = practiceLogsRes.data || [];

  // Find next figure
  const currentXP = uj.junction_xp || 0;
  const nextFigure = allFigures.find((f: any) => f.xp_required > currentXP);
  const nextFigureXP = nextFigure?.xp_required || currentXP;
  const progressPercent = nextFigureXP > 0 ? Math.min(Math.round((currentXP / nextFigureXP) * 100), 100) : 100;

  const equippedDaysAgo = Math.floor(
    (Date.now() - new Date(uj.equipped_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const recentPractices = practiceLogs.length > 0
    ? `${practiceLogs.length} recent practice logs. Total XP earned recently: ${practiceLogs.reduce((s: number, p: any) => s + (p.xp_earned || 0), 0)}.`
    : 'No practice logs yet.';

  return {
    isEquipped: true,
    traditionName: tradition?.name || 'Unknown',
    traditionSlug: tradition?.slug || null,
    traditionIcon: tradition?.icon || '🔮',
    currentFigureName: currentFigure?.name || null,
    currentTier: currentFigure?.tier || 0,
    junctionXP: currentXP,
    nextFigureXP,
    nextFigureName: nextFigure?.name || null,
    progressPercent,
    equippedDaysAgo,
    practiceCount: practiceLogs.length,
    recentPractices,
  };
}

// ── Component ──

export function JunctionAI() {
  const user = useUserStore(s => s.user);
  const { tier } = useSubscription();
  const [expanded, setExpanded] = useState(true);
  const [snapshot, setSnapshot] = useState<JunctionSnapshot | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [askInput, setAskInput] = useState('');
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchSummary = useCallback(async (force = false) => {
    if (!user?.id) return;

    // Check cache first
    if (!force) {
      const cached = getCached();
      if (cached) {
        if (mountedRef.current) setSummary(cached.summary);
        // Still load snapshot for status display
        const snap = await loadJunctionSnapshot(user.id);
        if (mountedRef.current) setSnapshot(snap);
        return;
      }
    }

    setLoading(true);
    try {
      const snap = await loadJunctionSnapshot(user.id);
      if (!mountedRef.current) return;
      setSnapshot(snap);

      if (!snap.isEquipped) {
        const welcomeMsg = 'Welcome to the Junction System! Equip a wisdom tradition below to begin your spiritual growth journey. Each tradition offers unique practices, figures to unlock, and XP-based progression.';
        setSummary(welcomeMsg);
        setCache(welcomeMsg);
        setLoading(false);
        return;
      }

      if (!canAccess('health_analytics', tier)) {
        setSummary(`You're on the ${snap.traditionName} path as a ${TIER_LABELS[snap.currentTier] || 'Seeker'}. You have ${snap.junctionXP} Junction XP. Keep practicing to unlock new spiritual figures!`);
        setLoading(false);
        return;
      }

      const prompt = `You are a spiritual AI guide for the Junction System in LifeOS — a gamified spiritual growth system where users equip wisdom traditions (like Tewahedo, Buddhism, Islam, etc.) and earn Junction XP through practices.

Analyze this user's junction status and give a warm, spiritually-aware summary (2-4 sentences). Be encouraging and suggest what they could do next.

Junction Status:
- Equipped Tradition: ${snap.traditionName} ${snap.traditionIcon}
- Current Tier: ${TIER_LABELS[snap.currentTier] || 'Seeker'} (Tier ${snap.currentTier})
- Current Figure: ${snap.currentFigureName || 'None unlocked'}
- Junction XP: ${snap.junctionXP}
- Next Milestone: ${snap.nextFigureName || 'Max tier reached'} (${snap.nextFigureXP} XP needed)
- Progress: ${snap.progressPercent}%
- Days on this tradition: ${snap.equippedDaysAgo}
- Recent activity: ${snap.recentPractices}

Be specific. Reference their tradition by name. Don't use markdown. Keep it warm and spiritual.`;

      const result = await callLLMSimple(prompt, { timeoutMs: 20000 });
      if (!mountedRef.current) return;
      setSummary(result);
      setCache(result);
    } catch (err) {
      logger.error('[JunctionAI] Summary failed:', err);
      if (mountedRef.current) setSummary('Unable to generate spiritual summary right now. Try refreshing later.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user?.id, tier]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleAsk = async () => {
    if (!askInput.trim() || asking || !user?.id) return;
    if (!canAccess('unlimited_ai', tier)) return;

    setAsking(true);
    setAskAnswer(null);

    try {
      const snap = snapshot || await loadJunctionSnapshot(user.id);

      const prompt = `You are a spiritual AI guide for the Junction System in LifeOS. Answer the user's question about their spiritual journey.

Context:
- Equipped Tradition: ${snap.traditionName || 'None'} ${snap.traditionIcon || ''}
- Current Tier: ${TIER_LABELS[snap.currentTier] || 'Seeker'} (Tier ${snap.currentTier})
- Junction XP: ${snap.junctionXP}
- Current Figure: ${snap.currentFigureName || 'None'}
- Next: ${snap.nextFigureName || 'Max'} at ${snap.nextFigureXP} XP
- Recent: ${snap.recentPractices}

The Junction System is a gamified spiritual growth feature. Users equip traditions (Tewahedo, Islam, Buddhism, Hinduism, Sikhism, Judaism, Stoicism, Catholic, Daoism, Aboriginal Dreaming). Each has practices that earn XP, figures to unlock at XP thresholds, and a tier progression (Seeker → Acolyte → Adept → Master → Exalted → Legend → Prophet → Divine).

User question: ${askInput.trim()}

Answer helpfully and concisely (2-4 sentences). No markdown. Be warm and spiritual.`;

      const result = await callLLMSimple(prompt, { timeoutMs: 20000 });
      setAskAnswer(result);
    } catch (err) {
      logger.error('[JunctionAI] Ask failed:', err);
      setAskAnswer('Sorry, I couldn\'t process that right now. Try again later.');
    } finally {
      setAsking(false);
    }
  };

  if (!user?.id) return null;

  return (
    <div className="junction-ai-card">
      <div className="jai-header" onClick={() => setExpanded(!expanded)}>
        <div className="jai-header-left">
          <div className="jai-icon-wrap">
            <Compass size={15} className="jai-icon-compass" />
            <Sparkles size={13} className="jai-icon-sparkles" />
          </div>
          <h3 className="jai-title">Junction AI</h3>
        </div>
        <div className="jai-header-right">
          <button
            className="jai-refresh-btn"
            onClick={(e) => { e.stopPropagation(); fetchSummary(true); }}
            disabled={loading}
            title="Refresh analysis"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
          {expanded ? <ChevronUp size={14} className="jai-chevron" /> : <ChevronDown size={14} className="jai-chevron" />}
        </div>
      </div>

      {expanded && (
        <div className="jai-body">
          {/* Loading state */}
          {loading && !summary && (
            <div className="jai-loading">
              <div className="jai-pulse-dot" />
              <div className="jai-pulse-dot" />
              <div className="jai-pulse-dot" />
              <span>Consulting the wisdom paths...</span>
            </div>
          )}

          {/* New user welcome */}
          {snapshot && !snapshot.isEquipped && (
            <div className="jai-welcome">
              <div className="jai-welcome-icon">🔮</div>
              <h4>Welcome to the Junction System</h4>
              <p>
                Junctions are spiritual growth paths inspired by the world's wisdom traditions.
                Equip a tradition, practice daily, earn Junction XP, and unlock legendary
                spiritual figures. It's your inner journey, gamified.
              </p>
            </div>
          )}

          {/* Summary */}
          {summary && snapshot?.isEquipped && (
            <div className="jai-summary">{summary}</div>
          )}

          {/* Status grid (only when equipped) */}
          {snapshot?.isEquipped && (
            <>
              <div className="jai-status-grid">
                <div className="jai-status-item">
                  <span className="jai-status-label">Tradition</span>
                  <span className="jai-status-value">{snapshot.traditionIcon} {snapshot.traditionName}</span>
                </div>
                <div className="jai-status-item">
                  <span className="jai-status-label">Tier</span>
                  <span className="jai-status-value highlight">{TIER_LABELS[snapshot.currentTier] || 'Seeker'}</span>
                </div>
                <div className="jai-status-item">
                  <span className="jai-status-label">Junction XP</span>
                  <span className="jai-status-value">{snapshot.junctionXP}</span>
                </div>
                <div className="jai-status-item">
                  <span className="jai-status-label">Days Active</span>
                  <span className="jai-status-value">{snapshot.equippedDaysAgo}d</span>
                </div>
              </div>

              {/* XP Progress bar */}
              {snapshot.nextFigureName && (
                <div className="jai-xp-bar-wrap">
                  <div className="jai-xp-label-row">
                    <span>{snapshot.currentFigureName || 'Start'}</span>
                    <span>{snapshot.nextFigureName} ({snapshot.nextFigureXP} XP)</span>
                  </div>
                  <div className="jai-xp-bar">
                    <div className="jai-xp-fill" style={{ width: `${snapshot.progressPercent}%` }} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Quick actions */}
          <div className="jai-quick-actions">
            <button className="jai-quick-btn" onClick={() => {
              // Scroll to practices section on the page
              document.querySelector('.jnc-practices')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}>
              <Zap size={12} /> Log spiritual practice
            </button>
            <button className="jai-quick-btn" onClick={() => {
              // Scroll to progression/figures section
              document.querySelector('.jnc-progression')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}>
              <BookOpen size={12} /> View progression
            </button>
          </div>

          {/* Ask AI */}
          <div className="jai-ask-row">
            <input
              ref={inputRef}
              className="jai-ask-input"
              type="text"
              placeholder="Ask about your spiritual journey..."
              value={askInput}
              onChange={(e) => setAskInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              disabled={asking}
            />
            <button
              className="jai-ask-send"
              onClick={handleAsk}
              disabled={!askInput.trim() || asking}
            >
              {asking ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
            </button>
          </div>

          {/* AI Answer */}
          {askAnswer && (
            <div className="jai-answer">
              <div className="jai-answer-label">
                <Sparkles size={10} /> AI Response
              </div>
              {askAnswer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default JunctionAI;
