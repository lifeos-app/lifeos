/**
 * Realm Event System — Seasonal events, world bosses, community challenges
 *
 * Provides a registry of scheduled events that affect the Realm zones.
 * Events can add decorations, change music, spawn special NPCs, etc.
 */

// ═══════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════

export type EventCategory = 'seasonal' | 'world_boss' | 'community_challenge';
export type EventStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
export type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RealmEvent {
  id: string;
  name: string;
  description: string;
  category: EventCategory;
  status: EventStatus;
  /** ISO date strings */
  startDate: string;
  endDate: string;
  recurrence: RecurrencePattern;
  /** Zone(s) affected — empty means all zones */
  affectedZones: string[];
  /** Zone-wide effects */
  effects: EventEffect[];
  /** Special NPCs that appear during this event */
  eventNPCs: EventNPC[];
  icon: string;
  /** Event-specific dialogue added to existing NPCs */
  npcDialogueAdditions?: Record<string, string[]>;
}

export interface EventEffect {
  type: 'decoration' | 'particle_overlay' | 'music_change' | 'xp_bonus' | 'npc_spawn' | 'dialogue_override';
  /** Target zone (or 'all') */
  target: string;
  value: string;
  /** Optional parameters */
  params?: Record<string, unknown>;
}

export interface EventNPC {
  id: string;
  name: string;
  spriteType: 'guide' | 'blacksmith' | 'librarian' | 'healer' | 'merchant' | 'sage';
  tileX: number;
  tileY: number;
  dialogue: string[];
  /** Which zone this NPC appears in */
  zoneId: string;
}

export interface CommunityChallenge {
  id: string;
  name: string;
  description: string;
  /** Current progress toward target */
  currentProgress: number;
  /** Goal to reach */
  targetProgress: number;
  /** Unit label (e.g., "habits logged", "XP earned") */
  unit: string;
  /** What decoration unlocks when completed */
  unlockDecorationId: string;
  unlockDecorationName: string;
  /** Event this challenge belongs to */
  parentEventId: string;
  /** Participants count */
  participantCount: number;
}

// ═══════════════════════════════════════════════════
// SEASONAL EVENTS
// ═══════════════════════════════════════════════════

const SPRING_FESTIVAL: RealmEvent = {
  id: 'spring_festival',
  name: 'Spring Festival',
  description: 'New beginnings bloom across the Realm! Cherry blossoms fill the air, and every habit planted grows stronger.',
  category: 'seasonal',
  status: 'upcoming',
  startDate: '2026-03-20T00:00:00Z',
  endDate: '2026-04-05T23:59:59Z',
  recurrence: 'yearly',
  affectedZones: ['life_city', 'life_town', 'genesis_garden'],
  effects: [
    { type: 'decoration', target: 'life_city', value: 'cherry_blossom_trees', params: { count: 6 } },
    { type: 'decoration', target: 'life_town', value: 'flower_arch', params: { color: '#FFB7C5' } },
    { type: 'particle_overlay', target: 'life_city', value: 'petal_fall' },
    { type: 'particle_overlay', target: 'genesis_garden', value: 'petal_fall' },
    { type: 'music_change', target: 'life_city', value: 'spring_festival_theme' },
    { type: 'xp_bonus', target: 'all', value: '1.1', params: { category: 'habit_log' } },
  ],
  eventNPCs: [
    {
      id: 'spring_spirit',
      name: 'Spring Spirit Blossom',
      spriteType: 'healer',
      tileX: 25,
      tileY: 15,
      dialogue: [
        'Welcome to the Spring Festival! Every habit you plant now will bloom into something beautiful.',
        'The cherry blossoms remind us: growth takes patience, but the display is worth it.',
        'Log 3 new habits during the festival and earn the Bloom Badge!',
      ],
      zoneId: 'life_city',
    },
  ],
  npcDialogueAdditions: {
    lc_mayor: [
      'The Spring Festival is upon us! Cherry blossoms and new beginnings!',
      'Every habit during the festival grows 10% stronger — take advantage!',
    ],
    lc_tavern_keeper: [
      'Spring Festival specials! Cherry blossom mead is on the house tonight.',
    ],
  },
  icon: '🌸',
};

