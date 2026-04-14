/**
 * TCSDrivingWidget — Driving/mileage at a glance
 *
 * Compact dashboard card showing km and ATO deduction summaries
 * for this week, this month, and the current FY.
 * Includes a streak counter and pace comparison vs last month.
 */

import React, { useMemo } from 'react';
import { Car, Flame, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { localDateStr } from '../../utils/date';
import { ATO_RATE } from '../../lib/tcs-config';
import './TCSDrivingWidget.css';

// ── Local Helpers ──

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const dow = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((dow + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    start: formatDateISO(mon),
    end: formatDateISO(sun),
  };
}

function getFYStart(): string {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1; // July = month 6
  return `${year}-07-01`;
}

interface ExpenseEntry {
  travel_km?: number | null;
  amount: number;
  date: string;
  description: string;
  is_deductible: boolean;
}

function isDrivingExpense(e: ExpenseEntry): boolean {
  if (e.travel_km && e.travel_km > 0) return true;
  if (e.description.includes('Vehicle:')) return true;
  if (e.is_deductible && e.description.toLowerCase().includes('km')) return true;
  return false;
}

function formatKm(km: number): string {
  return km.toLocaleString('en-AU');
}

function formatDollars(n: number): string {
  return `$${n.toLocaleString('en-AU')}`;
}

// ── Component ──

export function TCSDrivingWidget() {
  const expenses = useFinanceStore(s => s.expenses);

  const drivingExpenses = useMemo(
    () => expenses.filter(isDrivingExpense),
    [expenses]
  );

  // Week range
  const { start: weekStart, end: weekEnd } = useMemo(getWeekRange, []);

  // Current month prefix
  const currentMonthPrefix = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Last month prefix + same-day-of-month cutoff
  const { lastMonthPrefix, lastMonthDayCutoff } = useMemo(() => {
    const now = new Date();
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prefix = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}`;
    return {
      lastMonthPrefix: prefix,
      lastMonthDayCutoff: now.getDate(),
    };
  }, []);

  // FY start
  const fyStart = useMemo(getFYStart, []);

  // Today
  const today = useMemo(localDateStr, []);

  // ── Calculations ──

  const weekStats = useMemo(() => {
    let km = 0;
    let deduction = 0;
    for (const e of drivingExpenses) {
      if (e.date >= weekStart && e.date <= weekEnd) {
        km += e.travel_km || 0;
        deduction += e.amount || 0;
      }
    }
    // If no explicit amount, calculate from km * ATO_RATE
    if (deduction === 0 && km > 0) {
      deduction = km * ATO_RATE;
    }
    return { km, deduction };
  }, [drivingExpenses, weekStart, weekEnd]);

  const monthStats = useMemo(() => {
    let km = 0;
    let deduction = 0;
    for (const e of drivingExpenses) {
      if (e.date.startsWith(currentMonthPrefix)) {
        km += e.travel_km || 0;
        deduction += e.amount || 0;
      }
    }
    if (deduction === 0 && km > 0) {
      deduction = km * ATO_RATE;
    }
    return { km, deduction };
  }, [drivingExpenses, currentMonthPrefix]);

  const fyStats = useMemo(() => {
    let km = 0;
    let deduction = 0;
    for (const e of drivingExpenses) {
      if (e.date >= fyStart) {
        km += e.travel_km || 0;
        deduction += e.amount || 0;
      }
    }
    if (deduction === 0 && km > 0) {
      deduction = km * ATO_RATE;
    }
    return { km, deduction };
  }, [drivingExpenses, fyStart]);

  // Pace: this month km vs last month km at same day-of-month
  const pace = useMemo(() => {
    let lastMonthKm = 0;
    for (const e of drivingExpenses) {
      if (e.date.startsWith(lastMonthPrefix)) {
        const day = parseInt(e.date.slice(8, 10), 10);
        if (day <= lastMonthDayCutoff) {
          lastMonthKm += e.travel_km || 0;
        }
      }
    }
    if (lastMonthKm === 0) return null;
    const pct = ((monthStats.km - lastMonthKm) / lastMonthKm) * 100;
    return Math.round(pct);
  }, [drivingExpenses, lastMonthPrefix, lastMonthDayCutoff, monthStats.km]);

  // Streak: consecutive days with at least one km expense, backwards from today
  const streak = useMemo(() => {
    // Build a set of dates that have driving expenses
    const datesWithKm = new Set<string>();
    for (const e of drivingExpenses) {
      if (e.travel_km && e.travel_km > 0) {
        datesWithKm.add(e.date);
      }
    }

    let count = 0;
    const d = new Date();
    // Walk backwards from today
    while (true) {
      const ds = formatDateISO(d);
      if (datesWithKm.has(ds)) {
        count++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [drivingExpenses]);

  // Pace display
  const paceDisplay = useMemo(() => {
    if (pace === null) return null;
    if (pace > 0) {
      return { text: `Ahead +${pace}% vs last month`, positive: true };
    }
    if (pace < 0) {
      return { text: `Behind ${pace}% vs last month`, positive: false };
    }
    return { text: 'On pace vs last month', positive: null };
  }, [pace]);

  return (
    <div className="tcs-driving-widget">
      {/* Header */}
      <div className="tcs-driving-header">
        <div className="tcs-driving-header-left">
          <Car size={16} className="tcs-driving-icon" />
          <h3 className="tcs-driving-title">Driving</h3>
        </div>
        {streak > 0 && (
          <div className="tcs-driving-streak">
            <Flame size={14} className="tcs-driving-streak-icon" />
            <span className="tcs-driving-streak-value">{streak}d</span>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="tcs-driving-stats">
        <div className="tcs-driving-stat">
          <span className="tcs-driving-stat-label">This Week</span>
          <span className="tcs-driving-stat-km">{formatKm(weekStats.km)}km</span>
          <span className="tcs-driving-stat-dollar">{formatDollars(Math.round(weekStats.deduction))}</span>
        </div>
        <div className="tcs-driving-stat">
          <span className="tcs-driving-stat-label">This Month</span>
          <span className="tcs-driving-stat-km">{formatKm(monthStats.km)}km</span>
          <span className="tcs-driving-stat-dollar">{formatDollars(Math.round(monthStats.deduction))}</span>
        </div>
        <div className="tcs-driving-stat">
          <span className="tcs-driving-stat-label">FY Total</span>
          <span className="tcs-driving-stat-km">{formatKm(fyStats.km)}km</span>
          <span className="tcs-driving-stat-dollar">{formatDollars(Math.round(fyStats.deduction))}</span>
        </div>
      </div>

      {/* Pace comparison */}
      {paceDisplay && (
        <div className={`tcs-driving-pace ${paceDisplay.positive === true ? 'positive' : ''} ${paceDisplay.positive === false ? 'negative' : ''}`}>
          {paceDisplay.positive === true && <TrendingUp size={14} />}
          {paceDisplay.positive === false && <TrendingDown size={14} />}
          {paceDisplay.positive === null && <Minus size={14} />}
          <span>{paceDisplay.text}</span>
        </div>
      )}
    </div>
  );
}

export default TCSDrivingWidget;