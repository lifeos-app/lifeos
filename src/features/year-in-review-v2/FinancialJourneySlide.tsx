/**
 * FinancialJourneySlide — Money story
 *
 * Income over time area chart, total earned/saved,
 * biggest expense category, net worth trajectory,
 * smart financial decisions callouts.
 */

import React, { useEffect, useState } from 'react';
import { CountUp, AmbientParticles } from './SlideTransition';
import type { FinanceYearData } from './useYearInReview';

interface FinancialJourneySlideProps {
  data: FinanceYearData;
  active: boolean;
}

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function FinancialJourneySlide({ data, active }: FinancialJourneySlideProps) {
  const [chartVisible, setChartVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);

  useEffect(() => {
    if (!active) { setChartVisible(false); setDetailsVisible(false); return; }
    const t1 = setTimeout(() => setChartVisible(true), 500);
    const t2 = setTimeout(() => setDetailsVisible(true), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active]);

  const maxVal = Math.max(...data.monthlyIncome, ...data.monthlyExpenses, 1);
  const chartH = 140;

  // Net worth trajectory (cumulative savings)
  const netWorthTrajectory: number[] = [];
  let cumulative = data.netWorthStart;
  for (let i = 0; i < 12; i++) {
    cumulative += data.monthlyIncome[i] - data.monthlyExpenses[i];
    netWorthTrajectory.push(cumulative);
  }

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Background */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, #0d1b2a 0%, #1b3a4b 50%, #0a1628 100%)' }}
      />

      <AmbientParticles count={15} color="rgba(250, 204, 21, 0.15)" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-5">
        {/* Title */}
        <div className="text-center" style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-2">
            Your Financial Story
          </h2>
          <p className="text-white/50 text-base sm:text-lg">
            Where your money went — and where it grew
          </p>
        </div>

        {/* Big Numbers */}
        <div className="grid grid-cols-3 gap-4 w-full" style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div className="flex flex-col items-center gap-1 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-white/50 text-xs uppercase tracking-wider">Earned</span>
            <span className="text-emerald-400 font-bold text-lg sm:text-2xl">
              $<CountUp end={data.totalIncome} duration={2000} trigger={active} />
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
            <span className="text-white/50 text-xs uppercase tracking-wider">Spent</span>
            <span className="text-red-400 font-bold text-lg sm:text-2xl">
              $<CountUp end={data.totalExpenses} duration={2000} trigger={active} />
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
            <span className="text-white/50 text-xs uppercase tracking-wider">Saved</span>
            <span className={`${data.netSavings >= 0 ? 'text-cyan-400' : 'text-red-400'} font-bold text-lg sm:text-2xl`}>
              $<CountUp end={Math.abs(data.netSavings)} duration={2000} trigger={active} />
            </span>
          </div>
        </div>

        {/* Income vs Expenses Chart */}
        <div className="w-full p-4 rounded-2xl bg-white/5 border border-white/5" style={{
          opacity: chartVisible ? 1 : 0,
          transform: chartVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s 500ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div className="text-white/50 text-xs mb-3">Income vs Expenses</div>
          <div className="relative" style={{ height: chartH }}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <div key={pct} className="absolute left-0 right-0 border-t border-white/5"
                style={{ bottom: pct * (chartH - 8) }}
              />
            ))}

            <svg className="absolute inset-0 w-full" height={chartH} preserveAspectRatio="none">
              {/* Income area */}
              <path
                d={buildAreaPath(data.monthlyIncome, maxVal, chartH)}
                fill="rgba(16, 185, 129, 0.2)"
                stroke="#10b981"
                strokeWidth="2"
                style={{
                  strokeDasharray: 2000,
                  strokeDashoffset: chartVisible ? 0 : 2000,
                  transition: 'stroke-dashoffset 2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
              {/* Expenses area */}
              <path
                d={buildAreaPath(data.monthlyExpenses, maxVal, chartH)}
                fill="rgba(239, 68, 68, 0.15)"
                stroke="#ef4444"
                strokeWidth="2"
                style={{
                  strokeDasharray: 2000,
                  strokeDashoffset: chartVisible ? 0 : 2000,
                  transition: 'stroke-dashoffset 2s 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </svg>

            {/* Month labels */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1">
              {MONTHS.map((m, i) => (
                <span key={i} className="text-white/20 text-[8px] sm:text-[10px]">{m}</span>
              ))}
            </div>
          </div>

          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-white/40 text-[10px]">Income</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-white/40 text-[10px]">Expenses</span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="w-full grid grid-cols-2 gap-3" style={{
          opacity: detailsVisible ? 1 : 0,
          transform: detailsVisible ? 'translateY(0)' : 'translateY(15px)',
          transition: 'all 0.6s 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {/* Top expense category */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="text-white/40 text-xs mb-1">Biggest Expense</div>
            <div className="text-yellow-400 font-bold text-lg">{data.topExpenseCategory}</div>
            <div className="text-white/30 text-xs">
              ${data.topExpenseAmount.toFixed(0)}
            </div>
          </div>

          {/* Income per work hour */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="text-white/40 text-xs mb-1">Earning Power</div>
            <div className="text-emerald-400 font-bold text-lg">
              {data.incomePerWorkHour
                ? `$${data.incomePerWorkHour.toFixed(2)}/hr`
                : `${data.totalIncome > 0 ? '$' + (data.totalIncome / 2080).toFixed(2) + '/hr*' : 'N/A'}`
              }
            </div>
            <div className="text-white/30 text-xs">
              {data.incomePerWorkHour ? 'Based on logged hours' : '*Estimated'}
            </div>
          </div>
        </div>

        {/* Smart Decisions */}
        {data.smartDecisions.length > 0 && (
          <div className="w-full space-y-2" style={{
            opacity: detailsVisible ? 1 : 0,
            transition: 'opacity 0.6s 1.6s',
          }}>
            {data.smartDecisions.map((decision, i) => (
              <div key={i} className="px-4 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
                <span className="text-emerald-300/80 text-sm">💡 {decision}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function buildAreaPath(values: number[], maxVal: number, height: number): string {
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = height - (v / maxVal) * (height - 8);
    return `${x},${y}`;
  });

  // Area path: line + close to bottom
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p}`).join(' ');
  const closePath = ` L 100,${height} L 0,${height} Z`;

  return linePath + closePath;
}

export default FinancialJourneySlide;