const SUMMER_ARENA: RealmEvent = {
  id: 'summer_arena',
  name: 'Summer Arena Championship',
  description: 'The heat is on! Compete in the grand Arena tournaments. Streaks, XP, and discipline face the ultimate test.',
  category: 'seasonal',
  status: 'upcoming',
  startDate: '2026-06-21T00:00:00Z',
  endDate: '2026-07-10T23:59:59Z',
  recurrence: 'yearly',
  affectedZones: ['life_city', 'ironworks'],
  effects: [
    { type: 'decoration', target: 'life_city', value: 'battle_banners', params: { colors: ['#FF6B35', '#FFD700', '#FF4500'] } },
    { type: 'decoration', target: 'life_city', value: 'arena_stage' },
    { type: 'particle_overlay', target: 'life_city', value: 'fire_sparks' },
    { type: 'music_change', target: 'life_city', value: 'summer_arena_theme' },
    { type: 'xp_bonus', target: 'all', value: '1.2', params: { category: 'competition' } },
  ],
  eventNPCs: [
    {
      id: 'summer_champion',
      name: 'Champion Solara',
      spriteType: 'blacksmith',
      tileX: 8,
      tileY: 10,
      dialogue: [
        'The Summer Arena awaits! Compete for glory and bonus XP!',
        'This is the season of discipline. Show me your streak!',
        'Weekly tournaments: Streak Battle on Mon, XP Race on Wed, Habit Challenge on Fri.',
      ],
      zoneId: 'life_city',
    },
  ],
  npcDialogueAdditions: {
    lc_arena_master: [
      'The Summer Championship has begun! All competitions award 20% bonus XP!',
      'Enter the Grand Tournament — the winner earns the Sunblade title!',
    ],
  },
  icon: '☀️',
};

const AUTUMN_HARVEST: RealmEvent = {
  id: 'autumn_harvest',
  name: 'Autumn Harvest Festival',
  description: 'Celebrate the fruits of your discipline! XP flows abundantly and the Market Quarter fills with rare goods.',
  category: 'seasonal',
  status: 'upcoming',
  startDate: '2026-09-22T00:00:00Z',
  endDate: '2026-10-10T23:59:59Z',
  recurrence: 'yearly',
  affectedZones: ['life_city', 'market_quarter'],
  effects: [
    { type: 'decoration', target: 'life_city', value: 'harvest_wreath', params: { color: '#D4A017' } },
    { type: 'decoration', target: 'market_quarter', value: 'harvest_stalls' },
    { type: 'particle_overlay', target: 'life_city', value: 'falling_leaves' },
    { type: 'music_change', target: 'life_city', value: 'autumn_harvest_theme' },
    { type: 'xp_bonus', target: 'all', value: '1.15', params: { category: 'task_complete' } },
  ],
  eventNPCs: [
    {
      id: 'harvest_warden',
      name: 'Harvest Warden Thresh',
      spriteType: 'merchant',
      tileX: 40,
      tileY: 18,
      dialogue: [
        'The Harvest is here! Every task you complete bears extra fruit this season.',
        'Trade in your surplus XP for rare cosmetics at the Harvest Market!',
        'Community goal: Log 5000 tasks across all players to unlock the Golden Scarecrow!',
      ],
      zoneId: 'life_city',
    },
  ],
  npcDialogueAdditions: {
    lc_librarian: [
      'The Autumn Harvest reminds us to gather wisdom as well as crops.',
      'Harvest-themed guides are available in the Library this season.',
    ],
  },
  icon: '🍂',
};

