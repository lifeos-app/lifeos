/**
 * financial-engine.ts — Financial Integrity Layer
 * 
 * Ensures all financial data from onboarding, manual entry, and goals
 * flows correctly into a unified financial picture.
 * 
 * Provides:
 * 1. Cost of living calculation (bills + recurring expenses + subscriptions)
 * 2. Budget integrity (income - obligations - goal budgets = disposable)
 * 3. Income stream tracking with projections
 * 4. Financial health score
 * 5. Onboarding data → financial tables population
 */

import { supabase } from './supabase';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface FinancialSnapshot {
  // Income
  monthlyIncome: number;
  incomeStreams: IncomeStream[];
  projectedAnnualIncome: number;
  
  // Fixed costs (cost of living)
  monthlyBills: number;
  monthlySubscriptions: number;
  monthlyRecurring: number;
  costOfLiving: number; // bills + subscriptions + recurring essentials
  
  // Variable spending
  monthlyExpenses: number;
  dailyBurnRate: number;
  
  // Savings & Goals
  goalBudgets: number; // total budget allocated to goals
  disposableIncome: number; // income - costOfLiving - goalBudgets
  savingsRate: number; // (income - total_expenses) / income as %
  
  // Debt
  totalDebt: number;
  monthlyDebtPayments: number;
  
  // Projections
  projectedMonthEnd: number; // income - projected expenses
  daysUntilBreakEven: number | null;
  emergencyFundMonths: number;
  
  // Health score 0-100
  financialHealthScore: number;
  
  // Alerts
  alerts: FinancialAlert[];
}

export interface IncomeStream {
  name: string;
  monthlyAmount: number;
  type: 'employment' | 'business' | 'freelance' | 'investment' | 'other';
  businessId?: string;
  isRecurring: boolean;
}

export interface FinancialAlert {
  type: 'danger' | 'warning' | 'info' | 'success';
  icon: string;
  message: string;
  action?: string; // suggested action
}

// ═══════════════════════════════════════════════════════════════
// CORE: Calculate Full Financial Snapshot
// ═══════════════════════════════════════════════════════════════

