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
  | 'bank' | 'tavern' | 'clocktower' | 'signpost'
  | 'arena' | 'guild_hall' | 'workshop' | 'observatory' | 'market_hall';

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
  spriteType: 'guide' | 'blacksmith' | 'librarian' | 'healer' | 'merchant' | 'sage' | 'mayor' | 'arena_master' | 'tavern_keeper';
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
      targetX: 14,
      targetY: 22,
      label: 'Wisdom Summit',
      icon: '📚',
      unlockCondition: 'journal_entry',
    },
    // West — Ironworks District
    {
      tileX: 1,
      tileY: 16,
      targetZone: 'ironworks',
      targetX: 28,
      targetY: 12,
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
      targetY: 12,
      label: "Healer's Sanctuary",
      icon: '🏥',
      unlockCondition: 'health_log',
    },
    // South-West — Market Quarter
    {
      tileX: 7,
      tileY: 30,
      targetZone: 'market_quarter',
      targetX: 14,
      targetY: 22,
      label: 'Market Quarter',
      icon: '💰',
      unlockCondition: 'financial_entry',
    },
    // South-East — Social Square
    {
      tileX: 33,
      tileY: 30,
      targetZone: 'social_square',
      targetX: 14,
      targetY: 22,
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
// IRONWORKS DISTRICT — Industrial Forge Zone (30×24)
// ═══════════════════════════════════════════════════

function generateIronworksTiles(): TileType[][] {
  const W = 30, H = 24;
  const map: TileType[][] = [];
  for (let y = 0; y < H; y++) {
    const r: TileType[] = [];
    for (let x = 0; x < W; x++) {
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) { r.push('grass_dark'); continue; }
      // Central E-W forge road
      if (y >= 11 && y <= 13 && x >= 2 && x <= 27) { r.push('path_dirt'); continue; }
      // N-S path
      if (x >= 14 && x <= 16 && y >= 2 && y <= 21) { r.push('path_dirt'); continue; }
      // Lava pool (bottom-left)
      if (x >= 3 && x <= 7 && y >= 17 && y <= 20) {
        r.push(x === 3 || x === 7 || y === 17 || y === 20 ? 'wall_stone' : 'water'); continue;
      }
      // Smith yard (top-left)
      if (x >= 3 && x <= 7 && y >= 3 && y <= 7) { r.push('path_stone'); continue; }
      // Ore yard (top-right)
      if (x >= 22 && x <= 26 && y >= 3 && y <= 7) { r.push('path_dirt'); continue; }
      // Ash patches
      if ((x + y) % 7 === 0) { r.push('grass_dark'); continue; }
      r.push('grass');
    }
    map.push(r);
  }
  return map;
}

export const IRONWORKS: ZoneDef = {
  id: 'ironworks',
  name: 'Ironworks District',
  description: 'Where ambition is forged in fire and sweat. The heart of craft and industry.',
  theme: 'industrial',
  width: 30,
  height: 24,
  tiles: generateIronworksTiles(),
  spawnX: 15,
  spawnY: 12,
  buildings: [
    { id: 'forge_1', type: 'forge', tileX: 4, tileY: 3, widthTiles: 4, heightTiles: 3 },
    { id: 'forge_2', type: 'forge', tileX: 15, tileY: 3, widthTiles: 4, heightTiles: 3 },
    { id: 'forge_3', type: 'forge', tileX: 22, tileY: 14, widthTiles: 4, heightTiles: 3 },
    { id: 'signpost_1', type: 'signpost', tileX: 14, tileY: 15, widthTiles: 1, heightTiles: 1 },
    { id: 'signpost_2', type: 'signpost', tileX: 10, tileY: 11, widthTiles: 1, heightTiles: 1 },
  ],
  npcs: [
    {
      id: 'blacksmith_iron', name: 'Grim the Blacksmith', tileX: 5, tileY: 10,
      spriteType: 'blacksmith',
      dialogue: ['The fires never sleep here.', 'Every goal you strike shapes the world.'],
      appearance: { skinTone: 4, hairColor: 0, bodyColor: '#8B4513', hairStyleIdx: 1, topIdx: 1 },
    },
  ],
  portals: [
    {
      tileX: 1, tileY: 12, targetZone: 'life_town', targetX: 3, targetY: 16,
      label: 'Life Town', icon: '🏠', unlockCondition: undefined,
    },
  ],
  palette: { skyTop: '#3D3027', skyBottom: '#5A4A3A', ambient: '#FF8C00' },
};

