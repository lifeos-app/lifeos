// LifeOS Sacred Schedule Overlay — Spiritual events that merge with the physical timeline
// Opacity scales with junction_xp: invisible at 0, max 80% at full mastery
// RULE: Only timed prayer/meditation practices show as blocks on the schedule.
//       Fasting, study, service, "any" time practices do NOT get schedule blocks.
//       They belong in the Sacred mode drawer, not cluttering the timeline.
import { useMemo } from 'react';
import { useJunction, useJunctionPractices, useJunctionCalendar } from './useJunction';

export interface SacredBlock {
  id: string;
  name: string;
  icon: string;
  category: string; // 'prayer' | 'meditation' | 'observance'
  startMin: number; // minutes from midnight
  endMin: number;
  color: string;
}

// Map time_of_day strings to minute ranges — ONLY specific time slots
const TIME_MAP: Record<string, { start: number; end: number }> = {
  dawn: { start: 5 * 60, end: 5 * 60 + 30 },
  morning: { start: 6 * 60, end: 6 * 60 + 30 },
  midmorning: { start: 9 * 60, end: 9 * 60 + 20 },
  midday: { start: 12 * 60, end: 12 * 60 + 30 },
  noon: { start: 12 * 60, end: 12 * 60 + 30 },
  afternoon: { start: 15 * 60, end: 15 * 60 + 30 },
  evening: { start: 18 * 60, end: 18 * 60 + 30 },
  night: { start: 21 * 60, end: 21 * 60 + 30 },
  midnight: { start: 0, end: 0 + 15 },
  // Islamic canonical prayer times
  fajr: { start: 5 * 60, end: 5 * 60 + 20 },
  dhuhr: { start: 12 * 60 + 30, end: 12 * 60 + 50 },
  asr: { start: 15 * 60 + 30, end: 15 * 60 + 50 },
  maghrib: { start: 18 * 60 + 15, end: 18 * 60 + 35 },
  isha: { start: 20 * 60, end: 20 * 60 + 20 },
  // Tewahedo canonical hours
  'before-dawn': { start: 4 * 60 + 30, end: 5 * 60 },
  'third-hour': { start: 9 * 60, end: 9 * 60 + 15 },
  'sixth-hour': { start: 12 * 60, end: 12 * 60 + 15 },
  'ninth-hour': { start: 15 * 60, end: 15 * 60 + 15 },
  'twelfth-hour': { start: 18 * 60, end: 18 * 60 + 15 },
};

// Categories that should NOT render as schedule blocks
const EXCLUDED_CATEGORIES = new Set(['fasting', 'study', 'service']);
// time_of_day values that don't map to a specific time slot
const EXCLUDED_TIMES = new Set(['any', 'all_day', 'varies', '']);

const SACRED_GOLD = '#D4AF37';

export function useSacredSchedule() {
  const { userJunction, tradition, isEquipped } = useJunction();

  // Derive tier from XP for practice filtering
  const currentTier = useMemo(() => {
    const xp = userJunction?.junction_xp || 0;
    if (xp >= 5000) return 5;
    if (xp >= 3000) return 4;
    if (xp >= 1500) return 3;
    if (xp >= 500) return 2;
    if (xp > 0) return 1;
    return 0;
  }, [userJunction?.junction_xp]);

  const { practices } = useJunctionPractices(
    userJunction?.tradition_id,
    currentTier
  );
  const { entries: calendarEntries } = useJunctionCalendar(userJunction?.tradition_id);

  // Spiritual level: 0-1 normalized (logarithmic curve)
  const maxFigureXP = 12000;

  const spiritualLevel = useMemo(() => {
    const xp = userJunction?.junction_xp || 0;
    if (xp === 0) return 0;
    const normalised = Math.log(1 + xp / 500) / Math.log(1 + maxFigureXP / 500);
    return Math.min(normalised, 1);
  }, [userJunction?.junction_xp]);

  // Overlay opacity: scales linearly with spiritual level
  // At 60 XP (spiritualLevel ~3.5%) → opacity ~2.6% → effectively invisible
  // At 500 XP → ~11%  |  At 1500 XP → ~26%  |  At 3000 XP → ~38%
  // At max → 80% (the sacred and daily truly merged)
  const overlayOpacity = useMemo(() => {
    if (!isEquipped || spiritualLevel === 0) return 0;
    // No minimum floor — if you're barely started, overlay is barely there
    return spiritualLevel * 0.8;
  }, [isEquipped, spiritualLevel]);

  // Generate sacred time blocks ONLY from timed prayer/meditation practices
  const sacredBlocks = useMemo((): SacredBlock[] => {
    if (!isEquipped || overlayOpacity === 0) return [];

    const blocks: SacredBlock[] = [];

    for (const p of practices) {
      // Skip categories that don't belong on the timeline
      if (EXCLUDED_CATEGORIES.has(p.category)) continue;

      // Skip practices without a specific time slot
      const timeKey = (p.time_of_day || '').toLowerCase().trim();
      if (!timeKey || EXCLUDED_TIMES.has(timeKey)) continue;

      const range = TIME_MAP[timeKey];
      if (!range) continue;

      const dur = p.duration_default || 15;

      blocks.push({
        id: `sacred-${p.id}`,
        name: p.name,
        icon: p.icon,
        category: p.category,
        startMin: range.start,
        endMin: range.start + dur, // Use actual duration, not max(dur, range)
        color: SACRED_GOLD,
      });
    }

    // Calendar entries for today — small 1-hour marker, not all-day
    for (const entry of calendarEntries) {
      blocks.push({
        id: `sacred-cal-${entry.id}`,
        name: entry.name,
        icon: entry.icon || '🕯️',
        category: 'observance',
        startMin: 6 * 60,
        endMin: 7 * 60,
        color: entry.color || SACRED_GOLD,
      });
    }

    return blocks;
  }, [isEquipped, overlayOpacity, practices, calendarEntries]);

  // Layout: sacred blocks are a thin strip on the right edge that grows with level
  const sacredLayout = useMemo(() => {
    if (spiritualLevel <= 0.5) {
      // Thin strip on right edge: 4% wide
      return { leftPct: 95, widthPct: 4 };
    } else if (spiritualLevel <= 0.8) {
      const t = (spiritualLevel - 0.5) / 0.3;
      const left = 95 - t * 12; // 95 → 83
      const width = 4 + t * 11; // 4 → 15
      return { leftPct: left, widthPct: width };
    } else {
      // Near max: truly merged
      const t = (spiritualLevel - 0.8) / 0.2;
      const left = 83 - t * 73; // 83 → 10
      const width = 15 + t * 71; // 15 → 86
      return { leftPct: left, widthPct: width };
    }
  }, [spiritualLevel]);

  // Glow intensity for CSS (0-20px spread)
  const glowIntensity = useMemo(() => {
    return Math.round(spiritualLevel * 20);
  }, [spiritualLevel]);

  return {
    sacredBlocks,
    overlayOpacity,
    isEquipped,
    spiritualLevel,
    tradition,
    sacredLayout,
    glowIntensity,
  };
}
