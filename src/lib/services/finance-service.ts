import { useFinanceStore } from '../../stores/useFinanceStore';
import { localDateStr } from '../../utils/date';

export const FinanceService = {
  balance() {
    const store = useFinanceStore.getState();
    return { income: store.monthIncome(), expenses: store.monthExpenses(), net: store.netCashflow() };
  },
  upcomingBills(days = 7) {
    const store = useFinanceStore.getState();
    const today = localDateStr();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const cutoffStr = localDateStr(cutoff);
    return store.bills.filter(b => b.due_date >= today && b.due_date <= cutoffStr && b.status !== 'paid');
  },
  stats() {
    const store = useFinanceStore.getState();
    const unpaid = store.bills.filter(b => b.status !== 'paid');
    return {
      monthIncome: store.monthIncome(),
      monthExpenses: store.monthExpenses(),
      net: store.netCashflow(),
      billCount: store.bills.length,
      unpaidBills: unpaid.length,
    };
  },
};