const WINTER_SOLSTICE: RealmEvent = {
  id: 'winter_solstice',
  name: 'Winter Solstice',
  description: 'The longest night brings reflection and resolve. Stay warm, keep your streak, and gather around the fire.',
  category: 'seasonal',
  status: 'upcoming',
  startDate: '2026-12-21T00:00:00Z',
  endDate: '2027-01-05T23:59:59Z',
  recurrence: 'yearly',
  affectedZones: ['life_city', 'healers_sanctuary'],
  effects: [
    { type: 'decoration', target: 'life_city', value: 'snow_draping' },
    { type: 'decoration', target: 'life_city', value: 'ice_lanterns', params: { color: '#87CEEB' } },
    { type: 'particle_overlay', target: 'life_city', value: 'gentle_snow' },
    { type: 'particle_overlay', target: 'healers_sanctuary', value: 'gentle_snow' },
    { type: 'music_change', target: 'life_city', value: 'winter_solstice_theme' },
    { type: 'xp_bonus', target: 'all', value: '1.1', params: { category: 'journal_entry' } },
  ],
  eventNPCs: [
    {
      id: 'winter_sage',
      name: 'Winter Sage Frost',
      spriteType: 'sage',
      tileX: 36,
      tileY: 10,
      dialogue: [
        'In the depths of winter, your streak keeps you warm.',
        'The Solstice is a time for reflection. Write in your journal for bonus XP.',
        'Community goal: 1000 journal entries to unlock the Ice Crystal Tree!',
      ],
      zoneId: 'life_city',
    },
  ],
  npcDialogueAdditions: {
    lc_tavern_keeper: [
      'Come in from the cold! Hot cocoa and warm fires await.',
      'The Winter Solstice is perfect for storytelling by the fire.',
    ],
    lc_mayor: [
      'The Solstice reminds us: even in darkness, we keep our habits burning bright.',
    ],
  },
  icon: '❄️',
};

// ═══════════════════════════════════════════════════
// WORLD BOSS EVENTS
// ═══════════════════════════════════════════════════

const PROCRASTINATION_DRAGON: RealmEvent = {
  id: 'boss_procrastination_dragon',
  name: 'The Procrastination Dragon Rises',
  description: 'The ancient enemy awakens! Tasks left undone feed its power. Complete tasks across the Realm to weaken and ultimately defeat the Dragon!',
  category: 'world_boss',
  status: 'upcoming',
  startDate: '2026-05-15T00:00:00Z',
  endDate: '2026-05-22T23:59:59Z',
  recurrence: 'monthly',
  affectedZones: ['life_city', 'life_town'],
  effects: [
    { type: 'decoration', target: 'life_city', value: 'dragon_shadows' },
    { type: 'particle_overlay', target: 'life_city', value: 'dark_smoke' },
    { type: 'music_change', target: 'life_city', value: 'boss_battle_theme' },
    { type: 'npc_spawn', target: 'life_city', value: 'procrastination_dragon' },
    { type: 'xp_bonus', target: 'all', value: '1.5', params: { category: 'task_complete' } },
  ],
  eventNPCs: [
    {
      id: 'procrastination_dragon_npc',
      name: 'The Procrastination Dragon',
      spriteType: 'sage',
      tileX: 25,
      tileY: 8,
      dialogue: [
        'YESSS... leave your tasks unfinished... I grow stronger with every delay...',
        'Your incomplete goals are DELICIOUS! Mwahaha!',
        'Wait... you logged a task? NOOOO! My power weakens!',
      ],
      zoneId: 'life_city',
    },
  ],
  npcDialogueAdditions: {
    lc_mayor: [
      'The Procrastination Dragon has risen! Complete tasks to fight it!',
      'Every task you complete deals damage to the Dragon. Together we can defeat it!',
    ],
    lc_arena_master: [
      'This is the ultimate battle! Complete tasks to slay the Dragon!',
    ],
  },
  icon: '🐉',
};

