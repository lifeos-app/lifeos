/**
 * Finance Store — Zustand
 *
 * Central store for income, expenses, bills, businesses, categories, transactions, budgets, clients.
 * Used by: Dashboard, Finances page, financial-engine, EventDrawer
 */

import { create } from 'zustand';
import { db as supabase } from '../lib/data-access';
import { isOnline } from '../lib/offline';
import { localGetAll, localInsert, localUpdate, localDelete, getEffectiveUserId } from '../lib/local-db';
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

      const [income, expenses, bills, clients, businesses, categories, transactions, budgets] = await Promise.all([
        localGetAll<IncomeEntry>('income'),
        localGetAll<ExpenseEntry>('expenses'),
        localGetAll<Bill>('bills'),
        localGetAll<Client>('clients'),
        localGetAll<Business>('businesses'),
        localGetAll<ExpenseCategory>('expense_categories'),
        localGetAll<Transaction>('transactions'),
        localGetAll<Budget>('budgets'),
      ]);

      // Filter and sort locally
      const filteredIncome = income
        .filter(i => !i.is_deleted && i.date >= sixStr)
        .sort((a, b) => b.date.localeCompare(a.date));

      const filteredExpenses = expenses
        .filter(e => !e.is_deleted && e.date >= sixStr)
        .sort((a, b) => b.date.localeCompare(a.date));

      const filteredBills = bills
        .filter(b => !b.is_deleted)
        .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

      const filteredClients = clients
        .filter(c => !c.is_deleted)
        .sort((a, b) => a.name.localeCompare(b.name));

      const filteredBusinesses = businesses.sort((a, b) => a.name.localeCompare(b.name));

      const filteredCategories = categories.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      const filteredTransactions = transactions
        .filter(t => t.date >= sixStr)
        .sort((a, b) => b.date.localeCompare(a.date));

      const filteredBudgets = budgets.filter(b => b.month === thisMonth());

      set({
        income: filteredIncome,
        expenses: filteredExpenses,
        bills: filteredBills,
        clients: filteredClients,
        businesses: filteredBusinesses,
        categories: filteredCategories,
        transactions: filteredTransactions,
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
      const incomeId = genId();
      const txId = genId();
      const userId = getEffectiveUserId();
      const now = new Date().toISOString();
      const date = data.date || now.split('T')[0];

      // Create income record
      const newRecord = await localInsert<IncomeEntry>('income', {
        id: incomeId,
        user_id: userId,
        amount: data.amount || 0,
        date,
        is_deleted: false,
        is_recurring: false,
        created_at: now,
        ...data,
      });

      // Create matching transaction record (single source of truth for computed values)
      const txRecord = await localInsert<Transaction>('transactions', {
        id: txId,
        user_id: userId,
        type: 'income',
        amount: data.amount || 0,
        title: (data as Record<string, unknown>).description as string || (data as Record<string, unknown>).source as string || 'Income',
        date,
        business_id: (data as Record<string, unknown>).business_id as string || null,
        client_id: data.client_id || null,
        recurring: data.is_recurring || false,
        notes: null,
        created_at: now,
        updated_at: now,
      });

      set(s => ({
        income: [newRecord, ...s.income],
        transactions: [txRecord, ...s.transactions],
      }));
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
      return newRecord;
    } catch (err) {
      logger.error('[finance] addIncome error:', err);
      return null;
    }
  },

  updateIncome: async (id, updates) => {
    const prev = get().income;
    set(s => ({ income: s.income.map(i => i.id === id ? { ...i, ...updates } : i) }));
    try {
      await localUpdate('income', id, updates);
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
    } catch (err) {
      logger.error('[finance] updateIncome error:', err);
      set({ income: prev });
    }
  },

  deleteIncome: async (id) => {
    const prev = get().income;
    const prevTx = get().transactions;
    // Find the corresponding transaction (matching date, amount, type=income)
    const incomeRecord = prev.find(i => i.id === id);
    const matchingTx = incomeRecord
      ? prevTx.find(t => t.type === 'income' && t.amount === incomeRecord.amount && t.date === incomeRecord.date && t.title === (incomeRecord.description || incomeRecord.source))
      : null;
    set(s => ({
      income: s.income.filter(i => i.id !== id),
      transactions: matchingTx ? s.transactions.filter(t => t.id !== matchingTx.id) : s.transactions,
    }));
    try {
      await localDelete('income', id);
      if (matchingTx) await localDelete('transactions', matchingTx.id);
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
    } catch (err) {
      logger.error('[finance] deleteIncome error:', err);
      set({ income: prev, transactions: prevTx });
    }
  },

  addExpense: async (data) => {
    try {
      const expenseId = genId();
      const txId = genId();
      const userId = getEffectiveUserId();
      const now = new Date().toISOString();
      const date = data.date || now.split('T')[0];

      // Create expense record
      const newRecord = await localInsert<ExpenseEntry>('expenses', {
        id: expenseId,
        user_id: userId,
        amount: data.amount || 0,
        date,
        is_deleted: false,
        is_recurring: false,
        created_at: now,
        ...data,
      });

      // Create matching transaction record (single source of truth for computed values)
      const txRecord = await localInsert<Transaction>('transactions', {
        id: txId,
        user_id: userId,
        type: 'expense',
        amount: data.amount || 0,
        title: (data as Record<string, unknown>).description as string || 'Expense',
        date,
        category_id: (data as Record<string, unknown>).category_id as string || null,
        business_id: (data as Record<string, unknown>).business_id as string || null,
        recurring: data.is_recurring || false,
        notes: null,
        created_at: now,
        updated_at: now,
      });

      set(s => ({
        expenses: [newRecord, ...s.expenses],
        transactions: [txRecord, ...s.transactions],
      }));
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
      return newRecord;
    } catch (err) {
      logger.error('[finance] addExpense error:', err);
      return null;
    }
  },

  updateExpense: async (id, updates) => {
    const prev = get().expenses;
    set(s => ({ expenses: s.expenses.map(e => e.id === id ? { ...e, ...updates } : e) }));
    try {
      await localUpdate('expenses', id, updates);
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
    } catch (err) {
      logger.error('[finance] updateExpense error:', err);
      set({ expenses: prev });
    }
  },

  deleteExpense: async (id) => {
    const prev = get().expenses;
    const prevTx = get().transactions;
    // Find the corresponding transaction (matching date, amount, type=expense)
    const expenseRecord = prev.find(e => e.id === id);
    const matchingTx = expenseRecord
      ? prevTx.find(t => t.type === 'expense' && t.amount === expenseRecord.amount && t.date === expenseRecord.date && t.title === expenseRecord.description)
      : null;
    set(s => ({
      expenses: s.expenses.filter(e => e.id !== id),
      transactions: matchingTx ? s.transactions.filter(t => t.id !== matchingTx.id) : s.transactions,
    }));
    try {
      await localDelete('expenses', id);
      if (matchingTx) await localDelete('transactions', matchingTx.id);
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
    } catch (err) {
      logger.error('[finance] deleteExpense error:', err);
      set({ expenses: prev, transactions: prevTx });
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
      if (isOnline()) syncNow(useUserStore.getState().user?.id).catch(e => logger.warn('[finance] sync failed:', e));
    } catch (err) {
      logger.error('[finance] softDeleteRow error:', err);
    }
  },

  // BUG-014: Use transactions table as canonical source to avoid double-counting
  monthIncome: () => {
    const som = new Date();
    som.setDate(1);
    const somStr = som.toISOString().split('T')[0];
    return get().transactions.filter(t => t.type === 'income' && t.date >= somStr).reduce((s, t) => s + t.amount, 0);
  },

  monthExpenses: () => {
    const som = new Date();
    som.setDate(1);
    const somStr = som.toISOString().split('T')[0];
    return get().transactions.filter(t => t.type === 'expense' && t.date >= somStr).reduce((s, t) => s + t.amount, 0);
  },

  netCashflow: () => {
    return get().monthIncome() - get().monthExpenses();
  },
}));
