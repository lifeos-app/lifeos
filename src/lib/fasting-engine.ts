/**
 * Fasting Engine — Sacred Time Calculator
 * 
 * Computes fasting windows for multiple traditions:
 * - Ethiopian Orthodox Tewahedo (weekly Wed/Fri, Hudadi, Filsata, Advent, Nineveh, Apostles')
 * - Islam (Ramadan dawn-sunset, Sunnah days)
 * - Buddhism (Uposatha — no eating after noon on moon days)
 * - Hinduism (Ekadashi, Navaratri, Shivaratri)
 * 
 * All calculations are offline — no API calls needed.
 * Sun position calculated from lat/lng for dawn/sunset fasts.
 */

// ═══ Types ═══

export interface FastingPeriod {
  id: string;
  name: string;
  tradition: string;
  startTime: Date;
  endTime: Date;
  type: 'dawn_to_sunset' | 'midnight_to_afternoon' | 'full_day' | 'custom';
  rules: string;
  color: string;
  season?: string;
  dayNumber?: number;
  daysRemaining?: number;
  suhoorEnd?: Date;    // Islamic: pre-dawn meal cutoff
  iftarTime?: Date;    // Islamic: sunset meal time
}

export interface FastingProgress {
  elapsed: number;   // minutes elapsed
  remaining: number; // minutes remaining
  percent: number;   // 0-100
}

// ═══ Sun Position Calculator ═══
// Simplified solar calculations — accurate to ~1-2 minutes

function toJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function solarNoon(jd: number, lng: number): number {
  const n = jd - 2451545.0 + 0.0008;
  const Jstar = n - lng / 360;
  const M = (357.5291 + 0.98560028 * Jstar) % 360;
  const Mrad = M * Math.PI / 180;
  const C = 1.9148 * Math.sin(Mrad) + 0.02 * Math.sin(2 * Mrad) + 0.0003 * Math.sin(3 * Mrad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const Jtransit = 2451545.0 + Jstar + 0.0053 * Math.sin(Mrad) - 0.0069 * Math.sin(2 * lambda * Math.PI / 180);
  return Jtransit;
}

function sunDeclination(jd: number): number {
  const n = jd - 2451545.0;
  const M = (357.5291 + 0.98560028 * n) % 360;
  const Mrad = M * Math.PI / 180;
  const C = 1.9148 * Math.sin(Mrad) + 0.02 * Math.sin(2 * Mrad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const lambdaRad = lambda * Math.PI / 180;
  return Math.asin(Math.sin(23.4393 * Math.PI / 180) * Math.sin(lambdaRad));
}

function hourAngle(lat: number, decl: number, elevation: number): number {
  const latRad = lat * Math.PI / 180;
  const cos_ha = (Math.sin(elevation * Math.PI / 180) - Math.sin(latRad) * Math.sin(decl)) /
    (Math.cos(latRad) * Math.cos(decl));
  if (cos_ha > 1) return NaN; // no sunrise (polar)
  if (cos_ha < -1) return Math.PI; // no sunset (midnight sun)
  return Math.acos(cos_ha);
}

function jdToDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

/**
 * Calculate sunrise/sunset for a given date and location
 * elevation: -0.833 for standard sunrise/sunset, -18 for astronomical twilight
 *            -12 for Fajr (nautical twilight), -4 for a more conservative Fajr
 */
function getSunTimes(date: Date, lat: number, lng: number): {
  sunrise: Date;
  sunset: Date;
  fajr: Date;      // dawn (Fajr) — sun at -18° below horizon  
  solarNoon: Date;
} {
  const jd = toJulianDate(date);
  const noon = solarNoon(jd, lng);
  const decl = sunDeclination(noon);

  // Standard sunrise/sunset (-0.833° for refraction)
  const ha_rise = hourAngle(lat, decl, -0.833);
  const sunrise = jdToDate(noon - ha_rise / (2 * Math.PI));
  const sunset = jdToDate(noon + ha_rise / (2 * Math.PI));

  // Fajr — sun at -18° below horizon (astronomical dawn)
  const ha_fajr = hourAngle(lat, decl, -18);
  const fajr = isNaN(ha_fajr) ? sunrise : jdToDate(noon - ha_fajr / (2 * Math.PI));

  return {
    sunrise,
    sunset,
    fajr,
    solarNoon: jdToDate(noon),
  };
}

// ═══ Hijri Calendar (Simplified Tabular) ═══
// Tabular Islamic calendar — accurate to ±1 day for most purposes

function gregorianToHijri(date: Date): { year: number; month: number; day: number } {
  const jd = Math.floor(toJulianDate(date));
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719)
    + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
    - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

/** Convert Hijri date to Gregorian. Reserved for future use (e.g., displaying Hijri dates). */
export function hijriToGregorian(year: number, month: number, day: number): Date {
  const jd = Math.floor((11 * year + 3) / 30) + 354 * year + 30 * month
    - Math.floor((month - 1) / 2) + day + 1948440 - 385;
  return jdToDate(jd);
}

// ═══ Ethiopian Calendar ═══

/** Convert Gregorian date to Ethiopian calendar. Exported for calendar display. */
export function gregorianToEthiopian(date: Date): { year: number; month: number; day: number } {
  const jd = Math.floor(toJulianDate(date));
  // Ethiopian epoch: Aug 29, 8 CE (Julian) = JD 1724221
  const r = (jd - 1724221) % 1461;
  const n = Math.floor((jd - 1724221) / 1461);
  const year = 4 * n + Math.floor(r / 365) - Math.floor(r / 1460);
  const yday = jd - (1724221 + 365 * year + Math.floor(year / 4));
  const month = Math.floor(yday / 30) + 1;
  const day = (yday % 30) + 1;
  return { year, month: Math.min(month, 13), day: Math.min(day, 30) };
}

/**
 * Ethiopian Easter (Fasika) calculation
 * Uses the traditional Computus method
 * Returns Gregorian date
 */
function getEthiopianEaster(gregorianYear: number): Date {
  // Ethiopian Easter uses the old Julian computus
  // Then converted to Gregorian
  const a = gregorianYear % 4;
  const b = gregorianYear % 7;
  const c = gregorianYear % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // 3=March or 4=April (Julian)
  const day = ((d + e + 114) % 31) + 1;

  // Julian to Gregorian offset (13 days for 1900-2099)
  const julianDate = new Date(gregorianYear, month - 1, day);
  julianDate.setDate(julianDate.getDate() + 13);
  return julianDate;
}

// ═══ Lunar Phase Calculator ═══

function getMoonPhase(date: Date): number {
  // Returns 0-29.53 (lunation fraction)
  // 0 = new moon, ~14.76 = full moon
  const LUNAR_CYCLE = 29.53058770576;
  // Known new moon: Jan 6, 2000 18:14 UTC
  const KNOWN_NEW = new Date('2000-01-06T18:14:00Z').getTime();
  const diff = date.getTime() - KNOWN_NEW;
  const days = diff / 86400000;
  return ((days % LUNAR_CYCLE) + LUNAR_CYCLE) % LUNAR_CYCLE;
}

function isNewMoon(date: Date): boolean {
  const phase = getMoonPhase(date);
  return phase < 1.5 || phase > 28;
}

function isFullMoon(date: Date): boolean {
  const phase = getMoonPhase(date);
  return Math.abs(phase - 14.765) < 1.5;
}

function isQuarterMoon(date: Date): boolean {
  const phase = getMoonPhase(date);
  // First quarter ~7.4, Last quarter ~22.1
  return Math.abs(phase - 7.38) < 1.5 || Math.abs(phase - 22.15) < 1.5;
}

// ═══ Hindu Tithi (Lunar Day) Calculator ═══

function getTithi(date: Date): number {
  // Returns 1-30 (tithi number in Hindu calendar)
  // Tithis 1-15 = Shukla (waxing), 16-30 = Krishna (waning)
  const phase = getMoonPhase(date);
  return Math.floor(phase / (29.53058770576 / 30)) + 1;
}

function isEkadashi(date: Date): boolean {
  const tithi = getTithi(date);
  return tithi === 11 || tithi === 26; // 11th of each fortnight
}

// ═══ Tradition-Specific Fasting Calculators ═══

function getTewaherdoFasting(date: Date, _lat: number, _lng: number): FastingPeriod | null {
  const dayOfWeek = date.getDay(); // 0=Sun, 3=Wed, 5=Fri
  const year = date.getFullYear();

  // Get Easter date for moveable feasts
  const easter = getEthiopianEaster(year);
  const dateMs = date.getTime();
  const easterMs = easter.getTime();
  const daysSinceEaster = Math.floor((dateMs - easterMs) / 86400000);

  // Set fasting window: midnight to 3pm (standard Tewahedo fasting)
  const startTime = new Date(date);
  startTime.setHours(0, 0, 0, 0);
  const endTime = new Date(date);
  endTime.setHours(15, 0, 0, 0); // 3pm

  const basePeriod: Omit<FastingPeriod, 'name' | 'season' | 'dayNumber' | 'daysRemaining' | 'id'> = {
    tradition: 'tewahedo',
    startTime,
    endTime,
    type: 'midnight_to_afternoon',
    rules: 'No animal products (vegan). One meal after 3pm.',
    color: '#D4AF37',
  };

  // ── Great Lent (Hudadi / Abiy Tsom): 55 days before Easter ──
  if (daysSinceEaster >= -55 && daysSinceEaster < 0) {
    const dayNumber = daysSinceEaster + 56;
    const daysRemaining = -daysSinceEaster;
    let subSeason = 'Hudadi';
    if (dayNumber <= 8) subSeason = 'Tsome Hirkal';
    else if (dayNumber <= 48) subSeason = 'Tsome Arba';
    else subSeason = 'Holy Week';

    return {
      ...basePeriod,
      id: `tewahedo-lent-${dayNumber}`,
      name: `Great Lent · ${subSeason}`,
      season: 'Abiy Tsom',
      dayNumber,
      daysRemaining,
    };
  }

  // ── Fast of Nineveh: Mon-Wed, 3 weeks before Lent starts ──
  // Lent starts 55 days before Easter, Nineveh is 3 weeks before that = 76 days before Easter
  // Actually Nineveh is Mon-Wed of the week 2 weeks before Lent
  // More precisely: 69-67 days before Easter
  if (daysSinceEaster >= -69 && daysSinceEaster <= -67) {
    const dayNumber = daysSinceEaster + 70;
    return {
      ...basePeriod,
      id: `tewahedo-nineveh-${dayNumber}`,
      name: `Fast of Nineveh`,
      season: 'Tsome Nineveh',
      dayNumber,
      daysRemaining: -67 - daysSinceEaster,
    };
  }

  // ── 50 days after Easter (Pentecost): no fasting on Wed/Fri ──
  if (daysSinceEaster >= 0 && daysSinceEaster <= 49) {
    return null; // No fasting during the 50 days of joy after Easter
  }

  // ── Apostles' Fast: starts Monday after Pentecost, ends July 11 ──
  const pentecost = new Date(easterMs + 49 * 86400000);
  const apostleStart = new Date(pentecost);
  // Monday after Pentecost
  apostleStart.setDate(apostleStart.getDate() + ((8 - apostleStart.getDay()) % 7 || 7));
  const apostleEnd = new Date(year, 6, 11); // July 11

  if (dateMs >= apostleStart.getTime() && dateMs <= apostleEnd.getTime()) {
    const dayNumber = Math.floor((dateMs - apostleStart.getTime()) / 86400000) + 1;
    const totalDays = Math.floor((apostleEnd.getTime() - apostleStart.getTime()) / 86400000) + 1;
    return {
      ...basePeriod,
      id: `tewahedo-apostles-${dayNumber}`,
      name: `Apostles' Fast`,
      rules: 'No animal products. One meal after noon.',
      season: 'Tsome Hawaryat',
      dayNumber,
      daysRemaining: totalDays - dayNumber,
    };
  }

  // ── Fast of the Assumption (Filsata): Aug 1-15 ──
  const month = date.getMonth(); // 0-indexed
  const dayOfMonth = date.getDate();
  if (month === 7 && dayOfMonth >= 1 && dayOfMonth <= 15) {
    return {
      ...basePeriod,
      id: `tewahedo-filsata-${dayOfMonth}`,
      name: `Fast of the Assumption`,
      season: 'Tsome Filsata',
      dayNumber: dayOfMonth,
      daysRemaining: 15 - dayOfMonth,
    };
  }

  // ── Advent (Gahad / Tsome Nebiyat): Nov 28 - Jan 6 ──
  // 40 days before Genna (Jan 7) = Nov 28
  const adventStart = new Date(year, 10, 28); // Nov 28

  if ((month >= 10 && dateMs >= adventStart.getTime()) || (month === 0 && dayOfMonth <= 6)) {
    const start = month >= 10 ? adventStart : new Date(year - 1, 10, 28);
    const dayNumber = Math.floor((dateMs - start.getTime()) / 86400000) + 1;
    const end = month >= 10 ? new Date(year + 1, 0, 6) : new Date(year, 0, 6);
    const totalDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    return {
      ...basePeriod,
      id: `tewahedo-advent-${dayNumber}`,
      name: `Advent Fast`,
      season: 'Tsome Nebiyat / Gahad',
      dayNumber,
      daysRemaining: totalDays - dayNumber,
    };
  }

  // ── Wednesday & Friday weekly fast ──
  if (dayOfWeek === 3 || dayOfWeek === 5) {
    return {
      ...basePeriod,
      id: `tewahedo-weekly-${dayOfWeek === 3 ? 'wed' : 'fri'}-${date.toISOString().slice(0, 10)}`,
      name: dayOfWeek === 3 ? 'Wednesday Fast' : 'Friday Fast',
      rules: 'No animal products (vegan). Meal after 3pm or noon.',
    };
  }

  return null;
}

function getIslamicFasting(date: Date, lat: number, lng: number): FastingPeriod | null {
  const hijri = gregorianToHijri(date);
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, 4=Thu
  const sun = getSunTimes(date, lat, lng);

  const startTime = new Date(sun.fajr);
  const endTime = new Date(sun.sunset);

  // Suhoor window: 30 min before Fajr
  const suhoorEnd = new Date(startTime.getTime());
  const iftarTime = new Date(endTime.getTime());

  const basePeriod: Omit<FastingPeriod, 'name' | 'season' | 'dayNumber' | 'daysRemaining' | 'id'> = {
    tradition: 'islam',
    startTime,
    endTime,
    type: 'dawn_to_sunset',
    rules: 'No food, drink, or smoking from dawn (Fajr) to sunset (Maghrib).',
    color: '#059669', // Emerald green for Islam
    suhoorEnd,
    iftarTime,
  };

  // ── Ramadan (month 9 in Hijri calendar) ──
  if (hijri.month === 9) {
    return {
      ...basePeriod,
      id: `islam-ramadan-${hijri.day}`,
      name: `Ramadan`,
      season: 'Ramadan',
      dayNumber: hijri.day,
      daysRemaining: 30 - hijri.day, // Ramadan is 29 or 30 days
    };
  }

  // ── Shawwal 6 days (month 10, days 2-7 typically) ──
  if (hijri.month === 10 && hijri.day >= 2 && hijri.day <= 7) {
    return {
      ...basePeriod,
      id: `islam-shawwal-${hijri.day}`,
      name: `Shawwal Fast`,
      season: 'Six Days of Shawwal',
      dayNumber: hijri.day - 1,
      daysRemaining: 7 - hijri.day,
      rules: 'Voluntary (Sunnah): No food, drink from dawn to sunset.',
    };
  }

  // ── Day of Arafat (Dhul Hijjah 9) ──
  if (hijri.month === 12 && hijri.day === 9) {
    return {
      ...basePeriod,
      id: `islam-arafat-${date.toISOString().slice(0, 10)}`,
      name: `Day of Arafat`,
      season: 'Dhul Hijjah',
      rules: 'Voluntary (Sunnah): Fasting expiates sins of previous and coming year.',
    };
  }

  // ── Day of Ashura (Muharram 10, with optional 9th) ──
  if (hijri.month === 1 && (hijri.day === 9 || hijri.day === 10)) {
    return {
      ...basePeriod,
      id: `islam-ashura-${hijri.day}`,
      name: hijri.day === 10 ? 'Day of Ashura' : 'Day before Ashura',
      season: 'Muharram',
      rules: 'Voluntary (Sunnah): Commemorates the day Moses was saved.',
    };
  }

  // ── Monday & Thursday Sunnah fasts ──
  if (dayOfWeek === 1 || dayOfWeek === 4) {
    return {
      ...basePeriod,
      id: `islam-sunnah-${dayOfWeek === 1 ? 'mon' : 'thu'}-${date.toISOString().slice(0, 10)}`,
      name: dayOfWeek === 1 ? 'Monday Sunnah Fast' : 'Thursday Sunnah Fast',
      rules: 'Voluntary (Sunnah): Deeds are presented to Allah on these days.',
    };
  }

  return null;
}

function getBuddhistFasting(date: Date, lat: number, lng: number): FastingPeriod | null {
  const sun = getSunTimes(date, lat, lng);

  // Check for Uposatha days (full, new, quarter moons)
  const isUposatha = isNewMoon(date) || isFullMoon(date) || isQuarterMoon(date);

  if (!isUposatha) return null;

  const startTime = new Date(date);
  startTime.setHours(0, 0, 0, 0);
  const endTime = new Date(sun.solarNoon);

  // Determine moon phase for label
  let phaseName = 'Quarter Moon';
  if (isNewMoon(date)) phaseName = 'New Moon';
  else if (isFullMoon(date)) phaseName = 'Full Moon';

  return {
    id: `buddhism-uposatha-${date.toISOString().slice(0, 10)}`,
    name: `Uposatha · ${phaseName}`,
    tradition: 'buddhism',
    startTime,
    endTime,
    type: 'custom',
    rules: 'No eating after solar noon. Eight precepts observed.',
    color: '#F59E0B', // Amber/saffron for Buddhism
  };
}

function getHinduFasting(date: Date, _lat: number, _lng: number): FastingPeriod | null {
  const startTime = new Date(date);
  startTime.setHours(0, 0, 0, 0);
  const endTime = new Date(date);
  endTime.setHours(23, 59, 59, 999);

  // ── Ekadashi (11th tithi of each fortnight) ──
  if (isEkadashi(date)) {
    return {
      id: `hindu-ekadashi-${date.toISOString().slice(0, 10)}`,
      name: 'Ekadashi',
      tradition: 'hinduism',
      startTime,
      endTime,
      type: 'full_day',
      rules: 'No grains. Some observe complete fast. Fruits, milk, and water permitted.',
      color: '#E11D48', // Rose for Hinduism
    };
  }

  // ── Navaratri: Chaitra (March-April) and Sharad (September-October) ──
  // Simplified: first 9 days after new moon in month 1 and month 7
  const month = date.getMonth();
  const phase = getMoonPhase(date);
  // Sharad Navaratri (September/October) and Chaitra Navaratri (March/April)
  if ((month === 8 || month === 9 || month === 2 || month === 3) && phase < 9 && phase >= 0) {
    return {
      id: `hindu-navaratri-${date.toISOString().slice(0, 10)}`,
      name: `Navaratri`,
      tradition: 'hinduism',
      startTime,
      endTime,
      type: 'full_day',
      rules: 'No non-veg, some observe stricter fasts. Fruits and fasting foods permitted.',
      color: '#E11D48',
      dayNumber: Math.floor(phase) + 1,
      daysRemaining: 9 - Math.floor(phase),
    };
  }

  return null;
}

// ═══ Main API ═══

/**
 * Get today's fasting period for a given tradition.
 * Returns null if no fast applies today.
 */
export function getTodaysFasting(
  traditionSlug: string,
  date: Date,
  lat: number,
  lng: number
): FastingPeriod | null {
  switch (traditionSlug) {
    case 'tewahedo':
      return getTewaherdoFasting(date, lat, lng);
    case 'islam':
      return getIslamicFasting(date, lat, lng);
    case 'buddhism':
      return getBuddhistFasting(date, lat, lng);
    case 'hinduism':
      return getHinduFasting(date, lat, lng);
    default:
      return null;
  }
}

/**
 * Check if the user is currently within a fasting period.
 */
export function isCurrentlyFasting(period: FastingPeriod): boolean {
  const now = new Date();
  return now >= period.startTime && now < period.endTime;
}

/**
 * Get elapsed/remaining/percent progress through a fasting period.
 */
export function getFastingProgress(period: FastingPeriod): FastingProgress {
  const now = new Date();
  const totalMs = period.endTime.getTime() - period.startTime.getTime();
  const elapsedMs = Math.max(0, Math.min(now.getTime() - period.startTime.getTime(), totalMs));
  const remainingMs = Math.max(0, totalMs - elapsedMs);

  return {
    elapsed: Math.floor(elapsedMs / 60000),
    remaining: Math.floor(remainingMs / 60000),
    percent: totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0,
  };
}

/**
 * Get contextual encouragement based on fasting progress.
 */
export function getFastingEncouragement(progress: FastingProgress, tradition: string): string {
  const { percent } = progress;

  if (percent >= 100) {
    const completeMsgs: Record<string, string> = {
      tewahedo: 'Your fast is complete. Well done, faithful servant. ✝️',
      islam: 'Your fast is complete. May Allah accept it. Alhamdulillah. ☪️',
      buddhism: 'Your observance is complete. May you continue in mindfulness. ☸️',
      hinduism: 'Your fast is complete. May your devotion bear fruit. 🙏',
    };
    return completeMsgs[tradition] || 'Your fast is complete. Well done.';
  }

  if (percent < 25) {
    const earlyMsgs: Record<string, string> = {
      tewahedo: 'The body complains, the soul rejoices. Stand firm in faith.',
      islam: 'The beginning is the hardest. Remember: "Fasting is a shield." — Prophet Muhammad ﷺ',
      buddhism: 'The mind resists change. Observe the craving, let it pass.',
      hinduism: 'The body is a temple. Through fasting, we purify it.',
    };
    return earlyMsgs[tradition] || 'The body complains, the soul rejoices.';
  }

  if (percent < 50) {
    const midEarlyMsgs: Record<string, string> = {
      tewahedo: 'Stay strong in your fast. God sees your devotion.',
      islam: 'Every moment of hunger is recorded as ibadah (worship).',
      buddhism: 'Halfway through. The hunger is impermanent, like all things.',
      hinduism: 'Your tapas (austerity) builds inner strength.',
    };
    return midEarlyMsgs[tradition] || 'Stay strong. You\'re making progress.';
  }

  if (percent < 75) {
    const midMsgs: Record<string, string> = {
      tewahedo: 'You\'re past the hardest part. The reward draws near.',
      islam: 'You\'re past the hardest part. Stay strong — Iftar approaches.',
      buddhism: 'Past the middle. The mind grows calm.',
      hinduism: 'You\'re past the hardest part. Strength builds.',
    };
    return midMsgs[tradition] || 'You\'re past the hardest part. Stay strong.';
  }

  const nearEndMsgs: Record<string, string> = {
    tewahedo: 'Almost there. The reward is near. Hold fast.',
    islam: 'Almost there! The reward of Iftar awaits. Patience, believer.',
    buddhism: 'Nearly complete. You\'ve demonstrated great discipline.',
    hinduism: 'Almost there. The divine reward is near.',
  };
  return nearEndMsgs[tradition] || 'Almost there. The reward is near.';
}

/**
 * Get the fasting label for display (e.g., "Fasting · Ramadan Day 15")
 */
export function getFastingLabel(period: FastingPeriod): string {
  if (period.season && period.dayNumber) {
    return `Fasting · ${period.season} Day ${period.dayNumber}`;
  }
  if (period.season) {
    return `Fasting · ${period.season}`;
  }
  return `Fasting · ${period.name}`;
}

/**
 * Format a duration in minutes to human readable
 */
export function formatFastingDuration(minutes: number): string {
  if (minutes < 1) return '< 1m';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
