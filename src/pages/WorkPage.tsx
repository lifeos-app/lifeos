// WorkPage — System-provided page when TCS (or any business system) is connected
//
// - Today's jobs with full detail (venue address, checklist, time, status)
// - Quick actions: complete jobs, navigate to venue
// - Job history (recent completed jobs)
// - Revenue summary with monthly target
// - Route optimizer, contract status, invoice, health score
// - Only visible when a business system is connected

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase, DollarSign, ChevronRight,
  History, RefreshCw, TrendingUp, Sparkles,
} from 'lucide-react'
import { useSystemBus, useSystemTasks, useSystemSchedule, useSystemFinance } from '../lib/systems/context'
import { TCSTodayWidget } from '../components/systems/TCSTodayWidget'
import { TCSRevenueWidget } from '../components/systems/TCSRevenueWidget'
import {
  MonthlyRevenueCard,
  RouteOptimizerIndicator,
  ContractStatusCards,
  QuickInvoiceButton,
  BusinessHealthScore,
} from '../components/tcs'
import type { ScheduleEvent } from '../lib/systems/types'
import { localDateStr, formatDate, startOfWeek } from '../utils/date'

const todayLocal = localDateStr;

function getWeekRange() {
  const mon = startOfWeek();
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { start: localDateStr(mon), end: localDateStr(sun) };
}

function getPast30DaysRange() {
  const now = new Date();
  const past = new Date(now); past.setDate(now.getDate() - 30);
  return { start: localDateStr(past), end: localDateStr(now) };
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, subtext }: {
  icon: typeof Briefcase
  label: string
  value: string | number
  color: string
  subtext?: string
}) {
  return (
    <div style={{
      padding: 16,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${color}15`, border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 10,
      }}>
        <Icon size={16} style={{ color }} />
      </div>
      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </p>
      <p style={{
        margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: '#fff',
        fontFamily: "'Orbitron', monospace",
      }}>
        {value}
      </p>
      {subtext && (
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          {subtext}
        </p>
      )}
    </div>
  )
}

// ── Job History Card ───────────────────────────────────────────────────────
function HistoryCard({ event }: { event: ScheduleEvent }) {
  const venueName = (event.metadata?.venueName as string) ?? event.title.replace(/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}]+\s*/u, '')
  const amount = event.metadata?.amount as number | undefined
  // status available in event.metadata?.status
  const address = event.metadata?.venueAddress as string | undefined
  const date = event.start.split('T')[0]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
    }}>
      <Sparkles size={16} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 600, color: '#fff',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {venueName}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
          {formatDate(date)}
          {address ? ` · ${address}` : ''}
        </p>
      </div>
      {amount != null && amount > 0 && (
        <span style={{
          fontSize: 14, fontWeight: 700,
          color: '#39FF14',
          fontFamily: "'Orbitron', monospace",
        }}>
          ${amount.toFixed(0)}
        </span>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export function WorkPage() {
  const { systems, refresh, refreshing } = useSystemBus()
  const isConnected = systems.some(s => s.id === 'tcs')
  const { tasks } = useSystemTasks()
  const weekRange = useMemo(getWeekRange, [])
  const historyRange = useMemo(getPast30DaysRange, [])
  const { summary: weekSummary } = useSystemFinance(weekRange)
  const { events: allEvents } = useSystemSchedule(historyRange)

  // Filter to TCS data
  const tcsTasks = tasks.filter(t => (t.metadata?.source as string) === 'tcs')
  const completedToday = tcsTasks.filter(t => t.status === 'completed').length
  const totalToday = tcsTasks.length

  // Past completed jobs (excluding today)
  const today = todayLocal()
  const pastJobs = allEvents
    .filter(e =>
      (e.metadata?.source as string) === 'tcs' &&
      e.start.split('T')[0] < today,
    )
    .sort((a, b) => b.start.localeCompare(a.start))
    .slice(0, 10)

  if (!isConnected) {
    return (
      <div style={{
        padding: 40,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', textAlign: 'center',
      }}>
        <Sparkles size={64} style={{ marginBottom: 16 }} />
        <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Work Dashboard
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, maxWidth: 400, lineHeight: 1.6, marginBottom: 24 }}>
          Connect a business system like TCS to see your jobs, revenue, and work stats here.
        </p>
        <Link
          to="/settings"
          style={{
            padding: '10px 24px',
            background: '#00D4FF',
            borderRadius: 10,
            color: '#000',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          Connect System <ChevronRight size={16} />
        </Link>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 20px 40px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            <Sparkles size={22} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#fff' }}>
              Work
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              Teddy's Cleaning Systems
            </p>
          </div>
        </div>
        <button
          onClick={() => refresh()}
          disabled={refreshing}
          style={{
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: 'rgba(255,255,255,0.6)',
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Quick Stats */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 24,
        flexWrap: 'wrap',
      }}>
        <StatCard
          icon={Briefcase}
          label="Today's Jobs"
          value={totalToday}
          color="#00D4FF"
          subtext={`${completedToday} completed`}
        />
        <StatCard
          icon={DollarSign}
          label="This Week"
          value={weekSummary ? `$${weekSummary.revenue.toFixed(0)}` : '—'}
          color="#FACC15"
          subtext={weekSummary ? `${weekSummary.jobCount ?? 0} jobs` : undefined}
        />
        <StatCard
          icon={TrendingUp}
          label="Net Income"
          value={weekSummary ? `$${weekSummary.netIncome.toFixed(0)}` : '—'}
          color="#39FF14"
        />
      </div>

      {/* Quick Invoice Button */}
      <div style={{ marginBottom: 24 }}>
        <QuickInvoiceButton />
      </div>

      {/* Business Health Score + Monthly Revenue */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 20,
        marginBottom: 20,
      }}>
        <MonthlyRevenueCard />
        <BusinessHealthScore />
      </div>

      {/* Main Content Grid — Today's Jobs + Revenue */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 20,
        marginBottom: 20,
      }}>
        {/* Today's Jobs */}
        <div style={{
          padding: 20,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
        }}>
          <TCSTodayWidget compact={false} />
        </div>

        {/* Revenue */}
        <div style={{
          padding: 20,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
        }}>
          <TCSRevenueWidget compact={false} />
        </div>
      </div>

      {/* Route Optimizer + Contract Status */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 20,
        marginBottom: 20,
      }}>
        <RouteOptimizerIndicator />
        <ContractStatusCards />
      </div>

      {/* Job History */}
      {pastJobs.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
          }}>
            <History size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>
              Recent Jobs
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pastJobs.map(event => (
              <HistoryCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}