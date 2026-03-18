/**
 * ScheduleOptimizer — AI-powered schedule analysis card
 * 
 * Collapsible card showing:
 * - Quick stats (free time, gaps, conflicts)
 * - AI suggestions to fill gaps
 * - Goal-time balance bars
 * - Accept/dismiss actions on suggestions
 */

import { useState, useCallback, memo } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  Check,
  X,
  Target,
  Loader2,
  Zap,
  Brain,
  TrendingUp,
} from 'lucide-react';
import { useScheduleOptimizer, type OptimizerSuggestion, type BalanceInsight, type ScheduleConflict } from '../../hooks/useScheduleOptimizer';
import { showToast } from '../Toast';
import './ScheduleOptimizer.css';

interface Props {
  selectedDate: Date;
}

export const ScheduleOptimizer = memo(function ScheduleOptimizer({ selectedDate }: Props) {
  const {
    result,
    loading,
    error,
    analyze,
    acceptSuggestion,
    dismissSuggestion,
    quickStats,
  } = useScheduleOptimizer(selectedDate);

  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem('lifeos-optimizer-expanded') !== 'false';
    } catch { return true; }
  });

  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => {
      const next = !prev;
      try { localStorage.setItem('lifeos-optimizer-expanded', String(next)); } catch {}
      return next;
    });
  }, []);

  const handleAnalyze = useCallback(async () => {
    await analyze();
  }, [analyze]);

  const handleAccept = useCallback(async (suggestion: OptimizerSuggestion) => {
    setAcceptingId(suggestion.id);
    const success = await acceptSuggestion(suggestion);
    setAcceptingId(null);
    if (success) {
      showToast(`Added "${suggestion.title}" to schedule`, '✅');
    } else {
      showToast('Failed to add event', '❌', '#F43F5E');
    }
  }, [acceptSuggestion]);

  const handleDismiss = useCallback((id: string) => {
    dismissSuggestion(id);
  }, [dismissSuggestion]);

  const hasAnalysis = !!result;
  const suggestions = result?.suggestions || [];
  const conflicts = result?.conflicts || [];
  const balanceInsights = result?.balanceInsights || [];

  return (
    <div className="sched-optimizer glass-card">
      {/* Header — always visible */}
      <div className="so-header" onClick={toggleExpanded}>
        <div className="so-header-left">
          <Sparkles size={16} className="so-sparkle-icon" />
          <span className="so-title">AI Optimizer</span>
          {quickStats.conflictCount > 0 && (
            <span className="so-badge so-badge--conflict">
              <AlertTriangle size={10} /> {quickStats.conflictCount}
            </span>
          )}
        </div>
        <div className="so-header-right">
          <div className="so-quick-stats">
            <span className="so-stat">
              <Clock size={11} /> {quickStats.freeHours}h free
            </span>
            <span className="so-stat">
              <Zap size={11} /> {quickStats.gapCount} gap{quickStats.gapCount !== 1 ? 's' : ''}
            </span>
          </div>
          <button className="so-toggle" aria-label={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expandable body */}
      {expanded && (
        <div className="so-body">
          {/* Analyze button (if no analysis yet or want to refresh) */}
          {!hasAnalysis && !loading && (
            <button className="so-analyze-btn" onClick={handleAnalyze}>
              <Brain size={14} />
              <span>Analyze my schedule</span>
            </button>
          )}

          {/* Loading state */}
          {loading && (
            <div className="so-loading">
              <Loader2 size={18} className="spin" />
              <span>Analyzing your schedule...</span>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="so-error">
              <AlertTriangle size={14} />
              <span>{error}</span>
              <button className="so-retry-btn" onClick={handleAnalyze}>Retry</button>
            </div>
          )}

          {/* Analysis results */}
          {hasAnalysis && !loading && (
            <>
              {/* Summary */}
              <div className="so-summary">
                <p>{result.summary}</p>
              </div>

              {/* Conflicts */}
              {conflicts.length > 0 && (
                <div className="so-section">
                  <div className="so-section-header">
                    <AlertTriangle size={13} className="so-conflict-icon" />
                    <span>Conflicts ({conflicts.length})</span>
                  </div>
                  <div className="so-conflicts">
                    {conflicts.map((c: ScheduleConflict, i: number) => (
                      <div key={i} className="so-conflict-item">
                        <span className="so-conflict-text">
                          "{c.eventA.title}" overlaps "{c.eventB.title}" by {c.overlapMinutes}min
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="so-section">
                  <div className="so-section-header">
                    <Sparkles size={13} className="so-sparkle-icon" />
                    <span>Suggestions ({suggestions.length})</span>
                  </div>
                  <div className="so-suggestions">
                    {suggestions.map((s: OptimizerSuggestion) => (
                      <SuggestionCard
                        key={s.id}
                        suggestion={s}
                        onAccept={handleAccept}
                        onDismiss={handleDismiss}
                        accepting={acceptingId === s.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Balance Insights */}
              {balanceInsights.length > 0 && (
                <div className="so-section">
                  <div className="so-section-header">
                    <TrendingUp size={13} />
                    <span>Goal Balance (this week)</span>
                  </div>
                  <div className="so-balance">
                    {balanceInsights.map((b: BalanceInsight) => (
                      <BalanceBar key={b.goalId} insight={b} />
                    ))}
                  </div>
                </div>
              )}

              {/* Re-analyze button */}
              <button className="so-reanalyze-btn" onClick={handleAnalyze}>
                <Brain size={12} />
                <span>Re-analyze</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
});

// ── Suggestion Card ──

interface SuggestionCardProps {
  suggestion: OptimizerSuggestion;
  onAccept: (s: OptimizerSuggestion) => void;
  onDismiss: (id: string) => void;
  accepting: boolean;
}

function SuggestionCard({ suggestion, onAccept, onDismiss, accepting }: SuggestionCardProps) {
  const fmtTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${h12}:${m} ${ampm}`;
    } catch { return ''; }
  };

  const typeLabel: Record<string, string> = {
    fill_gap: 'Gap Fill',
    habit_slot: 'Habit',
    task_slot: 'Task',
    balance_fix: 'Balance',
    general: 'Suggestion',
  };

  return (
    <div className={`so-suggestion ${suggestion.type}`}>
      <div className="so-sug-header">
        <span className="so-sug-icon">{suggestion.icon}</span>
        <div className="so-sug-info">
          <span className="so-sug-title">{suggestion.title}</span>
          <span className="so-sug-time">
            {fmtTime(suggestion.startTime)} – {fmtTime(suggestion.endTime)}
          </span>
        </div>
        <span className="so-sug-type">{typeLabel[suggestion.type] || 'Suggestion'}</span>
      </div>
      <p className="so-sug-desc">{suggestion.description}</p>
      <div className="so-sug-actions">
        <button
          className="so-sug-accept"
          onClick={() => onAccept(suggestion)}
          disabled={accepting}
          title="Accept — add to schedule"
        >
          {accepting ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
          <span>Accept</span>
        </button>
        <button
          className="so-sug-dismiss"
          onClick={() => onDismiss(suggestion.id)}
          title="Dismiss"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Balance Bar ──

function BalanceBar({ insight }: { insight: BalanceInsight }) {
  const pct = Math.min(insight.percentMet, 100);
  const isLow = pct < 30;
  const isGood = pct >= 70;

  return (
    <div className="so-balance-item">
      <div className="so-balance-label">
        <span className="so-balance-icon">{insight.icon}</span>
        <span className="so-balance-name">{insight.goalTitle}</span>
        <span className="so-balance-hours">
          {insight.actualHoursWeek}h / {insight.targetHoursWeek}h
        </span>
      </div>
      <div className="so-balance-bar-bg">
        <div
          className={`so-balance-bar-fill ${isLow ? 'low' : isGood ? 'good' : 'mid'}`}
          style={{ width: `${pct}%`, backgroundColor: insight.color }}
        />
      </div>
    </div>
  );
}
