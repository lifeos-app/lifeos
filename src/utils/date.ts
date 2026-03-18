/**
 * Shared Date Utilities — LifeOS
 *
 * Single source of truth for all date formatting/manipulation.
 * Replaces 18+ inline implementations scattered across pages.
 */

const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parse a date string in a Safari-safe way.
 * Safari rejects `new Date('2026-02-21 10:00')` — must use ISO format with T separator.
 * This function normalises space-separated datetimes to ISO format.
 */
export function safeDateParse(dateStr: string): Date {
  if (!dateStr) return new Date();
  // Replace space separator with T for ISO compliance (Safari requirement)
  const normalised = dateStr.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d)/, '$1T$2');
  return new Date(normalised);
}

/**
 * Safe storage helper — wraps localStorage to handle Safari private browsing
 * which throws on setItem/removeItem.
 */
export function safeStorage(op: 'get', key: string): string | null;
export function safeStorage(op: 'set', key: string, value: string): void;
export function safeStorage(op: 'remove', key: string): void;
export function safeStorage(op: 'get' | 'set' | 'remove', key: string, value?: string): string | null | void {
  try {
    switch (op) {
      case 'get': return localStorage.getItem(key);
      case 'set': localStorage.setItem(key, value!); return;
      case 'remove': localStorage.removeItem(key); return;
    }
  } catch {
    // Safari private browsing throws on storage writes
    if (op === 'get') return null;
  }
}

/**
 * Format a Date to YYYY-MM-DD local string (no timezone drift).
 */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Format a date for display: "Today", "Yesterday", "Tomorrow", or "WED, 14 Feb"
 */
export function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00'); // noon to avoid timezone drift
  const now = new Date();
  const todayIso = localDateStr(now);
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const tom = new Date(now); tom.setDate(now.getDate() + 1);
  if (iso === todayIso) return 'Today';
  if (iso === localDateStr(yest)) return 'Yesterday';
  if (iso === localDateStr(tom)) return 'Tomorrow';
  return `${DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/**
 * Extract HH:MM from an ISO datetime string.
 */
export function formatTime(isoDatetime: string): string {
  if (!isoDatetime) return '--:--';
  const timePart = isoDatetime.split('T')[1];
  return timePart ? timePart.substring(0, 5) : '--:--';
}

/**
 * Format a date as a short relative label: "2d ago", "in 3h", "just now"
 */
export function formatRelative(isoDatetime: string): string {
  const target = new Date(isoDatetime);
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const absDiff = Math.abs(diffMs);
  const isPast = diffMs > 0;

  if (absDiff < 60_000) return 'just now';

  const mins = Math.floor(absDiff / 60_000);
  if (mins < 60) return isPast ? `${mins}m ago` : `in ${mins}m`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return isPast ? `${hours}h ago` : `in ${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return isPast ? `${days}d ago` : `in ${days}d`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return isPast ? `${weeks}w ago` : `in ${weeks}w`;

  const months = Math.floor(days / 30);
  return isPast ? `${months}mo ago` : `in ${months}mo`;
}

/**
 * Format a duration in minutes to human-readable: "1h 30m", "45m", "2h"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Get the short day name for a Date: "MON", "TUE", etc.
 */
export function getDayName(d: Date): string {
  return DAYS_SHORT[d.getDay()];
}

/**
 * Get the Monday-to-Sunday week range for a given date.
 * Returns array of { day, date, fullDate, isToday }.
 */
export function getWeekRange(referenceDate: Date = new Date()): {
  day: string;
  date: number;
  fullDate: string;
  isToday: boolean;
  isPast: boolean;
}[] {
  const now = new Date();
  const todayStr = now.toDateString();
  const dow = referenceDate.getDay();
  const mon = new Date(referenceDate);
  mon.setDate(referenceDate.getDate() - ((dow + 6) % 7));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const isToday = d.toDateString() === todayStr;
    return {
      day: DAYS_SHORT[d.getDay()],
      date: d.getDate(),
      fullDate: localDateStr(d),
      isToday,
      isPast: !isToday && d < now,
    };
  });
}

/**
 * Get the first day of the current month as YYYY-MM-DD.
 */
export function startOfMonth(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Get the start of the ISO week (Monday) for a given date.
 */
export function startOfWeek(d: Date = new Date()): Date {
  const result = new Date(d);
  const day = result.getDay();
  const diff = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Days from now to a date string. Positive = future, negative = past.
 */
export function daysFromNow(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

/**
 * Format a date for en-AU short display: "14 Feb"
 */
export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

/**
 * Get the greeting based on time of day.
 */
export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Night owl mode';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Night owl mode';
}

/**
 * Check if an hour is nighttime (for moon/sun icon logic).
 */
export function isNightTime(): boolean {
  const h = new Date().getHours();
  return h < 6 || h >= 21;
}

export function isMorning(): boolean {
  const h = new Date().getHours();
  return h >= 6 && h < 12;
}

/**
 * Generate a UUID using the native crypto API with fallback for older browsers.
 * Compatible with Safari 15.4+, older browsers get timestamp-based UUID.
 */
export function genId(): string {
  // Check if crypto.randomUUID is available (Safari 15.4+, Chrome 92+, Firefox 95+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers (polyfill)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Format a number as AUD currency: "$1,234.56"
 */
export function fmtCurrency(n: number): string {
  const abs = Math.abs(n);
  return `$${abs.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format a number as short currency: "$1.2k", "$1.5M"
 */
export function fmtCurrencyShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

/**
 * Today as YYYY-MM-DD string (alias for localDateStr with no args).
 */
export function todayStr(): string {
  return localDateStr();
}

/**
 * Current month as YYYY-MM string.
 */
export function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