// ═══════════════════════════════════════════════════
// WISDOM SUMMIT — Mountain Library Zone (30×24)
// ═══════════════════════════════════════════════════

function generateWisdomSummitTiles(): TileType[][] {
  const W = 30, H = 24;
  const map: TileType[][] = [];
  for (let y = 0; y < H; y++) {
    const r: TileType[] = [];
    for (let x = 0; x < W; x++) {
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) { r.push('grass_dark'); continue; }
      // Mountain path N-S
      if (x >= 13 && x <= 15 && y >= 2 && y <= 21) { r.push('path_stone'); continue; }
      // Eastern path E-W
      if (y >= 11 && y <= 13 && x >= 2 && x <= 27) { r.push('path_stone'); continue; }
      // Reflecting pool (bottom-center)
      if (x >= 10 && x <= 19 && y >= 17 && y <= 20) {
        r.push(x === 10 || x === 19 || y === 17 || y === 20 ? 'grass' : 'water'); continue;
      }
      // Scholar garden (top-right)
      if (x >= 22 && x <= 27 && y >= 3 && y <= 8) {
        r.push((x + y) % 3 === 0 ? 'grass_flowers' : 'grass'); continue;
      }
      // Stone courtyard (top-left)
      if (x >= 3 && x <= 8 && y >= 3 && y <= 7) { r.push('path_stone'); continue; }
      r.push('grass');
    }
    map.push(r);
  }
  return map;
}

export const WISDOM_SUMMIT: ZoneDef = {
  id: 'wisdom_summit',
  name: 'Wisdom Summit',
  description: 'A mountain retreat of knowledge. Scrolls and stories await the curious mind.',
  theme: 'mountain',
  width: 30,
  height: 24,
  tiles: generateWisdomSummitTiles(),
  spawnX: 14,
  spawnY: 12,
  buildings: [
    { id: 'library_1', type: 'library', tileX: 3, tileY: 3, widthTiles: 4, heightTiles: 3 },
    { id: 'library_2', type: 'library', tileX: 22, tileY: 3, widthTiles: 4, heightTiles: 3 },
    { id: 'temple_1', type: 'temple', tileX: 13, tileY: 2, widthTiles: 4, heightTiles: 3 },
  ],
  npcs: [
    {
      id: 'librarian_ws', name: 'Lorekeeper Mira', tileX: 4, tileY: 7,
      spriteType: 'librarian',
      dialogue: ['Knowledge is the truest power.', 'Every journal entry adds a page to your story.'],
      appearance: { skinTone: 2, hairColor: 3, bodyColor: '#6B5B8B', hairStyleIdx: 2, hatIdx: 1 },
    },
    {
      id: 'sage_ws', name: 'Elder Thane', tileX: 23, tileY: 9,
      spriteType: 'sage',
      dialogue: ['I see much in the patterns of your life.', 'The mountain remembers what the valley forgets.'],
      appearance: { skinTone: 0, hairColor: 4, bodyColor: '#9B59B6', hairStyleIdx: 7, capeIdx: 1, hatIdx: 1 },
    },
  ],
  portals: [
    {
      tileX: 14, tileY: 1, targetZone: 'life_town', targetX: 20, targetY: 3,
      label: 'Life Town', icon: '🏠', unlockCondition: undefined,
    },
  ],
  palette: { skyTop: '#4A3560', skyBottom: '#7B68AE', ambient: '#B8C9E8' },
};

// ═══════════════════════════════════════════════════
// HEALER'S SANCTUARY — Calm Medical Zone (30×24)
// ═══════════════════════════════════════════════════

