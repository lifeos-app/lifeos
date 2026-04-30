/**
 * world-awareness.ts — World/Geopolitical Awareness Layer (P7-020)
 *
 * Surfaces contextual information about the user's environment:
 * - Timezone detection and hemisphere inference
 * - Seasonal context (meteorological + astronomical)
 * - Mock seasonal weather (no external API)
 * - Daylight hours estimation via solar angle formula
 * - Global context items (awareness days, DST transitions, seasonal notes)
 * - Productivity influence mapping (seasonal productivity recommendations)
 *
 * All data is generated locally. Cached in localStorage with 4-hour TTL.
 */

// ── Types ────────────────────────────────────────────────────────────

export type Hemisphere = 'northern' | 'southern';

export interface SeasonInfo {
  name: string;           // e.g. "Spring", "Summer", "Autumn", "Winter"
  icon: string;           // Lucide icon name: Sun, Snowflake, Leaf, Flower
  daysUntilChange: number;
  type: 'meteorological' | 'astronomical';
}

export interface WeatherApprox {
  condition: string;      // e.g. "Mild", "Warm", "Hot", "Cool", "Cold"
  temperatureC: number;   // Approximate seasonal temperature in Celsius
  description: string;    // Human-readable summary
  icon: string;           // Lucide icon name for condition
}

export interface DaylightInfo {
  sunrise: string;        // HH:mm local
  sunset: string;         // HH:mm local
  daylightHours: number;  // Total daylight hours
  progressDay: number;    // 0-1, how far through the day (0=midnight, 0.5=noon)
  progressDaylight: number; // 0-1, how far through daylight window
}

export interface GlobalContextItem {
  text: string;
  category: 'awareness_day' | 'dst_transition' | 'seasonal_note' | 'world_event';
  priority: number;       // 1-3, higher = more relevant
}

export interface ProductivityInfluence {
  recommendation: string;
  category: 'routine' | 'energy' | 'focus' | 'mood' | 'environment';
  icon: string;           // Lucide icon name
}

export interface WorldContext {
  timezone: string;
  timezoneOffset: number;  // UTC offset in hours
  hemisphere: Hemisphere;
  latitude: number;        // Approximate latitude from timezone
  season: SeasonInfo;
  weather: WeatherApprox;
  daylight: DaylightInfo;
  globalContext: GlobalContextItem[];
  productivity: ProductivityInfluence[];
  generatedAt: string;    // ISO timestamp
}

// ── Timezone & Hemisphere ────────────────────────────────────────────

const TIMEZONE_LATITUDES: Record<string, number> = {
  'Australia/Melbourne': -37.8, 'Australia/Sydney': -33.9, 'Australia/Perth': -31.9,
  'Australia/Brisbane': -27.5, 'Australia/Adelaide': -34.9, 'Australia/Hobart': -42.9,
  'Australia/Darwin': -12.5, 'Pacific/Auckland': -36.8, 'Pacific/Fiji': -18.0,
  'Pacific/Honolulu': 21.3, 'America/New_York': 40.7, 'America/Chicago': 41.9,
  'America/Denver': 39.7, 'America/Los_Angeles': 34.1, 'America/Phoenix': 33.4,
  'America/Anchorage': 61.2, 'America/Toronto': 43.7, 'America/Vancouver': 49.3,
  'America/Mexico_City': 19.4, 'America/Sao_Paulo': -23.5, 'America/Buenos_Aires': -34.6,
  'America/Lima': -12.0, 'America/Bogota': 4.7, 'Europe/London': 51.5,
  'Europe/Paris': 48.9, 'Europe/Berlin': 52.5, 'Europe/Madrid': 40.4,
  'Europe/Rome': 41.9, 'Europe/Amsterdam': 52.4, 'Europe/Stockholm': 59.3,
  'Europe/Helsinki': 60.2, 'Europe/Moscow': 55.8, 'Europe/Istanbul': 41.0,
  'Europe/Athens': 37.98, 'Asia/Tokyo': 35.7, 'Asia/Shanghai': 31.2,
  'Asia/Hong_Kong': 22.3, 'Asia/Singapore': 1.35, 'Asia/Bangkok': 13.8,
  'Asia/Seoul': 37.6, 'Asia/Kolkata': 19.1, 'Asia/Dubai': 25.2,
  'Asia/Riyadh': 24.7, 'Asia/Tehran': 35.7, 'Asia/Jakarta': -6.2,
  'Africa/Cairo': 30.0, 'Africa/Lagos': 6.5, 'Africa/Johannesburg': -26.2,
  'Africa/Nairobi': -1.3, 'Africa/Casablanca': 33.6,
  'Atlantic/Reykjavik': 64.1,
};

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Melbourne';
  } catch {
    return 'Australia/Melbourne';
  }
}

