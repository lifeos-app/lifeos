/**
 * InterventionPanel.tsx — Smart coaching panel for the Digital Twin
 *
 * Active interventions recommended right now, color-coded by category,
 * "Try this" actionable suggestions, and feedback loop.
 */

import { useState } from 'react';
import type { Intervention } from './useDigitalTwin';

// ── Category config ───────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<Intervention['category'], { label: string; color: string; icon: string; bg: string }> = {
  prevention:   { label: 'Prevention',    color: '#EF4444', icon: '🛡️', bg: 'rgba(239,68,68,0.1)' },
  encouragement: { label: 'Encouragement', color: '#10B981', icon: '💚', bg: 'rgba(16,185,129,0.1)' },
  redirection:   { label: 'Redirection',   color: '#FACC15', icon: '🔄', bg: 'rgba(250,204,21,0.1)' },
  celebration:   { label: 'Celebration',   color: '#C084FC', icon: '🏆', bg: 'rgba(192,132,252,0.1)' },
};

// ── Intervention Card ──────────────────────────────────────────────────

function InterventionCard({
  intervention,
  onFeedback,
}: {
  intervention: Intervention;
  onFeedback: (id: string, helped: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_CONFIG[intervention.category];
  const hasFeedback = intervention.feedback !== undefined && intervention.feedback !== null;
  const successPct = Math.round(intervention.successRate);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: cat.bg,
        border: `1px solid ${cat.color}30`,
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-4 py-2"
        style={{ background: `${cat.color}15` }}
      >
        <span className="text-sm">{cat.icon}</span>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color: cat.color, background: cat.bg }}>
          {cat.label}
        </span>
        <span className="text-[10px] ml-auto" style={{ color: '#64748B' }}>
          {successPct}% success rate
        </span>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {/* Trigger */}
        <p className="text-xs font-medium mb-1" style={{ color: cat.color }}>
          {intervention.trigger}
        </p>

        {/* Action — the key suggestion */}
        <div
          className="my-2 p-3 rounded-lg"
          style={{
            background: 'rgba(7,13,26,0.6)',
            borderLeft: `3px solid ${cat.color}`,
          }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: '#E2E8F0' }}>
            Try this:
          </p>
          <p className="text-sm" style={{ color: '#C8D6E5' }}>
            {intervention.action}
          </p>
        </div>

        {/* Expand for evidence */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs mb-2 transition-colors"
          style={{ color: '#8BA4BE' }}
        >
          {expanded ? '▾ Hide evidence' : '▸ Show evidence'}
        </button>

        {expanded && (
          <div className="mb-2 p-2 rounded-lg" style={{ background: 'rgba(15,23,42,0.5)' }}>
            <p className="text-xs" style={{ color: '#8BA4BE' }}>
              {intervention.evidence}
            </p>
          </div>
        )}

        {/* Success rate bar */}
        <div className="flex items-center gap-2 mt-1 mb-2">
          <span className="text-[10px]" style={{ color: '#64748B' }}>Effectiveness</span>
          <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(30,58,91,0.4)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${successPct}%`,
                background: `linear-gradient(90deg, ${cat.color}88, ${cat.color})`,
              }}
            />
          </div>
        </div>

        {/* Feedback */}
        <div className="pt-2" style={{ borderTop: '1px solid rgba(30,58,91,0.3)' }}>
          {hasFeedback ? (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#64748B' }}>
                {intervention.feedback === 'helped' ? '✓ Marked as helpful' : '— Marked as not helpful'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#8BA4BE' }}>Did this help?</span>
              <button
                onClick={() => onFeedback(intervention.id, true)}
                className="text-xs px-3 py-1 rounded-full transition-colors"
                style={{
                  background: 'rgba(16,185,129,0.15)',
                  color: '#10B981',
                  border: '1px solid rgba(16,185,129,0.3)',
                }}
              >
                👍 Yes
              </button>
              <button
                onClick={() => onFeedback(intervention.id, false)}
                className="text-xs px-3 py-1 rounded-full transition-colors"
                style={{
                  background: 'rgba(100,116,139,0.15)',
                  color: '#64748B',
                  border: '1px solid rgba(100,116,139,0.3)',
                }}
              >
                👎 Not really
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export function InterventionPanel({
  interventions,
  onFeedback,
}: {
  interventions: Intervention[];
  onFeedback: (id: string, helped: boolean) => void;
}) {
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const filtered = filterCategory === 'all'
    ? interventions
    : interventions.filter(i => i.category === filterCategory);

  // Group by category
  const grouped = filtered.reduce<Record<string, Intervention[]>>((acc, i) => {
    if (!acc[i.category]) acc[i.category] = [];
    acc[i.category].push(i);
    return acc;
  }, {});

  if (interventions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-3 opacity-50">🧭</div>
        <h3 className="text-sm font-medium mb-1" style={{ color: '#8BA4BE' }}>
          No active interventions
        </h3>
        <p className="text-xs" style={{ color: '#64748B' }}>
          Your Twin is learning your patterns. Interventions will appear as behavioral risks are detected.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Category filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setFilterCategory('all')}
          className="text-xs px-2 py-1 rounded transition-colors"
          style={{
            background: filterCategory === 'all' ? 'rgba(0,212,255,0.15)' : 'transparent',
            color: filterCategory === 'all' ? '#00D4FF' : '#8BA4BE',
            border: `1px solid ${filterCategory === 'all' ? 'rgba(0,212,255,0.3)' : 'rgba(30,58,91,0.4)'}`,
          }}
        >
          All
        </button>
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilterCategory(key)}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{
              background: filterCategory === key ? cfg.color + '20' : 'transparent',
              color: filterCategory === key ? cfg.color : '#8BA4BE',
              border: `1px solid ${filterCategory === key ? cfg.color + '40' : 'rgba(30,58,91,0.4)'}`,
            }}
          >
            {cfg.icon} {cfg.label}
          </button>
        ))}
      </div>

      {/* Grouped cards */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="flex flex-col gap-3">
          {items.map(intervention => (
            <InterventionCard
              key={intervention.id}
              intervention={intervention}
              onFeedback={onFeedback}
            />
          ))}
        </div>
      ))}
    </div>
  );
}