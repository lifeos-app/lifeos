/**
 * Celestial Data — The Realm
 *
 * Pure math module for moon phases, seasons, hemisphere detection,
 * and celestial event calendar. No external dependencies.
 */

// ── Types ────────────────────────────────────────

export type MoonPhaseName =
  | 'new'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonPalette {
  tintColor: string;
  tintAlpha: number;
  grassTint: string;
  particleType: 'petals' | 'fireflies' | 'leaves' | 'snow';
  ambientBoost: number;
}

export interface CelestialEvent {
  date: string; // YYYY-MM-DD
  name: string;
  description: string;
  type: 'equinox' | 'solstice' | 'meteor_shower' | 'eclipse' | 'holiday';
  xpMultiplier?: number;
}

// ── Moon Phase ───────────────────────────────────

/** Reference new moon: 2000-01-06T18:14:00Z */
const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);
const SYNODIC_PERIOD = 29.53059; // days
const MS_PER_DAY = 86400000;

/**
 * Returns moon phase as 0-1 (0 = new moon, 0.5 = full moon)
 */
export function getMoonPhase(date: Date): number {
  const diffMs = date.getTime() - REF_NEW_MOON;
  const diffDays = diffMs / MS_PER_DAY;
  const cycles = diffDays / SYNODIC_PERIOD;
  const phase = cycles - Math.floor(cycles);
  return phase < 0 ? phase + 1 : phase;
}

/**
 * Map 0-1 phase to 8 named phases
 */
export function getMoonPhaseName(phase: number): MoonPhaseName {
  if (phase < 0.0625) return 'new';
  if (phase < 0.1875) return 'waxing_crescent';
  if (phase < 0.3125) return 'first_quarter';
  if (phase < 0.4375) return 'waxing_gibbous';
  if (phase < 0.5625) return 'full';
  if (phase < 0.6875) return 'waning_gibbous';
  if (phase < 0.8125) return 'last_quarter';
  if (phase < 0.9375) return 'waning_crescent';
  return 'new';
}

export function isFullMoon(date: Date): boolean {
  const phase = getMoonPhase(date);
  return Math.abs(phase - 0.5) <= 0.03;
}

export function getXPMultiplier(date: Date): number {
  return isFullMoon(date) ? 1.1 : 1.0;
}

// ── Hemisphere ───────────────────────────────────

const SOUTHERN_TZ_PATTERNS = [
  'Australia', 'Antarctica', 'Pacific/Auckland', 'Pacific/Fiji',
  'America/Buenos_Aires', 'America/Argentina', 'America/Sao_Paulo',
  'America/Santiago', 'America/Lima', 'America/Montevideo',
  'Africa/Johannesburg', 'Africa/Harare', 'Africa/Maputo',
  'Africa/Nairobi', 'Indian/Antananarivo',
  'Pacific/Chatham', 'NZ',
];

export function getHemisphere(): 'northern' | 'southern' {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && SOUTHERN_TZ_PATTERNS.some(p => tz.includes(p))) {
      return 'southern';
    }
  } catch {
    // Fallback to northern
  }
  return 'northern';
}

// ── Seasons ──────────────────────────────────────

export function getSeason(date: Date): Season {
  const month = date.getMonth(); // 0-indexed
  const hemi = getHemisphere();

  let season: Season;
  if (month >= 2 && month <= 4) season = 'spring';
  else if (month >= 5 && month <= 7) season = 'summer';
  else if (month >= 8 && month <= 10) season = 'autumn';
  else season = 'winter';

  // Flip for southern hemisphere
  if (hemi === 'southern') {
    const flip: Record<Season, Season> = {
      spring: 'autumn',
      summer: 'winter',
      autumn: 'spring',
      winter: 'summer',
    };
    season = flip[season];
  }

  return season;
}

export const SEASON_PALETTES: Record<Season, SeasonPalette> = {
  spring: {
    tintColor: '#FFD1DC',
    tintAlpha: 0.04,
    grassTint: '#5A9E4B',
    particleType: 'petals',
    ambientBoost: 0.05,
  },
  summer: {
    tintColor: '#FFF8DC',
    tintAlpha: 0.03,
    grassTint: '#4A7C3E',
    particleType: 'fireflies',
    ambientBoost: 0.1,
  },
  autumn: {
    tintColor: '#DEB887',
    tintAlpha: 0.06,
    grassTint: '#6B7C3E',
    particleType: 'leaves',
    ambientBoost: -0.05,
  },
  winter: {
    tintColor: '#B0C4DE',
    tintAlpha: 0.08,
    grassTint: '#5A7A5A',
    particleType: 'snow',
    ambientBoost: -0.1,
  },
};

// ── Celestial Events Calendar ────────────────────

