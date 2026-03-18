/**
 * DashboardHabits — Habits widget for the Dashboard.
 */

import { forwardRef, useMemo, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { Flame, ChevronRight, CheckCircle2, Circle } from 'lucide-react';

const MiniCharacter = lazy(() => import('../../realm/ui/MiniCharacter').then(m => ({ default: m.MiniCharacter })));
import { EmojiIcon } from '../../lib/emoji-icon';
import { useHabitsStore } from '../../stores/useHabitsStore';
import type { Habit, HabitLog } from '../../types/database';

interface DashboardHabitsProps {
  habits: Habit[];
  habitLogs: HabitLog[];
  selectedDate: string;
  onRefresh: () => void;
}

export const DashboardHabits = forwardRef<HTMLElement, DashboardHabitsProps>(
  function DashboardHabits({ habits, habitLogs, selectedDate, onRefresh }, ref) {
    const dayHabitLogs = useMemo(() => habitLogs.filter((l: HabitLog) => l.date === selectedDate), [habitLogs, selectedDate]);

    const toggleHabit = async (habitId: string) => {
      await useHabitsStore.getState().toggleHabit(habitId, selectedDate);
      onRefresh();
    };

    return (
      <section ref={ref} className="dash-card">
        <div className="card-top">
          <h2><Flame size={16} /> Habits <Suspense fallback={null}><MiniCharacter size={24} fps={10} /></Suspense></h2>
          <Link to="/habits" className="card-link">View all <ChevronRight size={14} /></Link>
        </div>
        {habits.length === 0 ? (
          <div className="card-empty"><p>No habits yet</p><p className="card-empty-hint">Build consistency on the Habits page</p></div>
        ) : (
          <div className="dash-habits">
            {habits.map((h: Habit) => {
              const hLogs = dayHabitLogs.filter((l: HabitLog) => l.habit_id === h.id);
              const done = hLogs.reduce((s: number, l: HabitLog) => s + (l.count || 1), 0) >= (h.target_count || 1);
              // BUG-104: Using centralized streak from store (calculated via useHabitsStore.calculateStreak)
              const streak = h.streak_current || 0;
              return (
                <div key={h.id} className={`dash-habit-row ${done ? 'done' : ''}`} onClick={() => toggleHabit(h.id)}>
                  <span className="dash-habit-icon"><EmojiIcon emoji={h.icon || '💪'} size={16} fallbackAsText /></span>
                  <span className="dash-habit-name">{h.title}</span>
                  {streak > 0 && <span className="dash-habit-streak"><Flame size={10} /> {streak}</span>}
                  <div className={`dash-habit-check ${done ? 'checked' : ''}`}>
                    {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }
);
