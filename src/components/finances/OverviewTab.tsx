import React, { useState, useCallback, useMemo } from 'react';
import { useFinances } from './FinancesContext';
import { fmtCurrency, fmtShort, colorForIndex } from './types';
import { BudgetRingBtn } from './BudgetRingBtn';
import { DonutChart, AreaChart, SparkLine, ProgressRing } from '../charts';
import { DataTooltip } from '../ui/DataTooltip';
import type { DataTooltipData } from '../ui/DataTooltip';
import { EmojiIcon } from '../../lib/emoji-icon';
import {
  TrendingUp, TrendingDown, Target, Sparkles, Wallet, Zap,
  AlertTriangle, CheckCircle2, ChevronRight, ShieldCheck, CreditCard,
} from 'lucide-react';

/* ── Financial Health Score Calculator ── */
function calculateFinancialHealth(
  monthIncome: number,
  monthExpenses: number,
  bills: { status: string; due_date: string }[],
  budgetHealth: { pct: number }[],
  monthlyData: { income: number; expenses: number }[],
): { score: number; breakdown: { label: string; value: number; max: number }[] } {
  // 1. Savings rate (weight: 35)
  const savingsRate = monthIncome > 0 ? (monthIncome - monthExpenses) / monthIncome : 0;
  const savingsScore = Math.max(0, Math.min(35, savingsRate * 100 * 0.35));

  // 2. Bill payment timeliness (weight: 25)
  const today = new Date().toISOString().split('T')[0];
  const totalBills = bills.length;
  const overdueBills = bills.filter(b => b.status !== 'paid' && b.due_date < today).length;
  const paidBills = bills.filter(b => b.status === 'paid').length;
  const billScore = totalBills > 0
    ? ((paidBills / totalBills) * 25) * (1 - (overdueBills / totalBills) * 0.5)
    : 20; // Default to decent score if no bills tracked

  // 3. Budget adherence (weight: 20)
  const budgetItems = budgetHealth.filter(b => b.pct > 0);
  let budgetScore = 16; // Default decent
  if (budgetItems.length > 0) {
    const avgAdherence = budgetItems.reduce((s, b) => {
      if (b.pct <= 100) return s + 1;
      if (b.pct <= 120) return s + 0.5;
      return s;
    }, 0) / budgetItems.length;
    budgetScore = avgAdherence * 20;
  }

  // 4. Income trend (weight: 20)
  const recentMonths = monthlyData.slice(-3);
  let trendScore = 10; // Default neutral
  if (recentMonths.length >= 2) {
    const incomes = recentMonths.map(m => m.income);
    const growing = incomes.every((v, i) => i === 0 || v >= incomes[i - 1] * 0.95);
    const declining = incomes.every((v, i) => i === 0 || v < incomes[i - 1] * 0.9);
    if (growing) trendScore = 20;
    else if (declining) trendScore = 5;
    else trendScore = 12;
  }

  const total = Math.round(Math.min(100, Math.max(0, savingsScore + billScore + budgetScore + trendScore)));

  return {
    score: total,
    breakdown: [
      { label: 'Savings', value: Math.round(savingsScore), max: 35 },
      { label: 'Bills', value: Math.round(billScore), max: 25 },
      { label: 'Budget', value: Math.round(budgetScore), max: 20 },
      { label: 'Trend', value: Math.round(trendScore), max: 20 },
    ],
  };
}

function healthColor(score: number): string {
  if (score <= 30) return '#F43F5E';
  if (score <= 60) return '#F97316';
  return '#39FF14';
}

