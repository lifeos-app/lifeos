/**
 * PatternDiscovery.tsx — Behavioral pattern explorer for the Digital Twin
 *
 * List of discovered patterns with confidence scores,
 * expandable pattern cards, "I never noticed that" reactions,
 * and timeline visualization of when patterns activate.
 */

import { useState } from 'react';
import type { BehavioralPattern } from './useDigitalTwin';

// ── Frequency config ───────────────────────────────────────────────────

const FREQ_CONFIG: Record<string, { label: string; color: string }> = {
  daily:   { label: 'Daily',   color: '#06B6D4' },
  weekly:  { label: 'Weekly',  color: '#8B5CF6' },
  monthly: { label: 'Monthly', color: '#F97316' },
};

// ── Pattern timeline ──────────────────────────────────────────────────

function PatternTimeline({ pattern }: { pattern: BehavioralPattern }) {
  // Generate a mock weekly timeline showing pattern activation
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const activation = days.map(() => {
    const strength = pattern.confidence * (0.5 + Math.random() * 0.5);
    return Math.min(1, strength);
  });

  // Find peak day
  const peakIdx = activation.indexOf(Math.max(...activation));

  return (
    <div className="flex items-end gap-1 h-12 mt-2">
      {days.map((day, i) => {
        const h = Math.round(activation[i] * 100);
        const isPeak = i === peakIdx;
        return (
          <div key={day} className="flex flex-col items-center gap-1 flex-1">
            <div
              className="w-full rounded-sm transition-all duration-300"
              style={{
                height: `${Math.max(4, h)}%`,
                background: isPeak
                  ? 'linear-gradient(to top, #00D4FF, #8B5CF6)'
                  : `rgba(30, 58, 91, ${0.3 + activation[i] * 0.4})`,
                minHeight: '4px',
              }}
            />
            <span className="text-[8px]" style={{ color: isPeak ? '#00D4FF' : '#64748B' }}>
              {day}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Pattern Card ──────────────────────────────────────────────────────

function PatternCard({
  pattern,
  onReaction,
}: {
  pattern: BehavioralPattern;
  onReaction: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [reacted, setReacted] = useState(false);
  const freq = FREQ_CONFIG[pattern.frequency] || FREQ_CONFIG.weekly;
  const confPct = Math.round(pattern.confidence * 100);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: 'rgba(7,13,26,0.8)',
        border: `1px solid ${freq.color}25`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
          style={{ background: freq.color + '15' }}
        >
          {pattern.frequency === 'daily' ? '🔄' : pattern.frequency === 'weekly' ? '📅' : '📊'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold truncate" style={{ color: '#E2E8F0' }}>
              {pattern.name}
            </h4>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: freq.color + '20', color: freq.color }}
            >
              {freq.label}
            </span>
          </div>
          <p className="text-xs truncate" style={{ color: '#8BA4BE' }}>
            {pattern.description}
          </p>
        </div>

        {/* Confidence */}
        <div className="flex flex-col items-end">
          <span className="text-sm font-bold" style={{ color: confPct >= 70 ? '#10B981' : confPct >= 40 ? '#FACC15' : '#EF4444' }}>
            {confPct}%
          </span>
          <span className="text-[9px]" style={{ color: '#64748B' }}>confidence</span>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="px-4">
        <div className="h-1 rounded-full" style={{ background: 'rgba(30,58,91,0.4)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${confPct}%`,
              background: confPct >= 70
                ? 'linear-gradient(90deg, #10B981, #39FF14)'
                : confPct >= 40
                  ? 'linear-gradient(90deg, #FACC15, #F97316)'
                  : 'linear-gradient(90deg, #EF4444, #F97316)',
            }}
          />
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-2 text-xs transition-colors"
        style={{ color: '#8BA4BE' }}
      >
        {expanded ? '▾ Hide details' : '▸ Show details & timeline'}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Triggers */}
          {pattern.triggers.length > 0 && (
            <div>
              <h5 className="text-xs font-medium mb-1" style={{ color: '#00D4FF' }}>Triggers</h5>
              <div className="flex flex-wrap gap-1.5">
                {pattern.triggers.map((trigger, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.2)' }}
                  >
                    {trigger}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Outcomes */}
          {pattern.outcomes.length > 0 && (
            <div>
              <h5 className="text-xs font-medium mb-1" style={{ color: '#C084FC' }}>Likely Outcomes</h5>
              <div className="flex flex-wrap gap-1.5">
                {pattern.outcomes.map((outcome, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(192,132,252,0.1)', color: '#C084FC', border: '1px solid rgba(192,132,252,0.2)' }}
                  >
                    {outcome}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <h5 className="text-xs font-medium mb-1" style={{ color: '#8BA4BE' }}>Weekly Pattern</h5>
            <PatternTimeline pattern={pattern} />
          </div>

          {/* Reaction */}
          {!reacted ? (
            <button
              onClick={() => { setReacted(true); onReaction(pattern.id); }}
              className="w-full text-center py-2 rounded-lg text-xs transition-colors"
              style={{
                background: 'rgba(139,92,246,0.1)',
                color: '#C084FC',
                border: '1px solid rgba(139,92,246,0.2)',
              }}
            >
              💡 I never noticed that
            </button>
          ) : (
            <div className="text-center py-2 text-xs" style={{ color: '#C084FC' }}>
              ✨ Noted! Your Twin will use this insight.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export function PatternDiscovery({
  patterns,
  onReaction,
}: {
  patterns: BehavioralPattern[];
  onReaction: (patternId: string) => void;
}) {
  const [filterFreq, setFilterFreq] = useState<string>('all');
  const [sortByConf, setSortByConf] = useState(true);

  const sorted = [...patterns]
    .filter(p => filterFreq === 'all' || p.frequency === filterFreq)
    .sort((a, b) => sortByConf ? b.confidence - a.confidence : a.name.localeCompare(b.name));

  if (patterns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-3 opacity-50">🔍</div>
        <h3 className="text-sm font-medium mb-1" style={{ color: '#8BA4BE' }}>
          No patterns discovered yet
        </h3>
        <p className="text-xs" style={{ color: '#64748B' }}>
          Your Twin is analyzing your behavioral data. Patterns will emerge as you log more activities.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterFreq('all')}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{
              background: filterFreq === 'all' ? 'rgba(0,212,255,0.15)' : 'transparent',
              color: filterFreq === 'all' ? '#00D4FF' : '#8BA4BE',
              border: `1px solid ${filterFreq === 'all' ? 'rgba(0,212,255,0.3)' : 'rgba(30,58,91,0.4)'}`,
            }}
          >
            All
          </button>
          {Object.entries(FREQ_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setFilterFreq(key)}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{
                background: filterFreq === key ? cfg.color + '20' : 'transparent',
                color: filterFreq === key ? cfg.color : '#8BA4BE',
                border: `1px solid ${filterFreq === key ? cfg.color + '40' : 'rgba(30,58,91,0.4)'}`,
              }}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSortByConf(!sortByConf)}
          className="text-xs px-2 py-1 rounded transition-colors"
          style={{
            background: 'rgba(30,58,91,0.4)',
            color: '#8BA4BE',
            border: '1px solid rgba(30,58,91,0.4)',
          }}
        >
          {sortByConf ? '↓ Confidence' : '↑ Name'}
        </button>
      </div>

      {/* Pattern count */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: '#64748B' }}>
          {sorted.length} pattern{sorted.length !== 1 ? 's' : ''} discovered
        </span>
      </div>

      {/* Pattern cards */}
      <div className="flex flex-col gap-3">
        {sorted.map(pattern => (
          <PatternCard
            key={pattern.id}
            pattern={pattern}
            onReaction={onReaction}
          />
        ))}
      </div>
    </div>
  );
}