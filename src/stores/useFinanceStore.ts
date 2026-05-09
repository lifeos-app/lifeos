/**
 * Finance Store — Zustand
 *
 * Central store for income, expenses, bills, businesses, categories, transactions, budgets, clients.
 * Used by: Dashboard, Finances page, financial-engine, EventDrawer
 *
 * P2-102: Unified transactions table.
 * - `transactions` (IndexedDB) is now the PRIMARY store for all financial records.
 * - `addIncome()` / `addExpense()` write a `TransactionEntry` to `transactions` with
 *   `transaction_type`, and ALSO write to the legacy `income`/`expenses` tables for
 *   backward-compat with Supabase sync.
 * - `income` and `expenses` state arrays are DERIVED from `transactionEntries` for display.
 *   A fallback reads from the legacy `income`/`expenses` local stores for migration.
 */

import { create } from 'zustand';
import { db as supabase } from '../lib/data-access';
import { isOnline } from '../lib/offline';
import { localGetAll, localInsert, localUpdate, localDelete, localQuery, getEffectiveUserId } from '../lib/local-db';
import { syncNow, waitForInitialSync } from '../lib/sync-engine';
import { useUserStore } from './useUserStore';
import { logger } from '../utils/logger';
import { genId } from '../utils/date';
import type {
  Transaction,
  Bill,
  Business,
  IncomeEntry,
  ExpenseEntry,
  Client,
  ExpenseCategory,
  Budget,
} from '../types/database';
import type { TransactionEntry } from '../components/finances/types';
import { transactionToIncome, transactionToExpense } from '../components/finances/types';

