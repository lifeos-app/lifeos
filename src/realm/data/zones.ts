/**
 * Zone Definitions — The Realm
 *
 * Each zone is a tilemap + building positions + NPC positions + portal positions.
 * Phase 1: Only Life Town is fully defined. Other zones are signpost-only.
 */

import type { TileType } from './tiles';

export interface ZoneDef {
  id: string;
  name: string;
  description: string;
  theme: string;
  /** Width in tiles */
  width: number;
  /** Height in tiles */
  height: number;
  /** Tilemap: 2D array of TileType, [row][col] */
  tiles: TileType[][];
  /** Player spawn position (tile coords) */
  spawnX: number;
  spawnY: number;
  /** Buildings placed in the zone */
  buildings: BuildingPlacement[];
  /** NPCs in the zone */
  npcs: NPCPlacement[];
  /** Portals to other zones */
  portals: PortalPlacement[];
  /** Ambient colour palette */
  palette: {
    skyTop: string;
    skyBottom: string;
    ambient: string;
  };
}

export interface BuildingPlacement {
  id: string;
  type: BuildingType;
  /** Top-left tile position */
  tileX: number;
  tileY: number;
  /** Size in tiles */
  widthTiles: number;
  heightTiles: number;
}

export type BuildingType =
  | 'house' | 'town_hall' | 'bulletin_board' | 'well'
  | 'garden' | 'forge' | 'library' | 'temple'
  | 'bank' | 'tavern' | 'clocktower' | 'signpost';

export interface NPCAppearance {
  skinTone?: number;
  hairColor?: number;
  hairStyleIdx?: number;
  bodyColor?: string;
  faceTypeIdx?: number;
  topIdx?: number;
  bottomIdx?: number;
  shoesIdx?: number;
  hatIdx?: number;    // -1 = none
  capeIdx?: number;   // -1 = none
  weaponIdx?: number; // -1 = none
}

export interface NPCPlacement {
  id: string;
  name: string;
  /** Tile position */
  tileX: number;
  tileY: number;
  /** Sprite type for rendering */
  spriteType: 'guide' | 'blacksmith' | 'librarian' | 'healer' | 'merchant' | 'sage';
  /** Dialogue lines */
  dialogue: string[];
  /** Optional character appearance */
  appearance?: NPCAppearance;
}

export interface PortalPlacement {
  /** Tile position */
  tileX: number;
  tileY: number;
  /** Target zone */
  targetZone: string;
  /** Target spawn tile coords */
  targetX: number;
  targetY: number;
  /** Label shown on signpost */
  label: string;
  icon: string;
  /** Is this portal locked? (derived at runtime from DataBridge) */
  unlockCondition?: string;
}

// ═══════════════════════════════════════════════════
// LIFE TOWN — Central Hub (40×32 tiles = 640×512px world)
// ═══════════════════════════════════════════════════

/** Helper to create a row of tiles */
function row(tiles: TileType[], count?: number): TileType[] {
  if (count && tiles.length === 1) return Array(count).fill(tiles[0]);
  return tiles;
}

