/**
 * Finance AI Assistant — Natural Language Interface for Financial Data
 * 
 * Pattern-based NLP for adding income, expenses, bills, clients via conversation.
 * No external LLM — all processing client-side.
 */

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Check, Edit2, Loader2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../stores/useUserStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { genId, todayStr, fmtCurrency } from '../../utils/date';
import { logger } from '../../utils/logger';

interface Pattern {
  regex: RegExp;
  handler: 'addIncome' | 'addExpense' | 'addBill' | 'addClient';
  extract: (match: RegExpMatchArray) => Partial<ParsedData>;
}

interface ParsedData {
  type: 'income' | 'expense' | 'bill' | 'client';
  amount?: number;
  description?: string;
  source?: string;
  category?: string;
  frequency?: 'hour' | 'week' | 'fortnight' | 'month' | 'year';
  hours?: number;
  company?: string;
  title?: string;
  dueDate?: string;
  name?: string;
  rate?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: Partial<ParsedData>;
  status?: 'pending' | 'confirmed' | 'cancelled';
}

const patterns: Pattern[] = [
  // Job income: "started a new job at Woolworths earning $28/hour, 30 hours a week"
  {
    regex: /(?:started|got|have)\s+(?:a\s+)?(?:new\s+)?job\s+(?:at|with)\s+(.+?)\s+(?:earning|making|for)\s+\$?([\d,.]+)\s*(?:\/|\s*per\s*)(hour|week|fortnight|month|year)(?:,?\s+(\d+)\s*(?:hours?\s+(?:a|per)\s+week))?/i,
    handler: 'addIncome',
    extract: (m) => ({
      type: 'income',
      source: m[1].trim(),
      amount: parseFloat(m[2].replace(/,/g, '')),
      frequency: m[3].toLowerCase() as 'hour' | 'week' | 'fortnight' | 'month' | 'year',
      hours: m[4] ? parseInt(m[4]) : undefined,
    }),
  },
  // Simple income: "received $500 from monthly client"
  {
    regex: /(?:paid|received|got|earned)\s+\$?([\d,.]+)\s+(?:from|by)\s+(.+)/i,
    handler: 'addIncome',
    extract: (m) => ({
      type: 'income',
      amount: parseFloat(m[1].replace(/,/g, '')),
      source: m[2].trim(),
    }),
  },
  // Expense: "spent $45 on fuel at BP"
  {
    regex: /(?:spent|paid|bought)\s+\$?([\d,.]+)\s+(?:on|for|at)\s+(.+)/i,
    handler: 'addExpense',
    extract: (m) => ({
      type: 'expense',
      amount: parseFloat(m[1].replace(/,/g, '')),
      description: m[2].trim(),
    }),
  },
  // Bill: "electricity bill from AGL is $180 due next Friday"
  {
    regex: /(?:bill|payment)\s+(?:for|from)\s+(.+?)\s+(?:is|of)\s+\$?([\d,.]+)(?:\s+due\s+(.+))?/i,
    handler: 'addBill',
    extract: (m) => ({
      type: 'bill',
      title: m[1].trim(),
      amount: parseFloat(m[2].replace(/,/g, '')),
      dueDate: m[3] ? parseDueDate(m[3].trim()) : todayStr(),
    }),
  },
  // Client: "new client paying $200 per session"
  {
    regex: /(?:new\s+)?(?:client|customer)\s+(.+?)\s+(?:paying|for)\s+\$?([\d,.]+)/i,
    handler: 'addClient',
    extract: (m) => ({
      type: 'client',
      name: m[1].trim(),
      rate: parseFloat(m[2].replace(/,/g, '')),
    }),
  },
];

function parseDueDate(str: string): string {
  const lower = str.toLowerCase();
  const today = new Date();
  
  if (lower.includes('today')) return todayStr();
  if (lower.includes('tomorrow')) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
  if (lower.includes('next week')) {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }
  if (lower.match(/next\s+(mon|tue|wed|thu|fri|sat|sun)/)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }
  return todayStr();
}

