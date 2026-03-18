import { localDateStr } from '../../utils/date';
import type { ScheduleEvent } from './types';

// ── Constants ──
export const WAKE_START = 6;  // 6 AM
export const WAKE_END = 23;   // 11 PM

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const MIN_HOUR_H = 30;
export const MAX_HOUR_H = 80;
export const DEFAULT_HOUR_H = 40;
export const ZOOM_STEP = 10;

export const DURATIONS = [15, 30, 45, 60, 90, 120];

export const PRIORITIES = [
  { id: 'critical', label: 'Critical', color: '#F43F5E' },
  { id: 'high', label: 'High', color: '#F97316' },
  { id: 'medium', label: 'Medium', color: '#FACC15' },
  { id: 'low', label: 'Low', color: '#39FF14' },
];

// ── Helper Functions ──

/** Format date for display (e.g., "Monday, 3 March") */
export function fmtDisplay(d: Date): string {
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Format hour label (e.g., "9 AM" or "09:00") */
export function fmtHourLabel(h: number, use24h: boolean): string {
  if (use24h) return `${String(h).padStart(2, '0')}:00`;
  return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
}

/** Format time from ISO string (e.g., "9:30 AM" or "09:30") */
export function timeStr(iso: string, use24h: boolean = false): string {
  try {
    const d = new Date(iso);
    if (use24h) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m} ${ampm}`;
  } catch {
    return '';
  }
}

/** Snap minutes to nearest 15 */
export function snap15(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

/** Get month grid (42 cells for calendar) */
export function getMonthGrid(year: number, month: number): { date: number; iso: string; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = (first.getDay() + 6) % 7; // Monday = 0
  const days: { date: number; iso: string; inMonth: boolean }[] = [];
  
  // Fill preceding days from previous month
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d.getDate(), iso: localDateStr(d), inMonth: false });
  }
  
  // Fill current month days
  for (let i = 1; i <= last.getDate(); i++) {
    const d = new Date(year, month, i);
    days.push({ date: i, iso: localDateStr(d), inMonth: true });
  }
  
  // Fill remaining days from next month
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    days.push({ date: i, iso: localDateStr(d), inMonth: false });
  }
  
  return days;
}

/** Calculate free time in day (hours) */
export function calculateFreeTime(events: ScheduleEvent[], date: Date): number {
  const selStr = localDateStr(date);
  const dayEvents = events.filter(ev => {
    if (!ev.start_time) return false;
    const evDate = new Date(ev.start_time);
    if (isNaN(evDate.getTime())) return false;
    return localDateStr(evDate) === selStr;
  });
  
  // Total occupied time
  let occupiedMinutes = 0;
  dayEvents.forEach(ev => {
    if (!ev.start_time || !ev.end_time) return;
    const start = new Date(ev.start_time);
    const end = new Date(ev.end_time);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
    const diff = (end.getTime() - start.getTime()) / 60000;
    // Skip negative or absurdly long durations (> 24h)
    if (diff <= 0 || diff > 1440) return;
    occupiedMinutes += diff;
  });
  
  // Guard against NaN
  if (isNaN(occupiedMinutes) || !isFinite(occupiedMinutes)) {
    occupiedMinutes = 0;
  }
  
  // Waking hours: 6am to 11pm = 17 hours = 1020 minutes
  const totalWakingMinutes = (WAKE_END - WAKE_START) * 60;
  const freeMinutes = Math.max(0, totalWakingMinutes - occupiedMinutes);
  const result = Math.round(freeMinutes / 60 * 10) / 10; // Round to 1 decimal
  
  // Final safety check
  if (isNaN(result) || !isFinite(result) || result < 0) return 0;
  if (result > 24) return 17; // Can't exceed waking hours
  return result;
}

/** Get next event from now */
export function getNextEvent(events: ScheduleEvent[]): ScheduleEvent | null {
  const now = new Date();
  const upcoming = events
    .filter(ev => new Date(ev.start_time) > now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  return upcoming[0] || null;
}
