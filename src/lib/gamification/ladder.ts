// LifeOS Gamification — Ladder (Path) System
// Users are assigned ONE primary ladder based on their focus areas / goal categories
// Each ladder has its own ranks, icon, and colour theme

export type LadderKey = 'builder' | 'scholar' | 'innovator' | 'athlete' | 'creator' | 'grower';

export interface LadderDefinition {
  key: LadderKey;
  name: string;
  icon: string;
  color: string;
  borderColor: string;
  glowColor: string;
  tagline: string;
  /** Goal categories / focus areas that map to this ladder */
  affinities: string[];
  /** Rank titles at key level milestones (level → title) */
  ranks: Record<number, string>;
}

export const LADDERS: Record<LadderKey, LadderDefinition> = {
  builder: {
    key: 'builder',
    name: 'Builder',
    icon: '🔨',
    color: '#FACC15',
    borderColor: 'rgba(250, 204, 21, 0.4)',
    glowColor: 'rgba(250, 204, 21, 0.2)',
    tagline: 'Build the life you envisioned',
    affinities: ['business', 'finance', 'work', 'career', 'entrepreneurship', 'productivity'],
    ranks: {
      1: 'Apprentice',
      5: 'Craftsman',
      10: 'Journeyman',
      15: 'Foreman',
      20: 'Contractor',
      30: 'Architect',
      40: 'Developer',
      50: 'Engineer',
      60: 'Master Builder',
      75: 'Visionary',
      90: 'Founder',
      99: 'Legend Maker',
    },
  },

  scholar: {
    key: 'scholar',
    name: 'Scholar',
    icon: '🧠',
    color: '#A855F7',
    borderColor: 'rgba(168, 85, 247, 0.4)',
    glowColor: 'rgba(168, 85, 247, 0.2)',
    tagline: 'Knowledge is your superpower',
    affinities: ['education', 'learning', 'knowledge', 'reading', 'science', 'study'],
    ranks: {
      1: 'Student',
      5: 'Reader',
      10: 'Scholar',
      15: 'Researcher',
      20: 'Analyst',
      30: 'Professor',
      40: 'Expert',
      50: 'Authority',
      60: 'Luminary',
      75: 'Sage',
      90: 'Philosopher',
      99: 'Oracle',
    },
  },

  innovator: {
    key: 'innovator',
    name: 'Innovator',
    icon: '⚡',
    color: '#00D4FF',
    borderColor: 'rgba(0, 212, 255, 0.4)',
    glowColor: 'rgba(0, 212, 255, 0.2)',
    tagline: 'Break what\'s broken. Build what\'s next.',
    affinities: ['technology', 'engineering', 'ai', 'robotics', 'coding', 'innovation', 'tech'],
    ranks: {
      1: 'Tinkerer',
      5: 'Hacker',
      10: 'Builder',
      15: 'Developer',
      20: 'Engineer',
      30: 'Inventor',
      40: 'Pioneer',
      50: 'Trailblazer',
      60: 'Disruptor',
      75: 'Visionary',
      90: 'Futurist',
      99: 'Architect of Tomorrow',
    },
  },

  athlete: {
    key: 'athlete',
    name: 'Athlete',
    icon: '💪',
    color: '#F43F5E',
    borderColor: 'rgba(244, 63, 94, 0.4)',
    glowColor: 'rgba(244, 63, 94, 0.2)',
    tagline: 'Your body is your temple. Train it.',
    affinities: ['fitness', 'health', 'sport', 'gym', 'running', 'nutrition', 'wellness', 'physical'],
    ranks: {
      1: 'Rookie',
      5: 'Contender',
      10: 'Competitor',
      15: 'Warrior',
      20: 'Gladiator',
      30: 'Champion',
      40: 'Elite',
      50: 'Titan',
      60: 'Apex',
      75: 'Legend',
      90: 'Immortal',
      99: 'GOAT',
    },
  },

  creator: {
    key: 'creator',
    name: 'Creator',
    icon: '🎨',
    color: '#EC4899',
    borderColor: 'rgba(236, 72, 153, 0.4)',
    glowColor: 'rgba(236, 72, 153, 0.2)',
    tagline: 'Every blank canvas is a door',
    affinities: ['creative', 'art', 'music', 'writing', 'content', 'design', 'film', 'photography'],
    ranks: {
      1: 'Dabbler',
      5: 'Maker',
      10: 'Artisan',
      15: 'Craftsperson',
      20: 'Artist',
      30: 'Maestro',
      40: 'Creator',
      50: 'Virtuoso',
      60: 'Auteur',
      75: 'Legend',
      90: 'Icon',
      99: 'Magnum Opus',
    },
  },

  grower: {
    key: 'grower',
    name: 'Grower',
    icon: '🌱',
    color: '#39FF14',
    borderColor: 'rgba(57, 255, 20, 0.4)',
    glowColor: 'rgba(57, 255, 20, 0.2)',
    tagline: 'Growth is the only constant',
    affinities: ['spiritual', 'mindfulness', 'meditation', 'personal development', 'social', 'relationships', 'mental health'],
    ranks: {
      1: 'Seedling',
      5: 'Sprout',
      10: 'Sapling',
      15: 'Thicket',
      20: 'Grove',
      30: 'Evergreen',
      40: 'Elder',
      50: 'Ancient',
      60: 'Ironwood',
      75: 'Sequoia',
      90: 'Ancient Oak',
      99: 'World Tree',
    },
  },
};

/** Map goal categories / focus areas → ladder key */
export function inferLadderFromCategories(categories: string[]): LadderKey | null {
  if (!categories || categories.length === 0) return null;

  const scores: Partial<Record<LadderKey, number>> = {};
  const lower = categories.map(c => c.toLowerCase());

  for (const [key, def] of Object.entries(LADDERS) as [LadderKey, LadderDefinition][]) {
    scores[key] = 0;
    for (const affinity of def.affinities) {
      for (const cat of lower) {
        if (cat.includes(affinity) || affinity.includes(cat)) {
          scores[key] = (scores[key] ?? 0) + 1;
        }
      }
    }
  }

  const best = (Object.entries(scores) as [LadderKey, number][])
    .sort((a, b) => b[1] - a[1])[0];

  if (!best || best[1] === 0) return null;
  return best[0];
}

/** Get rank title for a given ladder + level */
export function getLadderRank(ladder: LadderKey, level: number): string {
  const def = LADDERS[ladder];
  if (!def) return 'Unranked';

  // Find the highest rank threshold that the user has reached
  const thresholds = Object.keys(def.ranks)
    .map(Number)
    .sort((a, b) => b - a); // descending

  for (const threshold of thresholds) {
    if (level >= threshold) {
      return def.ranks[threshold];
    }
  }

  return def.ranks[1] ?? 'Initiate';
}

/** Get the full ladder + rank display string */
export function getLadderDisplay(ladder: LadderKey | null, level: number): string {
  if (!ladder) return level >= 2 ? `Level ${level}` : 'Unranked';
  const rank = getLadderRank(ladder, level);
  return `${LADDERS[ladder].icon} ${rank}`;
}

/** Returns the ladder definition or null */
export function getLadder(key: LadderKey | null | undefined): LadderDefinition | null {
  if (!key) return null;
  return LADDERS[key] ?? null;
}

/** Determine ladder from primary_focus field in user_profiles */
export function inferLadderFromFocus(primaryFocus: string | null | undefined): LadderKey | null {
  if (!primaryFocus) return null;
  return inferLadderFromCategories([primaryFocus]);
}