function normalizeToMonthly(amount: number, freq: string, hours?: number): number {
  if (freq === 'hour' && hours) return amount * hours * 4.33; // 4.33 weeks/month
  if (freq === 'hour') return amount * 40 * 4.33; // assume 40h/week
  if (freq === 'week') return amount * 4.33;
  if (freq === 'fortnight') return amount * 2.165;
  if (freq === 'month') return amount;
  if (freq === 'year') return amount / 12;
  return amount;
}

function suggestCategory(desc: string, categories: { id: string; name: string }[]): string | null {
  const d = desc.toLowerCase();
  
  // Groceries
  if (d.includes('coles') || d.includes('woolworth') || d.includes('iga') || d.includes('aldi') || d.includes('grocer') || d.includes('food')) {
    return categories.find(c => c.name.toLowerCase().includes('grocer') || c.name.toLowerCase().includes('food'))?.id || null;
  }
  
  // Fuel
  if (d.includes('fuel') || d.includes('petrol') || d.includes('shell') || d.includes('bp') || d.includes('caltex') || d.includes('7-eleven')) {
    return categories.find(c => c.name.toLowerCase().includes('transport') || c.name.toLowerCase().includes('fuel') || c.name.toLowerCase().includes('car'))?.id || null;
  }
  
  // Subscriptions
  if (d.includes('netflix') || d.includes('spotify') || d.includes('gym') || d.includes('subscription')) {
    return categories.find(c => c.name.toLowerCase().includes('sub'))?.id || null;
  }
  
  return null;
}

