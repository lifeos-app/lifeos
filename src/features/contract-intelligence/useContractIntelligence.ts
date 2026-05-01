/**
 * useContractIntelligence — Core business intelligence hook for TCS
 *
 * Pulls data from useFinanceStore, auto-detects contracts from transaction patterns,
 * computes analytics: health scores, revenue projections, cash flow, alerts.
 */

import { useMemo } from 'react';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { TCS_CONFIG, VENUES, ROUTE_KM } from '../../lib/tcs-config';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Contract {
  id: string;
  name: string;
  rate: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  daysPerWeek: number;
  startDate: string;
  endDate?: string;
  status: 'active' | 'at_risk' | 'paused' | 'completed';
  routeKm: number;
  avgCleanTime: number; // minutes
  lastPaymentDate?: string;
  missedPayments?: number;
}

export interface CashFlowEntry {
  date: string;
  income: number;
  expenses: number;
  net: number;
  cumulativeNet: number;
  label: string;
}

export interface RenewalAlert {
  contractId: string;
  contractName: string;
  daysUntil: number;
  severity: 'urgent' | 'warning' | 'info';
  message: string;
}

export interface OptimizationTip {
  id: string;
  type: 'rate_increase' | 'route_optimization' | 'new_client' | 'frequency_increase' | 'cost_reduction';
  title: string;
  description: string;
  projectedImpact: number; // monthly dollars
  effort: 'low' | 'medium' | 'high';
}

export interface RevenueProjection {
  period: string;
  days: number;
  bestCase: number;
  expected: number;
  worstCase: number;
  breakdown: Record<string, number>;
}

export interface ClientHealthDetail {
  contractId: string;
  name: string;
  score: number; // 0-100
  factors: {
    paymentConsistency: number; // 0-100
    frequencyAdherence: number; // 0-100
    revenueTrend: 'growing' | 'stable' | 'declining';
    revenueTrendScore: number; // 0-100
    daysUntilRenewal: number;
    riskFlags: string[];
  };
}

export interface ContractAnalytics {
  contracts: Contract[];
  monthlyRevenue: number;
  projectedAnnual: number;
  revenueByClient: Record<string, number>;
  clientHealthScores: Record<string, number>;
  clientHealthDetails: ClientHealthDetail[];
  cashFlowForecast: CashFlowEntry[];
  renewalAlerts: RenewalAlert[];
  optimizationOpportunities: OptimizationTip[];
  routeEfficiency: number;
  revenueProjections: RevenueProjection[];
}

// ── Helper ──────────────────────────────────────────────────────────────────

const MS_DAY = 86400000;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function getMonthStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Derived contracts from TCS config + finance data ────────────────────────

function deriveContracts(
  transactions: { type: string; amount: number; date: string; title?: string; business_id?: string; client_id?: string }[],
  clients: { id: string; name: string; rate?: number | null; is_active: boolean }[],
): Contract[] {
  // Build contracts from TCS config as baseline
  const configContracts: Contract[] = VENUES.map(v => {
    const freq = v.frequency.includes('4x') ? 'weekly' as const
      : v.frequency.includes('3x') ? 'weekly' as const
      : v.frequency.includes('2x') ? 'biweekly' as const
      : 'monthly' as const;
    const daysPerWeek = v.frequency.includes('4x') ? 4
      : v.frequency.includes('3x') ? 3
      : v.frequency.includes('2x') ? 2
      : 1;

    // Find recent payment data for this venue
    const venueTxns = transactions.filter(t =>
      t.type === 'income' && (
        t.title?.toLowerCase().includes(v.name.toLowerCase()) ||
        t.client_id === v.id
      )
    ).sort((a, b) => b.date.localeCompare(a.date));

    const lastPaymentDate = venueTxns[0]?.date;
    const missedPayments = detectMissedPayments(venueTxns, v.cleansPerMonth, daysAgo(0));

    // Determine status
    let status: Contract['status'] = 'active';
    if (missedPayments >= 2) status = 'at_risk';
    else if (missedPayments >= 1) status = 'at_risk';

    // Proportional route km (approx: total route / number of venues for full run,
    // plus base travel from home)
    const proportKm = Math.round(ROUTE_KM / VENUES.length);

    return {
      id: v.id,
      name: v.name,
      rate: v.rate,
      frequency: freq,
      daysPerWeek,
      startDate: '2025-01-01', // TCS start
      status,
      routeKm: proportKm,
      avgCleanTime: v.rate >= 160 ? 180 : 150, // Estimate based on rate
      lastPaymentDate,
      missedPayments,
    };
  });

  // Also add any client from the database not in config
  const coveredIds = new Set(configContracts.map(c => c.id));
  const extraContracts: Contract[] = clients
    .filter(c => c.is_active && !coveredIds.has(c.id))
    .map(c => {
      const clientIncome = transactions.filter(t =>
        t.type === 'income' && (t.client_id === c.id || t.title?.toLowerCase().includes(c.name.toLowerCase()))
      );
      const monthlyTotal = clientIncome
        .filter(t => t.date >= daysAgo(30))
        .reduce((s, t) => s + t.amount, 0);

      return {
        id: c.id,
        name: c.name,
        rate: c.rate || (monthlyTotal > 0 ? Math.round(monthlyTotal / 4) : 0),
        frequency: 'weekly',
        daysPerWeek: 1,
        startDate: daysAgo(90),
        status: 'active',
        routeKm: 30,
        avgCleanTime: 120,
        lastPaymentDate: clientIncome[0]?.date,
        missedPayments: 0,
      };
    });

  return [...configContracts, ...extraContracts];
}

