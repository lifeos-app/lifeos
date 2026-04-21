import { useState, useEffect, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/useUserStore';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { MiniChart } from '../components/MiniChart';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { ErrorCard } from '../components/ui/ErrorCard';
import { SpotlightTour } from '../components/SpotlightTour';
import { FullscreenPage } from '../components/FullscreenPage';
import { FinancesSkeleton } from '../components/skeletons';
import {
  Wallet, BarChart3, ArrowUpCircle, ArrowDownCircle,
  Receipt, Briefcase, Sparkles,
} from 'lucide-react';
import { useFinanceActions } from '../components/finances/useFinanceActions';
import { useFinanceComputed } from '../components/finances/useFinanceComputed';
import { FinanceSummary } from '../components/finances/FinanceSummary';
import { FinanceTabActions } from '../components/finances/FinanceTabActions';
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
import './Finances.css';

const FINANCE_TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3, color: '#A855F7' },
  { id: 'income', label: 'Income', icon: ArrowUpCircle, color: '#39FF14' },
  { id: 'expenses', label: 'Expenses', icon: ArrowDownCircle, color: '#F43F5E' },
  { id: 'bills', label: 'Bills', icon: Receipt, color: '#F97316' },
  { id: 'work', label: 'Work', icon: Briefcase, color: '#00D4FF' },
  { id: 'analysis', label: 'Analysis', icon: Sparkles, color: '#FBBF24' },
];

