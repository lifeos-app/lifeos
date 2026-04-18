/**
 * BusinessHealthScore — Composite score (0-100) based on:
 *   - Revenue diversification (fewer clients = lower score)
 *   - Revenue growth vs last month
 *   - Expense ratio (expenses / income)
 *
 * Displayed as a circular SVG gauge.
 *
 * Sources: FinanceStore income, expenses, clients
 */

import { useMemo } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Minus } from 'lucide-react'
import { useFinanceStore } from '../../stores/useFinanceStore'
import { thisMonth, fmtCurrency } from '../../utils/date'
import './BusinessHealthScore.css'

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function scoreColor(score: number): string {
  if (score >= 70) return '#39FF14'
  if (score >= 45) return '#FACC15'
  if (score >= 25) return '#F97316'
  return '#F43F5E'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  if (score >= 20) return 'Needs Work'
  return 'Critical'
}

export function BusinessHealthScore() {
  const income = useFinanceStore(s => s.income)
  const expenses = useFinanceStore(s => s.expenses)
  const clients = useFinanceStore(s => s.clients)

  const currentMonth = useMemo(() => thisMonth(), [])
  const lastMonth = useMemo(() => {
    const now = new Date()
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const { score, diversification, growth, expenseRatio } = useMemo(() => {
    // Active clients with income this month
    const activeClients = clients.filter(c => c.is_active && !c.is_deleted)
    const clientCount = Math.max(activeClients.length, 1)

    // Diversification score:
    // 1 client = 10, 2 = 30, 3 = 50, 4 = 65, 5+ = 80
    // Max contribution: 30 points
    const rawDiv = Math.min(clientCount * 15, 80)
    const divScore = (rawDiv / 80) * 30 // 0-30

    // Revenue growth vs last month (0-40 points)
    const currentRevenue = income
      .filter(i => i.date.startsWith(currentMonth) && !i.is_deleted)
      .reduce((s, i) => s + (i.amount || 0), 0)

    const lastRevenue = income
      .filter(i => i.date.startsWith(lastMonth) && !i.is_deleted)
      .reduce((s, i) => s + (i.amount || 0), 0)

    let growthScore = 20 // neutral starting point (gives 40pts * 20/40 = 20)
    if (lastRevenue > 0) {
      const growthPct = ((currentRevenue - lastRevenue) / lastRevenue) * 100
      if (growthPct > 20) growthScore = 40
      else if (growthPct > 10) growthScore = 35
      else if (growthPct > 0) growthScore = 28
      else if (growthPct > -10) growthScore = 18
      else if (growthPct > -20) growthScore = 10
      else growthScore = 0
    } else if (currentRevenue > 0) {
      growthScore = 30 // some income, no baseline
    }
    const growthPoints = (growthScore / 40) * 40 // 0-40

    // Expense ratio (0-30 points, lower ratio = better)
    const currentExpenses = expenses
      .filter(e => e.date.startsWith(currentMonth) && !e.is_deleted)
      .reduce((s, e) => s + (e.amount || 0), 0)

    const ratio = currentRevenue > 0 ? currentExpenses / currentRevenue : 1
    let ratioScore = 0
    if (ratio < 0.1) ratioScore = 30
    else if (ratio < 0.2) ratioScore = 26
    else if (ratio < 0.3) ratioScore = 22
    else if (ratio < 0.4) ratioScore = 18
    else if (ratio < 0.5) ratioScore = 14
    else if (ratio < 0.7) ratioScore = 8
    else if (ratio < 1.0) ratioScore = 4
    else ratioScore = 0

    const total = Math.round(Math.min(divScore + growthPoints + ratioScore, 100))

    return {
      score: total,
      diversification: Math.round(divScore),
      growth: Math.round(growthPoints),
      expenseRatio: ratio,
    }
  }, [income, expenses, clients, currentMonth, lastMonth])

  const color = scoreColor(score)
  const label = scoreLabel(score)

  // SVG gauge arc
  const svgSize = 120
  const cx = svgSize / 2
  const cy = svgSize / 2
  const r = 46
  const startAngle = 0
  const endAngle = 360
  const valueAngle = (score / 100) * 360

  const bgPath = arcPath(cx, cy, r, startAngle, endAngle)
  const valuePath = score > 0 ? arcPath(cx, cy, r, startAngle, valueAngle) : ''

  return (
    <div className="bhs-card">
      <div className="bhs-header">
        <div className="bhs-header-left">
          <div className="bhs-icon-wrap">
            <Activity size={16} />
          </div>
          <h3 className="bhs-title">Business Health</h3>
        </div>
      </div>

      {/* Circular gauge */}
      <div className="bhs-gauge-wrap">
        <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
          {/* Background circle track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="8"
          />
          {/* Value arc */}
          {score > 0 && (
            <circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * r}`}
              strokeDashoffset={`${2 * Math.PI * r * (1 - score / 100)}`}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          )}
          {/* Glow effect */}
          {score > 0 && (
            <circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * r}`}
              strokeDashoffset={`${2 * Math.PI * r * (1 - score / 100)}`}
              transform={`rotate(-90 ${cx} ${cy})`}
              opacity="0.15"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          )}
        </svg>
        <div className="bhs-gauge-inner">
          <span className="bhs-score" style={{ color }}>{score}</span>
          <span className="bhs-max">/100</span>
        </div>
      </div>

      {/* Score label */}
      <div className="bhs-label" style={{ color }}>{label}</div>

      {/* Breakdown */}
      <div className="bhs-breakdown">
        <div className="bhs-breakdown-row">
          <span className="bhs-bd-label">Diversification</span>
          <div className="bhs-bd-bar-track">
            <div className="bhs-bd-bar-fill" style={{ width: `${(diversification / 30) * 100}%`, background: '#00D4FF' }} />
          </div>
          <span className="bhs-bd-value">{diversification}/30</span>
        </div>
        <div className="bhs-breakdown-row">
          <span className="bhs-bd-label">Revenue Growth</span>
          <div className="bhs-bd-bar-track">
            <div className="bhs-bd-bar-fill" style={{ width: `${(growth / 40) * 100}%`, background: '#39FF14' }} />
          </div>
          <span className="bhs-bd-value">{growth}/40</span>
        </div>
        <div className="bhs-breakdown-row">
          <span className="bhs-bd-label">Expense Ratio</span>
          <div className="bhs-bd-bar-track">
            <div className="bhs-bd-bar-fill" style={{ width: `${Math.max(0, (1 - expenseRatio)) * 100}%`, background: '#FACC15' }} />
          </div>
          <span className="bhs-bd-value">{(expenseRatio * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  )
}