/**
 * GoalCoachCard — AI coaching insights for goals.
 *
 * Shows neglected, behind-schedule, and stalled goals with
 * AI-generated next-step suggestions. "Accept" creates a task
 * under the relevant goal.
 *
 * Dark theme, glass-card style. Compact rows with action buttons.
 */

import { useState, useEffect, useCallback } from 'react';
import { Brain, Sparkles, Target, ChevronDown, ChevronUp, Loader2, Check, X, RefreshCw, AlertTriangle, TrendingDown, Pause, Rocket, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../stores/useUserStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useSubscription } from '../../hooks/useSubscription';
import { analyzeGoalCoach, type GoalCoachInsight, type GoalCoachResult } from '../../lib/llm/goal-coach';
import { showToast } from '../Toast';
import './GoalCoachCard.css';
import { logger } from '../../utils/logger';

interface GoalCoachCardProps {
  /** Compact mode for embedding in dashboard */
  compact?: boolean;
  /** Callback after accepting a suggestion (task created) */
  onTaskCreated?: () => void;
  /** Callback to trigger AI goal generation */
  onAIGenerate?: () => void;
}

const STATUS_CONFIG: Record<GoalCoachInsight['status'], { icon: React.ReactNode; label: string; color: string }> = {
  neglected: { icon: <AlertTriangle size={13} />, label: 'Neglected', color: '#F43F5E' },
  behind: { icon: <TrendingDown size={13} />, label: 'Behind', color: '#F97316' },
  stalled: { icon: <Pause size={13} />, label: 'Stalled', color: '#FACC15' },
  on_track: { icon: <Check size={13} />, label: 'On Track', color: '#39FF14' },
  ahead: { icon: <Rocket size={13} />, label: 'Ahead', color: '#00D4FF' },
};

