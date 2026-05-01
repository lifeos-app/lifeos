/**
 * LifeSimulator.tsx — Main page component for the Predictive Life Simulator
 *
 * A "What If?" forecasting engine that uses the user's real historical data
 * to simulate outcomes. "What if I wake up at 5am?" or "What if I cut
 * spending by 20%?" — the AI + pattern engine forecasts outcomes across
 * health, finances, streaks, XP.
 *
 * Three-column layout: Scenario Config | Simulation Results | Timeline Comparison
 */

import { useState, useCallback, useMemo } from 'react';
import { useSimulator, SCENARIO_TEMPLATES, type SimulationScenario, type SimulationResult } from './useSimulator';
import { ScenarioBuilder } from './ScenarioBuilder';
import { SimulationResults } from './SimulationResults';
import { AreaChartWithBands, BeforeAfterLineChart, DOMAIN_COLORS } from './ProjectionCharts';

// ── Icons ──────────────────────────────────────────────────────────

const CrystallBallIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="10" r="7" />
    <path d="M5 10c0-3.866 3.134-7 7-7s7 3.134 7 7" />
    <path d="M9 21h6" />
    <path d="M8 18h8" />
    <circle cx="10" cy="8" r="0.5" fill="currentColor" opacity="0.5" />
    <circle cx="14" cy="7" r="0.3" fill="currentColor" opacity="0.3" />
    <circle cx="12" cy="11" r="0.4" fill="currentColor" opacity="0.4" />
  </svg>
);

// ── Timeline Comparison Panel ──────────────────────────────────────

