/**
 * npc-friendship.ts — NPC Friendship System for LifeOS
 *
 * NPCs have friendship levels 1-10 that grow through daily interaction.
 * Each daily interaction gives +1 XP toward the next friendship level.
 * Friendship unlocks: new dialogue, gifts, special quests at levels 3, 6, 10.
 *
 * Friendship data is persisted in user_profiles.preferences.npc_bonds.
 */

// ─── Types ──────────────────────────────────────────

export interface NPCBond {
  npcId: string;
  level: number;           // 1-10 (friendship level)
  xp: number;             // XP toward next level
  lastInteraction: string | null; // ISO date of last interaction
  unlockedDialogue: string[];  // Dialogue IDs unlocked
  totalInteractions: number;
}

export interface NPCFriendshipTier {
  level: number;
  title: string;
  xpRequired: number;      // Total XP to reach this level
  unlocks: string;         // What this level unlocks
}

export interface NPCDefinition {
  id: string;
  name: string;
  title: string;
  description: string;
  greeting: string;          // Default greeting
  location: string;          // Where in the Realm
  affinity: 'health' | 'productivity' | 'knowledge' | 'wealth' | 'wisdom';
}

// ─── Constants ──────────────────────────────────────

/** XP required per friendship level (exponential curve) */
export const FRIENDSHIP_TIERS: NPCFriendshipTier[] = [
  { level: 1,  title: 'Stranger',       xpRequired: 0,   unlocks: 'Basic dialogue' },
  { level: 2,  title: 'Acquaintance',   xpRequired: 3,   unlocks: 'Contextual dialogue + time-of-day greetings' },
  { level: 3,  title: 'Familiar',       xpRequired: 7,   unlocks: 'Personal advice + first gift' },
  { level: 4,  title: 'Companion',      xpRequired: 12,  unlocks: 'Emotional support dialogue' },
  { level: 5,  title: 'Trusted Ally',   xpRequired: 18,  unlocks: 'Detailed life advice' },
  { level: 6,  title: 'Close Friend',   xpRequired: 25,  unlocks: 'Special quest + second gift' },
  { level: 7,  title: 'Confidant',      xpRequired: 33,  unlocks: 'Deep personal insights' },
  { level: 8,  title: 'Kindred Spirit', xpRequired: 42,  unlocks: 'Hidden dialogue paths' },
  { level: 9,  title: 'Soulbound',      xpRequired: 52,  unlocks: 'Life-crisis support' },
  { level: 10, title: 'Eternal Bond',   xpRequired: 63,  unlocks: 'Legendary quest + unique title' },
];

/** NPC Definitions — maps to dialogue.ts NPC IDs */
export const NPC_DEFINITIONS: NPCDefinition[] = [
  {
    id: 'the_guide',
    name: 'The Guide',
    title: 'Pathfinder of the Realm',
    description: 'An ancient wanderer who knows every path. Speaks in riddles that point to truth.',
    greeting: 'The path reveals itself to those who walk it.',
    location: 'Life Town Square',
    affinity: 'wisdom',
  },
  {
    id: 'healer_npc',
    name: 'Elara',
    title: 'Keeper of the Sanctuary',
    description: 'A gentle healer who reads your health like a weather pattern.',
    greeting: 'Welcome to my sanctuary, dear one.',
    location: 'Healer\'s Sanctuary',
    affinity: 'health',
  },
  {
    id: 'blacksmith_npc',
    name: 'Thorin',
    title: 'Master of the Forge',
    description: 'A steadfast blacksmith who measures your worth by your goals.',
    greeting: 'The forge burns bright today!',
    location: 'Ironworks District',
    affinity: 'productivity',
  },
  {
    id: 'librarian_npc',
    name: 'Scribe Mira',
    title: 'Guardian of Knowledge',
    description: 'A quiet librarian who sees your journal as a reflection of your soul.',
    greeting: 'Ah, another page turns in the story of your life.',
    location: 'Hall of Records',
    affinity: 'knowledge',
  },
  {
    id: 'merchant_npc',
    name: 'Goldweaver San',
    title: 'Master of the Market',
    description: 'A shrewd merchant who tracks your finances as carefully as their own.',
    greeting: 'Welcome, welcome! Step right up!',
    location: 'Market Quarter',
    affinity: 'wealth',
  },
  {
    id: 'sage_npc',
    name: 'The Sage',
    title: 'Watcher of the Balance',
    description: 'An ancient sage who sees the threads connecting all aspects of your life.',
    greeting: 'Hmm... *strokes beard* ...I have been watching.',
    location: 'Wisdom Summit',
    affinity: 'wisdom',
  },
];

