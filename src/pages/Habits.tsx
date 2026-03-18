import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import type { Habit, HabitLog } from '../stores/useHabitsStore';
import { logUnifiedEvent } from '../lib/events';
import { useGamificationContext } from '../lib/gamification/context';
import { Plus, Flame, Check, Loader2, X, Pencil, BarChart3, TrendingUp, AlertTriangle, Award, Sparkles } from 'lucide-react';
import { HabitIcon, HABIT_ICONS } from '../components/HabitIcon';
import { todayStr, localDateStr } from '../utils/date';
import { SpotlightTour } from '../components/SpotlightTour';
import { EmptyState } from '../components/EmptyState';
import { RitualManager } from '../components/rituals/RitualManager';
import { ErrorCard } from '../components/ui/ErrorCard';
import { showToast } from '../components/Toast';
import './Habits.css';
import { logger } from '../utils/logger';
import { HabitsSkeleton } from '../components/skeletons';

const FREQUENCIES = ['daily', 'weekdays', 'weekends', 'weekly'];
const HABIT_COLORS = ['#00D4FF', '#A855F7', '#39FF14', '#F97316', '#EC4899', '#FACC15', '#06B6D4', '#F43F5E'];

function isTodayDone(logs: HabitLog[], targetCount: number): boolean {
  const todayLogs = logs.filter(l => l.date === todayStr());
  const total = todayLogs.reduce((sum: number, l) => sum + (l.count || 1), 0);
  return total >= targetCount;
}

function getTodayCount(logs: HabitLog[]): number {
  return logs.filter(l => l.date === todayStr()).reduce((sum: number, l) => sum + (l.count || 1), 0);
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
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: localDateStr(d),
      label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      dayOfWeek: d.getDay(),
    });
  }
  return days;
}

