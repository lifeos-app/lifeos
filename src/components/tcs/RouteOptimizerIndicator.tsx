/**
 * RouteOptimizerIndicator — Route summary with km, fuel cost estimate,
 * and efficiency tips.
 *
 * Sources: FinanceStore expenses with travel_km for this week
 */

import { useMemo } from 'react'
import { Route, Fuel, Lightbulb, Car } from 'lucide-react'
import { useFinanceStore } from '../../stores/useFinanceStore'
import { TCS_CONFIG } from '../../lib/tcs-config'
import { localDateStr, startOfWeek } from '../../utils/date'
import './RouteOptimizerIndicator.css'

const FUEL_PRICE_PER_L = 1.70
const LITERS_PER_100KM = 8

export function RouteOptimizerIndicator() {
  const expenses = useFinanceStore(s => s.expenses)

  const { start: weekStart } = useMemo(() => {
    const mon = startOfWeek()
    return { start: localDateStr(mon) }
  }, [])

  const weekKm = useMemo(() => {
    const now = new Date()
    const dow = now.getDay()
    const sun = new Date(now)
    sun.setDate(now.getDate() + (7 - dow) % 7)
    const weekEnd = localDateStr(sun)

    let total = 0
    for (const e of expenses) {
      if (e.travel_km && e.travel_km > 0 && e.date >= weekStart && e.date <= weekEnd) {
        total += e.travel_km
      }
      // Also check description for Vehicle: Xkm entries without travel_km
      if ((!e.travel_km || e.travel_km === 0) && e.date >= weekStart && e.date <= weekEnd) {
        const match = e.description?.match(/(\d+)\s*km/i)
        if (match) total += parseInt(match[1], 10)
      }
    }
    return total
  }, [expenses, weekStart])

  const fuelCost = useMemo(() => {
    const liters = (weekKm / 100) * LITERS_PER_100KM
    return liters * FUEL_PRICE_PER_L
  }, [weekKm])

  const atoDeduction = useMemo(() => {
    return weekKm * TCS_CONFIG.atoKmRate
  }, [weekKm])

  return (
    <div className="route-optimizer">
      <div className="ro-header">
        <div className="ro-header-left">
          <div className="ro-icon-wrap">
            <Route size={16} />
          </div>
          <h3 className="ro-title">Route Summary</h3>
        </div>
        <span className="ro-week-label">This Week</span>
      </div>

      {/* Stats grid */}
      <div className="ro-stats">
        <div className="ro-stat">
          <Car size={14} className="ro-stat-icon" />
          <div className="ro-stat-content">
            <span className="ro-stat-value">{weekKm.toLocaleString('en-AU')}</span>
            <span className="ro-stat-unit">km</span>
          </div>
          <span className="ro-stat-label">Distance</span>
        </div>

        <div className="ro-stat">
          <Fuel size={14} className="ro-stat-icon fuel" />
          <div className="ro-stat-content">
            <span className="ro-stat-value">${fuelCost.toFixed(0)}</span>
          </div>
          <span className="ro-stat-label">Est. Fuel</span>
        </div>

        <div className="ro-stat">
          <span className="ro-stat-icon-text">$</span>
          <div className="ro-stat-content">
            <span className="ro-stat-value">${atoDeduction.toFixed(0)}</span>
          </div>
          <span className="ro-stat-label">ATO Deduction</span>
        </div>
      </div>

      {/* Route efficiency tip */}
      <div className="ro-tip">
        <div className="ro-tip-icon-wrap">
          <Lightbulb size={12} />
        </div>
        <div className="ro-tip-content">
          <span className="ro-tip-title">Efficiency Tip</span>
          <span className="ro-tip-text">
            Combine Jaga Jaga + Sonder on same day to save 45km/week
          </span>
        </div>
      </div>

      {/* Fuel formula breakdown */}
      <div className="ro-formula">
        <span className="ro-formula-text">
          {weekKm}km &times; {LITERS_PER_100KM}L/100km &times; ${FUEL_PRICE_PER_L.toFixed(2)}/L
        </span>
      </div>
    </div>
  )
}