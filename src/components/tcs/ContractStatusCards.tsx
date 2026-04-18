/**
 * ContractStatusCards — Visual cards for TCS contracts showing
 * client name, rate, frequency, next clean date, monthly total,
 * and revenue at risk (concentration %).
 *
 * Sources: TCS_CONFIG venues + FinanceStore income for current month
 */

import { useMemo } from 'react'
import { Building2, AlertTriangle, Calendar, DollarSign } from 'lucide-react'
import { TCS_CONFIG, VENUES } from '../../lib/tcs-config'
import { useFinanceStore } from '../../stores/useFinanceStore'
import { thisMonth, fmtCurrency } from '../../utils/date'
import './ContractStatusCards.css'

interface ContractData {
  venueId: string
  name: string
  suburb: string
  rate: number
  frequency: string
  scheduleHint: string
  cleansPerMonth: number
  monthlyEstimate: number
  actualThisMonth: number
  revenuePct: number
  nextCleanDay: string
}

const DAY_MAP: Record<string, string> = {
  '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed',
  '4': 'Thu', '5': 'Fri', '6': 'Sat',
}

function getNextCleanDay(scheduleHint: string): string {
  const today = new Date().getDay()
  const days = scheduleHint.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/g)
  if (!days || days.length === 0) return 'Not scheduled'

  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const todayName = DAY_MAP[String(today)]

  for (const d of dayOrder) {
    if (dayOrder.indexOf(d) >= dayOrder.indexOf(todayName) && days.includes(d)) {
      return d
    }
  }
  // Next occurrence is next week
  return days[0]
}

function riskColor(pct: number): string {
  if (pct >= 60) return '#F43F5E'   // red — high concentration
  if (pct >= 40) return '#F97316'   // orange — medium
  return '#39FF14'                   // green — diversified
}

export function ContractStatusCards() {
  const income = useFinanceStore(s => s.income)
  const currentMonth = useMemo(() => thisMonth(), [])

  const contracts: ContractData[] = useMemo(() => {
    // Total monthly income for concentration
    const totalMonthIncome = income
      .filter(i => i.date.startsWith(currentMonth) && !i.is_deleted)
      .reduce((sum, i) => sum + (i.amount || 0), 0)

    return VENUES.map(venue => {
      // Calculate actual income from this venue this month
      const actual = income
        .filter(i => {
          if (!i.date.startsWith(currentMonth) || i.is_deleted) return false
          const src = (i.source || '').toLowerCase()
          const desc = (i.description || '').toLowerCase()
          const vName = venue.name.toLowerCase()
          return src.includes(vName) || desc.includes(vName)
        })
        .reduce((sum, i) => sum + (i.amount || 0), 0)

      // Use the higher of actual income or monthly estimate for concentration calc
      const monthlyVal = actual > 0 ? actual : venue.monthlyEstimate
      const pct = totalMonthIncome > 0
        ? (monthlyVal / totalMonthIncome) * 100
        : (venue.monthlyEstimate / VENUES.reduce((s, v) => s + v.monthlyEstimate, 0)) * 100

      return {
        venueId: venue.id,
        name: venue.name,
        suburb: venue.suburb,
        rate: venue.rate,
        frequency: venue.frequency,
        scheduleHint: venue.scheduleHint,
        cleansPerMonth: venue.cleansPerMonth,
        monthlyEstimate: venue.monthlyEstimate,
        actualThisMonth: actual,
        revenuePct: pct,
        nextCleanDay: getNextCleanDay(venue.scheduleHint),
      }
    })
  }, [income, currentMonth])

  const totalMonthlyEstimate = VENUES.reduce((s, v) => s + v.monthlyEstimate, 0)

  return (
    <div className="contract-cards">
      <div className="cc-header">
        <div className="cc-header-left">
          <div className="cc-icon-wrap">
            <Building2 size={16} />
          </div>
          <h3 className="cc-title">Contracts</h3>
        </div>
        <span className="cc-total">{fmtCurrency(totalMonthlyEstimate)}/mo est.</span>
      </div>

      <div className="cc-grid">
        {contracts.map(contract => {
          const rc = riskColor(contract.revenuePct)
          return (
            <div key={contract.venueId} className="cc-card">
              {/* Contract name + suburb */}
              <div className="cc-card-top">
                <div className="cc-venue-name">{contract.name}</div>
                <span className="cc-suburb">{contract.suburb}</span>
              </div>

              {/* Rate + Frequency */}
              <div className="cc-card-details">
                <div className="cc-detail">
                  <DollarSign size={12} className="cc-detail-icon" />
                  <span className="cc-detail-value">${contract.rate.toFixed(2)}</span>
                  <span className="cc-detail-label">/clean</span>
                </div>
                <div className="cc-detail">
                  <Calendar size={12} className="cc-detail-icon" />
                  <span className="cc-detail-value">{contract.frequency}</span>
                </div>
              </div>

              {/* Monthly total */}
              <div className="cc-monthly">
                <span className="cc-monthly-label">Monthly</span>
                <span className="cc-monthly-value">{fmtCurrency(contract.monthlyEstimate)}</span>
                {contract.actualThisMonth > 0 && (
                  <span className="cc-actual">({fmtCurrency(contract.actualThisMonth)} actual)</span>
                )}
              </div>

              {/* Next clean */}
              <div className="cc-next-clean">
                <span className="cc-nc-label">Next clean</span>
                <span className="cc-nc-day">{contract.nextCleanDay}</span>
              </div>

              {/* Revenue at risk */}
              <div className="cc-risk">
                <div className="cc-risk-bar-track">
                  <div
                    className="cc-risk-bar-fill"
                    style={{
                      width: `${Math.min(contract.revenuePct, 100)}%`,
                      background: rc,
                    }}
                  />
                </div>
                <div className="cc-risk-labels">
                  <span className="cc-risk-pct" style={{ color: rc }}>
                    {contract.revenuePct.toFixed(0)}%
                  </span>
                  <span className="cc-risk-text" style={{ color: rc }}>
                    {contract.revenuePct >= 60 ? 'High risk' : contract.revenuePct >= 40 ? 'Medium' : 'Low risk'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Concentration warning */}
      {contracts.some(c => c.revenuePct >= 55) && (
        <div className="cc-warning">
          <AlertTriangle size={14} />
          <span>Revenue concentrated in 2 clients — diversification is critical for stability</span>
        </div>
      )}
    </div>
  )
}