/** Gift items unlocked at friendship levels */
const FRIENDSHIP_GIFTS: Record<string, Record<number, { name: string; description: string; effect: string }>> = {
  healer_npc: {
    3:  { name: 'Healing Poultice', description: 'A bundle of soothing herbs.', effect: 'Restores 20 energy the next morning' },
    6:  { name: 'Sanctuary Aura', description: 'Elara\'s protective ward glows around you.', effect: '+10% health XP for 7 days' },
    10: { name: 'Everlasting Remedy', description: 'A legendary cure that adapts to any ailment.', effect: 'Permanent +5 energy cap increase' },
  },
  blacksmith_npc: {
    3:  { name: 'Forge Hammer', description: 'A balanced hammer that makes any task feel lighter.', effect: '+15% goal completion XP for 7 days' },
    6:  { name: 'Tempered Will', description: 'Thorin\'s secret technique — focus under pressure.', effect: '+25% goal completion XP for 14 days' },
    10: { name: 'Master\'s Anvil', description: 'The legendary anvil that shapes destiny itself.', effect: 'Permanent +1 goal slot' },
  },
  librarian_npc: {
    3:  { name: 'Ink Bottle', description: 'Enchanted ink that writes your thoughts clearly.', effect: '+15% journal XP for 7 days' },
    6:  { name: 'Ancient Tome', description: 'Mira\'s personal grimoire of wisdom.', effect: '+25% journal XP for 14 days' },
    10: { name: 'Omniscient Quill', description: 'A quill that captures the essence of every thought.', effect: 'Permanent 2x journal XP' },
  },
  merchant_npc: {
    3:  { name: 'Coin Pouch', description: 'A lucky pouch that seems to always have enough.', effect: '+10% finance XP for 7 days' },
    6:  { name: 'Trade Route Map', description: 'San\'s personal map of profitable routes.', effect: '+25% finance XP for 14 days' },
    10: { name: 'Golden Ledger', description: 'The legendary book of infinite prosperity.', effect: 'Permanent +5% income tracking bonus' },
  },
  the_guide: {
    3:  { name: 'Waystone', description: 'A glowing stone that illuminates your path.', effect: '+15% all XP for 7 days' },
    6:  { name: 'Compass of Purpose', description: 'Always points toward what matters most.', effect: '+25% all XP for 14 days' },
    10: { name: 'The Guiding Star', description: 'An eternal light that transforms mere mortals into legends.', effect: 'Permanent title: Starbound' },
  },
  sage_npc: {
    3:  { name: 'Wisdom Shard', description: 'A fragment of pure understanding.', effect: '+15% wisdom XP for 7 days' },
    6:  { name: 'Balanced Scale', description: 'A scale that measures harmony in all things.', effect: '+25% wisdom XP for 14 days' },
    10: { name: 'The Philosopher\'s Stone', description: 'Transmutes effort into lasting transformation.', effect: 'Permanent title: Philosopher' },
  },
};

/** Quest unlocks at friendship levels */
const FRIENDSHIP_QUESTS: Record<number, { name: string; description: string; objective: string }> = {
  3: {
    name: 'First Steps',
    description: 'Your new friend has a request...',
    objective: 'Complete 3 habits in one day',
  },
  6: {
    name: 'Deepening Bond',
    description: 'A friend in need is a friend indeed.',
    objective: 'Maintain a 7-day streak on any habit',
  },
  10: {
    name: 'Legendary Alliance',
    description: 'Your bond transcends the ordinary.',
    objective: 'Reach Level 20',
  },
};

