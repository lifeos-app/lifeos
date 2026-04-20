// ═══════════════════════════════════════════════════════════
// Smart Sleep Hooks — bedtime tracking + sleep insights
// Used by SleepQuickLog and future sleep features
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { HealthMetric } from '../types/database';

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

interface BedtimeData {
  bedtime: string;   // ISO string
  wakeTime?: string; // ISO string
}

export interface BedtimeState {
  bedtime: Date | null;
  wakeTime: Date | null;
  calculatedHours: number | null;
  isInBed: boolean;
  sleepDebt: number | null;
}

export interface SleepInsight {
  type: 'streak' | 'debt' | 'improving' | 'declining' | 'optimal' | 'consistency';
  message: string;
  icon: string;   // Lucide icon name
  color: string;  // hex color
}

export interface SleepInsights {
  insights: SleepInsight[];
  avgHours: number | null;
  avgQuality: number | null;
  streak: number;
  todayLogged: boolean;
  todayQualityLogged: boolean;
}

// ──────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'lifeos_bedtime';
const HOURS_IN_BED_THRESHOLD = 12;   // max hours before we consider bedtime stale
const STALE_DATA_HOURS = 24;         // auto-clear data older than this
const SLEEP_TARGET_HOURS = 7;
const STREAK_MINIMUM_HOURS = 7;
const INSIGHT_COLORS = {
  streak: '#39FF14',
  debt: '#F43F5E',
  improving: '#00D4FF',
  declining: '#FACC15',
  optimal: '#818CF8',
  consistency: '#A855F7',
} as const;

// ──────────────────────────────────────────────────────────
// useSmartBedtime
// ──────────────────────────────────────────────────────────

function readBedtimeData(): BedtimeData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BedtimeData;
  } catch {
    return null;
  }
}

function writeBedtimeData(data: BedtimeData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearBedtimeData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function isDataStale(data: BedtimeData): boolean {
  const stored = new Date(data.bedtime).getTime();
  const now = Date.now();
  return (now - stored) > STALE_DATA_HOURS * 60 * 60 * 1000;
}

function calculateSleepDebt(): number | null {
  // Look at the last 7 days of sleep_hours stored in localStorage history
  try {
    const historyRaw = localStorage.getItem('lifeos_sleep_history');
    if (!historyRaw) return null;
    const history: Array<{ date: string; sleep_hours: number }> = JSON.parse(historyRaw);
    const last7 = history.slice(0, 7);
    if (last7.length === 0) return null;
    const totalDebt = last7.reduce((sum, entry) => {
      return sum + Math.max(0, SLEEP_TARGET_HOURS - entry.sleep_hours);
    }, 0);
    return Math.round(totalDebt * 10) / 10;
  } catch {
    return null;
  }
}

export function useSmartBedtime(): {
  state: BedtimeState;
  logBedtime: () => void;
  logWakeTime: () => void;
  cancelBedtime: () => void;
} {
  const [bedtime, setBedtime] = useState<Date | null>(null);
  const [wakeTime, setWakeTime] = useState<Date | null>(null);
  const [calculatedHours, setCalculatedHours] = useState<number | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const data = readBedtimeData();
    if (!data) return;

    // Auto-clear stale data
    if (isDataStale(data)) {
      clearBedtimeData();
      return;
    }

    const bt = new Date(data.bedtime);
    const wt = data.wakeTime ? new Date(data.wakeTime) : null;

    setBedtime(bt);
    setWakeTime(wt);

    if (wt) {
      const hours = (wt.getTime() - bt.getTime()) / (1000 * 60 * 60);
      setCalculatedHours(Math.round(hours * 10) / 10);
    }
  }, []);

  const isInBed = useMemo(() => {
    if (!bedtime) return false;
    if (wakeTime) return false;
    const hoursSinceBedtime = (Date.now() - bedtime.getTime()) / (1000 * 60 * 60);
    return hoursSinceBedtime <= HOURS_IN_BED_THRESHOLD;
  }, [bedtime, wakeTime]);

  const sleepDebt = useMemo(() => calculateSleepDebt(), [bedtime, wakeTime]);

  const logBedtime = useCallback(() => {
    const now = new Date();
    const data: BedtimeData = { bedtime: now.toISOString() };
    writeBedtimeData(data);
    setBedtime(now);
    setWakeTime(null);
    setCalculatedHours(null);
  }, []);

  const logWakeTime = useCallback(() => {
    if (!bedtime) return;
    const now = new Date();
    const hours = (now.getTime() - bedtime.getTime()) / (1000 * 60 * 60);
    const rounded = Math.round(hours * 10) / 10;

    const data: BedtimeData = {
      bedtime: bedtime.toISOString(),
      wakeTime: now.toISOString(),
    };
    writeBedtimeData(data);
    setWakeTime(now);
    setCalculatedHours(rounded);

    // Persist to sleep history for debt calculations
    try {
      const historyRaw = localStorage.getItem('lifeos_sleep_history');
      const history: Array<{ date: string; sleep_hours: number }> = historyRaw
        ? JSON.parse(historyRaw)
        : [];
      // Add or update today's entry
      const today = now.toISOString().split('T')[0];
      const existing = history.findIndex(e => e.date === today);
      if (existing >= 0) {
        history[existing].sleep_hours = rounded;
      } else {
        history.unshift({ date: today, sleep_hours: rounded });
      }
      // Keep only last 30 days
      const trimmed = history.slice(0, 30);
      localStorage.setItem('lifeos_sleep_history', JSON.stringify(trimmed));
    } catch {
      // Silent fail — non-critical persistence
    }
  }, [bedtime]);

  const cancelBedtime = useCallback(() => {
    clearBedtimeData();
    setBedtime(null);
    setWakeTime(null);
    setCalculatedHours(null);
  }, []);

  return {
    state: {
      bedtime,
      wakeTime,
      calculatedHours,
      isInBed,
      sleepDebt,
    },
    logBedtime,
    logWakeTime,
    cancelBedtime,
  };
}

