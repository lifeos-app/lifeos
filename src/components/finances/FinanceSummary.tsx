/**
 * FinanceSummary — Summary stat cards for the Finances page.
 * Shows income, expenses, net and upcoming bills.
 */

import { ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, Receipt } from 'lucide-react';
import { MiniChart } from '../MiniChart';
import { fmtCurrency } from '../../utils/date';
import type { Bill } from './types';

interface FinanceSummaryProps {
  monthIncome: number;
  monthExpenses: number;
  net: number;
  upcomingBillsTotal: number;
  overdueBills: Bill[];
  monthlyData: { month: string; income: number; expenses: number }[];
}

export function FinanceSummary({
  monthIncome,
  monthExpenses,
  net,
  upcomingBillsTotal,
  overdueBills,
  monthlyData,
}: FinanceSummaryProps) {
  return (
    <div className="fin-stats">
      <div className="fin-stat income">
        <ArrowUpCircle size={18} />
        <div className="fin-stat-body">
          <span className="fin-stat-label">Income (Month)</span>
          <span className="fin-stat-value">{fmtCurrency(monthIncome)}</span>
        </div>
        {monthlyData.length > 1 && (
          <div className="fin-stat-spark">
            <MiniChart data={monthlyData.map(m => m.income)} color="#39FF14" height={40} />
          </div>
        )}
      </div>
      <div className="fin-stat expense">
        <ArrowDownCircle size={18} />
        <div className="fin-stat-body">
          <span className="fin-stat-label">Expenses (Month)</span>
          <span className="fin-stat-value">{fmtCurrency(monthExpenses)}</span>
        </div>
        {monthlyData.length > 1 && (
          <div className="fin-stat-spark">
            <MiniChart data={monthlyData.map(m => m.expenses)} color="#F43F5E" height={40} />
          </div>
        )}
      </div>
      <div className={`fin-stat ${net >= 0 ? 'positive' : 'negative'}`}>
        {net >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
        <div className="fin-stat-body">
          <span className="fin-stat-label">Net</span>
          <span className="fin-stat-value">{net >= 0 ? '+' : ''}{fmtCurrency(net)}</span>
        </div>
        {monthlyData.length > 1 && (
          <div className="fin-stat-spark">
            <MiniChart data={monthlyData.map(m => m.income - m.expenses)} color={net >= 0 ? '#39FF14' : '#F43F5E'} height={40} />
          </div>
        )}
      </div>
      <div className={`fin-stat bills ${overdueBills.length > 0 ? 'overdue' : ''}`}>
        <Receipt size={18} />
        <div className="fin-stat-body">
          <span className="fin-stat-label">Upcoming Bills</span>
          <span className="fin-stat-value">{fmtCurrency(upcomingBillsTotal)}</span>
        </div>
      </div>
    </div>
  );
}