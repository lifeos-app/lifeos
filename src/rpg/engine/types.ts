// RPG Engine Type Definitions

export type CharacterClass = 'warrior' | 'mage' | 'ranger' | 'healer' | 'engineer';

export interface CharacterStats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  strength: number;
  intelligence: number;
  charisma: number;
  endurance: number;
}

export interface CharacterAppearance {
  skinTone: number;      // 0-5
  hairStyle: number;     // 0-7
  hairColor: number;     // 0-7
  outfit: number;        // 0-3 (used as topIdx)
  accessory: number;     // 0-3
  // New optional fields (missing = 0 or -1)
  faceType?: number;     // 0-5
  eyeColorIdx?: number;  // 0-5
  bottomStyle?: number;  // 0-2
  shoeStyle?: number;    // 0-2
  capeStyle?: number;    // -1 = none
  hatStyle?: number;     // -1 = none
  weaponStyle?: number;  // -1 = none
}

export interface RPGCharacter {
  id: string;
  userId: string;
  name: string;
  characterClass: CharacterClass;
  level: number;
  totalXp: number;
  stats: CharacterStats;
  appearance: CharacterAppearance;
  gold: number;
  position: { map: string; x: number; y: number };
  guildId: string | null;
  equipment: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RPGQuest {
  id: string;
  characterId: string;
  questId: string;
  sourceType: 'task' | 'habit' | 'goal' | 'system';
  sourceId: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  progress: number;
  startedAt: string;
  completedAt: string | null;
}

export interface MapZone {
  id: string;
  name: string;
  description: string;
  theme: string;
  width: number;
  height: number;
  spawnX: number;
  spawnY: number;
  portals: Portal[];
  npcs: NPC[];
}

export interface Portal {
  x: number;
  y: number;
  width: number;
  height: number;
  targetMap: string;
  targetX: number;
  targetY: number;
  label: string;
}

export interface NPC {
  id: string;
  name: string;
  x: number;
  y: number;
  sprite: string;
  dialog: string[];
  questId?: string;
}

export type GameState = 'loading' | 'character_creation' | 'playing' | 'paused' | 'menu';

export interface GameEvent {
  type: 'xp_gained' | 'level_up' | 'quest_complete' | 'quest_start' | 'gold_earned' | 'achievement' | 'health_update';
  data: Record<string, unknown>;
  timestamp: number;
}
