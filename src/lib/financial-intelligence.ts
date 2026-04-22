/**
 * financial-intelligence.ts — Financial Intelligence Engine for LifeOS
 *
 * Analyses financial data to surface real insights:
 * 1. Spending anomaly detection (compare this month vs rolling 3-month average)
 * 2. Income forecasting (linear regression on monthly income)
 * 3. Category-level spending trends
 *
 * Output: FinancialInsight[] surfaced in DashboardFinancialPulse
 */

import type { IncomeEntry, ExpenseEntry } from '../types/database';

// ─── Types ──────────────────────────────────────────

export type FinancialInsightType =
  | 'spending_anomaly'    // Spending in a category is significantly above/below average
  | 'income_forecast'     // Predicted income for this month or next
  | 'savings_opportunity' // Category where cutting 10% would save notable amount
  | 'trend_alert';        // Overall trend direction (improving/declining)

export interface FinancialInsight {
  id: string;
  type: FinancialInsightType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'success';
  data: Record<string, number | string | boolean>;
  timestamp: string;
}

export interface FinancialInput {
  income: IncomeEntry[];
  expenses: ExpenseEntry[];
  now?: Date;
}

// ─── Constants ──────────────────────────────────────

const INSIGHT_ID_PREFIX = 'fi_';
const ANOMALY_THRESHOLD = 0.35;    // 35% deviation from average = anomaly
const MIN_MONTHS_FOR_TREND = 2;     // Need at least 2 months of data
const FORECAST_CONFIDENCE_MIN = 0.5; // Minimum confidence to show forecast

// ─── Helpers ────────────────────────────────────────

function genId(): string {
  return `${INSIGHT_ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "2026-04"
}

function thisMonthStr(now: Date): string {
  return now.toISOString().slice(0, 7);
}

function lastMonthStr(now: Date): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

/** Get the N previous month keys as YYYY-MM */
function prevMonths(now: Date, count: number): string[] {
  const months: string[] = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

/** Simple linear regression on y-values, returns slope + intercept */
function linearRegression(ys: number[]): { slope: number; intercept: number; r2: number } {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0 };

  const xs = ys.map((_, i) => i); // x = 0, 1, 2, ...
  const sumX = xs.reduce((s, x) => s + x, 0);
  const sumY = ys.reduce((s, y) => s + y, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumXX = xs.reduce((s, x) => s + x * x, 0);

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const meanY = sumY / n;
  const ssTot = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - (slope * i + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, r2 };
}

// ─── Analysis Functions ──────────────────────────────

/**
 * Detect spending anomalies per category.
 * Compares this month's spending in each category against the
 * rolling 3-month average for that category.
 */
function detectSpendingAnomalies(input: FinancialInput): FinancialInsight[] {
  const now = input.now || new Date();
  const thisMonth = thisMonthStr(now);
  const prev3 = prevMonths(now, 3);
  const insights: FinancialInsight[] = [];

  // Group expenses by category
  const thisMonthByCategory: Record<string, number> = {};
  const prevByCategory: Record<string, Record<string, number>> = {};

  for (const exp of input.expenses) {
    const mk = monthKey(exp.date);
    const cat = (exp as Record<string, unknown>).category as string || 'uncategorised';

    if (mk === thisMonth) {
      thisMonthByCategory[cat] = (thisMonthByCategory[cat] || 0) + exp.amount;
    } else if (prev3.includes(mk)) {
      if (!prevByCategory[mk]) prevByCategory[mk] = {};
      prevByCategory[mk][cat] = (prevByCategory[mk][cat] || 0) + exp.amount;
    }
  }

  // Calculate average per category across previous months
  const allCategories = new Set([
    ...Object.keys(thisMonthByCategory),
    ...Object.values(prevByCategory).flatMap(m => Object.keys(m)),
  ]);

  for (const cat of allCategories) {
    const thisMonthSpend = thisMonthByCategory[cat] || 0;
    if (thisMonthSpend === 0) continue; // Not spending this month = no anomaly

    const prevSpends = prev3
      .map(mk => (prevByCategory[mk]?.[cat] || 0))
      .filter(v => v > 0); // Only count months with actual spending

    if (prevSpends.length === 0) {
      // New category spending — notable insight
      insights.push({
        id: genId(),
        type: 'spending_anomaly',
        title: `New spending: ${cat}`,
        message: `You've spent $${thisMonthSpend.toFixed(0)} on ${cat} this month — no previous data to compare against.`,
        severity: 'info',
        data: { category: cat, thisMonth: thisMonthSpend, avgPrev3: 0, deviation: 1 },
        timestamp: now.toISOString(),
      });
      continue;
    }

    const avgPrev = prevSpends.reduce((s, v) => s + v, 0) / prevSpends.length;
    const deviation = (thisMonthSpend - avgPrev) / Math.max(avgPrev, 1);

    if (Math.abs(deviation) >= ANOMALY_THRESHOLD) {
      const isUp = deviation > 0;
      const pctStr = `${Math.abs(deviation * 100).toFixed(0)}%`;
      const avgStr = `$${avgPrev.toFixed(0)}`;
      const curStr = `$${thisMonthSpend.toFixed(0)}`;

      insights.push({
        id: genId(),
        type: 'spending_anomaly',
        title: `${cat}: ${isUp ? '↑' : '↓'}${pctStr} vs avg`,
        message: `${cat} is ${isUp ? 'up' : 'down'} ${pctStr} vs 3-month average (${avgStr} → ${curStr}). ${isUp ? 'Consider if this is a one-off or a new pattern.' : ''}`,
        severity: isUp ? 'warning' : 'success',
        data: {
          category: cat,
          thisMonth: thisMonthSpend,
          avgPrev3: avgPrev,
          deviation,
        },
        timestamp: now.toISOString(),
      });
    }
  }

  // Sort anomalies by absolute deviation, highest first
  insights.sort((a, b) => Math.abs(b.data.deviation as number) - Math.abs(a.data.deviation as number));
  return insights.slice(0, 5); // Max 5 anomalies
}

