// TCS Config — Single Source of Truth for Teddy's Cleaning Systems
//
// All TCS components import from here. Change rates, venues, routes in one place.
// Last updated: 2026-04-15

export const TCS_CONFIG = {
  name: "Teddy's Cleaning Systems",
  abn: '', // Fill when known
  website: 'teddyscleaning.com.au',

  // ATO rates (2025-2026 financial year)
  atoKmRate: 0.85, // cents per km method
  gstThreshold: 75000, // GST registration threshold

  // Route
  homeBase: 'Rockbank',
  routeKm: 134, // Rockbank -> Jaga Jaga -> Sonder -> Rockbank (full loop)

  // Venues / Contracts
  venues: [
    {
      id: 'jaga-jaga',
      name: 'Jaga Jaga',
      suburb: 'Greensborough',
      rate: 150,
      frequency: '3x/week',
      scheduleHint: 'Mon 6:00-9:00 | Thu/Fri 1:30-3:30',
      cleansPerMonth: 12,
      monthlyEstimate: 1800,
    },
    {
      id: 'sonder',
      name: 'Sonder',
      suburb: 'Bentleigh',
      rate: 162.50,
      frequency: '4x/week',
      scheduleHint: 'Thu/Fri 3:30-5:30 | Sat/Sun 3:00-5:00',
      cleansPerMonth: 16,
      monthlyEstimate: 2600,
    },
  ] as const,

  // Revenue targets (from 90-day growth plan)
  monthlyCleaningTarget: 5500,
  monthlyCombinedTarget: 8000,

  // Quick km presets for the logger
  kmPresets: [
    { label: 'Full Run', km: 134, description: 'Rockbank - Jaga Jaga - Sonder - Rockbank' },
    { label: 'Half Run', km: 67, description: 'One venue return trip' },
    { label: 'Short', km: 30, description: 'Supply run or local errand' },
    { label: 'Local', km: 15, description: 'Nearby job or pickup' },
  ] as const,

  // Security shifts (supplemental)
  securityShifts: {
    venue: 'Sonder',
    timeHint: 'Fri/Sat 7:00pm-12:30am',
    shiftsPerMonth: '4-8',
    incomeRange: [400, 800] as const,
  },
} as const;

export type TCSVenue = typeof TCS_CONFIG.venues[number];
export type TSCKmPreset = typeof TCS_CONFIG.kmPresets[number];

/** ATO cents-per-km rate for 2025-2026 FY */
export const ATO_RATE = TCS_CONFIG.atoKmRate;

/** Full route km */
export const ROUTE_KM = TCS_CONFIG.routeKm;

/** Venue array shorthand */
export const VENUES = TCS_CONFIG.venues;

/** Calculate ATO deduction for a given km distance */
export function calcDeduction(km: number): number {
  return km * TCS_CONFIG.atoKmRate;
}

/** Get total projected monthly cleaning revenue */
export function projectedMonthlyCleaning(): number {
  return TCS_CONFIG.venues.reduce((sum, v) => sum + v.monthlyEstimate, 0);
}