export function GoalCoachCard({ compact = false, onTaskCreated, onAIGenerate }: GoalCoachCardProps) {
  const user = useUserStore(s => s.user);
  const createTask = useScheduleStore(s => s.createTask);
  const { tier } = useSubscription();
  const [result, setResult] = useState<GoalCoachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualToggle, setManualToggle] = useState<boolean | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const fetchInsights = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await analyzeGoalCoach(user.id, supabase, tier);
      setResult(data);
    } catch (err) {
      logger.error('[GoalCoach] Analysis failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, tier]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // Listen for goal/task changes
  useEffect(() => {
    const handler = () => fetchInsights();
    window.addEventListener('lifeos-refresh', handler);
    return () => window.removeEventListener('lifeos-refresh', handler);
  }, [fetchInsights]);

  const acceptSuggestion = async (insight: GoalCoachInsight) => {
    if (!user?.id) return;
    setAcceptingId(insight.goalId);

    try {
      const priority = insight.status === 'neglected' ? 'high' : 'medium';
      const ok = await createTask(user.id, insight.suggestedAction, priority, {
        goal_id: insight.goalId,
      });

      if (!ok) throw new Error('createTask returned false');

      showToast(`Task added to "${insight.goalTitle}"`, '✅', '#39FF14');
      setDismissedIds(prev => new Set([...prev, insight.goalId]));
      onTaskCreated?.();
    } catch (err) {
      logger.error('[GoalCoach] Accept failed:', err);
      showToast('Failed to create task', '⚠️', '#F43F5E');
    } finally {
      setAcceptingId(null);
    }
  };

  const dismissInsight = (goalId: string) => {
    setDismissedIds(prev => new Set([...prev, goalId]));
  };

  // Filter out dismissed insights
  const visibleInsights = result?.insights.filter(i =>
    !dismissedIds.has(i.goalId) &&
    (i.status === 'neglected' || i.status === 'behind' || i.status === 'stalled')
  ) || [];

  const needsAttentionCount = visibleInsights.length;
  const hasNoGoals = result && result.insights.length === 0;

  // Auto-collapse when nothing actionable; expand when there are insights
  const expanded = manualToggle !== null
    ? manualToggle
    : needsAttentionCount > 0 || hasNoGoals || false;

  return (
    <div className={`goal-coach-card${compact ? ' compact' : ''}`}>
      <div className="gc-header" onClick={() => setManualToggle(!expanded)}>
        <div className="gc-header-left">
          <Brain size={16} className="gc-brain-icon" />
          <h3 className="gc-title">AI Goal Coach</h3>
          {needsAttentionCount > 0 && (
            <span className="gc-badge">{needsAttentionCount}</span>
          )}
        </div>
        <div className="gc-header-right">
          {!expanded && result && visibleInsights.length === 0 && !hasNoGoals && (
            <span className="gc-inline-status">✨ All on track</span>
          )}
          {!expanded && needsAttentionCount > 0 && (
            <span className="gc-inline-status gc-inline-warn">⚠ {needsAttentionCount} need attention</span>
          )}
          <button
            className="gc-refresh-btn"
            onClick={(e) => { e.stopPropagation(); fetchInsights(); }}
            disabled={loading}
            title="Refresh analysis"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
          {expanded ? <ChevronUp size={14} className="gc-chevron" /> : <ChevronDown size={14} className="gc-chevron" />}
        </div>
      </div>

      {expanded && (
        <div className="gc-body">
          {loading && !result && (
            <div className="gc-loading">
              <Loader2 size={18} className="spin" />
              <span>Analyzing your goals...</span>
            </div>
          )}

          {visibleInsights.length === 0 && result && !hasNoGoals && (
            <div className="gc-empty">
              <Sparkles size={16} />
              <span>All goals on track! Keep it up 🚀</span>
              {onAIGenerate && (
                <button className="gc-ai-tweak-btn" onClick={onAIGenerate}>
                  <Sparkles size={12} />
                  <span>Refine Goals with AI</span>
                </button>
              )}
            </div>
          )}

          {hasNoGoals && (
            <div className="gc-empty gc-empty--no-goals">
              <Target size={20} />
              <span>No goals yet — let AI help you get started</span>
              <p className="gc-empty-sub">
                Tell the AI coach about your aspirations and it'll create a structured goal tree for you.
              </p>
              {onAIGenerate ? (
                <button className="gc-ai-generate-btn" onClick={onAIGenerate}>
                  <Sparkles size={14} />
                  <span>AI Goal Creation</span>
                </button>
              ) : (
                <button className="gc-ai-generate-btn" onClick={() => {
                  // Navigate to onboarding/AI chat for goal creation
                  window.dispatchEvent(new CustomEvent('lifeos-open-ai-chat', { detail: { prompt: 'Help me create goals' } }));
                }}>
                  <Sparkles size={14} />
                  <span>AI Goal Creation</span>
                </button>
              )}
            </div>
          )}

          {visibleInsights.map(insight => {
            const config = STATUS_CONFIG[insight.status];
            const isAccepting = acceptingId === insight.goalId;

            return (
              <div
                key={insight.goalId}
                className={`gc-insight-row status-${insight.status}`}
              >
                <div className="gc-insight-icon" style={{ color: insight.goalColor }}>
                  {insight.goalIcon}
                </div>

                <div className="gc-insight-content">
                  <div className="gc-insight-top">
                    <span className="gc-insight-title">{insight.goalTitle}</span>
                    <span
                      className="gc-insight-status"
                      style={{ color: config.color }}
                    >
                      {config.icon} {config.label}
                    </span>
                  </div>

                  <div className="gc-insight-meta">
                    <span className="gc-insight-activity">
                      <Clock size={10} /> {insight.daysSinceActivity}d ago
                    </span>
                    <span className="gc-insight-progress">
                      {insight.progressPct}%
                      {insight.expectedProgressPct !== null && (
                        <span className="gc-expected"> / {insight.expectedProgressPct}% expected</span>
                      )}
                    </span>
                  </div>

                  <div className="gc-insight-suggestion">
                    <Sparkles size={11} />
                    <span>{insight.suggestedAction}</span>
                  </div>
                </div>

                <div className="gc-insight-actions">
                  <button
                    className="gc-accept-btn"
                    onClick={() => acceptSuggestion(insight)}
                    disabled={isAccepting}
                    title="Create task from suggestion"
                  >
                    {isAccepting ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                  </button>
                  <button
                    className="gc-dismiss-btn"
                    onClick={() => dismissInsight(insight.goalId)}
                    title="Dismiss"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {result && !result.isPro && visibleInsights.length > 0 && (
            <div className="gc-pro-hint">
              <Sparkles size={11} /> Upgrade to Pro for AI-powered coaching suggestions
            </div>
          )}
        </div>
      )}
    </div>
  );
}
