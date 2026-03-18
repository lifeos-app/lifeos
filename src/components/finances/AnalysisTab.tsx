import React from 'react';
import { useFinances } from './FinancesContext';
import { fmtCurrency, fmtShort } from './types';
import { AreaChart, BarChart, SparkLine } from '../charts';
import { EmojiIcon } from '../../lib/emoji-icon';
import {
  Target, BarChart3, TrendingUp, Briefcase, Receipt, MapPin,
} from 'lucide-react';

export const AnalysisTab = React.memo(function AnalysisTab() {
  const ctx = useFinances();
  const {
    transactions,
    savingsRate, analysisIncome, analysisExpenses,
    categoryTrends, businessPL, deductibleExpenses,
  } = ctx;

  return (
    <div className="fin-analysis">
      {/* Savings rate */}
      <div className="fin-glass-card">
        <div className="fin-section-label"><Target size={11} /> Savings Rate (6 months)</div>
        <AreaChart
          series={[{ data: savingsRate.map(s => Math.max(s.rate, 0)), color: '#00D4FF', label: 'Savings Rate %', fillOpacity: 0.2 }]}
          labels={savingsRate.map(s => s.month)}
          height={110}
        />
        <p className="fin-analysis-note">Savings rate = (Income − Expenses) / Income × 100%</p>
      </div>

      {/* Monthly comparison */}
      <div className="fin-glass-card fin-analysis-card">
        <div className="fin-section-label"><BarChart3 size={11} /> Monthly Comparison</div>
        <BarChart
          series={[
            { data: [analysisIncome.thisMonth, analysisIncome.lastMonth, analysisIncome.avg3Month], color: '#39FF14', label: 'Income' },
            { data: [analysisExpenses.thisMonth, analysisExpenses.lastMonth, analysisExpenses.avg3Month], color: '#F43F5E', label: 'Expenses' },
          ]}
          labels={['This Month', 'Last Month', '3mo Avg']}
          height={140}
          showValues
        />
        <div className="fin-comparison-grid">
          {[
            { label: 'This Month', inc: analysisIncome.thisMonth, exp: analysisExpenses.thisMonth },
            { label: 'Last Month', inc: analysisIncome.lastMonth, exp: analysisExpenses.lastMonth },
            { label: '3-mo Avg', inc: analysisIncome.avg3Month, exp: analysisExpenses.avg3Month },
          ].map(({ label, inc, exp }) => (
            <div key={label} className="fin-comparison-item">
              <span className="fin-comparison-label">{label}</span>
              <div className="fin-comparison-values">
                <span className="fin-comparison-income">{fmtShort(inc)}</span>
                <span className="fin-comparison-sep">−</span>
                <span className="fin-comparison-expense">{fmtShort(exp)}</span>
                <span className="fin-comparison-sep">=</span>
                <span className={`fin-comparison-net ${(inc - exp) >= 0 ? 'positive' : 'negative'}`}>{(inc - exp) >= 0 ? '+' : ''}{fmtShort(inc - exp)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category trends */}
      {categoryTrends.filter(({ trend }) => trend.some(v => v > 0)).length > 0 && (
        <div className="fin-glass-card">
          <div className="fin-section-label"><TrendingUp size={11} /> Category Trends (6 months)</div>
          <div className="fin-trends-grid">
            {categoryTrends.filter(({ trend }) => trend.some(v => v > 0)).map(({ cat, trend }) => (
              <div key={cat.id} className="fin-trend-card">
                <div className="fin-trend-card-header">
                  <span style={{ color: cat.color || '#F43F5E', fontSize: 13 }}><EmojiIcon emoji={cat.icon || '📦'} size={13} fallbackAsText /></span>
                  <span className="fin-trend-card-name">{cat.name}</span>
                  <span className="fin-trend-card-val" style={{ color: cat.color || '#F43F5E' }}>{fmtCurrency(trend[trend.length - 1])}</span>
                </div>
                <SparkLine data={trend} color={cat.color || '#F43F5E'} width={200} height={36} filled />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Business P&L */}
      {businessPL.filter(({ plData }) => plData.some(p => p.revenue > 0 || p.expense > 0)).length > 0 && (
        <div className="fin-glass-card fin-analysis-card">
          <div className="fin-section-label"><Briefcase size={11} /> Business P&L (6 months)</div>
          {businessPL.filter(({ plData }) => plData.some(p => p.revenue > 0 || p.expense > 0)).map(({ biz, plData }) => (
            <div key={biz.id} className="fin-pl-row">
              <div className="fin-pl-header">
                <span style={{ color: biz.color || '#00D4FF' }}><EmojiIcon emoji={biz.icon || '💼'} size={14} fallbackAsText /></span>
                <span className="fin-pl-name">{biz.name}</span>
              </div>
              <AreaChart
                series={[
                  { data: plData.map(p => p.revenue), color: '#39FF14', label: 'Revenue', fillOpacity: 0.14 },
                  { data: plData.map(p => p.expense), color: '#F43F5E', label: 'Expenses', fillOpacity: 0.14 },
                ]}
                labels={plData.map(p => p.month)}
                height={90}
              />
            </div>
          ))}
        </div>
      )}

      {/* Tax deductions */}
      <div className="fin-glass-card fin-analysis-card">
        <div className="fin-section-label"><Receipt size={11} /> Tax Deductions</div>
        <div className="fin-deduction-summary">
          <span className="fin-deduction-label">Total deductible expenses (this month):</span>
          <span className="fin-deduction-value">{fmtCurrency(deductibleExpenses)}</span>
        </div>
      </div>

      {/* Travel/Mileage */}
      <div className="fin-glass-card fin-analysis-card">
        <div className="fin-section-label"><MapPin size={11} /> Travel & Mileage</div>
        {(() => {
          const travelTxs = transactions.filter(t => {
            if (!t.notes) return false;
            try { const n = JSON.parse(t.notes as string); return n.travel && (n.travel.km || n.travel.odometer); } catch { return false; }
          });
          const totalKm = travelTxs.reduce((s, t) => { try { const n = JSON.parse(t.notes as string); return s + (n.travel?.km || 0); } catch { return s; } }, 0);
          const travelCost = travelTxs.reduce((s, t) => s + t.amount, 0);
          const atoRate = 0.88;
          const atoClaim = totalKm * atoRate;
          return travelTxs.length > 0 ? (
            <div className="fin-travel-stats">
              <div className="fin-travel-row"><span>Total Distance:</span><span className="fin-travel-value">{totalKm.toFixed(1)} km</span></div>
              <div className="fin-travel-row"><span>Fuel/Travel Costs:</span><span className="fin-travel-value fin-travel-expense">{fmtCurrency(travelCost)}</span></div>
              <div className="fin-travel-row"><span>ATO Claim ({atoRate}¢/km):</span><span className="fin-travel-value fin-travel-income">{fmtCurrency(atoClaim)}</span></div>
              <div className="fin-travel-row"><span>Cost per km:</span><span className="fin-travel-value">{totalKm > 0 ? `$${(travelCost / totalKm).toFixed(2)}` : '—'}</span></div>
            </div>
          ) : (
            <p className="fin-empty-note">No travel expenses logged yet.</p>
          );
        })()}
      </div>
    </div>
  );
});
