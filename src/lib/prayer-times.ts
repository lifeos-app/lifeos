/**
 * Prayer Time Calculator — Sacred Time Markers for LifeOS
 * 
 * Computes daily prayer/devotion times for multiple traditions:
 * - Islamic (astronomically calculated using standard algorithms)
 * - Ethiopian Orthodox Tewahedo (fixed liturgical hours)
 * - Buddhist (sunrise/sunset based)
 * - Hindu (Sandhyavandana, sunrise/sunset based)
 * 
 * All calculations are local — no external API needed.
 */

// ═══ Types ═══

export interface PrayerTime {
  id: string;
  name: string;
  nameArabic?: string;
  nameAmharic?: string;
  time: Date;
  duration_minutes: number;
  icon: string;
  color: string;
  tradition: string;
}

// ═══ Constants ═══

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// Muslim World League calculation angles
const MWL_FAJR_ANGLE = 18;   // degrees below horizon for Fajr
const MWL_ISHA_ANGLE = 17;   // degrees below horizon for Isha

// ═══ Astronomical Helpers ═══

/** Julian date from a Date object */
function julianDate(date: Date): number {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();

  let jy = y;
  let jm = m;
  if (m <= 2) {
    jy -= 1;
    jm += 12;
  }
  const A = Math.floor(jy / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (jy + 4716)) + Math.floor(30.6001 * (jm + 1)) + d + B - 1524.5;
}

