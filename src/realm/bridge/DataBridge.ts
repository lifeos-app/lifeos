/**
 * Data Bridge — The Realm
 *
 * Connects Zustand stores → Realm WorldState.
 * Transforms habits into garden plants, goals into quests,
 * health into character appearance, finances into market state, etc.
 */

import { useHabitsStore } from '../../stores/useHabitsStore';
import { useHealthStore } from '../../stores/useHealthStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useJournalStore } from '../../stores/useJournalStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useInventoryStore } from '../../stores/useInventoryStore';
import { useUserStore } from '../../stores/useUserStore';
import type { PlayerRenderState } from '../renderer/RealmRenderer';
import { SKIN_TONES, HAIR_COLORS } from '../../rpg/data/sprites';
import { getClassInfo } from '../../rpg/data/classes';
import type { CharacterClass } from '../../rpg/engine/types';
import { LightingSystem } from '../renderer/LightingSystem';
import type { NPCDialogueContext } from '../data/dialogue';
import { TILE_SIZE } from '../data/tiles';
import type { FloraSpecies } from '../data/flora';
import { assignSpecies, getGrowthStage, getFloraSpecies, STAGE_NAMES } from '../data/flora';
import { getMoonPhase, getXPMultiplier, getSeason, type Season } from '../data/celestial';
import { getBondLevel, getCompanionState, getFaunaSpecies, SPECIES_PALETTES } from '../data/companions';
import { getCompanionCache, getFaunaCache } from '../hooks/useFauna';

// ── Derived World State ──────────────────────

export interface DynamicEntity {
  id: string;
  type: 'shadow' | 'goal_companion' | 'journal_echo';
  worldX: number;
  worldY: number;
  label: string;
  subLabel?: string;
  color: string;
  alpha: number;
  progress?: number; // 0-1 for goal companions
}

export interface EquippedVisuals {
  headColor?: string;
  bodyColor?: string;
  weaponColor?: string;
  shieldColor?: string;
  hasHead: boolean;
  hasWeapon: boolean;
  hasShield: boolean;
}

export interface CompanionRenderData {
  speciesKey: string;
  bodyType: 'canine' | 'feline' | 'bird' | 'large';
  name: string | null;
  bondLevel: number;
  state: 'active' | 'resting' | 'sleeping' | 'joyful';
  bodyColor: string;
  accentColor: string;
  eyeColor: string;
}

export interface RealmWorldState {
  /** Player render info */
  player: PlayerRenderState;
  /** House upgrade level (1-5) */
  houseLevel: number;
  /** Which zones are unlocked */
  zoneUnlocks: Record<string, boolean>;
  /** Current weather based on mood */
  weather: 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow';
  /** Character mood score (1-5) */
  moodScore: number;
  /** Number of active quest-like goals */
  activeQuestCount: number;
  /** Garden plants from habits */
  gardenPlants: GardenPlant[];
  /** Dynamic entities: shadows, companions, echoes */
  shadows: DynamicEntity[];
  goalCompanions: DynamicEntity[];
  journalEchoes: DynamicEntity[];
  /** Stats for rendering */
  bestStreak: number;
  energyScore: number;
  journalCount: number;
  /** Equipment visuals */
  equippedVisuals: EquippedVisuals;
  /** Companion animal render data */
  companion: CompanionRenderData | null;
  /** Moon XP multiplier (1.0 or 1.1) */
  moonXPMultiplier: number;
  /** Current season */
  season: Season;
  /** XP-driven world vibrancy (0.6–1.0). 0.6 = no activity, 1.0 = 100+ XP today */
  xpVibrancy: number;
  /** Streak-driven particle multiplier (1–3). Higher streaks = more particles */
  streakMultiplier: number;
}

export interface GardenPlant {
  id: string;
  name: string;
  category: string;
  streakDays: number;
  isActive: boolean;
  isLoggedToday: boolean;
  /** Growth stage: 0 = seed, 1 = sprout, 2 = growing, 3 = mature, 4 = legendary */
  stage: number;
  /** Species display name, e.g. "Sacred Lotus (Nelumbo nucifera)" */
  speciesName?: string;
  /** 0.0–1.0 progress within the current stage */
  growthProgress?: number;
  /** Species key, e.g. 'bodhi_fig' */
  speciesKey: string;
  /** Scientific name, e.g. 'Ficus religiosa' */
  scientificName: string;
  /** Growth rate in cm/yr from flora table */
  growthRate: number;
  /** Botanical fact */
  description: string;
  /** Dormancy level: 0=healthy, 1=fading, 2=dormant, 3=deep dormant */
  dormancyLevel: number;
}

