import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { logUnifiedEvent } from '../lib/events';
import { useGamificationContext } from '../lib/gamification/context';
import { MiniChart } from '../components/MiniChart';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import {
  TrendingUp, TrendingDown, Receipt, Plus, X, Loader2,
  ArrowUpCircle, ArrowDownCircle, AlertTriangle, BarChart3,
  Briefcase, Edit2, Save,
  Sparkles, Wallet, RefreshCw, ScrollText, Car,
} from 'lucide-react';
import { ErrorCard } from '../components/ui/ErrorCard';
import { EmojiIcon } from '../lib/emoji-icon';
import { genId, todayStr, thisMonth, startOfMonth, fmtCurrency } from '../utils/date';
import { FinancesProvider } from '../components/finances/FinancesContext';
import type { FinancesCtxValue } from '../components/finances/FinancesContext';
import { OverviewTab } from '../components/finances/OverviewTab';
import { IncomeTab } from '../components/finances/IncomeTab';
import { ExpensesTab } from '../components/finances/ExpensesTab';
import { BillsTab } from '../components/finances/BillsTab';
import { WorkTab } from '../components/finances/WorkTab';
import { AnalysisTab } from '../components/finances/AnalysisTab';
import {
  IncomeFormModal, ExpenseFormModal, BillFormModal,
  BusinessFormModal, ClientFormModal, CategoryFormModal,
  BillEditModal, BudgetEditorModal, QuickAddModal,
} from '../components/finances/FinanceModals';
const LazyFinanceAI = lazy(() => import('../components/finances/FinanceAI').then(m => ({ default: m.FinanceAI })));
const LazyFinanceAIHolo = lazy(() => import('../components/ai/FinanceAI').then(m => ({ default: m.FinanceAIHolo })));
import type {
  Tab, FormMode, IncomeEntry, ExpenseEntry, Bill, Business, Client,
  ExpenseCategory, Transaction, FinanceGoal, FinanceTask,
} from '../components/finances/types';
import { normalizeToMonthly } from '../components/finances/types';
import { SpotlightTour } from '../components/SpotlightTour';
import { FullscreenPage } from '../components/FullscreenPage';
import './Finances.css';

const FINANCE_TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3, color: '#A855F7' },
  { id: 'income', label: 'Income', icon: ArrowUpCircle, color: '#39FF14' },
  { id: 'expenses', label: 'Expenses', icon: ArrowDownCircle, color: '#F43F5E' },
  { id: 'bills', label: 'Bills', icon: Receipt, color: '#F97316' },
  { id: 'work', label: 'Work', icon: Briefcase, color: '#00D4FF' },
  { id: 'analysis', label: 'Analysis', icon: Sparkles, color: '#FBBF24' },
];

function today() { return todayStr(); }
function isOverdue(d: string, s: string) { return s !== 'paid' && d < today(); }