function generateHealersSanctuaryTiles(): TileType[][] {
  const W = 30, H = 24;
  const map: TileType[][] = [];
  for (let y = 0; y < H; y++) {
    const r: TileType[] = [];
    for (let x = 0; x < W; x++) {
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) { r.push('grass_dark'); continue; }
      // Main path cross
      if (x >= 13 && x <= 15 && y >= 2 && y <= 21) { r.push('path_stone'); continue; }
      if (y >= 11 && y <= 13 && x >= 2 && x <= 27) { r.push('path_stone'); continue; }
      // Healing pool (center)
      if (x >= 12 && x <= 16 && y >= 14 && y <= 18) {
        r.push(x === 12 || x === 16 || y === 14 || y === 18 ? 'grass' : 'water'); continue;
      }
      // herb garden (top-left)
      if (x >= 3 && x <= 8 && y >= 3 && y <= 8) {
        r.push((x + y) % 2 === 0 ? 'grass_flowers' : 'grass'); continue;
      }
      // meditation garden (bottom-right)
      if (x >= 21 && x <= 26 && y >= 16 && y <= 21) {
        r.push((x + y) % 3 === 0 ? 'grass_flowers' : 'grass'); continue;
      }
      r.push('grass');
    }
    map.push(r);
  }
  return map;
}

export const HEALERS_SANCTUARY: ZoneDef = {
  id: 'healers_sanctuary',
  name: "Healer's Sanctuary",
  description: 'A place of restoration and peace. Tend to your well-being here.',
  theme: 'healing',
  width: 30,
  height: 24,
  tiles: generateHealersSanctuaryTiles(),
  spawnX: 14,
  spawnY: 12,
  buildings: [
    { id: 'temple_heal_1', type: 'temple', tileX: 3, tileY: 9, widthTiles: 4, heightTiles: 3 },
    { id: 'temple_heal_2', type: 'temple', tileX: 22, tileY: 3, widthTiles: 4, heightTiles: 3 },
    { id: 'garden_herb', type: 'garden', tileX: 3, tileY: 3, widthTiles: 4, heightTiles: 4 },
  ],
  npcs: [
    {
      id: 'healer_hs', name: 'Aria the Healer', tileX: 14, tileY: 10,
      spriteType: 'healer',
      dialogue: ['Welcome to my sanctuary.', 'Your health is your greatest treasure.'],
      appearance: { skinTone: 1, hairColor: 2, bodyColor: '#2ECC71', hairStyleIdx: 6, capeIdx: 1 },
    },
  ],
  portals: [
    {
      tileX: 28, tileY: 12, targetZone: 'life_town', targetX: 38, targetY: 16,
      label: 'Life Town', icon: '🏠', unlockCondition: undefined,
    },
  ],
  palette: { skyTop: '#A8E6A1', skyBottom: '#D4F7D0', ambient: '#FFE4B5' },
};

// ═══════════════════════════════════════════════════
// MARKET QUARTER — Bustling Trade Zone (30×24)
// ═══════════════════════════════════════════════════

function generateMarketQuarterTiles(): TileType[][] {
  const W = 30, H = 24;
  const map: TileType[][] = [];
  for (let y = 0; y < H; y++) {
    const r: TileType[] = [];
    for (let x = 0; x < W; x++) {
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) { r.push('grass_dark'); continue; }
      // Grand E-W market road
      if (y >= 10 && y <= 13 && x >= 2 && x <= 27) { r.push('path_stone'); continue; }
      // N-S side streets
      if (x >= 6 && x <= 7 && y >= 2 && y <= 21) { r.push('path_stone'); continue; }
      if (x >= 22 && x <= 23 && y >= 2 && y <= 21) { r.push('path_stone'); continue; }
      // Gold fountain area (center)
      if (x >= 13 && x <= 15 && y >= 5 && y <= 9) { r.push('path_stone'); continue; }
      // Market stalls (top)
      if (x >= 9 && x <= 19 && y >= 2 && y <= 4) { r.push('path_dirt'); continue; }
      r.push('grass');
    }
    map.push(r);
  }
  return map;
}

