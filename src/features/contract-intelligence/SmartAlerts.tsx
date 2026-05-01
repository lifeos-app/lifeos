/**
 * SmartAlerts — Proactive business alerts with priority coloring
 *
 * Renewal warnings, revenue anomalies, optimization opportunities.
 */

import type { ContractAnalytics } from './useContractIntelligence';

export function SmartAlerts({ analytics }: { analytics: ContractAnalytics }) {
  const allAlerts = buildAlerts(analytics);

  const urgent = allAlerts.filter(a => a.priority === 'urgent');
  const warning = allAlerts.filter(a => a.priority === 'warning');
  const info = allAlerts.filter(a => a.priority === 'info');

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-red-400">{urgent.length}</p>
          <p className="text-xs text-zinc-400 mt-1">Urgent</p>
        </div>
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-yellow-400">{warning.length}</p>
          <p className="text-xs text-zinc-400 mt-1">Warnings</p>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">{info.length}</p>
          <p className="text-xs text-zinc-400 mt-1">Opportunities</p>
        </div>
      </div>

      {/* Urgent */}
      {urgent.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-1.5">
            🔴 Urgent — Action Required
          </h3>
          <div className="space-y-2">
            {urgent.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Warning */}
      {warning.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-1.5">
            🟡 Warnings — Monitor Closely
          </h3>
          <div className="space-y-2">
            {warning.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Info / Opportunities */}
      {info.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-1.5">
            💡 Opportunities — Grow Your Revenue
          </h3>
          <div className="space-y-2">
            {info.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {allAlerts.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-lg font-medium">All clear!</p>
          <p className="text-sm mt-1">No alerts right now. Your business is running smoothly.</p>
        </div>
      )}
    </div>
  );
}

interface Alert {
  id: string;
  priority: 'urgent' | 'warning' | 'info';
  category: 'renewal' | 'revenue' | 'optimization' | 'anomaly' | 'efficiency';
  title: string;
  message: string;
  action?: string;
  impact?: number;
}

function buildAlerts(analytics: ContractAnalytics): Alert[] {
  const alerts: Alert[] = [];

  // ── Renewal Alerts ──
  for (const renewal of analytics.renewalAlerts) {
    alerts.push({
      id: `renewal-${renewal.contractId}`,
      priority: renewal.severity === 'urgent' ? 'urgent' : renewal.severity === 'warning' ? 'warning' : 'info',
      category: 'renewal',
      title: `${renewal.contractName} Renewal ${renewal.severity === 'urgent' ? 'Imminent' : 'Approaching'}`,
      message: renewal.message,
      action: renewal.severity === 'urgent' ? 'Schedule contract review immediately' : 'Plan renewal discussion',
      impact: renewal.severity === 'urgent' ? undefined : undefined,
    });
  }

  // ── Revenue Anomaly Alerts ──
  const monthlyTarget = 5500; // From TCS config
  if (analytics.monthlyRevenue < monthlyTarget * 0.7) {
    alerts.push({
      id: 'revenue-low',
      priority: 'urgent',
      category: 'revenue',
      title: 'Revenue significantly below target',
      message: `Monthly revenue of $${analytics.monthlyRevenue.toLocaleString()} is ${Math.round((1 - analytics.monthlyRevenue / monthlyTarget) * 100)}% below your $${monthlyTarget.toLocaleString()} target.`,
      action: 'Review client contracts and fill gaps',
    });
  } else if (analytics.monthlyRevenue < monthlyTarget * 0.9) {
    alerts.push({
      id: 'revenue-below-target',
      priority: 'warning',
      category: 'revenue',
      title: 'Revenue slightly below target',
      message: `Monthly revenue of $${analytics.monthlyRevenue.toLocaleString()} is ${Math.round((1 - analytics.monthlyRevenue / monthlyTarget) * 100)}% below your $${monthlyTarget.toLocaleString()} target.`,
      action: 'Consider rate adjustments or adding a client',
    });
  }

  // ── At-Risk Client Alerts ──
  const atRiskClients = analytics.contracts.filter(c => c.status === 'at_risk');
  for (const client of atRiskClients) {
    const health = analytics.clientHealthScores[client.name] ?? 0;
    alerts.push({
      id: `at-risk-${client.id}`,
      priority: health < 50 ? 'urgent' : 'warning',
      category: 'anomaly',
      title: `${client.name} is at risk`,
      message: `Health score: ${health}/100. ${client.missedPayments ? `${client.missedPayments} missed payment(s). ` : ''}Review this client immediately.`,
      action: 'Send a reminder and schedule a check-in',
    });
  }

  // ── Revenue Drop Detection ──
  const proj30 = analytics.revenueProjections[0];
  if (proj30) {
    const monthlyProj = proj30.expected * (30 / proj30.days); // Normalize
    if (monthlyProj < analytics.monthlyRevenue * 0.85) {
      alerts.push({
        id: 'revenue-drop',
        priority: 'warning',
        category: 'revenue',
        title: 'Revenue projection declining',
        message: `30-day projection of $${proj30.expected.toLocaleString()} is below current trajectory. Revenue may be slowing.`,
        action: 'Review payment schedules and client commitments',
      });
    }
  }

  // ── Optimization Opportunities ──
  for (const tip of analytics.optimizationOpportunities.slice(0, 4)) {
    alerts.push({
      id: `opt-${tip.id}`,
      priority: 'info',
      category: 'optimization',
      title: tip.title,
      message: tip.description,
      action: tip.effort === 'low' ? 'Quick win — do this today' : tip.effort === 'medium' ? 'Plan this for the week' : 'Plan for the quarter',
      impact: tip.projectedImpact,
    });
  }

  // ── Route Efficiency ──
  if (analytics.routeEfficiency < 50) {
    alerts.push({
      id: 'route-efficiency',
      priority: 'warning',
      category: 'efficiency',
      title: 'Route efficiency is low',
      message: `Route efficiency score of ${analytics.routeEfficiency}% means you're earning below what your km investment should yield. Consider route optimization.`,
      action: 'Review route order and combine trips',
    });
  }

  // ── Single Client Dependency ──
  const clientRevenues = Object.values(analytics.revenueByClient);
  const maxClientRevenue = Math.max(...clientRevenues, 0);
  if (maxClientRevenue > 0 && analytics.monthlyRevenue > 0) {
    const maxPct = (maxClientRevenue / analytics.monthlyRevenue) * 100;
    if (maxPct > 60) {
      const maxClientName = Object.entries(analytics.revenueByClient).find(([_, v]) => v === maxClientRevenue)?.[0] ?? 'Unknown';
      alerts.push({
        id: 'single-dependency',
        priority: 'warning',
        category: 'anomaly',
        title: 'High client concentration risk',
        message: `${maxClientName} represents ${maxPct.toFixed(0)}% of your monthly revenue. Losing them would be devastating.`,
        action: 'Diversify — aim to acquire new clients to reduce dependency',
      });
    }
  }

  // ── "You could earn Y more" alerts ──
  const totalOptImpact = analytics.optimizationOpportunities.reduce((s, o) => s + o.projectedImpact, 0);
  if (totalOptImpact > 0) {
    alerts.push({
      id: 'total-opportunity',
      priority: 'info',
      category: 'optimization',
      title: `You could earn $${totalOptImpact.toLocaleString()} more per month`,
      message: `Combined optimization opportunities could add $${totalOptImpact.toLocaleString()}/mo ($${(totalOptImpact * 12).toLocaleString()}/yr) to your revenue.`,
      action: 'Review the What If scenarios tab',
    });
  }

  return alerts;
}

function AlertCard({ alert }: { alert: Alert }) {
  const priorityStyles = {
    urgent: 'border-red-500/30 bg-red-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    info: 'border-blue-500/30 bg-blue-500/5',
  };
  const priorityColors = {
    urgent: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400',
  };

  const categoryIcons: Record<string, string> = {
    renewal: '📅',
    revenue: '💵',
    optimization: '🚀',
    anomaly: '⚠️',
    efficiency: '🗺️',
  };

  return (
    <div className={`rounded-xl border p-4 ${priorityStyles[alert.priority]}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0">{categoryIcons[alert.category] ?? '🔔'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={`text-sm font-semibold ${priorityColors[alert.priority]}`}>{alert.title}</h4>
            {alert.impact && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 shrink-0`}>
                +${alert.impact}/mo
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-300 mt-1">{alert.message}</p>
          {alert.action && (
            <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
              <span className="text-zinc-400">→</span> {alert.action}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}