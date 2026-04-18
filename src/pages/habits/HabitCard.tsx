import { useState, useRef, useCallback } from 'react';
import type { Habit, HabitLog } from '../../stores/useHabitsStore';
import { todayStr, localDateStr } from '../../utils/date';
import { Check, Loader2, X, Pencil, BarChart3, TrendingUp, Award, Sparkles, Flame } from 'lucide-react';
import { HabitIcon, HABIT_ICONS } from '../../components/HabitIcon';

const FREQUENCIES = ['daily', 'weekdays', 'weekends', 'weekly'];
const HABIT_COLORS = ['#00D4FF', '#A855F7', '#39FF14', '#F97316', '#EC4899', '#FACC15', '#06B6D4', '#F43F5E'];

// ── Category config ──
const CATEGORIES: Record<string, { label: string; color: string }> = {
  health: { label: 'Health', color: '#39FF14' },
  work:   { label: 'Work',   color: '#3B82F6' },
  mind:   { label: 'Mind',   color: '#A855F7' },
  body:   { label: 'Body',   color: '#F97316' },
  spirit: { label: 'Spirit', color: '#06B6D4' },
};

export function getCategoryColor(cat?: string | null): string {
  if (!cat) return 'transparent';
  return CATEGORIES[cat]?.color || 'transparent';
}

function getTodayCount(logs: HabitLog[]): number {
  return logs.filter(l => l.date === todayStr()).reduce((s: number, l) => s + (l.count || 1), 0);
}

function isTodayDone(logs: HabitLog[], targetCount: number): boolean {
  return getTodayCount(logs) >= targetCount;
}

function isPerfectWeek(logs: HabitLog[], targetCount: number): boolean {
  const last7 = getLast7Days();
  return last7.every(day => {
    const dayLogs = logs.filter(l => l.date === day.date);
    const total = dayLogs.reduce((s: number, l) => s + (l.count || 1), 0);
    return total >= targetCount;
  });
}

function getLast7Days(): { date: string; label: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { date: localDateStr(d), label: d.toLocaleDateString('en', { weekday: 'narrow' }) };
  });
}

function getLast30Days(): { date: string; label: string; dayOfWeek: number }[] {
  const days: { date: string; label: string; dayOfWeek: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push({ date: localDateStr(d), label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }), dayOfWeek: d.getDay() });
  }
  return days;
}

// ── Streak Flame Visual ──
function StreakFlame({ streak }: { streak: number }) {
  if (streak <= 0) return <Flame size={20} color="#5A7A9A" />;
  
  // Tier: 1-3 small, 4-7 medium, 8-14 large, 15+ blazing
  let size = 20;
  let color = '#F97316';
  let className = 'flame-tier-1';
  
  if (streak >= 15) {
    size = 26;
    color = '#FF4500';
    className = 'flame-tier-4';
  } else if (streak >= 8) {
    size = 23;
    color = '#FF6B2B';
    className = 'flame-tier-3';
  } else if (streak >= 4) {
    size = 21;
    color = '#F97316';
    className = 'flame-tier-2';
  }
  
  return <Flame size={size} color={color} className={`flame-active ${className}`} />;
}

// ── XP Toast ──
function XpToast({ show }: { show: boolean }) {
  if (!show) return null;
  return <div className="habit-xp-toast">+25 XP</div>;
}

interface HabitCardProps {
  h: Habit;
  habitLogs: HabitLog[];
  isToggling: boolean;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onExpand: (id: string | null) => void;
  onDelete: (id: string) => void;
  onUpdateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
  showNoteInput: string | null;
  checkinNote: string;
  onNoteChange: (val: string) => void;
  onNoteToggle: (id: string | null) => void;
  onNoteSubmit: (id: string) => void;
}