export const MARKET_QUARTER: ZoneDef = {
  id: 'market_quarter',
  name: 'Market Quarter',
  description: 'Where coins flow and deals are struck. Master your finances in the bustling bazaar.',
  theme: 'finance',
  width: 30,
  height: 24,
  tiles: generateMarketQuarterTiles(),
  spawnX: 14,
  spawnY: 11,
  buildings: [
    { id: 'bank_1', type: 'bank', tileX: 3, tileY: 3, widthTiles: 3, heightTiles: 3 },
    { id: 'bank_2', type: 'bank', tileX: 24, tileY: 3, widthTiles: 3, heightTiles: 3 },
    { id: 'signpost_m1', type: 'signpost', tileX: 14, tileY: 6, widthTiles: 1, heightTiles: 1 },
    { id: 'signpost_m2', type: 'signpost', tileX: 7, tileY: 11, widthTiles: 1, heightTiles: 1 },
    { id: 'tavern_1', type: 'tavern', tileX: 3, tileY: 14, widthTiles: 4, heightTiles: 3 },
  ],
  npcs: [
    {
      id: 'merchant_mq', name: 'Felix the Merchant', tileX: 15, tileY: 4,
      spriteType: 'merchant',
      dialogue: ['Welcome to my shop!', 'Every coin saved is a coin earned.'],
      appearance: { skinTone: 5, hairColor: 3, bodyColor: '#F39C12', hairStyleIdx: 3, hatIdx: 0 },
    },
  ],
  portals: [
    {
      tileX: 14, tileY: 1, targetZone: 'life_town', targetX: 7, targetY: 30,
      label: 'Life Town', icon: '🏠', unlockCondition: undefined,
    },
  ],
  palette: { skyTop: '#FF6B35', skyBottom: '#FFC857', ambient: '#FFD700' },
};

// ═══════════════════════════════════════════════════
// SOCIAL SQUARE — Community Connection Zone (30×24)
// ═══════════════════════════════════════════════════

function generateSocialSquareTiles(): TileType[][] {
  const W = 30, H = 24;
  const map: TileType[][] = [];
  for (let y = 0; y < H; y++) {
    const r: TileType[] = [];
    for (let x = 0; x < W; x++) {
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) { r.push('grass_dark'); continue; }
      // Large central plaza
      if (x >= 8 && x <= 21 && y >= 8 && y <= 15) { r.push('path_stone'); continue; }
      // N-S avenue
      if (x >= 13 && x <= 15 && y >= 2 && y <= 21) { r.push('path_stone'); continue; }
      // E-W avenue
      if (y >= 11 && y <= 13 && x >= 2 && x <= 27) { r.push('path_stone'); continue; }
      // Community garden (top-left)
      if (x >= 3 && x <= 7 && y >= 3 && y <= 7) {
        r.push((x + y) % 2 === 0 ? 'grass_flowers' : 'grass'); continue;
      }
      // Fountain area marker (center)
      if (x >= 13 && x <= 15 && y >= 9 && y <= 11) { r.push('water_edge_s'); continue; }
      r.push('grass');
    }
    map.push(r);
  }
  return map;
}

export const SOCIAL_SQUARE: ZoneDef = {
  id: 'social_square',
  name: 'Social Square',
  description: 'The beating heart of community. Where connections are made and friendships forged.',
  theme: 'community',
  width: 30,
  height: 24,
  tiles: generateSocialSquareTiles(),
  spawnX: 14,
  spawnY: 12,
  buildings: [
    { id: 'town_hall_ss', type: 'town_hall', tileX: 13, tileY: 2, widthTiles: 5, heightTiles: 4 },
    { id: 'bulletin_ss_1', type: 'bulletin_board', tileX: 9, tileY: 8, widthTiles: 1, heightTiles: 1 },
    { id: 'bulletin_ss_2', type: 'bulletin_board', tileX: 20, tileY: 8, widthTiles: 1, heightTiles: 1 },
    { id: 'well_ss', type: 'well', tileX: 14, tileY: 10, widthTiles: 1, heightTiles: 1 },
  ],
  npcs: [
    {
      id: 'guide_ss', name: 'The Guide', tileX: 14, tileY: 14,
      spriteType: 'guide',
      dialogue: ['Together, we grow stronger.', 'Find your people, find your purpose.'],
      appearance: { skinTone: 3, hairColor: 2, bodyColor: '#4A90D9', hairStyleIdx: 5, capeIdx: 0 },
    },
  ],
  portals: [
    {
      tileX: 14, tileY: 23, targetZone: 'life_town', targetX: 33, targetY: 30,
      label: 'Life Town', icon: '🏠', unlockCondition: undefined,
    },
  ],
  palette: { skyTop: '#5B9BD5', skyBottom: '#B4D7F0', ambient: '#FFE4B5' },
};