const HABIT_HYDRA: RealmEvent = {
  id: 'boss_habit_hydra',
  name: 'The Habit Hydra Emerges',
  description: 'Three heads, three challenges! Each head represents a different domain — health, productivity, and finance. Defeat all three by logging habits in each!',
  category: 'world_boss',
  status: 'upcoming',
  startDate: '2026-06-10T00:00:00Z',
  endDate: '2026-06-17T23:59:59Z',
  recurrence: 'monthly',
  affectedZones: ['life_city', 'ironworks', 'healers_sanctuary', 'market_quarter'],
  effects: [
    { type: 'decoration', target: 'life_city', value: 'hydra_banners' },
    { type: 'particle_overlay', target: 'life_city', value: 'toxic_mist' },
    { type: 'music_change', target: 'life_city', value: 'hydra_battle_theme' },
    { type: 'xp_bonus', target: 'all', value: '1.3', params: { category: 'habit_log' } },
  ],
  eventNPCs: [
    {
      id: 'habit_hydra_npc',
      name: 'The Habit Hydra',
      spriteType: 'sage',
      tileX: 25,
      tileY: 8,
      dialogue: [
        'Three heads, three challenges! Can you defeat them all?',
        'Health! Productivity! Finance! Log habits in each to weaken my heads!',
        'One partner cannot defeat me alone... you need a PARTY!',
      ],
      zoneId: 'life_city',
    },
  ],
  npcDialogueAdditions: {
    lc_tavern_keeper: [
      'The Habit Hydra has three heads — you need at least 3 people to fight it properly!',
      'Form a party at the Party Finder and tackle each head together!',
    ],
  },
  icon: '🐲',
};

const BUDGET_BEAST: RealmEvent = {
  id: 'boss_budget_beast',
  name: 'The Budget Beast Attacks',
  description: 'The Budget Beast feeds on overspending! Track your expenses this week to drain its power. Budget entries deal critical damage!',
  category: 'world_boss',
  status: 'upcoming',
  startDate: '2026-07-10T00:00:00Z',
  endDate: '2026-07-17T23:59:59Z',
  recurrence: 'monthly',
  affectedZones: ['life_city', 'market_quarter'],
  effects: [
    { type: 'decoration', target: 'life_city', value: 'gold_hoarding_piles' },
    { type: 'particle_overlay', target: 'market_quarter', value: 'coins_falling' },
    { type: 'music_change', target: 'market_quarter', value: 'budget_beast_theme' },
    { type: 'xp_bonus', target: 'all', value: '1.4', params: { category: 'financial_entry' } },
  ],
  eventNPCs: [
    {
      id: 'budget_beast_npc',
      name: 'The Budget Beast',
      spriteType: 'merchant',
      tileX: 40,
      tileY: 18,
      dialogue: [
        'SPEND MORE! Your budget cannot contain me!',
        'Untracked expenses make me stronger! Mwahaha!',
        'A budget review? NO! My power fades with every tracked dollar!',
      ],
      zoneId: 'life_city',
    },
  ],
  npcDialogueAdditions: {
    lc_librarian: [
      'The Budget Beast weakens with every expense you track. Knowledge is the weapon!',
    ],
    lc_mayor: [
      'The Budget Beast threatens our Market Quarter! Track your expenses to fight back!',
    ],
  },
  icon: '🐗',
};

// ═══════════════════════════════════════════════════
// COMMUNITY CHALLENGES
// ═══════════════════════════════════════════════════

const COMM_CHALLENGE_FOUNTAIN: CommunityChallenge = {
  id: 'comm_golden_fountain',
  name: 'Golden Fountain',
  description: 'The community pools their discipline! Log 1,000 habits collectively to unlock the Golden Fountain decoration in Life City.',
  currentProgress: 0,
  targetProgress: 1000,
  unit: 'habits logged',
  unlockDecorationId: 'lc_golden_fountain',
  unlockDecorationName: 'Golden Fountain',
  parentEventId: 'spring_festival',
  participantCount: 0,
};

const COMM_CHALLENGE_CLOCKTOWER: CommunityChallenge = {
  id: 'comm_celestial_clock',
  name: 'Celestial Clock Tower',
  description: 'Complete 500 tasks as a community to construct the Celestial Clock Tower in Life City.',
  currentProgress: 0,
  targetProgress: 500,
  unit: 'tasks completed',
  unlockDecorationId: 'lc_celestial_clock',
  unlockDecorationName: 'Celestial Clock Tower',
  parentEventId: 'summer_arena',
  participantCount: 0,
};

