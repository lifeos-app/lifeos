/**
 * FinancesContext — Strongly typed context for sharing finance state between tabs.
 */

import { createContext, useContext } from 'react';
import type {
  IncomeEntry, ExpenseEntry, Bill, Business, Client,
  ExpenseCategory, Transaction, FinanceGoal, FinanceTask,
  FormMode, Tab,
} from './types';

export interface FinancesCtxValue {
  // Data
  income: IncomeEntry[];
  expenses: ExpenseEntry[];
  bills: Bill[];
  clients: Client[];
  businesses: Business[];
  categories: ExpenseCategory[];
  transactions: Transaction[];
  budgets: { id?: string; month: string; category_id: string; amount: number }[];
  tasks: FinanceTask[];
  goals: FinanceGoal[];
  monthlyData: { month: string; income: number; expenses: number }[];
  loading: boolean;

  // UI state
  tab: Tab;
  switchTab: (t: Tab) => void;
  formMode: FormMode;
  setFormMode: (m: FormMode) => void;
  saving: boolean;
  error: string;
  setError: (e: string) => void;
  expandedBusiness: string | null;
  setExpandedBusiness: (id: string | null) => void;
  expandedTx: string | null;
  setExpandedTx: (id: string | null) => void;

  // Interactive chart state
  overviewDonutSlice: number | null;
  setOverviewDonutSlice: (i: number | null) => void;
  cashflowMonthIdx: number | null;
  setCashflowMonthIdx: (i: number | null) => void;
  drillCategory: string | null;
  setDrillCategory: (id: string | null) => void;
  expensesDonutSlice: number | null;
  setExpensesDonutSlice: (i: number | null) => void;
  incomeMonthIdx: number | null;
  setIncomeMonthIdx: (i: number | null) => void;

  // Inline editing
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  editAmount: string;
  setEditAmount: (v: string) => void;
  editDesc: string;
  setEditDesc: (v: string) => void;
  editDate: string;
  setEditDate: (v: string) => void;
  editSaving: boolean;
  startEditing: (item: { id: string; amount?: number; description?: string; title?: string; date?: string }) => void;
  saveInlineEdit: (table: 'income' | 'expenses', id: string) => Promise<void>;
  cancelEditing: () => void;

  // Bill inline editing
  editingBillId: string | null;
  setEditingBillId: (id: string | null) => void;
  editBillTitle: string;
  setEditBillTitle: (v: string) => void;
  editBillAmount: string;
  setEditBillAmount: (v: string) => void;
  editBillDue: string;
  setEditBillDue: (v: string) => void;
  saveBillEdit: (id: string) => Promise<void>;

  // Business inline editing
  editingBizId: string | null;
  setEditingBizId: (id: string | null) => void;
  editBizName: string;
  setEditBizName: (v: string) => void;
  editBizIcon: string;
  setEditBizIcon: (v: string) => void;
  editBizType: string;
  setEditBizType: (v: string) => void;
  saveBizEdit: (id: string) => Promise<void>;

  // Transaction search/filter
  txSearch: string;
  setTxSearch: (v: string) => void;
  txCategoryFilter: string | null;
  setTxCategoryFilter: (v: string | null) => void;

  // Budget
  editingBudget: string | null;
  setEditingBudget: (id: string | null) => void;
  budgetValue: string;
  setBudgetValue: (v: string) => void;
  saveBudget: (categoryId: string, amount: number) => Promise<void>;
  openBudgetEditor: (cat: ExpenseCategory) => void;

  // Actions
  fetchAll: () => Promise<void>;
  resetForms: () => void;
  confirmDelete: (title: string, message: string, action: () => void) => void;
  deleteRow: (table: string, id: string) => Promise<void>;
  togglePaid: (id: string, cur: string) => Promise<void>;

  // Computed
  som: string;
  monthIncome: number;
  monthExpenses: number;
  net: number;
  overdueBills: Bill[];
  upcomingBillsTotal: number;
  predictions: { income: number; expenses: number };
  incomeBySource: [string, number][];
  expenseByCategory: [string, number][];
  budgetHealth: { cat: ExpenseCategory; spent: number; budget: number; pct: number }[];
  financialTasks: { goal: FinanceGoal | null; tasks: FinanceTask[] }[];
  businessFinancials: { biz: Business; clients: Client[]; revenue: number; expense: number; net: number }[];
  personalCategories: { cat: ExpenseCategory; spent: number; budget: number; pct: number; transactions: Transaction[] }[];
  analysisIncome: { thisMonth: number; lastMonth: number; avg3Month: number };
  analysisExpenses: { thisMonth: number; lastMonth: number; avg3Month: number };
  categoryTrends: { cat: ExpenseCategory; trend: number[] }[];
  businessPL: { biz: Business; plData: { month: string; revenue: number; expense: number; net: number }[] }[];
  savingsRate: { month: string; rate: number }[];
  deductibleExpenses: number;
  financialInsights: {
    momChange: number;
    categoryChanges: { cat: ExpenseCategory; thisMonth: number; lastMonth: number; change: number }[];
    biggestThisWeek: { amount: number; description?: string } | null;
    savingsRateLast3: { month: string; rate: number }[];
    incomeVsExpenses: number;
  };
  incomeBySourceMonthly: { sources: string[]; labels: string[]; data: Record<string, number[]> };
}

const Ctx = createContext<FinancesCtxValue>(null!);

export const FinancesProvider = Ctx.Provider;
export function useFinances() { return useContext(Ctx); }
