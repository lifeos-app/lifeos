/**
 * ContractIntelligence — Business Command Center for TCS
 *
 * Executive dashboard, contract cards, revenue projections, cash flow,
 * scenario builder, smart alerts, and client comparison.
 */

import { useState } from 'react';
import { useContractIntelligence } from './useContractIntelligence';
import { RevenueProjections } from './RevenueProjections';
import { ClientHealthDashboard } from './ClientHealthDashboard';
import { CashFlowTimeline } from './CashFlowTimeline';
import { ScenarioCalculator } from './ScenarioCalculator';
import { SmartAlerts } from './SmartAlerts';

type Tab = 'overview' | 'health' | 'projections' | 'cashflow' | 'scenarios' | 'alerts';

export function ContractIntelligence() {
  const analytics = useContractIntelligence();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Command Center', icon: '📊' },
    { id: 'health', label: 'Client Health', icon: '💚' },
    { id: 'projections', label: 'Projections', icon: '📈' },
    { id: 'cashflow', label: 'Cash Flow', icon: '💰' },
    { id: 'scenarios', label: 'What If', icon: '🔮' },
    { id: 'alerts', label: 'Alerts', icon: '🔔' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/40 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                <span className="text-yellow-400">⚡</span> Contract Intelligence
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Teddy's Cleaning Systems — Business Command Center
              </p>
            </div>
            <div className="flex gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                {analytics.contracts.filter(c => c.status === 'active').length} Active Contracts
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-green-400/10 text-green-400 border border-green-400/20">
                ${analytics.monthlyRevenue.toLocaleString()}/mo
              </span>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex gap-1 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                  ${activeTab === tab.id
                    ? 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
                  }
                `}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && <OverviewTab analytics={analytics} />}
        {activeTab === 'health' && <ClientHealthDashboard analytics={analytics} />}
        {activeTab === 'projections' && <RevenueProjections analytics={analytics} />}
        {activeTab === 'cashflow' && <CashFlowTimeline analytics={analytics} />}
        {activeTab === 'scenarios' && <ScenarioCalculator analytics={analytics} />}
        {activeTab === 'alerts' && <SmartAlerts analytics={analytics} />}
      </div>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ analytics }: { analytics: ReturnType<typeof useContractIntelligence> }) {
  return (
    <div className="space-y-6">
      {/* Executive KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label="Monthly Revenue"
          value={`$${analytics.monthlyRevenue.toLocaleString()}`}
          sub={`$${analytics.projectedAnnual.toLocaleString()}/yr`}
          color="yellow"
          trend="up"
        />
        <KPICard
          label="Active Clients"
          value={String(analytics.contracts.filter(c => c.status === 'active').length)}
          sub={`${analytics.contracts.filter(c => c.status === 'at_risk').length} at risk`}
          color="green"
        />
        <KPICard
          label="Route Efficiency"
          value={`${analytics.routeEfficiency}%`}
          sub="$/km per month"
          color={analytics.routeEfficiency > 70 ? 'blue' : 'red'}
        />
        <KPICard
          label="Optimization $" 
          value={`+$${analytics.optimizationOpportunities.reduce((s, o) => s + o.projectedImpact, 0).toLocaleString()}`}
          sub="potential gains/mo"
          color="purple"
        />
      </div>

      {/* Contract Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <span className="text-yellow-400">📋</span> Active Contracts
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {analytics.contracts.filter(c => c.status === 'active' || c.status === 'at_risk').map(contract => (
            <ContractCard key={contract.id} contract={contract} health={analytics.clientHealthScores[contract.name] ?? 0} />
          ))}
        </div>
      </div>

      {/* Quick Revenue Breakdown */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <span className="text-green-400">💵</span> Revenue Breakdown
        </h2>
        <div className="bg-zinc-900/80 rounded-xl border border-white/10 p-4">
          <div className="space-y-3">
            {Object.entries(analytics.revenueByClient).map(([name, revenue]) => {
              const pct = analytics.monthlyRevenue > 0 ? (revenue / analytics.monthlyRevenue) * 100 : 0;
              return (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-300">{name}</span>
                    <span className="text-zinc-400">${revenue.toLocaleString()}/mo</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alerts Summary */}
      {analytics.renewalAlerts.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-red-400 mb-2">⚠️ Renewal Alerts</h3>
          <div className="space-y-1">
            {analytics.renewalAlerts.slice(0, 3).map(alert => (
              <p key={alert.contractId} className="text-sm text-zinc-300">
                <span className={alert.severity === 'urgent' ? 'text-red-400' : 'text-yellow-400'}>
                  {alert.severity === 'urgent' ? '🔴' : '🟡'}
                </span>{' '}
                {alert.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Optimization Tips */}
      {analytics.optimizationOpportunities.length > 0 && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-purple-400 mb-2">💡 Top Opportunities</h3>
          <div className="space-y-2">
            {analytics.optimizationOpportunities.slice(0, 3).map(tip => (
              <div key={tip.id} className="flex justify-between items-center">
                <p className="text-sm text-zinc-300">{tip.title}</p>
                <span className="text-sm font-medium text-green-400">+${tip.projectedImpact}/mo</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client Comparison Table */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <span className="text-blue-400">🔢</span> Client Comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-zinc-400 font-medium">Client</th>
                <th className="text-right py-2 px-3 text-zinc-400 font-medium">Rate</th>
                <th className="text-right py-2 px-3 text-zinc-400 font-medium">Freq</th>
                <th className="text-right py-2 px-3 text-zinc-400 font-medium">Monthly</th>
                <th className="text-center py-2 px-3 text-zinc-400 font-medium">Health</th>
                <th className="text-right py-2 px-3 text-zinc-400 font-medium">$/km</th>
                <th className="text-center py-2 px-3 text-zinc-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {analytics.contracts.map(c => {
                const monthly = Math.round(c.rate * (c.frequency === 'weekly' ? c.daysPerWeek * 4.33 : c.frequency === 'biweekly' ? 2.17 : 1));
                const perKm = c.routeKm > 0 ? (monthly / c.routeKm).toFixed(2) : '—';
                const health = analytics.clientHealthScores[c.name] ?? 0;
                return (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2 px-3 font-medium text-white">{c.name}</td>
                    <td className="py-2 px-3 text-right text-zinc-300">${c.rate}</td>
                    <td className="py-2 px-3 text-right text-zinc-300">{c.frequency === 'weekly' ? `${c.daysPerWeek}x/wk` : c.frequency}</td>
                    <td className="py-2 px-3 text-right text-zinc-200 font-medium">${monthly.toLocaleString()}</td>
                    <td className="py-2 px-3 text-center">
                      <HealthBadge score={health} />
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-400">${perKm}</td>
                    <td className="py-2 px-3 text-center">
                      <StatusBadge status={c.status} />
                    </td>
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

// ── Sub-Components ───────────────────────────────────────────────────────────

function KPICard({ label, value, sub, color, trend }: {
  label: string; value: string; sub: string; color: 'yellow' | 'green' | 'blue' | 'red' | 'purple'; trend?: 'up' | 'down';
}) {
  const colors = {
    yellow: 'border-yellow-400/20 bg-yellow-400/5',
    green: 'border-green-400/20 bg-green-400/5',
    blue: 'border-blue-400/20 bg-blue-400/5',
    red: 'border-red-400/20 bg-red-400/5',
    purple: 'border-purple-400/20 bg-purple-400/5',
  };
  const textColors = {
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    red: 'text-red-400',
    purple: 'text-purple-400',
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs text-zinc-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${textColors[color]} mt-1`}>
        {trend === 'up' && '↗ '}{trend === 'down' && '↘ '}{value}
      </p>
      <p className="text-xs text-zinc-500 mt-1">{sub}</p>
    </div>
  );
}

