/**
 * useAdaptiveNav — Provides adaptively-reordered navigation items
 * based on page visit frequency tracked by usePageVisitTracker.
 *
 * Rules:
 * - Before 7 days of visit data, falls back to hardcoded feature-registry order.
 * - After 7+ days, most-used features bubble up (higher visit count = higher position).
 * - Dashboard/Today ALWAYS stays in first position.
 * - Reordering frequency is limited to once per day (caches the reorder result).
 * - Progressive disclosure (revealAfterDays) is still respected.
 */

import { useMemo } from 'react';
import {
  FEATURES,
  FeatureModule,
  getNavFeatures,
  getMobileMainTabs,
  getMobileMoreGroups,
} from '../lib/feature-registry';
import { getPageVisitStats, getVisitDayCount } from './usePageVisitTracker';

// ── Constants ──

const MIN_VISIT_DAYS = 7; // Minimum days of data before adaptive reordering kicks in
const CACHE_KEY = 'lifeos_adaptive_nav_cache';
const CACHE_TIMESTAMP_KEY = 'lifeos_adaptive_nav_cache_ts';

// Feature IDs that should NEVER be moved from their pinned position
const PINNED_FIRST_IDS = new Set(['dashboard']);

// ── Internal helpers ──

/** Cached reorder result (persisted to localStorage, refreshed once per day max). */
interface AdaptiveCache {
  sidebarOrder: string[];
  mobileMainOrder: string[];
  mobileLifeOrder: string[];
  mobileGrowthOrder: string[];
}

function readCache(): AdaptiveCache | null {
  try {
    const ts = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (ts) {
      const age = Date.now() - Number(ts);
      // Refresh cache once per day (86_400_000 ms)
      if (age < 86_400_000) {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) return JSON.parse(raw) as AdaptiveCache;
      }
    }
  } catch { /* ignore */ }
  return null;
}

function writeCache(cache: AdaptiveCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
  } catch { /* storage full — non-critical */ }
}

/**
 * Reorder items by visit count, keeping pinned items first.
 * Items with no visit data stay in their original relative order.
 */
function reorderItems(
  items: FeatureModule[],
  visitMap: Map<string, number>,
  pinnedIds: Set<string>,
): FeatureModule[] {
  if (items.length <= 1) return items;

  // Separate pinned and non-pinned
  const pinned: FeatureModule[] = [];
  const nonPinned: FeatureModule[] = [];

  for (const item of items) {
    if (pinnedIds.has(item.id)) {
      pinned.push(item);
    } else {
      nonPinned.push(item);
    }
  }

  // Sort non-pinned by visit count (desc), ties broken by original order
  const stableNonPinned = nonPinned.map((item, i) => ({ item, origIndex: i }));
  stableNonPinned.sort((a, b) => {
    const aVisits = visitMap.get(a.item.id) ?? 0;
    const bVisits = visitMap.get(b.item.id) ?? 0;
    if (aVisits !== bVisits) return bVisits - aVisits;
    // Tiebreaker: original order
    return a.origIndex - b.origIndex;
  });

  return [...pinned, ...stableNonPinned.map(x => x.item)];
}

// ── Public hook types ──

export interface AdaptiveNavItem extends FeatureModule {
  visitCount: number;
  /** True if this item was reordered by usage (moved up from its default position). */
  isMostUsed: boolean;
}

export interface AdaptiveNavResult {
  /** Sidebar nav items (already filtered, sorted, and with visit counts). */
  navItems: AdaptiveNavItem[];
  /** Mobile main tab items. */
  mainTabs: AdaptiveNavItem[];
  /** Mobile "More" groups. */
  moreGroups: {
    life: AdaptiveNavItem[];
    growth: AdaptiveNavItem[];
  };
}

// ── Helper to find feature by ID ──

const FEATURES_BY_ID = new Map<string, FeatureModule>();
for (const f of FEATURES) {
  FEATURES_BY_ID.set(f.id, f);
}

// ── Main hook ──