/**
 * Derive the full realm world state from Zustand stores.
 * Called once per entry and periodically during gameplay.
 *
 * @param rpgCharacter — RPG character data (may be null for new users)
 * @param flora — cached flora species map (optional)
 * @param xpToday — XP earned today (0 if unknown); used to drive world vibrancy
 */
export function deriveWorldState(
  rpgCharacter: {
    name: string;
    class: CharacterClass;
    level: number;
    totalXp: number;
    appearance: { skinTone: number; hairStyle: number; hairColor: number; outfit: number };
    position: { map: string; x: number; y: number };
  } | null,
  flora?: Map<string, FloraSpecies>,
  xpToday: number = 0,
): RealmWorldState {
  const habits = useHabitsStore.getState().habits;
  const habitLogs = useHabitsStore.getState().logs;
  const health = useHealthStore.getState().todayMetrics;
  const goals = useGoalsStore.getState().goals;
  const entries = useJournalStore.getState().entries;
  const finance = useFinanceStore.getState();
  const schedule = useScheduleStore.getState();
  const inventory = useInventoryStore.getState();

  // ── Player ──
  const classInfo = rpgCharacter ? getClassInfo(rpgCharacter.class) : null;
  const skinTone = SKIN_TONES[rpgCharacter?.appearance.skinTone ?? 4] || SKIN_TONES[4];
  const hairColor = HAIR_COLORS[rpgCharacter?.appearance.hairColor ?? 0] || HAIR_COLORS[0];

  const player: PlayerRenderState = {
    worldX: 0, // Set by engine from position
    worldY: 0,
    direction: 'down',
    isMoving: false,
    skinTone,
    hairColor,
    bodyColor: classInfo?.color || '#4A90D9',
    classIcon: classInfo?.icon || '⚔️',
    name: rpgCharacter?.name || 'Adventurer',
    level: rpgCharacter?.level || 1,
  };

  // ── House Level ──
  const level = rpgCharacter?.level || 1;
  let houseLevel = 1;
  if (level >= 50) houseLevel = 5;
  else if (level >= 30) houseLevel = 4;
  else if (level >= 15) houseLevel = 3;
  else if (level >= 8) houseLevel = 2;

  // ── Zone Unlocks ──
  const hasGoals = goals.length > 0;
  const hasJournal = entries.length > 0;
  const hasHealth = health !== null;
  const hasFinance = finance.income.length > 0 || finance.expenses.length > 0;

  // Compute zone unlocks, then merge with persisted unlocks (persistence wins)
  const computedUnlocks: Record<string, boolean> = {
    genesis_garden: true,
    life_town: true,
    ironworks: hasGoals,
    wisdom_summit: hasJournal,
    healers_sanctuary: hasHealth,
    market_quarter: hasFinance,
    social_square: false, // Needs guild — check later
  };

  // Merge: persisted unlocks take priority over computed
  const persistedUnlocks = (rpgCharacter as Record<string, unknown> | undefined)?._persistedZoneUnlocks as Record<string, boolean> | undefined;
  const zoneUnlocks: Record<string, boolean> = {
    ...computedUnlocks,
    ...(persistedUnlocks || {}),
  };

  // ── Weather (from mood) ──
  const moodScore = health?.mood_score ?? 3;
  let weather: RealmWorldState['weather'] = 'sunny';
  if (moodScore <= 1) weather = 'storm';
  else if (moodScore <= 2) weather = 'rain';
  else if (moodScore <= 3) weather = 'cloudy';
  else if (moodScore >= 5) weather = 'sunny';

  // ── Quests ──
  const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'in_progress');

  // ── Garden Plants ──
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = habitLogs.filter(l => l.date === today);

  const gardenPlants: GardenPlant[] = habits
    .filter(h => !h.is_deleted)
    .map(h => {
      const streak = h.streak_current || 0;
      const isLoggedToday = todayLogs.some(l => l.habit_id === h.id);
      const cat = h.category || 'other';
      const habitName = h.title || 'Habit';

      // Species assignment (deterministic from habit name)
      const speciesKey = assignSpecies(habitName, cat);
      const speciesData = getFloraSpecies(speciesKey, flora);
      const growthRateCmYr = speciesData?.growth_rate_cm_yr ?? 50;

      // Velocity-adjusted growth stage
      const { stage, progress: growthProgress } = getGrowthStage(streak, growthRateCmYr);

      // Dormancy level from days since last log
      let dormancyLevel = 0;
      if (h.is_active && !isLoggedToday) {
        const habitLogsForThis = habitLogs
          .filter(l => l.habit_id === h.id)
          .map(l => l.date)
          .sort()
          .reverse();
        const lastLogDate = habitLogsForThis[0];
        if (lastLogDate) {
          const daysSince = Math.floor(
            (new Date(today).getTime() - new Date(lastLogDate).getTime()) / 86400000,
          );
          if (daysSince <= 1) dormancyLevel = 0;
          else if (daysSince <= 3) dormancyLevel = 1;
          else if (daysSince <= 7) dormancyLevel = 2;
          else dormancyLevel = 3;
        }
      }

      const commonName = speciesData?.common_name ?? habitName;
      const scientificName = speciesData?.scientific_name ?? '';
      const speciesName = scientificName
        ? `${commonName} (${scientificName})`
        : commonName;

      return {
        id: h.id,
        name: habitName,
        category: cat,
        streakDays: streak,
        isActive: h.is_active ?? true,
        isLoggedToday,
        stage,
        speciesName,
        growthProgress,
        speciesKey,
        scientificName,
        growthRate: growthRateCmYr,
        description: speciesData?.description ?? '',
        dormancyLevel,
      };
    });

  // ── Dynamic Entities ──
  const SCALE = 3;
  const ts = TILE_SIZE * SCALE;

  // Shadows: from overdue tasks and broken streaks
  const shadows: DynamicEntity[] = [];
  const overdueTasks = schedule.getOverdueTasks();
  if (overdueTasks.length >= 3) {
    // Procrastination Wraith near bulletin board (tile 11,10)
    shadows.push({
      id: 'shadow_procrastination',
      type: 'shadow',
      worldX: 10 * ts + ts / 2,
      worldY: 10 * ts + ts / 2,
      label: 'Procrastination Wraith',
      subLabel: `${overdueTasks.length} overdue tasks`,
      color: '#3C1450',
      alpha: 0.7,
    });
  }

  const brokenStreakHabits = habits.filter(h => h.is_active && (h.streak_current || 0) === 0 && !h.is_deleted);
  if (brokenStreakHabits.length > 0) {
    // Broken Streak Ghost near garden area (tile 19,7)
    shadows.push({
      id: 'shadow_broken_streak',
      type: 'shadow',
      worldX: 19 * ts + ts / 2,
      worldY: 7 * ts + ts / 2,
      label: 'Broken Streak Ghost',
      subLabel: `${brokenStreakHabits.length} habit${brokenStreakHabits.length > 1 ? 's' : ''} at zero`,
      color: '#2A1040',
      alpha: 0.5,
    });
  }

  // Goal Companions: each active goal → entity near forge area
  const goalCompanions: DynamicEntity[] = activeGoals.slice(0, 5).map((g, i) => {
    // Calculate progress from child goals/tasks
    const children = goals.filter(c => c.parent_goal_id === g.id);
    const progress = children.length > 0
      ? children.filter(c => c.status === 'done' || c.status === 'completed').length / children.length
      : 0;
    return {
      id: `companion_${g.id}`,
      type: 'goal_companion' as const,
      worldX: (3 + i * 2) * ts + ts / 2, // Spread near forge area (left side)
      worldY: 17 * ts + ts / 2,
      label: g.title?.slice(0, 20) || 'Goal',
      color: (g as { color?: string }).color || '#4A90D9',
      alpha: 1,
      progress,
    };
  });

  // Journal Echoes: 1 per 10 journal entries, near library area
  const journalCount = entries.length;
  const echoCount = Math.min(Math.floor(journalCount / 10), 5);
  const journalEchoes: DynamicEntity[] = [];
  for (let i = 0; i < echoCount; i++) {
    journalEchoes.push({
      id: `echo_${i}`,
      type: 'journal_echo',
      worldX: (22 + i) * ts + ts / 2, // Near library area (right side)
      worldY: 15 * ts + ts / 2,
      label: `Echo ${i + 1}`,
      color: '#B4C8FF',
      alpha: 0.6,
    });
  }

  // ── Best Streak ──
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak_current || 0), 0);

  // ── XP Vibrancy ──
  // If xpToday was not provided, estimate from today's habit logs:
  // each logged habit ≈ 5 XP base + streak multiplier, so rough estimate
  const estimatedXpToday = xpToday > 0
    ? xpToday
    : todayLogs.length * 10; // conservative: ~10 XP per logged habit on average
  const xpVibrancy = Math.min(1.0, 0.6 + (estimatedXpToday / 100) * 0.4);

  // ── Streak Multiplier ── (1–3 scale for particle effects)
  const streakMultiplier = Math.min(3, 1 + (bestStreak / 14) * 2);

  // ── Energy Score ──
  const energyScore = health?.energy_level ?? 3;

  // ── Equipment Visuals ──
  const equipped = inventory.getEquipped();
  const headItem = equipped.find(i => i.slot === 'head');
  const torsoItem = equipped.find(i => i.slot === 'torso');
  const handsItem = equipped.find(i => i.slot === 'hands');
  const equippedVisuals: EquippedVisuals = {
    hasHead: !!headItem,
    headColor: headItem?.color || '#888',
    bodyColor: torsoItem?.color || undefined,
    hasWeapon: equipped.some(i => i.slot === 'accessories' && i.category === 'equipment'),
    weaponColor: '#C0C0C0',
    hasShield: !!handsItem,
    shieldColor: handsItem?.color || '#8B4513',
  };

  // ── Companion Animal ──
  let companion: CompanionRenderData | null = null;
  const companionData = getCompanionCache();
  if (companionData) {
    const faunaMap = getFaunaCache();
    const speciesData = getFaunaSpecies(companionData.species_key, faunaMap);
    const palette = SPECIES_PALETTES[companionData.species_key] ?? { body: '#808080', accent: '#FFFFFF', eye: '#1C1C1C' };
    const bondLevel = getBondLevel(companionData.bond_xp);
    const rawState = getCompanionState(companionData.last_active_at, new Date());
    // Joyful: active + bond 7+ + logged today
    const hasLoggedToday = gardenPlants.some(p => p.isLoggedToday);
    const companionState = rawState === 'active' && bondLevel >= 7 && hasLoggedToday
      ? 'joyful' as const
      : rawState;

    companion = {
      speciesKey: companionData.species_key,
      bodyType: speciesData?.body_type ?? 'canine',
      name: companionData.companion_name,
      bondLevel,
      state: companionState,
      bodyColor: palette.body,
      accentColor: palette.accent,
      eyeColor: palette.eye,
    };
  }

  // ── Celestial ──
  const now = new Date();
  const moonXPMultiplier = getXPMultiplier(now);
  const season = getSeason(now);

  return {
    player,
    houseLevel,
    zoneUnlocks,
    weather,
    moodScore,
    activeQuestCount: activeGoals.length,
    gardenPlants,
    shadows,
    goalCompanions,
    journalEchoes,
    bestStreak,
    energyScore,
    journalCount,
    equippedVisuals,
    companion,
    moonXPMultiplier,
    season,
    xpVibrancy,
    streakMultiplier,
  };
}

