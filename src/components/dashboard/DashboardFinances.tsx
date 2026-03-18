/**
 * DashboardFinances — Finance summary + alerts for the Dashboard.
 */

import { forwardRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DollarSign, ChevronRight, ArrowUpCircle, ArrowDownCircle, AlertTriangle,
  TrendingUp, Receipt, PiggyBank, Wallet, Activity,
} from 'lucide-react';
import { EmojiIcon } from '../../lib/emoji-icon';
import { formatDateShort } from '../../utils/date';
import type { FinancialSnapshot } from '../../lib/financial-engine';
import type { Bill, Business, Transaction } from '../../types/database';
import type { IncomeEntry, ExpenseEntry } from '../../stores/useFinanceStore';
import type { GoalNode } from '../../stores/useGoalsStore';

function fmtCurrencyRounded(n: number) { return `$${Math.abs(n).toFixed(0)}`; }

interface AlertEntry { type: string; icon: string; message: string }

interface DashboardFinancesProps {
  income: IncomeEntry[];
  expenses: ExpenseEntry[];
  bills: Bill[];
  businesses: Business[];
  transactions: Transaction[];
  goals: GoalNode[];
  finSnapshot: FinancialSnapshot | null;
}

export const DashboardFinances = forwardRef<HTMLElement, DashboardFinancesProps>(
  function DashboardFinances({ income, expenses, bills, businesses, transactions, goals, finSnapshot }, ref) {
    const navigate = useNavigate();
    const now = new Date();

    // BUG-014: Use transactions table as canonical source to avoid double-counting
    // BUG-079: Memoize expensive finance calculations
    const monthIncome = useMemo(() => transactions.filter((t: Transaction) => t.type === 'income').reduce((s: number, t: Transaction) => s + t.amount, 0), [transactions]);
    const monthExpenses = useMemo(() => transactions.filter((t: Transaction) => t.type === 'expense').reduce((s: number, t: Transaction) => s + t.amount, 0), [transactions]);
    const net = useMemo(() => monthIncome - monthExpenses, [monthIncome, monthExpenses]);
    const overdueBills = useMemo(() => bills.filter((b: Bill) => b.status !== 'paid' && b.due_date && b.due_date < now.toISOString().split('T')[0]), [bills, now]);
    const upcomingBills = useMemo(() => bills.filter((b: Bill) => b.status !== 'paid' && b.due_date && b.due_date >= now.toISOString().split('T')[0]).slice(0, 3), [bills, now]);

    const finRollup = useMemo(() => {
      const totalBudget = goals.reduce((s: number, g: GoalNode) => s + (g.budget_allocated || 0), 0);
      const budgetUtil = totalBudget > 0 ? Math.min(monthExpenses / totalBudget, 1) : 0;
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dailyBurn = dayOfMonth > 0 ? monthExpenses / dayOfMonth : 0;
      const dailyEarn = dayOfMonth > 0 ? monthIncome / dayOfMonth : 0;
      const projectedNet = (dailyEarn * daysInMonth) - (dailyBurn * daysInMonth);
      const monthBills = bills.filter((b: Bill) => b.status !== 'paid' && b.due_date?.startsWith(now.toISOString().slice(0, 7)));
      const billsTotal = monthBills.reduce((s: number, b: Bill) => s + b.amount, 0);
      const savingsRate = monthIncome > 0 ? ((monthIncome - monthExpenses) / monthIncome) * 100 : 0;
      return { totalBudget, budgetUtil, dailyBurn, projectedNet, billsTotal, monthBills: monthBills.length, savingsRate, dayOfMonth, daysInMonth };
    }, [goals, monthIncome, monthExpenses, bills, now]);

    // BUG-079: Memoize business transaction calculations
    const businessNetMap = useMemo(() => {
      const map = new Map<string, number>();
      businesses.forEach(b => {
        const bizTxIncome = transactions.filter((t: Transaction) => t.type === 'income' && t.business_id === b.id).reduce((s: number, t: Transaction) => s + t.amount, 0);
        const bizTxExpense = transactions.filter((t: Transaction) => t.type === 'expense' && t.business_id === b.id).reduce((s: number, t: Transaction) => s + t.amount, 0);
        map.set(b.id, bizTxIncome - bizTxExpense);
      });
      return map;
    }, [businesses, transactions]);

    return (
      <>
        {/* Financial Alerts */}
        {finSnapshot?.alerts?.length ? (
          <section className="dash-card dash-fin-alerts">
            <div className="card-top"><h2><AlertTriangle size={16} /> Financial Alerts</h2></div>
            <div className="dash-fin-alerts-list">
              {finSnapshot.alerts.map((a: AlertEntry, i: number) => (
                <div key={i} className={`dash-fin-alert-item ${a.type}`}><span>{a.icon}</span><span>{a.message}</span></div>
              ))}
            </div>
            {finSnapshot.financialHealthScore > 0 && (
              <div className="dash-fin-health-score clickable" onClick={() => navigate('/finances?tab=analysis')}>
                <span className="dash-fin-health-label">Financial Health</span>
                <div className="dash-fin-health-bar">
                  <div className="dash-fin-health-fill" style={{ width: `${finSnapshot.financialHealthScore}%`, background: finSnapshot.financialHealthScore >= 70 ? '#39FF14' : finSnapshot.financialHealthScore >= 40 ? '#F97316' : '#F43F5E' }} />
                </div>
                <span className="dash-fin-health-val">{finSnapshot.financialHealthScore}/100</span>
              </div>
            )}
          </section>
        ) : null}

        {/* Main Finances Card */}
        <section ref={ref} className="dash-card dash-fin-hero">
          <div className="card-top">
            <h2><DollarSign size={16} /> Finances</h2>
            <Link to="/finances" className="card-link">Full view <ChevronRight size={14} /></Link>
          </div>
          <div className={`dash-fin-net-hero clickable ${net >= 0 ? 'positive' : 'negative'}`} onClick={() => navigate('/finances?tab=analysis')}>
            <span className="dash-fin-net-label">Net This Month</span>
            <span className="dash-fin-net-amount">{net >= 0 ? '+' : ''}{fmtCurrencyRounded(net)}</span>
            <span className="dash-fin-net-sub">Day {finRollup.dayOfMonth}/{finRollup.daysInMonth}</span>
          </div>
          <div className="dash-fin-bars">
            <div className="dash-fin-bar-row clickable" onClick={() => navigate('/finances?tab=income')}>
              <div className="dash-fin-bar-label"><ArrowUpCircle size={12} /> Income</div>
              <div className="dash-fin-bar-track"><div className="dash-fin-bar-fill income" style={{ width: `${monthIncome > 0 ? Math.min(100, (monthIncome / Math.max(monthIncome, monthExpenses)) * 100) : 0}%` }} /></div>
              <span className="dash-fin-bar-val">{fmtCurrencyRounded(monthIncome)}</span>
            </div>
            <div className="dash-fin-bar-row clickable" onClick={() => navigate('/finances?tab=expenses')}>
              <div className="dash-fin-bar-label"><ArrowDownCircle size={12} /> Expenses</div>
              <div className="dash-fin-bar-track"><div className="dash-fin-bar-fill expense" style={{ width: `${monthExpenses > 0 ? Math.min(100, (monthExpenses / Math.max(monthIncome, monthExpenses)) * 100) : 0}%` }} /></div>
              <span className="dash-fin-bar-val">{fmtCurrencyRounded(monthExpenses)}</span>
            </div>
          </div>
          <div className="dash-fin-metrics">
            <div className="dash-fin-metric clickable" onClick={() => navigate('/finances?tab=analysis')}><Activity size={12} /><span>Daily Burn</span><strong>{fmtCurrencyRounded(finRollup.dailyBurn)}/d</strong></div>
            <div className="dash-fin-metric clickable" onClick={() => navigate('/finances?tab=analysis')}><TrendingUp size={12} /><span>Projected</span><strong className={finRollup.projectedNet >= 0 ? 'positive' : 'negative'}>{finRollup.projectedNet >= 0 ? '+' : ''}{fmtCurrencyRounded(finRollup.projectedNet)}</strong></div>
            <div className="dash-fin-metric clickable" onClick={() => navigate('/finances?tab=analysis')}><PiggyBank size={12} /><span>Savings Rate</span><strong className={finRollup.savingsRate >= 0 ? 'positive' : 'negative'}>{finRollup.savingsRate.toFixed(0)}%</strong></div>
            <div className="dash-fin-metric clickable" onClick={() => navigate('/finances?tab=bills')}><Receipt size={12} /><span>Bills Due</span><strong>{finRollup.monthBills > 0 ? `${finRollup.monthBills} (${fmtCurrencyRounded(finRollup.billsTotal)})` : '✓ Clear'}</strong></div>
          </div>
          {finRollup.totalBudget > 0 && (
            <div className="dash-fin-budget clickable" onClick={() => navigate('/goals')}>
              <div className="dash-fin-budget-header"><Wallet size={12} /><span>Goal Budgets</span><strong>{fmtCurrencyRounded(finRollup.totalBudget)} allocated</strong></div>
              <div className="dash-fin-budget-bar"><div className="dash-fin-budget-fill" style={{ width: `${Math.min(finRollup.budgetUtil * 100, 100)}%`, background: finRollup.budgetUtil > 0.9 ? '#F43F5E' : finRollup.budgetUtil > 0.7 ? '#F97316' : '#39FF14' }} /></div>
              <span className="dash-fin-budget-pct">{Math.round(finRollup.budgetUtil * 100)}% used</span>
            </div>
          )}
          {overdueBills.length > 0 && (
            <div className="dash-fin-alert clickable" onClick={() => navigate('/finances?tab=bills')}>
              <AlertTriangle size={12} /> {overdueBills.length} overdue bill{overdueBills.length > 1 ? 's' : ''} — {fmtCurrencyRounded(overdueBills.reduce((s: number, b: Bill) => s + b.amount, 0))}
            </div>
          )}
          {upcomingBills.length > 0 && (
            <div className="dash-fin-upcoming">
              {upcomingBills.map((b: Bill) => (
                <div key={b.id} className="dash-fin-bill clickable" onClick={() => navigate('/finances?tab=bills')}>
                  <Receipt size={10} /><span>{b.title}</span><strong>{fmtCurrencyRounded(b.amount)}</strong>
                  <span className="dash-fin-bill-date">{b.due_date ? formatDateShort(b.due_date) : ''}</span>
                </div>
              ))}
            </div>
          )}
          {businesses.length > 0 && (
            <div className="dash-fin-biz">
              {businesses.map((b: Business) => {
                const bizNet = businessNetMap.get(b.id) || 0;
                return (
                  <div key={b.id} className="dash-fin-biz-row clickable" onClick={() => navigate('/finances?tab=work')}>
                    <span className="dash-fin-biz-icon"><EmojiIcon emoji={b.icon || '💼'} size={16} fallbackAsText /></span>
                    <span className="dash-fin-biz-name">{b.name}</span>
                    <strong className={bizNet >= 0 ? 'positive' : 'negative'}>{bizNet >= 0 ? '+' : ''}{fmtCurrencyRounded(bizNet)}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </>
    );
  }
);
