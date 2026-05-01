/**
 * SimulationResults.tsx — Results visualization for the Predictive Life Simulator
 *
 * - Projected outcome charts (area charts with confidence bands)
 * - Before/After comparison cards for each domain
 * - Risk indicators
 * - Key insight callouts
 * - "Add to Goals" button to turn simulation into action
 */

import { useMemo } from 'react';
import type { SimulationResult, ProjectionPoint } from './useSimulator';
import { DOMAIN_COLORS } from './ProjectionCharts';
import { AreaChartWithBands, BeforeAfterLineChart, DomainRadarChart } from './ProjectionCharts';

// ── Helpers ────────────────────────────────────────────────────────

function getDomainData(
  projections: ProjectionPoint[],
  domain: string,
  metric: string,
): { date: string; value: number; bandHigh: number; bandLow: number; baseline: number }[] {
  const filtered = projections
    .filter(p => p.domain === domain && p.metric === metric)
    .sort((a, b) => a.date.localeCompare(b.date));

  return filtered.map(p => ({
    date: p.date,
    value: p.simulated,
    baseline: p.baseline,
    // Confidence bands: wider spread for lower confidence
    bandHigh: Math.max(p.simulated, p.baseline) + Math.abs(p.simulated - p.baseline) * 0.3 + 5,
    bandLow: Math.min(p.simulated, p.baseline) - Math.abs(p.simulated - p.baseline) * 0.15 - 2,
  }));
}

function getDomainScore(projections: ProjectionPoint[], domain: string): { simulated: number; baseline: number } {
  const pts = projections.filter(p => p.domain === domain);
  if (pts.length === 0) return { simulated: 0.5, baseline: 0.5 };

  const lastPt = pts[pts.length - 1];
  // Normalize to 0-1 range based on metric type
  const normalize = (v: number, unit: string) => {
    if (unit === '%') return v / 100;
    if (unit === '$') return Math.min(v / 500, 1);
    if (unit === '/100') return v / 100;
    if (unit === 'days') return Math.min(v / 30, 1);
    return Math.min(v / 100, 1);
  };

  return {
    simulated: normalize(lastPt.simulated, lastPt.unit),
    baseline: normalize(lastPt.baseline, lastPt.unit),
  };
}

const DOMAIN_ICONS: Record<string, string> = {
  health: '❤️',
  finances: '💰',
  habits: '🔥',
  goals: '🎯',
  energy: '⚡',
  mood: '😊',
};

const CONFIDENCE_CONFIG = {
  high: { label: 'High Confidence', color: '#22C55E', icon: '✓', description: 'Based on strong historical patterns' },
  medium: { label: 'Medium Confidence', color: '#FACC15', icon: '⚠', description: 'Moderate data — results may vary ±20%' },
  low: { label: 'Low Confidence', color: '#F43F5E', icon: '?', description: 'Limited data — forecasts are approximate' },
};

interface SimulationResultsProps {
  result: SimulationResult;
  compareResult?: SimulationResult | null;
  onAddToGoals?: (scenario: SimulationResult) => void;
  onExport?: (scenario: SimulationResult) => void;
}

