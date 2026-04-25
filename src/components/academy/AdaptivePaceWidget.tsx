/**
 * AdaptivePaceWidget — Dismissible pacing recommendation banner
 *
 * Shows completion rate stats and pacing recommendation.
 * Green (increase), amber (decrease), blue (maintain).
 */

import React from 'react';
import { TrendingUp, TrendingDown, CheckCircle, X } from 'lucide-react';
import type { PacingEvaluation } from '../../lib/adaptive-pacing';

interface AdaptivePaceWidgetProps {
  evaluation: PacingEvaluation;
  onAccept: () => void;
  onDismiss: () => void;
}

const CONFIG: Record<PacingEvaluation['recommendation'], {
  color: string; borderColor: string; bgColor: string;
  Icon: typeof TrendingUp;
}> = {
  increase: {
    color: '#4ECB71', borderColor: 'rgba(78,203,113,0.3)',
    bgColor: 'rgba(78,203,113,0.06)', Icon: TrendingUp,
  },
  decrease: {
    color: '#F97316', borderColor: 'rgba(249,115,22,0.3)',
    bgColor: 'rgba(249,115,22,0.06)', Icon: TrendingDown,
  },
  maintain: {
    color: '#00D4FF', borderColor: 'rgba(0,212,255,0.3)',
    bgColor: 'rgba(0,212,255,0.06)', Icon: CheckCircle,
  },
};

export function AdaptivePaceWidget({ evaluation, onAccept, onDismiss }: AdaptivePaceWidgetProps) {
  const cfg = CONFIG[evaluation.recommendation];
  const Icon = cfg.Icon;
  const ratePercent = Math.round(evaluation.completionRate * 100);

  return (
    <div style={{
      position: 'relative',
      padding: '14px 16px',
      borderRadius: 12,
      background: cfg.bgColor,
      border: `1px solid ${cfg.borderColor}`,
      marginBottom: 12,
    }}>
      {/* Dismiss */}
      <button
        onClick={onDismiss}
        aria-label="Dismiss pacing suggestion"
        style={{
          position: 'absolute', top: 8, right: 8,
          background: 'transparent', border: 'none',
          color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
          padding: 4, display: 'flex',
        }}
      >
        <X size={16} />
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Icon size={20} color={cfg.color} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>
            {evaluation.message}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '0 0 10px' }}>
            This week: {evaluation.completed}/{evaluation.scheduled} lessons ({ratePercent}%)
            {evaluation.recommendation !== 'maintain' && (
              <> &middot; Suggested: {evaluation.newWeeklyTarget}/week</>
            )}
          </p>
          <button
            onClick={onAccept}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: cfg.color, color: '#0A1628', fontSize: 12,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            {evaluation.recommendation === 'increase' ? 'Increase pace' :
              evaluation.recommendation === 'decrease' ? 'Ease up' : 'Sounds good'}
          </button>
        </div>
      </div>
    </div>
  );
}
