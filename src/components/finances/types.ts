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
