// LifeOS Gamification — Level Progression System
// 99 levels (Final Fantasy inspired), exponential XP curve

export interface LevelInfo {
  level: number;
  title: string;
  xpRequired: number;    // Total XP to reach this level
  xpToNext: number;      // XP needed for next level
  unlocks?: string[];     // What unlocks at this level
}

/** XP needed to reach a given level: level² × 100 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return level * level * 100;
}

/** XP needed to go FROM level to level+1 */
export function xpBetweenLevels(level: number): number {
  return xpForLevel(level + 1) - xpForLevel(level);
}

/** Given total XP, compute the current level (1–99) */
export function getLevelFromXP(totalXP: number): number {
  for (let lvl = 99; lvl >= 1; lvl--) {
    if (totalXP >= xpForLevel(lvl)) return lvl;
  }
  return 1;
}

/** Progress within current level as 0–1 */
export function getLevelProgress(totalXP: number): number {
  const lvl = getLevelFromXP(totalXP);
  if (lvl >= 99) return 1;
  const base = xpForLevel(lvl);
  const next = xpForLevel(lvl + 1);
  return (totalXP - base) / (next - base);
}

// ── ALL 99 LEVEL TITLES ──
const LEVEL_TITLES: Record<number, string> = {
  1:  'Awakened',
  2:  'Initiate',
  3:  'Seeker',
  4:  'Acolyte',
  5:  'Apprentice',
  6:  'Novice',
  7:  'Student',
  8:  'Learner',
  9:  'Aspirant',
  10: 'Journeyman',
  11: 'Pathfinder',
  12: 'Wanderer',
  13: 'Explorer',
  14: 'Scout',
  15: 'Tracker',
  16: 'Ranger',
  17: 'Strider',
  18: 'Wayfarer',
  19: 'Trailblazer',
  20: 'Adept',
  21: 'Practitioner',
  22: 'Artisan',
  23: 'Specialist',
  24: 'Tactician',
  25: 'Master',
  26: 'Strategist',
  27: 'Commander',
  28: 'Sentinel',
  29: 'Guardian',
  30: 'Warden',
  31: 'Vanguard',
  32: 'Champion',
  33: 'Gladiator',
  34: 'Conqueror',
  35: 'Vanquisher',
  36: 'Warrior',
  37: 'Berserker',
  38: 'Paladin',
  39: 'Crusader',
  40: 'Knight',
  41: 'Templar',
  42: 'Arbiter',
  43: 'Oracle',
  44: 'Seer',
  45: 'Prophet',
  46: 'Mystic',
  47: 'Enchanter',
  48: 'Sorcerer',
  49: 'Archmage',
  50: 'Sage',
  51: 'Philosopher',
  52: 'Luminary',
  53: 'Visionary',
  54: 'Architect',
  55: 'Sovereign',
  56: 'Monarch',
  57: 'Emperor',
  58: 'Regent',
  59: 'Overlord',
  60: 'Titan',
  61: 'Colossus',
  62: 'Leviathan',
  63: 'Behemoth',
  64: 'Juggernaut',
  65: 'Apex',
  66: 'Paragon',
  67: 'Exemplar',
  68: 'Virtuoso',
  69: 'Maestro',
  70: 'Grandmaster',
  71: 'Elder',
  72: 'Primarch',
  73: 'Ascendant',
  74: 'Exalted',
  75: 'Legend',
  76: 'Mythic',
  77: 'Eternal',
  78: 'Infinite',
  79: 'Cosmic',
  80: 'Celestial',
  81: 'Astral',
  82: 'Divine',
  83: 'Seraphim',
  84: 'Archangel',
  85: 'Demigod',
  86: 'Godslayer',
  87: 'Worldshaper',
  88: 'Starforger',
  89: 'Timebender',
  90: 'Voidwalker',
  91: 'Dimension Weaver',
  92: 'Reality Sculptor',
  93: 'Fate Writer',
  94: 'Omniarch',
  95: 'Zenith',
  96: 'Absolute',
  97: 'Primordial',
  98: 'Omega',
  99: 'Transcendent',
};

// ── LEVEL-UP UNLOCKS ──
const LEVEL_UNLOCKS: Record<number, string[]> = {
  2:  ['Daily quests unlocked'],
  5:  ['🎨 Theme customization unlocked', 'Weekly quests unlocked'],
  10: ['🏅 Badge display unlocked', 'Stats radar chart unlocked'],
  15: ['📊 Advanced analytics unlocked'],
  20: ['🎯 Epic quests unlocked'],
  25: ['🖼️ Custom icon uploads unlocked', 'Player card showcase unlocked'],
  30: ['🏆 Leaderboard unlocked'],
  40: ['⚡ Power-up abilities unlocked'],
  50: ['👑 Sage border effect unlocked', 'All quest slots doubled'],
  60: ['🌟 Legendary particle aura unlocked'],
  75: ['💎 Legend badge unlocked', 'Exclusive title colors'],
  90: ['🔮 Cosmic glow effect unlocked'],
  99: ['✨ Transcendent aura — all effects unlocked', '🏆 Ultimate achievement'],
};

export function getTitleForLevel(level: number): string {
  return LEVEL_TITLES[level] || 'Unknown';
}

export function getUnlocksForLevel(level: number): string[] {
  return LEVEL_UNLOCKS[level] || [];
}

export function getLevelInfo(totalXP: number): LevelInfo {
  const level = getLevelFromXP(totalXP);
  return {
    level,
    title: getTitleForLevel(level),
    xpRequired: xpForLevel(level),
    xpToNext: level >= 99 ? 0 : xpForLevel(level + 1) - totalXP,
    unlocks: getUnlocksForLevel(level),
  };
}

/** Get all levels for display */
export function getAllLevels(): LevelInfo[] {
  return Array.from({ length: 99 }, (_, i) => {
    const level = i + 1;
    return {
      level,
      title: getTitleForLevel(level),
      xpRequired: xpForLevel(level),
      xpToNext: xpBetweenLevels(level),
      unlocks: getUnlocksForLevel(level),
    };
  });
}