function getTimezoneOffset(tz: string): number {
  try {
    const now = new Date();
    const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = now.toLocaleString('en-US', { timeZone: tz });
    const utcDate = new Date(utcStr);
    const tzDate = new Date(tzStr);
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
  } catch {
    return 10; // Default UTC+10
  }
}

function getLatitudeForTimezone(tz: string): number {
  if (TIMEZONE_LATITUDES[tz]) return TIMEZONE_LATITUDES[tz];
  // Fallback: estimate from UTC offset using a simplified mapping
  const offset = getTimezoneOffset(tz);
  // Rough latitude approximation based on common offsets
  const offsetLatMap: Record<number, number> = {
    '-8': 60, '-7': 45, '-6': 40, '-5': 38, '-4': 15,
    '-3': -15, '0': 51, '1': 49, '2': 50, '3': 40,
    '4': 25, '5': 25, '5.5': 20, '5.75': 33,
    '6': 25, '7': 14, '8': 30, '9': 35, '10': -34,
    '11': -6, '12': -37, '13': -41,
  };
  const rounded = Math.round(offset);
  return offsetLatMap[String(rounded)] ?? (offset >= 0 ? 40 : -30);
}

function getHemisphere(lat: number): Hemisphere {
  return lat >= 0 ? 'northern' : 'southern';
}

// ── Season Calculation ───────────────────────────────────────────────

const SEASON_NAMES_NORTH = ['Winter', 'Spring', 'Summer', 'Autumn'] as const;
const SEASON_NAMES_SOUTH = ['Summer', 'Autumn', 'Winter', 'Spring'] as const;
const SEASON_ICONS_NORTH: string[] = ['Snowflake', 'Flower', 'Sun', 'Leaf'];
const SEASON_ICONS_SOUTH: string[] = ['Sun', 'Leaf', 'Snowflake', 'Flower'];

