/**
 * FinanceAI (Holistic) — Domain-wide Finance AI Card
 *
 * Sits above the Finances page content. Pulls ALL financial data
 * (expenses, income, bills, budgets, businesses) and provides a
 * unified AI financial health summary with suggestions and Q&A.
 *
 * Glass card, orange → amber gradient, collapsible, daily cache.
 *
 * NOTE: This is the HOLISTIC layer. The existing FinanceAI in
 * components/finances/FinanceAI.tsx is a pattern-based NLP chat.
 * This component provides high-level AI analysis.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign, Brain, ChevronDown, ChevronUp, RefreshCw, Loader2,
  Send, Sparkles, ArrowUpCircle, ArrowDownCircle, Receipt, BarChart3,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../stores/useUserStore';
import { useSubscription } from '../../hooks/useSubscription';
import { callLLMSimple } from '../../lib/llm-proxy';
import { canAccess } from '../../lib/feature-gates';
import './FinanceAI.css';
import { logger } from '../../utils/logger';
import { getUIState, setUIState } from '../../utils/ui-state';

// ── Cache helpers ──

const CACHE_KEY_PREFIX = 'lifeos_finance_ai_holo_cache_';

interface CacheEntry {
  date: string;
  summary: string;
  suggestions: string[];
}

function getCached(userId: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];
    if (entry.date === today) return entry;
    return null;
  } catch { return null; }
}

function setCache(userId: string, summary: string, suggestions: string[]) {
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify({ date: today, summary, suggestions }));
}

// ── Data loader ──

interface FinanceSnapshot {
  monthIncome: number;
  monthExpenses: number;
  net: number;
  recentTransactions: string;
  billsSummary: string;
  topCategories: string;
  businessSummary: string;
}

async function loadFinanceSnapshot(userId: string): Promise<FinanceSnapshot> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const [incomeRes, expensesRes, txRes, billsRes, businessesRes, categoriesRes] = await Promise.all([
    supabase
      .from('income')
      .select('amount, source, date')
      .eq('user_id', userId)
      .gte('date', monthStart)
      .order('date', { ascending: false })
      .limit(20),
    supabase
      .from('expenses')
      .select('amount, description, category_id, date')
      .eq('user_id', userId)
      .gte('date', monthStart)
      .order('date', { ascending: false })
      .limit(20),
    supabase
      .from('transactions')
      .select('type, amount, title, date, category_id')
      .eq('user_id', userId)
      .gte('date', monthStart)
      .order('date', { ascending: false })
      .limit(20),
    supabase
      .from('bills')
      .select('title, amount, due_date, status, is_recurring')
      .eq('user_id', userId)
      .order('due_date', { ascending: true })
      .limit(10),
    supabase
      .from('businesses')
      .select('name, icon, type, status')
      .eq('user_id', userId)
      .limit(10),
    supabase
      .from('expense_categories')
      .select('id, name, icon')
      .eq('user_id', userId)
      .limit(20),
  ]);

  const incomeData = incomeRes.data || [];
  const expenseData = expensesRes.data || [];
  const txData = txRes.data || [];
  const bills = billsRes.data || [];
  const businesses = businessesRes.data || [];
  const categories = categoriesRes.data || [];

  // Calculate totals
  const monthIncome = incomeData.reduce((s: number, i: any) => s + i.amount, 0) +
    txData.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0);
  const monthExpenses = expenseData.reduce((s: number, e: any) => s + e.amount, 0) +
    txData.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0);
  const net = monthIncome - monthExpenses;

  // Recent transactions
  const allTx = [
    ...incomeData.map((i: any) => ({ type: 'income', amount: i.amount, desc: i.source || 'Income', date: i.date })),
    ...expenseData.map((e: any) => ({ type: 'expense', amount: e.amount, desc: e.description || 'Expense', date: e.date })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  const recentTransactions = allTx.length > 0
    ? allTx.map(t => `${t.type === 'income' ? '+' : '-'}$${t.amount.toFixed(2)} ${t.desc} (${t.date})`).join('\n')
    : 'No transactions this month.';

  // Bills
  const unpaidBills = bills.filter((b: any) => b.status !== 'paid');
  const overdueBills = unpaidBills.filter((b: any) => b.due_date < new Date().toISOString().split('T')[0]);
  const billsSummary = bills.length > 0
    ? `${unpaidBills.length} unpaid bills totalling $${unpaidBills.reduce((s: number, b: any) => s + b.amount, 0).toFixed(2)}. ${overdueBills.length} overdue. Upcoming: ${unpaidBills.slice(0, 3).map((b: any) => `${b.title} $${b.amount} due ${b.due_date}`).join(', ') || 'none'}`
    : 'No bills tracked.';

  // Top categories
  const catMap: Record<string, number> = {};
  expenseData.forEach((e: any) => {
    const catName = e.category_id ? (categories.find((c: any) => c.id === e.category_id)?.name || 'Other') : 'Uncategorized';
    catMap[catName] = (catMap[catName] || 0) + e.amount;
  });
  const topCategories = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, amt]) => `${name}: $${amt.toFixed(2)}`).join(', ') || 'No categorized expenses.';

  // Business summary
  const businessSummary = businesses.length > 0
    ? businesses.map((b: any) => `${b.icon || '💼'} ${b.name} (${b.type}, ${b.status})`).join(', ')
    : 'No businesses set up.';

  return { monthIncome, monthExpenses, net, recentTransactions, billsSummary, topCategories, businessSummary };
}

// ── Component ──

interface FinanceAIHoloProps {
  onSwitchTab?: (tab: string) => void;
  onFormMode?: (mode: string) => void;
}

export function FinanceAIHolo({ onSwitchTab, onFormMode }: FinanceAIHoloProps) {
  const user = useUserStore(s => s.user);
  const { tier } = useSubscription();
  // Collapsed by default after first view
  const [expanded, setExpanded] = useState(() => {
    const seen = getUIState('finance_ai_seen');
    if (!seen) {
      // First time — show expanded, mark as seen
      setUIState('finance_ai_seen');
      return true;
    }
    return false; // Subsequent visits — collapsed
  });
  const [summary, setSummary] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [askInput, setAskInput] = useState('');
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchSummary = useCallback(async (force = false) => {
    if (!user?.id) return;
    if (!canAccess('finances', tier)) return;

    // Check cache first
    if (!force) {
      const cached = getCached(user.id);
      if (cached) {
        setSummary(cached.summary);
        setSuggestions(cached.suggestions);
        return;
      }
    }

    setLoading(true);
    try {
      const snapshot = await loadFinanceSnapshot(user.id);

      const prompt = `You are a financial advisor AI for a personal life management app called LifeOS. Analyze this user's financial data and provide:
1. A brief financial health summary (2-3 sentences).
2. Up to 3 smart suggestions (one sentence each).

Format your response EXACTLY as:
SUMMARY: [your summary here]
SUGGESTION: [first suggestion]
SUGGESTION: [second suggestion]
SUGGESTION: [third suggestion if applicable]

Financial Data:
- Month Income: $${snapshot.monthIncome.toFixed(2)}
- Month Expenses: $${snapshot.monthExpenses.toFixed(2)}
- Net: ${snapshot.net >= 0 ? '+' : ''}$${snapshot.net.toFixed(2)}

Recent Transactions:
${snapshot.recentTransactions}

Bills:
${snapshot.billsSummary}

Top Expense Categories: ${snapshot.topCategories}

Businesses: ${snapshot.businessSummary}

Be specific with numbers. Be encouraging but honest. Use Australian dollars.`;

      const result = await callLLMSimple(prompt, { timeoutMs: 20000 });

      // Parse structured response
      const summaryMatch = result.match(/SUMMARY:\s*(.+?)(?=\nSUGGESTION:|$)/s);
      const suggestionMatches = [...result.matchAll(/SUGGESTION:\s*(.+)/g)];

      const parsedSummary = summaryMatch ? summaryMatch[1].trim() : result.split('\n')[0];
      const parsedSuggestions = suggestionMatches.map(m => m[1].trim()).filter(Boolean);

      setSummary(parsedSummary);
      setSuggestions(parsedSuggestions);
      setCache(user.id, parsedSummary, parsedSuggestions);
    } catch (err) {
      logger.error('[FinanceAI] Summary failed:', err);
      setSummary('Unable to generate financial summary right now. Try refreshing later.');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, tier]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Listen for finance changes
  useEffect(() => {
    const handler = () => {
      // Invalidate cache on data change
      localStorage.removeItem(CACHE_KEY);
      fetchSummary(true);
    };
    window.addEventListener('lifeos-refresh', handler);
    return () => window.removeEventListener('lifeos-refresh', handler);
  }, [fetchSummary]);

  const handleAsk = async () => {
    if (!askInput.trim() || asking || !user?.id) return;
    if (!canAccess('unlimited_ai', tier)) return;

    setAsking(true);
    setAskAnswer(null);

    try {
      const snapshot = await loadFinanceSnapshot(user.id);

      const prompt = `You are a financial AI assistant for LifeOS. Answer the user's finance question based on their data. Be helpful, specific, and concise (2-4 sentences). Use Australian dollars.

Financial Data:
- Month Income: $${snapshot.monthIncome.toFixed(2)}
- Month Expenses: $${snapshot.monthExpenses.toFixed(2)}
- Net: ${snapshot.net >= 0 ? '+' : ''}$${snapshot.net.toFixed(2)}

Recent Transactions:
${snapshot.recentTransactions}

Bills: ${snapshot.billsSummary}
Top Expense Categories: ${snapshot.topCategories}
Businesses: ${snapshot.businessSummary}

User question: ${askInput.trim()}

Respond directly and helpfully. No markdown formatting.`;

      const result = await callLLMSimple(prompt, { timeoutMs: 20000 });
      setAskAnswer(result);
    } catch (err) {
      logger.error('[FinanceAI] Ask failed:', err);
      setAskAnswer('Sorry, I couldn\'t process that right now. Try again later.');
    } finally {
      setAsking(false);
    }
  };

  // Don't render if no user or not accessible
  if (!user?.id || !canAccess('finances', tier)) return null;

  return (
    <div className="finance-ai-holo-card">
      <div className="fai-header" onClick={() => setExpanded(!expanded)}>
        <div className="fai-header-left">
          <div className="fai-icon-wrap">
            <DollarSign size={15} className="fai-icon-dollar" />
            <Brain size={13} className="fai-icon-brain" />
          </div>
          <h3 className="fai-title">Finance AI</h3>
        </div>
        <div className="fai-header-right">
          <button
            className="fai-refresh-btn"
            onClick={(e) => { e.stopPropagation(); fetchSummary(true); }}
            disabled={loading}
            title="Refresh analysis"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
          {expanded ? <ChevronUp size={14} className="fai-chevron" /> : <ChevronDown size={14} className="fai-chevron" />}
        </div>
      </div>

      {expanded && (
        <div className="fai-body">
          {/* Loading state */}
          {loading && !summary && (
            <div className="fai-loading">
              <div className="fai-pulse-dot" />
              <div className="fai-pulse-dot" />
              <div className="fai-pulse-dot" />
              <span>Analyzing your finances...</span>
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div className="fai-summary">{summary}</div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="fai-suggestions">
              {suggestions.map((s, i) => (
                <div key={i} className="fai-suggestion">
                  <Sparkles size={11} />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}

          {/* Quick actions */}
          <div className="fai-quick-actions">
            <button className="fai-quick-btn" onClick={() => onFormMode?.('expense')}>
              <ArrowDownCircle size={12} /> Log expense
            </button>
            <button className="fai-quick-btn" onClick={() => onFormMode?.('income')}>
              <ArrowUpCircle size={12} /> Log income
            </button>
            <button className="fai-quick-btn" onClick={() => onFormMode?.('bill')}>
              <Receipt size={12} /> Add bill
            </button>
            <button className="fai-quick-btn" onClick={() => onSwitchTab?.('analysis')}>
              <BarChart3 size={12} /> View analysis
            </button>
          </div>

          {/* Ask AI */}
          <div className="fai-ask-row">
            <input
              ref={inputRef}
              className="fai-ask-input"
              type="text"
              placeholder="Ask about your finances..."
              value={askInput}
              onChange={(e) => setAskInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              disabled={asking}
            />
            <button
              className="fai-ask-send"
              onClick={handleAsk}
              disabled={!askInput.trim() || asking}
            >
              {asking ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
            </button>
          </div>

          {/* AI Answer */}
          {askAnswer && (
            <div className="fai-answer">
              <div className="fai-answer-label">
                <Sparkles size={10} /> AI Response
              </div>
              {askAnswer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FinanceAIHolo;