/**
 * Get weather as mood score for music/atmosphere
 */
export function getMoodFromStores(): number {
  const health = useHealthStore.getState().todayMetrics;
  return health?.mood_score ?? 3;
}

/**
 * Derive dialogue context from all stores for NPC conversations.
 */
export function deriveDialogueContext(
  rpgCharacter: { level: number; class: CharacterClass } | null,
): NPCDialogueContext {
  const habits = useHabitsStore.getState().habits;
  const health = useHealthStore.getState().todayMetrics;
  const goals = useGoalsStore.getState().goals;
  const entries = useJournalStore.getState().entries;
  const finance = useFinanceStore.getState();
  const schedule = useScheduleStore.getState();

  const activeGoals = goals
    .filter(g => g.status === 'active' || g.status === 'in_progress')
    .map(g => ({
      title: g.title || 'Goal',
      progress: 0, // Goals don't expose direct progress
    }));

  const completedGoals = goals.filter(g => g.status === 'completed').length;
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak_current || 0), 0);

  const habitList = habits
    .filter(h => !h.is_deleted)
    .map(h => ({
      name: h.title || 'Habit',
      streak: h.streak_current || 0,
      category: h.category || 'other',
    }));

  return {
    moodScore: health?.mood_score ?? 3,
    energyScore: health?.energy_level ?? 3,
    sleepHours: (health as { sleep_hours?: number } | undefined)?.sleep_hours ?? null,
    exerciseMinutes: (health as { exercise_minutes?: number } | undefined)?.exercise_minutes ?? null,
    activeGoals,
    completedGoals,
    habits: habitList,
    bestStreak,
    journalCount: entries.length,
    overdueTasks: schedule.getOverdueTasks().length,
    netBalance: finance.netCashflow?.() ?? 0,
    playerLevel: rpgCharacter?.level ?? 1,
    playerClass: rpgCharacter?.class ?? 'warrior',
  };
}
