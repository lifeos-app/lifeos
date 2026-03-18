/**
 * QuickLogHabit — Toggle today's habits as chips inside a bottom sheet.
 */

import { useState } from 'react';
import { Flame, Check } from 'lucide-react';
import { BottomSheet } from '../../BottomSheet';
import { useHabitsStore } from '../../../stores/useHabitsStore';
import { localDateStr } from '../../../utils/date';
import { showToast } from '../../Toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function QuickLogHabit({ open, onClose }: Props) {
  const habits = useHabitsStore(s => s.habits);
  const logs = useHabitsStore(s => s.logs);
  const toggleHabit = useHabitsStore(s => s.toggleHabit);
  const [toggling, setToggling] = useState<string | null>(null);

  const today = localDateStr();

  const isHabitDone = (habitId: string): boolean => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return false;
    const dayLogs = logs.filter(l => l.habit_id === habitId && l.date === today);
    const total = dayLogs.reduce((s, l) => s + (l.count || 1), 0);
    return total >= (habit.target_count || 1);
  };

  const handleToggle = async (habitId: string) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit || toggling) return;
    
    setToggling(habitId);
    const wasDone = isHabitDone(habitId);
    await toggleHabit(habitId, today);
    
    if (!wasDone) {
      showToast(`${habit.title} completed! 🔥`, '✅', '#39FF14');
    }
    setToggling(null);
  };

  const doneCount = habits.filter(h => isHabitDone(h.id)).length;

  return (
    <BottomSheet open={open} onClose={onClose} title="Log Habits" icon={<Flame size={18} />}>
      {habits.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          No habits set up yet. Add some from the Habits page!
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            {doneCount}/{habits.length} completed today
          </div>
          <div className="bs-chips">
            {habits.map(h => {
              const done = isHabitDone(h.id);
              const isToggling = toggling === h.id;
              return (
                <button
                  key={h.id}
                  className={`bs-chip ${done ? 'bs-chip-active' : ''}`}
                  onClick={() => handleToggle(h.id)}
                  disabled={isToggling}
                  style={{ opacity: isToggling ? 0.6 : 1 }}
                >
                  <span className="bs-chip-icon">{h.icon || '⭐'}</span>
                  <span>{h.title}</span>
                  {done && <Check size={14} className="bs-chip-check" style={{ opacity: 1 }} />}
                </button>
              );
            })}
          </div>
          {doneCount === habits.length && habits.length > 0 && (
            <div style={{ 
              textAlign: 'center', marginTop: 20, padding: 14,
              background: 'rgba(57,255,20,0.06)', borderRadius: 12,
              border: '1px solid rgba(57,255,20,0.15)',
              fontSize: 14, color: '#39FF14', fontWeight: 600
            }}>
              🎉 All habits complete! Amazing!
            </div>
          )}
        </>
      )}
    </BottomSheet>
  );
}