function detectMissedPayments(
  txns: { date: string; amount: number }[],
  expectedPerMonth: number,
  _today: string,
): number {
  if (txns.length === 0) return expectedPerMonth > 0 ? 1 : 0;

  // Count payments in the last 30 days
  const thirtyDaysAgo = daysAgo(30);
  const recentPayments = txns.filter(t => t.date >= thirtyDaysAgo).length;

  // If significantly fewer payments than expected, flag
  const ratio = recentPayments / expectedPerMonth;
  if (ratio < 0.5) return Math.max(0, Math.ceil(expectedPerMonth - recentPayments));
  if (ratio < 0.75) return 1;
  return 0;
}

// ── Health Score Calculator ─────────────────────────────────────────────────

function calculateClientHealth(
  contract: Contract,
  transactions: { type: string; amount: number; date: string; title?: string; client_id?: string }[],
): ClientHealthDetail {
  const venueTxns = transactions.filter(t =>
    t.type === 'income' && (
      t.title?.toLowerCase().includes(contract.name.toLowerCase()) ||
      t.client_id === contract.id
    )
  ).sort((a, b) => b.date.localeCompare(a.date));

  // 1. Payment Consistency (0-100)
  const last30 = venueTxns.filter(t => t.date >= daysAgo(30));
  const expectedCleansPerMonth = contract.frequency === 'weekly'
    ? contract.daysPerWeek * 4
    : contract.frequency === 'biweekly'
      ? 2
      : 1;
  const paymentRatio = expectedCleansPerMonth > 0 ? last30.length / expectedCleansPerMonth : 0;
  const paymentConsistency = Math.min(100, Math.round(paymentRatio * 100));

  // 2. Frequency Adherence (0-100)
  const frequencyAdherence = contract.missedPayments === 0 ? 100
    : contract.missedPayments === 1 ? 65
    : contract.missedPayments >= 3 ? 20
    : 40;

  // 3. Revenue Trend
  const last60 = venueTxns.filter(t => t.date >= daysAgo(60) && t.date < daysAgo(30));
  const revenueTrend: 'growing' | 'stable' | 'declining'
    = last30.reduce((s, t) => s + t.amount, 0) > last60.reduce((s, t) => s + t.amount, 0) * 1.1 ? 'growing'
    : last30.reduce((s, t) => s + t.amount, 0) < last60.reduce((s, t) => s + t.amount, 0) * 0.9 ? 'declining'
    : 'stable';

  const revenueTrendScore = revenueTrend === 'growing' ? 90 : revenueTrend === 'stable' ? 70 : 40;

  // 4. Risk Flags
  const riskFlags: string[] = [];
  if (contract.missedPayments && contract.missedPayments >= 2) riskFlags.push('Multiple missed payments');
  if (paymentConsistency < 60) riskFlags.push('Inconsistent payment pattern');
  if (!contract.lastPaymentDate) riskFlags.push('No recent payment recorded');
  if (contract.lastPaymentDate && contract.lastPaymentDate < daysAgo(14)) riskFlags.push('No payment in 14+ days');

  // 5. Days until renewal (assume 12-month contracts for TCS clients)
  const startDate = new Date(contract.startDate);
  const nextRenewal = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
  const daysUntilRenewal = Math.max(0, Math.round((nextRenewal.getTime() - Date.now()) / MS_DAY));

  // 6. Composite score (weighted average)
  const score = Math.round(
    paymentConsistency * 0.35 +
    frequencyAdherence * 0.30 +
    revenueTrendScore * 0.20 +
    (daysUntilRenewal > 90 ? 100 : daysUntilRenewal > 30 ? 70 : 30) * 0.15
  );

  return {
    contractId: contract.id,
    name: contract.name,
    score: Math.min(100, Math.max(0, score)),
    factors: {
      paymentConsistency,
      frequencyAdherence,
      revenueTrend,
      revenueTrendScore,
      daysUntilRenewal,
      riskFlags,
    },
  };
}

