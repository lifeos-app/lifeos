/**
 * Journal Store — Zustand
 *
 * Central store for journal entries.
 * Used by: Dashboard, Journal page, Review
 */

import { create } from 'zustand';
import { db as supabase } from '../lib/data-access';
import { isOnline } from '../lib/offline';
import { localGetAll, localInsert, localUpdate, localDelete, getEffectiveUserId } from '../lib/local-db';
import { syncNow } from '../lib/sync-engine';
import { useUserStore } from './useUserStore';
import type { JournalEntry as DBJournalEntry } from '../types/database';
import { logger } from '../utils/logger';
import { genId } from '../utils/date';
import { normalizeTags } from '../components/journal/helpers';
import { logAuditEntry } from '../lib/audit-logger';

/**
 * Store-specific JournalEntry extends DB type with additional fields
 */
export interface JournalEntry extends DBJournalEntry {
  title: string;
  content: string;
  sync_status: string;
}

interface JournalState {
  entries: JournalEntry[];
  entryDates: Set<string>;
  entryCount: number;
  loading: boolean;
  lastFetched: number | null;

  fetchRecent: (limit?: number, options?: { skipSync?: boolean }) => Promise<void>;
  invalidate: () => void;

  // Write operations
  addEntry: (data: Partial<JournalEntry>) => Promise<JournalEntry | null>;
  updateEntry: (id: string, updates: Partial<JournalEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;

  // Selectors
  getEntryForDate: (date: string) => JournalEntry | null;
}

const STALE_MS = 2 * 60 * 1000;

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  entryDates: new Set<string>(),
  entryCount: 0,
  loading: false,
  lastFetched: null,

  fetchRecent: async (limit = 50, options?: { skipSync?: boolean }) => {
    const { lastFetched, loading } = get();
    if (loading) return;
    if (lastFetched && Date.now() - lastFetched < STALE_MS) return;

    set({ loading: true });

    try {
      // ALWAYS load from local DB first
      const allEntries = await localGetAll<JournalEntry>('journal_entries');
      
      // Normalize tags from legacy comma-separated strings to string arrays
      // This ensures backward compatibility with existing data
      const normalizedEntries = allEntries.map(e => ({
        ...e,
        tags: normalizeTags(e.tags),
      }));

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixStr = sixMonthsAgo.toISOString().split('T')[0];

      const filteredEntries = normalizedEntries
        .filter(e => !e.is_deleted)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit);

      const entryCount = normalizedEntries.filter(e => !e.is_deleted).length;
      
      const recentDates = allEntries
        .filter(e => !e.is_deleted && e.date >= sixStr)
        .map(e => e.date);

      set({
        entries: filteredEntries,
        entryCount,
        entryDates: new Set(recentDates),
        loading: false,
        lastFetched: Date.now(),
      });

      // Background sync if online + authenticated
      if (!options?.skipSync && isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[journal] sync failed:', e));
        }
      }
    } catch (err) {
      logger.error('[journal] Failed to load from local DB:', err);
      set({ loading: false });
    }
  },

  invalidate: () => {
    set({ lastFetched: null });
    get().fetchRecent();
  },

  // ── Write Operations ──

  addEntry: async (data) => {
    try {
      const newEntry = await localInsert<JournalEntry>('journal_entries', {
        id: genId(),
        user_id: getEffectiveUserId(),
        date: data.date || new Date().toISOString().split('T')[0],
        title: data.title || '',
        content: data.content || '',
        is_deleted: false,
        sync_status: 'pending',
        created_at: new Date().toISOString(),
        ...data,
      });
      set(s => ({ 
        entries: [newEntry, ...s.entries],
        entryCount: s.entryCount + 1,
        entryDates: new Set([...s.entryDates, newEntry.date]),
      }));
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[journal] sync failed:', e));
      // Audit log
      try { logAuditEntry({ userId: getEffectiveUserId() || '', action: 'INSERT', tableName: 'journal_entries', recordId: newEntry.id, newData: newEntry as any }); } catch {}
      return newEntry;
    } catch (err) {
      logger.error('[journal] addEntry error:', err);
      return null;
    }
  },

  updateEntry: async (id, updates) => {
    const prev = get().entries;
    const oldEntry = prev.find(e => e.id === id);
    set(s => ({ entries: s.entries.map(e => e.id === id ? { ...e, ...updates } : e) }));
    try {
      await localUpdate('journal_entries', id, updates);
      // Audit log
      try { logAuditEntry({ userId: getEffectiveUserId() || '', action: 'UPDATE', tableName: 'journal_entries', recordId: id, oldData: oldEntry as any, newData: updates as any }); } catch {}
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[journal] sync failed:', e));
    } catch (err) {
      logger.error('[journal] updateEntry error:', err);
      set({ entries: prev });
    }
  },

  deleteEntry: async (id) => {
    const prev = get().entries;
    const entry = prev.find(e => e.id === id);
    set(s => ({ 
      entries: s.entries.filter(e => e.id !== id),
      entryCount: Math.max(0, s.entryCount - 1),
      entryDates: new Set(s.entries.filter(e => e.id !== id).map(e => e.date)),
    }));
    try {
      await localDelete('journal_entries', id);
      // Audit log
      try { logAuditEntry({ userId: getEffectiveUserId() || '', action: 'DELETE', tableName: 'journal_entries', recordId: id, oldData: entry as any }); } catch {}
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[journal] sync failed:', e));
    } catch (err) {
      logger.error('[journal] deleteEntry error:', err);
      set({ entries: prev, entryCount: prev.length });
      if (entry) set(s => ({ entryDates: new Set([...s.entryDates, entry.date]) }));
    }
  },

  getEntryForDate: (date) => {
    return get().entries.find(e => e.date === date) || null;
  },
}));
