/**
 * SleepProductivityInsights — P7-021
 *
 * Dashboard widget showing longitudinal sleep-productivity correlation.
 * Dark theme, Lucide icons, CSS-only bar chart, no chart library.
 */

import React, { useEffect, useState } from 'react';
import { Moon, Sun, TrendingUp, AlertTriangle, Target } from 'lucide-react';
import { analyzeSleepProductivity, type SleepProductivityReport } from '../../lib/sleep-productivity-correlation';
import { FeatureErrorBoundary } from '../FeatureErrorBoundary';

// ── Styles (CSS-in-JS for dark theme consistency) ──

const containerStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 16,
};

const headingStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.9)',
  margin: '0 0 8px 0',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 10,
  padding: 12,
  marginBottom: 8,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(255,255,255,0.5)',
  marginBottom: 4,
};

const valueStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  lineHeight: 1.2,
};

const recStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'rgba(255,255,255,0.7)',
  lineHeight: 1.5,
  paddingLeft: 14,
  position: 'relative',
  marginBottom: 4,
};

const recBulletStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  color: 'rgba(255,255,255,0.3)',
};

const insufficientStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px 16px',
  textAlign: 'center',
  gap: 12,
};

const insufficientIconStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.2)',
};

const insufficientTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'rgba(255,255,255,0.5)',
  maxWidth: 280,
};

// ── Component ──

export function SleepProductivityInsights() {
  const [report, setReport] = useState<SleepProductivityReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await analyzeSleepProductivity(60);
        if (!cancelled) {
          setReport(result);
        }
      } catch (err) {
        console.error('[SleepProductivity] Analysis failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={containerStyle}>
        <h3 style={headingStyle}>
          <Moon size={16} />
          Sleep-Productivity Insights
        </h3>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
          Analyzing sleep and productivity data...
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={containerStyle}>
        <h3 style={headingStyle}>
          <Moon size={16} />
          Sleep-Productivity Insights
        </h3>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
          Unable to analyze data.
        </div>
      </div>
    );
  }

  if (report.insufficientData) {
    return (
      <div style={containerStyle}>
        <h3 style={headingStyle}>
          <Moon size={16} />
          Sleep-Productivity Insights
        </h3>
        <div style={insufficientStyle}>
          <AlertTriangle size={36} style={insufficientIconStyle} />
          <div style={insufficientTextStyle}>
            Need at least 7 days of sleep tracking data to analyze patterns.
            Keep logging your sleep to unlock insights.
          </div>
          <div style={{ ...labelStyle, fontSize: 12 }}>
            {report.dataPoints} day{report.dataPoints !== 1 ? 's' : ''} tracked so far
          </div>
        </div>
      </div>
    );
  }

  return (
    <FeatureErrorBoundary feature="Sleep-Productivity Insights" compact>
      <div style={containerStyle}>
        <h3 style={headingStyle}>
          <Moon size={16} />
          Sleep-Productivity Insights
        </h3>

        {/* ── Overview Card: Overall Correlation ── */}
        <CorrelationOverview correlation={report.overallCorrelation} dataPoints={report.dataPoints} />

        {/* ── Optimal Sleep Range ── */}
        {report.sleepOptimalRange && (
          <OptimalSleepRange min={report.sleepOptimalRange.min} max={report.sleepOptimalRange.max} />
        )}

        {/* ── Bar Chart: Productivity by Sleep Bucket ── */}
        <SleepBucketChart buckets={report.productivityBySleepBucket} />

        {/* ── Lag Effect Card ── */}
        <LagEffectCard report={report} />

        {/* ── Recovery Pattern ── */}
        <RecoveryCard
          productivityDrop={report.recoveryPatterns.productivityDrop}
          recoveryDays={report.recoveryPatterns.recoveryDays}
        />

        {/* ── Consistency Bonus Meter ── */}
        <ConsistencyMeter bonus={report.consistencyBonus} />

        {/* ── Recommendations ── */}
        {report.recommendations.length > 0 && (
          <div style={sectionStyle}>
            <div style={{ ...headingStyle, fontSize: 13 }}>
              <Target size={14} />
              Recommendations
            </div>
            {report.recommendations.map((rec, i) => (
              <div key={i} style={recStyle}>
                <span style={recBulletStyle}>&bull;</span>
                {rec}
              </div>
            ))}
          </div>
        )}

        <div style={{ ...labelStyle, fontSize: 10, marginTop: 8, textAlign: 'right' }}>
          Based on {report.dataPoints} data points over {report.daysAnalyzed} days
        </div>
      </div>
    </FeatureErrorBoundary>
  );
}

// ── Sub-Components ──

function CorrelationOverview({ correlation, dataPoints }: { correlation: number; dataPoints: number }) {
  const r = Math.abs(correlation);
  let color: string;
  let label: string;
  if (r > 0.5) {
    color = '#22C55E'; // green
    label = 'Strong';
  } else if (r > 0.2) {
    color = '#EAB308'; // yellow
    label = 'Moderate';
  } else {
    color = '#EF4444'; // red
    label = 'Weak';
  }

  const direction = correlation >= 0 ? 'positive' : 'negative';

  return (
    <div style={cardStyle}>
      <div style={labelStyle}>Sleep-Productivity Correlation</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ ...valueStyle, color }}>{correlation >= 0 ? '+' : ''}{correlation.toFixed(2)}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          {label} {direction}
        </span>
      </div>
      <TrendingUp size={14} style={{ position: 'relative', top: 2, color }} />
      <div style={{ ...labelStyle, marginTop: 4 }}>
        Based on {dataPoints} paired data points
      </div>
    </div>
  );
}

