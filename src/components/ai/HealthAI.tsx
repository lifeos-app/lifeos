/**
 * HealthAI — Holistic Health Domain AI Card
 *
 * Sits above the Health page tabs. Pulls context from ALL health sub-domains
 * (nutrition, exercise, sleep, mood, energy, weight, water, meditation) and
 * provides a unified AI health summary with quick actions and Q&A.
 *
 * Glass card, green → cyan gradient, collapsible, daily cache.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Brain, Heart, ChevronDown, ChevronUp, RefreshCw, Loader2,
  Send, Sparkles, Apple, Dumbbell, Activity,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../stores/useUserStore';
import { useSubscription } from '../../hooks/useSubscription';
import { callLLMSimple } from '../../lib/llm-proxy';
import { canAccess } from '../../lib/feature-gates';
import './HealthAI.css';
import { logger } from '../../utils/logger';
import { getUIState, setUIState } from '../../utils/ui-state';

// ── Cache helpers ──

const CACHE_KEY_PREFIX = 'lifeos_health_ai_cache_';

interface CacheEntry {
  date: string;
  summary: string;
}

function getCached(userId: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];
    if (entry.date === today) return entry;
    return null;
  } catch { return null; }
}

function setCache(userId: string, summary: string) {
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify({ date: today, summary }));
}

// ── Data loader ──

interface HealthSnapshot {
  recentMetrics: string;
  exerciseSummary: string;
  nutritionSummary: string;
  meditationSummary: string;
}

async function loadHealthSnapshot(userId: string): Promise<HealthSnapshot> {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString().split('T')[0];

  const [metricsRes, exerciseRes, meditationRes, mealsRes] = await Promise.all([
    supabase
      .from('health_metrics')
      .select('mood_score, energy_score, sleep_hours, sleep_quality, water_glasses, weight_kg, date')
      .eq('user_id', userId)
      .gte('date', weekStr)
      .order('date', { ascending: false })
      .limit(7),
    supabase
      .from('exercise_logs')
      .select('title, completed, date, duration_min')
      .eq('user_id', userId)
      .gte('date', weekStr)
      .order('date', { ascending: false })
      .limit(14),
    supabase
      .from('meditation_logs')
      .select('duration_min, date')
      .eq('user_id', userId)
      .gte('date', weekStr)
      .order('date', { ascending: false })
      .limit(7),
    supabase
      .from('meals')
      .select('name, calories, protein_g, date')
      .eq('user_id', userId)
      .gte('date', weekStr)
      .order('date', { ascending: false })
      .limit(14),
  ]);

  const metrics = metricsRes.data || [];
  const exercises = exerciseRes.data || [];
  const meditations = meditationRes.data || [];
  const meals = mealsRes.data || [];

  // Build compact summaries
  const recentMetrics = metrics.length > 0
    ? metrics.map((m: any) => {
        const parts: string[] = [];
        if (m.mood_score) parts.push(`mood:${m.mood_score}/5`);
        if (m.energy_score) parts.push(`energy:${m.energy_score}/5`);
        if (m.sleep_hours) parts.push(`sleep:${m.sleep_hours}h`);
        if (m.water_glasses) parts.push(`water:${m.water_glasses}`);
        if (m.weight_kg) parts.push(`weight:${m.weight_kg}kg`);
        return `${m.date}: ${parts.join(', ') || 'no data'}`;
      }).join('\n')
    : 'No health metrics logged this week.';

  const completedWorkouts = exercises.filter((e: any) => e.completed);
  const exerciseSummary = exercises.length > 0
    ? `${completedWorkouts.length} workouts completed this week. ${exercises.filter((e: any) => !e.completed).length} skipped. Recent: ${completedWorkouts.slice(0, 3).map((e: any) => `${e.title || 'Workout'} (${e.duration_min || '?'}min)`).join(', ') || 'none'}`
    : 'No exercise logged this week.';

  const totalMedMin = meditations.reduce((s: number, m: any) => s + (m.duration_min || 0), 0);
  const meditationSummary = meditations.length > 0
    ? `${meditations.length} meditation sessions this week, ${totalMedMin} total minutes.`
    : 'No meditation logged this week.';

  const totalCals = meals.reduce((s: number, m: any) => s + (m.calories || 0), 0);
  const totalProtein = meals.reduce((s: number, m: any) => s + (m.protein_g || 0), 0);
  const nutritionSummary = meals.length > 0
    ? `${meals.length} meals logged this week. ~${Math.round(totalCals / Math.max(1, new Set(meals.map((m: any) => m.date)).size))} cal/day avg. ~${Math.round(totalProtein / Math.max(1, new Set(meals.map((m: any) => m.date)).size))}g protein/day avg.`
    : 'No meals logged this week.';

  return { recentMetrics, exerciseSummary, nutritionSummary, meditationSummary };
}

// ── Safety wrapper for LLM responses ──
function sanitizeLLMResponse(text: string): string {
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const p = JSON.parse(t);
      // Check common LLM response field names
      const extracted = p.summary || p.message || p.text || p.analysis || p.response || p.content || p.answer;
      if (typeof extracted === 'string' && extracted.length > 0) return extracted;
      // Fallback: extract first string value from the object
      if (typeof p === 'object' && p !== null && !Array.isArray(p)) {
        const firstStr = Object.values(p).find(v => typeof v === 'string' && (v as string).length > 10);
        if (firstStr) return firstStr as string;
      }
      return t;
    } catch { /* not JSON, pass through */ }
  }
  return t;
}

// ── Component ──

