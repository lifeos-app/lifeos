/**
 * MonthlyRevenueCard — Current month revenue with vs last month indicator
 * and progress bar toward monthly target ($6,000).
 *
 * Sources: FinanceStore income for current & last month
 */

import { useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Minus, Target, DollarSign,
} from 'lucide-react'
import { useFinanceStore } from '../../stores/useFinanceStore'
import { TCS_CONFIG } from '../../lib/tcs-config'
import { fmtCurrency, thisMonth } from '../../utils/date'
import './MonthlyRevenueCard.css'

const MONTHLY_TARGET = 6000 // $6,000 target as specified

export function MonthlyRevenueCard() {
  const income = useFinanceStore(s => s.income)

  const currentMonth = useMemo(() => thisMonth(), [])
  const lastMonth = useMemo(() => {
    const now = new Date()
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const { currentRevenue, lastMonthRevenue, change } = useMemo(() => {
    const current = income
      .filter(i => i.date.startsWith(currentMonth) && !i.is_deleted)
      .reduce((sum, i) => sum + (i.amount || 0), 0)

    const last = income
      .filter(i => i.date.startsWith(lastMonth) && !i.is_deleted)
      .reduce((sum, i) => sum + (i.amount || 0), 0)

    const pct = last > 0 ? ((current - last) / last) * 100 : current > 0 ? 100 : 0

    return { currentRevenue: current, lastMonthRevenue: last, change: pct }
  }, [income, currentMonth, lastMonth])

  const progressPct = Math.min((currentRevenue / MONTHLY_TARGET) * 100, 100)
  const isUp = change > 0
  const isDown = change < 0

  return (
    <div className="monthly-revenue-card">
      <div className="mrc-header">
        <div className="mrc-header-left">
          <div className="mrc-icon-wrap">
            <DollarSign size={16} />
          </div>
          <h3 className="mrc-title">Monthly Revenue</h3>
        </div>
        <span className="mrc-month">{currentMonth}</span>
      </div>

      {/* Big number + vs last month */}
      <div className="mrc-main">
        <span className="mrc-amount">{fmtCurrency(currentRevenue)}</span>
        <div className={`mrc-change ${isUp ? 'up' : isDown ? 'down' : ''}`}>
          {isUp ? <TrendingUp size={12} /> : isDown ? <TrendingDown size={12} /> : <Minus size={12} />}
          <span>{isFinite(change) ? `${change > 0 ? '+' : ''}${change.toFixed(0)}%` : '—'}</span>
          <span className="mrc-vs-label">vs last month</span>
        </div>
      </div>

      {/* Progress bar toward target */}
      <div className="mrc-target">
        <div className="mrc-target-row">
          <div className="mrc-target-label">
            <Target size={11} />
            <span>Target: {fmtCurrency(MONTHLY_TARGET)}</span>
          </div>
          <span className="mrc-target-pct">{Math.round(progressPct)}%</span>
        </div>
        <div className="mrc-bar-track">
          <div
            className="mrc-bar-fill"
            style={{
              width: `${progressPct}%`,
              background: progressPct >= 80
                ? 'linear-gradient(90deg, #00D4FF, #39FF14)'
                : progressPct >= 50
                  ? 'linear-gradient(90deg, #00D4FF, #0088AA)'
                  : 'linear-gradient(90deg, #F97316, #F97316)',
            }}
          />
        </div>
        <div className="mrc-bar-footer">
          <span>{fmtCurrency(currentRevenue)} earned</span>
          <span>{fmtCurrency(Math.max(0, MONTHLY_TARGET - currentRevenue))} to go</span>
        </div>
      </div>

      {/* Last month reference */}
      <div className="mrc-last-month">
        <span className="mrc-lm-label">Last month</span>
        <span className="mrc-lm-value">{fmtCurrency(lastMonthRevenue)}</span>
      </div>
    </div>
  )
}