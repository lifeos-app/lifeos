import { useState } from 'react';
import { useUserStore } from '../../stores/useUserStore';
import { useAgentStore } from '../../stores/useAgentStore';
import { agentInsight, type AgentInsight, type AgentAction } from '../../lib/zeroclaw-client';
import './AgentInsightCard.css';
import { logger } from '../../utils/logger';

interface AgentInsightCardProps {
  type: 'goal_analysis' | 'schedule_optimize' | 'habit_check' | 'bottleneck_scan' | 'daily_brief' | 'weekly_review';
  goalId?: string;
  className?: string;
}

const INSIGHT_ICONS: Record<string, string> = {
  goal_analysis: '🎯',
  schedule_optimize: '📅',
  habit_check: '✅',
  bottleneck_scan: '🔍',
  daily_brief: '☀️',
  weekly_review: '📊',
};

const INSIGHT_LABELS: Record<string, string> = {
  goal_analysis: 'Goal Analysis',
  schedule_optimize: 'Schedule Optimization',
  habit_check: 'Habit Check',
  bottleneck_scan: 'Bottleneck Scan',
  daily_brief: 'Daily Brief',
  weekly_review: 'Weekly Review',
};

export function AgentInsightCard({ type, goalId, className = '' }: AgentInsightCardProps) {
  const { user } = useUserStore();
  const { executeAction } = useAgentStore();
  const [insight, setInsight] = useState<AgentInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInsight = async () => {
    if (!user || loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await agentInsight({ userId: user.id, type });
      setInsight(result);
      setExpanded(true);
    } catch (err) {
      setError('Failed to load insight. Try again.');
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = async (action: AgentAction) => {
    if (!user) return;
    
    if (action.requiresConfirm && !confirm(`${action.label}?`)) return;
    
    const success = await executeAction(user.id, action);
    if (!success) {
      alert('Action failed. Please try again.');
    }
  };

  return (
    <div className={`agent-insight-card ${className}`}>
      {!insight ? (
        <button
          className="agent-insight-trigger"
          onClick={loadInsight}
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="agent-insight-shimmer" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <span className="agent-insight-icon">{INSIGHT_ICONS[type]}</span>
              <span>{INSIGHT_LABELS[type]}</span>
            </>
          )}
        </button>
      ) : (
        <div className="agent-insight-content">
          <div className="agent-insight-header">
            <span className="agent-insight-icon">{INSIGHT_ICONS[type]}</span>
            <h3 className="agent-insight-title">{insight.title}</h3>
            <span className={`agent-insight-priority ${insight.priority}`}>
              {insight.priority}
            </span>
          </div>
          
          <p className="agent-insight-summary">{insight.summary}</p>
          
          {insight.details && (
            <details className="agent-insight-details" open={expanded}>
              <summary onClick={(e) => { e.preventDefault(); setExpanded(!expanded); }}>
                {expanded ? 'Hide details' : 'Show details'}
              </summary>
              <div className="agent-insight-details-content">
                {insight.details}
              </div>
            </details>
          )}
          
          {insight.actions && insight.actions.length > 0 && (
            <div className="agent-insight-actions">
              {insight.actions.map((action, i) => (
                <button
                  key={i}
                  className="agent-insight-action-btn"
                  onClick={() => handleActionClick(action)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
          
          <button
            className="agent-insight-close"
            onClick={() => setInsight(null)}
          >
            Close
          </button>
        </div>
      )}
      
      {error && (
        <div className="agent-insight-error">
          {error}
        </div>
      )}
    </div>
  );
}