/** Generate Life Town tilemap */
function generateLifeTownTiles(): TileType[][] {
  const W = 40;
  const H = 32;
  const map: TileType[][] = [];

  for (let y = 0; y < H; y++) {
    const r: TileType[] = [];
    for (let x = 0; x < W; x++) {
      // Borders — dark grass
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) {
        r.push('grass_dark');
        continue;
      }

      // Main path — horizontal center (wider, 5 tiles)
      if (y >= 14 && y <= 18 && x >= 3 && x <= 36) {
        r.push('path_stone');
        continue;
      }

      // Main path — vertical center (wider, 5 tiles)
      if (x >= 18 && x <= 22 && y >= 3 && y <= 28) {
        r.push('path_stone');
        continue;
      }

      // Pond area (bottom right, expanded)
      if (x >= 28 && x <= 35 && y >= 22 && y <= 27) {
        if (x === 28 || x === 35 || y === 22 || y === 27) {
          r.push('grass'); // edges
        } else {
          r.push('water');
        }
        continue;
      }

      // Garden area (right side, middle-upper)
      if (x >= 27 && x <= 37 && y >= 6 && y <= 12) {
        if ((x + y) % 3 === 0) {
          r.push('grass_flowers');
        } else {
          r.push('grass');
        }
        continue;
      }

      // Town square area (around center intersection, wider)
      if (x >= 15 && x <= 25 && y >= 13 && y <= 19) {
        r.push('path_stone');
        continue;
      }

      // Additional decorative paths — north-south side paths
      if (x >= 8 && x <= 9 && y >= 5 && y <= 28) {
        r.push('path_stone');
        continue;
      }
      if (x >= 30 && x <= 31 && y >= 5 && y <= 28) {
        r.push('path_stone');
        continue;
      }

      // East-west connecting paths
      if (y >= 8 && y <= 9 && x >= 3 && x <= 36) {
        r.push('path_stone');
        continue;
      }
      if (y >= 24 && y <= 25 && x >= 3 && x <= 27) {
        r.push('path_stone');
        continue;
      }

      // Default grass
      r.push('grass');
    }
    map.push(r);
  }

  return map;
}

