/**
 * Assets Store — Zustand
 *
 * Central store for the "Equip Your Life" system.
 * Manages properties, vehicles, devices, documents, memberships, insurance.
 * Each asset can have linked maintenance schedules, bills, and documents.
 *
 * Local-first: reads from IndexedDB, syncs to Supabase in background.
 */

import { create } from 'zustand';
import { isOnline } from '../lib/offline';
import {
  localGetAll,
  localInsert,
  localUpdate,
  localDelete,
  getEffectiveUserId,
} from '../lib/local-db';
import { syncNow } from '../lib/sync-engine';
import { useUserStore } from './useUserStore';
import { logger } from '../utils/logger';
import { genId } from '../utils/date';

import type {
  AssetType,
  Asset,
  AssetMaintenance,
  AssetBill,
  AssetDocument,
  AssetWithDetails,
} from '../types/database';

export type { AssetType, Asset, AssetMaintenance, AssetBill, AssetDocument, AssetWithDetails };

// ── Store ──────────────────────────────────────────

interface AssetsState {
  assets: Asset[];
  maintenance: AssetMaintenance[];
  bills: AssetBill[];
  documents: AssetDocument[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Core actions
  fetchAll: (options?: { skipSync?: boolean }) => Promise<void>;
  invalidate: () => void;

  // Asset CRUD
  addAsset: (asset: Partial<Asset>) => Promise<Asset | null>;
  updateAsset: (id: string, updates: Partial<Asset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  toggleEquipped: (id: string) => Promise<void>;

  // Maintenance CRUD
  addMaintenance: (item: Partial<AssetMaintenance>) => Promise<AssetMaintenance | null>;
  updateMaintenance: (id: string, updates: Partial<AssetMaintenance>) => Promise<void>;
  completeMaintenance: (id: string) => Promise<void>;
  deleteMaintenance: (id: string) => Promise<void>;

  // Bills CRUD
  addBill: (bill: Partial<AssetBill>) => Promise<AssetBill | null>;
  updateBill: (id: string, updates: Partial<AssetBill>) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;

  // Documents CRUD
  addDocument: (doc: Partial<AssetDocument>) => Promise<AssetDocument | null>;
  updateDocument: (id: string, updates: Partial<AssetDocument>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;

  // Computed helpers
  getEquippedAssets: () => Asset[];
  getAssetsByType: (type: AssetType) => Asset[];
  getAssetWithDetails: (id: string) => AssetWithDetails | null;
  getUpcomingMaintenance: (days?: number) => AssetMaintenance[];
  getUpcomingBills: (days?: number) => AssetBill[];
  getExpiringDocuments: (days?: number) => AssetDocument[];
  getMonthlyBillTotal: () => number;
}

const STALE_MS = 2 * 60 * 1000;

/** Trigger background sync if online */
async function bgSync() {
  if (!isOnline()) return;
  try {
    const userId = useUserStore.getState().user?.id;
    if (userId) syncNow(userId).catch(e => logger.warn('[assets] sync failed:', e));
  } catch { /* ignore */ }
}

export const useAssetsStore = create<AssetsState>((set, get) => ({
  assets: [],
  maintenance: [],
  bills: [],
  documents: [],
  loading: false,
  error: null,
  lastFetched: null,

  fetchAll: async (options?: { skipSync?: boolean }) => {
    const { lastFetched, loading } = get();
    if (loading) return;
    if (lastFetched && Date.now() - lastFetched < STALE_MS) return;

    set({ loading: true, error: null });

    try {
      const [allAssets, allMaint, allBills, allDocs] = await Promise.all([
        localGetAll<Asset>('assets'),
        localGetAll<AssetMaintenance>('asset_maintenance'),
        localGetAll<AssetBill>('asset_bills'),
        localGetAll<AssetDocument>('asset_documents'),
      ]);

      const assets = allAssets
        .filter(a => !a.is_deleted)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

      const maintenance = allMaint
        .filter(m => !m.is_deleted)
        .sort((a, b) => (a.next_due || '').localeCompare(b.next_due || ''));

      const bills = allBills
        .filter(b => !b.is_deleted)
        .sort((a, b) => (a.next_due || '').localeCompare(b.next_due || ''));

      const documents = allDocs
        .filter(d => !d.is_deleted)
        .sort((a, b) => (a.expiry_date || '').localeCompare(b.expiry_date || ''));

      set({
        assets,
        maintenance,
        bills,
        documents,
        loading: false,
        lastFetched: Date.now(),
      });

      // Background sync
      if (!options?.skipSync) bgSync();
    } catch (err: any) {
      logger.error('[assets] fetch error:', err);
      set({ loading: false, error: err?.message || 'Failed to fetch assets' });
    }
  },

  invalidate: () => {
    set({ lastFetched: null });
    get().fetchAll();
  },

  // ── Asset CRUD ──

  addAsset: async (asset) => {
    const userId = getEffectiveUserId();

    const newAsset = {
      id: genId(),
      user_id: userId,
      asset_type: asset.asset_type || 'other',
      name: asset.name || 'Untitled Asset',
      is_equipped: true,
      is_archived: false,
      is_deleted: false,
      currency: 'AUD',
      metadata: {},
      created_at: new Date().toISOString(),
      ...asset,
    };

    try {
      const created = await localInsert<Asset>('assets', newAsset);
      set(s => ({ assets: [created, ...s.assets] }));
      bgSync();
      return created;
    } catch (err: any) {
      logger.error('[assets] addAsset error:', err);
      return null;
    }
  },

  updateAsset: async (id, updates) => {
    const prev = get().assets;
    set(s => ({ assets: s.assets.map(a => a.id === id ? { ...a, ...updates } : a) }));
    try {
      await localUpdate('assets', id, updates);
      bgSync();
    } catch (err: any) {
      logger.error('[assets] updateAsset error:', err);
      set({ assets: prev });
    }
  },

  deleteAsset: async (id) => {
    const prev = get().assets;
    set(s => ({ assets: s.assets.filter(a => a.id !== id) }));
    try {
      await localDelete('assets', id);
      bgSync();
    } catch (err: any) {
      logger.error('[assets] deleteAsset error:', err);
      set({ assets: prev });
    }
  },

  toggleEquipped: async (id) => {
    const asset = get().assets.find(a => a.id === id);
    if (!asset) return;
    const newVal = !asset.is_equipped;
    const prev = get().assets;
    set(s => ({ assets: s.assets.map(a => a.id === id ? { ...a, is_equipped: newVal } : a) }));
    try {
      await localUpdate('assets', id, { is_equipped: newVal });
      bgSync();
    } catch (err: any) {
      logger.error('[assets] toggleEquipped error:', err);
      set({ assets: prev });
    }
  },

  // ── Maintenance CRUD ──

  addMaintenance: async (item) => {
    const userId = getEffectiveUserId();
    if (!item.asset_id) return null;

    const newItem = {
      id: genId(),
      user_id: userId,
      title: item.title || 'Maintenance',
      frequency: item.frequency || 'yearly',
      auto_schedule: false,
      auto_task: false,
      reminder_days_before: 7,
      is_completed: false,
      is_deleted: false,
      currency: 'AUD',
      created_at: new Date().toISOString(),
      ...item,
    };

    try {
      const created = await localInsert<AssetMaintenance>('asset_maintenance', newItem);
      set(s => ({ maintenance: [created, ...s.maintenance] }));
      bgSync();
      return created;
    } catch (err: any) {
      logger.error('[assets] addMaintenance error:', err);
      return null;
    }
  },

  updateMaintenance: async (id, updates) => {
    const prev = get().maintenance;
    set(s => ({ maintenance: s.maintenance.map(m => m.id === id ? { ...m, ...updates } : m) }));
    try {
      await localUpdate('asset_maintenance', id, updates);
      bgSync();
    } catch (err: any) {
      logger.error('[assets] updateMaintenance error:', err);
      set({ maintenance: prev });
    }
  },

  completeMaintenance: async (id) => {
    const item = get().maintenance.find(m => m.id === id);
    if (!item) return;

    const today = new Date().toISOString().split('T')[0];
    let nextDue: string | null = null;

    // Calculate next due date based on frequency
    if (item.frequency !== 'one_time') {
      const d = new Date();
      switch (item.frequency) {
        case 'weekly': d.setDate(d.getDate() + 7); break;
        case 'fortnightly': d.setDate(d.getDate() + 14); break;
        case 'monthly': d.setMonth(d.getMonth() + 1); break;
        case 'quarterly': d.setMonth(d.getMonth() + 3); break;
        case 'biannual': d.setMonth(d.getMonth() + 6); break;
        case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
      }
      nextDue = d.toISOString().split('T')[0];
    }

    const updates: Partial<AssetMaintenance> = {
      last_completed: today,
      is_completed: item.frequency === 'one_time',
      ...(nextDue ? { next_due: nextDue } : {}),
    };

    await get().updateMaintenance(id, updates);
  },

  deleteMaintenance: async (id) => {
    const prev = get().maintenance;
    set(s => ({ maintenance: s.maintenance.filter(m => m.id !== id) }));
    try {
      await localDelete('asset_maintenance', id);
      bgSync();
    } catch (err: any) {
      logger.error('[assets] deleteMaintenance error:', err);
      set({ maintenance: prev });
    }
  },

  // ── Bills CRUD ──

  addBill: async (bill) => {
    const userId = getEffectiveUserId();
    if (!bill.asset_id) return null;

    const newBill = {
      id: genId(),
      user_id: userId,
      provider: bill.provider || 'Unknown',
      category: bill.category || 'other',
      amount: bill.amount || 0,
      frequency: bill.frequency || 'monthly',
      auto_pay: false,
      is_deleted: false,
      currency: 'AUD',
      created_at: new Date().toISOString(),
      ...bill,
    };

    try {
      const created = await localInsert<AssetBill>('asset_bills', newBill);
      set(s => ({ bills: [created, ...s.bills] }));
      bgSync();
      return created;
    } catch (err: any) {
      logger.error('[assets] addBill error:', err);
      return null;
    }
  },

  updateBill: async (id, updates) => {
    const prev = get().bills;
    set(s => ({ bills: s.bills.map(b => b.id === id ? { ...b, ...updates } : b) }));
    try {
      await localUpdate('asset_bills', id, updates);
      bgSync();
    } catch (err: any) {
      logger.error('[assets] updateBill error:', err);
      set({ bills: prev });
    }
  },

  deleteBill: async (id) => {
    const prev = get().bills;
    set(s => ({ bills: s.bills.filter(b => b.id !== id) }));
    try {
      await localDelete('asset_bills', id);
      bgSync();
    } catch (err: any) {
      logger.error('[assets] deleteBill error:', err);
      set({ bills: prev });
    }
  },

  // ── Documents CRUD ──

  addDocument: async (doc) => {
    const userId = getEffectiveUserId();
    if (!doc.asset_id) return null;

    const newDoc = {
      id: genId(),
      user_id: userId,
      doc_type: doc.doc_type || 'other',
      title: doc.title || 'Untitled Document',
      reminder_days_before: 30,
      is_deleted: false,
      created_at: new Date().toISOString(),
      ...doc,
    };

    try {
      const created = await localInsert<AssetDocument>('asset_documents', newDoc);
      set(s => ({ documents: [created, ...s.documents] }));
      bgSync();
      return created;
    } catch (err: any) {
      logger.error('[assets] addDocument error:', err);
      return null;
    }
  },

  updateDocument: async (id, updates) => {
    const prev = get().documents;
    set(s => ({ documents: s.documents.map(d => d.id === id ? { ...d, ...updates } : d) }));
    try {
      await localUpdate('asset_documents', id, updates);
      bgSync();
    } catch (err: any) {
      logger.error('[assets] updateDocument error:', err);
      set({ documents: prev });
    }
  },

  deleteDocument: async (id) => {
    const prev = get().documents;
    set(s => ({ documents: s.documents.filter(d => d.id !== id) }));
    try {
      await localDelete('asset_documents', id);
      bgSync();
    } catch (err: any) {
      logger.error('[assets] deleteDocument error:', err);
      set({ documents: prev });
    }
  },

  // ── Computed Helpers ──

  getEquippedAssets: () => get().assets.filter(a => a.is_equipped && !a.is_archived),

  getAssetsByType: (type) => get().assets.filter(a => a.asset_type === type && !a.is_archived),

  getAssetWithDetails: (id) => {
    const asset = get().assets.find(a => a.id === id);
    if (!asset) return null;
    return {
      ...asset,
      maintenance: get().maintenance.filter(m => m.asset_id === id),
      bills: get().bills.filter(b => b.asset_id === id),
      documents: get().documents.filter(d => d.asset_id === id),
    };
  },

  getUpcomingMaintenance: (days = 14) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return get().maintenance.filter(m =>
      m.next_due && m.next_due <= cutoffStr && !m.is_completed
    );
  },

  getUpcomingBills: (days = 14) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return get().bills.filter(b => b.next_due && b.next_due <= cutoffStr);
  },

  getExpiringDocuments: (days = 60) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return get().documents.filter(d => d.expiry_date && d.expiry_date <= cutoffStr);
  },

  getMonthlyBillTotal: () => {
    const { bills } = get();
    let monthlyTotal = 0;
    for (const b of bills) {
      switch (b.frequency) {
        case 'weekly': monthlyTotal += b.amount * 4.33; break;
        case 'fortnightly': monthlyTotal += b.amount * 2.17; break;
        case 'monthly': monthlyTotal += b.amount; break;
        case 'quarterly': monthlyTotal += b.amount / 3; break;
        case 'biannual': monthlyTotal += b.amount / 6; break;
        case 'yearly': monthlyTotal += b.amount / 12; break;
        default: break;
      }
    }
    return Math.round(monthlyTotal * 100) / 100;
  },
}));
