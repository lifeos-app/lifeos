/**
 * ClientHealthDashboard — Per-client health scoring with breakdowns,
 * payment consistency, revenue trends, and quick actions.
 */

import type { ContractAnalytics, ClientHealthDetail } from './useContractIntelligence';

export function ClientHealthDashboard({ analytics }: { analytics: ContractAnalytics }) {
  const { contracts, clientHealthDetails } = analytics;

  const sortedDetails = [...clientHealthDetails].sort((a, b) => b.score - a.score);
  const avgScore = clientHealthDetails.length > 0
    ? Math.round(clientHealthDetails.reduce((s, d) => s + d.score, 0) / clientHealthDetails.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Overall Health Score */}
      <div className="bg-zinc-900/80 rounded-xl border border-white/10 p-6 text-center">
        <p className="text-sm text-zinc-400 uppercase tracking-wider mb-2">Portfolio Health Score</p>
        <div className="relative inline-flex items-center justify-center">
          <span className={`text-6xl font-bold ${avgScore >= 80 ? 'text-green-400' : avgScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {avgScore}
          </span>
          <span className="text-2xl text-zinc-600 self-end mb-1">/100</span>
        </div>
        <p className="text-sm text-zinc-500 mt-2">
          {avgScore >= 80 ? 'Strong — portfolio is healthy' : avgScore >= 50 ? 'Fair — some areas need attention' : 'At risk — take action now'}
        </p>
      </div>

      {/* Per-Client Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {sortedDetails.map(detail => (
          <ClientHealthCard key={detail.contractId} detail={detail} contracts={contracts} />
        ))}
      </div>

      {/* Risk Summary */}
      <div className="bg-zinc-900/80 rounded-xl border border-white/10 p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">⚠️ Risk Indicators</h3>
        {sortedDetails.some(d => d.factors.riskFlags.length > 0) ? (
          <div className="space-y-2">
            {sortedDetails.filter(d => d.factors.riskFlags.length > 0).map(detail => (
              <div key={detail.contractId} className="bg-red-500/5 rounded-lg p-3">
                <p className="text-sm font-medium text-red-400">{detail.name}</p>
                <ul className="mt-1 space-y-1">
                  {detail.factors.riskFlags.map((flag, i) => (
                    <li key={i} className="text-xs text-zinc-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No risk indicators detected. All clients are performing well.</p>
        )}
      </div>
    </div>
  );
}

function ClientHealthCard({ detail, contracts }: { detail: ClientHealthDetail; contracts: ContractAnalytics['contracts'] }) {
  const contract = contracts.find(c => c.id === detail.contractId);
  const scoreColor = detail.score >= 80 ? 'text-green-400' : detail.score >= 50 ? 'text-yellow-400' : 'text-red-400';
  const ringColor = detail.score >= 80 ? 'stroke-green-400' : detail.score >= 50 ? 'stroke-yellow-400' : 'stroke-red-400';

  const trendIcon = detail.factors.revenueTrend === 'growing' ? '📈' : detail.factors.revenueTrend === 'declining' ? '📉' : '➡️';
  const trendColor = detail.factors.revenueTrend === 'growing' ? 'text-green-400' : detail.factors.revenueTrend === 'declining' ? 'text-red-400' : 'text-zinc-400';

  return (
    <div className="bg-zinc-900/80 rounded-xl border border-white/10 p-5">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{detail.name}</h3>
          {contract && (
            <p className="text-xs text-zinc-400">
              ${contract.rate}/clean · {contract.frequency === 'weekly' ? `${contract.daysPerWeek}x/week` : contract.frequency}
            </p>
          )}
        </div>
        <div className="text-center">
          <div className="relative w-14 h-14">
            <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
              <circle cx="18" cy="18" r="16" fill="none" className="stroke-zinc-800" strokeWidth="3" />
              <circle cx="18" cy="18" r="16" fill="none" className={ringColor} strokeWidth="3"
                strokeDasharray={`${detail.score} 100`} strokeLinecap="round" />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${scoreColor}`}>
              {detail.score}
            </span>
          </div>
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="space-y-2 mb-4">
        <FactorBar label="Payment Consistency" value={detail.factors.paymentConsistency} />
        <FactorBar label="Frequency Adherence" value={detail.factors.frequencyAdherence} />
        <FactorBar label="Revenue Trend" value={detail.factors.revenueTrendScore} />
        <FactorBar label="Renewal Security" value={detail.factors.daysUntilRenewal > 90 ? 100 : detail.factors.daysUntilRenewal > 30 ? 70 : 30} />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4 pt-3 border-t border-white/5">
        <div>
          <p className="text-xs text-zinc-500">Revenue Trend</p>
          <p className={`text-sm font-medium ${trendColor}`}>
            {trendIcon} {detail.factors.revenueTrend.charAt(0).toUpperCase() + detail.factors.revenueTrend.slice(1)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Days to Renewal</p>
          <p className="text-sm font-medium text-zinc-300">
            {detail.factors.daysUntilRenewal > 365 ? 'N/A' : `${detail.factors.daysUntilRenewal}d`}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Risk Flags</p>
          <p className="text-sm font-medium">
            {detail.factors.riskFlags.length === 0 ? (
              <span className="text-green-400">None</span>
            ) : (
              <span className="text-red-400">{detail.factors.riskFlags.length}</span>
            )}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors">
          📧 Send Reminder
        </button>
        <button className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
          📅 Schedule Review
        </button>
        <button className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors">
          💲 Adjust Rate
        </button>
      </div>
    </div>
  );
}

function FactorBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? 'bg-green-400' : value >= 50 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-500">{value}%</span>
      </div>
      <div className="w-full bg-zinc-800 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}