function TimelineComparison({
  result,
  compareResult,
}: {
  result: SimulationResult | null;
  compareResult: SimulationResult | null;
}) {
  if (!result && !compareResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="text-5xl mb-4 opacity-40">🔮</div>
        <h3 className="text-sm font-medium mb-1" style={{ color: '#8BA4BE' }}>Timeline Comparison</h3>
        <p className="text-xs" style={{ color: '#5A7A9A' }}>
          Run a simulation, then add a comparison to see how two scenarios side by side.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ color: '#E2E8F0' }}>
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(30,58,91,0.5)' }}>
        <h3 className="text-sm font-bold" style={{ color: '#A855F7' }}>Timeline Comparison</h3>
        <p className="text-xs" style={{ color: '#8BA4BE' }}>30/60/90-day milestones</p>
      </div>

      {/* Primary scenario milestones */}
      {result && (
        <div className="px-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full" style={{ background: '#00D4FF' }} />
            <span className="text-sm font-medium" style={{ color: '#00D4FF' }}>{result.scenario.name}</span>
          </div>
          <div className="space-y-3">
            {[30, 60, 90].filter(d => d <= result.scenario.duration).map(day => {
              const dayProjections = result.projections.filter(p => {
                const dateDiff = Math.floor((new Date(p.date).getTime() - new Date().getTime()) / 86400000);
                return Math.abs(dateDiff - day) <= 2;
              });

              if (dayProjections.length === 0) return null;

              return (
                <div key={day} className="rounded-lg p-3" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.1)' }}>
                  <div className="text-xs font-bold mb-1" style={{ color: '#00D4FF' }}>Day {day}</div>
                  {dayProjections.slice(0, 3).map((p, i) => {
                    const delta = p.simulated - p.baseline;
                    const domainInfo = DOMAIN_COLORS[p.domain];
                    return (
                      <div key={i} className="flex items-center justify-between text-xs py-0.5">
                        <span style={{ color: domainInfo?.primary ?? '#8BA4BE' }}>
                          {domainInfo?.label ?? p.domain}: {p.metric.replace(/_/g, ' ')}
                        </span>
                        <span style={{ color: delta > 0 ? '#22C55E' : '#F43F5E' }}>
                          {delta > 0 ? '+' : ''}{Math.round(delta)}{p.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comparison scenario milestones */}
      {compareResult && (
        <div className="px-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full" style={{ background: '#A855F7' }} />
            <span className="text-sm font-medium" style={{ color: '#A855F7' }}>{compareResult.scenario.name}</span>
          </div>
          <div className="space-y-3">
            {[30, 60, 90].filter(d => d <= compareResult.scenario.duration).map(day => {
              const dayProjections = compareResult.projections.filter(p => {
                const dateDiff = Math.floor((new Date(p.date).getTime() - new Date().getTime()) / 86400000);
                return Math.abs(dateDiff - day) <= 2;
              });

              if (dayProjections.length === 0) return null;

              return (
                <div key={day} className="rounded-lg p-3" style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.1)' }}>
                  <div className="text-xs font-bold mb-1" style={{ color: '#A855F7' }}>Day {day}</div>
                  {dayProjections.slice(0, 3).map((p, i) => {
                    const delta = p.simulated - p.baseline;
                    const domainInfo = DOMAIN_COLORS[p.domain];
                    return (
                      <div key={i} className="flex items-center justify-between text-xs py-0.5">
                        <span style={{ color: domainInfo?.primary ?? '#8BA4BE' }}>
                          {domainInfo?.label ?? p.domain}: {p.metric.replace(/_/g, ' ')}
                        </span>
                        <span style={{ color: delta > 0 ? '#22C55E' : '#F43F5E' }}>
                          {delta > 0 ? '+' : ''}{Math.round(delta)}{p.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Side by side summary */}
      {result && compareResult && (
        <div className="px-4 mt-4">
          <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#8BA4BE' }}>
            Scenario Comparison
          </h4>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(30,58,91,0.5)' }}>
            <div className="grid grid-cols-3 text-xs font-bold" style={{ background: 'rgba(30,58,91,0.4)' }}>
              <div className="p-2">Metric</div>
              <div className="p-2 text-center" style={{ color: '#00D4FF' }}>{result.scenario.name}</div>
              <div className="p-2 text-center" style={{ color: '#A855F7' }}>{compareResult.scenario.name}</div>
            </div>
            {(() => {
              const domains = Object.keys(DOMAIN_COLORS);
              return domains.map(domain => {
                const rPts = result.projections.filter(p => p.domain === domain);
                const cPts = compareResult.projections.filter(p => p.domain === domain);
                if (rPts.length === 0 && cPts.length === 0) return null;
                const rLast = rPts[rPts.length - 1];
                const cLast = cPts[cPts.length - 1];
                const domainInfo = DOMAIN_COLORS[domain];
                return (
                  <div key={domain} className="grid grid-cols-3 text-xs" style={{ borderTop: '1px solid rgba(30,58,91,0.3)' }}>
                    <div className="p-2" style={{ color: domainInfo?.primary ?? '#8BA4BE' }}>
                      {domainInfo?.label ?? domain}
                    </div>
                    <div className="p-2 text-center font-bold" style={{ color: rLast && (rLast.simulated > rLast.baseline) ? '#22C55E' : '#E2E8F0' }}>
                      {rLast ? `${Math.round(rLast.simulated)}${rLast.unit}` : '—'}
                    </div>
                    <div className="p-2 text-center font-bold" style={{ color: cLast && (cLast.simulated > cLast.baseline) ? '#22C55E' : '#E2E8F0' }}>
                      {cLast ? `${Math.round(cLast.simulated)}${cLast.unit}` : '—'}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Quick scenario shortcuts */}
      <div className="px-4 mt-6 mb-4">
        <p className="text-xs text-center" style={{ color: '#5A7A9A' }}>
          Select a different preset to compare outcomes
        </p>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export function LifeSimulator() {
  const {
    running,
    result,
    error,
    compareScenario,
    compareResult,
    runSimulation,
    runComparison,
    setCompareScenario,
    clearResult,
    templates,
  } = useSimulator();

  const [showMobilePanel, setShowMobilePanel] = useState<'config' | 'results' | 'timeline'>('config');

  const handleRun = useCallback(async (scenario: SimulationScenario) => {
    await runSimulation(scenario);
  }, [runSimulation]);

  const handleCompare = useCallback(async (scenario: SimulationScenario) => {
    await runComparison(scenario);
  }, [runComparison]);

  const handleAddToGoals = useCallback((_result: SimulationResult) => {
    // TODO: Integrate with useGoalsStore to create a goal from the scenario
    console.log('Add to goals:', _result.scenario.name);
  }, []);

  const handleExport = useCallback((simResult: SimulationResult) => {
    const exportData = {
      scenario: simResult.scenario,
      confidence: simResult.confidence,
      projections: simResult.projections,
      insights: simResult.insights,
      risks: simResult.risks,
      xpImpact: simResult.xpImpact,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos-simulation-${simResult.scenario.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Desktop: 3-column layout ──
  return (
    <div className="min-h-screen" style={{ background: '#050E1A', color: '#E2E8F0' }}>
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3 border-b"
        style={{
          background: 'rgba(15,45,74,0.85)',
          backdropFilter: 'blur(20px)',
          borderColor: 'rgba(30,58,91,0.5)',
        }}
      >
        <CrystallBallIcon />
        <div className="flex-1">
          <h1 className="text-lg font-bold" style={{ color: '#00D4FF' }}>
            Predictive Life Simulator
          </h1>
          <p className="text-xs" style={{ color: '#8BA4BE' }}>
            What if? — Forecast outcomes from your real data
          </p>
        </div>
        {result && (
          <button
            onClick={clearResult}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
            style={{
              background: 'rgba(30,58,91,0.6)',
              border: '1px solid rgba(30,58,91,0.8)',
              color: '#8BA4BE',
            }}
          >
            ✕ Reset
          </button>
        )}

        {/* Mobile panel toggle */}
        <div className="md:hidden flex gap-1 rounded-xl overflow-hidden" style={{ background: 'rgba(30,58,91,0.4)' }}>
          {[
            { key: 'config' as const, label: '⚙️' },
            { key: 'results' as const, label: '📊' },
            { key: 'timeline' as const, label: '📋' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setShowMobilePanel(tab.key)}
              className="px-3 py-1.5 text-xs"
              style={{
                background: showMobilePanel === tab.key ? 'rgba(0,212,255,0.15)' : 'transparent',
                color: showMobilePanel === tab.key ? '#00D4FF' : '#8BA4BE',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row" style={{ height: 'calc(100vh - 64px)' }}>
        {/* ── Column 1: Scenario Config ── */}
        <div
          className="hidden md:flex md:w-80 lg:w-96 flex-col border-r overflow-y-auto"
          style={{ borderColor: 'rgba(30,58,91,0.5)' }}
        >
          <ScenarioBuilder
            onRun={handleRun}
            onCompare={handleCompare}
            activeScenario={result?.scenario ?? null}
            isRunning={running}
          />
        </div>

        {/* ── Mobile: Config Panel ── */}
        {showMobilePanel === 'config' && (
          <div className="md:hidden flex-1 overflow-y-auto">
            <ScenarioBuilder
              onRun={handleRun}
              onCompare={handleCompare}
              activeScenario={result?.scenario ?? null}
              isRunning={running}
            />
          </div>
        )}

        {/* ── Column 2: Simulation Results ── */}
        <div
          className="hidden md:flex flex-1 overflow-y-auto"
          style={{ borderRight: compareResult ? '1px solid rgba(30,58,91,0.5)' : 'none' }}
        >
          {running ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#00D4FF', borderTopColor: 'transparent' }} />
                  <div className="absolute inset-2 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#A855F7', borderTopColor: 'transparent', animationDirection: 'reverse', animationDuration: '1.5s' }} />
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">🔮</div>
                </div>
                <div className="text-sm font-medium" style={{ color: '#00D4FF' }}>Running simulation...</div>
                <div className="text-xs mt-1" style={{ color: '#8BA4BE' }}>Analyzing your patterns and forecasting outcomes</div>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center">
                <div className="text-4xl mb-4">⚠️</div>
                <div className="text-sm font-medium mb-2" style={{ color: '#F43F5E' }}>Simulation Error</div>
                <div className="text-xs" style={{ color: '#8BA4BE' }}>{error}</div>
                <button
                  onClick={clearResult}
                  className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'rgba(30,58,91,0.6)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.3)' }}
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : result ? (
            <SimulationResults
              result={result}
              compareResult={compareResult}
              onAddToGoals={handleAddToGoals}
              onExport={handleExport}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center max-w-xs">
                <div className="text-6xl mb-4 opacity-30">🔮</div>
                <h2 className="text-lg font-bold mb-2" style={{ color: '#00D4FF' }}>What If?</h2>
                <p className="text-sm" style={{ color: '#8BA4BE' }}>
                  Select a scenario on the left to see your projected outcomes. The simulator uses your real behavioral data
                  to forecast realistic results.
                </p>
                <div className="mt-6 space-y-2">
                  {templates.slice(0, 3).map((t, i) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs" style={{ color: '#5A7A9A' }}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF' }}>
                        {i + 1}
                      </span>
                      <span>{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile: Results Panel */}
        {showMobilePanel === 'results' && !running && (
          <div className="md:hidden flex-1 overflow-y-auto">
            {result ? (
              <SimulationResults
                result={result}
                compareResult={compareResult}
                onAddToGoals={handleAddToGoals}
                onExport={handleExport}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center px-6 min-h-[60vh]">
                <div className="text-center">
                  <div className="text-5xl mb-4 opacity-30">🔮</div>
                  <p className="text-sm" style={{ color: '#8BA4BE' }}>Run a simulation to see results</p>
                </div>
              </div>
            )}
          </div>
        )}

        {showMobilePanel === 'results' && running && (
          <div className="md:hidden flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#00D4FF', borderTopColor: 'transparent' }} />
                <div className="absolute inset-2 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#A855F7', borderTopColor: 'transparent', animationDirection: 'reverse' }} />
                <div className="absolute inset-0 flex items-center justify-center text-xl">🔮</div>
              </div>
              <div className="text-sm font-medium" style={{ color: '#00D4FF' }}>Simulating...</div>
            </div>
          </div>
        )}

        {/* ── Column 3: Timeline Comparison ── */}
        <div className="hidden md:flex md:w-80 lg:w-96 flex-col overflow-y-auto">
          <TimelineComparison result={result} compareResult={compareResult} />
        </div>

        {/* Mobile: Timeline Panel */}
        {showMobilePanel === 'timeline' && (
          <div className="md:hidden flex-1 overflow-y-auto">
            <TimelineComparison result={result} compareResult={compareResult} />
          </div>
        )}
      </div>

      {/* ── Background glow effects ── */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(ellipse 400px 300px at 20% 50%, rgba(0,212,255,0.03), transparent),
            radial-gradient(ellipse 300px 300px at 80% 50%, rgba(168,85,247,0.03), transparent)
          `,
        }}
      />
    </div>
  );
}

export default LifeSimulator;