export function Finances() {
  const user = useUserStore(s => s.user);
  const { awardXP } = useGamificationContext();
  const [searchParams] = useSearchParams();
  const finNavigate = useNavigate();
  const urlTab = searchParams.get('tab') as Tab | null;
  const [tab, setTabState] = useState<Tab>(urlTab || 'overview');
  const setTab = (t: Tab) => { setTabState(t); finNavigate(`/finances?tab=${t}`, { replace: true }); };
  useEffect(() => { if (urlTab && urlTab !== tab) setTabState(urlTab); }, [urlTab]);

  // ── Data ──
  const [income, setIncome] = useState<IncomeEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<{ id?: string; month: string; category_id: string; amount: number }[]>([]);
  const [tasks, setTasks] = useState<FinanceTask[]>([]);
  const [goals, setGoals] = useState<FinanceGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── UI State ──
  const [expandedBusiness, setExpandedBusiness] = useState<string | null>(null);
  const [overviewDonutSlice, setOverviewDonutSlice] = useState<number | null>(null);
  const [cashflowMonthIdx, setCashflowMonthIdx] = useState<number | null>(null);
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [expensesDonutSlice, setExpensesDonutSlice] = useState<number | null>(null);
  const [incomeMonthIdx, setIncomeMonthIdx] = useState<number | null>(null);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  // ── Inline editing ──
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

  // ── Transaction filters ──
  const [txSearch, setTxSearch] = useState('');
  const [txCategoryFilter, setTxCategoryFilter] = useState<string | null>(null);

  // ── Confirm dialog ──
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState({ title: '', message: '' });
  const confirmDelete = (title: string, message: string, action: () => void) => {
    setConfirmMsg({ title, message });
    setConfirmAction(() => action);
  };

  // ── 6-month history ──
  const [monthlyData, setMonthlyData] = useState<{ month: string; income: number; expenses: number }[]>([]);

  // ══════════════════════════════════════════════════════════════════════════════
  // FETCH
  // ══════════════════════════════════════════════════════════════════════════════
  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      useFinanceStore.getState().fetchAll(),
      useScheduleStore.getState().fetchAll(),
      useGoalsStore.getState().fetchAll(),
    ]);
    const finStore = useFinanceStore.getState();
    const schedStore = useScheduleStore.getState();
    const goalStore = useGoalsStore.getState();
    const incData = finStore.income as unknown as IncomeEntry[];
    const expData = finStore.expenses as unknown as ExpenseEntry[];
    const txData = finStore.transactions as unknown as Transaction[];
    setIncome(incData);
    setExpenses(expData);
    setBills(finStore.bills as unknown as Bill[]);
    setClients(finStore.clients as unknown as Client[]);
    setBusinesses(finStore.businesses as unknown as Business[]);
    setCategories(finStore.categories as unknown as ExpenseCategory[]);
    setTransactions(txData);
    setBudgets(finStore.budgets as unknown as { id?: string; month: string; category_id: string; amount: number }[]);
    setTasks(schedStore.tasks.filter((t: any) => t.financial_amount != null) as unknown as FinanceTask[]);
    setGoals(goalStore.goals as unknown as FinanceGoal[]);
    const months: { month: string; income: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
      const mKey = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('en', { month: 'short' });
      const incTotal = incData.filter(r => r.date.startsWith(mKey)).reduce((s: number, r) => s + r.amount, 0);
      const expTotal = expData.filter(r => r.date.startsWith(mKey)).reduce((s: number, r) => s + r.amount, 0);
      months.push({ month: label, income: incTotal, expenses: expTotal });
    }
    setMonthlyData(months);
    setLoading(false);
  };

  useEffect(() => { if (user) fetchAll(); }, [user]);
  useEffect(() => {
    const h = () => {
      useFinanceStore.getState().invalidate();
      useScheduleStore.getState().invalidate();
      useGoalsStore.getState().invalidate();
      fetchAll();
    };
    window.addEventListener('lifeos-refresh', h);
    return () => window.removeEventListener('lifeos-refresh', h);
  }, []);

  const switchTab = (t: Tab) => {
    setTab(t);
    setFormMode(null);
    setDrillCategory(null);
    setExpensesDonutSlice(null);
  };

  const resetForms = () => {
    setEditingId(null); setEditAmount(''); setEditDesc(''); setEditDate('');
    setError('');
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // CRUD (kept in orchestrator for context value)
  // ══════════════════════════════════════════════════════════════════════════════
  const saveBudget = async (categoryId: string, amount: number) => {
    const existing = budgets.find(b => b.category_id === categoryId);
    if (existing) {
      await supabase.from('budgets').update({ amount }).eq('id', existing.id);
    } else {
      await supabase.from('budgets').insert({ id: genId(), user_id: user?.id, category_id: categoryId, month: thisMonth(), amount });
    }
    setEditingBudget(null);
    fetchAll();
  };

  const saveBillEdit = async (id: string) => {
    if (!editBillTitle.trim() || !editBillAmount) return;
    await useFinanceStore.getState().updateBill(id, { title: editBillTitle.trim(), amount: parseFloat(editBillAmount), due_date: editBillDue });
    setEditingBillId(null);
    fetchAll();
  };

  const saveBizEdit = async (id: string) => {
    if (!editBizName.trim()) return;
    await supabase.from('businesses').update({ name: editBizName.trim(), icon: editBizIcon, type: editBizType }).eq('id', id);
    setEditingBizId(null);
    fetchAll();
  };

  const togglePaid = async (id: string, cur: string) => {
    const next = cur === 'paid' ? 'pending' : 'paid';
    await useFinanceStore.getState().updateBill(id, { status: next, paid_date: next === 'paid' ? new Date().toISOString() : null });
    fetchAll();
  };

  const deleteRow = async (table: string, id: string) => {
    if (table === 'income') {
      await useFinanceStore.getState().deleteIncome(id);
    } else if (table === 'expenses') {
      await useFinanceStore.getState().deleteExpense(id);
    } else if (table === 'bills') {
      await useFinanceStore.getState().deleteBill(id);
    } else if (table === 'businesses' || table === 'expense_categories') {
      // No store method for hard-delete of businesses/categories — direct call is legitimate
      await supabase.from(table).delete().eq('id', id);
    } else {
      await supabase.from(table).update({ is_deleted: true }).eq('id', id);
    }
    setConfirmAction(null);
    fetchAll();
  };

  const startEditing = (item: { id: string; amount?: number; description?: string; title?: string; date?: string }) => {
    setEditingId(item.id);
    setEditAmount(item.amount?.toString() || '');
    setEditDesc(item.description || item.title || '');
    setEditDate(item.date || '');
  };

  const saveInlineEdit = async (table: 'income' | 'expenses', id: string) => {
    if (!editAmount || parseFloat(editAmount) <= 0) return;
    setEditSaving(true);
    const amt = parseFloat(editAmount);
    if (table === 'income') {
      await useFinanceStore.getState().updateIncome(id, { amount: amt, description: editDesc, date: editDate });
    } else {
      await useFinanceStore.getState().updateExpense(id, { amount: amt, description: editDesc, date: editDate });
    }
    setEditingId(null); setEditSaving(false);
    fetchAll();
  };

  const cancelEditing = () => { setEditingId(null); setEditAmount(''); setEditDesc(''); setEditDate(''); };

  const openBudgetEditor = (cat: ExpenseCategory) => {
    const spent = expenses.filter(e => e.category_id === cat.id && e.date >= som).reduce((s, e) => s + e.amount, 0) +
      transactions.filter(t => t.type === 'expense' && t.category_id === cat.id && t.date >= som).reduce((s, t) => s + t.amount, 0);
    const budget = budgets.find(b => b.category_id === cat.id)?.amount || cat.budget_monthly || 0;
    setSelectedCategoryForBudget({ ...cat, spent, budget });
    setBudgetEditorOpen(true);
  };

  // ── Modal close+refresh helper ──
  const handleModalSaved = () => { setFormMode(null); fetchAll(); };
  const handleModalClose = () => { setFormMode(null); };

  // ══════════════════════════════════════════════════════════════════════════════
  // COMPUTED VALUES
  // ══════════════════════════════════════════════════════════════════════════════
  const som = startOfMonth();
  const monthIncome = income.filter(i => i.date >= som).reduce((s, i) => s + i.amount, 0);
  const monthExpenses = expenses.filter(e => e.date >= som).reduce((s, e) => s + e.amount, 0);
  const net = monthIncome - monthExpenses;
  const overdueBills = bills.filter(b => isOverdue(b.due_date, b.status));
  const upcomingBillsTotal = bills.filter(b => b.status !== 'paid').reduce((s, b) => s + b.amount, 0);
  const deductibleExpenses = expenses.filter(e => e.date >= som && e.is_deductible).reduce((s, e) => s + e.amount, 0);

  const predictions = useMemo(() => {
    const completedMonths = monthlyData.slice(0, -1).filter(m => m.income > 0 || m.expenses > 0);
    let histIncome = 0, histExpenses = 0;
    if (completedMonths.length >= 1) {
      const recent = completedMonths.slice(-3);
      histIncome = recent.reduce((s, m) => s + m.income, 0) / recent.length;
      histExpenses = recent.reduce((s, m) => s + m.expenses, 0) / recent.length;
    } else {
      const currentMonth = monthlyData[monthlyData.length - 1];
      if (currentMonth && (currentMonth.income > 0 || currentMonth.expenses > 0)) {
        const dayOfMonth = new Date().getDate();
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const scaleFactor = dayOfMonth > 0 ? daysInMonth / dayOfMonth : 1;
        histIncome = currentMonth.income * scaleFactor;
        histExpenses = currentMonth.expenses * scaleFactor;
      }
    }
    const recurringIncome = income.filter(i => i.is_recurring && i.recurrence_rule).reduce((s, i) => s + normalizeToMonthly(i.amount, i.recurrence_rule || 'monthly'), 0);
    const recurringBills = bills.filter(b => b.is_recurring && b.status !== 'paid').reduce((s, b) => s + normalizeToMonthly(b.amount, b.recurrence_rule || 'monthly'), 0);
    return { income: Math.max(histIncome, recurringIncome), expenses: Math.max(histExpenses, recurringBills) };
  }, [monthlyData, income, bills]);

  const matchSourceToBusiness = (source: string, bizList: Business[]): string | null => {
    const s = (source || '').toLowerCase();
    if (s.includes('clean')) return bizList.find(b => b.name.toLowerCase().includes('clean'))?.id || null;
    if (s.includes('security')) return bizList.find(b => b.name.toLowerCase().includes('security'))?.id || null;
    return null;
  };

  const incomeBySource = useMemo(() => {
    const map: Record<string, number> = {};
    income.filter(i => i.date >= som).forEach(i => {
      let src = i.source;
      if (!src || src === 'Other') {
        if (i.client_id) {
          const client = clients.find(c => c.id === i.client_id);
          if (client) { const biz = businesses.find(b => b.id === client.business_id); src = biz?.name || client.name; }
        }
      }
      src = src || 'Other';
      map[src] = (map[src] || 0) + i.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]) as [string, number][];
  }, [income, transactions, businesses, clients, som]);

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.filter(e => e.date >= som).forEach(e => {
      const cat = e.category_id ? (categories.find(c => c.id === e.category_id)?.name || 'Other') : 'Other';
      map[cat] = (map[cat] || 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]) as [string, number][];
  }, [expenses, categories, som]);

  const budgetHealth = useMemo(() => {
    return categories.filter(c => c.budget_monthly && c.budget_monthly > 0 && c.scope === 'personal').map(cat => {
      const spent = expenses.filter(e => e.category_id === cat.id && e.date >= som).reduce((s, e) => s + e.amount, 0);
      const pct = cat.budget_monthly! > 0 ? (spent / cat.budget_monthly!) * 100 : 0;
      return { cat, spent, budget: cat.budget_monthly!, pct };
    });
  }, [categories, expenses, som]);

  const financialTasks = useMemo(() => {
    const tasksByGoal: Record<string, { goal: FinanceGoal | null; tasks: FinanceTask[] }> = {};
    tasks.forEach(t => {
      const goalId = t.goal_id || 'none';
      if (!tasksByGoal[goalId]) {
        const goal = goals.find(g => g.id === goalId);
        tasksByGoal[goalId] = { goal: goal || null, tasks: [] };
      }
      tasksByGoal[goalId].tasks.push(t);
    });
    return Object.values(tasksByGoal);
  }, [tasks, goals]);

  const businessFinancials = useMemo(() => {
    const legacyIncomeMap = new Map<string, string>();
    income.forEach(i => {
      if (!i.client_id && i.source) {
        const bizId = matchSourceToBusiness(i.source, businesses);
        if (bizId) legacyIncomeMap.set(i.id, bizId);
      }
    });
    return businesses.map(biz => {
      const bizClients = clients.filter(c => c.business_id === biz.id);
      const clientIds = new Set(bizClients.map(c => c.id));
      const incomeFromClients = income.filter(i => i.date >= som && i.client_id && clientIds.has(i.client_id)).reduce((s, i) => s + i.amount, 0);
      const incomeBySource = income.filter(i => i.date >= som && !i.client_id && legacyIncomeMap.get(i.id) === biz.id).reduce((s, i) => s + i.amount, 0);
      const revenue = incomeFromClients + incomeBySource;
      return { biz, clients: bizClients, revenue, expense: 0, net: revenue };
    });
  }, [businesses, clients, income, transactions, som]);

  const personalCategories = useMemo(() => {
    return categories.filter(c => c.scope === 'personal').map(cat => {
      const spent = expenses.filter(e => e.category_id === cat.id && e.date >= som).reduce((s, e) => s + e.amount, 0);
      const budget = budgets.find(b => b.category_id === cat.id)?.amount || cat.budget_monthly || 0;
      const pct = budget > 0 ? (spent / budget) * 100 : 0;
      return { cat, spent, budget, pct, transactions: [] as Transaction[] };
    });
  }, [categories, expenses, budgets, som]);

  const lastMonthKey = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
  const analysisIncome = {
    thisMonth: monthIncome,
    lastMonth: income.filter(i => i.date.startsWith(lastMonthKey)).reduce((s, i) => s + i.amount, 0),
    avg3Month: predictions.income,
  };
  const analysisExpenses = {
    thisMonth: monthExpenses,
    lastMonth: expenses.filter(e => e.date.startsWith(lastMonthKey)).reduce((s, e) => s + e.amount, 0),
    avg3Month: predictions.expenses,
  };

  const categoryTrends = useMemo(() => {
    return categories.map(cat => {
      const trend: number[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
        const mKey = d.toISOString().slice(0, 7);
        const spent = expenses.filter(e => e.category_id === cat.id && e.date.startsWith(mKey)).reduce((s, e) => s + e.amount, 0);
        trend.push(spent);
      }
      return { cat, trend };
    });
  }, [categories, expenses]);

  const businessPL = useMemo(() => {
    return businesses.map(biz => {
      const bizClients = clients.filter(c => c.business_id === biz.id);
      const clientIds = new Set(bizClients.map(c => c.id));
      const plData: { month: string; revenue: number; expense: number; net: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
        const mKey = d.toISOString().slice(0, 7);
        const label = d.toLocaleDateString('en', { month: 'short' });
        const revClients = income.filter(inc => inc.date.startsWith(mKey) && inc.client_id && clientIds.has(inc.client_id)).reduce((s, inc) => s + inc.amount, 0);
        const revSource = income.filter(inc => inc.date.startsWith(mKey) && !inc.client_id && matchSourceToBusiness(inc.source || '', businesses) === biz.id).reduce((s, inc) => s + inc.amount, 0);
        const rev = revClients + revSource;
        plData.push({ month: label, revenue: rev, expense: 0, net: rev });
      }
      return { biz, plData };
    });
  }, [businesses, clients, income, transactions]);

  const savingsRate = useMemo(() => {
    return monthlyData.map(m => ({ month: m.month, rate: m.income > 0 ? ((m.income - m.expenses) / m.income) * 100 : 0 }));
  }, [monthlyData]);

  const financialInsights = useMemo(() => {
    const lmKey = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
    const lastMonthExp = expenses.filter(e => e.date.startsWith(lmKey)).reduce((s, e) => s + e.amount, 0);
    const momChange = lastMonthExp > 0 ? ((monthExpenses - lastMonthExp) / lastMonthExp) * 100 : 0;
    const categoryChanges = categories.map(cat => {
      const thisM = expenses.filter(e => e.category_id === cat.id && e.date >= som).reduce((s, e) => s + e.amount, 0);
      const lastM = expenses.filter(e => e.category_id === cat.id && e.date.startsWith(lmKey)).reduce((s, e) => s + e.amount, 0);
      const change = lastM > 0 ? ((thisM - lastM) / lastM) * 100 : 0;
      return { cat, thisMonth: thisM, lastMonth: lastM, change };
    }).filter(c => Math.abs(c.change) > 10 && c.thisMonth > 0).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr = weekAgo.toISOString().split('T')[0];
    const thisWeekExpenses = expenses.filter(e => e.date >= weekStr).map(e => ({ amount: e.amount, description: e.description || undefined })).sort((a, b) => b.amount - a.amount);
    const biggestThisWeek = thisWeekExpenses[0] || null;
    const savingsRateLast3: { month: string; rate: number }[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
      const mKey = d.toISOString().slice(0, 7);
      const mInc = income.filter(inc => inc.date.startsWith(mKey)).reduce((s, inc) => s + inc.amount, 0);
      const mExp = expenses.filter(e => e.date.startsWith(mKey)).reduce((s, e) => s + e.amount, 0);
      savingsRateLast3.push({ month: d.toLocaleDateString('en', { month: 'short' }), rate: mInc > 0 ? ((mInc - mExp) / mInc) * 100 : 0 });
    }
    return { momChange, categoryChanges: categoryChanges.slice(0, 3), biggestThisWeek, savingsRateLast3, incomeVsExpenses: monthIncome - monthExpenses };
  }, [expenses, transactions, categories, income, som, monthExpenses, monthIncome]);

  const incomeBySourceMonthly = useMemo(() => {
    const sourceSet = new Set<string>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
      const mKey = d.toISOString().slice(0, 7);
      income.filter(inc => inc.date.startsWith(mKey)).forEach(inc => sourceSet.add(inc.source || 'Other'));
    }
    const sources = Array.from(sourceSet).slice(0, 6);
    const labels: string[] = [];
    const data: Record<string, number[]> = {};
    sources.forEach(s => { data[s] = []; });
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
      const mKey = d.toISOString().slice(0, 7);
      labels.push(d.toLocaleDateString('en', { month: 'short' }));
      sources.forEach(src => {
        const total = income.filter(inc => inc.date.startsWith(mKey) && (inc.source || 'Other') === src).reduce((s, inc) => s + inc.amount, 0);
        data[src].push(total);
      });
    }
    return { sources, labels, data };
  }, [income]);

  // ══════════════════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ══════════════════════════════════════════════════════════════════════════════
  const ctxValue: FinancesCtxValue = {
    income, expenses, bills, clients, businesses, categories, transactions, budgets, tasks, goals, monthlyData, loading,
    tab, switchTab, formMode, setFormMode, saving, error, setError,
    expandedBusiness, setExpandedBusiness, expandedTx, setExpandedTx,
    overviewDonutSlice, setOverviewDonutSlice, cashflowMonthIdx, setCashflowMonthIdx,
    drillCategory, setDrillCategory, expensesDonutSlice, setExpensesDonutSlice, incomeMonthIdx, setIncomeMonthIdx,
    editingId, setEditingId, editAmount, setEditAmount, editDesc, setEditDesc, editDate, setEditDate, editSaving,
    startEditing, saveInlineEdit, cancelEditing,
    editingBillId, setEditingBillId, editBillTitle, setEditBillTitle, editBillAmount, setEditBillAmount, editBillDue, setEditBillDue, saveBillEdit,
    editingBizId, setEditingBizId, editBizName, setEditBizName, editBizIcon, setEditBizIcon, editBizType, setEditBizType, saveBizEdit,
    txSearch, setTxSearch, txCategoryFilter, setTxCategoryFilter,
    editingBudget, setEditingBudget, budgetValue, setBudgetValue, saveBudget, openBudgetEditor,
    fetchAll, resetForms, confirmDelete, deleteRow, togglePaid,
    som, monthIncome, monthExpenses, net, overdueBills, upcomingBillsTotal, deductibleExpenses,
    predictions, incomeBySource, expenseByCategory, budgetHealth, financialTasks,
    businessFinancials, personalCategories, analysisIncome, analysisExpenses,
    categoryTrends, businessPL, savingsRate, financialInsights, incomeBySourceMonthly,
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  const activeColor = FINANCE_TABS.find(t => t.id === tab)?.color || '#A855F7';

  return (
    <FinancesProvider value={ctxValue}>
      <FullscreenPage
        title="Finances"
        titleIcon={<Wallet size={16} />}
        tabs={FINANCE_TABS}
        activeTab={tab}
        onTabChange={(t) => switchTab(t as Tab)}
        activeColor={activeColor}
        contentExtra={
          !loading ? <Suspense fallback={null}><LazyFinanceAIHolo onSwitchTab={(t) => switchTab(t as Tab)} onFormMode={(m: string) => setFormMode(m as FormMode)} /></Suspense> : undefined
        }
      >
      <div className="finances">
        {/* Action buttons (contextual to active tab) */}
        {!loading && (
          <div className="fin-header-actions" style={{ marginBottom: 12 }}>
            {tab === 'work' && (
              <>
                <button className="fin-add-btn secondary" onClick={() => setFormMode('business')}><Plus size={16} /> Business</button>
                <button className="fin-add-btn secondary" onClick={() => setFormMode('client')}><Plus size={16} /> Client</button>
                <button className="fin-add-btn" onClick={() => setFormMode('income')}><Plus size={16} /> Income</button>
              </>
            )}
            {(tab === 'overview' || tab === 'expenses') && (
              <button className="fin-add-btn" onClick={() => setFormMode('expense')}><Plus size={16} /> Add Expense</button>
            )}
            {tab === 'income' && (
              <button className="fin-add-btn" onClick={() => setFormMode('income')}><Plus size={16} /> Add Income</button>
            )}
            {tab === 'bills' && (
              <button className="fin-add-btn" onClick={() => setFormMode('bill')}><Plus size={16} /> Add Bill</button>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="fin-skeleton-container">
            <div className="fin-skeleton-stats"><div className="fin-skeleton-block fin-skeleton-stat" /><div className="fin-skeleton-block fin-skeleton-stat" /><div className="fin-skeleton-block fin-skeleton-stat" /><div className="fin-skeleton-block fin-skeleton-stat" /></div>
            <div className="fin-skeleton-block fin-skeleton-tab" />
            <div className="fin-skeleton-block fin-skeleton-card" />
            <div className="fin-skeleton-block fin-skeleton-card tall" />
          </div>
        )}

        {/* Empty state for first-time users */}
        {!loading && income.length === 0 && expenses.length === 0 && bills.length === 0 && transactions.length === 0 && (
          <EmptyState variant="finances" action={{ label: '+ Add Income or Expense', onClick: () => setFormMode('income') }} />
        )}

        {/* Summary Stats */}
        {!loading && (
          <div className="fin-stats">
            <div className="fin-stat income">
              <ArrowUpCircle size={18} />
              <div className="fin-stat-body">
                <span className="fin-stat-label">Income (Month)</span>
                <span className="fin-stat-value">{fmtCurrency(monthIncome)}</span>
              </div>
              {monthlyData.length > 1 && <div className="fin-stat-spark"><MiniChart data={monthlyData.map(m => m.income)} color="#39FF14" height={40} /></div>}
            </div>
            <div className="fin-stat expense">
              <ArrowDownCircle size={18} />
              <div className="fin-stat-body">
                <span className="fin-stat-label">Expenses (Month)</span>
                <span className="fin-stat-value">{fmtCurrency(monthExpenses)}</span>
              </div>
              {monthlyData.length > 1 && <div className="fin-stat-spark"><MiniChart data={monthlyData.map(m => m.expenses)} color="#F43F5E" height={40} /></div>}
            </div>
            <div className={`fin-stat ${net >= 0 ? 'positive' : 'negative'}`}>
              {net >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              <div className="fin-stat-body">
                <span className="fin-stat-label">Net</span>
                <span className="fin-stat-value">{net >= 0 ? '+' : ''}{fmtCurrency(net)}</span>
              </div>
              {monthlyData.length > 1 && <div className="fin-stat-spark"><MiniChart data={monthlyData.map(m => m.income - m.expenses)} color={net >= 0 ? '#39FF14' : '#F43F5E'} height={40} /></div>}
            </div>
            <div className={`fin-stat bills ${overdueBills.length > 0 ? 'overdue' : ''}`}>
              <Receipt size={18} />
              <div className="fin-stat-body">
                <span className="fin-stat-label">Upcoming Bills</span>
                <span className="fin-stat-value">{fmtCurrency(upcomingBillsTotal)}</span>
              </div>
            </div>
          </div>
        )}

        {error && <ErrorCard message={error} />}

        {/* Tab Content — delegated to sub-components */}
        {tab === 'overview' && !loading && <OverviewTab />}
        {tab === 'income' && !loading && <IncomeTab />}
        {tab === 'expenses' && !loading && <ExpensesTab />}
        {tab === 'bills' && !loading && <BillsTab />}
        {tab === 'work' && !loading && <WorkTab />}
        {tab === 'analysis' && !loading && (
          <>
            <AnalysisTab />
            <Suspense fallback={null}><LazyFinanceAI /></Suspense>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            FORM MODALS — delegated to FinanceModals sub-components
        ══════════════════════════════════════════════════════════════════════ */}
        {formMode === 'income' && <IncomeFormModal onClose={handleModalClose} onSaved={handleModalSaved} />}
        {formMode === 'expense' && <ExpenseFormModal onClose={handleModalClose} onSaved={handleModalSaved} />}
        {formMode === 'bill' && <BillFormModal onClose={handleModalClose} onSaved={handleModalSaved} />}
        {formMode === 'business' && <BusinessFormModal onClose={handleModalClose} onSaved={handleModalSaved} />}
        {formMode === 'client' && <ClientFormModal onClose={handleModalClose} onSaved={handleModalSaved} />}
        {formMode === 'category' && <CategoryFormModal onClose={handleModalClose} onSaved={handleModalSaved} />}

        {/* Bill Edit Modal */}
        {editingBillId && (
          <BillEditModal
            billId={editingBillId}
            initialTitle={editBillTitle}
            initialAmount={editBillAmount}
            initialDue={editBillDue}
            onClose={() => setEditingBillId(null)}
            onSaved={() => { setEditingBillId(null); fetchAll(); }}
          />
        )}

        {/* Budget Editor Modal */}
        {budgetEditorOpen && selectedCategoryForBudget && (
          <BudgetEditorModal
            category={selectedCategoryForBudget}
            onClose={() => setBudgetEditorOpen(false)}
            onSaved={() => { setBudgetEditorOpen(false); setSelectedCategoryForBudget(null); }}
          />
        )}

        <ConfirmDialog open={!!confirmAction} title={confirmMsg.title} message={confirmMsg.message} onConfirm={() => { confirmAction?.(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />

        <SpotlightTour tourId="finance" />
      </div>
      </FullscreenPage>
    </FinancesProvider>
  );
}