// ── Cash Flow Forecast ──────────────────────────────────────────────────────

function generateCashFlow(
  contracts: Contract[],
  transactions: { type: string; amount: number; date: string }[],
  bills: { amount: number; due_date?: string; status: string }[],
): CashFlowEntry[] {
  const entries: CashFlowEntry[] = [];

  // Past 30 days of actual data (weekly buckets)
  for (let w = -4; w < 0; w++) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() + w * 7);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = addDays(weekStartStr, 7);
    const weekLabel = `Week ${w + 5}`;

    const weekIncome = transactions
      .filter(t => t.type === 'income' && t.date >= weekStartStr && t.date < weekEndStr)
      .reduce((s, t) => s + t.amount, 0);
    const weekExpenses = transactions
      .filter(t => t.type === 'expense' && t.date >= weekStartStr && t.date < weekEndStr)
      .reduce((s, t) => s + t.amount, 0);

    entries.push({
      date: weekStartStr,
      income: weekIncome,
      expenses: weekExpenses,
      net: weekIncome - weekExpenses,
      cumulativeNet: 0,
      label: weekLabel,
    });
  }

  // Next 12 weeks projected
  const weeklyContractRevenue = contracts
    .filter(c => c.status === 'active' || c.status === 'at_risk')
    .reduce((s, c) => {
      const monthlyRev = c.rate * contractCleansPerMonth(c);
      return s + monthlyRev / 4;
    }, 0);

  const avgWeeklyExpenses = transactions
    .filter(t => t.type === 'expense' && t.date >= daysAgo(28))
    .reduce((s, t) => s + t.amount, 0) / 4;

  const upcomingBills = bills
    .filter(b => b.status === 'pending')
    .reduce((s, b) => s + b.amount, 0) / 4; // Rough weekly bill cost

  let cumulativeNet = entries.length > 0
    ? entries.reduce((s, e) => s + e.net, 0)
    : 0;

  for (let w = 0; w < 12; w++) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() + w * 7);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekLabel = `Week +${w + 1}`;

    const income = Math.round(weeklyContractRevenue);
    const expenses = Math.round(avgWeeklyExpenses + upcomingBills);
    const net = income - expenses;
    cumulativeNet += net;

    entries.push({
      date: weekStartStr,
      income,
      expenses,
      net,
      cumulativeNet,
      label: weekLabel,
    });
  }

  return entries;
}

function contractCleansPerMonth(c: Contract): number {
  if (c.frequency === 'weekly') return c.daysPerWeek * 4.33;
  if (c.frequency === 'biweekly') return 2.17;
  return 1;
}

// ── Revenue Projections ─────────────────────────────────────────────────────

function computeRevenueProjections(contracts: Contract[]): RevenueProjection[] {
  const periods: { label: string; days: number }[] = [
    { label: '30 days', days: 30 },
    { label: '60 days', days: 60 },
    { label: '90 days', days: 90 },
    { label: '180 days', days: 180 },
  ];

  const activeContracts = contracts.filter(c => c.status === 'active' || c.status === 'at_risk');

  return periods.map(({ label, days }) => {
    const months = days / 30;
    const breakdown: Record<string, number> = {};
    let expected = 0;

    for (const c of activeContracts) {
      const monthlyRev = c.rate * contractCleansPerMonth(c);
      const projected = monthlyRev * months;
      breakdown[c.name] = Math.round(projected);
      expected += projected;
    }

    // Best case: 95% collection rate (current trajectory)
    // Worst case: 70% (some clients reduce frequency, 1 pauses)
    const bestCase = Math.round(expected * 0.95);
    const worstCase = Math.round(expected * 0.70);

    return {
      period: label,
      days,
      bestCase,
      expected: Math.round(expected),
      worstCase,
      breakdown,
    };
  });
}

// ── Optimization Opportunities ──────────────────────────────────────────────