// ──────────────────────────────────────────────────────────
// useSleepInsights
// ──────────────────────────────────────────────────────────

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

export function useSleepInsights(metrics: HealthMetric[]): SleepInsights {
  return useMemo(() => {
    // Take last 14 days
    const last14 = metrics.slice(0, 14);

    // Filter entries with sleep data
    const withHours = last14.filter(m => m.sleep_hours != null && m.sleep_hours > 0);
    const withQuality = last14.filter(m => m.sleep_quality != null && m.sleep_quality > 0);

    // Average hours
    const avgHours = withHours.length > 0
      ? Math.round((withHours.reduce((s, m) => s + (m.sleep_hours ?? 0), 0) / withHours.length) * 10) / 10
      : null;

    // Average quality
    const avgQuality = withQuality.length > 0
      ? Math.round((withQuality.reduce((s, m) => s + (m.sleep_quality ?? 0), 0) / withQuality.length) * 10) / 10
      : null;

    // Streak: consecutive days (most recent first) with 7+ hours
    let streak = 0;
    for (const m of last14) {
      if (m.sleep_hours != null && m.sleep_hours >= STREAK_MINIMUM_HOURS) {
        streak++;
      } else {
        break;
      }
    }

    // Today check
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = last14.find(m => m.date === today);
    const todayLogged = todayEntry != null && todayEntry.sleep_hours != null;
    const todayQualityLogged = todayEntry != null && todayEntry.sleep_quality != null;

    // ── Insight generation (max 3) ──
    const insights: SleepInsight[] = [];

    // Streak insight
    if (streak >= 3) {
      insights.push({
        type: 'streak',
        message: `${streak}-day streak of 7+ hours`,
        icon: 'Moon',
        color: INSIGHT_COLORS.streak,
      });
    }

    // Debt / low average warning
    if (avgHours != null && avgHours < 6.5) {
      insights.push({
        type: 'debt',
        message: `Averaging ${avgHours}h — consider an earlier bedtime`,
        icon: 'AlertTriangle',
        color: INSIGHT_COLORS.debt,
      });
    }

    // Optimal range
    if (avgHours != null && avgHours >= 7.5 && avgHours <= 8.5 && insights.length < 3) {
      insights.push({
        type: 'optimal',
        message: 'In the optimal sleep range',
        icon: 'CheckCircle2',
        color: INSIGHT_COLORS.optimal,
      });
    }

    // Trending: compare first half vs second half of the 14-day window
    // (last14 is newest first, so first half = most recent, second half = older)
    if (withHours.length >= 6 && insights.length < 3) {
      const midpoint = Math.floor(withHours.length / 2);
      const recent = withHours.slice(0, midpoint);
      const older = withHours.slice(midpoint);
      const recentAvg = recent.reduce((s, m) => s + (m.sleep_hours ?? 0), 0) / recent.length;
      const olderAvg = older.reduce((s, m) => s + (m.sleep_hours ?? 0), 0) / older.length;
      const diff = recentAvg - olderAvg;

      if (diff > 0.5) {
        insights.push({
          type: 'improving',
          message: 'Sleep is improving this week',
          icon: 'TrendingUp',
          color: INSIGHT_COLORS.improving,
        });
      } else if (diff < -0.5) {
        insights.push({
          type: 'declining',
          message: 'Getting less sleep than last week',
          icon: 'TrendingDown',
          color: INSIGHT_COLORS.declining,
        });
      }
    }

    // Consistency praise
    if (withHours.length >= 4 && insights.length < 3) {
      const hoursArr = withHours.map(m => m.sleep_hours ?? 0);
      const std = standardDeviation(hoursArr);
      if (std < 0.5) {
        insights.push({
          type: 'consistency',
          message: 'Very consistent sleep schedule',
          icon: 'Sunrise',
          color: INSIGHT_COLORS.consistency,
        });
      }
    }

    // Cap at 3
    return {
      insights: insights.slice(0, 3),
      avgHours,
      avgQuality,
      streak,
      todayLogged,
      todayQualityLogged,
    };
  }, [metrics]);
}