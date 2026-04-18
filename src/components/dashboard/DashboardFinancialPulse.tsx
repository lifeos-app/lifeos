/**
 * DashboardFinancialPulse — Compact income vs expense trend card.
 *
 * Shows current month's income, expenses, and net trend.
 * Uses useFinanceStore for financial data.
 */

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useFinanceStore } from '../../stores/useFinanceStore';

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(17, 24, 39, 0.5)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 16,
  padding: 16,
  position: 'relative',
  overflow: 'hidden',
};

function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return `$${(abs / 1000).toFixed(1)}k`;
  return `$${abs.toFixed(0)}`;
}

/** Simple 7-segment sparkline using divs — no external dependency */
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map(Math.abs), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24 }}>
      {data.slice(-7).map((val, i) => {
        const pct = Math.abs(val) / max;
        const isNeg = val < 0;
        return (
          <div key={i} style={{
            width: 6, borderRadius: 2,
            height: Math.max(pct * 20, 2),
            background: isNeg ? `${color}40` : color,
            opacity: 0.6 + pct * 0.4,
            transition: 'height 0.3s',
          }} />
        );
      })}
    </div>
  );
}

export function DashboardFinancialPulse() {
  const { income, expenses } = useFinanceStore(s => ({ income: s.income, expenses: s.expenses }));

  const somStr = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  }, []);

  const lastMonthStr = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    return d.toISOString().split('T')[0];
  }, []);

  const thisMonthEnd = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  const { monthIncome, monthExpenses, net, prevIncome, prevExpenses, incomeTrend, expenseTrend } = useMemo(() => {
    const mIncome = income.filter(i => i.date >= somStr && i.date <= thisMonthEnd).reduce((s, i) => s + i.amount, 0);
    const mExpenses = expenses.filter(e => e.date >= somStr && e.date <= thisMonthEnd).reduce((s, e) => s + e.amount, 0);

    const pIncome = income.filter(i => i.date >= lastMonthStr && i.date < somStr).reduce((s, i) => s + i.amount, 0);
    const pExpenses = expenses.filter(e => e.date >= lastMonthStr && e.date < somStr).reduce((s, e) => s + e.amount, 0);

    const iTrend = pIncome > 0 ? ((mIncome - pIncome) / pIncome) * 100 : (mIncome > 0 ? 100 : 0);
    const eTrend = pExpenses > 0 ? ((mExpenses - pExpenses) / pExpenses) * 100 : (mExpenses > 0 ? 100 : 0);

    return { monthIncome: mIncome, monthExpenses: mExpenses, net: mIncome - mExpenses, prevIncome: pIncome, prevExpenses: pExpenses, incomeTrend: iTrend, expenseTrend: eTrend };
  }, [income, expenses, somStr, thisMonthEnd, lastMonthStr]);

  // Build sparkline data: daily income - daily expense for last 7 days
  const sparklineData = useMemo(() => {
    const points: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayIncome = income.filter(x => x.date === dateStr).reduce((s, x) => s + x.amount, 0);
      const dayExpense = expenses.filter(x => x.date === dateStr).reduce((s, x) => s + x.amount, 0);
      points.push(dayIncome - dayExpense);
    }
    return points;
  }, [income, expenses]);

  const isPositiveNet = net >= 0;

  return (
    <div className="dash-card" style={{
      ...CARD_STYLE,
      border: `1px solid ${isPositiveNet ? 'rgba(57,255,20,0.1)' : 'rgba(244,63,94,0.1)'}`,
    }}>
      {/* Subtle glow */}
      <div style={{
        position: 'absolute', top: -15, right: -15,
        width: 60, height: 60, borderRadius: '50%',
        background: `radial-gradient(circle, ${isPositiveNet ? 'rgba(57,255,20,0.08)' : 'rgba(244,63,94,0.08)'} 0%, transparent 70%)`,
        pointerEvents: 'none',
        transition: 'background 0.5s',
      }} />

      <div style={{
        fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 12,
      }}>
        <DollarSign size={14} color={isPositiveNet ? '#39FF14' : '#F43F5E'} />
        Financial Pulse
      </div>

      {/* Net position */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 14,
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22, fontWeight: 700,
          color: isPositiveNet ? '#39FF14' : '#F43F5E',
          transition: 'color 0.3s',
        }}>
          {isPositiveNet ? '+' : '-'}{fmtMoney(net)}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 600,
          color: '#8BA4BE', textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          this month
        </span>
      </div>

      {/* Income / Expenses split */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#8BA4BE', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
            <ArrowUpRight size={9} color="#39FF14" /> Income
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#39FF14', fontFamily: 'var(--font-display)' }}>
            {fmtMoney(monthIncome)}
          </div>
          {incomeTrend !== 0 && (
            <div style={{ fontSize: 9, color: incomeTrend > 0 ? '#39FF14' : '#F43F5E', fontWeight: 500 }}>
              {incomeTrend > 0 ? '↑' : '↓'} {Math.abs(incomeTrend).toFixed(0)}% vs last
            </div>
          )}
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#8BA4BE', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
            <ArrowDownRight size={9} color="#F43F5E" /> Expenses
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F43F5E', fontFamily: 'var(--font-display)' }}>
            {fmtMoney(monthExpenses)}
          </div>
          {expenseTrend !== 0 && (
            <div style={{ fontSize: 9, color: expenseTrend > 0 ? '#F43F5E' : '#39FF14', fontWeight: 500 }}>
              {expenseTrend > 0 ? '↑' : '↓'} {Math.abs(expenseTrend).toFixed(0)}% vs last
            </div>
          )}
        </div>
      </div>

      {/* Daily sparkline */}
      <MiniSparkline data={sparklineData} color={isPositiveNet ? '#39FF14' : '#F43F5E'} />

      {/* Hermetic touch */}
      <div style={{
        marginTop: 8, fontSize: 9, color: 'rgba(255,255,255,0.15)',
        textAlign: 'center', fontStyle: 'italic',
      }}>
        As within your ledger, so without your life
      </div>
    </div>
  );
}