export function SimulationResults({
  result,
  compareResult,
  onAddToGoals,
  onExport,
}: SimulationResultsProps) {
  const { scenario, confidence, projections, insights, risks, xpImpact } = result;

  // Group projections by domain
  const domainGroups = useMemo(() => {
    const groups: Record<string, ProjectionPoint[]> = {};
    for (const p of projections) {
      if (!groups[p.domain]) groups[p.domain] = [];
      groups[p.domain].push(p);
    }
    return groups;
  }, [projections]);

  // Unique metrics per domain
  const domainMetrics = useMemo(() => {
    const metrics: Record<string, string[]> = {};
    for (const p of projections) {
      if (!metrics[p.domain]) metrics[p.domain] = [];
      if (!metrics[p.domain].includes(p.metric)) metrics[p.domain].push(p.metric);
    }
    return metrics;
  }, [projections]);

  // Radar data
  const radarDomains = useMemo(() => {
    const domains = ['health', 'finances', 'habits', 'goals', 'energy', 'mood'];
    return domains.map(d => {
      const scores = getDomainScore(projections, d);
      return { domain: d, score: scores.simulated, baseline: scores.baseline };
    }).filter(d => d.score > 0);
  }, [projections]);

  // Before/after data (all domains combined by date)
  const beforeAfterData = useMemo(() => {
    const dateMap: Record<string, { baseline: number; simulated: number }> = {};
    for (const p of projections) {
      if (!dateMap[p.date]) dateMap[p.date] = { baseline: 0, simulated: 0 };
      // Average all domain deltas for this date
      dateMap[p.date].baseline += p.baseline / projections.length;
      dateMap[p.date].simulated += p.simulated / projections.length;
    }
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));
  }, [projections]);

  // Summary stats
  const summary = useMemo(() => {
    const domains = Object.keys(domainGroups);
    const improvements: { domain: string; delta: number; unit: string; metric: string }[] = [];

    for (const domain of domains) {
      const pts = domainGroups[domain];
      if (!pts || pts.length === 0) continue;
      const last = pts[pts.length - 1];
      const delta = last.simulated - last.baseline;
      improvements.push({ domain, delta, unit: last.unit, metric: last.metric });
    }

    return { improvements, domainCount: domains.length };
  }, [domainGroups]);

  const confConfig = CONFIDENCE_CONFIG[confidence];

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ color: '#E2E8F0' }}>
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(30,58,91,0.5)' }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold" style={{ color: '#00D4FF' }}>
            Simulation Results
          </h2>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: `${confConfig.color}20`, color: confConfig.color }}>
            <span>{confConfig.icon}</span>
            <span>{confConfig.label}</span>
          </div>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: '#E2E8F0' }}>
          {scenario.name}
        </p>
        <p className="text-xs" style={{ color: '#8BA4BE' }}>
          {scenario.description} · {scenario.duration}-day forecast
        </p>
      </div>

      {/* ── Domain Impact Cards ── */}
      <div className="px-4 mt-4">
        <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#8BA4BE' }}>
          Domain Impact
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {summary.improvements.map(imp => {
            const domainInfo = DOMAIN_COLORS[imp.domain];
            if (!domainInfo) return null;
            const isPositive = imp.delta > 0;
            const absDelta = Math.abs(imp.delta);
            return (
              <div
                key={imp.domain}
                className="rounded-xl p-3"
                style={{
                  background: domainInfo.bg,
                  border: `1px solid ${domainInfo.primary}30`,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{DOMAIN_ICONS[imp.domain] || '📊'}</span>
                  <span className="text-xs font-medium" style={{ color: '#8BA4BE' }}>{domainInfo.label}</span>
                </div>
                <div className="text-xl font-bold" style={{ color: domainInfo.primary }}>
                  {isPositive ? '+' : ''}{Math.round(absDelta)}{imp.unit === '%' ? '%' : imp.unit}
                </div>
                <div className="text-xs" style={{ color: isPositive ? '#22C55E' : '#F43F5E' }}>
                  {isPositive ? '↑ improvement' : '↓ change'} from baseline
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Domain Radar Chart ── */}
      <div className="px-4 mt-4">
        <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#8BA4BE' }}>
          Impact Radar
        </h3>
        <div className="flex justify-center">
          <DomainRadarChart
            domains={radarDomains}
            size={240}
          />
        </div>
        <p className="text-xs text-center mt-2" style={{ color: '#5A7A9A' }}>
          Projected impact across life domains
        </p>
      </div>

      {/* ── Before vs After Trajectory ── */}
      <div className="px-4 mt-4">
        <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#8BA4BE' }}>
          Current vs Simulated Trajectory
        </h3>
        {beforeAfterData.length > 1 && (
          <BeforeAfterLineChart
            data={beforeAfterData}
            label="Overall Progress"
            unit=""
            height={160}
          />
        )}
      </div>

      {/* ── Domain-Specific Charts ── */}
      <div className="px-4 mt-4">
        <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#8BA4BE' }}>
          Detailed Domain Forecasts
        </h3>
        <div className="space-y-4">
          {Object.entries(domainMetrics).map(([domain, metrics]) => {
            const domainInfo = DOMAIN_COLORS[domain];
            if (!domainInfo) return null;

            return (
              <div key={domain} className="rounded-xl p-3" style={{ background: 'rgba(30,58,91,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span>{DOMAIN_ICONS[domain] || '📊'}</span>
                  <span className="text-sm font-bold" style={{ color: domainInfo.primary }}>{domainInfo.label}</span>
                </div>
                {metrics.map(metric => {
                  const chartData = getDomainData(projections, domain, metric);
                  if (chartData.length < 2) return null;
                  const metricLabel = metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  return (
                    <div key={metric} className="mb-2">
                      <AreaChartWithBands
                        data={chartData}
                        color={domainInfo.primary}
                        label={metricLabel}
                        unit={projections.find(p => p.domain === domain && p.metric === metric)?.unit || ''}
                        height={140}
                        showConfidenceBand={true}
                        showBaseline={true}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Insights ── */}
      {insights.length > 0 && (
        <div className="px-4 mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#8BA4BE' }}>
            ✨ Key Insights
          </h3>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div
                key={i}
                className="rounded-lg p-3 text-sm"
                style={{
                  background: 'rgba(0,212,255,0.05)',
                  border: '1px solid rgba(0,212,255,0.15)',
                  borderLeft: '3px solid #00D4FF',
                }}
              >
                {insight}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Risks ── */}
      {risks.length > 0 && (
        <div className="px-4 mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#F43F5E' }}>
            ⚠ Risk Factors
          </h3>
          <div className="space-y-2">
            {risks.map((risk, i) => (
              <div
                key={i}
                className="rounded-lg p-3 text-sm"
                style={{
                  background: 'rgba(243,63,94,0.05)',
                  border: '1px solid rgba(243,63,94,0.15)',
                  borderLeft: '3px solid #F43F5E',
                }}
              >
                {risk}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── XP Impact ── */}
      <div className="px-4 mt-4">
        <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}>
          <div>
            <div className="text-xs font-medium" style={{ color: '#D4AF37' }}>
              Projected XP Impact
            </div>
            <div className="text-xs" style={{ color: '#8BA4BE' }}>
              Based on projected domain improvements
            </div>
          </div>
          <div className="text-2xl font-bold" style={{ color: '#D4AF37' }}>
            +{xpImpact} XP
          </div>
        </div>
      </div>

      {/* ── Confidence Explanation ── */}
      <div className="px-4 mt-4">
        <div className="rounded-xl p-3" style={{ background: 'rgba(30,58,91,0.3)', border: '1px solid rgba(30,58,91,0.5)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ color: confConfig.color }}>{confConfig.icon}</span>
            <span className="text-sm font-bold" style={{ color: confConfig.color }}>{confConfig.label}</span>
          </div>
          <p className="text-xs" style={{ color: '#8BA4BE' }}>
            {confConfig.description}
          </p>
          <p className="text-xs mt-1" style={{ color: '#5A7A9A' }}>
            Projections are based on your last 30-90 days of behavioral data. Results show likely trends, not guarantees.
          </p>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="px-4 mt-4 pb-6 space-y-2">
        {onAddToGoals && (
          <button
            onClick={() => onAddToGoals(result)}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #22C55E, #16A34A)',
              color: '#fff',
              boxShadow: '0 0 20px rgba(34,197,94,0.2)',
            }}
          >
            🎯 Add to Goals — Turn This Into Action
          </button>
        )}
        {onExport && (
          <button
            onClick={() => onExport(result)}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.01]"
            style={{
              background: 'rgba(30,58,91,0.6)',
              border: '1px solid rgba(30,58,91,0.8)',
              color: '#8BA4BE',
            }}
          >
            📋 Export Simulation Results
          </button>
        )}
      </div>
    </div>
  );
}