/**
 * Income forecasting — linear regression on monthly income totals.
 * Predicts current month and next month income.
 */
function forecastIncome(input: FinancialInput): FinancialInsight[] {
  const now = input.now || new Date();
  const insights: FinancialInsight[] = [];

  // Group income by month
  const monthlyIncome: Record<string, number> = {};
  for (const inc of input.income) {
    const mk = monthKey(inc.date);
    monthlyIncome[mk] = (monthlyIncome[mk] || 0) + inc.amount;
  }

  // Get last 6 months of income (or whatever is available)
  const months = prevMonths(now, 6).reverse(); // oldest first
  months.push(thisMonthStr(now));

  const values: number[] = [];
  for (const mk of months) {
    if (monthlyIncome[mk] !== undefined) {
      values.push(monthlyIncome[mk]);
    }
  }

  if (values.length < MIN_MONTHS_FOR_TREND) return insights;

  const { slope, intercept, r2 } = linearRegression(values);

  // Forecast: next data point (next month)
  const nextMonthPredicted = slope * values.length + intercept;
  const confidence = Math.min(r2, 1);

  if (confidence >= FORECAST_CONFIDENCE_MIN && nextMonthPredicted > 0) {
    const trend = slope > 0 ? 'upward' : slope < 0 ? 'declining' : 'stable';
    const avgMonthly = values.reduce((s, v) => s + v, 0) / values.length;
    const trendPct = avgMonthly > 0 ? ((slope / avgMonthly) * 100).toFixed(0) : '0';

    insights.push({
      id: genId(),
      type: 'income_forecast',
      title: `Income forecast: $${nextMonthPredicted.toFixed(0)}/mo`,
      message: `Based on ${values.length} months of data, your income trend is ${trend} (${slope > 0 ? '+' : ''}${trendPct}%/mo). Projected next month: $${nextMonthPredicted.toFixed(0)}.`,
      severity: slope >= 0 ? 'success' : 'warning',
      data: {
        predicted: nextMonthPredicted,
        confidence: confidence,
        slope,
        trend: trend,
        monthsOfData: values.length,
      },
      timestamp: now.toISOString(),
    });
  }

  return insights;
}

/**
 * Identify savings opportunities — categories where a 10% cut
 * would save at least $50/month.
 */
function findSavingsOpportunities(input: FinancialInput): FinancialInsight[] {
  const now = input.now || new Date();
  const thisMonth = thisMonthStr(now);
  const insights: FinancialInsight[] = [];

  const byCategory: Record<string, number> = {};
  for (const exp of input.expenses) {
    if (monthKey(exp.date) === thisMonth) {
      const cat = (exp as Record<string, unknown>).category as string || 'uncategorised';
      byCategory[cat] = (byCategory[cat] || 0) + exp.amount;
    }
  }

  for (const [cat, total] of Object.entries(byCategory)) {
    const tenPercent = total * 0.1;
    if (tenPercent >= 50) {
      insights.push({
        id: genId(),
        type: 'savings_opportunity',
        title: `Save $${tenPercent.toFixed(0)} from ${cat}`,
        message: `You're spending $${total.toFixed(0)}/mo on ${cat}. A 10% reduction would save $${tenPercent.toFixed(0)}/mo ($${(tenPercent * 12).toFixed(0)}/yr).`,
        severity: 'info',
        data: { category: cat, monthly: total, savings10: tenPercent, annual: tenPercent * 12 },
        timestamp: now.toISOString(),
      });
    }
  }

  insights.sort((a, b) => (b.data.annual as number) - (a.data.annual as number));
  return insights.slice(0, 3);
}