function generateOptimizations(contracts: Contract[]): OptimizationTip[] {
  const tips: OptimizationTip[] = [];

  // Check for rate increase opportunities
  for (const c of contracts.filter(c => c.status === 'active')) {
    if (c.rate < 170) {
      const increasePct = c.rate < 155 ? 15 : 10;
      const newRate = c.rate * (1 + increasePct / 100);
      const monthlyGain = (newRate - c.rate) * contractCleansPerMonth(c);
      tips.push({
        id: `rate-${c.id}`,
        type: 'rate_increase',
        title: `Raise ${c.name} rate to $${Math.round(newRate)}`,
        description: `A ${increasePct}% increase from $${c.rate} to $${Math.round(newRate)} per clean would earn $${Math.round(monthlyGain)}/month more.`,
        projectedImpact: Math.round(monthlyGain),
        effort: 'medium',
      });
    }
  }

  // Route efficiency suggestion
  const totalRouteKmPerClean = contracts.reduce((s, c) => s + c.routeKm, 0);
  if (totalRouteKmPerClean > 100) {
    const savedKm = Math.round(totalRouteKmPerClean * 0.15);
    const savedDollars = Math.round(savedKm * TCS_CONFIG.atoKmRate * 4);
    tips.push({
      id: 'route-opt',
      type: 'route_optimization',
      title: 'Optimize route sequencing',
      description: `Reordering your route could save ~${savedKm}km per run, saving $${savedDollars}/month in ATO deductions and fuel.`,
      projectedImpact: savedDollars,
      effort: 'low',
    });
  }

  // New client opportunity
  const currentMonthlyRev = contracts
    .filter(c => c.status === 'active')
    .reduce((s, c) => s + c.rate * contractCleansPerMonth(c), 0);
  if (currentMonthlyRev < TCS_CONFIG.monthlyCleaningTarget) {
    const gap = TCS_CONFIG.monthlyCleaningTarget - currentMonthlyRev;
    const newClientRate = 160;
    const cleansNeeded = Math.ceil(gap / newClientRate);
    tips.push({
      id: 'new-client',
      type: 'new_client',
      title: 'Add a new cleaning client',
      description: `You need ~${cleansNeeded} additional cleans/month at $${newClientRate} to hit your $${TCS_CONFIG.monthlyCleaningTarget}/month target.`,
      projectedImpact: Math.round(newClientRate * Math.min(cleansNeeded, 8)),
      effort: 'high',
    });
  }

  // Frequency increase opportunity
  for (const c of contracts.filter(c => c.status === 'active' && c.daysPerWeek < 5)) {
    const extraDay = c.daysPerWeek === 2 ? 2 : 1;
    const monthlyGain = c.rate * extraDay * 4.33;
    if (monthlyGain > 300) {
      tips.push({
        id: `freq-${c.id}`,
        type: 'frequency_increase',
        title: `Increase ${c.name} to ${c.daysPerWeek + extraDay}x/week`,
        description: `Adding ${extraDay} more clean(s) per week for ${c.name} would add $${Math.round(monthlyGain)}/month.`,
        projectedImpact: Math.round(monthlyGain),
        effort: 'medium',
      });
    }
  }

  return tips.sort((a, b) => b.projectedImpact - a.projectedImpact);
}

// ── Renewal Alerts ──────────────────────────────────────────────────────────

function generateRenewalAlerts(contracts: Contract[]): RenewalAlert[] {
  const alerts: RenewalAlert[] = [];

  for (const c of contracts) {
    const startDate = new Date(c.startDate);
    const nextRenewal = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());

    // If renewal already past, project to next year
    let renewal = nextRenewal;
    if (renewal < new Date()) {
      renewal = new Date(renewal.getFullYear() + 1, renewal.getMonth(), renewal.getDate());
    }

    const daysUntil = Math.round((renewal.getTime() - Date.now()) / MS_DAY);

    let severity: RenewalAlert['severity'] = 'info';
    let message: string;

    if (daysUntil <= 30) {
      severity = 'urgent';
      message = `${c.name} contract renews in ${daysUntil} days. Review terms and negotiate now.`;
    } else if (daysUntil <= 60) {
      severity = 'warning';
      message = `${c.name} contract renews in ${daysUntil} days. Start preparing renewal terms.`;
    } else if (daysUntil <= 90) {
      severity = 'info';
      message = `${c.name} contract renews in ${daysUntil} days. Mark your calendar.`;
    } else {
      continue; // No alert needed
    }

    alerts.push({
      contractId: c.id,
      contractName: c.name,
      daysUntil,
      severity,
      message,
    });
  }

  return alerts.sort((a, b) => a.daysUntil - b.daysUntil);
}

// ── Route Efficiency ────────────────────────────────────────────────────────