export const LIFE_TOWN: ZoneDef = {
  id: 'life_town',
  name: 'Life Town',
  description: 'The central hub of your journey. All paths lead here.',
  theme: 'town',
  width: 40,
  height: 32,
  tiles: generateLifeTownTiles(),
  spawnX: 20,
  spawnY: 16,
  buildings: [
    // Your House — top-left area
    {
      id: 'player_house',
      type: 'house',
      tileX: 4,
      tileY: 4,
      widthTiles: 4,
      heightTiles: 4,
    },
    // Town Hall — top-center
    {
      id: 'town_hall',
      type: 'town_hall',
      tileX: 16,
      tileY: 3,
      widthTiles: 5,
      heightTiles: 4,
    },
    // Bulletin Board — near center
    {
      id: 'bulletin_board',
      type: 'bulletin_board',
      tileX: 14,
      tileY: 13,
      widthTiles: 1,
      heightTiles: 1,
    },
    // Well — town square
    {
      id: 'well',
      type: 'well',
      tileX: 20,
      tileY: 16,
      widthTiles: 1,
      heightTiles: 1,
    },
    // Garden — right side
    {
      id: 'habit_garden',
      type: 'garden',
      tileX: 27,
      tileY: 6,
      widthTiles: 8,
      heightTiles: 5,
    },
    // Forge — left side, below house
    {
      id: 'forge',
      type: 'forge',
      tileX: 4,
      tileY: 20,
      widthTiles: 4,
      heightTiles: 3,
    },
    // Library — right side, below garden
    {
      id: 'library',
      type: 'library',
      tileX: 30,
      tileY: 17,
      widthTiles: 4,
      heightTiles: 3,
    },
    // Temple — top-right corner
    {
      id: 'temple',
      type: 'temple',
      tileX: 32,
      tileY: 3,
      widthTiles: 4,
      heightTiles: 3,
    },
    // Bank — bottom-left, near market portal
    {
      id: 'bank',
      type: 'bank',
      tileX: 4,
      tileY: 26,
      widthTiles: 3,
      heightTiles: 3,
    },
    // Tavern — bottom-center
    {
      id: 'tavern',
      type: 'tavern',
      tileX: 16,
      tileY: 24,
      widthTiles: 4,
      heightTiles: 3,
    },
  ],
  npcs: [
    {
      id: 'the_guide',
      name: 'The Guide',
      tileX: 17,
      tileY: 18,
      spriteType: 'guide',
      dialogue: [
        'Welcome to Life Town, adventurer.',
        'This world grows with your life.',
        'Every habit you keep, every goal you reach — it all shapes this place.',
        'Explore, and you\'ll see yourself reflected back.',
      ],
      appearance: { skinTone: 3, hairColor: 2, bodyColor: '#4A90D9', hairStyleIdx: 5, capeIdx: 0 },
    },
    {
      id: 'healer_npc',
      name: 'Aria the Healer',
      tileX: 36,
      tileY: 17,
      spriteType: 'healer',
      dialogue: ['Welcome to my sanctuary.'],
      appearance: { skinTone: 1, hairColor: 2, bodyColor: '#2ECC71', hairStyleIdx: 6, capeIdx: 1 },
    },
    {
      id: 'blacksmith_npc',
      name: 'Grim the Blacksmith',
      tileX: 5,
      tileY: 19,
      spriteType: 'blacksmith',
      dialogue: ['The forge awaits your ambition.'],
      appearance: { skinTone: 4, hairColor: 0, bodyColor: '#8B4513', hairStyleIdx: 1, topIdx: 1 },
    },
    {
      id: 'librarian_npc',
      name: 'Lorekeeper Mira',
      tileX: 31,
      tileY: 16,
      spriteType: 'librarian',
      dialogue: ['Knowledge is the truest power.'],
      appearance: { skinTone: 2, hairColor: 3, bodyColor: '#6B5B8B', hairStyleIdx: 2, hatIdx: 1 },
    },
    {
      id: 'merchant_npc',
      name: 'Felix the Merchant',
      tileX: 5,
      tileY: 25,
      spriteType: 'merchant',
      dialogue: ['Welcome to my shop!'],
      appearance: { skinTone: 5, hairColor: 3, bodyColor: '#F39C12', hairStyleIdx: 3, hatIdx: 0 },
    },
    {
      id: 'sage_npc',
      name: 'Elder Thane',
      tileX: 33,
      tileY: 5,
      spriteType: 'sage',
      dialogue: ['I see much in the patterns of your life.'],
      appearance: { skinTone: 0, hairColor: 4, bodyColor: '#9B59B6', hairStyleIdx: 7, capeIdx: 1, hatIdx: 1 },
    },
  ],
  portals: [
    // North — Wisdom Summit
    {
      tileX: 20,
      tileY: 1,
      targetZone: 'wisdom_summit',
      targetX: 20,
      targetY: 30,
      label: 'Wisdom Summit',
      icon: '📚',
      unlockCondition: 'journal_entry',
    },
    // West — Ironworks District
    {
      tileX: 1,
      tileY: 16,
      targetZone: 'ironworks',
      targetX: 38,
      targetY: 16,
      label: 'Ironworks',
      icon: '⚒️',
      unlockCondition: 'first_goal',
    },
    // East — Healer's Sanctuary
    {
      tileX: 38,
      tileY: 16,
      targetZone: 'healers_sanctuary',
      targetX: 1,
      targetY: 16,
      label: "Healer's Sanctuary",
      icon: '🏥',
      unlockCondition: 'health_log',
    },
    // South-West — Market Quarter
    {
      tileX: 7,
      tileY: 30,
      targetZone: 'market_quarter',
      targetX: 20,
      targetY: 1,
      label: 'Market Quarter',
      icon: '💰',
      unlockCondition: 'financial_entry',
    },
    // South-East — Social Square
    {
      tileX: 33,
      tileY: 30,
      targetZone: 'social_square',
      targetX: 20,
      targetY: 1,
      label: 'Social Square',
      icon: '🏛️',
      unlockCondition: 'guild_join',
    },
    // South — Life City (multiplayer hub, always locked for now)
    {
      tileX: 15,
      tileY: 27,
      targetZone: 'life_city',
      targetX: 15,
      targetY: 5,
      label: 'Life City',
      icon: '🏙️',
      unlockCondition: 'multiplayer_enabled',
    },
  ],
  palette: {
    skyTop: '#87CEEB',
    skyBottom: '#E0F0FF',
    ambient: '#FFD700',
  },
};

// ═══════════════════════════════════════════════════
// ZONE REGISTRY
// ═══════════════════════════════════════════════════

export const ZONES: Record<string, ZoneDef> = {
  life_town: LIFE_TOWN,
};

export function getZone(id: string): ZoneDef | undefined {
  return ZONES[id];
}