export async function getFinancialSnapshot(userId: string): Promise<FinancialSnapshot> {
  const now = new Date();
  const som = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  // Fetch all financial data in parallel
  const [
    incomeRes, expenseRes, billRes, recurringRes, goalRes, bizRes, profileRes,
  ] = await Promise.all([
    supabase.from('income').select('*').eq('user_id', userId).eq('is_deleted', false).gte('date', som),
    supabase.from('expenses').select('*').eq('user_id', userId).eq('is_deleted', false).gte('date', som),
    supabase.from('bills').select('*').eq('user_id', userId).eq('is_deleted', false),
    supabase.from('recurring_transactions').select('*').eq('user_id', userId).eq('is_active', true).then(r => r).then(r => r, () => ({ data: null, error: null, count: null, status: 0, statusText: '' })),
    supabase.from('goals').select('id, title, budget_allocated, domain, category, financial_type').eq('user_id', userId).eq('is_deleted', false),
    supabase.from('businesses').select('*').eq('user_id', userId).eq('is_deleted', false),
    supabase.from('user_profiles').select('preferences').eq('user_id', userId).single(),
  ]);

  const income = incomeRes.data || [];
  const expenses = expenseRes.data || [];
  const bills = billRes.data || [];
  const recurring = recurringRes.data || [];
  const goals = goalRes.data || [];
  const businesses = bizRes.data || [];
  const finProfile = (profileRes.data?.preferences as Record<string, any>)?.finance_profile || {};

  // ── Income Calculation ──
  // For recurring income with recurrence_rule, calculate the monthly equivalent
  const monthlyIncome = income.reduce((s: number, i: any) => {
    if (i.is_recurring && i.recurrence_rule) {
      return s + normalizeToMonthly(i.amount || 0, i.recurrence_rule);
    }
    return s + (i.amount || 0);
  }, 0);
  
  // Income streams from recurring + businesses
  const incomeStreams: IncomeStream[] = [];
  
  // From recurring_transactions (positive amounts = income)
  for (const rt of recurring.filter((r: any) => r.amount > 0)) {
    incomeStreams.push({
      name: rt.description,
      monthlyAmount: normalizeToMonthly(rt.amount, rt.frequency),
      type: rt.business_id ? 'business' : 'other',
      businessId: rt.business_id || undefined,
      isRecurring: true,
    });
  }
  
  // From businesses (if they have revenue this month)
  for (const biz of businesses) {
    const bizIncomeFromTable = income
      .filter((i: any) => i.business_id === biz.id)
      .reduce((s: number, i: any) => {
        if (i.is_recurring && i.recurrence_rule) {
          return s + normalizeToMonthly(i.amount || 0, i.recurrence_rule);
        }
        return s + (i.amount || 0);
      }, 0);
    const bizIncome = bizIncomeFromTable;
    if (bizIncome > 0) {
      const exists = incomeStreams.some(s => s.businessId === biz.id);
      if (!exists) {
        incomeStreams.push({
          name: biz.name,
          monthlyAmount: bizIncome,
          type: biz.type || 'business',
          businessId: biz.id,
          isRecurring: false,
        });
      }
    }
  }
  
  // From onboarding profile
  if (finProfile.income_sources?.length && incomeStreams.length === 0) {
    for (const src of finProfile.income_sources) {
      incomeStreams.push({
        name: src,
        monthlyAmount: estimateIncomeFromRange(finProfile.income_range || ''),
        type: 'other',
        isRecurring: true,
      });
    }
  }
  
  // Projected annual income — works even with 1-2 data points
  const projectedAnnualIncome = monthlyIncome > 0
    ? (monthlyIncome / Math.max(dayOfMonth, 1)) * daysInMonth * 12
    : incomeStreams.length > 0
      ? incomeStreams.reduce((s, is) => s + is.monthlyAmount, 0) * 12
      : 0;

  // ── Bills ──
  const unpaidBills = bills.filter((b: any) => b.status !== 'paid');
  const monthlyBills = unpaidBills
    .filter((b: any) => {
      // Bills due this month
      const month = b.due_date?.substring(0, 7);
      return month === now.toISOString().substring(0, 7);
    })
    .reduce((s: number, b: any) => s + (b.amount || 0), 0);

  // ── Subscriptions (recurring negative amounts) ──
  const monthlySubscriptions = recurring
    .filter((r: any) => r.amount < 0 && (r.category || '').toLowerCase().includes('sub'))
    .reduce((s: number, r: any) => s + normalizeToMonthly(Math.abs(r.amount), r.frequency), 0);

  // ── Recurring obligations ──
  const monthlyRecurring = recurring
    .filter((r: any) => r.amount < 0)
    .reduce((s: number, r: any) => s + normalizeToMonthly(Math.abs(r.amount), r.frequency), 0);

  // ── Cost of Living ──
  // Bills + all recurring negatives + essential expense categories
  const costOfLiving = monthlyBills + monthlyRecurring;
  
  // From onboarding data if no actual bills recorded yet
  const onboardingExpenses = finProfile.fixed_expenses || [];
  const onboardingCostOfLiving = onboardingExpenses.reduce((s: number, e: any) => {
    const amt = parseFloat((e.amount || '0').toString().replace(/[^0-9.]/g, ''));
    return s + normalizeToMonthly(isNaN(amt) ? 0 : amt, e.frequency || 'monthly');
  }, 0);
  
  const effectiveCostOfLiving = costOfLiving > 0 ? costOfLiving : onboardingCostOfLiving;

  // ── Variable Expenses ──
  const monthlyExpenses = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const dailyBurnRate = dayOfMonth > 0 ? (monthlyExpenses + effectiveCostOfLiving) / Math.max(dayOfMonth, 1) : 0;

  // ── Goal Budgets ──
  const goalBudgets = goals
    .filter((g: any) => g.budget_allocated && g.budget_allocated > 0)
    .reduce((s: number, g: any) => s + (g.budget_allocated || 0), 0);
  
  // ── Disposable Income ──
  const totalMonthlyIncome = monthlyIncome > 0 
    ? (monthlyIncome / Math.max(dayOfMonth, 1)) * daysInMonth 
    : incomeStreams.reduce((s, is) => s + is.monthlyAmount, 0);
  const disposableIncome = totalMonthlyIncome - effectiveCostOfLiving - (goalBudgets / 12);
  
  // ── Savings Rate ──
  const totalSpent = monthlyExpenses + effectiveCostOfLiving;
  const savingsRate = totalMonthlyIncome > 0 
    ? ((totalMonthlyIncome - totalSpent) / totalMonthlyIncome) * 100 
    : 0;

  // ── Debt ──
  const totalDebt = finProfile.debt_total 
    ? parseFloat((finProfile.debt_total || '0').toString().replace(/[^0-9.]/g, ''))
    : 0;
  const monthlyDebtPayments = recurring
    .filter((r: any) => r.amount < 0 && (r.category || '').toLowerCase().includes('debt'))
    .reduce((s: number, r: any) => s + normalizeToMonthly(Math.abs(r.amount), r.frequency), 0);

  // ── Projections ──
  const projectedExpenses = dailyBurnRate * daysInMonth;
  const projectedMonthEnd = totalMonthlyIncome - projectedExpenses;
  
  const netDailyRate = (totalMonthlyIncome / daysInMonth) - dailyBurnRate;
  const daysUntilBreakEven = netDailyRate > 0 ? null : 
    monthlyIncome > monthlyExpenses ? null :
    dailyBurnRate > 0 ? Math.ceil(monthlyExpenses / (totalMonthlyIncome / daysInMonth)) : null;
  
  const emergencyFundMonths = effectiveCostOfLiving > 0 ? disposableIncome / effectiveCostOfLiving : 0;

  // ── Financial Health Score (0-100) ──
  let score = 50; // start neutral
  
  // Savings rate factor (+/- 20)
  if (savingsRate >= 20) score += 20;
  else if (savingsRate >= 10) score += 15;
  else if (savingsRate >= 0) score += 5;
  else score -= 15;
  
  // Debt factor (+/- 15)
  if (totalDebt === 0) score += 15;
  else if (totalDebt < totalMonthlyIncome * 3) score += 5;
  else score -= 10;
  
  // Bills paid factor (+/- 10)
  const overdueBills = unpaidBills.filter((b: any) => b.due_date && b.due_date < now.toISOString().split('T')[0]);
  if (overdueBills.length === 0) score += 10;
  else score -= overdueBills.length * 5;
  
  // Budget adherence (+/- 5)
  if (monthlyExpenses <= effectiveCostOfLiving * 1.1) score += 5;
  else score -= 5;
  
  score = Math.max(0, Math.min(100, score));

  // ── Alerts ──
  const alerts: FinancialAlert[] = [];
  
  if (overdueBills.length > 0) {
    alerts.push({
      type: 'danger', icon: '⚠️',
      message: `${overdueBills.length} overdue bill${overdueBills.length > 1 ? 's' : ''} totaling $${overdueBills.reduce((s: number, b: any) => s + b.amount, 0).toFixed(0)}`,
      action: 'Review bills',
    });
  }
  
  if (savingsRate < 0) {
    alerts.push({
      type: 'danger', icon: '📉',
      message: `Spending exceeds income this month. Daily burn: $${dailyBurnRate.toFixed(0)}/day`,
      action: 'Review expenses',
    });
  } else if (savingsRate < 10) {
    alerts.push({
      type: 'warning', icon: '⚡',
      message: `Savings rate is only ${savingsRate.toFixed(0)}% — aim for 20%+`,
    });
  }
  
  if (disposableIncome < 0) {
    alerts.push({
      type: 'warning', icon: '💸',
      message: 'Your obligations exceed your income. Review bills and goal budgets.',
      action: 'Review finances',
    });
  }
  
  if (monthlyIncome === 0 && incomeStreams.length === 0) {
    alerts.push({
      type: 'info', icon: '💰',
      message: 'No income recorded this month. Add your income sources for accurate tracking.',
      action: 'Add income',
    });
  }
  
  if (score >= 75) {
    alerts.push({
      type: 'success', icon: '🌟',
      message: 'Financial health is strong! Keep it up.',
    });
  }

  return {
    monthlyIncome,
    incomeStreams,
    projectedAnnualIncome,
    monthlyBills,
    monthlySubscriptions,
    monthlyRecurring,
    costOfLiving: effectiveCostOfLiving,
    monthlyExpenses,
    dailyBurnRate,
    goalBudgets,
    disposableIncome,
    savingsRate,
    totalDebt,
    monthlyDebtPayments,
    projectedMonthEnd,
    daysUntilBreakEven,
    emergencyFundMonths,
    financialHealthScore: score,
    alerts,
  };
}

