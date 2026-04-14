/**
 * VehicleLogbook — KM-driven expense log with ATO deduction summaries
 *
 * Reads from finance store expenses + transactions, parses km from
 * description strings ("Vehicle: 134km" or "(134km)"), and shows
 * running monthly totals with ATO deduction calculations.
 */

import { useMemo } from 'react';
import { Car, FileText, Route, TrendingUp, Calendar } from 'lucide-react';
import { TCS_CONFIG, calcDeduction } from '../../lib/tcs-config';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { thisMonth, fmtCurrency, formatDate } from '../../utils/date';
import './VehicleLogbook.css';

interface KmEntry {
  id: string;
  date: string;
  km: number;
  deduction: number;
  description: string;
}

/** Parse km value from description text. Patterns: "Vehicle: 134km", "(134km)", "134km" */
function parseKmFromDescription(desc: string): number | null {
  if (!desc) return null;
  // Match patterns like "Vehicle: 134km", "(134km)", "134km", "134 km"
  const match = desc.match(/\(?(\d+)\s*km\)?/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

export function VehicleLogbook() {
  const expenses = useFinanceStore(s => s.expenses);
  const transactions = useFinanceStore(s => s.transactions);

  const currentMonth = thisMonth();

  // Build km entries from expenses (where is_deductible and description contains vehicle/km)
  const kmEntries: KmEntry[] = useMemo(() => {
    const entries: KmEntry[] = [];
    const seenIds = new Set<string>();

    // 1. From expenses: filter deductible vehicle/km entries
    for (const exp of expenses) {
      if (exp.is_deleted) continue;
      if (!exp.is_deductible) continue;
      const desc = exp.description || '';
      const isVehicleEntry = desc.toLowerCase().includes('vehicle:') || /\d+\s*km/i.test(desc);
      if (!isVehicleEntry) continue;

      // Prefer travel_km field if reliable, otherwise parse from description
      let km = exp.travel_km ?? parseKmFromDescription(desc);
      if (!km || km <= 0) continue;

      if (seenIds.has(exp.id)) continue;
      seenIds.add(exp.id);

      entries.push({
        id: exp.id,
        date: exp.date,
        km,
        deduction: calcDeduction(km),
        description: desc,
      });
    }

    // 2. From transactions: type='expense' with vehicle/km in title or notes
    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;
      const title = tx.title || '';
      const notes = tx.notes || '';
      const isVehicleTx = title.toLowerCase().includes('vehicle:') || /\d+\s*km/i.test(title) || /\d+\s*km/i.test(notes);
      if (!isVehicleTx) continue;

      if (seenIds.has(tx.id)) continue;
      seenIds.add(tx.id);

      // Parse km from title first, then notes
      let km = parseKmFromDescription(title) ?? parseKmFromDescription(notes);
      if (!km || km <= 0) continue;

      // Use amount from transaction as the deduction
      entries.push({
        id: tx.id,
        date: tx.date,
        km,
        deduction: tx.amount || calcDeduction(km),
        description: title || 'Vehicle travel',
      });
    }

    // Sort descending by date
    entries.sort((a, b) => b.date.localeCompare(a.date));
    return entries;
  }, [expenses, transactions]);

  // Current month entries
  const monthEntries = useMemo(
    () => kmEntries.filter(e => e.date.startsWith(currentMonth)),
    [kmEntries, currentMonth]
  );

  // Summary stats
  const monthKm = useMemo(() => monthEntries.reduce((sum, e) => sum + e.km, 0), [monthEntries]);
  const monthDeduction = useMemo(() => monthEntries.reduce((sum, e) => sum + e.deduction, 0), [monthEntries]);
  const totalKm = useMemo(() => kmEntries.reduce((sum, e) => sum + e.km, 0), [kmEntries]);
  const totalDeduction = useMemo(() => kmEntries.reduce((sum, e) => sum + e.deduction, 0), [kmEntries]);

  return (
    <div className="vehicle-logbook">
      {/* Header */}
      <div className="vehicle-logbook-header">
        <div className="vehicle-logbook-header-left">
          <Car size={18} className="vehicle-logbook-icon" />
          <h3 className="vehicle-logbook-title">Vehicle Logbook</h3>
        </div>
        <div className="vehicle-logbook-ato-badge">
          <FileText size={12} />
          <span>ATO</span>
        </div>
      </div>

      {/* Summary Row */}
      <div className="vehicle-logbook-summary">
        <div className="vehicle-logbook-summary-item">
          <Route size={14} className="vehicle-logbook-summary-icon" />
          <div className="vehicle-logbook-summary-text">
            <span className="vehicle-logbook-summary-value">{monthKm.toLocaleString()}km</span>
            <span className="vehicle-logbook-summary-label">this month</span>
          </div>
        </div>
        <div className="vehicle-logbook-summary-divider" />
        <div className="vehicle-logbook-summary-item">
          <TrendingUp size={14} className="vehicle-logbook-summary-icon vehicle-logbook-summary-icon--deduction" />
          <div className="vehicle-logbook-summary-text">
            <span className="vehicle-logbook-summary-value vehicle-logbook-summary-value--deduction">{fmtCurrency(monthDeduction)}</span>
            <span className="vehicle-logbook-summary-label">deduction</span>
          </div>
        </div>
        <div className="vehicle-logbook-summary-divider" />
        <div className="vehicle-logbook-summary-item">
          <Car size={14} className="vehicle-logbook-summary-icon vehicle-logbook-summary-icon--total" />
          <div className="vehicle-logbook-summary-text">
            <span className="vehicle-logbook-summary-value">{totalKm.toLocaleString()}km</span>
            <span className="vehicle-logbook-summary-label">all time</span>
          </div>
        </div>
      </div>

      {/* Rate Info */}
      <div className="vehicle-logbook-rate-row">
        <span className="vehicle-logbook-rate">ATO rate: ${TCS_CONFIG.atoKmRate.toFixed(2)}/km</span>
        <span className="vehicle-logbook-rate-total">Total deduction: {fmtCurrency(totalDeduction)}</span>
      </div>

      {/* Month Entries */}
      <div className="vehicle-logbook-entries">
        <div className="vehicle-logbook-entries-header">
          <Calendar size={13} className="vehicle-logbook-entries-header-icon" />
          <span>Entries this month</span>
        </div>

        {monthEntries.length === 0 ? (
          <div className="vehicle-logbook-empty">
            <Car size={20} className="vehicle-logbook-empty-icon" />
            <span>No km logged this month. Use the KM Logger.</span>
          </div>
        ) : (
          <div className="vehicle-logbook-list">
            {monthEntries.map((entry) => (
              <div key={entry.id} className="vehicle-logbook-row">
                <div className="vehicle-logbook-row-date">
                  {formatDate(entry.date)}
                </div>
                <div className="vehicle-logbook-row-km">
                  {entry.km}km
                </div>
                <div className="vehicle-logbook-row-deduction">
                  {fmtCurrency(entry.deduction)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}