// ─── Core Functions ──────────────────────────────────

/**
 * Get the friendship tier for a given XP value.
 */
export function getFriendshipTier(xp: number): NPCFriendshipTier {
  let tier = FRIENDSHIP_TIERS[0];
  for (const t of FRIENDSHIP_TIERS) {
    if (xp >= t.xpRequired) tier = t;
    else break;
  }
  return tier;
}

/**
 * Get the next tier above current XP (for progress toward next level).
 */
export function getNextTier(currentXp: number): NPCFriendshipTier | null {
  for (const tier of FRIENDSHIP_TIERS) {
    if (tier.xpRequired > currentXp) return tier;
  }
  return null; // Already at max level
}

/**
 * Calculate XP progress percentage toward next level.
 */
export function getFriendshipProgress(xp: number): { current: number; required: number; percentage: number } {
  const currentTier = getFriendshipTier(xp);
  const nextTier = getNextTier(xp);

  if (!nextTier) {
    return { current: xp, required: currentTier.xpRequired, percentage: 100 };
  }

  const prevXp = currentTier.xpRequired;
  const nextXp = nextTier.xpRequired;
  const progress = ((xp - prevXp) / (nextXp - prevXp)) * 100;

  return { current: xp, required: nextTier.xpRequired, percentage: Math.min(100, Math.round(progress)) };
}

/**
 * Check if an NPC interaction today is valid (once per day per NPC).
 */
export function canInteractToday(bond: NPCBond): boolean {
  if (!bond.lastInteraction) return true;
  const today = new Date().toISOString().split('T')[0];
  return bond.lastInteraction !== today;
}

/**
 * Record a daily interaction with an NPC.
 * Returns updated bond (or same bond if already interacted today).
 */
export function recordInteraction(bond: NPCBond): { bond: NPCBond; leveledUp: boolean; newlyUnlocked: string[] } {
  if (!canInteractToday(bond)) {
    return { bond, leveledUp: false, newlyUnlocked: [] };
  }

  const newXp = bond.xp + 1;
  const oldTier = getFriendshipTier(bond.xp);
  const newTier = getFriendshipTier(newXp);
  const leveledUp = newTier.level > oldTier.level;

  // Check for new unlocks
  const newlyUnlocked: string[] = [];
  if (leveledUp) {
    // Level-up unlocks
    if (newTier.level === 3) newlyUnlocked.push('personal_advice');
    if (newTier.level === 6) newlyUnlocked.push('special_quest');
    if (newTier.level === 10) newlyUnlocked.push('legendary_quest');

    // Check for quest unlocks
    const quest = FRIENDSHIP_QUESTS[newTier.level];
    if (quest) newlyUnlocked.push(`quest:${quest.name}`);
  }

  const updated: NPCBond = {
    ...bond,
    xp: newXp,
    level: newTier.level,
    lastInteraction: new Date().toISOString().split('T')[0],
    totalInteractions: bond.totalInteractions + 1,
    unlockedDialogue: [...bond.unlockedDialogue, ...newlyUnlocked],
  };

  return { bond: updated, leveledUp, newlyUnlocked };
}

/**
 * Create a new NPC bond (default state).
 */
export function createBond(npcId: string): NPCBond {
  return {
    npcId,
    level: 1,
    xp: 0,
    lastInteraction: null,
    unlockedDialogue: [],
    totalInteractions: 0,
  };
}

/**
 * Get the greeting line for an NPC, modified by friendship level.
 */
export function getFriendshipGreeting(npcId: string, bond: NPCBond): string {
  const def = NPC_DEFINITIONS.find(n => n.id === npcId);
  if (!def) return '...';

  // Higher friendship = warmer greeting
  if (bond.level >= 9) return `${def.name} smiles warmly. "My dearest friend, it always lifts my spirit to see you."`;
  if (bond.level >= 7) return `${def.name} nods with genuine warmth. "Good to see you again, friend."`;
  if (bond.level >= 5) return `${def.name} waves. "Welcome back! I have something new to share."`;
  if (bond.level >= 3) return `${def.name} recognizes you. "Ah, we meet again. Come, let me share what I know."`;
  if (bond.level >= 2) return `${def.greeting} You seem familiar...`;

  return def.greeting;
}