export const CELESTIAL_EVENTS: CelestialEvent[] = [
  // 2026
  { date: '2026-01-19', name: 'Timkat', description: 'Ethiopian Epiphany — celebration of baptism and renewal.', type: 'holiday', xpMultiplier: 1.15 },
  { date: '2026-03-20', name: 'March Equinox', description: 'Day and night stand in perfect balance.', type: 'equinox', xpMultiplier: 1.1 },
  { date: '2026-04-06', name: 'Fasika', description: 'Ethiopian Easter — a time of fasting fulfilled and joy.', type: 'holiday', xpMultiplier: 1.15 },
  { date: '2026-04-22', name: 'Lyrid Meteor Shower', description: 'Ancient debris of Comet Thatcher streaks across the sky.', type: 'meteor_shower' },
  { date: '2026-04-23', name: 'Lyrid Meteor Shower', description: 'Peak night of the Lyrids — look northeast after midnight.', type: 'meteor_shower' },
  { date: '2026-06-21', name: 'June Solstice', description: 'The longest day illuminates your path forward.', type: 'solstice', xpMultiplier: 1.1 },
  { date: '2026-08-12', name: 'Perseid Meteor Shower', description: 'The most reliable shower — up to 100 meteors per hour.', type: 'meteor_shower' },
  { date: '2026-08-13', name: 'Perseid Meteor Shower', description: 'Perseid peak — Swift-Tuttle comet dust burns bright.', type: 'meteor_shower' },
  { date: '2026-09-11', name: 'Enkutatash', description: 'Ethiopian New Year — the finding of the True Cross.', type: 'holiday', xpMultiplier: 1.15 },
  { date: '2026-09-22', name: 'September Equinox', description: 'Balance returns — equal light and shadow.', type: 'equinox', xpMultiplier: 1.1 },
  { date: '2026-09-27', name: 'Meskel', description: 'Finding of the True Cross — bonfires light the night.', type: 'holiday', xpMultiplier: 1.15 },
  { date: '2026-12-14', name: 'Geminid Meteor Shower', description: 'The king of meteor showers — multicolored streaks.', type: 'meteor_shower' },
  { date: '2026-12-21', name: 'December Solstice', description: 'The darkest night gives way to returning light.', type: 'solstice', xpMultiplier: 1.1 },
  // 2027
  { date: '2027-01-19', name: 'Timkat', description: 'Ethiopian Epiphany — celebration of baptism and renewal.', type: 'holiday', xpMultiplier: 1.15 },
  { date: '2027-03-20', name: 'March Equinox', description: 'Day and night stand in perfect balance.', type: 'equinox', xpMultiplier: 1.1 },
  { date: '2027-03-29', name: 'Fasika', description: 'Ethiopian Easter — a time of fasting fulfilled and joy.', type: 'holiday', xpMultiplier: 1.15 },
  { date: '2027-06-21', name: 'June Solstice', description: 'The longest day illuminates your path forward.', type: 'solstice', xpMultiplier: 1.1 },
  { date: '2027-08-12', name: 'Perseid Meteor Shower', description: 'Swift-Tuttle comet dust streaks across the sky.', type: 'meteor_shower' },
  { date: '2027-09-11', name: 'Enkutatash', description: 'Ethiopian New Year — the finding of the True Cross.', type: 'holiday', xpMultiplier: 1.15 },
  { date: '2027-09-22', name: 'September Equinox', description: 'Balance returns — equal light and shadow.', type: 'equinox', xpMultiplier: 1.1 },
  { date: '2027-09-27', name: 'Meskel', description: 'Finding of the True Cross — bonfires light the night.', type: 'holiday', xpMultiplier: 1.15 },
  { date: '2027-12-21', name: 'December Solstice', description: 'The darkest night gives way to returning light.', type: 'solstice', xpMultiplier: 1.1 },
  // 2028
  { date: '2028-01-19', name: 'Timkat', description: 'Ethiopian Epiphany — celebration of baptism and renewal.', type: 'holiday', xpMultiplier: 1.15 },
  { date: '2028-03-20', name: 'March Equinox', description: 'Day and night stand in perfect balance.', type: 'equinox', xpMultiplier: 1.1 },
  { date: '2028-06-20', name: 'June Solstice', description: 'The longest day illuminates your path forward.', type: 'solstice', xpMultiplier: 1.1 },
  { date: '2028-12-21', name: 'December Solstice', description: 'The darkest night gives way to returning light.', type: 'solstice', xpMultiplier: 1.1 },
];

export function getTodayEvent(date: Date): CelestialEvent | null {
  const key = date.toISOString().split('T')[0];
  return CELESTIAL_EVENTS.find(e => e.date === key) ?? null;
}

export function getUpcomingEvents(date: Date, days: number): CelestialEvent[] {
  const start = date.toISOString().split('T')[0];
  const end = new Date(date.getTime() + days * MS_PER_DAY).toISOString().split('T')[0];
  return CELESTIAL_EVENTS.filter(e => e.date >= start && e.date <= end);
}