// ═══════════════════════════════════════════════════
// GENESIS GARDEN — Tutorial Starting Zone (20×16)
// ═══════════════════════════════════════════════════

function generateGenesisGardenTiles(): TileType[][] {
  const W = 20, H = 16;
  const map: TileType[][] = [];
  for (let y = 0; y < H; y++) {
    const r: TileType[] = [];
    for (let x = 0; x < W; x++) {
      // Borders — lush dark grass
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) { r.push('grass_dark'); continue; }
      // Central path from spawn (south) to portal (north)
      if (x >= 8 && x <= 10 && y >= 4 && y <= 14) { r.push('path_stone'); continue; }
      // Path to garden area (west)
      if (y >= 7 && y <= 8 && x >= 3 && x <= 10) { r.push('path_stone'); continue; }
      // Garden patch (bottom-left)
      if (x >= 3 && x <= 6 && y >= 9 && y <= 12) {
        r.push((x + y) % 3 === 0 ? 'grass_flowers' : 'grass');
        continue;
      }
      // Small pond (top-right)
      if (x >= 14 && x <= 16 && y >= 3 && y <= 5) {
        if (x === 14 || x === 16 || y === 3 || y === 5) r.push('water_edge_s');
        else r.push('water');
        continue;
      }
      // Flower meadow (east side)
      if (x >= 13 && x <= 17 && y >= 8 && y <= 13) {
        r.push((x * 3 + y * 7) % 5 === 0 ? 'grass_flowers' : 'grass');
        continue;
      }
      r.push('grass');
    }
    map.push(r);
  }
  return map;
}

export const GENESIS_GARDEN: ZoneDef = {
  id: 'genesis_garden',
  name: 'Genesis Garden',
  description: 'Where every journey begins. A peaceful garden where the Sage teaches you the ways of the Realm.',
  theme: 'tutorial',
  width: 20,
  height: 16,
  tiles: generateGenesisGardenTiles(),
  spawnX: 9,
  spawnY: 13,
  buildings: [
    { id: 'tutorial_garden', type: 'garden', tileX: 4, tileY: 9, widthTiles: 3, heightTiles: 3 },
    { id: 'tutorial_bulletin', type: 'bulletin_board', tileX: 9, tileY: 5, widthTiles: 1, heightTiles: 1 },
    { id: 'tutorial_well', type: 'well', tileX: 15, tileY: 6, widthTiles: 1, heightTiles: 1 },
  ],
  npcs: [
    {
      id: 'tutorial_sage',
      name: 'The Sage',
      tileX: 9,
      tileY: 9,
      spriteType: 'sage',
      dialogue: [
        'Welcome, adventurer. This garden is where your journey begins.',
        'Walk around with arrow keys or tap to move.',
        'Tap the garden patch to water your first plant.',
        'When you are ready, step through the northern portal to enter Life Town.',
      ],
      appearance: { skinTone: 0, hairColor: 4, bodyColor: '#9B59B6', hairStyleIdx: 7, capeIdx: 1, hatIdx: 1 },
    },
  ],
  portals: [
    {
      tileX: 9,
      tileY: 1,
      targetZone: 'life_town',
      targetX: 20,
      targetY: 5,
      label: 'Life Town',
      icon: '🌅',
    },
  ],
  palette: {
    skyTop: '#FFF8DC',
    skyBottom: '#FFE4B5',
    ambient: '#FFD700',
  },
};

// ═══════════════════════════════════════════════════
// LIFE CITY — Multiplayer Hub Zone (50×40)
// ═══════════════════════════════════════════════════

