/**
 * Inventory Store — Zustand
 *
 * Central store for equipment & inventory management.
 * Used by: Health/Equipment tab, MobileHeader shortcut
 */

import { create } from 'zustand';
import {
  localGetAll,
  localInsert,
  localUpdate,
  localDelete,
  getLocalUserId,
  getEffectiveUserId,
} from '../lib/local-db';
import { syncNow } from '../lib/sync-engine';
import { isOnline } from '../lib/offline';
import { getErrorMessage } from '../utils/error';
import { useUserStore } from './useUserStore';
import { logger } from '../utils/logger';
import { genId } from '../utils/date';

import type {
  ItemCategory,
  ListType,
  EquipSlot,
  ItemCondition,
  InventoryItem,
  PetProfile,
} from '../types/database';

export type { ItemCategory, ListType, EquipSlot, ItemCondition, InventoryItem, PetProfile };

interface InventoryState {
  items: InventoryItem[];
  pets: PetProfile[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  fetchAll: () => Promise<void>;
  addItem: (item: Partial<InventoryItem>) => Promise<InventoryItem | null>;
  updateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  equipItem: (id: string, slot: EquipSlot) => Promise<void>;
  unequipItem: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  addPet: (pet: Partial<PetProfile>) => Promise<PetProfile | null>;
  updatePet: (id: string, updates: Partial<PetProfile>) => Promise<void>;

  // Filter helpers (computed from state)
  getByList: (listType: ListType) => InventoryItem[];
  getBySlot: (slot: EquipSlot) => InventoryItem[];
  getEquipped: () => InventoryItem[];
  getEquippedBySlot: (slot: EquipSlot) => InventoryItem | undefined;
  getFavorites: () => InventoryItem[];
}

const STALE_MS = 2 * 60 * 1000;

/** Trigger background sync if online */
function bgSync() {
  if (!isOnline()) return;
  const userId = useUserStore.getState().user?.id;
  if (userId) syncNow(userId).catch(e => logger.warn('[inventory] sync failed:', e));
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  pets: [],
  loading: false,
  error: null,
  lastFetched: null,

  fetchAll: async () => {
    const { lastFetched, loading } = get();
    if (loading) return;
    if (lastFetched && Date.now() - lastFetched < STALE_MS) return;

    set({ loading: true, error: null });

    try {
      const [allItems, allPets] = await Promise.all([
        localGetAll<InventoryItem>('inventory_items'),
        localGetAll<PetProfile>('pet_profiles'),
      ]);

      // Filter out deleted items locally
      const items = allItems
        .filter(i => !i.is_deleted)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      const pets = allPets
        .filter(p => !p.is_deleted)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      set({
        items,
        pets,
        loading: false,
        lastFetched: Date.now(),
      });
    } catch (err: unknown) {
      logger.warn('[inventory] fetch error:', getErrorMessage(err));
      set({ loading: false, error: getErrorMessage(err) || 'Failed to fetch inventory' });
    }
  },

  addItem: async (item) => {
    try {
      // Get user_id from auth store or local user ID
      const authUser = useUserStore.getState().user;
      const userId = getEffectiveUserId();

      const newItem = {
        id: genId(),
        user_id: userId,
        name: item.name || 'Untitled Item',
        category: item.category || 'clothing',
        list_type: item.list_type || 'personal',
        condition: item.condition || 'good',
        is_equipped: false,
        is_favorite: false,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...item,
      };

      const created = await localInsert<InventoryItem>('inventory_items', newItem);
      set(s => ({ items: [created, ...s.items] }));
      bgSync();
      return created;
    } catch (err: unknown) {
      logger.error('[inventory] addItem error:', err);
      return null;
    }
  },

  updateItem: async (id, updates) => {
    try {
      await localUpdate('inventory_items', id, {
        ...updates,
        updated_at: new Date().toISOString(),
      });

      set(s => ({
        items: s.items.map(i => i.id === id ? { ...i, ...updates } : i),
      }));
      bgSync();
    } catch (err: unknown) {
      logger.error('[inventory] updateItem error:', err);
    }
  },

  deleteItem: async (id) => {
    try {
      // localDelete performs soft delete (sets deleted_at and is_deleted)
      await localDelete('inventory_items', id);

      set(s => ({
        items: s.items.filter(i => i.id !== id),
      }));
      bgSync();
    } catch (err: unknown) {
      logger.error('[inventory] deleteItem error:', err);
    }
  },

  equipItem: async (id, slot) => {
    const { items } = get();
    // Unequip anything currently in this slot
    const currentlyEquipped = items.find(i => i.is_equipped && i.slot === slot);
    if (currentlyEquipped) {
      await get().unequipItem(currentlyEquipped.id);
    }

    try {
      await localUpdate('inventory_items', id, {
        is_equipped: true,
        slot,
        updated_at: new Date().toISOString(),
      });

      set(s => ({
        items: s.items.map(i =>
          i.id === id ? { ...i, is_equipped: true, slot } : i
        ),
      }));
      bgSync();
    } catch (err: unknown) {
      logger.error('[inventory] equipItem error:', err);
    }
  },

  unequipItem: async (id) => {
    try {
      await localUpdate('inventory_items', id, {
        is_equipped: false,
        updated_at: new Date().toISOString(),
      });

      set(s => ({
        items: s.items.map(i =>
          i.id === id ? { ...i, is_equipped: false } : i
        ),
      }));
      bgSync();
    } catch (err: unknown) {
      logger.error('[inventory] unequipItem error:', err);
    }
  },

  toggleFavorite: async (id) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;

    const newVal = !item.is_favorite;
    try {
      await localUpdate('inventory_items', id, {
        is_favorite: newVal,
        updated_at: new Date().toISOString(),
      });

      set(s => ({
        items: s.items.map(i =>
          i.id === id ? { ...i, is_favorite: newVal } : i
        ),
      }));
      bgSync();
    } catch (err: unknown) {
      logger.error('[inventory] toggleFavorite error:', err);
    }
  },

  addPet: async (pet) => {
    try {
      // Get user_id from auth store or local user ID
      const authUser = useUserStore.getState().user;
      const userId = getEffectiveUserId();

      const newPet = {
        id: genId(),
        user_id: userId,
        name: pet.name || 'Unnamed Pet',
        species: pet.species || 'dog',
        is_deleted: false,
        created_at: new Date().toISOString(),
        ...pet,
      };

      const created = await localInsert<PetProfile>('pet_profiles', newPet);
      set(s => ({ pets: [created, ...s.pets] }));
      bgSync();
      return created;
    } catch (err: unknown) {
      logger.error('[inventory] addPet error:', err);
      return null;
    }
  },

  updatePet: async (id, updates) => {
    try {
      await localUpdate('pet_profiles', id, updates);

      set(s => ({
        pets: s.pets.map(p => p.id === id ? { ...p, ...updates } : p),
      }));
      bgSync();
    } catch (err: unknown) {
      logger.error('[inventory] updatePet error:', err);
    }
  },

  // Filter helpers
  getByList: (listType) => get().items.filter(i => i.list_type === listType),
  getBySlot: (slot) => get().items.filter(i => i.slot === slot),
  getEquipped: () => get().items.filter(i => i.is_equipped),
  getEquippedBySlot: (slot) => get().items.find(i => i.is_equipped && i.slot === slot),
  getFavorites: () => get().items.filter(i => i.is_favorite),
}));
