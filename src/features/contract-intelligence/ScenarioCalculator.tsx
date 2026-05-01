/**
 * ScenarioCalculator — What-if scenario builder for contracts
 *
 * "Raise rate by X%" slider, add new client, drop client impact,
 * side-by-side comparison, break-even analysis.
 */

import { useState, useCallback } from 'react';
import { useContractIntelligence, calculateScenarioRevenue, contractCleansPerMonth } from './useContractIntelligence';
import type { ContractAnalytics } from './useContractIntelligence';

interface ScenarioMod {
  id: string;
  contractId: string;
  contractName: string;
  type: 'rate_increase' | 'frequency_increase' | 'remove_client' | 'add_client';
  newRate?: number;
  newDaysPerWeek?: number;
  newClientName?: string;
  newClientRate?: number;
  newClientDaysPerWeek?: number;
  newClientRouteKm?: number;
}

export function ScenarioCalculator({ analytics }: { analytics: ContractAnalytics }) {
  const [scenarios, setScenarios] = useState<ScenarioMod[]>([]);
  const [scenarioTab, setScenarioTab] = useState<'rate' | 'add' | 'remove' | 'compare'>('rate');

  // Rate adjustment
  const [ratePct, setRatePct] = useState(0);
  const [rateTargetId, setRateTargetId] = useState<string>(analytics.contracts[0]?.id ?? '');

  // Add client
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState(160);
  const [newDays, setNewDays] = useState(3);
  const [newRouteKm, setNewRouteKm] = useState(40);

  // Remove target
  const [removeTargetId, setRemoveTargetId] = useState<string>(analytics.contracts[0]?.id ?? '');

  const activeContracts = analytics.contracts.filter(c => c.status === 'active' || c.status === 'at_risk');

  // Calculate scenarios
  const rateResult = calculateScenarioRevenue(
    analytics.contracts,
    ratePct !== 0 ? [{ contractId: rateTargetId, newRate: (analytics.contracts.find(c => c.id === rateTargetId)?.rate ?? 150) * (1 + ratePct / 100) }] : [],
    [],
    [],
  );

  const addResult = calculateScenarioRevenue(
    analytics.contracts,
    [],
    [{ name: newName || 'New Client', rate: newRate, daysPerWeek: newDays, routeKm: newRouteKm }],
    [],
  );

  const removeResult = calculateScenarioRevenue(
    analytics.contracts,
    [],
    [],
    [removeTargetId],
  );

  const addScenario = useCallback((mod: ScenarioMod) => {
    setScenarios(prev => [...prev, mod]);
  }, []);

  return (
    <div className="space-y-6">
      {/* Tab Selector */}
      <div className="flex gap-2 overflow-x-auto">
        {[
          { id: 'rate' as const, label: '📈 Raise Rates', icon: '' },
          { id: 'add' as const, label: '➕ Add Client', icon: '' },
          { id: 'remove' as const, label: '➖ Drop Client', icon: '' },
          { id: 'compare' as const, label: '📊 Compare', icon: '' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setScenarioTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              scenarioTab === tab.id
                ? 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/30'
                : 'text-zinc-400 bg-zinc-900/50 border border-white/5 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Rate Increase */}
      {scenarioTab === 'rate' && (
        <div className="space-y-4">
          <div className="bg-zinc-900/80 rounded-xl border border-yellow-400/20 p-5">
            <h3 className="text-sm font-semibold text-yellow-400 mb-2">📈 Rate Adjustment Calculator</h3>
            <p className="text-xs text-zinc-400 mb-4">
              See the impact of changing rates on your revenue projections.
            </p>

            {/* Target Client */}
            <div className="mb-4">
              <label className="text-xs text-zinc-400 block mb-1">Target Client</label>
              <select
                value={rateTargetId}
                onChange={e => setRateTargetId(e.target.value)}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400/50"
              >
                {activeContracts.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (${c.rate}/clean)</option>
                ))}
              </select>
            </div>

            {/* Rate Slider */}
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <label className="text-xs text-zinc-400">Rate Change</label>
                <span className={`text-sm font-bold ${ratePct > 0 ? 'text-green-400' : ratePct < 0 ? 'text-red-400' : 'text-white'}`}>
                  {ratePct > 0 ? '+' : ''}{ratePct}%
                </span>
              </div>
              <input
                type="range"
                min={-30}
                max={50}
                step={1}
                value={ratePct}
                onChange={e => setRatePct(Number(e.target.value))}
                className="w-full accent-yellow-400"
              />
              <div className="flex justify-between text-xs text-zinc-500">
                <span>-30%</span>
                <span>0%</span>
                <span>+50%</span>
              </div>
            </div>

            {/* Result */}
            {ratePct !== 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/5">
                <ResultCard label="Current Monthly" value={`$${rateResult.currentMonthly.toLocaleString()}`} color="white" />
                <ResultCard label="Projected Monthly" value={`$${rateResult.projectedMonthly.toLocaleString()}`} color="yellow" />
                <ResultCard label="Monthly Change" value={`${rateResult.difference >= 0 ? '+' : ''}$${rateResult.difference.toLocaleString()}`} color={rateResult.difference >= 0 ? 'green' : 'red'} />
                <ResultCard label="Annual Impact" value={`${rateResult.differenceAnnual >= 0 ? '+' : ''}$${rateResult.differenceAnnual.toLocaleString()}`} color={rateResult.differenceAnnual >= 0 ? 'green' : 'red'} />
              </div>
            )}

            {ratePct !== 0 && (
              <button
                onClick={() => addScenario({
                  id: `rate-${Date.now()}`,
                  contractId: rateTargetId,
                  contractName: analytics.contracts.find(c => c.id === rateTargetId)?.name ?? '',
                  type: 'rate_increase',
                  newRate: (analytics.contracts.find(c => c.id === rateTargetId)?.rate ?? 150) * (1 + ratePct / 100),
                })}
                className="mt-3 w-full px-4 py-2 rounded-lg bg-yellow-400/10 text-yellow-400 text-sm font-medium hover:bg-yellow-400/20 transition-colors"
              >
                💾 Save to Comparison
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add Client */}
      {scenarioTab === 'add' && (
        <div className="bg-zinc-900/80 rounded-xl border border-green-400/20 p-5">
          <h3 className="text-sm font-semibold text-green-400 mb-2">➕ New Client Calculator</h3>
          <p className="text-xs text-zinc-400 mb-4">
            Project the revenue impact of adding a new cleaning contract.
          </p>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Client Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g., Oakleigh Dental"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400/50"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Rate per Clean ($)</label>
              <input
                type="number"
                value={newRate}
                onChange={e => setNewRate(Number(e.target.value))}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400/50"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Days per Week</label>
              <select
                value={newDays}
                onChange={e => setNewDays(Number(e.target.value))}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400/50"
              >
                {[1, 2, 3, 4, 5, 6, 7].map(d => (
                  <option key={d} value={d}>{d}x/week</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Route Distance (km)</label>
              <input
                type="number"
                value={newRouteKm}
                onChange={e => setNewRouteKm(Number(e.target.value))}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400/50"
              />
            </div>
          </div>

          {/* Results */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/5">
            <ResultCard label="New Monthly Revenue" value={`$${addResult.projectedMonthly.toLocaleString()}`} color="green" />
            <ResultCard label="Monthly Increase" value={`+$${addResult.difference.toLocaleString()}`} color="green" />
            <ResultCard label="Annual Impact" value={`+$${addResult.differenceAnnual.toLocaleString()}`} color="green" />
            <ResultCard label="New Cleans/Month" value={`${(newDays * 4.33).toFixed(0)}`} color="blue" />
          </div>

          {/* Break-Even Analysis */}
          <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
            <h4 className="text-xs font-semibold text-zinc-400 mb-2">Break-Even Analysis</h4>
            <p className="text-sm text-zinc-300">
              At <span className="text-green-400 font-medium">${newRate}/clean</span>, <span className="text-green-400 font-medium">{newDays}x/week</span>:
            </p>
            <ul className="mt-1.5 space-y-1 text-sm text-zinc-400">
              <li>• Monthly revenue: <span className="text-white">${Math.round(newRate * newDays * 4.33).toLocaleString()}</span></li>
              <li>• ATO km deduction: <span className="text-white">${(newRouteKm * 0.85 * newDays * 4.33).toFixed(0)}/mo</span></li>
              <li>• Effective hourly (est. 2.5hr/clean): <span className="text-white">${(newRate / 2.5).toFixed(2)}/hr</span></li>
            </ul>
          </div>

          <button
            onClick={() => addScenario({
              id: `add-${Date.now()}`,
              contractId: `new-${newName}`,
              contractName: newName || 'New Client',
              type: 'add_client',
              newClientName: newName || 'New Client',
              newClientRate: newRate,
              newClientDaysPerWeek: newDays,
              newClientRouteKm: newRouteKm,
            })}
            className="mt-3 w-full px-4 py-2 rounded-lg bg-green-400/10 text-green-400 text-sm font-medium hover:bg-green-400/20 transition-colors"
          >
            💾 Save to Comparison
          </button>
        </div>
      )}

      {/* Remove Client */}
      {scenarioTab === 'remove' && (
        <div className="bg-zinc-900/80 rounded-xl border border-red-400/20 p-5">
          <h3 className="text-sm font-semibold text-red-400 mb-2">➖ Drop Client Impact Analysis</h3>
          <p className="text-xs text-zinc-400 mb-4">
            See the financial impact of losing a client. Choose wisely!
          </p>

          <div className="mb-4">
            <label className="text-xs text-zinc-400 block mb-1">Select Client to Remove</label>
            <select
              value={removeTargetId}
              onChange={e => setRemoveTargetId(e.target.value)}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-400/50"
            >
              {activeContracts.map(c => (
                <option key={c.id} value={c.id}>{c.name} (${c.rate}/clean, {c.frequency === 'weekly' ? `${c.daysPerWeek}x/week` : c.frequency})</option>
              ))}
            </select>
          </div>

          {(() => {
            const removed = analytics.contracts.find(c => c.id === removeTargetId);
            const removedMonthly = removed ? Math.round(removed.rate * contractCleansPerMonth(removed)) : 0;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultCard label="Revenue Lost" value={`-$${removedMonthly.toLocaleString()}/mo`} color="red" />
                <ResultCard label="Annual Impact" value={`-$${removeResult.differenceAnnual.toLocaleString()}`} color="red" />
                <ResultCard label="New Monthly" value={`$${removeResult.projectedMonthly.toLocaleString()}`} color="yellow" />
                <ResultCard label="% of Business" value={`${analytics.monthlyRevenue > 0 ? Math.round(removedMonthly / analytics.monthlyRevenue * 100) : 0}%`} color="red" />
              </div>
            );
          })()}

          <div className="mt-4 p-3 bg-red-500/5 rounded-lg border border-red-500/10">
            <p className="text-xs text-red-400 font-semibold">⚠️ Warning</p>
            <p className="text-sm text-zinc-400 mt-1">
              Losing a client also affects route efficiency and may increase per-visit costs for remaining clients.
              Consider renegotiation before dropping.
            </p>
          </div>
        </div>
      )}

      {/* Compare */}
      {scenarioTab === 'compare' && (
        <div className="bg-zinc-900/80 rounded-xl border border-white/10 p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">📊 Saved Scenarios Comparison</h3>
          {scenarios.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <p className="text-4xl mb-2">🔮</p>
              <p className="text-sm">No scenarios saved yet. Use the other tabs to build and save scenarios for comparison.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-3 text-zinc-400">Scenario</th>
                    <th className="text-left py-2 px-3 text-zinc-400">Type</th>
                    <th className="text-right py-2 px-3 text-zinc-400">Monthly Impact</th>
                    <th className="text-right py-2 px-3 text-zinc-400">Annual Impact</th>
                    <th className="text-center py-2 px-3 text-zinc-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map(s => {
                    const result = calculateScenarioRevenue(
                      analytics.contracts,
                      s.type === 'rate_increase' ? [{ contractId: s.contractId, newRate: s.newRate }] : [],
                      s.type === 'add_client' ? [{ name: s.newClientName ?? 'New Client', rate: s.newClientRate ?? 160, daysPerWeek: s.newClientDaysPerWeek ?? 3, routeKm: s.newClientRouteKm ?? 40 }] : [],
                      s.type === 'remove_client' ? [s.contractId] : [],
                    );
                    return (
                      <tr key={s.id} className="border-b border-white/5">
                        <td className="py-2 px-3 text-white font-medium">{s.contractName}</td>
                        <td className="py-2 px-3 text-zinc-400">
                          {s.type === 'rate_increase' ? '📈 Rate Change' : s.type === 'add_client' ? '➕ New Client' : '➖ Remove'}
                        </td>
                        <td className={`py-2 px-3 text-right font-medium ${result.difference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {result.difference >= 0 ? '+' : ''}${result.difference.toLocaleString()}
                        </td>
                        <td className={`py-2 px-3 text-right font-medium ${result.differenceAnnual >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {result.differenceAnnual >= 0 ? '+' : ''}${result.differenceAnnual.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => setScenarios(prev => prev.filter(sc => sc.id !== s.id))}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({ label, value, color }: { label: string; value: string; color: 'white' | 'yellow' | 'green' | 'red' | 'blue' }) {
  const colors = {
    white: 'text-white',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  };
  return (
    <div className="bg-zinc-800/80 rounded-lg p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-lg font-bold ${colors[color]} mt-0.5`}>{value}</p>
    </div>
  );
}