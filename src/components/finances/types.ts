/**
 * Shared types and helpers for Finance sub-components.
 */
import type {
  IncomeEntry as DBIncomeEntry,
  ExpenseEntry as DBExpenseEntry,
  Client as DBClient,
  Bill as DBBill,
  ExpenseCategory as DBExpenseCategory,
} from '../../types/database';

import {
  genId as _genId,
  todayStr,
  thisMonth as _thisMonth,
  formatDateShort,
  fmtCurrency as _fmtCurrency,
  fmtCurrencyShort,
} from '../../utils/date';

export type Tab = 'overview' | 'income' | 'expenses' | 'bills' | 'work' | 'analysis' | 'personal';
export type FormMode = null | 'income' | 'expense' | 'bill' | 'business' | 'client' | 'category';

export const CHART_COLORS = ['#00D4FF', '#39FF14', '#F97316', '#A855F7', '#F43F5E', '#FBBF24', '#38BDF8', '#E879F9', '#FB923C', '#4ADE80'];

// Re-export shared utils for backward compat
export const genId = _genId;
export const today = todayStr;
export const fmtCurrency = _fmtCurrency;
export const fmtShort = fmtCurrencyShort;
export const fmtDate = formatDateShort;
export const thisMonth = _thisMonth;
export function isOverdue(d: string, s: string) { return s !== 'paid' && d < todayStr(); }

export function normalizeToMonthly(amount: number, rule: string): number {
  switch (rule) {
    case 'weekly': return amount * 52 / 12;
    case 'fortnightly': return amount * 26 / 12;
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    case 'yearly': return amount / 12;
    default: return amount;
  }
}
export function colorForIndex(i: number) { return CHART_COLORS[i % CHART_COLORS.length]; }

// ── Finance domain types (extend base types with page-level fields) ──
export interface IncomeEntry extends DBIncomeEntry {
  business_id?: string | null;
  is_deductible?: boolean;
  recurrence_rule?: string | null;
  invoice_ref?: string | null;
  payment_method?: string | null;
  gst_included?: boolean;
  [key: string]: unknown;
}

export interface ExpenseEntry extends DBExpenseEntry {
  business_id?: string | null;
  is_recurring?: boolean;
  recurrence_rule?: string | null;
  km_driven?: number | null;
  odometer_reading?: number | null;
  is_travel?: boolean;
  receipt_url?: string | null;
  payment_method?: string | null;
  gst_included?: boolean;
  goal_id?: string | null;
  [key: string]: unknown;
}

export interface Bill extends DBBill {
  [key: string]: unknown;
}

export interface Business {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
  status: string;
  notes: string | null;
  industry: string | null;
  abn: string | null;
  revenue_target: number | null;
  budget: number | null;
  objective_id: string | null;
  start_date: string | null;
  website: string | null;
  [key: string]: unknown;
}

export interface Client extends DBClient {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  sop?: string | null;
  access_info?: string | null;
  [key: string]: unknown;
}

export interface ExpenseCategory extends DBExpenseCategory {
  scope: 'personal' | 'business';
  [key: string]: unknown;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  date: string;
  description: string | null;
  type: 'income' | 'expense';
  category_id: string | null;
  title?: string;
  notes?: string;
  business_id?: string;
  client_id?: string;
  recurring?: boolean;
  [key: string]: unknown;
}

/**
 * TransactionEntry — Unified financial record type (P2-102).
 * The primary type for reading/writing to the `transactions` local DB store.
 * Mirrors the TransactionEntry from database.ts but with index signature for flexibility.
 */
export interface TransactionEntry {
  id: string;
  user_id: string;
  transaction_type: 'income' | 'expense';
  amount: number;
  date: string;
  title?: string | null;
  description?: string | null;
  source?: string | null;
  category_id?: string | null;
  business_id?: string | null;
  client_id?: string | null;
  task_id?: string | null;
  event_id?: string | null;
  notes?: string | null;
  is_recurring?: boolean;
  is_deleted?: boolean;
  is_deductible?: boolean;
  recurrence_rule?: string | null;
  travel_km?: number | null;
  payment_method?: string | null;
  receipt_url?: string | null;
  sync_status?: string | null;
  gst_included?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Helper: Convert a TransactionEntry to an IncomeEntry-compatible shape */
export function transactionToIncome(tx: TransactionEntry): IncomeEntry {
  return {
    id: tx.id,
    user_id: tx.user_id,
    amount: tx.amount,
    date: tx.date,
    description: tx.description || tx.title || '',
    source: tx.source || 'Other',
    client_id: tx.client_id ?? null,
    is_recurring: tx.is_recurring ?? false,
    is_deleted: tx.is_deleted ?? false,
    business_id: tx.business_id ?? null,
    created_at: tx.created_at,
    ...(tx as Record<string, unknown>),
  } as IncomeEntry;
}

/** Helper: Convert a TransactionEntry to an ExpenseEntry-compatible shape */
export function transactionToExpense(tx: TransactionEntry): ExpenseEntry {
  return {
    id: tx.id,
    user_id: tx.user_id,
    amount: tx.amount,
    description: tx.description || tx.title || '',
    category_id: tx.category_id ?? null,
    date: tx.date,
    is_deductible: tx.is_deductible ?? false,
    is_deleted: tx.is_deleted ?? false,
    is_recurring: tx.is_recurring ?? false,
    travel_km: tx.travel_km ?? null,
    receipt_url: tx.receipt_url ?? null,
    payment_method: tx.payment_method ?? null,
    business_id: tx.business_id ?? null,
    created_at: tx.created_at,
    updated_at: tx.updated_at,
    ...(tx as Record<string, unknown>),
  } as ExpenseEntry;
}

export interface FinanceGoal {
  id: string;
  title: string;
  parent_goal_id: string | null;
  type?: string;
  financial_type: string | null;
  budget_allocated: number;
  progress: number;
  [key: string]: unknown;
}

export interface FinanceTask {
  id: string;
  title: string;
  status: string;
  financial_amount: number | null;
  goal_id: string | null;
  [key: string]: unknown;
}

/** Shared finance data bag passed to tab components */
export interface FinanceData {
  income: IncomeEntry[];
  expenses: ExpenseEntry[];
  bills: Bill[];
  clients: Client[];
  businesses: Business[];
  categories: ExpenseCategory[];
  transactions: Transaction[];
  transactionEntries: TransactionEntry[];
  budgets: { month: string; category_id: string; amount: number }[];
  tasks: FinanceTask[];
  goals: FinanceGoal[];
  monthlyData: { month: string; income: number; expenses: number }[];
  loading: boolean;
}

export interface FinanceActions {
  fetchAll: () => Promise<void>;
  setFormMode: (mode: FormMode) => void;
  confirmDelete: (title: string, message: string, action: () => void) => void;
}