/**
 * Returns adaptive nav items for the given account age.
 * Uses localStorage visit data to reorder after MIN_VISIT_DAYS.
 */
export function useAdaptiveNav(accountDays: number): AdaptiveNavResult {
  return useMemo(() => {
    const shouldAdapt = getVisitDayCount() >= MIN_VISIT_DAYS;

    // Build visit map from stats
    const stats = getPageVisitStats();
    const visitMap = new Map<string, number>();
    for (const s of stats) {
      visitMap.set(s.id, s.count);
    }

    // If not enough data, use default ordering
    if (!shouldAdapt) {
      return buildResult(accountDays, visitMap, false);
    }

    // Check cache (once per day max)
    const cache = readCache();
    if (cache) {
      return buildFromCache(cache, accountDays, visitMap);
    }

    // No cache or stale cache — recompute
    const result = buildResult(accountDays, visitMap, true);
    writeCache({
      sidebarOrder: result.navItems.map(i => i.id),
      mobileMainOrder: result.mainTabs.map(i => i.id),
      mobileLifeOrder: result.moreGroups.life.map(i => i.id),
      mobileGrowthOrder: result.moreGroups.growth.map(i => i.id),
    });

    return result;
  }, [accountDays]);
}

/**
 * Build result by applying adaptive reorder to the filtered feature lists.
 */
function buildResult(
  accountDays: number,
  visitMap: Map<string, number>,
  adaptive: boolean,
): AdaptiveNavResult {
  // Get baseline items from feature-registry (respects progressive disclosure)
  const sidebarBase = getNavFeatures('sidebar', accountDays);
  const mobileMainBase = getMobileMainTabs(accountDays);
  const mobileMoreBase = getMobileMoreGroups(accountDays);

  // Apply adaptive reorder if enabled
  const sidebarItems = adaptive
    ? reorderItems(sidebarBase, visitMap, PINNED_FIRST_IDS)
    : sidebarBase;

  // For mobile main tabs, only the top 4 slots are the "main" nav.
  // We reorder to put most-used in the main area.
  const mobileMainItems = adaptive
    ? reorderMobileMain(mobileMainBase, visitMap, accountDays)
    : mobileMainBase;

  // More groups can also be reordered by usage
  const mobileLifeItems = adaptive
    ? reorderItems(mobileMoreBase.life, visitMap, new Set())
    : mobileMoreBase.life;

  const mobileGrowthItems = adaptive
    ? reorderItems(mobileMoreBase.growth, visitMap, new Set())
    : mobileMoreBase.growth;

  return {
    navItems: withVisitInfo(sidebarItems, visitMap, adaptive),
    mainTabs: withVisitInfo(mobileMainItems, visitMap, adaptive),
    moreGroups: {
      life: withVisitInfo(mobileLifeItems, visitMap, adaptive),
      growth: withVisitInfo(mobileGrowthItems, visitMap, adaptive),
    },
  };
}

/**
 * For mobile main tabs: we want to pick the 4 most-used features that are
 * eligible for the main group, plus any from 'more' groups that are visited
 * often. Dashboard stays first.
 *
 * This enables the "dynamic bottom nav → top 4 most-used pages" vision.
 */
function reorderMobileMain(
  currentMain: FeatureModule[],
  visitMap: Map<string, number>,
  accountDays: number,
): FeatureModule[] {
  if (currentMain.length <= 1) return currentMain;

  // Get ALL mobile-visible features (main + more) for reordering
  const allMobile = getNavFeatures('mobile', accountDays);

  // Partition: pinned items (dashboard) vs rest
  const pinned: FeatureModule[] = [];
  const candidates: FeatureModule[] = [];

  for (const f of allMobile) {
    if (PINNED_FIRST_IDS.has(f.id)) {
      pinned.push(f);
    } else {
      candidates.push(f);
    }
  }

  // Sort candidates by visit count (most used first)
  candidates.sort((a, b) => {
    const aV = visitMap.get(a.id) ?? 0;
    const bV = visitMap.get(b.id) ?? 0;
    if (aV !== bV) return bV - aV;
    // Tiebreaker: default mobile order
    return a.mobileNavOrder - b.mobileNavOrder;
  });

  // Take pinned (1 item: dashboard) + top 3 candidates for the 4 main slots
  // But we need to respect the original set size — don't add more than the main group had
  const maxSlots = Math.max(4, currentMain.length);
  const reordered = [...pinned, ...candidates.slice(0, maxSlots - pinned.length)];

  return reordered;
}

