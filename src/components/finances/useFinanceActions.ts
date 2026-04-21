/**
 * useFinanceActions — Hook encapsulating all CRUD handler logic + inline-edit
 * UI state that was previously inline in Finances.tsx.
 *
 * Routes all mutations through useFinanceStore instead of direct Supabase calls.
 */

import { useState, useCallback } from 'react';
import { useFinanceStore } from '../../stores/useFinanceStore';
import type { IncomeEntry, ExpenseEntry, ExpenseCategory, Transaction, FormMode } from './types';

export function useFinanceActions(fetchAll: () => Promise<void>) {
  const store = useFinanceStore;

  // ── Form state ──
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Inline editing state ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // ── Bill inline edit ──
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editBillTitle, setEditBillTitle] = useState('');
  const [editBillAmount, setEditBillAmount] = useState('');
  const [editBillDue, setEditBillDue] = useState('');

  // ── Business inline edit ──
  const [editingBizId, setEditingBizId] = useState<string | null>(null);
  const [editBizName, setEditBizName] = useState('');
  const [editBizIcon, setEditBizIcon] = useState('');
  const [editBizType, setEditBizType] = useState('');

  // ── Budget edit ──
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState('');
  const [budgetEditorOpen, setBudgetEditorOpen] = useState(false);
  const [selectedCategoryForBudget, setSelectedCategoryForBudget] = useState<ExpenseCategory & { spent: number; budget: number } | null>(null);

  // ── Confirm dialog ──
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState({ title: '', message: '' });
  const confirmDelete = useCallback((title: string, message: string, action: () => void) => {
    setConfirmMsg({ title, message });
    setConfirmAction(() => action);
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // CRUD Handlers (routed through store)
  // ══════════════════════════════════════════════════════════════════════════

  const saveBudget = useCallback(async (categoryId: string, amount: number) => {
    await store.getState().saveBudget(categoryId, amount);
    setEditingBudget(null);
    fetchAll();
  }, [fetchAll]);

  const saveBillEdit = useCallback(async (id: string) => {
    if (!editBillTitle.trim() || !editBillAmount) return;
    await store.getState().updateBill(id, {
      title: editBillTitle.trim(),
      amount: parseFloat(editBillAmount),
      due_date: editBillDue,
    });
    setEditingBillId(null);
    fetchAll();
  }, [editBillTitle, editBillAmount, editBillDue, fetchAll]);

  const saveBizEdit = useCallback(async (id: string) => {
    if (!editBizName.trim()) return;
    await store.getState().updateBusiness(id, {
      name: editBizName.trim(),
      icon: editBizIcon,
      type: editBizType,
    } as any);
    setEditingBizId(null);
    fetchAll();
  }, [editBizName, editBizIcon, editBizType, fetchAll]);

  const togglePaid = useCallback(async (id: string, cur: string) => {
    const next = cur === 'paid' ? 'pending' : 'paid';
    await store.getState().updateBill(id, {
      status: next,
      paid_date: next === 'paid' ? new Date().toISOString() : null,
    } as any);
    fetchAll();
  }, [fetchAll]);

  const deleteRow = useCallback(async (table: string, id: string) => {
    if (table === 'income') {
      await store.getState().deleteIncome(id);
    } else if (table === 'expenses') {
      await store.getState().deleteExpense(id);
    } else if (table === 'bills') {
      await store.getState().deleteBill(id);
    } else if (table === 'businesses') {
      await store.getState().deleteBusiness(id);
    } else if (table === 'expense_categories') {
      await store.getState().deleteCategory(id);
    } else {
      await store.getState().softDeleteRow(table, id);
    }
    setConfirmAction(null);
    fetchAll();
  }, [fetchAll]);

  const startEditing = useCallback((item: { id: string; amount?: number; description?: string; title?: string; date?: string }) => {
    setEditingId(item.id);
    setEditAmount(item.amount?.toString() || '');
    setEditDesc(item.description || item.title || '');
    setEditDate(item.date || '');
  }, []);

  const saveInlineEdit = useCallback(async (table: 'income' | 'expenses', id: string) => {
    if (!editAmount || parseFloat(editAmount) <= 0) return;
    setEditSaving(true);
    const amt = parseFloat(editAmount);
    if (table === 'income') {
      await store.getState().updateIncome(id, { amount: amt, description: editDesc, date: editDate } as any);
    } else {
      await store.getState().updateExpense(id, { amount: amt, description: editDesc, date: editDate } as any);
    }
    setEditingId(null);
    setEditSaving(false);
    fetchAll();
  }, [editAmount, editDesc, editDate, fetchAll]);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditAmount('');
    setEditDesc('');
    setEditDate('');
  }, []);

  const resetForms = useCallback(() => {
    setEditingId(null);
    setEditAmount('');
    setEditDesc('');
    setEditDate('');
  }, []);

  const openBudgetEditor = useCallback((cat: ExpenseCategory, som: string, expenses: ExpenseEntry[], transactions: Transaction[], budgets: { id?: string; month: string; category_id: string; amount: number }[]) => {
    const spent = expenses.filter(e => e.category_id === cat.id && e.date >= som).reduce((s, e) => s + e.amount, 0) +
      transactions.filter(t => t.type === 'expense' && t.category_id === cat.id && t.date >= som).reduce((s, t) => s + t.amount, 0);
    const budget = budgets.find(b => b.category_id === cat.id)?.amount || cat.budget_monthly || 0;
    setSelectedCategoryForBudget({ ...cat, spent, budget });
    setBudgetEditorOpen(true);
  }, []);

  return {
    // Form state
    formMode, setFormMode, saving, error, setError,

    // Inline editing state
    editingId, setEditingId, editAmount, setEditAmount, editDesc, setEditDesc,
    editDate, setEditDate, editSaving, startEditing, saveInlineEdit, cancelEditing,

    // Bill inline edit
    editingBillId, setEditingBillId, editBillTitle, setEditBillTitle,
    editBillAmount, setEditBillAmount, editBillDue, setEditBillDue, saveBillEdit,

    // Business inline edit
    editingBizId, setEditingBizId, editBizName, setEditBizName,
    editBizIcon, setEditBizIcon, editBizType, setEditBizType, saveBizEdit,

    // Budget
    editingBudget, setEditingBudget, budgetValue, setBudgetValue, saveBudget,
    budgetEditorOpen, setBudgetEditorOpen, selectedCategoryForBudget, setSelectedCategoryForBudget,
    openBudgetEditor,

    // Confirm dialog
    confirmAction, setConfirmAction, confirmMsg, confirmDelete, deleteRow,

    // Actions
    togglePaid, resetForms,
  };
}