/**
 * Get gifts available for an NPC at current friendship level.
 */
export function getAvailableGifts(npcId: string, bond: NPCBond): { name: string; description: string; effect: string }[] {
  const npcGifts = FRIENDSHIP_GIFTS[npcId];
  if (!npcGifts) return [];

  const available: { name: string; description: string; effect: string }[] = [];
  for (const [levelStr, gift] of Object.entries(npcGifts)) {
    if (bond.level >= parseInt(levelStr)) {
      available.push(gift);
    }
  }
  return available;
}

/**
 * Get quest available at current friendship level, if any.
 */
export function getAvailableQuest(bond: NPCBond): { name: string; description: string; objective: string } | null {
  const quest = FRIENDSHIP_QUESTS[bond.level];
  if (quest && !bond.unlockedDialogue.includes(`quest:${quest.name}`)) {
    return quest;
  }
  return null;
}

/**
 * Serialize NPC bonds to a format suitable for user_profiles.preferences.npc_bonds.
 */
export function serializeBonds(bonds: NPCBond[]): Record<string, {
  level: number; xp: number; lastInteraction: string | null;
  totalInteractions: number; unlockedDialogue: string[];
}> {
  const result: Record<string, {
    level: number; xp: number; lastInteraction: string | null;
    totalInteractions: number; unlockedDialogue: string[];
  }> = {};
  for (const bond of bonds) {
    result[bond.npcId] = {
      level: bond.level,
      xp: bond.xp,
      lastInteraction: bond.lastInteraction,
      totalInteractions: bond.totalInteractions,
      unlockedDialogue: bond.unlockedDialogue,
    };
  }
  return result;
}

/**
 * Deserialize NPC bonds from user_profiles.preferences.npc_bonds.
 */
export function deserializeBonds(data: Record<string, {
  level?: number; xp?: number; lastInteraction?: string | null;
  totalInteractions?: number; unlockedDialogue?: string[];
}>): NPCBond[] {
  const bonds: NPCBond[] = [];
  for (const [npcId, bond] of Object.entries(data)) {
    bonds.push({
      npcId,
      level: bond.level ?? 1,
      xp: bond.xp ?? 0,
      lastInteraction: bond.lastInteraction ?? null,
      totalInteractions: bond.totalInteractions ?? 0,
      unlockedDialogue: bond.unlockedDialogue ?? [],
    });
  }
  return bonds;
}

/**
 * Get all bonds, creating default ones for any NPC missing from the data.
 */
export function getAllBonds(existingData: Record<string, {
  level?: number; xp?: number; lastInteraction?: string | null;
  totalInteractions?: number; unlockedDialogue?: string[];
}>): NPCBond[] {
  const bonds = deserializeBonds(existingData);
  const existingIds = new Set(bonds.map(b => b.npcId));

  // Create bonds for NPCs not yet encountered
  for (const npc of NPC_DEFINITIONS) {
    if (!existingIds.has(npc.id)) {
      bonds.push(createBond(npc.id));
    }
  }

  return bonds;
}

/**
 * Generate a friendship status summary for UI display.
 */
export function getFriendshipSummary(bond: NPCBond): {
  name: string;
  tierTitle: string;
  level: number;
  progress: number;
  canInteract: boolean;
  nextUnlock: string | null;
  affinity: string;
} {
  const def = NPC_DEFINITIONS.find(n => n.id === bond.npcId);
  const tier = getFriendshipTier(bond.xp);
  const nextTier = getNextTier(bond.xp);
  const progress = getFriendshipProgress(bond.xp);

  return {
    name: def?.name ?? bond.npcId,
    tierTitle: tier.title,
    level: tier.level,
    progress: progress.percentage,
    canInteract: canInteractToday(bond),
    nextUnlock: nextTier?.unlocks ?? null,
    affinity: def?.affinity ?? 'wisdom',
  };
}