import type { RPGCharacter, CharacterStats, CharacterClass, CharacterAppearance } from './types';
import { supabase } from '../../lib/supabase';
import { getLevelFromXP } from '../../lib/gamification/levels';
import { logger } from '../../utils/logger';
import { useCharacterAppearanceStore } from '../../stores/useCharacterAppearanceStore';
import { EYE_COLORS } from '../data/sprites';
import { getClassInfo } from '../data/classes';

/**
 * Derive character stats from real LifeOS data.
 * This is the bridge between productivity data and RPG stats.
 */
export async function deriveStats(userId: string, characterClass?: CharacterClass): Promise<CharacterStats> {
  // Safe defaults — returned if ANY query fails
  const SAFE_DEFAULTS: CharacterStats = {
    hp: 65, maxHp: 100, mp: 0, maxMp: 100,
    strength: 12, intelligence: 10, charisma: 24, endurance: 0,
  };

  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch real data in parallel — each query independently caught
    const [healthRes, habitsRes, financeRes] = await Promise.all([
      supabase.from('health_metrics')
        .select('energy_score, mood_score, sleep_hours, water_glasses, exercise_minutes')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle()
        .then(r => r.data)
        .catch(() => null),
      supabase.from('habits')
        .select('streak_current')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .then(r => r.data || [])
        .catch(() => []),
      supabase.from('income')
        .select('amount')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
        .then(r => r.data || [])
        .catch(() => []),
    ]);

    const health = healthRes;
    const habits = habitsRes as { streak_current: number }[];
    const income = financeRes as { amount: number }[];

    // Derive stats
    const energy = health?.energy_score || 3;
    const mood = health?.mood_score || 3;
    const sleep = health?.sleep_hours || 7;
    const exercise = health?.exercise_minutes || 0;
    const avgStreak = habits.length > 0
      ? habits.reduce((s, h) => s + (h.streak_current || 0), 0) / habits.length
      : 0;

    const stats: CharacterStats = {
      hp: Math.min(100, Math.round((energy / 5) * 40 + (sleep / 9) * 30 + (mood / 5) * 30)),
      maxHp: 100,
      mp: Math.min(100, Math.round(exercise * 0.5 + avgStreak * 2)),
      maxMp: 100,
      strength: Math.min(99, Math.round(exercise * 0.3 + energy * 4)),
      intelligence: Math.min(99, 10 + Math.round(avgStreak * 3)),
      charisma: Math.min(99, Math.round(mood * 8 + (sleep >= 7 ? 20 : 0))),
      endurance: Math.min(99, Math.round(avgStreak * 5 + (exercise > 0 ? 15 : 0))),
    };

    // Apply class stat bonuses
    if (characterClass) {
      const classInfo = getClassInfo(characterClass);
      if (classInfo?.statBonuses) {
        stats.strength = Math.min(99, stats.strength + classInfo.statBonuses.strength);
        stats.intelligence = Math.min(99, stats.intelligence + classInfo.statBonuses.intelligence);
        stats.charisma = Math.min(99, stats.charisma + classInfo.statBonuses.charisma);
        stats.endurance = Math.min(99, stats.endurance + classInfo.statBonuses.endurance);
      }
    }

    return stats;
  } catch (err) {
    logger.warn('[deriveStats] Failed, using safe defaults:', err);
    return SAFE_DEFAULTS;
  }
}

/**
 * Load or create character for a user
 */
export async function loadCharacter(userId: string): Promise<RPGCharacter | null> {
  const { data, error } = await supabase
    .from('rpg_characters')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to load RPG character:', error);
    return null;
  }

  if (!data) return null;

  // Derive fresh stats from real data (with class bonuses)
  const charClass = data.class as CharacterClass;
  const stats = await deriveStats(userId, charClass);

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    characterClass: charClass,
    level: data.stats?.level || 1,
    totalXp: data.stats?.total_xp || 0,
    stats,
    appearance: data.sprite_data as CharacterAppearance || {
      skinTone: 0, hairStyle: 0, hairColor: 0, outfit: 0, accessory: 0,
    },
    gold: data.stats?.gold || 0,
    position: data.position as { map: string; x: number; y: number } || { map: 'life_town', x: 600, y: 400 },
    guildId: null,
    equipment: data.equipment || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Create a new character
 */
export async function createCharacter(
  userId: string,
  name: string,
  characterClass: CharacterClass,
  appearance: CharacterAppearance,
): Promise<RPGCharacter | null> {
  const stats = await deriveStats(userId, characterClass);

  // Get user's current XP from LifeOS gamification
  const { data: xpData } = await supabase
    .from('user_xp')
    .select('total_xp, level')
    .eq('user_id', userId)
    .maybeSingle();

  const totalXp = xpData?.total_xp || 0;
  const level = xpData?.level || getLevelFromXP(totalXp);

  // Merge extended appearance from the creation store (if populated)
  const store = useCharacterAppearanceStore.getState();
  const enrichedAppearance: CharacterAppearance = {
    ...appearance,
    hairStyle: store.hairStyleIdx ?? appearance.hairStyle,
    faceType: store.faceTypeIdx ?? 0,
    eyeColorIdx: EYE_COLORS.indexOf(store.eyeColor) >= 0 ? EYE_COLORS.indexOf(store.eyeColor) : 0,
    bottomStyle: store.bottomIdx ?? 0,
    shoeStyle: store.shoesIdx ?? 0,
    capeStyle: store.capeIdx ?? -1,
    hatStyle: store.hatIdx ?? -1,
    weaponStyle: store.weaponIdx ?? -1,
  };

  const payload = {
    user_id: userId,
    name,
    class: characterClass,
    sprite_data: enrichedAppearance,
    stats: { ...stats, level, total_xp: totalXp, gold: 0 },
    position: { map: 'life_town', x: 400, y: 400 },
    equipment: [],
  };

  // Try upsert first, fall back to insert, fall back to select existing
  let data: Record<string, unknown> | null = null;
  let error: unknown = null;

  const upsertRes = await supabase.from('rpg_characters')
    .upsert(payload, { onConflict: 'user_id' }).select().single();
  if (!upsertRes.error) {
    data = upsertRes.data;
  } else {
    logger.warn('[createCharacter] Upsert failed, trying insert:', upsertRes.error);
    const insertRes = await supabase.from('rpg_characters')
      .insert(payload).select().single();
    if (!insertRes.error) {
      data = insertRes.data;
    } else {
      logger.warn('[createCharacter] Insert failed, trying select existing:', insertRes.error);
      // Character might already exist — just load it
      const selectRes = await supabase.from('rpg_characters')
        .select('*').eq('user_id', userId).maybeSingle();
      if (selectRes.data) {
        data = selectRes.data;
      } else {
        error = selectRes.error || upsertRes.error;
      }
    }
  }

  if (!data) {
    logger.error('Failed to create RPG character:', error);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    name,
    characterClass,
    level,
    totalXp,
    stats,
    appearance,
    gold: 0,
    position: { map: 'life_town', x: 400, y: 400 },
    guildId: null,
    equipment: [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Save character position and stats
 */
export async function saveCharacter(character: RPGCharacter): Promise<void> {
  await supabase
    .from('rpg_characters')
    .update({
      position: character.position,
      stats: {
        ...character.stats,
        level: character.level,
        total_xp: character.totalXp,
        gold: character.gold,
      },
      sprite_data: character.appearance,
      equipment: character.equipment,
      updated_at: new Date().toISOString(),
    })
    .eq('id', character.id);
}