export const OverviewTab = React.memo(function OverviewTab() {
  const ctx = useFinances();
  const {
    monthIncome, monthExpenses, net, monthlyData, overdueBills, bills,
    incomeBySource, expenseByCategory, budgetHealth, predictions,
    financialTasks, financialInsights, goals, categories,
    overviewDonutSlice, setOverviewDonutSlice,
    cashflowMonthIdx, setCashflowMonthIdx,
    switchTab, setDrillCategory, openBudgetEditor, togglePaid,
  } = ctx;

  // Financial health score
  const healthData = useMemo(() => calculateFinancialHealth(
    monthIncome, monthExpenses, bills, budgetHealth, monthlyData,
  ), [monthIncome, monthExpenses, bills, budgetHealth, monthlyData]);

  const hColor = healthColor(healthData.score);

  // Overdue bills data
  const overdueBillsTotal = useMemo(() => overdueBills.reduce((s, b) => s + b.amount, 0), [overdueBills]);
  const [overdueExpanded, setOverdueExpanded] = useState(false);

  // AI insight (one-liner from financialInsights)
  const aiInsightLine = useMemo(() => {
    if (financialInsights.categoryChanges.length > 0) {
      const top = financialInsights.categoryChanges[0];
      const dir = top.change > 0 ? 'more' : 'less';
      return `You've spent ${Math.abs(top.change).toFixed(0)}% ${dir} on ${top.cat.name} this month`;
    }
    if (financialInsights.momChange > 10) return `Spending is up ${financialInsights.momChange.toFixed(0)}% compared to last month`;
    if (financialInsights.momChange < -10) return `Great job! Spending is down ${Math.abs(financialInsights.momChange).toFixed(0)}% from last month`;
    if (net > 0) return `You're saving ${fmtCurrency(net)} this month — keep it up!`;
    return null;
  }, [financialInsights, net]);

  // Long-press tooltip state
  const [tooltipData, setTooltipData] = useState<DataTooltipData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const dismissTooltip = useCallback(() => { setTooltipData(null); setTooltipPos(null); }, []);

  const handleCashflowLongPress = useCallback((idx: number, pos: { x: number; y: number }) => {
    if (idx < 0 || idx >= monthlyData.length) return;
    const m = monthlyData[idx];
    const net = m.income - m.expenses;
    const prevMonth = idx > 0 ? monthlyData[idx - 1] : null;
    setTooltipData({
      value: net,
      label: `Cashflow — ${m.month}`,
      color: net >= 0 ? '#39FF14' : '#F43F5E',
      previousValue: prevMonth ? prevMonth.income - prevMonth.expenses : null,
      extras: [
        { label: 'Income', value: fmtCurrency(m.income), color: '#39FF14' },
        { label: 'Expenses', value: fmtCurrency(m.expenses), color: '#F43F5E' },
        { label: 'Savings Rate', value: m.income > 0 ? `${((net / m.income) * 100).toFixed(0)}%` : '—', color: '#00D4FF' },
      ],
    });
    setTooltipPos(pos);
  }, [monthlyData]);

  return (
    <div className="fin-overview">
      {/* ── Financial Health Score ── */}
      {monthIncome === 0 && monthExpenses === 0 && bills.length === 0 ? (
        <div className="fin-glass-card fin-health-score-card" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <ShieldCheck size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>Start tracking to see your Financial Health Score</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Log income or expenses to unlock insights</div>
        </div>
      ) : (
      <div className="fin-glass-card fin-health-score-card" style={{ '--health-color': hColor } as React.CSSProperties}>
        <div className="fin-health-score-layout">
          <ProgressRing
            value={healthData.score}
            size={110}
            strokeWidth={10}
            color={hColor}
            glow
            centerContent={
              <div className="fin-health-center">
                <div className="fin-health-number" style={{ color: hColor }}>{healthData.score}</div>
                <div className="fin-health-label">Health</div>
              </div>
            }
          />
          <div className="fin-health-details">
            <div className="fin-health-title">
              <ShieldCheck size={14} style={{ color: hColor }} />
              <span>Financial Health</span>
            </div>
            <div className="fin-health-status" style={{ color: hColor }}>
              {healthData.score <= 30 ? 'Needs Attention' : healthData.score <= 60 ? 'Getting There' : 'Looking Good'}
            </div>
            <div className="fin-health-breakdown">
              {healthData.breakdown.map(b => (
                <div key={b.label} className="fin-health-bar-row">
                  <span className="fin-health-bar-label">{b.label}</span>
                  <div className="fin-health-bar-track">
                    <div
                      className="fin-health-bar-fill"
                      style={{ width: `${b.max > 0 ? (b.value / b.max) * 100 : 0}%`, background: hColor }}
                    />
                  </div>
                  <span className="fin-health-bar-val">{b.value}/{b.max}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {aiInsightLine && (
          <div className="fin-health-insight">
            <Sparkles size={11} style={{ color: '#FBBF24' }} />
            <span>{aiInsightLine}</span>
          </div>
        )}
      </div>
      )}

      {/* ── Overdue Bills Alert (Overview) ── */}
      {overdueBills.length > 0 && (
        <div
          className="fin-glass-card fin-overdue-banner"
          onClick={() => setOverdueExpanded(!overdueExpanded)}
        >
          <div className="fin-overdue-banner-header">
            <AlertTriangle size={18} />
            <div className="fin-overdue-banner-text">
              <strong>⚠️ {overdueBills.length} bill{overdueBills.length > 1 ? 's' : ''} overdue — {fmtCurrency(overdueBillsTotal)}</strong>
              <span className="fin-overdue-banner-names">{overdueBills.map(b => b.title).join(', ')}</span>
            </div>
            <ChevronRight size={16} className={`fin-overdue-chevron ${overdueExpanded ? 'expanded' : ''}`} />
          </div>
          {overdueExpanded && (
            <div className="fin-overdue-banner-details">
              {overdueBills.map(b => (
                <div key={b.id} className="fin-overdue-banner-item">
                  <div className="fin-overdue-banner-item-info">
                    <CreditCard size={12} />
                    <span className="fin-overdue-banner-item-title">{b.title}</span>
                    <span className="fin-overdue-banner-item-due">Due {b.due_date}</span>
                  </div>
                  <strong className="fin-overdue-banner-item-amt">{fmtCurrency(b.amount)}</strong>
                  <button
                    className="fin-overdue-pay-btn"
                    onClick={(e) => { e.stopPropagation(); togglePaid(b.id, b.status); }}
                  >
                    <CheckCircle2 size={12} /> Pay
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Financial Insights Card */}
      <div className="fin-glass-card fin-insights-card">
        <div className="fin-section-label"><Sparkles size={12} /> Financial Insights</div>
        <div className="fin-insights-grid">
          {financialInsights.momChange !== 0 && (
            <div className="fin-insight-item">
              <div className="fin-insight-icon" style={{ color: financialInsights.momChange > 0 ? '#F43F5E' : '#39FF14' }}>
                {financialInsights.momChange > 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              </div>
              <div className="fin-insight-content">
                <span className="fin-insight-label">vs Last Month</span>
                <span className={`fin-insight-value ${financialInsights.momChange > 0 ? 'negative' : 'positive'}`}>
                  {financialInsights.momChange > 0 ? '+' : ''}{financialInsights.momChange.toFixed(0)}%
                </span>
              </div>
            </div>
          )}
          {financialInsights.biggestThisWeek && (
            <div className="fin-insight-item">
              <div className="fin-insight-icon" style={{ color: '#F43F5E' }}>
                <Target size={20} />
              </div>
              <div className="fin-insight-content">
                <span className="fin-insight-label">Biggest This Week</span>
                <span className="fin-insight-value">{fmtCurrency(financialInsights.biggestThisWeek.amount)}</span>
                <span className="fin-insight-desc">{financialInsights.biggestThisWeek.description || 'Expense'}</span>
              </div>
            </div>
          )}
          {financialInsights.savingsRateLast3.length > 0 && (
            <div className="fin-insight-item">
              <div className="fin-insight-icon" style={{ color: '#00D4FF' }}>
                <Wallet size={20} />
              </div>
              <div className="fin-insight-content">
                <span className="fin-insight-label">Savings Rate (3mo avg)</span>
                <span className="fin-insight-value">
                  {(financialInsights.savingsRateLast3.reduce((s, r) => s + r.rate, 0) / financialInsights.savingsRateLast3.length).toFixed(0)}%
                </span>
                <div className="fin-insight-sparkline">
                  <SparkLine data={financialInsights.savingsRateLast3.map(r => r.rate)} color="#00D4FF" height={24} />
                </div>
              </div>
            </div>
          )}
          <div className="fin-insight-item">
            <div className="fin-insight-icon" style={{ color: financialInsights.incomeVsExpenses >= 0 ? '#39FF14' : '#F43F5E' }}>
              {financialInsights.incomeVsExpenses >= 0 ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div className="fin-insight-content">
              <span className="fin-insight-label">Net This Month</span>
              <span className={`fin-insight-value ${financialInsights.incomeVsExpenses >= 0 ? 'positive' : 'negative'}`}>
                {financialInsights.incomeVsExpenses >= 0 ? '+' : ''}{fmtCurrency(financialInsights.incomeVsExpenses)}
              </span>
            </div>
          </div>
        </div>
        {financialInsights.categoryChanges.length > 0 && (
          <div className="fin-category-insights">
            <div className="fin-insight-divider" />
            {financialInsights.categoryChanges.map(({ cat, change }) => (
              <div key={cat.id} className="fin-category-insight-row">
                <span className="fin-category-insight-icon">{cat.icon || '📦'}</span>
                <span className="fin-category-insight-text">
                  <strong>{cat.name}</strong> {change > 0 ? 'up' : 'down'} {Math.abs(change).toFixed(0)}% vs last month
                </span>
                {change > 0 ? <TrendingUp size={14} color="#F43F5E" /> : <TrendingDown size={14} color="#39FF14" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hero: Donut + Cashflow */}
      <div className="fin-overview-hero">
        <div className="fin-glass-card fin-hero-donut-card">
          <div className="fin-section-label">This Month</div>
          <div className="fin-hero-donut-wrap">
            <DonutChart
              size={150}
              strokeWidth={26}
              segments={[
                { label: 'Income', value: monthIncome, color: '#39FF14' },
                { label: 'Expenses', value: monthExpenses, color: '#F43F5E' },
                { label: 'Savings', value: Math.max(net, 0), color: '#00D4FF' },
              ].filter(s => s.value > 0)}
              centerLabel="Net"
              centerValue={`${net >= 0 ? '+' : ''}${fmtShort(net)}`}
              selectedIndex={overviewDonutSlice}
              onSegmentTap={(i) => setOverviewDonutSlice(overviewDonutSlice === i ? null : i)}
            />
            <div className="fin-donut-legend">
              {[
                { label: 'Income', value: monthIncome, color: '#39FF14' },
                { label: 'Expenses', value: monthExpenses, color: '#F43F5E' },
                { label: 'Savings', value: Math.max(net, 0), color: '#00D4FF' },
              ].filter(s => s.value > 0).map((s, i) => (
                <button
                  key={s.label}
                  className={`fin-donut-legend-item ${overviewDonutSlice === i ? 'active' : ''}`}
                  onClick={() => setOverviewDonutSlice(overviewDonutSlice === i ? null : i)}
                  style={{ '--legend-color': s.color } as React.CSSProperties}
                >
                  <span className="fin-donut-legend-dot" style={{ background: s.color }} />
                  <div>
                    <div className="fin-donut-legend-label">{s.label}</div>
                    <div className="fin-donut-legend-val" style={{ color: s.color }}>{fmtCurrency(s.value)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {overviewDonutSlice === 0 && incomeBySource.length > 0 && (
            <div className="fin-donut-drill">
              <div className="fin-section-label" style={{ color: '#39FF14' }}>Income by Source <span className="fin-drill-hint">tap to view</span></div>
              {incomeBySource.map(([src, amt], i) => (
                <div key={src} className="fin-drill-row fin-drill-row-clickable" onClick={() => switchTab('income')}>
                  <span className="fin-drill-dot" style={{ background: colorForIndex(i) }} />
                  <span className="fin-drill-name">{src}</span>
                  <div className="fin-drill-bar"><div className="fin-drill-fill" style={{ width: `${monthIncome > 0 ? (amt / monthIncome) * 100 : 0}%`, background: colorForIndex(i) }} /></div>
                  <span className="fin-drill-amt" style={{ color: '#39FF14' }}>{fmtCurrency(amt)}</span>
                  <ChevronRight size={12} className="fin-drill-chevron" />
                </div>
              ))}
            </div>
          )}
          {overviewDonutSlice === 1 && expenseByCategory.length > 0 && (
            <div className="fin-donut-drill">
              <div className="fin-section-label" style={{ color: '#F43F5E' }}>Expenses by Category <span className="fin-drill-hint">tap to filter</span></div>
              {expenseByCategory.map(([cat, amt], i) => {
                const catObj = categories.find((c) => c.name === cat);
                return (
                  <div key={cat} className="fin-drill-row fin-drill-row-clickable" onClick={() => { if (catObj) { switchTab('expenses'); setDrillCategory(catObj.id); } else { switchTab('expenses'); } }}>
                    <span className="fin-drill-dot" style={{ background: colorForIndex(i) }} />
                    <span className="fin-drill-name">{cat}</span>
                    <div className="fin-drill-bar"><div className="fin-drill-fill" style={{ width: `${monthExpenses > 0 ? (amt / monthExpenses) * 100 : 0}%`, background: colorForIndex(i) }} /></div>
                    <span className="fin-drill-amt" style={{ color: '#F43F5E' }}>{fmtCurrency(amt)}</span>
                    <ChevronRight size={12} className="fin-drill-chevron" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="fin-glass-card fin-cashflow-card">
          <div className="fin-section-label">6-Month Cashflow</div>
          <div className="fin-cashflow-legend">
            <span className="fin-cashflow-legend-item income">Income</span>
            <span className="fin-cashflow-legend-item expense">Expenses</span>
          </div>
          <AreaChart
            series={[
              { data: monthlyData.map(m => m.income), color: '#39FF14', label: 'Income', fillOpacity: 0.18 },
              { data: monthlyData.map(m => m.expenses), color: '#F43F5E', label: 'Expenses', fillOpacity: 0.18 },
            ]}
            labels={monthlyData.map(m => m.month)}
            height={130}
            showTrendLine
            selectedIndex={cashflowMonthIdx}
            onPointTap={(i) => setCashflowMonthIdx(cashflowMonthIdx === i ? null : i)}
            onPointLongPress={handleCashflowLongPress}
          />
          {cashflowMonthIdx !== null && monthlyData[cashflowMonthIdx] && (
            <div className="fin-cashflow-tooltip-card">
              <strong>{monthlyData[cashflowMonthIdx].month}</strong>
              <span className="fin-cashflow-income">+{fmtCurrency(monthlyData[cashflowMonthIdx].income)}</span>
              <span className="fin-cashflow-expense">-{fmtCurrency(monthlyData[cashflowMonthIdx].expenses)}</span>
              <span className={monthlyData[cashflowMonthIdx].income >= monthlyData[cashflowMonthIdx].expenses ? 'fin-cashflow-net-pos' : 'fin-cashflow-net-neg'}>
                Net: {fmtShort(monthlyData[cashflowMonthIdx].income - monthlyData[cashflowMonthIdx].expenses)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Budget rings */}
      {budgetHealth.length > 0 && (
        <div className="fin-glass-card">
          <div className="fin-section-label"><Target size={11} /> Budget Utilization</div>
          <div className="fin-rings-scroll">
            {budgetHealth.map(({ cat, spent, budget, pct }) => (
              <BudgetRingBtn
                key={cat.id}
                cat={cat} spent={spent} budget={budget} pct={pct}
                onNavigate={() => { switchTab('expenses'); setDrillCategory(cat.id); }}
                onEditBudget={() => openBudgetEditor(cat)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Projections */}
      <div className="fin-glass-card fin-predict-card">
        <div className="fin-section-label"><Zap size={11} /> Projections (3-month avg)</div>
        <div className="fin-predict-grid">
          <div className="fin-predict-item">
            <span className="fin-predict-label">Projected Income</span>
            <span className="fin-predict-val income">{fmtShort(predictions.income)}/mo</span>
          </div>
          <div className="fin-predict-item">
            <span className="fin-predict-label">Projected Expenses</span>
            <span className="fin-predict-val expense">{fmtShort(predictions.expenses)}/mo</span>
          </div>
          <div className="fin-predict-item">
            <span className="fin-predict-label">Projected Savings</span>
            <span className={`fin-predict-val ${predictions.income - predictions.expenses >= 0 ? 'income' : 'expense'}`}>
              {fmtShort(predictions.income - predictions.expenses)}/mo
            </span>
          </div>
          <div className="fin-predict-item">
            <span className="fin-predict-label">Annual Projection</span>
            <span className={`fin-predict-val ${predictions.income - predictions.expenses >= 0 ? 'income' : 'expense'}`}>
              {fmtShort((predictions.income - predictions.expenses) * 12)}/yr
            </span>
          </div>
        </div>
      </div>

      {/* Financial tasks */}
      {financialTasks.length > 0 && (
        <div className="fin-glass-card fin-tasks-card">
          <div className="fin-section-label"><Target size={11} /> Financial Impact from Goals</div>
          <div className="fin-tasks-list">
            {financialTasks.map(({ goal, tasks }) => {
              const totalImpact = tasks.reduce((s, t) => s + (t.financial_amount || 0), 0);
              return (
                <div key={goal?.id || 'none'} className="fin-task-group">
                  <div className="fin-task-group-header">
                    <span className="fin-task-group-title">{goal ? goal.title : 'Unlinked Tasks'}</span>
                    <span className={`fin-task-group-total ${totalImpact >= 0 ? 'income' : 'expense'}`}>{totalImpact >= 0 ? '+' : ''}{fmtCurrency(totalImpact)}</span>
                  </div>
                  <div className="fin-task-items">
                    {tasks.map(t => (
                      <div key={t.id} className="fin-task-item">
                        <span className="fin-task-title">{t.title}</span>
                        <span className={`fin-task-amount ${(t.financial_amount || 0) >= 0 ? 'income' : 'expense'}`}>{(t.financial_amount || 0) >= 0 ? '+' : ''}{fmtCurrency(t.financial_amount || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Goal budget flow */}
      {goals.filter(g => g.budget_allocated).length > 0 && (
        <div className="fin-glass-card">
          <div className="fin-section-label"><Target size={11} /> Budget Allocation by Objective</div>
          <div className="fin-budget-flow">
            {goals.filter(g => (g as Record<string, unknown>).category === 'objective' && g.budget_allocated).map((obj) => {
              const childEpics = goals.filter(g => (g as Record<string, unknown>).category === 'epic' && g.parent_goal_id === obj.id);
              const isRevenue = obj.financial_type === 'revenue_goal';
              return (
                <div key={obj.id} className="fin-budget-obj">
                  <div className="fin-budget-obj-header">
                    <span className="fin-budget-obj-icon"><EmojiIcon emoji={(obj as Record<string, unknown>).icon as string || '🎯'} size={16} fallbackAsText /></span>
                    <span className="fin-budget-obj-title">{obj.title}</span>
                    <span className={`fin-budget-obj-type ${isRevenue ? 'revenue' : 'cost'}`}>{isRevenue ? 'Revenue' : 'Cost'}</span>
                    <strong className={isRevenue ? 'fin-budget-obj-amt revenue' : 'fin-budget-obj-amt cost'}>{fmtCurrency(obj.budget_allocated)}</strong>
                  </div>
                  {childEpics.filter(e => e.budget_allocated).length > 0 && (
                    <div className="fin-budget-epics">
                      {childEpics.filter(e => e.budget_allocated).map((ep) => (
                        <div key={ep.id} className="fin-budget-epic-row">
                          <span className="fin-budget-epic-dot" />
                          <span className="fin-budget-epic-name"><EmojiIcon emoji={(ep as Record<string, unknown>).icon as string || '⚡'} size={12} fallbackAsText /> {ep.title}</span>
                          <strong>{fmtCurrency(ep.budget_allocated)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legacy overdue alert removed — replaced by fin-overdue-banner above */}

      {/* Data Tooltip for long-press */}
      <DataTooltip data={tooltipData} position={tooltipPos} onDismiss={dismissTooltip} />
    </div>
  );
});