function OptimalSleepRange({ min, max }: { min: number; max: number }) {
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>Optimal Sleep Range</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Sun size={16} style={{ color: '#F59E0B' }} />
        <span style={{ ...valueStyle, color: '#F59E0B' }}>
          {min}-{max}h
        </span>
      </div>
      <div style={{ ...labelStyle, marginTop: 4, fontSize: 13 }}>
        Your peak productivity is at {min}-{max} hours of sleep
      </div>
    </div>
  );
}

function SleepBucketChart({ buckets }: { buckets: SleepProductivityReport['productivityBySleepBucket'] }) {
  const populated = buckets.filter(b => b.count > 0);
  if (populated.length === 0) return null;

  const maxProd = Math.max(...populated.map(b => b.avgProductivity), 0.01);

  const barColors = [
    'rgba(239,68,68,0.7)',   // <5h  - red
    'rgba(249,115,22,0.7)',  // 5-6h - orange
    'rgba(234,179,8,0.7)',   // 6-7h - yellow
    'rgba(34,197,94,0.7)',   // 7-8h - green
    'rgba(59,130,246,0.7)',  // 8-9h - blue
    'rgba(139,92,246,0.7)',  // 9+h  - purple
  ];

  return (
    <div style={sectionStyle}>
      <div style={headingStyle}>
        <TrendingUp size={14} />
        Productivity by Sleep Duration
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {buckets.map((b, i) => {
          const pct = b.count > 0 ? (b.avgProductivity / maxProd) * 100 : 0;
          return (
            <div key={b.range} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 11,
                color: b.count > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)',
                width: 32,
                textAlign: 'right',
                flexShrink: 0,
              }}>
                {b.range}
              </span>
              <div style={{
                flex: 1,
                height: 18,
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 4,
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.max(pct, b.count > 0 ? 2 : 0)}%`,
                  background: barColors[i] || 'rgba(255,255,255,0.2)',
                  borderRadius: 4,
                  transition: 'width 0.5s ease',
                }} />
                {b.count > 0 && (
                  <span style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.6)',
                  }}>
                    {(b.avgProductivity * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 10,
                color: b.count > 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)',
                width: 18,
                textAlign: 'left',
                flexShrink: 0,
              }}>
                {b.count > 0 ? `n${b.count}` : '-'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LagEffectCard({ report }: { report: SleepProductivityReport }) {
  // Derive a simple lag message using recovery patterns
  const { productivityDrop, recoveryDays } = report.recoveryPatterns;
  const impactPct = Math.round(productivityDrop * 100);

  return (
    <div style={cardStyle}>
      <div style={labelStyle}>Yesterday's Sleep Impact</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <AlertTriangle size={16} style={{ color: impactPct > 20 ? '#EF4444' : '#EAB308' }} />
        <span style={{
          ...valueStyle,
          color: impactPct > 20 ? '#EF4444' : '#EAB308',
          fontSize: 16,
        }}>
          {impactPct}% drop
        </span>
      </div>
      <div style={{ ...labelStyle, marginTop: 4, fontSize: 13 }}>
        Yesterday's sleep affects today's productivity by {impactPct}%
      </div>
    </div>
  );
}

function RecoveryCard({ productivityDrop, recoveryDays }: { productivityDrop: number; recoveryDays: number }) {
  const dropPct = Math.round(productivityDrop * 100);
  const days = Math.round(recoveryDays * 10) / 10;
  const dayLabel = days === 1 ? '1 day' : `${days} days`;

  return (
    <div style={cardStyle}>
      <div style={labelStyle}>Recovery Pattern</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
        After a poor night's sleep, it takes you <span style={{ color: '#8B5CF6' }}>{dayLabel}</span> to recover
      </div>
      {dropPct > 0 && (
        <div style={{ ...labelStyle, marginTop: 4 }}>
          Average productivity drop: {dropPct}%
        </div>
      )}
    </div>
  );
}

function ConsistencyMeter({ bonus }: { bonus: number }) {
  const pct = Math.round(bonus * 100);
  let color = '#22C55E';
  if (bonus < 0.3) color = '#EF4444';
  else if (bonus < 0.6) color = '#EAB308';

  return (
    <div style={cardStyle}>
      <div style={labelStyle}>Sleep Consistency Bonus</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Moon size={14} style={{ color }} />
        <span style={{ ...valueStyle, color, fontSize: 16 }}>{pct}%</span>
      </div>
      <div style={{
        height: 6,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 3,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{ ...labelStyle, marginTop: 4 }}>
        {bonus >= 0.6
          ? 'Consistent sleep schedule strongly boosts your productivity'
          : bonus >= 0.3
            ? 'Regular sleep timing moderately helps your productivity'
            : 'Try keeping a more consistent sleep schedule'}
      </div>
    </div>
  );
}