export function Habits() {
  const user = useUserStore(s => s.user);
  const { awardXP } = useGamificationContext();
  const storeHabits = useHabitsStore(s => s.habits);
  const storeLogs = useHabitsStore(s => s.logs);
  const storeLoading = useHabitsStore(s => s.loading);

  // Derive grouped logs from flat store logs
  const habits = storeHabits;
  const logs = useMemo(() => {
    const grouped: Record<string, HabitLog[]> = {};
    storeLogs.forEach(l => {
      if (!grouped[l.habit_id]) grouped[l.habit_id] = [];
      grouped[l.habit_id].push(l);
    });
    return grouped;
  }, [storeLogs]);
  const loading = storeLoading && storeHabits.length === 0;

  const [showForm, setShowForm] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('circle-dot');
  const [frequency, setFrequency] = useState('daily');
  const [saving, setSaving] = useState(false);

  // Inline editing
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameVal, setEditNameVal] = useState('');
  const [editingFreq, setEditingFreq] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState<string | null>(null);
  const [checkinNote, setCheckinNote] = useState<Record<string, string>>({});
  const [showNoteInput, setShowNoteInput] = useState<string | null>(null);

  // Ensure store is hydrated
  useEffect(() => { useHabitsStore.getState().fetchAll(); }, []);

  const fetchHabits = () => { useHabitsStore.getState().invalidate(); };

  const createHabit = async () => {
    if (!title.trim()) { showToast('Enter a habit name', undefined, '#F97316'); return; }
    if (title.length > 100) { showToast('Habit name too long (max 100 chars)', undefined, '#F97316'); return; }
    setSaving(true);
    setError('');
    const ok = await useHabitsStore.getState().createHabit(user?.id || '', {
      title: title.trim(),
      icon,
      frequency,
      target_count: 1,
      color: '#00D4FF',
    } as Partial<Habit>);
    if (!ok) { setError('Failed to create habit'); }
    else { setTitle(''); setIcon('circle-dot'); setFrequency('daily'); setShowForm(false); }
    setSaving(false);
  };

  const toggleToday = async (habitId: string, notes?: string) => {
    const habitLogs = logs[habitId] || [];
    const habit = habits.find(h => h.id === habitId);
    const targetCount = habit?.target_count || 1;
    const todayCount = getTodayCount(habitLogs);
    const done = todayCount >= targetCount;
    setToggling(habitId);

    // Use store method for toggle (handles both undo and log)
    const noteText = notes || checkinNote[habitId] || null;
    await useHabitsStore.getState().toggleHabit(habitId, todayStr(), noteText);

    // Log habit completion to unified events (only on new completion)
    if (!done && user?.id && habit) {
      logUnifiedEvent({
        user_id: user.id,
        timestamp: new Date().toISOString(),
        type: 'habit',
        title: `${habit.icon || '✅'} ${habit.title}`,
        details: { habit_id: habitId, notes: noteText },
        module_source: 'habits',
        icon: habit.icon || '✅',
        color: habit.color || '#06B6D4',
      });
      const updatedHabit = useHabitsStore.getState().habits.find(h => h.id === habitId);
      const streakDays = updatedHabit?.streak_current || 0;
      awardXP('habit_log', { description: habit.title, streakDays });

      // Garden growth notification at stage milestones
      const STAGE_THRESHOLDS = [1, 3, 7, 21, 50];
      if (STAGE_THRESHOLDS.includes(streakDays)) {
        const STAGE_NAMES = ['Seed', 'Sprout', 'Young', 'Mature', 'Thriving', 'Ancient'];
        const stageIdx = STAGE_THRESHOLDS.filter(t => streakDays >= t).length;
        const stageName = STAGE_NAMES[Math.min(stageIdx, 5)];
        showToast(`Your ${habit.title} plant grew to ${stageName} stage!`, '🌱');
      }
    }

    setCheckinNote(prev => ({ ...prev, [habitId]: '' }));
    setShowNoteInput(null);
    setToggling(null);
    fetchHabits();
  };

  const deleteHabit = async (id: string) => {
    await useHabitsStore.getState().deleteHabit(id);
  };

  // Inline editing handlers
  const saveHabitName = async (habitId: string) => {
    if (!editNameVal.trim()) { setEditingName(null); return; }
    await useHabitsStore.getState().updateHabit(habitId, { title: editNameVal.trim() });
    setEditingName(null);
  };

  const saveHabitIcon = async (habitId: string, newIcon: string) => {
    await useHabitsStore.getState().updateHabit(habitId, { icon: newIcon });
    setShowIconPicker(null);
  };

  const saveHabitFreq = async (habitId: string, newFreq: string) => {
    await useHabitsStore.getState().updateHabit(habitId, { frequency: newFreq as 'daily' | 'weekly' | 'monthly' });
    setEditingFreq(null);
  };

  const saveTargetCount = async (habitId: string, count: number) => {
    await useHabitsStore.getState().updateHabit(habitId, { target_count: Math.max(1, count) });
  };

  const last7Days = getLast7Days();

  const last30Days = useMemo(() => getLast30Days(), []);

  const totalToday = habits.filter(h => isTodayDone(logs[h.id] || [], h.target_count || 1)).length;
  const bestStreak = Math.max(0, ...habits.map(h => h.streak_current || 0));

  return (
    <div className="habits">
      <div className="habits-header animate-fadeUp">
        <div>
          <h1 className="habits-title"><Flame size={22} /> Habits</h1>
          <p className="habits-sub">{totalToday}/{habits.length} done today · Best streak: {bestStreak} days</p>
        </div>
        <button className="habits-add-btn" onClick={() => setShowForm(!showForm)}><Plus size={16} /> New Habit</button>
      </div>

      {showForm && (
        <div className="habits-form">
          <input autoFocus className="habits-form-input" placeholder="What habit do you want to build?" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createHabit()} />
          <div className="habits-form-row">
            <div className="habits-form-group">
              <label>Icon</label>
              <div className="habits-icon-grid">
                {HABIT_ICONS.map(i => (
                  <button key={i} className={`habits-icon-btn ${icon === i ? 'active' : ''}`} onClick={() => setIcon(i)}>
                    <HabitIcon icon={i} size={16} />
                  </button>
                ))}
              </div>
            </div>
            <div className="habits-form-group">
              <label>Frequency</label>
              <div className="habits-freq-pills">
                {FREQUENCIES.map(f => (<button key={f} className={`habits-freq-pill ${frequency === f ? 'active' : ''}`} onClick={() => setFrequency(f)}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>))}
              </div>
            </div>
          </div>
          {error && <ErrorCard message={error} />}
          <div className="habits-form-actions">
            <button className="habits-form-cancel" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="habits-form-save" onClick={createHabit} disabled={saving || !title.trim()}>
              {saving ? <><Loader2 size={14} className="spin" /> Creating...</> : 'Create Habit'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <HabitsSkeleton />
      ) : habits.length === 0 ? (
        <EmptyState
          variant="habits"
          action={{ label: '+ Create Your First Habit', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="habits-grid">
          {habits.map(h => {
            const habitLogs = logs[h.id] || [];
            const streak = h.streak_current || 0;
            const targetCount = h.target_count || 1;
            const todayCount = getTodayCount(habitLogs);
            const todayDone = todayCount >= targetCount;
            const isToggling = toggling === h.id;
            const isExpanded = expandedId === h.id;

            // Stats
            const totalCompletions = habitLogs.length;
            const completionRate = last30Days.length > 0
              ? Math.round((last30Days.filter(d => habitLogs.some(l => l.date === d.date)).length / 30) * 100)
              : 0;
            const perfectWeek = isPerfectWeek(habitLogs, targetCount);

            return (
              <div 
                key={h.id} 
                className={`habit-card ${todayDone ? 'done' : ''} ${isExpanded ? 'expanded' : ''} ${perfectWeek ? 'perfect-week' : ''}`} 
                style={{ 
                  '--h-color': h.color || '#00D4FF',
                  cursor: todayDone ? 'default' : 'pointer'
                } as React.CSSProperties}
                onClick={(e) => {
                  // Quick-tap to log (unless clicking on buttons/inputs)
                  const target = e.target as HTMLElement;
                  if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input') || target.closest('.habit-emoji-wrap')) {
                    return; // Let button handlers take over
                  }
                  if (!todayDone && !isToggling) {
                    toggleToday(h.id);
                  }
                }}
              >
                <div className="habit-top">
                  {/* Perfect Week Badge */}
                  {perfectWeek && (
                    <div className="habit-perfect-badge" title="Perfect week!">
                      <Award size={14} />
                      <Sparkles size={10} className="habit-perfect-sparkle" />
                    </div>
                  )}
                  
                  {/* Icon — click to edit */}
                  <div className="habit-emoji-wrap" onClick={(e) => { e.stopPropagation(); setShowIconPicker(showIconPicker === h.id ? null : h.id); }}>
                    <span className="habit-emoji"><HabitIcon icon={h.icon || 'circle-dot'} size={18} /></span>
                    <span className="habit-emoji-edit"><Pencil size={8} /></span>
                  </div>
                  <div className="habit-top-actions">
                    <button className="habit-expand-btn" onClick={() => setExpandedId(isExpanded ? null : h.id)} aria-label={isExpanded ? `Collapse ${h.title} stats` : `Expand ${h.title} stats`} aria-expanded={isExpanded}>
                      <BarChart3 size={12} />
                    </button>
                    <button className="habit-delete" onClick={() => deleteHabit(h.id)} aria-label={`Delete ${h.title}`}><X size={12} /></button>
                  </div>
                </div>

                {/* Icon Picker */}
                {showIconPicker === h.id && (
                  <div className="habit-picker-dropdown">
                    <div className="habits-icon-grid">
                      {HABIT_ICONS.map(i => (
                        <button key={i} className={`habits-icon-btn ${h.icon === i ? 'active' : ''}`} onClick={() => saveHabitIcon(h.id, i)}>
                          <HabitIcon icon={i} size={16} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Name — inline edit */}
                {editingName === h.id ? (
                  <input
                    className="habit-name-input"
                    value={editNameVal}
                    onChange={e => setEditNameVal(e.target.value)}
                    onBlur={() => saveHabitName(h.id)}
                    onKeyDown={e => { if (e.key === 'Enter') saveHabitName(h.id); if (e.key === 'Escape') setEditingName(null); }}
                    autoFocus
                  />
                ) : (
                  <span className="habit-name" onClick={() => { setEditingName(h.id); setEditNameVal(h.title); }} title="Click to edit">{h.title}</span>
                )}

                {/* Frequency — inline edit */}
                {editingFreq === h.id ? (
                  <div className="habit-freq-edit">
                    {FREQUENCIES.map(f => (
                      <button key={f} className={`habits-freq-pill mini ${h.frequency === f ? 'active' : ''}`} onClick={() => saveHabitFreq(h.id, f)}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="habit-frequency" onClick={() => setEditingFreq(h.id)} title="Click to change">
                    {h.frequency || 'daily'}
                  </span>
                )}

                {/* Target count progress */}
                {targetCount > 1 && (
                  <div className="habit-target-progress">
                    <span className="habit-target-text">{todayCount}/{targetCount} today</span>
                    <div className="habit-target-bar">
                      <div className="habit-target-fill" style={{ width: `${Math.min(100, (todayCount / targetCount) * 100)}%` }} />
                    </div>
                  </div>
                )}

                {/* Prominent streak display */}
                <div className="habit-streak-prominent">
                  <Flame size={20} color={streak > 0 ? '#F97316' : '#5A7A9A'} className={streak > 0 ? 'flame-active' : ''} />
                  <div className="habit-streak-text">
                    <span className={`habit-streak-num ${streak > 0 ? 'active' : ''}`}>{streak}</span>
                    <span className="habit-streak-label">day{streak !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* 7-day dots */}
                <div className="habit-week">
                  {last7Days.map(d => {
                    const done = habitLogs.some(l => l.date === d.date);
                    return (<div key={d.date} className="habit-day"><span className="habit-day-label">{d.label}</span><div className={`habit-day-dot ${done ? 'done' : ''}`} /></div>);
                  })}
                </div>

                {/* Check-in note */}
                {showNoteInput === h.id && (
                  <div className="habit-note-input-wrap">
                    <input
                      className="habit-note-input"
                      placeholder="Add a note (optional)..."
                      value={checkinNote[h.id] || ''}
                      onChange={e => setCheckinNote(prev => ({ ...prev, [h.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { toggleToday(h.id); } }}
                    />
                  </div>
                )}

                {/* Toggle / Mark Done */}
                <div className="habit-toggle-row">
                  <button
                    className={`habit-toggle ${todayDone ? 'checked' : ''}`}
                    onClick={() => {
                      if (todayDone) { toggleToday(h.id); return; }
                      if (showNoteInput === h.id) { toggleToday(h.id); return; }
                      toggleToday(h.id);
                    }}
                    disabled={isToggling}
                    aria-label={todayDone ? `Undo ${h.title}` : `Mark ${h.title} as done`}
                  >
                    {isToggling ? <Loader2 size={16} className="spin" /> : todayDone ? <><Check size={16} /> Done</> : 'Mark Done'}
                  </button>
                  {!todayDone && (
                    <button
                      className="habit-note-toggle"
                      onClick={() => setShowNoteInput(showNoteInput === h.id ? null : h.id)}
                      title="Add note" aria-label="Add note"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </div>

                {/* Expanded: 30-day heatmap + stats */}
                {isExpanded && (
                  <div className="habit-expanded-section">
                    {/* 30-day heatmap */}
                    <div className="habit-heatmap-section">
                      <div className="habit-section-label"><TrendingUp size={10} /> 30-Day Heatmap</div>
                      <div className="habit-heatmap-grid">
                        {last30Days.map(d => {
                          const dayLogs = habitLogs.filter(l => l.date === d.date);
                          const dayCount = dayLogs.reduce((s, l) => s + (l.count || 1), 0);
                          const level = dayCount === 0 ? 0 : dayCount >= targetCount ? 2 : 1;
                          return (
                            <div
                              key={d.date}
                              className={`heatmap-cell level-${level}`}
                              title={`${d.label}: ${dayCount}/${targetCount}`}
                              style={{ '--cell-color': h.color || '#39FF14' } as React.CSSProperties}
                            />
                          );
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

                    {/* Stats */}
                    <div className="habit-stats-section">
                      <div className="habit-section-label"><BarChart3 size={10} /> Statistics</div>
                      <div className="habit-stats-grid">
                        <div className="habit-stat">
                          <span className="habit-stat-val">{completionRate}%</span>
                          <span className="habit-stat-label">Completion Rate</span>
                        </div>
                        <div className="habit-stat">
                          <span className="habit-stat-val">{streak}</span>
                          <span className="habit-stat-label">Current Streak</span>
                        </div>
                        <div className="habit-stat">
                          <span className="habit-stat-val">{h.streak_best || 0}</span>
                          <span className="habit-stat-label">Best Streak</span>
                        </div>
                        <div className="habit-stat">
                          <span className="habit-stat-val">{totalCompletions}</span>
                          <span className="habit-stat-label">Total Check-ins</span>
                        </div>
                      </div>
                    </div>

                    {/* Target count editor */}
                    <div className="habit-target-edit">
                      <label>Daily Target</label>
                      <div className="habit-target-ctrl">
                        <button aria-label="Decrease target" onClick={() => saveTargetCount(h.id, (h.target_count || 1) - 1)} disabled={(h.target_count || 1) <= 1}>−</button>
                        <span>{h.target_count || 1}</span>
                        <button aria-label="Increase target" onClick={() => saveTargetCount(h.id, (h.target_count || 1) + 1)}>+</button>
                      </div>
                    </div>

                    {/* Color picker */}
                    <div className="habit-color-edit">
                      <label>Color</label>
                      <div className="habit-color-grid">
                        {HABIT_COLORS.map(c => (
                          <button
                            key={c}
                            className={`habit-color-btn ${h.color === c ? 'active' : ''}`}
                            style={{ background: c }}
                            onClick={async () => {
                              await useHabitsStore.getState().updateHabit(h.id, { color: c });
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rituals — recurring activity patterns that auto-populate the schedule */}
      <RitualManager />

      <SpotlightTour tourId="habits" />
    </div>
  );
}