export function HabitCard({
  h, habitLogs, isToggling, isExpanded,
  onToggle, onExpand, onDelete, onUpdateHabit,
  showNoteInput, checkinNote, onNoteChange, onNoteToggle, onNoteSubmit,
}: HabitCardProps) {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameVal, setEditNameVal] = useState('');
  const [editingFreq, setEditingFreq] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState<string | null>(null);
  const [showXp, setShowXp] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  
  // Swipe state
  const touchRef = useRef<{ startX: number; currentX: number; swiping: boolean }>({ startX: 0, currentX: 0, swiping: false });
  const cardRef = useRef<HTMLDivElement>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  
  const streak = h.streak_current || 0;
  const targetCount = h.target_count || 1;
  const todayCount = getTodayCount(habitLogs);
  const todayDone = todayCount >= targetCount;
  const perfectWeek = isPerfectWeek(habitLogs, targetCount);
  const last7Days = getLast7Days();
  const last30Days = getLast30Days();
  const totalCompletions = habitLogs.length;
  const completionRate = last30Days.length > 0
    ? Math.round((last30Days.filter(d => habitLogs.some(l => l.date === d.date)).length / 30) * 100)
    : 0;

  const category = h.category || null;

  // Handle toggle with animation
  const handleToggle = useCallback(() => {
    const wasDone = todayDone;
    onToggle(h.id);
    if (!wasDone) {
      setShowXp(true);
      setJustCompleted(true);
      setTimeout(() => setShowXp(false), 1200);
      setTimeout(() => setJustCompleted(false), 400);
    }
  }, [todayDone, h.id, onToggle]);

  // Swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchRef.current = { startX: e.touches[0].clientX, currentX: e.touches[0].clientX, swiping: true };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current.swiping) return;
    const diff = e.touches[0].clientX - touchRef.current.startX;
    // Only allow right swipe, max 80px
    if (diff > 0) {
      touchRef.current.currentX = e.touches[0].clientX;
      setSwipeOffset(Math.min(diff, 80));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchRef.current.swiping && swipeOffset > 60 && !todayDone) {
      handleToggle();
    }
    touchRef.current.swiping = false;
    setSwipeOffset(0);
  }, [swipeOffset, todayDone, handleToggle]);

  // Inline edit handlers
  const saveHabitName = async () => {
    if (!editNameVal.trim()) { setEditingName(null); return; }
    await onUpdateHabit(h.id, { title: editNameVal.trim() });
    setEditingName(null);
  };

  const saveHabitIcon = async (newIcon: string) => {
    await onUpdateHabit(h.id, { icon: newIcon });
    setShowIconPicker(null);
  };

  const saveHabitFreq = async (newFreq: string) => {
    await onUpdateHabit(h.id, { frequency: newFreq as 'daily' | 'weekly' | 'monthly' });
    setEditingFreq(null);
  };

  const saveTargetCount = async (count: number) => {
    await onUpdateHabit(h.id, { target_count: Math.max(1, count) });
  };

  const saveCategory = async (cat: string | null) => {
    await onUpdateHabit(h.id, { category: cat || undefined });
  };

  return (
    <div
      ref={cardRef}
      className={`habit-card ${todayDone ? 'done' : ''} ${isExpanded ? 'expanded' : ''} ${perfectWeek ? 'perfect-week' : ''} ${justCompleted ? 'just-completed' : ''}`}
      style={{
        '--h-color': h.color || '#00D4FF',
        cursor: todayDone ? 'default' : 'pointer',
        transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
      } as React.CSSProperties}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input') || target.closest('.habit-emoji-wrap')) return;
        if (!todayDone && !isToggling) handleToggle();
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe reveal green background */}
      {swipeOffset > 0 && (
        <div className="habit-swipe-bg" style={{ opacity: swipeOffset / 80 }}>
          <Check size={20} />
        </div>
      )}

      {/* Confetti sparkle burst on completion */}
      {justCompleted && <div className="habit-confetti-burst" />}

      <div className="habit-top">
        {perfectWeek && (
          <div className="habit-perfect-badge" title="Perfect week!">
            <Award size={14} />
            <Sparkles size={10} className="habit-perfect-sparkle" />
          </div>
        )}
        <div className="habit-emoji-wrap" onClick={(e) => { e.stopPropagation(); setShowIconPicker(showIconPicker === h.id ? null : h.id); }}>
          <span className="habit-emoji"><HabitIcon icon={h.icon || 'circle-dot'} size={18} /></span>
          <span className="habit-emoji-edit"><Pencil size={8} /></span>
        </div>
        <div className="habit-top-actions">
          <button className="habit-expand-btn" onClick={() => onExpand(isExpanded ? null : h.id)} aria-label={isExpanded ? `Collapse ${h.title} stats` : `Expand ${h.title} stats`} aria-expanded={isExpanded}>
            <BarChart3 size={12} />
          </button>
          <button className="habit-delete" onClick={() => onDelete(h.id)} aria-label={`Delete ${h.title}`}><X size={12} /></button>
        </div>
      </div>
      {/* Icon Picker */}
      {showIconPicker === h.id && (
        <div className="habit-picker-dropdown">
          <div className="habits-icon-grid">
            {HABIT_ICONS.map(i => (
              <button key={i} className={`habits-icon-btn ${h.icon === i ? 'active' : ''}`} onClick={() => saveHabitIcon(i)}>
                <HabitIcon icon={i} size={16} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Name with category dot */}
      <div className="habit-name-row">
        {category && CATEGORIES[category] && (
          <span className="habit-category-dot" style={{ background: CATEGORIES[category].color }} title={CATEGORIES[category].label} />
        )}
        {editingName === h.id ? (
          <input className="habit-name-input" value={editNameVal} onChange={e => setEditNameVal(e.target.value)} onBlur={saveHabitName} onKeyDown={e => { if (e.key === 'Enter') saveHabitName(); if (e.key === 'Escape') setEditingName(null); }} autoFocus />
        ) : (
          <span className="habit-name" onClick={() => { setEditingName(h.id); setEditNameVal(h.title); }} title="Click to edit">{h.title}</span>
        )}
      </div>

      {editingFreq === h.id ? (
        <div className="habit-freq-edit">
          {FREQUENCIES.map(f => (
            <button key={f} className={`habits-freq-pill mini ${h.frequency === f ? 'active' : ''}`} onClick={() => saveHabitFreq(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      ) : (
        <span className="habit-frequency" onClick={() => setEditingFreq(h.id)} title="Click to change">
          {h.frequency || 'daily'}
        </span>
      )}

      {targetCount > 1 && (
        <div className="habit-target-progress">
          <span className="habit-target-text">{todayCount}/{targetCount} today</span>
          <div className="habit-target-bar">
            <div className="habit-target-fill" style={{ width: `${Math.min(100, (todayCount / targetCount) * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="habit-streak-prominent">
        <StreakFlame streak={streak} />
        <div className="habit-streak-text">
          <span className={`habit-streak-num ${streak > 0 ? 'active' : ''}`}>{streak}</span>
          <span className="habit-streak-label">day{streak !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="habit-week">
        {last7Days.map(d => {
          const done = habitLogs.some(l => l.date === d.date);
          return (<div key={d.date} className="habit-day"><span className="habit-day-label">{d.label}</span><div className={`habit-day-dot ${done ? 'done' : ''}`} /></div>);
        })}
      </div>

      {showNoteInput === h.id && (
        <div className="habit-note-input-wrap">
          <input
            className="habit-note-input"
            placeholder="Add a note (optional)..."
            value={checkinNote}
            onChange={e => onNoteChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onNoteSubmit(h.id); }}
          />
        </div>
      )}

      <div className="habit-toggle-row">
        <button
          className={`habit-toggle ${todayDone ? 'checked' : ''}`}
          onClick={() => {
            if (todayDone) { onToggle(h.id); return; }
            if (showNoteInput === h.id) { onNoteSubmit(h.id); return; }
            handleToggle();
          }}
          disabled={isToggling}
          aria-label={todayDone ? `Undo ${h.title}` : `Mark ${h.title} as done`}
        >
          {isToggling ? <Loader2 size={16} className="spin" /> : todayDone ? <><Check size={16} /> Done</> : 'Mark Done'}
        </button>
        {!todayDone && (
          <button className="habit-note-toggle" onClick={() => onNoteToggle(showNoteInput === h.id ? null : h.id)} title="Add note" aria-label="Add note">
            <Pencil size={12} />
          </button>
        )}
        <XpToast show={showXp} />
      </div>

      {isExpanded && (
        <div className="habit-expanded-section">
          <div className="habit-heatmap-section">
            <div className="habit-section-label"><TrendingUp size={10} /> 30-Day Heatmap</div>
            <div className="habit-heatmap-grid">
              {last30Days.map(d => {
                const dayCount = habitLogs.filter(l => l.date === d.date).reduce((s, l) => s + (l.count || 1), 0);
                const level = dayCount === 0 ? 0 : dayCount >= targetCount ? 2 : 1;
                return <div key={d.date} className={`heatmap-cell level-${level}`} title={`${d.label}: ${dayCount}/${targetCount}`} style={{ '--cell-color': h.color || '#39FF14' } as React.CSSProperties} />;
              })}
            </div>
            <div className="heatmap-legend">
              <span className="heatmap-legend-label">Less</span>
              <div className="heatmap-cell level-0 legend" />
              <div className="heatmap-cell level-1 legend" style={{ '--cell-color': h.color || '#39FF14' } as React.CSSProperties} />
              <div className="heatmap-cell level-2 legend" style={{ '--cell-color': h.color || '#39FF14' } as React.CSSProperties} />
              <span className="heatmap-legend-label">More</span>
            </div>
          </div>

          <div className="habit-stats-section">
            <div className="habit-section-label"><BarChart3 size={10} /> Statistics</div>
            <div className="habit-stats-grid">
              <div className="habit-stat"><span className="habit-stat-val">{completionRate}%</span><span className="habit-stat-label">Completion Rate</span></div>
              <div className="habit-stat"><span className="habit-stat-val">{streak}</span><span className="habit-stat-label">Current Streak</span></div>
              <div className="habit-stat"><span className="habit-stat-val">{h.streak_best || 0}</span><span className="habit-stat-label">Best Streak</span></div>
              <div className="habit-stat"><span className="habit-stat-val">{totalCompletions}</span><span className="habit-stat-label">Total Check-ins</span></div>
            </div>
          </div>

          <div className="habit-target-edit">
            <label>Daily Target</label>
            <div className="habit-target-ctrl">
              <button aria-label="Decrease target" onClick={() => saveTargetCount((h.target_count || 1) - 1)} disabled={(h.target_count || 1) <= 1}>−</button>
              <span>{h.target_count || 1}</span>
              <button aria-label="Increase target" onClick={() => saveTargetCount((h.target_count || 1) + 1)}>+</button>
            </div>
          </div>

          <div className="habit-category-edit">
            <label>Category</label>
            <div className="habit-category-grid">
              <button className={`habit-category-pill ${!category ? 'active' : ''}`} onClick={() => saveCategory(null)}>None</button>
              {Object.entries(CATEGORIES).map(([key, val]) => (
                <button key={key} className={`habit-category-pill ${category === key ? 'active' : ''}`} style={{ '--cat-color': val.color } as React.CSSProperties} onClick={() => saveCategory(key)}>
                  <span className="habit-category-pill-dot" style={{ background: val.color }} />{val.label}
                </button>
              ))}
            </div>
          </div>

          <div className="habit-color-edit">
            <label>Color</label>
            <div className="habit-color-grid">
              {HABIT_COLORS.map(c => (
                <button key={c} className={`habit-color-btn ${h.color === c ? 'active' : ''}`} style={{ background: c }} onClick={async () => { await onUpdateHabit(h.id, { color: c }); }} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}