/**
 * Housing Store — Zustand with persist middleware
 *
 * Manages player housing: room layout, items, themes, visitors.
 * Offline-first with localStorage persistence.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { genId } from '../utils/date';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export interface HouseItem {
  id: string;
  type: 'furniture' | 'trophy' | 'decoration' | 'companion' | 'wall' | 'floor' | 'lighting';
  name: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  x: number;
  y: number;
  width: number;
  height: number;
  source: 'achievement' | 'purchase' | 'quest' | 'war_reward' | 'seasonal';
  sourceId?: string;
  equipped: boolean;
}

export interface HouseVisitor {
  userId: string;
  username: string;
  visitedAt: string;
  leftGift: boolean;
  message?: string;
  rating?: number;
}

export interface PlayerHouse {
  id: string;
  userId: string;
  username: string;
  theme: string;
  items: HouseItem[];
  visitors: HouseVisitor[];
  visitorCount: number;
  lastDecoratedAt: string;
  rating: number;
  ratingCount: number;
}

export interface HouseTheme {
  id: string;
  name: string;
  icon: string;
  description: string;
  bgClass: string;
  accentColor: string;
  unlockType: 'default' | 'level' | 'achievement' | 'purchase';
  unlockRequirement?: string | number;
  seasonal?: string; // season name if seasonal
  previewEmoji: string;
}

// ═══════════════════════════════════════════════════
// THEME DEFINITIONS
// ═══════════════════════════════════════════════════

export const HOUSE_THEMES: HouseTheme[] = [
  {
    id: 'default',
    name: 'Cozy Cabin',
    icon: '🏠',
    description: 'A warm, welcoming space. Your home away from home.',
    bgClass: 'from-amber-900/20 to-stone-900/30',
    accentColor: '#D4AF37',
    unlockType: 'default',
    previewEmoji: '🏠',
  },
  {
    id: 'forest',
    name: 'Enchanted Forest',
    icon: '🌿',
    description: 'Sunlight filters through ancient canopy. Nature thrives here.',
    bgClass: 'from-green-900/20 to-emerald-900/30',
    accentColor: '#22C55E',
    unlockType: 'level',
    unlockRequirement: 10,
    previewEmoji: '🌲',
  },
  {
    id: 'ocean',
    name: 'Ocean Depths',
    icon: '🌊',
    description: 'Bioluminescent waves and coral castles beneath the sea.',
    bgClass: 'from-blue-900/20 to-cyan-900/30',
    accentColor: '#06B6D4',
    unlockType: 'level',
    unlockRequirement: 20,
    previewEmoji: '🐠',
  },
  {
    id: 'cosmic',
    name: 'Cosmic Void',
    icon: '🌌',
    description: 'Floating among nebulas and stardust. The universe is your room.',
    bgClass: 'from-purple-900/20 to-indigo-900/30',
    accentColor: '#A855F7',
    unlockType: 'achievement',
    unlockRequirement: 'realm_explorer',
    previewEmoji: '✨',
  },
  {
    id: 'volcanic',
    name: 'Volcanic Forge',
    icon: '🌋',
    description: 'Molten energy and primal fire. Born from the depths.',
    bgClass: 'from-red-900/20 to-orange-900/30',
    accentColor: '#EF4444',
    unlockType: 'achievement',
    unlockRequirement: 'war_veteran',
    previewEmoji: '🔥',
  },
  {
    id: 'crystal',
    name: 'Crystal Sanctum',
    icon: '💎',
    description: 'Prismatic light refracts through living crystal. Pure elegance.',
    bgClass: 'from-pink-900/20 to-fuchsia-900/30',
    accentColor: '#EC4899',
    unlockType: 'purchase',
    unlockRequirement: 2000,
    previewEmoji: '💎',
  },
];

// ═══════════════════════════════════════════════════
// DEFAULT FURNITURE CATALOG
// ═══════════════════════════════════════════════════

export const FURNITURE_CATALOG: Omit<HouseItem, 'id' | 'x' | 'y' | 'equipped'>[] = [
  // Furniture
  { type: 'furniture', name: 'Wooden Desk', icon: '🪑', rarity: 'common', width: 2, height: 1, source: 'purchase' },
  { type: 'furniture', name: 'Bookshelf', icon: '📚', rarity: 'common', width: 1, height: 2, source: 'purchase' },
  { type: 'furniture', name: 'Cozy Bed', icon: '🛏️', rarity: 'common', width: 2, height: 2, source: 'purchase' },
  { type: 'furniture', name: 'Armchair', icon: '🛋️', rarity: 'common', width: 1, height: 1, source: 'purchase' },
  { type: 'furniture', name: 'Grand Piano', icon: '🎹', rarity: 'epic', width: 2, height: 1, source: 'achievement' },
  { type: 'furniture', name: 'Alchemy Table', icon: '⚗️', rarity: 'rare', width: 1, height: 1, source: 'quest' },
  // Trophies
  { type: 'trophy', name: 'First Steps', icon: '🏆', rarity: 'common', width: 1, height: 1, source: 'achievement', sourceId: 'first_steps' },
  { type: 'trophy', name: 'Streak Master', icon: '🔥', rarity: 'rare', width: 1, height: 1, source: 'achievement', sourceId: 'streak_master' },
  { type: 'trophy', name: 'War Champion', icon: '⚔️', rarity: 'epic', width: 1, height: 1, source: 'war_reward' },
  { type: 'trophy', name: 'Realm Explorer', icon: '🗺️', rarity: 'legendary', width: 1, height: 1, source: 'achievement', sourceId: 'realm_explorer' },
  // Decorations
  { type: 'decoration', name: 'Crystal Orb', icon: '🔮', rarity: 'rare', width: 1, height: 1, source: 'purchase' },
  { type: 'decoration', name: 'Candle Set', icon: '🕯️', rarity: 'common', width: 1, height: 1, source: 'purchase' },
  { type: 'decoration', name: 'Music Box', icon: '🎵', rarity: 'rare', width: 1, height: 1, source: 'quest' },
  { type: 'decoration', name: 'Dragon Statue', icon: '🐉', rarity: 'legendary', width: 1, height: 1, source: 'war_reward' },
  // Companion
  { type: 'companion', name: 'Companion Bed', icon: '🐾', rarity: 'common', width: 1, height: 1, source: 'purchase' },
  { type: 'companion', name: 'Companion perch', icon: '🦅', rarity: 'rare', width: 1, height: 1, source: 'achievement' },
  // Wall
  { type: 'wall', name: 'Victory Banner', icon: '🚩', rarity: 'rare', width: 2, height: 1, source: 'war_reward' },
  { type: 'wall', name: 'Painting', icon: '🖼️', rarity: 'common', width: 1, height: 1, source: 'purchase' },
  { type: 'wall', name: 'Achievement Plaque', icon: '🎖️', rarity: 'epic', width: 1, height: 1, source: 'achievement' },
  // Floor
  { type: 'floor', name: 'Woven Rug', icon: '🟫', rarity: 'common', width: 2, height: 1, source: 'purchase' },
  { type: 'floor', name: 'Potted Plant', icon: '🪴', rarity: 'common', width: 1, height: 1, source: 'purchase' },
  { type: 'floor', name: 'Lucky Bamboo', icon: '🎋', rarity: 'rare', width: 1, height: 1, source: 'quest' },
  // Lighting
  { type: 'lighting', name: 'Warm Lantern', icon: '🪔', rarity: 'common', width: 1, height: 1, source: 'purchase' },
  { type: 'lighting', name: 'Fairy Lights', icon: '✨', rarity: 'rare', width: 1, height: 1, source: 'purchase' },
  { type: 'lighting', name: 'Disco Ball', icon: '🪩', rarity: 'epic', width: 1, height: 1, source: 'seasonal' },
];

// ═══════════════════════════════════════════════════
// STORE STATE & ACTIONS
// ═══════════════════════════════════════════════════

interface HousingState {
  houses: PlayerHouse[];
  myHouse: PlayerHouse | null;
  featuredHouses: PlayerHouse[];
  unlockedThemes: string[];
  editMode: boolean;
  selectedItemId: string | null;
  gridSnap: boolean;
  loading: boolean;
  error: string | null;

  // Actions
  initMyHouse: (userId: string, username: string) => PlayerHouse;
  placeItem: (item: Omit<HouseItem, 'id' | 'equipped'>) => HouseItem;
  removeItem: (itemId: string) => void;
  moveItem: (itemId: string, x: number, y: number) => void;
  setTheme: (themeId: string) => void;
  toggleEditMode: () => void;
  selectItem: (itemId: string | null) => void;
  toggleGridSnap: () => void;
  autoPlaceTrophy: (achievementId: string, achievementName: string, icon: string, rarity: HouseItem['rarity']) => void;
  addVisitor: (houseId: string, visitor: HouseVisitor) => void;
  rateHouse: (houseId: string, rating: number) => void;
  unlockTheme: (themeId: string) => void;
  exportLayout: () => string;
  importLayout: (json: string) => boolean;
  getHouse: (userId: string) => PlayerHouse | undefined;
  saveChanges: () => void;
  refreshFromServer: () => Promise<void>;
  setError: (error: string | null) => void;
}

const GRID_WIDTH = 8;
const GRID_HEIGHT = 6;

export const useHousingStore = create<HousingState>()(
  persist(
    (set, get) => ({
      houses: [],
      myHouse: null,
      featuredHouses: [],
      unlockedThemes: ['default'],
      editMode: false,
      selectedItemId: null,
      gridSnap: true,
      loading: false,
      error: null,

      initMyHouse: (userId, username) => {
        const existing = get().myHouse;
        if (existing) return existing;

        const house: PlayerHouse = {
          id: genId(),
          userId,
          username,
          theme: 'default',
          items: [],
          visitors: [],
          visitorCount: 0,
          lastDecoratedAt: new Date().toISOString(),
          rating: 0,
          ratingCount: 0,
        };
        set({ myHouse: house, houses: [...get().houses, house] });
        return house;
      },

      placeItem: (itemData) => {
        const item: HouseItem = {
          ...itemData,
          id: genId(),
          equipped: true,
        };
        set((s) => ({
          myHouse: s.myHouse
            ? {
                ...s.myHouse,
                items: [...s.myHouse.items, item],
                lastDecoratedAt: new Date().toISOString(),
              }
            : s.myHouse,
        }));
        return item;
      },

      removeItem: (itemId) => {
        set((s) => ({
          myHouse: s.myHouse
            ? {
                ...s.myHouse,
                items: s.myHouse.items.filter((i) => i.id !== itemId),
                lastDecoratedAt: new Date().toISOString(),
              }
            : s.myHouse,
          selectedItemId: s.selectedItemId === itemId ? null : s.selectedItemId,
        }));
      },

      moveItem: (itemId, x, y) => {
        const snap = get().gridSnap;
        const sx = snap ? Math.round(x) : x;
        const sy = snap ? Math.round(y) : y;
        set((s) => ({
          myHouse: s.myHouse
            ? {
                ...s.myHouse,
                items: s.myHouse.items.map((i) =>
                  i.id === itemId ? { ...i, x: Math.max(0, Math.min(sx, GRID_WIDTH - i.width)), y: Math.max(0, Math.min(sy, GRID_HEIGHT - i.height)) } : i
                ),
                lastDecoratedAt: new Date().toISOString(),
              }
            : s.myHouse,
        }));
      },

      setTheme: (themeId) => {
        const unlocked = get().unlockedThemes;
        if (!unlocked.includes(themeId)) {
          set({ error: 'Theme not unlocked yet!' });
          return;
        }
        set((s) => ({
          myHouse: s.myHouse ? { ...s.myHouse, theme: themeId, lastDecoratedAt: new Date().toISOString() } : s.myHouse,
        }));
      },

      toggleEditMode: () => set((s) => ({ editMode: !s.editMode, selectedItemId: null })),

      selectItem: (itemId) => set({ selectedItemId: itemId }),

      toggleGridSnap: () => set((s) => ({ gridSnap: !s.gridSnap })),

      autoPlaceTrophy: (achievementId, achievementName, icon, rarity) => {
        const house = get().myHouse;
        if (!house) return;
        const existing = house.items.find((i) => i.source === 'achievement' && i.sourceId === achievementId);
        if (existing) return;

        // Find first empty slot on trophy row (y=0)
        const occupied = new Set(house.items.filter((i) => i.y === 0).map((i) => `${i.x},${i.y}`));
        let x = 0;
        while (occupied.has(`${x},0`) && x < GRID_WIDTH) x++;

        if (x >= GRID_WIDTH) x = 0; // wrap

        const item: HouseItem = {
          id: genId(),
          type: 'trophy',
          name: achievementName,
          icon,
          rarity,
          x,
          y: 0,
          width: 1,
          height: 1,
          source: 'achievement',
          sourceId: achievementId,
          equipped: true,
        };

        set((s) => ({
          myHouse: s.myHouse
            ? { ...s.myHouse, items: [...s.myHouse.items, item], lastDecoratedAt: new Date().toISOString() }
            : s.myHouse,
        }));
        logger.info(`[housing] Auto-placed trophy: ${achievementName}`);
      },

      addVisitor: (houseId, visitor) => {
        set((s) => ({
          houses: s.houses.map((h) =>
            h.id === houseId
              ? { ...h, visitors: [...h.visitors, visitor], visitorCount: h.visitorCount + 1 }
              : h
          ),
          myHouse: s.myHouse?.id === houseId
            ? { ...s.myHouse, visitors: [...s.myHouse.visitors, visitor], visitorCount: s.myHouse.visitorCount + 1 }
            : s.myHouse,
        }));
      },

      rateHouse: (houseId, rating) => {
        set((s) => ({
          houses: s.houses.map((h) => {
            if (h.id !== houseId) return h;
            const totalRating = h.rating * h.ratingCount + rating;
            const newCount = h.ratingCount + 1;
            return { ...h, rating: totalRating / newCount, ratingCount: newCount };
          }),
        }));
      },

      unlockTheme: (themeId) => {
        if (get().unlockedThemes.includes(themeId)) return;
        set((s) => ({ unlockedThemes: [...s.unlockedThemes, themeId] }));
      },

      exportLayout: () => {
        const house = get().myHouse;
        if (!house) return '{}';
        return JSON.stringify({ theme: house.theme, items: house.items }, null, 2);
      },

      importLayout: (json) => {
        try {
          const data = JSON.parse(json);
          if (!data.items || !Array.isArray(data.items)) return false;
          set((s) => ({
            myHouse: s.myHouse
              ? { ...s.myHouse, theme: data.theme || s.myHouse.theme, items: data.items, lastDecoratedAt: new Date().toISOString() }
              : s.myHouse,
          }));
          return true;
        } catch {
          return false;
        }
      },

      getHouse: (userId) => get().houses.find((h) => h.userId === userId),

      saveChanges: () => {
        set((s) => ({
          myHouse: s.myHouse ? { ...s.myHouse, lastDecoratedAt: new Date().toISOString() } : s.myHouse,
          editMode: false,
          selectedItemId: null,
        }));
      },

      refreshFromServer: async () => {
        set({ loading: true, error: null });
        try {
          const { supabase } = await import('../lib/data-access');
          const { data, error } = await supabase
            .from('player_houses')
            .select('*')
            .order('lastDecoratedAt', { ascending: false });
          if (error) throw error;
          if (data) set({ houses: data as PlayerHouse[] });
        } catch (err: any) {
          logger.error('[housingStore] refreshFromServer error:', err);
        } finally {
          set({ loading: false });
        }
      },

      setError: (error) => set({ error }),
    }),
    {
      name: 'lifeos-housing',
      partialize: (state) => ({
        houses: state.houses,
        myHouse: state.myHouse,
        unlockedThemes: state.unlockedThemes,
        gridSnap: state.gridSnap,
      }),
    }
  )
);

export { GRID_WIDTH, GRID_HEIGHT };