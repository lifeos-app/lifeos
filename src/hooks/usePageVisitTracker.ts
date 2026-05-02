/**
 * usePageVisitTracker — Tracks page visits in localStorage for adaptive navigation.
 *
 * Data structure in localStorage (key: 'lifeos_page_visits'):
 *   { [pageId: string]: { count: number, lastVisit: number } }
 *
 * Maps pathname → feature-registry ID, records every route change,
 * and provides helpers to read visit stats for adaptive reordering.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { FEATURES } from '../lib/feature-registry';

const STORAGE_KEY = 'lifeos_page_visits';
const MAX_TRACKED_PAGES = 50;

export interface PageVisitStat {
  id: string;
  count: number;
  lastVisit: number; // Unix ms timestamp
}

interface VisitData {
  count: number;
  lastVisit: number;
}

type VisitMap = Record<string, VisitData>;

// ── Pathname → feature ID mapping ──

/** Build a reverse map from route → feature ID, once. */
const ROUTE_TO_ID = new Map<string, string>();
for (const f of FEATURES) {
  ROUTE_TO_ID.set(f.route, f.id);
}

/**
 * Given a pathname, find the matching feature ID.
 * Handles exact matches and prefix matches (e.g. /goals/123 → 'goals').
 * '/' maps to 'dashboard'.
 */
function pathnameToFeatureId(pathname: string): string | null {
  // Exact match
  const exact = ROUTE_TO_ID.get(pathname);
  if (exact) return exact;

  // Prefix match: find longest matching route
  let bestMatch: string | null = null;
  let bestLen = 0;
  for (const [route, id] of ROUTE_TO_ID) {
    if (route !== '/' && pathname.startsWith(route + '/')) {
      if (route.length > bestLen) {
        bestLen = route.length;
        bestMatch = id;
      }
    }
  }
  return bestMatch;
}

// ── localStorage read/write ──

function readVisits(): VisitMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as VisitMap;
  } catch {
    return {};
  }
}

function writeVisits(data: VisitMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — non-critical
  }
}

/** Evict least-recently-used entries if over the max. */
function evictIfNeeded(data: VisitMap): VisitMap {
  const entries = Object.entries(data);
  if (entries.length <= MAX_TRACKED_PAGES) return data;

  // Sort by lastVisit ascending, drop oldest entries
  entries.sort((a, b) => a[1].lastVisit - b[1].lastVisit);
  const kept = entries.slice(entries.length - MAX_TRACKED_PAGES);
  return Object.fromEntries(kept);
}

// ── Public API ──

/**
 * Record a visit for the given feature ID.
 * Called internally by the hook; also exported for manual calls.
 */
export function recordVisit(featureId: string): void {
  const data = readVisits();
  const existing = data[featureId];
  const now = Date.now();

  if (existing) {
    existing.count += 1;
    existing.lastVisit = now;
  } else {
    data[featureId] = { count: 1, lastVisit: now };
  }

  writeVisits(evictIfNeeded(data));
}

/**
 * Get all visit stats sorted by count descending.
 */
export function getPageVisitStats(): PageVisitStat[] {
  const data = readVisits();
  return Object.entries(data)
    .map(([id, v]) => ({ id, count: v.count, lastVisit: v.lastVisit }))
    .sort((a, b) => b.count - a.count || b.lastVisit - a.lastVisit);
}

/**
 * Get the top N most-visited feature IDs.
 */
export function getTopPageIds(n: number): string[] {
  return getPageVisitStats().slice(0, n).map(s => s.id);
}

/**
 * Get the count of distinct days with visit data.
 * Used to determine if we have enough data for adaptive reordering.
 */
export function getVisitDayCount(): number {
  const data = readVisits();
  if (Object.keys(data).length === 0) return 0;

  // Collect all unique days from lastVisit timestamps
  const daySet = new Set<string>();
  for (const v of Object.values(data)) {
    // Use the date string (YYYY-MM-DD) as the day key
    const day = new Date(v.lastVisit).toISOString().slice(0, 10);
    daySet.add(day);
  }
  return daySet.size;
}

/**
 * Hook that auto-tracks page visits on every route change.
 * Drop into any mounted component (e.g., App or Layout) to start tracking.
 */
export function usePageVisitTracker(): void {
  const location = useLocation();
  const lastTrackedPath = useRef<string>('');

  useEffect(() => {
    const path = location.pathname;
    // Avoid re-recording on re-renders with same path
    if (path === lastTrackedPath.current) return;
    lastTrackedPath.current = path;

    const featureId = pathnameToFeatureId(path);
    if (featureId) {
      recordVisit(featureId);
    }
  }, [location.pathname]);
}