/**
 * Overall trend analysis — is the user's financial position improving or declining?
 */
function analyzeTrend(input: FinancialInput): FinancialInsight | null {
  const now = input.now || new Date();
  const thisMonth = thisMonthStr(now);
  const lastMonth = lastMonthStr(now);

  let thisMonthNet = 0;
  let lastMonthNet = 0;

  for (const inc of input.income) {
    const mk = monthKey(inc.date);
    if (mk === thisMonth) thisMonthNet += inc.amount;
    else if (mk === lastMonth) lastMonthNet += inc.amount;
  }

  for (const exp of input.expenses) {
    const mk = monthKey(exp.date);
    if (mk === thisMonth) thisMonthNet -= exp.amount;
    else if (mk === lastMonth) lastMonthNet -= exp.amount;
  }

  const change = thisMonthNet - lastMonthNet;
  if (Math.abs(change) < 50) return null; // Ignore trivial changes

  const direction = change > 0 ? 'improving' : 'declining';
  const severity = change > 0 ? 'success' : 'warning';

  return {
    id: genId(),
    type: 'trend_alert',
    title: `Financial position: ${direction}`,
    message: change > 0
      ? `Your net position is $${Math.abs(change).toFixed(0)} better than last month. ${thisMonthNet >= 0 ? 'Keep it up.' : 'Still negative, but improving.'}`
      : `Your net position dropped $${Math.abs(change).toFixed(0)} vs last month. Consider reviewing recent spending.`,
    severity,
    data: { thisMonthNet, lastMonthNet, change },
    timestamp: now.toISOString(),
  };
}

// ─── Main Entry Point ───────────────────────────────

/**
 * Generate financial insights from income/expense data.
 * Returns prioritised insights (max 8) sorted by severity.
 */
export function generateFinancialInsights(input: FinancialInput): FinancialInsight[] {
  const allInsights: FinancialInsight[] = [
    ...detectSpendingAnomalies(input),
    ...forecastIncome(input),
    ...findSavingsOpportunities(input),
  ];

  // Trend alert is singular, push if exists
  const trend = analyzeTrend(input);
  if (trend) allInsights.unshift(trend);

  // Sort: warning > success > info, then by timestamp desc
  const severityOrder: Record<string, number> = { warning: 0, success: 1, info: 2 };
  allInsights.sort((a, b) => {
    const sevDiff = (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2);
    if (sevDiff !== 0) return sevDiff;
    return b.timestamp.localeCompare(a.timestamp);
  });

  return allInsights.slice(0, 8);
}

/**
 * Get monthly spending breakdown by category.
 * Useful for the DashboardFinancialPulse detail view.
 */
export function getMonthlyBreakdown(
  expenses: ExpenseEntry[],
  monthStr: string,
): { category: string; amount: number; percentage: number }[] {
  const byCategory: Record<string, number> = {};
  for (const exp of expenses) {
    if (monthKey(exp.date) === monthStr) {
      const cat = (exp as Record<string, unknown>).category as string || 'uncategorised';
      byCategory[cat] = (byCategory[cat] || 0) + exp.amount;
    }
  }

  const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
  return Object.entries(byCategory)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Get the projected net position for the end of the current month.
 * Uses income forecast + average daily expense rate.
 */
export function projectMonthEnd(
  input: FinancialInput,
): { projectedNet: number; projectedIncome: number; projectedExpenses: number; daysRemaining: number } {
  const now = input.now || new Date();
  const thisMonth = thisMonthStr(now);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();
  const daysRemaining = daysInMonth - daysElapsed;

  // Current month actuals
  let monthIncome = 0;
  let monthExpenses = 0;

  for (const inc of input.income) {
    if (monthKey(inc.date) === thisMonth) monthIncome += inc.amount;
  }
  for (const exp of input.expenses) {
    if (monthKey(exp.date) === thisMonth) monthExpenses += exp.amount;
  }

  // Project: assume same daily rate continues
  const dailyExpenseRate = daysElapsed > 0 ? monthExpenses / daysElapsed : 0;
  const dailyIncomeRate = daysElapsed > 0 ? monthIncome / daysElapsed : 0;

  const projectedIncome = dailyIncomeRate * daysInMonth;
  const projectedExpenses = dailyExpenseRate * daysInMonth;
  const projectedNet = projectedIncome - projectedExpenses;

  return { projectedNet, projectedIncome, projectedExpenses, daysRemaining };
}