/**
 * Build result from cached order arrays.
 */
function buildFromCache(
  cache: AdaptiveCache,
  accountDays: number,
  visitMap: Map<string, number>,
): AdaptiveNavResult {
  // Re-fetch base features (progressive disclosure may have changed)
  const sidebarBase = getNavFeatures('sidebar', accountDays);
  const mobileMainBase = getMobileMainTabs(accountDays);
  const mobileMoreBase = getMobileMoreGroups(accountDays);
  const allMobileBase = getNavFeatures('mobile', accountDays);

  // Merge: use cached order where features still exist, append new features at end
  const sidebarVisible = new Set(sidebarBase.map(f => f.id));
  const mobileMainVisible = new Set(mobileMainBase.map(f => f.id));
  // For adaptive mobile main, we might promote features from "more" groups
  // So we need all mobile-visible features
  const allMobileVisible = new Set(allMobileBase.map(f => f.id));

  function orderFromCache(cacheIds: string[], visibleSet: Set<string>): FeatureModule[] {
    const ordered: FeatureModule[] = [];
    const seen = new Set<string>();

    // Add cached items that are still visible
    for (const id of cacheIds) {
      if (visibleSet.has(id) && !seen.has(id)) {
        const f = FEATURES_BY_ID.get(id);
        if (f) {
          ordered.push(f);
          seen.add(id);
        }
      }
    }

    // Add any visible features not in cache (new features) at end
    for (const f of sidebarBase) {
      if (!seen.has(f.id)) {
        ordered.push(f);
        seen.add(f.id);
      }
    }

    return ordered;
  }

  const sidebarItems = orderFromCache(cache.sidebarOrder, sidebarVisible);

  // For mobile main, use all mobile visible (main + more might be promoted)
  const mobileMainItems = orderFromCache(cache.mobileMainOrder, allMobileVisible).slice(0, Math.max(4, mobileMainBase.length));

  // More groups
  const lifeItems = orderFromCache(cache.mobileLifeOrder, new Set(mobileMoreBase.life.map(f => f.id)));
  const growthItems = orderFromCache(cache.mobileGrowthOrder, new Set(mobileMoreBase.growth.map(f => f.id)));

  return {
    navItems: withVisitInfo(sidebarItems, visitMap, true),
    mainTabs: withVisitInfo(mobileMainItems, visitMap, true),
    moreGroups: {
      life: withVisitInfo(lifeItems, visitMap, true),
      growth: withVisitInfo(growthItems, visitMap, true),
    },
  };
}

/**
 * Enrich FeatureModule items with visit count and isMostUsed flag.
 */
function withVisitInfo(
  items: FeatureModule[],
  visitMap: Map<string, number>,
  adaptive: boolean,
): AdaptiveNavItem[] {
  // Determine which items are "most used" (moved up from default order)
  const defaultOrder = [...items].sort((a, b) => {
    // Use sidebarOrder as the "original position" proxy
    const aOrder = a.sidebarOrder;
    const bOrder = b.sidebarOrder;
    return aOrder - bOrder;
  });

  // An item is "most used" if it appears before its default position
  const defaultPositions = new Map<string, number>();
  defaultOrder.forEach((item, i) => defaultPositions.set(item.id, i));

  return items.map((item, currentIndex) => {
    const visitCount = visitMap.get(item.id) ?? 0;
    const defaultPos = defaultPositions.get(item.id) ?? currentIndex;
    const isMostUsed = adaptive && visitCount > 0 && currentIndex < defaultPos;

    return {
      ...item,
      visitCount,
      isMostUsed,
    };
  });
}