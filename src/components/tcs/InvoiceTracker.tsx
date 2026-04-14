/**
 * InvoiceTracker — Per-venue expected vs actual income with payment status
 *
 * Reads TCS venue config and finance store income to show at-a-glance
 * payment tracking. Matches income entries by venue name in source/description
 * or by client_id linked to a client with matching name.
 */

import { useMemo } from 'react';
import { Receipt, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { TCS_CONFIG } from '../../lib/tcs-config';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { thisMonth, fmtCurrency } from '../../utils/date';
import './InvoiceTracker.css';

type PaymentStatus = 'ON TRACK' | 'UNDER' | 'NO DATA';

interface VenueIncomeRow {
  venueId: string;
  venueName: string;
  expected: number;
  actual: number;
  status: PaymentStatus;
  percentage: number;
}

function getStatusColor(status: PaymentStatus): string {
  switch (status) {
    case 'ON TRACK': return '#39FF14';
    case 'UNDER': return '#F97316';
    case 'NO DATA': return '#F43F5E';
  }
}

function StatusIcon({ status }: { status: PaymentStatus }) {
  const color = getStatusColor(status);
  switch (status) {
    case 'ON TRACK': return <TrendingUp size={12} style={{ color }} />;
    case 'UNDER': return <TrendingDown size={12} style={{ color }} />;
    case 'NO DATA': return <Minus size={12} style={{ color }} />;
  }
}

export function InvoiceTracker() {
  const income = useFinanceStore(s => s.income);
  const clients = useFinanceStore(s => s.clients);
  const month = thisMonth();

  // Build a map: venue name (lowercase) -> matching client ids
  const venueClientIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const venue of TCS_CONFIG.venues) {
      const vNameLower = venue.name.toLowerCase();
      const ids = new Set<string>();
      for (const client of clients) {
        if (client.name.toLowerCase().includes(vNameLower) || vNameLower.includes(client.name.toLowerCase())) {
          ids.add(client.id);
        }
      }
      map.set(venue.id, ids);
    }
    return map;
  }, [clients]);

  // Calculate per-venue income rows
  const rows: VenueIncomeRow[] = useMemo(() => {
    return TCS_CONFIG.venues.map(venue => {
      const expected = Math.round(venue.rate * venue.cleansPerMonth);
      const vNameLower = venue.name.toLowerCase();
      const clientIds = venueClientIds.get(venue.id) || new Set<string>();

      // Filter income entries for this month that match this venue
      const actual = income
        .filter(entry => {
          // Must be this month
          if (!entry.date || !entry.date.startsWith(month)) return false;
          // Match by client_id
          if (entry.client_id && clientIds.has(entry.client_id)) return true;
          // Match by venue name in source or description
          const source = (entry.source || '').toLowerCase();
          const desc = (entry.description || '').toLowerCase();
          if (source.includes(vNameLower) || desc.includes(vNameLower)) return true;
          return false;
        })
        .reduce((sum, entry) => sum + (entry.amount || 0), 0);

      let status: PaymentStatus;
      if (actual === 0) {
        status = 'NO DATA';
      } else if (actual >= expected) {
        status = 'ON TRACK';
      } else {
        status = 'UNDER';
      }

      const percentage = expected > 0 ? Math.min((actual / expected) * 100, 100) : 0;

      return {
        venueId: venue.id,
        venueName: venue.name,
        expected,
        actual,
        status,
        percentage,
      };
    });
  }, [income, month, venueClientIds]);

  const hasAnyIncome = rows.some(r => r.actual > 0);

  // Totals
  const totalExpected = rows.reduce((s, r) => s + r.expected, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  return (
    <div className="invoice-tracker">
      {/* Header */}
      <div className="invoice-tracker-header">
        <div className="invoice-tracker-header-left">
          <Receipt size={18} className="invoice-tracker-icon" />
          <h3 className="invoice-tracker-title">Invoice Status</h3>
        </div>
        <span className="invoice-tracker-month">{month}</span>
      </div>

      {/* Venue rows */}
      <div className="invoice-tracker-venues">
        {rows.map(row => {
          const statusColor = getStatusColor(row.status);
          return (
            <div
              key={row.venueId}
              className={`invoice-tracker-venue invoice-tracker-venue--${row.status.toLowerCase().replace(' ', '-')}`}
            >
              <div className="invoice-tracker-venue-top">
                <span className="invoice-tracker-venue-name">{row.venueName}</span>
                <div className="invoice-tracker-venue-badge" style={{ color: statusColor, borderColor: statusColor, background: `${statusColor}15` }}>
                  <StatusIcon status={row.status} />
                  <span>{row.status}</span>
                </div>
              </div>
              <div className="invoice-tracker-venue-amounts">
                <span className="invoice-tracker-actual" style={{ color: statusColor }}>{fmtCurrency(row.actual)}</span>
                <span className="invoice-tracker-expected">/ {fmtCurrency(row.expected)}</span>
              </div>
              <div className="invoice-tracker-bar-track">
                <div
                  className="invoice-tracker-bar-fill"
                  style={{
                    width: `${row.percentage}%`,
                    background: `linear-gradient(90deg, ${statusColor}CC, ${statusColor})`,
                    boxShadow: `0 0 8px ${statusColor}40`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* No data fallback */}
      {!hasAnyIncome && (
        <div className="invoice-tracker-empty">
          <Receipt size={24} className="invoice-tracker-empty-icon" />
          <span className="invoice-tracker-empty-text">No income recorded this month</span>
        </div>
      )}

      {/* Totals footer */}
      <div className="invoice-tracker-footer">
        <div className="invoice-tracker-footer-stat">
          <span className="invoice-tracker-footer-label">Total Expected</span>
          <span className="invoice-tracker-footer-value">{fmtCurrency(totalExpected)}</span>
        </div>
        <div className="invoice-tracker-footer-divider" />
        <div className="invoice-tracker-footer-stat">
          <span className="invoice-tracker-footer-label">Total Received</span>
          <span className="invoice-tracker-footer-value invoice-tracker-footer-value--actual">{fmtCurrency(totalActual)}</span>
        </div>
        <div className="invoice-tracker-footer-divider" />
        <div className="invoice-tracker-footer-stat">
          <span className="invoice-tracker-footer-label">Remaining</span>
          <span className="invoice-tracker-footer-value">{fmtCurrency(Math.max(0, totalExpected - totalActual))}</span>
        </div>
      </div>
    </div>
  );
}