const COMM_CHALLENGE_ROSE_ARCH: CommunityChallenge = {
  id: 'comm_rose_archway',
  name: 'Rose Archway',
  description: 'Write 200 journal entries collectively to plant the Rose Archway at the entrance to Life City.',
  currentProgress: 0,
  targetProgress: 200,
  unit: 'journal entries',
  unlockDecorationId: 'lc_rose_archway',
  unlockDecorationName: 'Rose Archway',
  parentEventId: 'autumn_harvest',
  participantCount: 0,
};

const COMM_CHALLENGE_ICE_TREE: CommunityChallenge = {
  id: 'comm_ice_crystal_tree',
  name: 'Ice Crystal Tree',
  description: 'Log 300 health entries together to grow the Ice Crystal Tree in the plaza.',
  currentProgress: 0,
  targetProgress: 300,
  unit: 'health entries',
  unlockDecorationId: 'lc_ice_crystal_tree',
  unlockDecorationName: 'Ice Crystal Tree',
  parentEventId: 'winter_solstice',
  participantCount: 0,
};

// ═══════════════════════════════════════════════════
// EVENT REGISTRY
// ═══════════════════════════════════════════════════

export const ALL_EVENTS: RealmEvent[] = [
  SPRING_FESTIVAL,
  SUMMER_ARENA,
  AUTUMN_HARVEST,
  WINTER_SOLSTICE,
  PROCRASTINATION_DRAGON,
  HABIT_HYDRA,
  BUDGET_BEAST,
];

export const ALL_COMMUNITY_CHALLENGES: CommunityChallenge[] = [
  COMM_CHALLENGE_FOUNTAIN,
  COMM_CHALLENGE_CLOCKTOWER,
  COMM_CHALLENGE_ROSE_ARCH,
  COMM_CHALLENGE_ICE_TREE,
];

/** Get events that are currently active based on date */
export function getActiveEvents(now?: Date): RealmEvent[] {
  const t = now ?? new Date();
  return ALL_EVENTS.filter(e => {
    const start = new Date(e.startDate);
    const end = new Date(e.endDate);
    return t >= start && t <= end;
  });
}

/** Get upcoming events (starting within 7 days) */
export function getUpcomingEvents(now?: Date): RealmEvent[] {
  const t = now ?? new Date();
  const weekLater = new Date(t.getTime() + 7 * 24 * 60 * 60 * 1000);
  return ALL_EVENTS.filter(e => {
    const start = new Date(e.startDate);
    return start > t && start <= weekLater;
  });
}

/** Get events affecting a specific zone */
export function getEventsForZone(zoneId: string, now?: Date): RealmEvent[] {
  return getActiveEvents(now).filter(e =>
    e.affectedZones.length === 0 || e.affectedZones.includes(zoneId),
  );
}

/** Get effects for a zone from all active events */
export function getZoneEffects(zoneId: string, now?: Date): EventEffect[] {
  const events = getEventsForZone(zoneId, now);
  return events.flatMap(e => e.effects.filter(ef => ef.target === zoneId || ef.target === 'all'));
}

/** Get event-specific NPCs for a zone */
export function getEventNPCsForZone(zoneId: string, now?: Date): EventNPC[] {
  const events = getEventsForZone(zoneId, now);
  return events.flatMap(e => e.eventNPCs.filter(n => n.zoneId === zoneId));
}

/** Update community challenge progress */
export function updateChallengeProgress(
  challenges: CommunityChallenge[],
  challengeId: string,
  increment: number,
): CommunityChallenge[] {
  return challenges.map(c => {
    if (c.id !== challengeId) return c;
    const newProgress = Math.min(c.currentProgress + increment, c.targetProgress);
    return { ...c, currentProgress: newProgress };
  });
}