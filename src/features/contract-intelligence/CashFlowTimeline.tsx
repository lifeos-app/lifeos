/**
 * CashFlowTimeline — Weekly/monthly income vs expenses visualization
 * with bill overlays, surplus/deficit indicators, and pattern detection.
 */

import { useState, useMemo } from 'react';
import type { ContractAnalytics } from './useContractIntelligence';

export function CashFlowTimeline({ analytics }: { analytics: ContractAnalytics }) {
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');
  const { cashFlowForecast } = analytics;

  const monthlyData = useMemo(() => {
    if (view !== 'monthly') return null;
    // Aggregate weekly data into monthly buckets
    const buckets: Record<string, { income: number; expenses: number; net: number }> = {};
    for (const entry of cashFlowForecast) {
      const month = entry.date.slice(0, 7);
      if (!buckets[month]) buckets[month] = { income: 0, expenses: 0, net: 0 };
      buckets[month].income += entry.income;
      buckets[month].expenses += entry.expenses;
      buckets[month].net += entry.net;
    }
    return Object.entries(buckets).map(([month, data]) => ({
      date: month,
      label: new Date(month + '-01').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
      ...data,
    }));
  }, [cashFlowForecast, view]);

  const data = view === 'monthly' ? monthlyData ?? [] : cashFlowForecast;
  const maxAmount = Math.max(...data.map(d => Math.max(d.income, d.expenses)), 1);

  // Pattern detection
  const patterns = useMemo(() => {
    const result: string[] = [];
    if (cashFlowForecast.length < 8) return result;

    const projected = cashFlowForecast.filter(d => d.label.startsWith('Week +'));
    const actual = cashFlowForecast.filter(d => !d.label.startsWith('Week +'));
    
    // Check for consistent surplus/deficit in projected
    const surplusWeeks = projected.filter(d => d.net > 0).length;
    if (surplusWeeks / projected.length > 0.8) {
      result.push('Projected weeks show consistent surplus — great financial position.');
    }
    const deficitWeeks = projected.filter(d => d.net < 0).length;
    if (deficitWeeks / projected.length > 0.5) {
      result.push('More than half of projected weeks show a deficit — consider cost optimization.');
    }

    // Check income stability
    const incomes = projected.map(d => d.income);
    const avgIncome = incomes.reduce((s, v) => s + v, 0) / incomes.length;
    const variance = incomes.reduce((s, v) => s + Math.pow(v - avgIncome, 2), 0) / incomes.length;
    const cv = Math.sqrt(variance) / (avgIncome || 1);
    if (cv > 0.3) {
      result.push('Income is highly variable week-to-week — consider building a buffer.');
    } else if (cv < 0.1) {
      result.push('Income is very stable — ideal for financial planning.');
    }

    // Monthly pattern check
    if (actual.length > 0) {
      const lastActual = actual[actual.length - 1];
      if (lastActual && lastActual.expenses > lastActual.income * 0.8) {
        result.push('Recent expenses are close to income — watch your margins.');
      }
    }

    return result;
  }, [cashFlowForecast]);

  // Calculate cumulative
  const displayData = useMemo(() => {
    let cumNet = 0;
    return data.map(d => {
      cumNet += (d as any).net ?? (d as any).net ?? 0;
      return { ...d, cumulativeNet: cumNet };
    });
  }, [data]);

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('weekly')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            view === 'weekly' ? 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/30' : 'text-zinc-400 bg-zinc-900/50 border border-white/5'
          }`}
        >
          Weekly
        </button>
        <button
          onClick={() => setView('monthly')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            view === 'monthly' ? 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/30' : 'text-zinc-400 bg-zinc-900/50 border border-white/5'
          }`}
        >
          Monthly
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {(() => {
          const totalIncome = displayData.reduce((s, d) => s + d.income, 0);
          const totalExpenses = displayData.reduce((s, d) => s + d.expenses, 0);
          const totalNet = totalIncome - totalExpenses;
          return (
            <>
              <div className="bg-zinc-900/80 rounded-xl border border-white/10 p-4">
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Total Income</p>
                <p className="text-xl font-bold text-green-400 mt-1">${totalIncome.toLocaleString()}</p>
              </div>
              <div className="bg-zinc-900/80 rounded-xl border border-white/10 p-4">
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Total Expenses</p>
                <p className="text-xl font-bold text-red-400 mt-1">${totalExpenses.toLocaleString()}</p>
              </div>
              <div className="bg-zinc-900/80 rounded-xl border border-white/10 p-4">
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Net Position</p>
                <p className={`text-xl font-bold mt-1 ${totalNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalNet >= 0 ? '+' : ''}${totalNet.toLocaleString()}
                </p>
              </div>
            </>
          );
        })()}
      </div>

      {/* Cash Flow Chart (CSS-based) */}
      <div className="bg-zinc-900/80 rounded-xl border border-white/10 p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Income vs Expenses</h3>
        <div className="flex items-end gap-1 h-48">
          {displayData.slice(0, 16).map((d, i) => {
            const incomeH = maxAmount > 0 ? (d.income / maxAmount) * 100 : 0;
            const expH = maxAmount > 0 ? (d.expenses / maxAmount) * 100 : 0;
            const isProjected = (d as any).label?.startsWith('Week +') ?? i > 4;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0 min-w-[2rem]">
                <div className="relative w-full flex-1 flex items-end">
                  {/* Income Bar */}
                  <div className="absolute bottom-0 left-0 w-1/2 rounded-t transition-all"
                    style={{ height: `${Math.max(incomeH, 2)}%`, opacity: isProjected ? 0.5 : 1 }}
                  >
                    <div className="w-full h-full bg-green-400 rounded-t" />
                  </div>
                  {/* Expense Bar */}
                  <div className="absolute bottom-0 right-0 w-1/2 rounded-t transition-all"
                    style={{ height: `${Math.max(expH, 2)}%`, opacity: isProjected ? 0.5 : 1 }}
                  >
                    <div className="w-full h-full bg-red-400 rounded-t" />
                  </div>
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 rotate-45 origin-top-left truncate max-w-[3rem]">
                  {(d as any).label || ''}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-400" />
            <span className="text-xs text-zinc-400">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-400" />
            <span className="text-xs text-zinc-400">Expenses</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-400 opacity-50" />
            <span className="text-xs text-zinc-400">Projected</span>
          </div>
        </div>
      </div>

      {/* Net Cash Flow Trend */}
      <div className="bg-zinc-900/80 rounded-xl border border-white/10 p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Cumulative Net Position</h3>
        <div className="flex items-end gap-1 h-32">
          {displayData.slice(0, 16).map((d, i) => {
            const allCum = displayData.map(dd => dd.cumulativeNet || 0);
            const maxCum = Math.max(...allCum.map(Math.abs), 1);
            const h = Math.abs(d.cumulativeNet || 0) / maxCum * 100;
            const isPositive = (d.cumulativeNet || 0) >= 0;
            const isProjected = (d as any).label?.startsWith('Week +') ?? i > 4;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                <div
                  className={`w-full rounded-t transition-all ${isPositive ? 'bg-green-400' : 'bg-red-400'} ${isProjected ? 'opacity-50' : ''}`}
                  style={{ height: `${Math.max(h, 2)}%`, alignSelf: isPositive ? 'flex-end' : 'flex-start' }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly Detail Table */}
      <div className="bg-zinc-900/80 rounded-xl border border-white/10 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-zinc-300">Detailed Cash Flow</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-4 text-zinc-400 font-medium">Period</th>
                <th className="text-right py-2 px-4 text-zinc-400 font-medium">Income</th>
                <th className="text-right py-2 px-4 text-zinc-400 font-medium">Expenses</th>
                <th className="text-right py-2 px-4 text-zinc-400 font-medium">Net</th>
                <th className="text-right py-2 px-4 text-zinc-400 font-medium">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {displayData.slice(0, 16).map((d, i) => {
                const net = d.income - d.expenses;
                return (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 px-4 text-zinc-300">
                      {(d as any).label || d.date}
                      {(d as any).label?.startsWith('Week +') && <span className="ml-1 text-[10px] text-yellow-400">projected</span>}
                    </td>
                    <td className="py-2 px-4 text-right text-green-400">${d.income.toLocaleString()}</td>
                    <td className="py-2 px-4 text-right text-red-400">${d.expenses.toLocaleString()}</td>
                    <td className={`py-2 px-4 text-right font-medium ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {net >= 0 ? '+' : ''}${net.toLocaleString()}
                    </td>
                    <td className={`py-2 px-4 text-right ${(d.cumulativeNet || 0) >= 0 ? 'text-zinc-300' : 'text-red-400'}`}>
                      ${(d.cumulativeNet || 0).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pattern Detection */}
      {patterns.length > 0 && (
        <div className="bg-blue-500/5 border border-blue-400/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-400 mb-2">🔍 Pattern Detection</h3>
          <ul className="space-y-1.5">
            {patterns.map((pattern, i) => (
              <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                {pattern}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Savings Goal Tracker */}
      <div className="bg-zinc-900/80 rounded-xl border border-white/10 p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">🎯 Savings Goal Tracker</h3>
        {(() => {
          const monthlyNet = analytics.monthlyRevenue - analytics.cashFlowForecast
            .filter(d => !(d as any).label?.startsWith('Week +'))
            .reduce((s, d) => s + d.expenses, 0) / Math.max(analytics.cashFlowForecast.filter(d => !(d as any).label?.startsWith('Week +')).length, 1) * 4.33;

          return (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Monthly surplus</span>
                <span className={monthlyNet >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {monthlyNet >= 0 ? '+' : ''}${Math.round(monthlyNet).toLocaleString()}/mo
                </span>
              </div>
              {monthlyNet > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">3-month savings target</span>
                    <span className="text-yellow-400">${Math.round(monthlyNet * 3).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">6-month emergency fund</span>
                    <span className="text-blue-400">${Math.round(monthlyNet * 6).toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}