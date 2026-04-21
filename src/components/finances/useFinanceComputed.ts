/**
 * useFinanceComputed — Hook encapsulating all derived/memoized computations
 * that were previously inline in Finances.tsx.
 */

import { useMemo } from 'react';
import { startOfMonth, thisMonth } from '../../utils/date';
import { normalizeToMonthly } from './types';
import type {
  IncomeEntry, ExpenseEntry, Bill, Business, Client,
  ExpenseCategory, Transaction, FinanceGoal, FinanceTask,
} from './types';

export interface FinanceComputedInput {
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
}

function matchSourceToBusiness(source: string, bizList: Business[]): string | null {
  const s = (source || '').toLowerCase();
  if (s.includes('clean')) return bizList.find(b => b.name.toLowerCase().includes('clean'))?.id || null;
  if (s.includes('security')) return bizList.find(b => b.name.toLowerCase().includes('security'))?.id || null;
  return null;
}

export function useFinanceComputed(input: FinanceComputedInput) {
  const { income, expenses, bills, clients, businesses, categories, transactions, budgets, tasks, goals, monthlyData } = input;

  const som = startOfMonth();
  const monthIncome = income.filter(i => i.date >= som).reduce((s, i) => s + i.amount, 0);
  const monthExpenses = expenses.filter(e => e.date >= som).reduce((s, e) => s + e.amount, 0);
  const net = monthIncome - monthExpenses;

  const today = new Date().toISOString().split('T')[0];
  const overdueBills = bills.filter(b => b.status !== 'paid' && b.due_date < today);
  const upcomingBillsTotal = bills.filter(b => b.status !== 'paid').reduce((s, b) => s + b.amount, 0);
  const deductibleExpenses = expenses.filter(e => e.date >= som && e.is_deductible).reduce((s, e) => s + e.amount, 0);

  // ── Predictions ──
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

  // ── Income by source ──
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
  }, [income, businesses, clients, som]);

  // ── Expense by category ──
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.filter(e => e.date >= som).forEach(e => {
      const cat = e.category_id ? (categories.find(c => c.id === e.category_id)?.name || 'Other') : 'Other';
      map[cat] = (map[cat] || 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]) as [string, number][];
  }, [expenses, categories, som]);

  // ── Budget health ──
  const budgetHealth = useMemo(() => {
    return categories.filter(c => c.budget_monthly && c.budget_monthly > 0 && c.scope === 'personal').map(cat => {
      const spent = expenses.filter(e => e.category_id === cat.id && e.date >= som).reduce((s, e) => s + e.amount, 0);
      const pct = cat.budget_monthly! > 0 ? (spent / cat.budget_monthly!) * 100 : 0;
      return { cat, spent, budget: cat.budget_monthly!, pct };
    });
  }, [categories, expenses, som]);

  // ── Financial tasks by goal ──
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

  // ── Business financials ──
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
  }, [businesses, clients, income, som]);

  // ── Personal categories with budget ──
  const personalCategories = useMemo(() => {
    return categories.filter(c => c.scope === 'personal').map(cat => {
      const spent = expenses.filter(e => e.category_id === cat.id && e.date >= som).reduce((s, e) => s + e.amount, 0);
      const budget = budgets.find(b => b.category_id === cat.id)?.amount || cat.budget_monthly || 0;
      const pct = budget > 0 ? (spent / budget) * 100 : 0;
      return { cat, spent, budget, pct, transactions: [] as Transaction[] };
    });
  }, [categories, expenses, budgets, som]);

  // ── Analysis data ──
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
  }, [businesses, clients, income]);

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
  }, [expenses, categories, income, som, monthExpenses, monthIncome]);

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

  return {
    som,
    monthIncome,
    monthExpenses,
    net,
    overdueBills,
    upcomingBillsTotal,
    deductibleExpenses,
    predictions,
    incomeBySource,
    expenseByCategory,
    budgetHealth,
    financialTasks,
    businessFinancials,
    personalCategories,
    analysisIncome,
    analysisExpenses,
    categoryTrends,
    businessPL,
    savingsRate,
    financialInsights,
    incomeBySourceMonthly,
  };
}