function ContractCard({ contract, health }: { contract: ReturnType<typeof useContractIntelligence>['contracts'][0]; health: number }) {
  const monthly = Math.round(contract.rate * (contract.frequency === 'weekly' ? contract.daysPerWeek * 4.33 : contract.frequency === 'biweekly' ? 2.17 : 1));
  const isAtRisk = contract.status === 'at_risk';

  return (
    <div className={`rounded-xl border p-4 ${isAtRisk ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 bg-zinc-900/80'}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-white">{contract.name}</h3>
          <p className="text-xs text-zinc-400">
            ${contract.rate}/clean · {contract.frequency === 'weekly' ? `${contract.daysPerWeek}x/week` : contract.frequency}
          </p>
        </div>
        <div className="text-right">
          <HealthBadge score={health} />
          <StatusBadge status={contract.status} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3">
        <div>
          <p className="text-xs text-zinc-500">Monthly</p>
          <p className="text-sm font-semibold text-white">${monthly.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Route</p>
          <p className="text-sm text-zinc-300">{contract.routeKm}km</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Time/Job</p>
          <p className="text-sm text-zinc-300">{contract.avgCleanTime}min</p>
        </div>
      </div>

      {contract.lastPaymentDate && (
        <p className="text-xs text-zinc-500 mt-2 pt-2 border-t border-white/5">
          Last payment: {contract.lastPaymentDate}
          {contract.missedPayments ? (
            <span className="text-red-400 ml-2">⚠ {contract.missedPayments} missed</span>
          ) : null}
        </p>
      )}
    </div>
  );
}

function HealthBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-400 bg-green-400/10 border-green-400/30'
    : score >= 50 ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'
    : 'text-red-400 bg-red-400/10 border-red-400/30';
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium border ${color}`}>
      {score}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    active: { label: 'Active', color: 'text-green-400 bg-green-400/10 border-green-400/30' },
    at_risk: { label: 'At Risk', color: 'text-red-400 bg-red-400/10 border-red-400/30' },
    paused: { label: 'Paused', color: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30' },
    completed: { label: 'Done', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  };
  const c = config[status] ?? config.active;
  return (
    <span className={`inline-block ml-1 px-1.5 py-0.5 rounded text-xs font-medium border ${c.color}`}>
      {c.label}
    </span>
  );
}