export function Finances() {
  const user = useUserStore(s => s.user);
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
  const [monthlyData, setMonthlyData] = useState<{ month: string; income: number; expenses: number }[]>([]);
  const [loading, setLoading] = useState(true);
  // ── UI State ──
  const [expandedBusiness, setExpandedBusiness] = useState<string | null>(null);
  const [overviewDonutSlice, setOverviewDonutSlice] = useState<number | null>(null);
  const [cashflowMonthIdx, setCashflowMonthIdx] = useState<number | null>(null);
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [expensesDonutSlice, setExpensesDonutSlice] = useState<number | null>(null);
  const [incomeMonthIdx, setIncomeMonthIdx] = useState<number | null>(null);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  // ── Transaction filters ──
  const [txSearch, setTxSearch] = useState('');
  const [txCategoryFilter, setTxCategoryFilter] = useState<string | null>(null);
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
    setIncome(incData);
    setExpenses(expData);
    setBills(finStore.bills as unknown as Bill[]);
    setClients(finStore.clients as unknown as Client[]);
    setBusinesses(finStore.businesses as unknown as Business[]);
    setCategories(finStore.categories as unknown as ExpenseCategory[]);
    setTransactions(finStore.transactions as unknown as Transaction[]);
    setBudgets(finStore.budgets as unknown as { id?: string; month: string; category_id: string; amount: number }[]);
    setTasks(schedStore.tasks.filter((t: { financial_amount?: number }) => t.financial_amount != null) as unknown as FinanceTask[]);
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
    actions.setFormMode(null);
    setDrillCategory(null);
    setExpensesDonutSlice(null);
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // HOOKS
  // ══════════════════════════════════════════════════════════════════════════════
  const actions = useFinanceActions(fetchAll);
  const computed = useFinanceComputed({
    income, expenses, bills, clients, businesses, categories,
    transactions, budgets, tasks, goals, monthlyData,
  });

  // ── Modal close+refresh helper ──
  const handleModalSaved = () => { actions.setFormMode(null); fetchAll(); };
  const handleModalClose = () => { actions.setFormMode(null); };

  // ── Budget editor helper (wraps openBudgetEditor with current data) ──
  const openBudgetEditorForCat = (cat: ExpenseCategory) => {
    actions.openBudgetEditor(cat, computed.som, expenses, transactions, budgets);
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ══════════════════════════════════════════════════════════════════════════════
  const ctxValue: FinancesCtxValue = {
    income, expenses, bills, clients, businesses, categories, transactions, budgets, tasks, goals, monthlyData, loading,
    tab, switchTab, formMode: actions.formMode, setFormMode: actions.setFormMode,
    saving: actions.saving, error: actions.error, setError: actions.setError,
    expandedBusiness, setExpandedBusiness, expandedTx, setExpandedTx,
    overviewDonutSlice, setOverviewDonutSlice, cashflowMonthIdx, setCashflowMonthIdx,
    drillCategory, setDrillCategory, expensesDonutSlice, setExpensesDonutSlice, incomeMonthIdx, setIncomeMonthIdx,
    editingId: actions.editingId, setEditingId: actions.setEditingId,
    editAmount: actions.editAmount, setEditAmount: actions.setEditAmount,
    editDesc: actions.editDesc, setEditDesc: actions.setEditDesc,
    editDate: actions.editDate, setEditDate: actions.setEditDate,
    editSaving: actions.editSaving,
    startEditing: actions.startEditing, saveInlineEdit: actions.saveInlineEdit, cancelEditing: actions.cancelEditing,
    editingBillId: actions.editingBillId, setEditingBillId: actions.setEditingBillId,
    editBillTitle: actions.editBillTitle, setEditBillTitle: actions.setEditBillTitle,
    editBillAmount: actions.editBillAmount, setEditBillAmount: actions.setEditBillAmount,
    editBillDue: actions.editBillDue, setEditBillDue: actions.setEditBillDue,
    saveBillEdit: actions.saveBillEdit,
    editingBizId: actions.editingBizId, setEditingBizId: actions.setEditingBizId,
    editBizName: actions.editBizName, setEditBizName: actions.setEditBizName,
    editBizIcon: actions.editBizIcon, setEditBizIcon: actions.setEditBizIcon,
    editBizType: actions.editBizType, setEditBizType: actions.setEditBizType,
    saveBizEdit: actions.saveBizEdit,
    txSearch, setTxSearch, txCategoryFilter, setTxCategoryFilter,
    editingBudget: actions.editingBudget, setEditingBudget: actions.setEditingBudget,
    budgetValue: actions.budgetValue, setBudgetValue: actions.setBudgetValue,
    saveBudget: actions.saveBudget, openBudgetEditor: openBudgetEditorForCat,
    budgetEditorOpen: actions.budgetEditorOpen, setBudgetEditorOpen: actions.setBudgetEditorOpen,
    selectedCategoryForBudget: actions.selectedCategoryForBudget, setSelectedCategoryForBudget: actions.setSelectedCategoryForBudget,
    fetchAll, resetForms: actions.resetForms,
    confirmDelete: actions.confirmDelete, deleteRow: actions.deleteRow, togglePaid: actions.togglePaid,
    som: computed.som, monthIncome: computed.monthIncome, monthExpenses: computed.monthExpenses,
    net: computed.net, overdueBills: computed.overdueBills, upcomingBillsTotal: computed.upcomingBillsTotal,
    predictions: computed.predictions, incomeBySource: computed.incomeBySource,
    expenseByCategory: computed.expenseByCategory, budgetHealth: computed.budgetHealth,
    financialTasks: computed.financialTasks, businessFinancials: computed.businessFinancials,
    personalCategories: computed.personalCategories, analysisIncome: computed.analysisIncome,
    analysisExpenses: computed.analysisExpenses, categoryTrends: computed.categoryTrends,
    businessPL: computed.businessPL, savingsRate: computed.savingsRate,
    deductibleExpenses: computed.deductibleExpenses, financialInsights: computed.financialInsights,
    incomeBySourceMonthly: computed.incomeBySourceMonthly,
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
          !loading ? <Suspense fallback={null}><LazyFinanceAIHolo onSwitchTab={(t) => switchTab(t as Tab)} onFormMode={(m: string) => actions.setFormMode(m as FormMode)} /></Suspense> : undefined
        }
      >
      <div className="finances">
        {/* Action buttons */}
        {!loading && <FinanceTabActions tab={tab} setFormMode={actions.setFormMode} />}

        {loading && <FinancesSkeleton />}

        {/* Empty state */}
        {!loading && income.length === 0 && expenses.length === 0 && bills.length === 0 && transactions.length === 0 && (
          <EmptyState variant="finances" action={{ label: 'Add First Income', onClick: () => actions.setFormMode('income') }} />
        )}

        {/* Summary Stats */}
        {!loading && (
          <FinanceSummary
            monthIncome={computed.monthIncome}
            monthExpenses={computed.monthExpenses}
            net={computed.net}
            upcomingBillsTotal={computed.upcomingBillsTotal}
            overdueBills={computed.overdueBills}
            monthlyData={monthlyData}
          />
        )}

        {actions.error && <ErrorCard message={actions.error} />}

        {/* Tab Content */}
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

        {/* ── FORM MODALS ── */}
        {actions.formMode === 'income' && <IncomeFormModal onClose={handleModalClose} onSaved={handleModalSaved} />}
        {actions.formMode === 'expense' && <ExpenseFormModal onClose={handleModalClose} onSaved={handleModalSaved} />}
        {actions.formMode === 'bill' && <BillFormModal onClose={handleModalClose} onSaved={handleModalSaved} />}
        {actions.formMode === 'business' && <BusinessFormModal onClose={handleModalClose} onSaved={handleModalSaved} />}
        {actions.formMode === 'client' && <ClientFormModal onClose={handleModalClose} onSaved={handleModalSaved} />}
        {actions.formMode === 'category' && <CategoryFormModal onClose={handleModalClose} onSaved={handleModalSaved} />}

        {actions.editingBillId && (
          <BillEditModal
            billId={actions.editingBillId}
            initialTitle={actions.editBillTitle}
            initialAmount={actions.editBillAmount}
            initialDue={actions.editBillDue}
            onClose={() => actions.setEditingBillId(null)}
            onSaved={() => { actions.setEditingBillId(null); fetchAll(); }}
          />
        )}

        {actions.budgetEditorOpen && actions.selectedCategoryForBudget && (
          <BudgetEditorModal
            category={actions.selectedCategoryForBudget}
            onClose={() => { actions.setBudgetEditorOpen(false); actions.setSelectedCategoryForBudget(null); }}
            onSaved={() => { actions.setBudgetEditorOpen(false); actions.setSelectedCategoryForBudget(null); }}
          />
        )}

        <ConfirmDialog
          open={!!actions.confirmAction}
          title={actions.confirmMsg.title}
          message={actions.confirmMsg.message}
          onConfirm={() => { actions.confirmAction?.(); actions.setConfirmAction(null); }}
          onCancel={() => actions.setConfirmAction(null)}
        />

        <SpotlightTour tourId="finance" />
      </div>
      </FullscreenPage>
    </FinancesProvider>
  );
}