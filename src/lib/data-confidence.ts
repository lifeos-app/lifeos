/**
 * data-confidence.ts — Data Confidence Scoring for LifeOS
 *
 * Scores habit logs by how close to real-time they were recorded.
 * Affects XP multipliers — same-day logs are worth more than
 * retrospective logs entered days later.
 *
 * Pure functions — no React imports.
 */

import type { HabitLog } from '../types/database';

// ── TYPES ──────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'inferred';

export interface DataConfidence {
  level: ConfidenceLevel;
  multiplier: number;
  reason: string;
}

// ── CONSTANTS ──────────────────────────────────────────────────

export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: '#39FF14',     // green
  medium: '#00D4FF',   // accent blue
  low: '#D4AF37',      // gold/warning
  inferred: '#F43F5E', // red/caution
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── PUBLIC API ─────────────────────────────────────────────────

/**
 * Determine confidence level for a single habit log.
 * Based on the gap between log.date (the date the log is for)
 * and log.created_at (when the log was actually recorded).
 *
 * - High (1.0x): logged same day
 * - Medium (0.8x): logged within 24h
 * - Low (0.6x): logged 2-3 days after
 * - Inferred (0.4x): retrospective log > 3 days later
 */
export function getLogConfidence(log: HabitLog): DataConfidence {
  if (!log.created_at || !log.date) {
    return { level: 'medium', multiplier: 0.8, reason: 'Missing timestamp data' };
  }

  const logDate = new Date(log.date + 'T23:59:59');
  const createdAt = new Date(log.created_at);
  const gapMs = createdAt.getTime() - logDate.getTime();
  const gapDays = Math.max(0, gapMs / MS_PER_DAY);

  // Same day: created_at is on or before end of log.date
  if (gapDays <= 0 || log.date === log.created_at.split('T')[0]) {
    return {
      level: 'high',
      multiplier: 1.0,
      reason: 'Logged same day',
    };
  }

  if (gapDays <= 1) {
    return {
      level: 'medium',
      multiplier: 0.8,
      reason: 'Logged within 24 hours',
    };
  }

  if (gapDays <= 3) {
    return {
      level: 'low',
      multiplier: 0.6,
      reason: `Logged ${Math.ceil(gapDays)} days later`,
    };
  }

  return {
    level: 'inferred',
    multiplier: 0.4,
    reason: `Retrospective log (${Math.ceil(gapDays)} days later)`,
  };
}

/**
 * Apply confidence multiplier to base XP.
 */
export function applyConfidenceToXP(baseXP: number, confidence: DataConfidence): number {
  return Math.round(baseXP * confidence.multiplier);
}

/**
 * Get daily confidence stats over a date range.
 * Returns average confidence multiplier per day for visualization.
 */
export function getDailyConfidenceStats(logs: HabitLog[]): { date: string; avgConfidence: number }[] {
  const byDate: Record<string, DataConfidence[]> = {};

  for (const log of logs) {
    const confidence = getLogConfidence(log);
    if (!byDate[log.date]) byDate[log.date] = [];
    byDate[log.date].push(confidence);
  }

  return Object.entries(byDate)
    .map(([date, confidences]) => {
      const avg = confidences.reduce((s, c) => s + c.multiplier, 0) / confidences.length;
      return { date, avgConfidence: Math.round(avg * 100) / 100 };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get confidence distribution counts for a set of logs.
 */
export function getConfidenceDistribution(logs: HabitLog[]): Record<ConfidenceLevel, number> {
  const dist: Record<ConfidenceLevel, number> = {
    high: 0,
    medium: 0,
    low: 0,
    inferred: 0,
  };

  for (const log of logs) {
    const confidence = getLogConfidence(log);
    dist[confidence.level]++;
  }

  return dist;
}