/** Solar declination in degrees for a given Julian date */
function solarDeclination(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  // Mean anomaly
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const Mrad = M * DEG_TO_RAD;
  // Equation of center
  const C = (1.9146 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
    + 0.00029 * Math.sin(3 * Mrad);
  // Sun's true longitude
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const sunLong = (L0 + C) % 360;
  // Obliquity of ecliptic
  const obliquity = 23.439291 - 0.0130042 * T;
  // Declination
  const decl = Math.asin(
    Math.sin(obliquity * DEG_TO_RAD) * Math.sin(sunLong * DEG_TO_RAD)
  ) * RAD_TO_DEG;
  return decl;
}

/** Equation of time in minutes for a given Julian date */
function equationOfTime(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const obliquity = 23.439291 - 0.0130042 * T;

  const L0rad = L0 * DEG_TO_RAD;
  const Mrad = M * DEG_TO_RAD;
  const oblRad = obliquity * DEG_TO_RAD;

  const y = Math.tan(oblRad / 2) * Math.tan(oblRad / 2);
  const eot = y * Math.sin(2 * L0rad)
    - 2 * e * Math.sin(Mrad)
    + 4 * e * y * Math.sin(Mrad) * Math.cos(2 * L0rad)
    - 0.5 * y * y * Math.sin(4 * L0rad)
    - 1.25 * e * e * Math.sin(2 * Mrad);

  return eot * RAD_TO_DEG * 4; // Convert to minutes
}

/**
 * Calculate the hour angle for a specific sun altitude.
 * Returns the hour angle in hours, or NaN if the sun never reaches that angle.
 */
function hourAngle(lat: number, decl: number, angle: number): number {
  const latRad = lat * DEG_TO_RAD;
  const declRad = decl * DEG_TO_RAD;
  const angleRad = angle * DEG_TO_RAD;

  const cosHA = (Math.sin(angleRad) - Math.sin(latRad) * Math.sin(declRad))
    / (Math.cos(latRad) * Math.cos(declRad));

  if (cosHA > 1 || cosHA < -1) return NaN; // Sun never reaches this angle
  return Math.acos(cosHA) * RAD_TO_DEG / 15; // Convert degrees to hours
}

/**
 * Solar noon (Dhuhr time) in hours for a given date, longitude, and timezone offset.
 */
function solarNoon(jd: number, lng: number, tzOffset: number): number {
  const eot = equationOfTime(jd);
  return 12 + tzOffset - lng / 15 - eot / 60;
}

/**
 * Sunrise/sunset times.
 * angle = -0.8333° accounts for atmospheric refraction + solar disc radius.
 */
function sunriseTime(jd: number, lat: number, lng: number, tzOffset: number): number {
  const decl = solarDeclination(jd);
  const noon = solarNoon(jd, lng, tzOffset);
  const ha = hourAngle(lat, decl, -0.8333);
  if (isNaN(ha)) return 6; // fallback for extreme latitudes
  return noon - ha;
}

function sunsetTime(jd: number, lat: number, lng: number, tzOffset: number): number {
  const decl = solarDeclination(jd);
  const noon = solarNoon(jd, lng, tzOffset);
  const ha = hourAngle(lat, decl, -0.8333);
  if (isNaN(ha)) return 18; // fallback for extreme latitudes
  return noon + ha;
}

/** Convert decimal hours to a Date on the given date */
function hoursToDate(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const totalMs = hours * 3600000;
  result.setTime(result.getTime() + totalMs);
  return result;
}

/** Set time on a date */
function setTimeOnDate(date: Date, hours: number, minutes: number): Date {
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

// ═══ Islamic Prayer Times ═══

export function calculateIslamicPrayers(date: Date, lat: number, lng: number): PrayerTime[] {
  // Get timezone offset in hours (positive = east)
  const tzOffset = -date.getTimezoneOffset() / 60;
  const jd = julianDate(date);
  const decl = solarDeclination(jd);
  const noon = solarNoon(jd, lng, tzOffset);

  // Fajr — sun at -18° (dawn, MWL)
  const fajrHA = hourAngle(lat, decl, -MWL_FAJR_ANGLE);
  const fajrHours = isNaN(fajrHA) ? noon - 6 : noon - fajrHA;

  // Dhuhr — solar noon + 1-2 minutes safety
  const dhuhrHours = noon + 1 / 60;

  // Asr (Shafi'i) — shadow length = object height + shadow at noon
  // Shadow ratio at noon = |tan(lat - decl)|
  // Asr angle = arccot(1 + tan(|lat - decl|))
  const shadowAtNoon = Math.abs(Math.tan((lat - decl) * DEG_TO_RAD));
  const asrAngle = Math.atan(1 / (1 + shadowAtNoon)) * RAD_TO_DEG;
  const asrHA = hourAngle(lat, decl, asrAngle);
  const asrHours = isNaN(asrHA) ? noon + 3.5 : noon + asrHA;

  // Maghrib — sunset
  const maghribHours = sunsetTime(jd, lat, lng, tzOffset);

  // Isha — sun at -17° (dusk, MWL)
  const ishaHA = hourAngle(lat, decl, -MWL_ISHA_ANGLE);
  const ishaHours = isNaN(ishaHA) ? maghribHours + 1.5 : noon + ishaHA;

  const baseDate = new Date(date);
  baseDate.setHours(0, 0, 0, 0);

  return [
    {
      id: 'islamic-fajr',
      name: 'Fajr',
      nameArabic: 'الفجر',
      time: hoursToDate(baseDate, fajrHours),
      duration_minutes: 20,
      icon: '🌅',
      color: '#6366F1',
      tradition: 'islam',
    },
    {
      id: 'islamic-dhuhr',
      name: 'Dhuhr',
      nameArabic: 'الظهر',
      time: hoursToDate(baseDate, dhuhrHours),
      duration_minutes: 15,
      icon: '☀️',
      color: '#F59E0B',
      tradition: 'islam',
    },
    {
      id: 'islamic-asr',
      name: 'Asr',
      nameArabic: 'العصر',
      time: hoursToDate(baseDate, asrHours),
      duration_minutes: 15,
      icon: '🌤️',
      color: '#F97316',
      tradition: 'islam',
    },
    {
      id: 'islamic-maghrib',
      name: 'Maghrib',
      nameArabic: 'المغرب',
      time: hoursToDate(baseDate, maghribHours),
      duration_minutes: 10,
      icon: '🌇',
      color: '#EF4444',
      tradition: 'islam',
    },
    {
      id: 'islamic-isha',
      name: 'Isha',
      nameArabic: 'العشاء',
      time: hoursToDate(baseDate, ishaHours),
      duration_minutes: 15,
      icon: '🌙',
      color: '#8B5CF6',
      tradition: 'islam',
    },
  ];
}

// ═══ Tewahedo Prayer Times ═══

export function calculateTewahedoPrayers(date: Date): PrayerTime[] {
  return [
    {
      id: 'tewahedo-morning',
      name: 'Morning Prayer',
      nameAmharic: 'ጸሎተ ንግሥ',
      time: setTimeOnDate(date, 6, 0),
      duration_minutes: 30,
      icon: '🕊️',
      color: '#D4AF37',
      tradition: 'tewahedo',
    },
    {
      id: 'tewahedo-third',
      name: 'Third Hour',
      nameAmharic: 'ሠለስቱ',
      time: setTimeOnDate(date, 9, 0),
      duration_minutes: 15,
      icon: '✝️',
      color: '#D4AF37',
      tradition: 'tewahedo',
    },
    {
      id: 'tewahedo-sixth',
      name: 'Sixth Hour',
      nameAmharic: 'ስድስቱ',
      time: setTimeOnDate(date, 12, 0),
      duration_minutes: 15,
      icon: '☀️',
      color: '#D4AF37',
      tradition: 'tewahedo',
    },
    {
      id: 'tewahedo-ninth',
      name: 'Ninth Hour',
      nameAmharic: 'ተስዓቱ',
      time: setTimeOnDate(date, 15, 0),
      duration_minutes: 15,
      icon: '✝️',
      color: '#D4AF37',
      tradition: 'tewahedo',
    },
    {
      id: 'tewahedo-evening',
      name: 'Evening Prayer',
      nameAmharic: 'ጸሎተ ምሽት',
      time: setTimeOnDate(date, 18, 0),
      duration_minutes: 20,
      icon: '🕯️',
      color: '#D4AF37',
      tradition: 'tewahedo',
    },
    {
      id: 'tewahedo-night',
      name: 'Night Prayer',
      nameAmharic: 'ጸሎተ ሌሊት',
      time: setTimeOnDate(date, 21, 0),
      duration_minutes: 20,
      icon: '🌙',
      color: '#D4AF37',
      tradition: 'tewahedo',
    },
  ];
}

// ═══ Buddhist Practice Times ═══

export function calculateBuddhistPractice(date: Date, lat: number, lng: number): PrayerTime[] {
  const tzOffset = -date.getTimezoneOffset() / 60;
  const jd = julianDate(date);
  const noon = solarNoon(jd, lng, tzOffset);
  const sunrise = sunriseTime(jd, lat, lng, tzOffset);
  const sunset = sunsetTime(jd, lat, lng, tzOffset);

  const baseDate = new Date(date);
  baseDate.setHours(0, 0, 0, 0);

  return [
    {
      id: 'buddhist-dawn',
      name: 'Dawn Meditation',
      time: hoursToDate(baseDate, sunrise),
      duration_minutes: 30,
      icon: '🌅',
      color: '#F59E0B',
      tradition: 'buddhism',
    },
    {
      id: 'buddhist-midday',
      name: 'Midday Mindfulness',
      time: hoursToDate(baseDate, noon),
      duration_minutes: 20,
      icon: '☀️',
      color: '#F59E0B',
      tradition: 'buddhism',
    },
    {
      id: 'buddhist-evening',
      name: 'Evening Meditation',
      time: hoursToDate(baseDate, sunset),
      duration_minutes: 30,
      icon: '🌇',
      color: '#F59E0B',
      tradition: 'buddhism',
    },
  ];
}

// ═══ Hindu Prayer Times ═══

export function calculateHinduPrayers(date: Date, lat: number, lng: number): PrayerTime[] {
  const tzOffset = -date.getTimezoneOffset() / 60;
  const jd = julianDate(date);
  const noon = solarNoon(jd, lng, tzOffset);
  const sunrise = sunriseTime(jd, lat, lng, tzOffset);
  const sunset = sunsetTime(jd, lat, lng, tzOffset);

  const baseDate = new Date(date);
  baseDate.setHours(0, 0, 0, 0);

  // Brahma Muhurta is 96 minutes before sunrise
  const brahmaMuhurta = sunrise - 96 / 60;

  return [
    {
      id: 'hindu-brahma-muhurta',
      name: 'Brahma Muhurta',
      time: hoursToDate(baseDate, brahmaMuhurta),
      duration_minutes: 48,
      icon: '🪷',
      color: '#FF6B35',
      tradition: 'hinduism',
    },
    {
      id: 'hindu-pratah',
      name: 'Pratah Sandhya',
      time: hoursToDate(baseDate, sunrise),
      duration_minutes: 30,
      icon: '🌅',
      color: '#FF6B35',
      tradition: 'hinduism',
    },
    {
      id: 'hindu-puja-morning',
      name: 'Morning Puja',
      time: setTimeOnDate(date, 7, 0),
      duration_minutes: 20,
      icon: '🪔',
      color: '#FF6B35',
      tradition: 'hinduism',
    },
    {
      id: 'hindu-madhyahna',
      name: 'Madhyahna Sandhya',
      time: hoursToDate(baseDate, noon),
      duration_minutes: 15,
      icon: '☀️',
      color: '#FF6B35',
      tradition: 'hinduism',
    },
    {
      id: 'hindu-sayam',
      name: 'Sayam Sandhya',
      time: hoursToDate(baseDate, sunset),
      duration_minutes: 30,
      icon: '🌇',
      color: '#FF6B35',
      tradition: 'hinduism',
    },
    {
      id: 'hindu-puja-evening',
      name: 'Evening Puja',
      time: setTimeOnDate(date, 19, 0),
      duration_minutes: 20,
      icon: '🪔',
      color: '#FF6B35',
      tradition: 'hinduism',
    },
  ];
}

// ═══ Tradition Slug → Calculator ═══

export function calculatePrayerTimes(
  traditionSlug: string,
  date: Date,
  lat: number,
  lng: number
): PrayerTime[] {
  switch (traditionSlug) {
    case 'islam':
    case 'islamic':
      return calculateIslamicPrayers(date, lat, lng);
    case 'tewahedo':
    case 'ethiopian-orthodox':
    case 'orthodox':
      return calculateTewahedoPrayers(date);
    case 'buddhism':
    case 'buddhist':
      return calculateBuddhistPractice(date, lat, lng);
    case 'hinduism':
    case 'hindu':
      return calculateHinduPrayers(date, lat, lng);
    default:
      return [];
  }
}

// ═══ Tradition Icon Helper ═══

export function getTraditionIcon(tradition: string): string {
  switch (tradition) {
    case 'islam':
    case 'islamic':
      return '🕌';
    case 'tewahedo':
    case 'ethiopian-orthodox':
    case 'orthodox':
      return '☦️';
    case 'buddhism':
    case 'buddhist':
      return '☸️';
    case 'hinduism':
    case 'hindu':
      return '🕉️';
    default:
      return '🙏';
  }
}