function computeRouteEfficiency(contracts: Contract[]): number {
  const activeContracts = contracts.filter(c => c.status === 'active');
  if (activeContracts.length === 0) return 0;

  const totalRevenue = activeContracts.reduce((s, c) => s + c.rate * contractCleansPerMonth(c), 0);
  const totalKm = ROUTE_KM;

  // Revenue per km per month — higher is better
  // Scale: 20+ $/km is excellent, 10 is ok, <5 is poor
  const revenuePerKm = totalRevenue / totalKm;
  // Normalize to 0-100 where 20 = 100
  return Math.min(100, Math.round(revenuePerKm * 5));
}

// ── Main Hook ───────────────────────────────────────────────────────────────

export function useContractIntelligence(): ContractAnalytics {
  const { transactions, clients, bills, income, expenses } = useFinanceStore();

  return useMemo(() => {
    // 1. Derive contracts
    const contracts = deriveContracts(transactions, clients);

    // 2. Revenue calculations
    const monthlyRevenue = contracts
      .filter(c => c.status === 'active' || c.status === 'at_risk')
      .reduce((s, c) => s + c.rate * contractCleansPerMonth(c), 0);

    const projectedAnnual = Math.round(monthlyRevenue * 12);

    // 3. Revenue by client
    const revenueByClient: Record<string, number> = {};
    for (const c of contracts) {
      if (c.status === 'active' || c.status === 'at_risk') {
        revenueByClient[c.name] = Math.round(c.rate * contractCleansPerMonth(c));
      }
    }

    // 4. Client health scores
    const clientHealthDetails = contracts.map(c => calculateClientHealth(c, transactions));
    const clientHealthScores: Record<string, number> = {};
    for (const detail of clientHealthDetails) {
      clientHealthScores[detail.name] = detail.score;
    }

    // 5. Cash flow forecast
    const cashFlowForecast = generateCashFlow(contracts, transactions, bills);

    // 6. Revenue projections
    const revenueProjections = computeRevenueProjections(contracts);

    // 7. Optimization opportunities
    const optimizationOpportunities = generateOptimizations(contracts);

    // 8. Renewal alerts
    const renewalAlerts = generateRenewalAlerts(contracts);

    // 9. Route efficiency
    const routeEfficiency = computeRouteEfficiency(contracts);

    return {
      contracts,
      monthlyRevenue: Math.round(monthlyRevenue),
      projectedAnnual,
      revenueByClient,
      clientHealthScores,
      clientHealthDetails,
      cashFlowForecast,
      renewalAlerts,
      optimizationOpportunities,
      routeEfficiency,
      revenueProjections,
    };
  }, [transactions, clients, bills, income, expenses]);
}

/** Calculate projected revenue for a modified contract set */
export function calculateScenarioRevenue(
  contracts: Contract[],
  modifications: { contractId: string; newRate?: number; newDaysPerWeek?: number }[],
  additions: { name: string; rate: number; daysPerWeek: number; routeKm: number }[],
  removals: string[],
): {
  currentMonthly: number;
  projectedMonthly: number;
  difference: number;
  differenceAnnual: number;
} {
  const modifiedContracts = contracts.map(c => {
    const mod = modifications.find(m => m.contractId === c.id);
    if (mod) {
      return {
        ...c,
        rate: mod.newRate ?? c.rate,
        daysPerWeek: mod.newDaysPerWeek ?? c.daysPerWeek,
      };
    }
    return c;
  }).filter(c => !removals.includes(c.id));

  for (const add of additions) {
    modifiedContracts.push({
      id: `new-${add.name}`,
      name: add.name,
      rate: add.rate,
      frequency: 'weekly',
      daysPerWeek: add.daysPerWeek,
      startDate: new Date().toISOString().split('T')[0],
      status: 'active',
      routeKm: add.routeKm,
      avgCleanTime: 150,
    });
  }

  const currentMonthly = contracts
    .filter(c => c.status === 'active' || c.status === 'at_risk')
    .reduce((s, c) => s + c.rate * contractCleansPerMonth(c), 0);

  const projectedMonthly = modifiedContracts
    .filter(c => c.status === 'active' || c.status === 'at_risk')
    .reduce((s, c) => s + c.rate * contractCleansPerMonth(c), 0);

  return {
    currentMonthly: Math.round(currentMonthly),
    projectedMonthly: Math.round(projectedMonthly),
    difference: Math.round(projectedMonthly - currentMonthly),
    differenceAnnual: Math.round((projectedMonthly - currentMonthly) * 12),
  };
}

export { contractCleansPerMonth };