import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ArrowRight, CheckSquare, Calendar, Target,
  Zap, DollarSign, BookOpen, Heart, LayoutDashboard,
  Settings, Sparkles, Sun, BarChart3, Inbox, Command,
} from 'lucide-react';
import { safeScrollIntoView } from '../utils/scroll';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface CommandItem {
  id: string;
  category: 'actions' | 'navigate' | 'ai';
  icon: typeof Search;
  label: string;
  description?: string;
  shortcut?: string;
  action: () => void;
}

const RECENT_KEY = 'lifeos_recent_commands';

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // ─── Commands ──────────────────────────────────────────────
  const commands: CommandItem[] = useMemo(() => [
    // Actions
    { id: 'add-task', category: 'actions', icon: CheckSquare, label: 'Add Task', description: 'Create a new task',
      action: () => { navigate('/'); document.dispatchEvent(new Event('open-ai-chat')); } },
    { id: 'add-event', category: 'actions', icon: Calendar, label: 'Schedule Event', description: 'Add to your calendar',
      action: () => navigate('/schedule') },
    { id: 'log-habit', category: 'actions', icon: Zap, label: 'Log Habit', description: 'Mark a habit as done',
      action: () => navigate('/habits') },
    { id: 'add-expense', category: 'actions', icon: DollarSign, label: 'Log Expense', description: 'Record spending',
      action: () => { document.dispatchEvent(new Event('open-ai-chat')); } },
    { id: 'journal', category: 'actions', icon: BookOpen, label: 'Write Journal', description: 'New journal entry',
      action: () => navigate('/reflect/journal') },
    { id: 'add-goal', category: 'actions', icon: Target, label: 'Create Goal', description: 'Set a new goal',
      action: () => navigate('/goals') },
    
    // Navigate
    { id: 'nav-dashboard', category: 'navigate', icon: LayoutDashboard, label: 'Dashboard', shortcut: '',
      action: () => navigate('/') },
    { id: 'nav-schedule', category: 'navigate', icon: Calendar, label: 'Schedule', 
      action: () => navigate('/schedule') },
    { id: 'nav-goals', category: 'navigate', icon: Target, label: 'Goals',
      action: () => navigate('/goals') },
    { id: 'nav-habits', category: 'navigate', icon: Zap, label: 'Habits',
      action: () => navigate('/habits') },
    { id: 'nav-finances', category: 'navigate', icon: DollarSign, label: 'Finances',
      action: () => navigate('/finances') },
    { id: 'nav-health', category: 'navigate', icon: Heart, label: 'Health',
      action: () => navigate('/health') },
    { id: 'nav-journal', category: 'navigate', icon: BookOpen, label: 'Journal',
      action: () => navigate('/reflect/journal') },
    { id: 'nav-review', category: 'navigate', icon: BarChart3, label: 'Review',
      action: () => navigate('/reflect/review') },
    { id: 'nav-inbox', category: 'navigate', icon: Inbox, label: 'Inbox',
      action: () => navigate('/reflect/inbox') },
    { id: 'nav-settings', category: 'navigate', icon: Settings, label: 'Settings',
      action: () => navigate('/settings') },
    
    // AI
    { id: 'ai-chat', category: 'ai', icon: Sparkles, label: 'Ask AI Anything', shortcut: '⌘J',
      description: 'Open AI chat assistant',
      action: () => document.dispatchEvent(new Event('open-ai-chat')) },
    { id: 'ai-morning', category: 'ai', icon: Sun, label: 'Morning Brief',
      description: 'Your daily overview',
      action: () => { document.dispatchEvent(new Event('open-ai-chat')); } },
    { id: 'ai-next', category: 'ai', icon: ArrowRight, label: 'What Should I Do Next?',
      description: 'AI recommends your next action',
      action: () => document.dispatchEvent(new Event('open-ai-chat')) },
    { id: 'ai-weekly', category: 'ai', icon: BarChart3, label: 'Weekly Summary',
      description: 'How was your week?',
      action: () => document.dispatchEvent(new Event('open-ai-chat')) },
  ], [navigate]);

  // ─── Fuzzy search ─────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(cmd => {
      const text = `${cmd.label} ${cmd.description || ''} ${cmd.category}`.toLowerCase();
      // Simple fuzzy: all chars in order
      let qi = 0;
      for (let i = 0; i < text.length && qi < q.length; i++) {
        if (text[i] === q[qi]) qi++;
      }
      return qi === q.length;
    });
  }, [query, commands]);

  // ─── Recent commands ──────────────────────────────────────
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch { return []; }
  });

  const addRecent = useCallback((id: string) => {
    const updated = [id, ...recentIds.filter(r => r !== id)].slice(0, 5);
    setRecentIds(updated);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)); } catch { /* Safari private */ }
  }, [recentIds]);

  // ─── Grouped results ─────────────────────────────────────
  const grouped = useMemo(() => {
    const groups: { label: string; items: CommandItem[] }[] = [];
    
    if (!query.trim() && recentIds.length > 0) {
      const recent = recentIds.map(id => commands.find(c => c.id === id)).filter(Boolean) as CommandItem[];
      if (recent.length > 0) groups.push({ label: 'Recent', items: recent });
    }

    const categories: { key: string; label: string }[] = [
      { key: 'actions', label: 'Actions' },
      { key: 'navigate', label: 'Navigate' },
      { key: 'ai', label: 'AI Intelligence' },
    ];

    for (const cat of categories) {
      const items = filtered.filter(c => c.category === cat.key);
      if (items.length > 0) groups.push({ label: cat.label, items });
    }

    return groups;
  }, [filtered, query, recentIds, commands]);

  const flatItems = useMemo(() => grouped.flatMap(g => g.items), [grouped]);

  // ─── Keyboard shortcut: Cmd+K ─────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, flatItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          executeCommand(flatItems[selectedIndex]);
        }
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    safeScrollIntoView(el, { block: 'nearest' });
  }, [selectedIndex]);

  const executeCommand = (cmd: CommandItem) => {
    addRecent(cmd.id);
    setOpen(false);
    cmd.action();
  };

  if (!open) return null;

  let itemIndex = -1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh',
        animation: 'palette-fade 0.15s ease-out',
      }}
      onClick={() => setOpen(false)}
    >
      <style>{`
        @keyframes palette-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes palette-slide { from { opacity: 0; transform: translateY(-10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
      <div
        style={{
          width: '100%', maxWidth: 540,
          background: '#0A1628',
          border: '1px solid rgba(0, 212, 255, 0.15)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          animation: 'palette-slide 0.2s ease-out',
          margin: '0 16px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
        }}>
          <Search size={18} style={{ color: '#5A7A9A', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 15, color: '#E8F0FE', fontFamily: 'inherit',
            }}
          />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.05)',
            fontSize: 11, color: '#5A7A9A',
          }}>
            <Command size={10} /> K
          </div>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{
            maxHeight: 380, overflowY: 'auto',
            padding: '8px',
          }}
        >
          {grouped.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#5A7A9A', fontSize: 13 }}>
              No results for "{query}"
            </div>
          )}

          {grouped.map(group => (
            <div key={group.label} style={{ marginBottom: 8 }}>
              <div style={{
                padding: '6px 10px', fontSize: 11, fontWeight: 600,
                color: '#5A7A9A', textTransform: 'uppercase', letterSpacing: 0.5,
              }}>
                {group.label}
              </div>
              {group.items.map(item => {
                itemIndex++;
                const idx = itemIndex;
                const isSelected = idx === selectedIndex;
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    data-index={idx}
                    onClick={() => executeCommand(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 8,
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(0, 212, 255, 0.08)' : 'transparent',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    <Icon size={16} style={{ color: isSelected ? '#00D4FF' : '#5A7A9A', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: isSelected ? '#E8F0FE' : '#C5D5E8' }}>
                        {item.label}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: 11, color: '#5A7A9A', marginTop: 1 }}>
                          {item.description}
                        </div>
                      )}
                    </div>
                    {item.shortcut && (
                      <span style={{
                        fontSize: 11, color: '#5A7A9A',
                        padding: '2px 6px', borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.04)',
                      }}>
                        {item.shortcut}
                      </span>
                    )}
                    {isSelected && <ArrowRight size={12} style={{ color: '#00D4FF' }} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 18px',
          borderTop: '1px solid rgba(0, 212, 255, 0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 11, color: '#3A5A7A',
        }}>
          <span>↑↓ Navigate · ↵ Select · Esc Close</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={10} /> LifeOS
          </span>
        </div>
      </div>
    </div>
  );
}
