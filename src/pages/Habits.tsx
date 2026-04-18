import { useState, useEffect, useMemo } from 'react';
import { useUserStore } from '../stores/useUserStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import type { Habit, HabitLog } from '../stores/useHabitsStore';
import { logUnifiedEvent } from '../lib/events';
import { useGamificationContext } from '../lib/gamification/context';
import { Plus, Flame, Loader2 } from 'lucide-react';
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
import { HabitCard } from './habits/HabitCard';
import { TodaySummaryBar } from './habits/TodaySummaryBar';

const FREQUENCIES = ['daily', 'weekdays', 'weekends', 'weekly'];

function getTodayCount(logs: HabitLog[]): number {
  return logs.filter(l => l.date === todayStr()).reduce((sum: number, l) => sum + (l.count || 1), 0);
}

function isTodayDone(logs: HabitLog[], targetCount: number): boolean {
  return getTodayCount(logs) >= targetCount;
}

export function Habits() {
  const user = useUserStore(s => s.user);
  const { awardXP } = useGamificationContext();
  const storeHabits = useHabitsStore(s => s.habits);
  const storeLogs = useHabitsStore(s => s.logs);
  const storeLoading = useHabitsStore(s => s.loading);

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

  const [checkinNote, setCheckinNote] = useState<Record<string, string>>({});
  const [showNoteInput, setShowNoteInput] = useState<string | null>(null);

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

  const toggleToday = async (habitId: string) => {
    const habitLogs = logs[habitId] || [];
    const habit = habits.find(h => h.id === habitId);
    const targetCount = habit?.target_count || 1;
    const todayCount = getTodayCount(habitLogs);
    const done = todayCount >= targetCount;
    setToggling(habitId);

    const noteText = checkinNote[habitId] || null;
    await useHabitsStore.getState().toggleHabit(habitId, todayStr(), noteText);

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

  const updateHabit = async (id: string, updates: Partial<Habit>) => {
    await useHabitsStore.getState().updateHabit(id, updates);
  };

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

      {habits.length > 0 && (
        <TodaySummaryBar habits={habits} logs={logs} />
      )}

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
          action={{ label: 'Create First Habit', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="habits-grid">
          {habits.map(h => (
            <HabitCard
              key={h.id}
              h={h}
              habitLogs={logs[h.id] || []}
              isToggling={toggling === h.id}
              isExpanded={expandedId === h.id}
              onToggle={toggleToday}
              onExpand={setExpandedId}
              onDelete={deleteHabit}
              onUpdateHabit={updateHabit}
              showNoteInput={showNoteInput}
              checkinNote={checkinNote[h.id] || ''}
              onNoteChange={(val) => setCheckinNote(prev => ({ ...prev, [h.id]: val }))}
              onNoteToggle={setShowNoteInput}
              onNoteSubmit={(id) => toggleToday(id)}
            />
          ))}
        </div>
      )}

      <RitualManager />
      <SpotlightTour tourId="habits" />
    </div>
  );
}