interface HealthAIProps {
  onTabChange?: (tab: string) => void;
}

export function HealthAI({ onTabChange }: HealthAIProps) {
  const user = useUserStore(s => s.user);
  const { tier } = useSubscription();
  const [expanded, setExpanded] = useState(() => {
    // First visit: expanded. After first visit: collapsed.
    return !getUIState('health_ai_seen');
  });
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [askInput, setAskInput] = useState('');
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Mark as seen after first render
  useEffect(() => {
    if (!getUIState('health_ai_seen')) {
      setUIState('health_ai_seen');
    }
  }, []);

  const fetchSummary = useCallback(async (force = false) => {
    if (!user?.id) return;
    if (!canAccess('health_analytics', tier)) return;

    // Check cache first
    if (!force) {
      const cached = getCached(user.id);
      if (cached) {
        if (mountedRef.current) setSummary(cached.summary);
        return;
      }
    }

    setLoading(true);
    try {
      const snapshot = await loadHealthSnapshot(user.id);
      if (!mountedRef.current) return;

      const prompt = `You are a holistic health AI for a personal life management app called LifeOS. Analyze this user's health data from the past week and provide a brief, friendly summary (3-5 sentences). Be specific about what's going well and what needs attention. Use a warm, encouraging tone.

Health Metrics (last 7 days):
${snapshot.recentMetrics}

Exercise:
${snapshot.exerciseSummary}

Nutrition:
${snapshot.nutritionSummary}

Meditation/Mindfulness:
${snapshot.meditationSummary}

Give a holistic summary touching on sleep, nutrition, exercise, and mental wellness. If data is missing, gently suggest logging it. Don't use markdown headers or bullet points — just flowing sentences.`;

      const result = await callLLMSimple(prompt, { timeoutMs: 20000 });
      if (!mountedRef.current) return;
      const sanitized = sanitizeLLMResponse(result);
      setSummary(sanitized);
      setCache(user.id, sanitized);
    } catch (err) {
      logger.error('[HealthAI] Summary failed:', err);
      if (mountedRef.current) setSummary('Unable to generate health summary right now. Try refreshing later.');
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
      const snapshot = await loadHealthSnapshot(user.id);

      const prompt = `You are a holistic health AI assistant for LifeOS. Answer the user's health question based on their recent data. Be helpful, specific, and concise (2-4 sentences).

Health Metrics (last 7 days):
${snapshot.recentMetrics}

Exercise: ${snapshot.exerciseSummary}
Nutrition: ${snapshot.nutritionSummary}
Meditation: ${snapshot.meditationSummary}

User question: ${askInput.trim()}

Respond directly and helpfully. No markdown formatting.`;

      const result = await callLLMSimple(prompt, { timeoutMs: 20000 });
      setAskAnswer(sanitizeLLMResponse(result));
    } catch (err) {
      logger.error('[HealthAI] Ask failed:', err);
      setAskAnswer('Sorry, I couldn\'t process that right now. Try again later.');
    } finally {
      setAsking(false);
    }
  };

  // Don't render if no user or not Pro
  if (!user?.id || !canAccess('health_analytics', tier)) return null;

  return (
    <div className={`health-ai-card${expanded ? '' : ' hai-collapsed'}`}>
      <div className="hai-header" onClick={() => setExpanded(!expanded)}>
        <div className="hai-header-left">
          <div className="hai-icon-wrap">
            <Brain size={15} className="hai-icon-brain" />
            {expanded && <Heart size={13} className="hai-icon-heart" />}
          </div>
          {expanded ? (
            <h3 className="hai-title">Health AI</h3>
          ) : (
            <span className="hai-collapsed-text">Health AI — Tap for insights</span>
          )}
        </div>
        <div className="hai-header-right">
          {expanded && (
            <button
              className="hai-refresh-btn"
              onClick={(e) => { e.stopPropagation(); fetchSummary(true); }}
              disabled={loading}
              title="Refresh analysis"
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
            </button>
          )}
          {expanded ? <ChevronUp size={14} className="hai-chevron" /> : <ChevronDown size={14} className="hai-chevron" />}
        </div>
      </div>

      {expanded && (
        <div className="hai-body">
          {/* Loading state */}
          {loading && !summary && (
            <div className="hai-loading">
              <div className="hai-pulse-dot" />
              <div className="hai-pulse-dot" />
              <div className="hai-pulse-dot" />
              <span>Analyzing your health data...</span>
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div className="hai-summary">{summary}</div>
          )}

          {/* Quick actions */}
          <div className="hai-quick-actions">
            <button className="hai-quick-btn" onClick={() => onTabChange?.('diet')}>
              <Apple size={12} /> Suggest a meal
            </button>
            <button className="hai-quick-btn" onClick={() => onTabChange?.('exercise')}>
              <Dumbbell size={12} /> Generate workout
            </button>
            <button className="hai-quick-btn" onClick={() => onTabChange?.('overview')}>
              <Activity size={12} /> Log health metrics
            </button>
          </div>

          {/* Ask AI */}
          <div className="hai-ask-row">
            <input
              ref={inputRef}
              className="hai-ask-input"
              type="text"
              placeholder="Ask about your health..."
              value={askInput}
              onChange={(e) => setAskInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              disabled={asking}
            />
            <button
              className="hai-ask-send"
              onClick={handleAsk}
              disabled={!askInput.trim() || asking}
            >
              {asking ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
            </button>
          </div>

          {/* AI Answer */}
          {askAnswer && (
            <div className="hai-answer">
              <div className="hai-answer-label">
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

export default HealthAI;
