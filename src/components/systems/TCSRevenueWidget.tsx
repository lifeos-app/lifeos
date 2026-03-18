// TCSRevenueWidget — Weekly revenue from completed cleaning jobs
//
// - Mini bar chart (last 7 days)
// - Comparison to last week (+/-%)
// - Total monthly revenue
// - Links to full Finances page

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Loader2, DollarSign,
  ChevronRight, AlertTriangle, Minus,
} from 'lucide-react'
import { useSystemBus } from '../../lib/systems/context'
import type { TCSAdapter } from '../../lib/systems/adapters/tcs'

interface TCSRevenueWidgetProps {
  compact?: boolean
}

interface WeeklyData {
  total: number
  daily: { date: string; amount: number }[]
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function fmtCurrency(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

function fmtPercent(n: number): string {
  if (!isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(0)}%`
}

// ── Mini Bar Chart ─────────────────────────────────────────────────────────
function MiniBarChart({ daily, compact }: { daily: { date: string; amount: number }[]; compact: boolean }) {
  const max = Math.max(...daily.map(d => d.amount), 1)
  const barHeight = compact ? 40 : 60

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: compact ? 4 : 6,
      height: barHeight + 20,
      padding: '0 4px',
    }}>
      {daily.map((day, i) => {
        const h = (day.amount / max) * barHeight
        const dayLabel = DAYS[i] ?? ''
        const isToday = i === new Date().getDay() - 1 || (new Date().getDay() === 0 && i === 6)

        return (
          <div key={i} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <div
              style={{
                width: '100%',
                maxWidth: compact ? 20 : 28,
                height: Math.max(h, 2),
                borderRadius: compact ? 3 : 4,
                background: day.amount > 0
                  ? isToday
                    ? 'linear-gradient(180deg, #00D4FF, #0088AA)'
                    : 'linear-gradient(180deg, rgba(0,212,255,0.6), rgba(0,212,255,0.3))'
                  : 'rgba(255,255,255,0.06)',
                transition: 'height 0.3s ease',
              }}
              title={`${dayLabel}: $${day.amount.toFixed(0)}`}
            />
            {!compact && (
              <span style={{
                fontSize: 10, fontWeight: isToday ? 700 : 400,
                color: isToday ? '#00D4FF' : 'rgba(255,255,255,0.3)',
              }}>
                {dayLabel}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Widget ────────────────────────────────────────────────────────────
export function TCSRevenueWidget({ compact = false }: TCSRevenueWidgetProps) {
  const { systems, refreshTick } = useSystemBus()
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null)
  const [lastWeekTotal, setLastWeekTotal] = useState<number | null>(null)
  const [monthlyTotal, setMonthlyTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tcsSystem = systems.find(s => s.id === 'tcs') as TCSAdapter | undefined
  const isConnected = !!tcsSystem

  useEffect(() => {
    if (!isConnected) {
      setLoading(false)
      return
    }

    const financeProvider = tcsSystem?.getFinanceProvider()
    if (!financeProvider) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    Promise.all([
      financeProvider.getWeeklyRevenue(),
      financeProvider.getLastWeekRevenue(),
      financeProvider.getMonthlyRevenue(),
    ])
      .then(([weekly, lastWeek, monthly]) => {
        setWeeklyData(weekly)
        setLastWeekTotal(lastWeek)
        setMonthlyTotal(monthly)
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [isConnected, tcsSystem, refreshTick])

  if (!isConnected) {
    return (
      <div style={{
        padding: compact ? 16 : 24,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        textAlign: 'center',
      }}>
        <DollarSign size={32} color="rgba(255,255,255,0.4)" />
        <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          Connect TCS to see revenue
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{
        padding: compact ? 16 : 24,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        textAlign: 'center',
      }}>
        <Loader2 size={20} style={{ color: '#FACC15', animation: 'spin 1s linear infinite' }} />
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Loading revenue…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        padding: 16,
        background: 'rgba(244,63,94,0.05)',
        border: '1px solid rgba(244,63,94,0.2)',
        borderRadius: 14,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <AlertTriangle size={16} style={{ color: '#F43F5E' }} />
        <span style={{ fontSize: 13, color: '#F43F5E' }}>Failed to load revenue</span>
      </div>
    )
  }

  const weekTotal = weeklyData?.total ?? 0
  const changePercent = lastWeekTotal && lastWeekTotal > 0
    ? ((weekTotal - lastWeekTotal) / lastWeekTotal) * 100
    : null
  const isUp = changePercent !== null && changePercent > 0
  const isDown = changePercent !== null && changePercent < 0

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: compact ? 10 : 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: compact ? 28 : 32, height: compact ? 28 : 32,
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.25)',
          }}>
            <DollarSign size={compact ? 14 : 16} style={{ color: '#FACC15' }} />
          </div>
          <h3 style={{
            margin: 0, fontSize: compact ? 14 : 16, fontWeight: 700, color: '#fff',
          }}>
            Revenue
          </h3>
        </div>
        {!compact && (
          <Link to="/finances" style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12, color: '#00D4FF', textDecoration: 'none',
          }}>
            View all <ChevronRight size={14} />
          </Link>
        )}
      </div>

      {/* This week total */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 10,
        marginBottom: compact ? 10 : 16,
      }}>
        <span style={{
          fontSize: compact ? 24 : 32, fontWeight: 800,
          fontFamily: "'Orbitron', monospace",
          color: '#fff',
        }}>
          {fmtCurrency(weekTotal)}
        </span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>this week</span>
        {changePercent !== null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: isUp ? 'rgba(57,255,20,0.1)' : isDown ? 'rgba(244,63,94,0.1)' : 'rgba(255,255,255,0.06)',
            color: isUp ? '#39FF14' : isDown ? '#F43F5E' : 'rgba(255,255,255,0.4)',
          }}>
            {isUp ? <TrendingUp size={10} /> : isDown ? <TrendingDown size={10} /> : <Minus size={10} />}
            {fmtPercent(changePercent)}
          </span>
        )}
      </div>

      {/* Bar chart */}
      {weeklyData && (
        <div style={{ marginBottom: compact ? 8 : 16 }}>
          <MiniBarChart daily={weeklyData.daily} compact={compact} />
        </div>
      )}

      {/* Monthly total */}
      {!compact && monthlyTotal !== null && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Monthly total</span>
          <span style={{
            fontSize: 16, fontWeight: 700, color: '#FACC15',
            fontFamily: "'Orbitron', monospace",
          }}>
            {fmtCurrency(monthlyTotal)}
          </span>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