function generateLifeCityTiles(): TileType[][] {
  const W = 50;
  const H = 40;
  const map: TileType[][] = [];

  for (let y = 0; y < H; y++) {
    const r: TileType[] = [];
    for (let x = 0; x < W; x++) {
      // Borders — dark grass
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) {
        r.push('grass_dark');
        continue;
      }

      // Grand avenue — east-west central (6 tiles wide)
      if (y >= 18 && y <= 23 && x >= 2 && x <= 47) {
        r.push('path_stone');
        continue;
      }

      // Main boulevard — north-south central (6 tiles wide)
      if (x >= 23 && x <= 28 && y >= 2 && y <= 37) {
        r.push('path_stone');
        continue;
      }

      // Central plaza (large open area around fountain)
      if (x >= 20 && x <= 31 && y >= 16 && y <= 25) {
        r.push('path_stone');
        continue;
      }

      // Fountain pool (center of plaza)
      if (x >= 24 && x <= 27 && y >= 19 && y <= 22) {
        r.push('water');
        continue;
      }

      // North path to Town Hall
      if (y >= 5 && y <= 7 && x >= 23 && x <= 28) {
        r.push('path_stone');
        continue;
      }

      // East path to Market Hall
      if (x >= 38 && x <= 40 && y >= 18 && y <= 23) {
        r.push('path_stone');
        continue;
      }

      // West path to Arena
      if (x >= 8 && x <= 10 && y >= 18 && y <= 23) {
        r.push('path_stone');
        continue;
      }

      // South path to Guild Hall / Library
      if (y >= 28 && y <= 30 && x >= 23 && x <= 28) {
        r.push('path_stone');
        continue;
      }

      // NW quadrant path to Arena district
      if (x >= 5 && x <= 10 && y >= 8 && y <= 10) {
        r.push('path_dirt');
        continue;
      }

      // NE quadrant path to Observatory
      if (x >= 40 && x <= 45 && y >= 8 && y <= 10) {
        r.push('path_stone');
        continue;
      }

      // SW quadrant path to Tavern
      if (x >= 5 && x <= 10 && y >= 28 && y <= 30) {
        r.push('path_dirt');
        continue;
      }

      // SE quadrant path to Library / Workshop
      if (x >= 40 && x <= 45 && y >= 28 && y <= 30) {
        r.push('path_stone');
        continue;
      }

      // Garden patches (decorative)
      if (x >= 2 && x <= 6 && y >= 12 && y <= 16) {
        r.push((x + y) % 3 === 0 ? 'grass_flowers' : 'grass');
        continue;
      }
      if (x >= 43 && x <= 47 && y >= 12 && y <= 16) {
        r.push((x + y) % 3 === 0 ? 'grass_flowers' : 'grass');
        continue;
      }

      // Pond / reflecting pool (NE corner)
      if (x >= 42 && x <= 46 && y >= 4 && y <= 7) {
        if (x === 42 || x === 46 || y === 4 || y === 7) {
          r.push('grass');
        } else {
          r.push('water');
        }
        continue;
      }

      // Default grass
      r.push('grass');
    }
    map.push(r);
  }

  return map;
}

