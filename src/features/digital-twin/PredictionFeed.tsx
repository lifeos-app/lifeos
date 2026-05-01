/**
 * PredictionFeed.tsx — Real-time prediction feed for the Digital Twin
 *
 * Cards showing upcoming predictions with probability bars,
 * "Did this happen?" feedback mechanism, domain filters, and sorting.
 */

import { useState, useMemo } from 'react';
import type { Prediction } from './useDigitalTwin';

// ── Domain config ─────────────────────────────────────────────────────

const DOMAIN_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  habit:   { label: 'Habit',    color: '#F97316', icon: '🔥' },
  health:  { label: 'Health',   color: '#F43F5E', icon: '❤️' },
  finance: { label: 'Finance',  color: '#FACC15', icon: '💰' },
  goal:    { label: 'Goal',     color: '#39FF14', icon: '🎯' },
  social:  { label: 'Social',   color: '#06B6D4', icon: '🤝' },
};

type SortMode = 'probability' | 'timeframe' | 'domain';

// ── Probability bar ────────────────────────────────────────────────────

function ProbabilityBar({ probability, color }: { probability: number; color: string }) {
  const pct = Math.round(probability * 100);
  const isHigh = pct >= 70;
  const isMedium = pct >= 40 && pct < 70;

  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(30,58,91,0.4)' }}>
      <div
        className="h-full rounded-full transition-all duration-1000"
        style={{
          width: `${pct}%`,
          background: isHigh
            ? 'linear-gradient(90deg, #EF4444, #F97316)'
            : isMedium
              ? 'linear-gradient(90deg, #FACC15, #F97316)'
              : `linear-gradient(90deg, ${color}88, ${color})`,
        }}
      />
    </div>
  );
}

// ── Prediction card ────────────────────────────────────────────────────

function PredictionCard({
  prediction,
  onFeedback,
}: {
  prediction: Prediction;
  onFeedback: (id: string, confirmed: boolean) => void;
}) {
  const domain = DOMAIN_CONFIG[prediction.domain] || DOMAIN_CONFIG.habit;
  const pct = Math.round(prediction.probability * 100);
  const hasFeedback = prediction.feedback !== undefined && prediction.feedback !== null;

  return (
    <div
      className="rounded-xl p-4 transition-all duration-200"
      style={{
        background: 'rgba(7,13,26,0.8)',
        border: `1px solid ${domain.color}25`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{domain.icon}</span>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: domain.color + '20', color: domain.color }}
          >
            {domain.label}
          </span>
          <span className="text-[10px]" style={{ color: '#64748B' }}>
            {prediction.timeframe}
          </span>
        </div>
        <span
          className="text-lg font-bold"
          style={{ color: pct >= 70 ? '#EF4444' : pct >= 40 ? '#FACC15' : '#10B981' }}
        >
          {pct}%
        </span>
      </div>

      {/* Event */}
      <p className="text-sm font-medium mb-2" style={{ color: '#E2E8F0' }}>
        {prediction.event}
      </p>

      {/* Probability bar */}
      <ProbabilityBar probability={prediction.probability} color={domain.color} />

      {/* Reasoning */}
      <p className="text-xs mt-2" style={{ color: '#8BA4BE' }}>
        {prediction.reasoning}
      </p>

      {/* Feedback */}
      <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(30,58,91,0.4)' }}>
        {hasFeedback ? (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '#64748B' }}>
              {prediction.feedback === 'confirmed' ? '✓ Confirmed' : '✗ Denied'}
            </span>
            <span className="text-[10px]" style={{ color: '#64748B' }}>
              — helps improve future predictions
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '#8BA4BE' }}>Did this happen?</span>
            <button
              onClick={() => onFeedback(prediction.id, true)}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{
                background: 'rgba(16,185,129,0.15)',
                color: '#10B981',
                border: '1px solid rgba(16,185,129,0.3)',
              }}
            >
              Yes
            </button>
            <button
              onClick={() => onFeedback(prediction.id, false)}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{
                background: 'rgba(239,68,68,0.15)',
                color: '#EF4444',
                border: '1px solid rgba(239,68,68,0.3)',
              }}
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export function PredictionFeed({
  predictions,
  onFeedback,
}: {
  predictions: Prediction[];
  onFeedback: (id: string, confirmed: boolean) => void;
}) {
  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortMode>('probability');

  const filtered = useMemo(() => {
    let items = [...predictions];
    if (filterDomain !== 'all') {
      items = items.filter(p => p.domain === filterDomain);
    }
    items.sort((a, b) => {
      if (sortBy === 'probability') return b.probability - a.probability;
      if (sortBy === 'domain') return a.domain.localeCompare(b.domain);
      // timeframe — approximate sort
      return a.timeframe.localeCompare(b.timeframe);
    });
    return items;
  }, [predictions, filterDomain, sortBy]);

  if (predictions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-3 opacity-50">🔮</div>
        <h3 className="text-sm font-medium mb-1" style={{ color: '#8BA4BE' }}>
          Building predictions...
        </h3>
        <p className="text-xs" style={{ color: '#64748B' }}>
          Your Twin needs more data to start predicting. Keep logging your habits and activities.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filter bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterDomain('all')}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{
              background: filterDomain === 'all' ? 'rgba(0,212,255,0.15)' : 'transparent',
              color: filterDomain === 'all' ? '#00D4FF' : '#8BA4BE',
              border: `1px solid ${filterDomain === 'all' ? 'rgba(0,212,255,0.3)' : 'rgba(30,58,91,0.4)'}`,
            }}
          >
            All
          </button>
          {Object.entries(DOMAIN_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setFilterDomain(key)}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{
                background: filterDomain === key ? cfg.color + '20' : 'transparent',
                color: filterDomain === key ? cfg.color : '#8BA4BE',
                border: `1px solid ${filterDomain === key ? cfg.color + '40' : 'rgba(30,58,91,0.4)'}`,
              }}
            >
              {cfg.icon} {cfg.label}
            </button>
          ))}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortMode)}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: 'rgba(15,23,42,0.8)',
            color: '#8BA4BE',
            border: '1px solid rgba(30,58,91,0.6)',
          }}
        >
          <option value="probability">By Probability</option>
          <option value="timeframe">By Timeframe</option>
          <option value="domain">By Domain</option>
        </select>
      </div>

      {/* Prediction cards */}
      <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {filtered.map(prediction => (
          <PredictionCard
            key={prediction.id}
            prediction={prediction}
            onFeedback={onFeedback}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(30,58,91,0.4)' }}>
        <span className="text-xs" style={{ color: '#64748B' }}>
          {filtered.length} prediction{filtered.length !== 1 ? 's' : ''}
        </span>
        <span className="text-xs" style={{ color: '#64748B' }}>
          Avg confidence: {filtered.length > 0 ? Math.round(filtered.reduce((s, p) => s + p.probability, 0) / filtered.length * 100) : 0}%
        </span>
      </div>
    </div>
  );
}