/**
 * RevenueProjections — 30/60/90/180 day revenue forecasts
 * with confidence bands, breakdown by client, and rate impact calculator.
 */

import { useState } from 'react';
import type { ContractAnalytics } from './useContractIntelligence';

export function RevenueProjections({ analytics }: { analytics: ContractAnalytics }) {
  const [selectedPeriod, setSelectedPeriod] = useState<number>(90);
  const [rateAdjustment, setRateAdjustment] = useState(0);

  const projections = analytics.revenueProjections;
  const selected = projections.find(p => p.days === selectedPeriod) ?? projections[2];

  // Calculate adjusted values
  const adjustFactor = 1 + rateAdjustment / 100;
  const adjustedExpected = Math.round(selected.expected * adjustFactor);
  const adjustedBest = Math.round(selected.bestCase * adjustFactor);
  const adjustedWorst = Math.round(selected.worstCase * adjustFactor);
  const annualImpact = Math.round((adjustedExpected - selected.expected) / (selectedPeriod / 30) * 12);

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2">
        {[30, 60, 90, 180].map(days => (
          <button
            key={days}
            onClick={() => setSelectedPeriod(days)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedPeriod === days
                ? 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/30'
                : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/50 border border-white/5'
            }`}
          >
            {days} Days
          </button>
        ))}
      </div>

      {/* Projection Display */}
      <div className="grid md:grid-cols-3 gap-4">
        <ProjectionCard
          label="Best Case"
          value={`$${selected.bestCase.toLocaleString()}`}
          sub={`${selectedPeriod}-day optimistic`}
          color="green"
        />
        <ProjectionCard
          label="Expected"
          value={`$${selected.expected.toLocaleString()}`}
          sub={`${selectedPeriod}-day likely`}
          color="yellow"
        />
        <ProjectionCard
          label="Worst Case"
          value={`$${selected.worstCase.toLocaleString()}`}
          sub={`${selectedPeriod}-day conservative`}
          color="red"
        />
      </div>

      {/* Confidence Band Visual */}
      <div className="bg-zinc-900/80 rounded-xl border border-white/10 p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Revenue Confidence Range ({selectedPeriod}-day)</h3>
        <div className="space-y-4">
          {/* Best Case Bar */}
          <ConfidenceBar label="Best Case" amount={selected.bestCase} max={selected.bestCase} color="bg-green-500" />
          {/* Expected Bar */}
          <ConfidenceBar label="Expected" amount={selected.expected} max={selected.bestCase} color="bg-yellow-400" />
          {/* Worst Case Bar */}
          <ConfidenceBar label="Worst Case" amount={selected.worstCase} max={selected.bestCase} color="bg-red-400" />
        </div>
      </div>

      {/* Breakdown by Client */}
      <div className="bg-zinc-900/80 rounded-xl border border-white/10 p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Breakdown by Client ({selectedPeriod}-day)</h3>
        <div className="space-y-3">
          {Object.entries(selected.breakdown).map(([name, amount]) => {
            const pct = selected.expected > 0 ? (amount / selected.expected) * 100 : 0;
            return (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-300">{name}</span>
                  <span className="text-zinc-400">${amount.toLocaleString()} <span className="text-zinc-600">({pct.toFixed(0)}%)</span></span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div className="bg-blue-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rate Impact Calculator */}
      <div className="bg-zinc-900/80 rounded-xl border border-yellow-400/20 p-5">
        <h3 className="text-sm font-semibold text-yellow-400 mb-2">⚡ Rate Impact Calculator</h3>
        <p className="text-xs text-zinc-400 mb-4">See how a uniform rate change affects your {selectedPeriod}-day revenue.</p>

        <div className="flex items-center gap-4 mb-4">
          <input
            type="range"
            min={-20}
            max={30}
            value={rateAdjustment}
            onChange={e => setRateAdjustment(Number(e.target.value))}
            className="flex-1 accent-yellow-400"
          />
          <span className={`text-lg font-bold min-w-[4rem] text-right ${rateAdjustment > 0 ? 'text-green-400' : rateAdjustment < 0 ? 'text-red-400' : 'text-white'}`}>
            {rateAdjustment > 0 ? '+' : ''}{rateAdjustment}%
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-zinc-800/80 rounded-lg p-3 text-center">
            <p className="text-xs text-zinc-500">Adjusted Expected</p>
            <p className={`text-lg font-bold ${rateAdjustment > 0 ? 'text-green-400' : rateAdjustment < 0 ? 'text-red-400' : 'text-white'}`}>
              ${adjustedExpected.toLocaleString()}
            </p>
          </div>
          <div className="bg-zinc-800/80 rounded-lg p-3 text-center">
            <p className="text-xs text-zinc-500">Adjusted Best</p>
            <p className="text-sm font-semibold text-green-400">${adjustedBest.toLocaleString()}</p>
          </div>
          <div className="bg-zinc-800/80 rounded-lg p-3 text-center">
            <p className="text-xs text-zinc-500">Adjusted Worst</p>
            <p className="text-sm font-semibold text-red-400">${adjustedWorst.toLocaleString()}</p>
          </div>
          <div className="bg-zinc-800/80 rounded-lg p-3 text-center">
            <p className="text-xs text-zinc-500">Annual Impact</p>
            <p className={`text-lg font-bold ${annualImpact >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {annualImpact >= 0 ? '+' : ''}${annualImpact.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Period Comparison Table */}
      <div className="bg-zinc-900/80 rounded-xl border border-white/10 p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">All Period Projections</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-zinc-400 font-medium">Period</th>
                <th className="text-right py-2 px-3 text-zinc-400 font-medium">Best Case</th>
                <th className="text-right py-2 px-3 text-zinc-400 font-medium">Expected</th>
                <th className="text-right py-2 px-3 text-zinc-400 font-medium">Worst Case</th>
                <th className="text-right py-2 px-3 text-zinc-400 font-medium">Spread</th>
              </tr>
            </thead>
            <tbody>
              {projections.map(p => {
                const spread = p.bestCase - p.worstCase;
                const isSelected = p.days === selectedPeriod;
                return (
                  <tr
                    key={p.days}
                    className={`border-b border-white/5 cursor-pointer transition-colors ${isSelected ? 'bg-yellow-400/5' : 'hover:bg-white/5'}`}
                    onClick={() => setSelectedPeriod(p.days)}
                  >
                    <td className="py-2 px-3 font-medium text-white">{p.period}</td>
                    <td className="py-2 px-3 text-right text-green-400">${p.bestCase.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-yellow-400 font-semibold">${p.expected.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-red-400">${p.worstCase.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-zinc-500">${spread.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProjectionCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: 'green' | 'yellow' | 'red' }) {
  const colors = {
    green: 'border-green-400/20 bg-green-400/5',
    yellow: 'border-yellow-400/20 bg-yellow-400/5',
    red: 'border-red-400/20 bg-red-400/5',
  };
  const textColors = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-xs text-zinc-400 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${textColors[color]} mt-1`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{sub}</p>
    </div>
  );
}

function ConfidenceBar({ label, amount, max, color }: { label: string; amount: number; max: number; color: string }) {
  const pct = max > 0 ? (amount / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 bg-zinc-800 rounded-full h-4 relative overflow-hidden">
        <div className={`h-4 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-white font-medium w-24 text-right">${amount.toLocaleString()}</span>
    </div>
  );
}