// ═══════════════════════════════════════════════════════════════
// ONBOARDING → FINANCIAL TABLES POPULATION
// ═══════════════════════════════════════════════════════════════

/**
 * Take finance onboarding data and populate the proper financial tables.
 * Called after materializeFinance() to ensure bills, recurring, etc. exist.
 */
export async function populateFinancialTables(
  userId: string, finProfile: Record<string, any>
): Promise<{ created: Record<string, number>; errors: string[] }> {
  const result = { created: { bills: 0, recurring: 0, businesses: 0, income: 0 }, errors: [] as string[] };
  
  // ── Bills from fixed expenses ──
  const fixedExpenses = finProfile.fixed_expenses || [];
  for (const exp of fixedExpenses) {
    const amt = parseFloat((exp.amount || '0').toString().replace(/[^0-9.]/g, ''));
    if (isNaN(amt) || amt <= 0) continue;
    
    // Check if bill already exists
    const { data: existing } = await supabase
      .from('bills')
      .select('id')
      .eq('user_id', userId)
      .ilike('title', `%${exp.name}%`)
      .limit(1);
    
    if (existing?.length) continue;
    
    const isRecurring = (exp.frequency || '').toLowerCase() !== 'one-time';
    const category = categorizeBill(exp.name);
    
    const { error } = await supabase.from('bills').insert({
      user_id: userId,
      title: exp.name,
      amount: amt,
      due_date: nextBillDate(exp.frequency || 'monthly'),
      is_recurring: isRecurring,
      recurrence_rule: isRecurring ? mapFrequency(exp.frequency || 'monthly') : null,
      status: 'pending',
      category,
      is_deleted: false,
    });
    
    if (error) result.errors.push(`Bill "${exp.name}": ${error.message}`);
    else result.created.bills++;
  }
  
  // ── Subscriptions as recurring transactions ──
  const subscriptions = finProfile.subscriptions || [];
  for (const sub of subscriptions) {
    const amt = parseFloat((sub.amount || '0').toString().replace(/[^0-9.]/g, ''));
    if (isNaN(amt) || amt <= 0) continue;
    
    try {
      const { data: existing } = await supabase
        .from('recurring_transactions')
        .select('id')
        .eq('user_id', userId)
        .ilike('description', `%${sub.name}%`)
        .limit(1);
      
      if (existing?.length) continue;
      
      const { error } = await supabase.from('recurring_transactions').insert({
        user_id: userId,
        description: sub.name,
        amount: -Math.abs(amt), // negative = expense
        category: 'Subscriptions',
        frequency: 'monthly',
        next_date: nextBillDate('monthly'),
        is_active: true,
      });
      
      if (error) result.errors.push(`Sub "${sub.name}": ${error.message}`);
      else result.created.recurring++;
    } catch { /* table may not exist */ }
  }
  
  // ── Business creation from employment type ──
  if (finProfile.business_name) {
    const { data: existing } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', `%${finProfile.business_name}%`)
      .limit(1);
    
    if (!existing?.length) {
      const { error } = await supabase.from('businesses').insert({
        user_id: userId,
        name: finProfile.business_name,
        type: finProfile.employment_type || 'business',
        icon: '💼',
        color: '#00D4FF',
        status: 'active',
        is_deleted: false,
      });
      if (error) result.errors.push(`Biz: ${error.message}`);
      else result.created.businesses++;
    }
  }
  
  // ── Income from income sources ──
  if (finProfile.income_sources?.length) {
    for (const src of finProfile.income_sources) {
      try {
        const { data: existing } = await supabase
          .from('recurring_transactions')
          .select('id')
          .eq('user_id', userId)
          .ilike('description', `%${src}%`)
          .gt('amount', 0)
          .limit(1);
        
        if (existing?.length) continue;
        
        const monthlyAmt = estimateIncomeFromRange(finProfile.income_range || '');
        if (monthlyAmt > 0) {
          const { error } = await supabase.from('recurring_transactions').insert({
            user_id: userId,
            description: `Income: ${src}`,
            amount: monthlyAmt / (finProfile.income_sources.length || 1),
            category: 'Income',
            frequency: 'monthly',
            next_date: nextBillDate('monthly'),
            is_active: true,
          });
          if (!error) result.created.income++;
        }
      } catch { /* table may not exist */ }
    }
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function normalizeToMonthly(amount: number, frequency: string): number {
  const f = (frequency || 'monthly').toLowerCase();
  if (f.includes('week')) return amount * 4.33;
  if (f.includes('fortnight')) return amount * 2.17;
  if (f.includes('quarter')) return amount / 3;
  if (f.includes('year') || f.includes('annual')) return amount / 12;
  return amount; // monthly
}

function estimateIncomeFromRange(range: string): number {
  const r = (range || '').toLowerCase();
  if (r.includes('100k') || r.includes('100,000')) return 8333;
  if (r.includes('80k') || r.includes('80,000')) return 6667;
  if (r.includes('60k') || r.includes('60,000')) return 5000;
  if (r.includes('50k') || r.includes('50,000')) return 4167;
  if (r.includes('40k') || r.includes('40,000')) return 3333;
  if (r.includes('30k') || r.includes('30,000')) return 2500;
  if (r.includes('20k') || r.includes('20,000')) return 1667;
  // Try to parse a raw number
  const num = parseFloat(r.replace(/[^0-9.]/g, ''));
  if (!isNaN(num) && num > 0) return num > 1000 ? num / 12 : num;
  return 0;
}

function nextBillDate(frequency: string): string {
  const d = new Date();
  const f = (frequency || 'monthly').toLowerCase();
  if (f.includes('week')) d.setDate(d.getDate() + 7);
  else if (f.includes('fortnight')) d.setDate(d.getDate() + 14);
  else if (f.includes('quarter')) d.setMonth(d.getMonth() + 3);
  else if (f.includes('year')) d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}

function mapFrequency(f: string): string {
  const l = (f || '').toLowerCase();
  if (l.includes('week')) return 'weekly';
  if (l.includes('fortnight') || l.includes('bi-week')) return 'fortnightly';
  if (l.includes('quarter')) return 'quarterly';
  if (l.includes('year') || l.includes('annual')) return 'yearly';
  return 'monthly';
}

function categorizeBill(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('rent') || n.includes('mortgage') || n.includes('strata')) return 'housing';
  if (n.includes('electric') || n.includes('gas') || n.includes('water') || n.includes('internet') || n.includes('phone')) return 'utilities';
  if (n.includes('insur')) return 'insurance';
  if (n.includes('netflix') || n.includes('spotify') || n.includes('disney') || n.includes('gym') || n.includes('member')) return 'subscription';
  if (n.includes('car') || n.includes('fuel') || n.includes('rego') || n.includes('transport')) return 'transport';
  if (n.includes('health') || n.includes('doctor') || n.includes('dental')) return 'health';
  return 'other';
}