export const LIFE_CITY: ZoneDef = {
  id: 'life_city',
  name: 'Life City',
  description: 'The bustling multiplayer hub. Meet other adventurers, shop, socialize, and take on challenges together.',
  theme: 'city',
  width: 50,
  height: 40,
  tiles: generateLifeCityTiles(),
  spawnX: 25,
  spawnY: 24,
  buildings: [
    // North — Town Hall (large building)
    { id: 'lc_town_hall', type: 'town_hall', tileX: 22, tileY: 2, widthTiles: 8, heightTiles: 5 },
    // NW — Arena
    { id: 'lc_arena', type: 'arena', tileX: 3, tileY: 4, widthTiles: 6, heightTiles: 5 },
    // SW — Tavern
    { id: 'lc_tavern', type: 'tavern', tileX: 3, tileY: 26, widthTiles: 6, heightTiles: 5 },
    // East — Market Hall
    { id: 'lc_market_hall', type: 'market_hall', tileX: 38, tileY: 14, widthTiles: 8, heightTiles: 5 },
    // South — Guild Hall
    { id: 'lc_guild_hall', type: 'guild_hall', tileX: 20, tileY: 32, widthTiles: 8, heightTiles: 5 },
    // SE — Workshop
    { id: 'lc_workshop', type: 'workshop', tileX: 38, tileY: 26, widthTiles: 6, heightTiles: 5 },
    // NE — Library
    { id: 'lc_library', type: 'library', tileX: 38, tileY: 4, widthTiles: 5, heightTiles: 4 },
    // Far NE — Observatory
    { id: 'lc_observatory', type: 'observatory', tileX: 44, tileY: 2, widthTiles: 4, heightTiles: 4 },
  ],
  npcs: [
    {
      id: 'lc_mayor',
      name: 'Mayor Eleanor',
      tileX: 25,
      tileY: 10,
      spriteType: 'mayor',
      dialogue: [
        'Welcome to Life City! This is where adventurers come together.',
        'Every habit you keep, every goal you reach — it strengthens the city.',
        'Check the quest board for daily civic duties!',
      ],
      appearance: { skinTone: 1, hairColor: 1, bodyColor: '#8B0000', hairStyleIdx: 4, capeIdx: 0, hatIdx: 0 },
    },
    {
      id: 'lc_arena_master',
      name: 'Arena Master Kael',
      tileX: 5,
      tileY: 10,
      spriteType: 'arena_master',
      dialogue: [
        'The Arena awaits, challenger!',
        'Prove your discipline in streak battles and XP races!',
        'Only the consistent survive here.',
      ],
      appearance: { skinTone: 3, hairColor: 0, bodyColor: '#4A0E0E', hairStyleIdx: 1, weaponIdx: 0, topIdx: 2 },
    },
    {
      id: 'lc_tavern_keeper',
      name: 'Tavern Keeper Rosa',
      tileX: 5,
      tileY: 25,
      spriteType: 'tavern_keeper',
      dialogue: [
        'Come in, warm yourself by the fire!',
        'Looking for a group? Check the party finder!',
        'The best stories are told at this tavern.',
      ],
      appearance: { skinTone: 2, hairColor: 4, bodyColor: '#8B4513', hairStyleIdx: 6, hatIdx: 2 },
    },
    {
      id: 'lc_librarian',
      name: 'Librarian Sage Ashwin',
      tileX: 39,
      tileY: 9,
      spriteType: 'librarian',
      dialogue: [
        'Shhh... knowledge resides here.',
        'Browse our guides or exchange tips with fellow adventurers.',
        'The wise know that sharing wisdom earns XP.',
      ],
      appearance: { skinTone: 4, hairColor: 3, bodyColor: '#6B5B8B', hairStyleIdx: 2, hatIdx: 1 },
    },
  ],
  portals: [
    // North portal → Genesis Garden
    {
      tileX: 25, tileY: 1, targetZone: 'genesis_garden', targetX: 9, targetY: 13,
      label: 'Genesis Garden', icon: '🌱',
    },
    // NW portal → Life Town
    {
      tileX: 1, tileY: 20, targetZone: 'life_town', targetX: 15, targetY: 27,
      label: 'Life Town', icon: '🏠',
    },
    // NE portal → Wisdom Summit
    {
      tileX: 48, tileY: 10, targetZone: 'wisdom_summit', targetX: 14, targetY: 22,
      label: 'Wisdom Summit', icon: '📚',
    },
    // SW portal → Ironworks District
    {
      tileX: 1, tileY: 35, targetZone: 'ironworks', targetX: 28, targetY: 12,
      label: 'Ironworks', icon: '⚒️',
    },
    // W portal → Healer's Sanctuary
    {
      tileX: 1, tileY: 28, targetZone: 'healers_sanctuary', targetX: 1, targetY: 12,
      label: "Healer's Sanctuary", icon: '🏥',
    },
    // E portal → Market Quarter
    {
      tileX: 48, tileY: 20, targetZone: 'market_quarter', targetX: 14, targetY: 22,
      label: 'Market Quarter', icon: '💰',
    },
    // SE portal → Social Square
    {
      tileX: 48, tileY: 36, targetZone: 'social_square', targetX: 14, targetY: 22,
      label: 'Social Square', icon: '🏛️',
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
  genesis_garden: GENESIS_GARDEN,
  life_town: LIFE_TOWN,
  ironworks: IRONWORKS,
  wisdom_summit: WISDOM_SUMMIT,
  healers_sanctuary: HEALERS_SANCTUARY,
  market_quarter: MARKET_QUARTER,
  social_square: SOCIAL_SQUARE,
  life_city: LIFE_CITY,
};

export function getZone(id: string): ZoneDef | undefined {
  return ZONES[id];
}