function getSeason(date: Date, hemisphere: Hemisphere): SeasonInfo {
  const month = date.getMonth(); // 0-11
  const day = date.getDate();

  // Meteorological seasons: Dec-Feb=Winter(N) / Summer(S), etc.
  // Season index: 0=DJF, 1=MAM, 2=JJA, 3=SON (Northern)
  let seasonIndex: number;
  if (month === 11 || month === 0 || month === 1) seasonIndex = 0;
  else if (month >= 2 && month <= 4) seasonIndex = 1;
  else if (month >= 5 && month <= 7) seasonIndex = 2;
  else seasonIndex = 3;

  const names = hemisphere === 'northern' ? SEASON_NAMES_NORTH : SEASON_NAMES_SOUTH;
  const icons = hemisphere === 'northern' ? SEASON_ICONS_NORTH : SEASON_ICONS_SOUTH;

  // Days until next season change
  const changes = [
    new Date(date.getFullYear(), 2, 1),   // Mar 1 (Spring N / Autumn S)
    new Date(date.getFullYear(), 5, 1),   // Jun 1 (Summer N / Winter S)
    new Date(date.getFullYear(), 8, 1),   // Sep 1 (Autumn N / Spring S)
    new Date(date.getFullYear(), 11, 1),  // Dec 1 (Winter N / Summer S)
    new Date(date.getFullYear() + 1, 2, 1), // Next year Mar
  ];

  let daysUntil = 90;
  for (const changeDate of changes) {
    const diff = Math.ceil((changeDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0 && diff < daysUntil) {
      daysUntil = diff;
    }
  }

  // Astronomical vs meteorological: meteorological is simpler (fixed months)
  // We label based on which solstice/equinox is closer
  const astronomicalEquinox = [
    new Date(date.getFullYear(), 2, 20),    // Vernal ~Mar 20
    new Date(date.getFullYear(), 5, 21),    // Summer ~Jun 21
    new Date(date.getFullYear(), 8, 22),    // Autumnal ~Sep 22
    new Date(date.getFullYear(), 11, 21),   // Winter ~Dec 21
  ];
  const minAstroDist = astronomicalEquinox.reduce((min, d) => {
    const dist = Math.abs(d.getTime() - date.getTime());
    return dist < min ? dist : min;
  }, Infinity);
  const astroDays = Math.ceil(minAstroDist / (1000 * 60 * 60 * 24));
  const isAstronomical = astroDays < 7;

  return {
    name: names[seasonIndex],
    icon: icons[seasonIndex],
    daysUntilChange: daysUntil,
    type: isAstronomical ? 'astronomical' : 'meteorological',
  };
}

// ── Mock Seasonal Weather ─────────────────────────────────────────────

interface WeatherProfile {
  baseTempC: number;
  variance: number;
  conditions: string[];
  icon: string;
}

const SEASON_WEATHER_NORTH: Record<string, WeatherProfile> = {
  'Winter':  { baseTempC: 2, variance: 8, conditions: ['Cold', 'Frosty', 'Snowy', 'Chilly'], icon: 'Snowflake' },
  'Spring':  { baseTempC: 15, variance: 7, conditions: ['Mild', 'Warming', 'Breezy', 'Showers'], icon: 'Flower' },
  'Summer':  { baseTempC: 28, variance: 6, conditions: ['Warm', 'Hot', 'Sunny', 'Humid'], icon: 'Sun' },
  'Autumn':  { baseTempC: 12, variance: 7, conditions: ['Cool', 'Crisp', 'Mild', 'Foggy'], icon: 'Leaf' },
};

const SEASON_WEATHER_SOUTH: Record<string, WeatherProfile> = {
  'Summer':  { baseTempC: 28, variance: 6, conditions: ['Warm', 'Hot', 'Sunny', 'Humid'], icon: 'Sun' },
  'Autumn':  { baseTempC: 18, variance: 5, conditions: ['Mild', 'Cooling', 'Crisp', 'Dry'], icon: 'Leaf' },
  'Winter':  { baseTempC: 8, variance: 7, conditions: ['Cool', 'Cold', 'Rainy', 'Overcast'], icon: 'Snowflake' },
  'Spring':  { baseTempC: 18, variance: 6, conditions: ['Mild', 'Warming', 'Breezy', 'Fresh'], icon: 'Flower' },
};

// Tropical zone adjustments
function adjustForTropics(profile: WeatherProfile, latitude: number): WeatherProfile {
  if (Math.abs(latitude) < 23.5) {
    // Tropical: less variance, warmer
    return {
      baseTempC: Math.max(profile.baseTempC, 22),
      variance: Math.min(profile.variance, 4),
      conditions: ['Warm', 'Humid', 'Tropical', 'Showers'],
      icon: 'CloudRain',
    };
  }
  return profile;
}

function generateWeather(season: SeasonInfo, hemisphere: Hemisphere, latitude: number, date: Date): WeatherApprox {
  const profiles = hemisphere === 'northern' ? SEASON_WEATHER_NORTH : SEASON_WEATHER_SOUTH;
  let profile = profiles[season.name] || SEASON_WEATHER_NORTH['Spring'];
  profile = adjustForTropics(profile, latitude);

  // Deterministic "random" based on day of year
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const pseudoRandom = Math.sin(dayOfYear * 12.9898 + 78.233) * 43758.5453;
  const dayVariance = (pseudoRandom - Math.floor(pseudoRandom) - 0.5) * profile.variance;

  const temperatureC = Math.round(profile.baseTempC + dayVariance);
  const conditionIndex = Math.abs(Math.floor(pseudoRandom * 10)) % profile.conditions.length;
  const condition = profile.conditions[conditionIndex];

  return {
    condition,
    temperatureC,
    description: `${condition}, approximately ${temperatureC}°C`,
    icon: profile.icon,
  };
}

// ── Daylight Hours (Solar Angle Formula) ──────────────────────────────

function calculateDaylight(latitude: number, date: Date): DaylightInfo {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const latRad = latitude * (Math.PI / 180);

  // Solar declination angle (approximation)
  const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
  const declRad = declination * (Math.PI / 180);

  // Hour angle at sunrise/sunset
  const cosHourAngle = -Math.tan(latRad) * Math.tan(declRad);

  let daylightHours: number;
  let sunriseHour: number;
  let sunsetHour: number;

  if (cosHourAngle > 1) {
    // Polar night — no sunrise
    daylightHours = 0;
    sunriseHour = 12;
    sunsetHour = 12;
  } else if (cosHourAngle < -1) {
    // Midnight sun — no sunset
    daylightHours = 24;
    sunriseHour = 0;
    sunsetHour = 24;
  } else {
    const hourAngle = Math.acos(cosHourAngle) * (180 / Math.PI);
    daylightHours = (2 * hourAngle) / 15; // Convert to hours
    sunriseHour = 12 - daylightHours / 2;
    sunsetHour = 12 + daylightHours / 2;
  }

  // Add equation of time correction (simplified)
  const eqTime = 9.87 * Math.sin(2 * (2 * Math.PI / 365) * (dayOfYear - 81))
    - 7.53 * Math.cos((2 * Math.PI / 365) * (dayOfYear - 81))
    - 1.5 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
  sunriseHour -= eqTime / 60;
  sunsetHour -= eqTime / 60;

  const formatTime = (h: number): string => {
    const hours = Math.floor(h);
    const minutes = Math.round((h - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(Math.min(minutes, 59)).padStart(2, '0')}`;
  };

  const now = date;
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const progressDay = currentHour / 24;

  let progressDaylight = 0;
  if (daylightHours > 0) {
    if (currentHour < sunriseHour) {
      progressDaylight = 0; // Before sunrise
    } else if (currentHour > sunsetHour) {
      progressDaylight = 1; // After sunset
    } else {
      progressDaylight = (currentHour - sunriseHour) / Math.max(daylightHours, 0.01);
    }
  }

  return {
    sunrise: formatTime(sunriseHour),
    sunset: formatTime(sunsetHour),
    daylightHours: Math.round(daylightHours * 10) / 10,
    progressDay: Math.round(progressDay * 1000) / 1000,
    progressDaylight: Math.round(Math.min(Math.max(progressDaylight, 0), 1) * 1000) / 1000,
  };
}

// ── Global Context ────────────────────────────────────────────────────

const AWARENESS_DAYS: Record<string, { name: string; category: 'awareness_day' }> = {
  '01-01': { name: 'New Year\'s Day', category: 'awareness_day' },
  '02-14': { name: 'Valentine\'s Day', category: 'awareness_day' },
  '03-08': { name: 'International Women\'s Day', category: 'awareness_day' },
  '03-20': { name: 'International Day of Happiness', category: 'awareness_day' },
  '03-22': { name: 'World Water Day', category: 'awareness_day' },
  '04-07': { name: 'World Health Day', category: 'awareness_day' },
  '04-22': { name: 'Earth Day', category: 'awareness_day' },
  '05-01': { name: 'International Workers\' Day', category: 'awareness_day' },
  '05-17': { name: 'World Telecommunication Day', category: 'awareness_day' },
  '06-05': { name: 'World Environment Day', category: 'awareness_day' },
  '06-21': { name: 'International Day of Yoga', category: 'awareness_day' },
  '07-11': { name: 'World Population Day', category: 'awareness_day' },
  '08-12': { name: 'International Youth Day', category: 'awareness_day' },
  '09-21': { name: 'International Day of Peace', category: 'awareness_day' },
  '10-10': { name: 'World Mental Health Day', category: 'awareness_day' },
  '10-24': { name: 'United Nations Day', category: 'awareness_day' },
  '11-13': { name: 'World Kindness Day', category: 'awareness_day' },
  '12-01': { name: 'World AIDS Day', category: 'awareness_day' },
  '12-10': { name: 'Human Rights Day', category: 'awareness_day' },
};

function generateGlobalContext(date: Date, season: SeasonInfo, hemisphere: Hemisphere, latitude: number): GlobalContextItem[] {
  const items: GlobalContextItem[] = [];
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  // Awareness days
  if (AWARENESS_DAYS[mmdd]) {
    const day = AWARENESS_DAYS[mmdd];
    items.push({
      text: `Today is ${day.name}`,
      category: 'awareness_day',
      priority: 3,
    });
  }

  // Upcoming awareness days (within 7 days)
  for (let i = 1; i <= 7; i++) {
    const future = new Date(date);
    future.setDate(future.getDate() + i);
    const futureMmdd = `${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    if (AWARENESS_DAYS[futureMmdd]) {
      const day = AWARENESS_DAYS[futureMmdd];
      items.push({
        text: `${day.name} in ${i} day${i > 1 ? 's' : ''}`,
        category: 'awareness_day',
        priority: 2,
      });
      break; // Only the nearest upcoming
    }
  }

  // DST transition detection (simplified)
  const month = date.getMonth();
  // Northern hemisphere DST transitions around Mar and Nov
  // Southern hemisphere around Apr and Oct
  if (hemisphere === 'northern') {
    if (month === 2 && date.getDate() >= 8 && date.getDate() <= 14) {
      items.push({ text: 'Daylight saving time starts this week in most Northern regions', category: 'dst_transition', priority: 2 });
    }
    if (month === 10 && date.getDate() >= 1 && date.getDate() <= 7) {
      items.push({ text: 'Daylight saving time ends this week in most Northern regions', category: 'dst_transition', priority: 2 });
    }
  } else {
    if (month === 3 && date.getDate() >= 1 && date.getDate() <= 7) {
      items.push({ text: 'Daylight saving time ends this week in parts of the Southern hemisphere', category: 'dst_transition', priority: 2 });
    }
    if (month === 9 && date.getDate() >= 25 && date.getDate() <= 31) {
      items.push({ text: 'Daylight saving time starts this week in parts of the Southern hemisphere', category: 'dst_transition', priority: 2 });
    }
  }

  // Seasonal notes based on hemisphere + season
  const seasonalNotes: Record<string, string> = {
    'northern-Spring': 'Days are getting longer — morning routines gain power',
    'northern-Summer': 'Peak daylight — align deep work with early hours before heat',
    'northern-Autumn': 'Days are shortening — consider shifting routines earlier',
    'northern-Winter': 'Short days ahead — morning light exposure matters for mood',
    'southern-Spring': 'Days are getting longer — new routines take root easily',
    'southern-Summer': 'Extended daylight — protect peak focus hours before afternoon heat',
    'southern-Autumn': 'Shorter days approaching — anchor evening routines for stability',
    'southern-Winter': 'Limited daylight — prioritize morning sunlight and warmth',
  };
  const noteKey = `${hemisphere}-${season.name}`;
  if (seasonalNotes[noteKey]) {
    items.push({ text: seasonalNotes[noteKey], category: 'seasonal_note', priority: 1 });
  }

  // Latitude-dependent note
  if (Math.abs(latitude) > 55) {
    items.push({
      text: `High latitude (${Math.abs(Math.round(latitude))}°) — extreme daylight variation affects circadian rhythm`,
      category: 'seasonal_note',
      priority: 2,
    });
  } else if (Math.abs(latitude) < 10) {
    items.push({
      text: `Near equator (${Math.abs(Math.round(latitude))}°) — consistent year-round daylight`,
      category: 'seasonal_note',
      priority: 1,
    });
  }

  // Sort by priority descending
  return items.sort((a, b) => b.priority - a.priority).slice(0, 4);
}

// ── World Influence on Productivity ───────────────────────────────────

export function mapWorldToProductivity(context: WorldContext): ProductivityInfluence[] {
  const recs: ProductivityInfluence[] = [];
  const { season, daylight, hemisphere, latitude } = context;

  // Season-based productivity recommendations
  if (season.name === 'Winter') {
    recs.push({
      recommendation: 'Shorter days ahead — consider morning routines to maximize limited daylight',
      category: 'routine',
      icon: 'Sunrise',
    });
    recs.push({
      recommendation: 'Winter can lower energy — prioritize sleep quality and exercise',
      category: 'energy',
      icon: 'Battery',
    });
  } else if (season.name === 'Spring') {
    recs.push({
      recommendation: 'Lengthening days — ideal time to establish new habits',
      category: 'routine',
      icon: 'Sprout',
    });
    recs.push({
      recommendation: 'Spring energy boost — channel momentum into goal progress',
      category: 'focus',
      icon: 'Zap',
    });
  } else if (season.name === 'Summer') {
    recs.push({
      recommendation: 'Peak daylight — protect morning deep-work hours before heat',
      category: 'focus',
      icon: 'Target',
    });
    recs.push({
      recommendation: 'Long days can delay rest — enforce consistent sleep schedules',
      category: 'energy',
      icon: 'Moon',
    });
  } else if (season.name === 'Autumn') {
    recs.push({
      recommendation: 'Days shortening — shift routines earlier to catch available light',
      category: 'routine',
      icon: 'Sunset',
    });
    recs.push({
      recommendation: 'Transitional season — review and consolidate before winter',
      category: 'focus',
      icon: 'Compass',
    });
  }

  // Daylight-based recommendations
  if (daylight.daylightHours < 10) {
    recs.push({
      recommendation: `Only ${daylight.daylightHours}h of daylight — morning light exposure is critical`,
      category: 'environment',
      icon: 'Sun',
    });
  } else if (daylight.daylightHours > 16) {
    recs.push({
      recommendation: `${daylight.daylightHours}h of daylight — extended work potential but guard against burnout`,
      category: 'energy',
      icon: 'BatteryCharging',
    });
  }

  // If currently in daylight hours
  const currentHour = new Date().getHours();
  if (daylight.progressDaylight > 0 && daylight.progressDaylight < 1) {
    if (daylight.progressDaylight < 0.3) {
      recs.push({
        recommendation: 'Early daylight period — optimal for focused deep work',
        category: 'focus',
        icon: 'Sun',
      });
    } else if (daylight.progressDaylight > 0.7) {
      recs.push({
        recommendation: 'Late daylight — wind down deep work, shift to lighter tasks',
        category: 'focus',
        icon: 'Sunset',
      });
    }
  } else if (daylight.progressDaylight >= 1) {
    recs.push({
      recommendation: 'Evening hours — prioritize rest, reflection, and preparation for tomorrow',
      category: 'routine',
      icon: 'Moon',
    });
  } else if (daylight.progressDaylight <= 0) {
    recs.push({
      recommendation: 'Before sunrise — this quiet window is powerful for planning and reflection',
      category: 'routine',
      icon: 'Sunrise',
    });
  }

  // Season transition urgency
  if (season.daysUntilChange <= 7) {
    recs.push({
      recommendation: `${season.name} transitions in ${season.daysUntilChange} days — prepare your routine shift`,
      category: 'routine',
      icon: 'ArrowRight',
    });
  }

  return recs.slice(0, 3); // Top 3 recommendations
}

// ── Cache Management ─────────────────────────────────────────────────

const CACHE_KEY = 'lifeos_world_context';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface CachedWorldContext {
  data: WorldContext;
  timestamp: number;
}

function getCachedContext(): WorldContext | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedWorldContext = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.data;
  } catch {
    return null;
  }
}

function setCachedContext(ctx: WorldContext): void {
  try {
    const cached: CachedWorldContext = { data: ctx, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // localStorage full or unavailable — graceful fallback
  }
}

// ── Main Entry Point ─────────────────────────────────────────────────

/**
 * Get the current world context. Uses cache if available (4hr TTL),
 * otherwise generates fresh context from timezone + date.
 */
export function getWorldContext(forceRefresh = false): WorldContext {
  if (!forceRefresh) {
    const cached = getCachedContext();
    if (cached) return cached;
  }

  const now = new Date();
  const timezone = detectTimezone();
  const timezoneOffset = getTimezoneOffset(timezone);
  const latitude = getLatitudeForTimezone(timezone);
  const hemisphere = getHemisphere(latitude);
  const season = getSeason(now, hemisphere);
  const weather = generateWeather(season, hemisphere, latitude, now);
  const daylight = calculateDaylight(latitude, now);
  const globalContext = generateGlobalContext(now, season, hemisphere, latitude);
  const productivity = mapWorldToProductivity({
    timezone,
    timezoneOffset,
    hemisphere,
    latitude,
    season,
    weather,
    daylight,
    globalContext,
    productivity: [], // Will be filled below
    generatedAt: now.toISOString(),
  });

  const ctx: WorldContext = {
    timezone,
    timezoneOffset,
    hemisphere,
    latitude,
    season,
    weather,
    daylight,
    globalContext,
    productivity,
    generatedAt: now.toISOString(),
  };

  setCachedContext(ctx);
  return ctx;
}