export function FinanceAI() {
  const user = useUserStore(s => s.user);
  const { businesses, categories, fetchAll } = useFinanceStore();
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const parseMessage = (text: string): Partial<ParsedData> | null => {
    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        return pattern.extract(match);
      }
    }
    return null;
  };

  const handleSend = () => {
    if (!input.trim() || processing) return;

    const userMsg: Message = {
      id: genId(),
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setProcessing(true);

    // Simulate processing delay
    setTimeout(() => {
      const parsed = parseMessage(userMsg.content);
      
      if (parsed) {
        // Enrich expense with category suggestion
        if (parsed.type === 'expense' && parsed.description) {
          const categoryId = suggestCategory(parsed.description, categories);
          if (categoryId) {
            parsed.category = categoryId;
          }
        }

        const assistantMsg: Message = {
          id: genId(),
          role: 'assistant',
          content: getConfirmationMessage(parsed),
          data: parsed,
          status: 'pending',
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        const assistantMsg: Message = {
          id: genId(),
          role: 'assistant',
          content: "Sorry, I didn't quite understand that. Try something like:\n\n• \"Started a new job at Woolworths earning $28/hour, 30 hours a week\"\n• \"Received $500 from monthly client\"\n• \"Spent $45 on fuel at BP\"\n• \"Electricity bill from AGL is $180 due next Friday\"\n• \"New client paying $200 per session\"",
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
      setProcessing(false);
    }, 300);
  };

  const getConfirmationMessage = (data: Partial<ParsedData>): string => {
    if (data.type === 'income') {
      if (data.frequency && data.frequency !== 'month') {
        const monthly = normalizeToMonthly(data.amount || 0, data.frequency, data.hours);
        return `Got it! I'll add ${data.source} as income:\n\n• ${fmtCurrency(data.amount!)}/${data.frequency}${data.hours ? ` (${data.hours}h/week)` : ''}\n• ~${fmtCurrency(monthly)}/month\n\nConfirm?`;
      }
      return `Got it! I'll add ${fmtCurrency(data.amount!)} income from ${data.source}.\n\nConfirm?`;
    }
    
    if (data.type === 'expense') {
      const categoryName = data.category ? categories.find(c => c.id === data.category)?.name : null;
      return `Got it! I'll add an expense:\n\n• ${fmtCurrency(data.amount!)}\n• ${data.description}${categoryName ? `\n• Category: ${categoryName}` : ''}\n\nConfirm?`;
    }
    
    if (data.type === 'bill') {
      return `Got it! I'll add a bill:\n\n• ${data.title}\n• ${fmtCurrency(data.amount!)}\n• Due: ${data.dueDate}\n\nConfirm?`;
    }
    
    if (data.type === 'client') {
      return `Got it! I'll add client ${data.name} at ${fmtCurrency(data.rate!)}/clean.\n\nConfirm?`;
    }
    
    return '';
  };

  const handleConfirm = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || !msg.data) return;

    setProcessing(true);

    try {
      if (msg.data.type === 'income') {
        const amount = msg.data.amount!;
        const source = msg.data.source!;
        const isRecurring = !!msg.data.frequency;
        const description = msg.data.hours 
          ? `${source} — ${msg.data.amount}/${msg.data.frequency}, ${msg.data.hours}h/week`
          : `${source} — ${msg.data.amount}/${msg.data.frequency || 'once'}`;

        const incId = genId();
        const txId = genId();

        await Promise.all([
          supabase.from('income').insert({
            id: incId,
            user_id: user?.id,
            amount,
            date: todayStr(),
            description,
            source,
            is_recurring: isRecurring,
          }),
          supabase.from('transactions').insert({
            id: txId,
            user_id: user?.id,
            type: 'income',
            amount,
            title: source,
            date: todayStr(),
          }),
        ]);

        setMessages(prev => prev.map(m => 
          m.id === msgId ? { ...m, status: 'confirmed' as const } : m
        ));

        // Add success message with suggestions
        const monthly = msg.data.frequency 
          ? normalizeToMonthly(amount, msg.data.frequency, msg.data.hours)
          : amount;
        
        setTimeout(() => {
          const successMsg: Message = {
            id: genId(),
            role: 'assistant',
            content: `✅ Added! Your estimated monthly income from ${source} is ${fmtCurrency(monthly)}.\n\n💡 Want to add related expenses like fuel or uniforms?`,
          };
          setMessages(prev => [...prev, successMsg]);
        }, 500);

      } else if (msg.data.type === 'expense') {
        const expId = genId();
        const txId = genId();

        await Promise.all([
          supabase.from('expenses').insert({
            id: expId,
            user_id: user?.id,
            amount: msg.data.amount!,
            date: todayStr(),
            description: msg.data.description!,
            category_id: msg.data.category || null,
            is_deductible: false,
          }),
          supabase.from('transactions').insert({
            id: txId,
            user_id: user?.id,
            type: 'expense',
            amount: msg.data.amount!,
            title: msg.data.description!,
            date: todayStr(),
            category_id: msg.data.category || null,
          }),
        ]);

        setMessages(prev => prev.map(m => 
          m.id === msgId ? { ...m, status: 'confirmed' as const } : m
        ));

        setTimeout(() => {
          const successMsg: Message = {
            id: genId(),
            role: 'assistant',
            content: `✅ Expense added! Total expenses this month: ${fmtCurrency(useFinanceStore.getState().monthExpenses())}.`,
          };
          setMessages(prev => [...prev, successMsg]);
        }, 500);

      } else if (msg.data.type === 'bill') {
        const billId = genId();

        await supabase.from('bills').insert({
          id: billId,
          user_id: user?.id,
          title: msg.data.title!,
          amount: msg.data.amount!,
          due_date: msg.data.dueDate!,
          is_recurring: false,
          status: 'pending',
        });

        setMessages(prev => prev.map(m => 
          m.id === msgId ? { ...m, status: 'confirmed' as const } : m
        ));

        setTimeout(() => {
          const successMsg: Message = {
            id: genId(),
            role: 'assistant',
            content: `✅ Bill added! I'll remind you before the due date.`,
          };
          setMessages(prev => [...prev, successMsg]);
        }, 500);

      } else if (msg.data.type === 'client') {
        // For clients, we need a business_id — use first active business or prompt
        const activeBiz = businesses.find(b => b.status === 'active');
        
        if (!activeBiz) {
          setMessages(prev => prev.map(m => 
            m.id === msgId ? { ...m, status: 'cancelled' as const } : m
          ));
          const errorMsg: Message = {
            id: genId(),
            role: 'assistant',
            content: `⚠️ You need to create a business first. Go to the Work tab to add one.`,
          };
          setMessages(prev => [...prev, errorMsg]);
          setProcessing(false);
          return;
        }

        const clientId = genId();

        await supabase.from('clients').insert({
          id: clientId,
          user_id: user?.id,
          name: msg.data.name!,
          business_id: activeBiz.id,
          rate: msg.data.rate!,
          rate_type: 'per_clean',
          is_active: true,
          is_deleted: false,
          sync_status: 'synced',
        });

        setMessages(prev => prev.map(m => 
          m.id === msgId ? { ...m, status: 'confirmed' as const } : m
        ));

        setTimeout(() => {
          const successMsg: Message = {
            id: genId(),
            role: 'assistant',
            content: `✅ Client added to ${activeBiz.name}!`,
          };
          setMessages(prev => [...prev, successMsg]);
        }, 500);
      }

      fetchAll(); // Refresh finance store
    } catch (error: unknown) {
      logger.error('Finance AI save error:', error);
      setMessages(prev => prev.map(m => 
        m.id === msgId ? { ...m, status: 'cancelled' as const } : m
      ));
      const errorMsg: Message = {
        id: genId(),
        role: 'assistant',
        content: `❌ Something went wrong. Please try again.`,
      };
      setMessages(prev => [...prev, errorMsg]);
    }

    setProcessing(false);
  };

  const handleCancel = (msgId: string) => {
    setMessages(prev => prev.map(m => 
      m.id === msgId ? { ...m, status: 'cancelled' as const } : m
    ));
  };

  if (!expanded) {
    return (
      <div className="finance-ai-collapsed" onClick={() => setExpanded(true)}>
        <Sparkles size={20} className="finance-ai-icon" />
        <span className="finance-ai-label">AI Assistant</span>
        <span className="finance-ai-badge">NEW</span>
      </div>
    );
  }

  return (
    <div className="finance-ai-container">
      <div className="finance-ai-header">
        <div className="finance-ai-title">
          <Sparkles size={18} className="finance-ai-icon" />
          <span>Finance AI Assistant</span>
        </div>
        <button className="finance-ai-collapse" onClick={() => setExpanded(false)}>
          <X size={18} />
        </button>
      </div>

      <div className="finance-ai-messages">
        {messages.length === 0 && (
          <div className="finance-ai-welcome">
            <Sparkles size={32} className="finance-ai-welcome-icon" />
            <h3>Hi! I'm your Finance AI</h3>
            <p>Tell me about your income, expenses, bills, or clients in plain English. I'll handle the rest.</p>
            <div className="finance-ai-examples">
              <div className="finance-ai-example">
                <DollarSign size={14} />
                <span>"Started a new job at Woolworths earning $28/hour"</span>
              </div>
              <div className="finance-ai-example">
                <TrendingDown size={14} />
                <span>"Spent $45 on fuel at BP"</span>
              </div>
              <div className="finance-ai-example">
                <TrendingUp size={14} />
                <span>"Received $500 from client"</span>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`finance-ai-message ${msg.role}`}>
            {msg.role === 'assistant' && (
              <Sparkles size={16} className="finance-ai-avatar" />
            )}
            <div className="finance-ai-bubble">
              <p style={{ whiteSpace: 'pre-line' }}>{msg.content}</p>
              
              {msg.data && msg.status === 'pending' && (
                <div className="finance-ai-actions">
                  <button 
                    className="finance-ai-btn confirm"
                    onClick={() => handleConfirm(msg.id)}
                    disabled={processing}
                  >
                    {processing ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                    Confirm
                  </button>
                  <button 
                    className="finance-ai-btn cancel"
                    onClick={() => handleCancel(msg.id)}
                    disabled={processing}
                  >
                    <X size={14} />
                    Cancel
                  </button>
                </div>
              )}

              {msg.status === 'confirmed' && (
                <div className="finance-ai-status confirmed">
                  <Check size={14} /> Saved
                </div>
              )}

              {msg.status === 'cancelled' && (
                <div className="finance-ai-status cancelled">
                  <X size={14} /> Cancelled
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="finance-ai-avatar user">You</div>
            )}
          </div>
        ))}

        {processing && messages[messages.length - 1]?.role === 'user' && (
          <div className="finance-ai-message assistant">
            <Sparkles size={16} className="finance-ai-avatar" />
            <div className="finance-ai-bubble">
              <Loader2 size={16} className="spin" /> Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="finance-ai-input-area">
        <input
          ref={inputRef}
          type="text"
          className="finance-ai-input"
          placeholder="Tell me about your finances..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={processing}
        />
        <button 
          className="finance-ai-send"
          onClick={handleSend}
          disabled={!input.trim() || processing}
        >
          {processing ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