export type { IncomeEntry, ExpenseEntry, Client, ExpenseCategory, Budget, Bill, Business, Transaction };

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface FinanceState {
  income: IncomeEntry[];
  expenses: ExpenseEntry[];
  bills: Bill[];
  businesses: Business[];
  clients: Client[];
  categories: ExpenseCategory[];
  transactions: Transaction[];
  transactionEntries: TransactionEntry[];
  budgets: Budget[];
  loading: boolean;
  lastFetched: number | null;
  isOffline: boolean;

  fetchAll: (options?: { skipSync?: boolean }) => Promise<void>;
  invalidate: () => void;

  // CRUD actions
  addIncome: (data: Partial<IncomeEntry>) => Promise<IncomeEntry | null>;
  updateIncome: (id: string, updates: Partial<IncomeEntry>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  addExpense: (data: Partial<ExpenseEntry>) => Promise<ExpenseEntry | null>;
  updateExpense: (id: string, updates: Partial<ExpenseEntry>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addBill: (data: Partial<Bill>) => Promise<Bill | null>;
  updateBill: (id: string, updates: Partial<Bill>) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  saveBudget: (categoryId: string, amount: number) => Promise<void>;
  updateBusiness: (id: string, updates: Partial<Business>) => Promise<void>;
  deleteBusiness: (id: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  softDeleteRow: (table: string, id: string) => Promise<void>;

  // Computed
  monthIncome: () => number;
  monthExpenses: () => number;
  netCashflow: () => number;
}

const STALE_MS = 2 * 60 * 1000;

export const useFinanceStore = create<FinanceState>((set, get) => ({
  income: [],
  expenses: [],
  bills: [],
  businesses: [],
  clients: [],
  categories: [],
  transactions: [],
  transactionEntries: [],
  budgets: [],
  loading: false,
  lastFetched: null,
  isOffline: false,

  fetchAll: async (options?: { skipSync?: boolean }) => {
    const { lastFetched, loading } = get();
    if (loading) return;
    if (lastFetched && Date.now() - lastFetched < STALE_MS) return;

    set({ loading: true });

    try {
      // Wait for initial post-login sync before reading local DB
      await waitForInitialSync();

      // Load from local DB (now populated by sync)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixStr = sixMonthsAgo.toISOString().split('T')[0];

      const [allTransactions, legacyIncome, legacyExpenses, bills, clients, businesses, categories, budgets] = await Promise.all([
        localGetAll<TransactionEntry>('transactions'),
        localGetAll<IncomeEntry>('income'),
        localGetAll<ExpenseEntry>('expenses'),
        localGetAll<Bill>('bills'),
        localGetAll<Client>('clients'),
        localGetAll<Business>('businesses'),
        localGetAll<ExpenseCategory>('expense_categories'),
        localGetAll<Budget>('budgets'),
      ]);

      // ── Unified transactions: derive income and expenses from TransactionEntry records ──
      // Filter out soft-deleted, apply date filter
      const filteredTxEntries = allTransactions
        .filter(t => !t.is_deleted && t.date >= sixStr)
        .sort((a, b) => b.date.localeCompare(a.date));

      // Derive income/expense arrays from unified transactions
      const derivedIncome: IncomeEntry[] = filteredTxEntries
        .filter(t => t.transaction_type === 'income')
        .map(transactionToIncome);

      const derivedExpenses: ExpenseEntry[] = filteredTxEntries
        .filter(t => t.transaction_type === 'expense')
        .map(transactionToExpense);

      // ── Migration fallback: if transactionEntries are sparse, supplement
      //    with legacy income/expenses data that doesn't have a corresponding
      //    transaction entry yet (pre-P2-102 data) ──
      const txIncomeIds = new Set(derivedIncome.map(i => i.id));
      const txExpenseIds = new Set(derivedExpenses.map(e => e.id));

      const filteredLegacyIncome = legacyIncome
        .filter(i => !i.is_deleted && i.date >= sixStr)
        .sort((a, b) => b.date.localeCompare(a.date));

      const filteredLegacyExpenses = legacyExpenses
        .filter(e => !e.is_deleted && e.date >= sixStr)
        .sort((a, b) => b.date.localeCompare(a.date));

      // Merge: use unified as primary, add legacy records that aren't yet in transactions
      const mergedIncome = [
        ...derivedIncome,
        ...filteredLegacyIncome.filter(i => !txIncomeIds.has(i.id)),
      ].sort((a, b) => b.date.localeCompare(a.date));

      const mergedExpenses = [
        ...derivedExpenses,
        ...filteredLegacyExpenses.filter(e => !txExpenseIds.has(e.id)),
      ].sort((a, b) => b.date.localeCompare(a.date));

      // Legacy `transactions` array (type: 'income' | 'expense') — keep for backward compat
      const filteredTransactions = allTransactions
        .filter(t => !t.is_deleted && t.date >= sixStr)
        .map(t => ({
          id: t.id,
          user_id: t.user_id,
          type: t.transaction_type,
          amount: t.amount,
          title: t.title || t.description || '',
          date: t.date,
          category_id: t.category_id ?? null,
          business_id: t.business_id ?? null,
          client_id: t.client_id ?? null,
          recurring: t.is_recurring ?? false,
          notes: t.notes ?? null,
          created_at: t.created_at || '',
          updated_at: t.updated_at ?? undefined,
        } as Transaction))
        .sort((a, b) => b.date.localeCompare(a.date));

      const filteredBills = bills
        .filter(b => !b.is_deleted)
        .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

      const filteredClients = clients
        .filter(c => !c.is_deleted)
        .sort((a, b) => a.name.localeCompare(b.name));

      const filteredBusinesses = businesses.sort((a, b) => a.name.localeCompare(b.name));

      const filteredCategories = categories.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      const filteredBudgets = budgets.filter(b => b.month === thisMonth());

      set({
        income: mergedIncome,
        expenses: mergedExpenses,
        bills: filteredBills,
        clients: filteredClients,
        businesses: filteredBusinesses,
        categories: filteredCategories,
        transactions: filteredTransactions,
        transactionEntries: filteredTxEntries,
        budgets: filteredBudgets,
        loading: false,
        lastFetched: Date.now(),
        isOffline: !isOnline(),
      });

      // Background sync if online + authenticated
      if (!options?.skipSync && isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(() => {});
        }
      }
    } catch (err) {
      logger.error('[finance] Failed to load from local DB:', err);
      set({ loading: false, isOffline: true });
    }
  },

  invalidate: () => {
    set({ lastFetched: null });
    get().fetchAll();
  },

  // ── CRUD Actions ──

  addIncome: async (data) => {
    try {
      const id = genId();
      const userId = getEffectiveUserId();
      const now = new Date().toISOString();
      const date = data.date || now.split('T')[0];

      // ── Write unified TransactionEntry (PRIMARY) ──
      const txEntry = await localInsert<TransactionEntry>('transactions', {
        id,
        user_id: userId,
        transaction_type: 'income',
        amount: data.amount || 0,
        title: (data as Record<string, unknown>).description as string || (data as Record<string, unknown>).source as string || 'Income',
        description: (data as Record<string, unknown>).description as string || (data as Record<string, unknown>).source as string || null,
        source: (data as Record<string, unknown>).source as string || null,
        date,
        category_id: null,
        business_id: (data as Record<string, unknown>).business_id as string || null,
        client_id: data.client_id || null,
        is_recurring: data.is_recurring || false,
        recurrence_rule: (data as Record<string, unknown>).recurrence_rule as string || null,
        is_deleted: false,
        notes: null,
        created_at: now,
        updated_at: now,
      });

      // ── Also write to legacy income table for Supabase sync ──
      const legacyRecord = await localInsert<IncomeEntry>('income', {
        id: id, // Same ID so we can correlate
        user_id: userId,
        amount: data.amount || 0,
        date,
        is_deleted: false,
        is_recurring: false,
        created_at: now,
        ...data,
      });

      // Legacy Transaction record for backward compat
      const legacyTx: Transaction = {
        id: id,
        user_id: userId,
        type: 'income',
        amount: data.amount || 0,
        title: (data as Record<string, unknown>).description as string || (data as Record<string, unknown>).source as string || 'Income',
        date,
        category_id: null,
        business_id: (data as Record<string, unknown>).business_id as string || null,
        client_id: data.client_id || null,
        recurring: data.is_recurring || false,
        notes: null,
        created_at: now,
        updated_at: now,
      };

      set(s => ({
        income: [legacyRecord, ...s.income],
        transactions: [legacyTx, ...s.transactions],
        transactionEntries: [txEntry, ...s.transactionEntries],
      }));
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
      return legacyRecord;
    } catch (err) {
      logger.error('[finance] addIncome error:', err);
      return null;
    }
  },

  updateIncome: async (id, updates) => {
    const prev = get().income;
    const prevTx = get().transactionEntries;
    set(s => ({ income: s.income.map(i => i.id === id ? { ...i, ...updates } : i) }));
    set(s => ({
      transactionEntries: s.transactionEntries.map(t =>
        t.id === id ? { ...t, ...updates, transaction_type: 'income' as const } : t
      ),
    }));
    try {
      // Update both tables
      await localUpdate('income', id, updates);
      await localUpdate('transactions', id, { ...updates, transaction_type: 'income' });
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
    } catch (err) {
      logger.error('[finance] updateIncome error:', err);
      set({ income: prev, transactionEntries: prevTx });
    }
  },

  deleteIncome: async (id) => {
    const prev = get().income;
    const prevTx = get().transactionEntries;
    set(s => ({
      income: s.income.filter(i => i.id !== id),
      transactions: s.transactions.filter(t => t.id !== id),
      transactionEntries: s.transactionEntries.filter(t => t.id !== id),
    }));
    try {
      await localDelete('income', id);
      await localDelete('transactions', id);
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
    } catch (err) {
      logger.error('[finance] deleteIncome error:', err);
      set({ income: prev, transactionEntries: prevTx });
    }
  },

  addExpense: async (data) => {
    try {
      const id = genId();
      const userId = getEffectiveUserId();
      const now = new Date().toISOString();
      const date = data.date || now.split('T')[0];

      // ── Write unified TransactionEntry (PRIMARY) ──
      const txEntry = await localInsert<TransactionEntry>('transactions', {
        id,
        user_id: userId,
        transaction_type: 'expense',
        amount: data.amount || 0,
        title: (data as Record<string, unknown>).description as string || 'Expense',
        description: data.description || null,
        source: null,
        date,
        category_id: data.category_id || null,
        business_id: (data as Record<string, unknown>).business_id as string || null,
        client_id: null,
        is_recurring: data.is_recurring || false,
        is_deductible: data.is_deductible,
        travel_km: (data as Record<string, unknown>).travel_km as number || null,
        receipt_url: data.receipt_url || null,
        payment_method: data.payment_method || null,
        is_deleted: false,
        notes: null,
        created_at: now,
        updated_at: now,
      });

      // ── Also write to legacy expenses table for Supabase sync ──
      const legacyRecord = await localInsert<ExpenseEntry>('expenses', {
        id, // Same ID so we can correlate
        user_id: userId,
        amount: data.amount || 0,
        date,
        is_deleted: false,
        is_recurring: false,
        created_at: now,
        ...data,
      });

      // Legacy Transaction record for backward compat
      const legacyTx: Transaction = {
        id: id,
        user_id: userId,
        type: 'expense',
        amount: data.amount || 0,
        title: data.description || 'Expense',
        date,
        category_id: data.category_id || null,
        business_id: (data as Record<string, unknown>).business_id as string || null,
        recurring: data.is_recurring || false,
        notes: null,
        created_at: now,
        updated_at: now,
      };

      set(s => ({
        expenses: [legacyRecord, ...s.expenses],
        transactions: [legacyTx, ...s.transactions],
        transactionEntries: [txEntry, ...s.transactionEntries],
      }));
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
      return legacyRecord;
    } catch (err) {
      logger.error('[finance] addExpense error:', err);
      return null;
    }
  },

  updateExpense: async (id, updates) => {
    const prev = get().expenses;
    const prevTx = get().transactionEntries;
    set(s => ({ expenses: s.expenses.map(e => e.id === id ? { ...e, ...updates } : e) }));
    set(s => ({
      transactionEntries: s.transactionEntries.map(t =>
        t.id === id ? { ...t, ...updates, transaction_type: 'expense' as const } : t
      ),
    }));
    try {
      await localUpdate('expenses', id, updates);
      await localUpdate('transactions', id, { ...updates, transaction_type: 'expense' });
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
    } catch (err) {
      logger.error('[finance] updateExpense error:', err);
      set({ expenses: prev, transactionEntries: prevTx });
    }
  },

  deleteExpense: async (id) => {
    const prev = get().expenses;
    const prevTx = get().transactionEntries;
    set(s => ({
      expenses: s.expenses.filter(e => e.id !== id),
      transactions: s.transactions.filter(t => t.id !== id),
      transactionEntries: s.transactionEntries.filter(t => t.id !== id),
    }));
    try {
      await localDelete('expenses', id);
      await localDelete('transactions', id);
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
    } catch (err) {
      logger.error('[finance] deleteExpense error:', err);
      set({ expenses: prev, transactionEntries: prevTx });
    }
  },

  addBill: async (data) => {
    try {
      const newRecord = await localInsert<Bill>('bills', {
        id: genId(),
        user_id: getEffectiveUserId(),
        is_deleted: false,
        created_at: new Date().toISOString(),
        ...data,
      });
      set(s => ({ bills: [newRecord, ...s.bills] }));
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
      return newRecord;
    } catch (err) {
      logger.error('[finance] addBill error:', err);
      return null;
    }
  },

  updateBill: async (id, updates) => {
    const prev = get().bills;
    set(s => ({ bills: s.bills.map(b => b.id === id ? { ...b, ...updates } : b) }));
    try {
      await localUpdate('bills', id, updates);
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
    } catch (err) {
      logger.error('[finance] updateBill error:', err);
      set({ bills: prev });
    }
  },

  deleteBill: async (id) => {
    const prev = get().bills;
    set(s => ({ bills: s.bills.filter(b => b.id !== id) }));
    try {
      await localDelete('bills', id);
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
    } catch (err) {
      logger.error('[finance] deleteBill error:', err);
      set({ bills: prev });
    }
  },

  saveBudget: async (categoryId, amount) => {
    const existing = get().budgets.find(b => b.category_id === categoryId);
    if (existing?.id) {
      await localUpdate('budgets', existing.id, { amount });
      set(s => ({ budgets: s.budgets.map(b => b.id === existing.id ? { ...b, amount } : b) }));
    } else {
      const newBudget = await localInsert<Budget>('budgets', {
        id: genId(),
        user_id: getEffectiveUserId(),
        category_id: categoryId,
        month: thisMonth(),
        amount,
      });
      set(s => ({ budgets: [...s.budgets, newBudget] }));
    }
    if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
  },

  updateBusiness: async (id, updates) => {
    const prev = get().businesses;
    set(s => ({ businesses: s.businesses.map(b => b.id === id ? { ...b, ...updates } : b) }));
    try {
      await localUpdate('businesses', id, updates);
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
    } catch (err) {
      logger.error('[finance] updateBusiness error:', err);
      set({ businesses: prev });
    }
  },

  deleteBusiness: async (id) => {
    const prev = get().businesses;
    set(s => ({ businesses: s.businesses.filter(b => b.id !== id) }));
    try {
      await localDelete('businesses', id);
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
    } catch (err) {
      logger.error('[finance] deleteBusiness error:', err);
      set({ businesses: prev });
    }
  },

  deleteCategory: async (id) => {
    const prev = get().categories;
    set(s => ({ categories: s.categories.filter(c => c.id !== id) }));
    try {
      await localDelete('expense_categories', id);
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
    } catch (err) {
      logger.error('[finance] deleteCategory error:', err);
      set({ categories: prev });
    }
  },

  softDeleteRow: async (table, id) => {
    try {
      await localUpdate(table as any, id, { is_deleted: true });
      // Remove from local state arrays
      const stateMaps: Record<string, keyof FinanceState> = {
        income: 'income',
        expenses: 'expenses',
        bills: 'bills',
        businesses: 'businesses',
        transactions: 'transactions',
      };
      const key = stateMaps[table];
      if (key) {
        set(s => ({
          [key]: ((s as any)[key] as any[]).filter((r: any) => r.id !== id),
        } as any));
      }
      // Also remove from transactionEntries if it's a financial record
      if (table === 'income' || table === 'expenses' || table === 'transactions') {
        set(s => ({
          transactionEntries: s.transactionEntries.filter(t => t.id !== id),
        }));
      }
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
    } catch (err) {
      logger.error('[finance] softDeleteRow error:', err);
    }
  },

  // Use transactionEntries (unified) as canonical source for computed values
  monthIncome: () => {
    const som = new Date();
    som.setDate(1);
    const somStr = som.toISOString().split('T')[0];
    // Prefer transactionEntries for accuracy, fall back to transactions
    const { transactionEntries, transactions } = get();
    if (transactionEntries.length > 0) {
      return transactionEntries
        .filter(t => t.transaction_type === 'income' && t.date >= somStr && !t.is_deleted)
        .reduce((s, t) => s + t.amount, 0);
    }
    return transactions.filter(t => t.type === 'income' && t.date >= somStr).reduce((s, t) => s + t.amount, 0);
  },

  monthExpenses: () => {
    const som = new Date();
    som.setDate(1);
    const somStr = som.toISOString().split('T')[0];
    const { transactionEntries, transactions } = get();
    if (transactionEntries.length > 0) {
      return transactionEntries
        .filter(t => t.transaction_type === 'expense' && t.date >= somStr && !t.is_deleted)
        .reduce((s, t) => s + t.amount, 0);
    }
    return transactions.filter(t => t.type === 'expense' && t.date >= somStr).reduce((s, t) => s + t.amount, 0);
  },

  netCashflow: () => {
    return get().monthIncome() - get().monthExpenses();
  },
}));