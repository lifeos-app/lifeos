/**
 * usePartsStore — Zustand store for Digital Replicator parts inventory.
 *
 * Manages physical parts/components/supplies uploaded via CSV/XLSX/JSON.
 * Follows the same pattern as useLessonsStore for CRUD + sync.
 */

import { create } from 'zustand';
import { genId } from '../utils/date';
import { localGetAll, localInsert, localUpdate, type TableName } from '../lib/local-db';
import { logger } from '../utils/logger';

const TABLE: TableName = 'parts_inventory';

export type PartCondition = 'new' | 'good' | 'used' | 'refurbished' | 'damaged';

export interface PartItem {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string | null;
  quantity: number;
  unit_price: number;
  location: string | null;
  supplier: string | null;
  sku: string | null;
  condition: string;
  notes: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: number;
  sync_status: string;
}

interface PartsState {
  items: PartItem[];
  loading: boolean;
  lastFetched: number | null;

  fetchAll: () => Promise<void>;
  addItem: (item: Partial<PartItem>) => Promise<PartItem | null>;
  updateItem: (id: string, updates: Partial<PartItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  bulkInsert: (items: Partial<PartItem>[]) => Promise<number>;
  invalidate: () => void;
}

const STALE_MS = 2 * 60 * 1000; // 2 minutes

function parseJsonFields(row: any): PartItem {
  return {
    ...row,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : (row.tags || []),
    custom_fields: typeof row.custom_fields === 'string'
      ? JSON.parse(row.custom_fields || '{}')
      : (row.custom_fields || {}),
  };
}

export const usePartsStore = create<PartsState>((set, get) => ({
  items: [],
  loading: false,
  lastFetched: null,

  fetchAll: async () => {
    const { lastFetched, loading } = get();
    if (loading) return;
    if (lastFetched && Date.now() - lastFetched < STALE_MS) return;

    set({ loading: true });
    try {
      const rows = await localGetAll<PartItem>(TABLE);
      const active = rows.filter(r => !r.is_deleted);
      const parsed = active.map(parseJsonFields);
      set({ items: parsed, lastFetched: Date.now() });
    } catch (e) {
      logger.error('[parts] fetchAll failed:', e);
    } finally {
      set({ loading: false });
    }
  },

  addItem: async (item: Partial<PartItem>) => {
    const now = new Date().toISOString();
    const record: Partial<PartItem> = {
      id: genId(),
      name: item.name || 'Unnamed Part',
      description: item.description || null,
      category: item.category || null,
      quantity: item.quantity ?? 0,
      unit_price: item.unit_price ?? 0,
      location: item.location || null,
      supplier: item.supplier || null,
      sku: item.sku || null,
      condition: item.condition || 'new',
      notes: item.notes || null,
      tags: item.tags || [],
      custom_fields: item.custom_fields || {},
      image_url: item.image_url || null,
      is_deleted: 0,
      sync_status: 'pending',
      ...item,
    };

    try {
      const inserted = await localInsert(TABLE, record as any);
      const parsed = parseJsonFields(inserted);
      set({ items: [...get().items, parsed] });
      return parsed;
    } catch (e) {
      logger.error('[parts] addItem failed:', e);
      return null;
    }
  },

  updateItem: async (id: string, updates: Partial<PartItem>) => {
    try {
      await localUpdate(TABLE, id, updates as any);
      set({
        items: get().items.map(item =>
          item.id === id ? parseJsonFields({ ...item, ...updates }) : item
        ),
      });
    } catch (e) {
      logger.error('[parts] updateItem failed:', e);
    }
  },

  deleteItem: async (id: string) => {
    try {
      await localUpdate(TABLE, id, { is_deleted: 1 } as any);
      set({ items: get().items.filter(item => item.id !== id) });
    } catch (e) {
      logger.error('[parts] deleteItem failed:', e);
    }
  },

  bulkInsert: async (items: Partial<PartItem>[]) => {
    let count = 0;
    const newItems: PartItem[] = [];

    for (const item of items) {
      try {
        const record: Partial<PartItem> = {
          id: genId(),
          name: item.name || 'Unnamed Part',
          description: item.description || null,
          category: item.category || null,
          quantity: typeof item.quantity === 'number' ? item.quantity : parseInt(String(item.quantity)) || 0,
          unit_price: typeof item.unit_price === 'number' ? item.unit_price : parseFloat(String(item.unit_price)) || 0,
          location: item.location || null,
          supplier: item.supplier || null,
          sku: item.sku || null,
          condition: item.condition || 'new',
          notes: item.notes || null,
          tags: item.tags || [],
          custom_fields: item.custom_fields || {},
          image_url: item.image_url || null,
          is_deleted: 0,
          sync_status: 'pending',
        };

        const inserted = await localInsert(TABLE, record as any);
        newItems.push(parseJsonFields(inserted));
        count++;
      } catch (e) {
        logger.error('[parts] bulkInsert item failed:', e);
      }
    }

    set({ items: [...get().items, ...newItems] });
    return count;
  },

  invalidate: () => {
    set({ lastFetched: null });
  },
}));
