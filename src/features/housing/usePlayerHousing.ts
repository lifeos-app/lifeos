/**
 * usePlayerHousing.ts — Core hook for Player Housing
 *
 * Wraps the housing store with business logic: item placement,
 * theme unlocking, visitor management, and layout import/export.
 */

import { useCallback, useMemo, useEffect } from 'react';
import {
  useHousingStore,
  type HouseItem,
  type PlayerHouse,
  type HouseVisitor,
  HOUSE_THEMES,
  FURNITURE_CATALOG,
  GRID_WIDTH,
  GRID_HEIGHT,
} from '../../stores/housingStore';
import { useUserStore } from '../../stores/useUserStore';
import { useMarketStore } from '../../stores/marketStore';

export type { HouseItem, PlayerHouse, HouseVisitor };
export { HOUSE_THEMES, FURNITURE_CATALOG, GRID_WIDTH, GRID_HEIGHT };

// ═══════════════════════════════════════════════════
// LIGHTING OPTIONS
// ═══════════════════════════════════════════════════

export const LIGHTING_OPTIONS = [
  { id: 'ambient', name: 'Ambient', icon: '🌤️', class: 'brightness-100' },
  { id: 'warm', name: 'Warm', icon: '🪔', class: 'brightness-110 sepia-20' },
  { id: 'cool', name: 'Cool', icon: '❄️', class: 'brightness-105 hue-rotate-15' },
  { id: 'party', name: 'Party', icon: '🪩', class: 'animate-hue-shift' },
] as const;

// ═══════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════

export function usePlayerHousing() {
  const user = useUserStore((s) => s.user);
  const profile = useUserStore((s) => s.profile);

  const store = useHousingStore();
  const {
    myHouse,
    editMode,
    selectedItemId,
    gridSnap,
    unlockedThemes,
    houses,
    error,
    loading,
  } = store;

  // Initialize house if it doesn't exist
  useEffect(() => {
    if (user && !myHouse) {
      const username = profile?.display_name || user.email?.split('@')[0] || 'Adventurer';
      store.initMyHouse(user.id, username);
    }
  }, [user?.id, myHouse]);

  // Place an item from the catalog
  const placeItemFromCatalog = useCallback(
    (catalogIndex: number, x: number, y: number) => {
      const template = FURNITURE_CATALOG[catalogIndex];
      if (!template) return;

      // Check bounds
      if (x + template.width > GRID_WIDTH || y + template.height > GRID_HEIGHT) return;

      // Check collision
      const collision = myHouse?.items.some(
        (i) =>
          x < i.x + i.width &&
          x + template.width > i.x &&
          y < i.y + i.height &&
          y + template.height > i.y
      );
      if (collision) return;

      store.placeItem({ ...template, x, y });
    },
    [myHouse, store]
  );

  // Remove an item from the room
  const removeItem = useCallback(
    (itemId: string) => {
      store.removeItem(itemId);
    },
    [store]
  );

  // Move an item
  const moveItem = useCallback(
    (itemId: string, x: number, y: number) => {
      store.moveItem(itemId, x, y);
    },
    [store]
  );

  // Change theme
  const setTheme = useCallback(
    (themeId: string) => {
      store.setTheme(themeId);
    },
    [store]
  );

  // Check if a theme is unlocked or unlockable
  const getThemeStatus = useCallback(
    (themeId: string): 'unlocked' | 'unlockable' | 'locked' => {
      if (unlockedThemes.includes(themeId)) return 'unlocked';
      const theme = HOUSE_THEMES.find((t) => t.id === themeId);
      if (!theme) return 'locked';
      const userLevel = (profile as any)?.level || 1;
      switch (theme.unlockType) {
        case 'default':
          return 'unlocked';
        case 'level':
          return userLevel >= (theme.unlockRequirement as number) ? 'unlockable' : 'locked';
        case 'achievement':
          // Would check achievement system
          return 'locked';
        case 'purchase':
          return 'unlockable'; // Can always purchase
        default:
          return 'locked';
      }
    },
    [unlockedThemes, profile]
  );

  // Try to unlock a theme
  const tryUnlockTheme = useCallback(
    (themeId: string) => {
      const theme = HOUSE_THEMES.find((t) => t.id === themeId);
      if (!theme) return false;
      if (unlockedThemes.includes(themeId)) return true;
      const userLevel = (profile as any)?.level || 1;

      switch (theme.unlockType) {
        case 'default':
          store.unlockTheme(themeId);
          return true;
        case 'level': {
          if (userLevel >= (theme.unlockRequirement as number)) {
            store.unlockTheme(themeId);
            return true;
          }
          return false;
        }
        case 'purchase': {
          const cost = theme.unlockRequirement as number;
          const coins = useMarketStore.getState().inventory.coins;
          if (coins >= cost) {
            useMarketStore.getState().addCoins(-cost, `theme_unlock_${themeId}`);
            store.unlockTheme(themeId);
            return true;
          }
          return false;
        }
        case 'achievement':
          // Would need achievement system integration
          return false;
        default:
          return false;
      }
    },
    [unlockedThemes, profile, store]
  );

  // Auto-place trophy from achievement
  const autoPlaceTrophy = useCallback(
    (achievementId: string, name: string, icon: string, rarity: HouseItem['rarity']) => {
      store.autoPlaceTrophy(achievementId, name, icon, rarity);
    },
    [store]
  );

  // Visit another player's house
  const visitHouse = useCallback(
    (houseId: string, visitor: HouseVisitor) => {
      store.addVisitor(houseId, visitor);
    },
    [store]
  );

  // Rate a house
  const rateHouse = useCallback(
    (houseId: string, rating: number) => {
      store.rateHouse(houseId, rating);
    },
    [store]
  );

  // Export/import
  const exportLayout = useCallback(() => store.exportLayout(), [store]);
  const importLayout = useCallback((json: string) => store.importLayout(json), [store]);

  // Selected item
  const selectedItem = useMemo(
    () => myHouse?.items.find((i) => i.id === selectedItemId) || null,
    [myHouse, selectedItemId]
  );

  // Trophy shelf items
  const trophies = useMemo(
    () => myHouse?.items.filter((i) => i.type === 'trophy') || [],
    [myHouse]
  );

  // Companion items
  const companionItems = useMemo(
    () => myHouse?.items.filter((i) => i.type === 'companion') || [],
    [myHouse]
  );

  // Featured/other houses
  const otherHouses = useMemo(
    () => houses.filter((h) => h.userId !== user?.id),
    [houses, user?.id]
  );

  return {
    // State
    myHouse,
    editMode,
    gridSnap,
    selectedItemId,
    selectedItem,
    unlockedThemes,
    trophies,
    companionItems,
    otherHouses,
    error,
    loading,

    // Actions
    placeItemFromCatalog,
    removeItem,
    moveItem,
    setTheme,
    getThemeStatus,
    tryUnlockTheme,
    autoPlaceTrophy,
    visitHouse,
    rateHouse,
    exportLayout,
    importLayout,
    toggleEditMode: store.toggleEditMode,
    selectItem: store.selectItem,
    toggleGridSnap: store.toggleGridSnap,
    saveChanges: store.saveChanges,
  };
}