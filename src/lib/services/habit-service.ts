import { useHabitsStore, calculateStreak, type Habit } from '../../stores/useHabitsStore';
import { useLiveActivityStore } from '../../stores/useLiveActivityStore';
import { localDateStr } from '../../utils/date';

export const HabitService = {
  getAll(): Habit[] {
    return useHabitsStore.getState().habits;
  },
  toggle(habitId: string, date?: string): Promise<void> {
    return useHabitsStore.getState().toggleHabit(habitId, date || localDateStr());
  },
  startTimer(habitId: string) {
    const habit = useHabitsStore.getState().habits.find(h => h.id === habitId);
    if (!habit) return Promise.resolve(null);
    return useLiveActivityStore.getState().startActivity(habit.title, 'habit');
  },
  streak(habitId: string) {
    return calculateStreak(habitId, useHabitsStore.getState().logs);
  },
  dueToday(): Habit[] {
    const store = useHabitsStore.getState();
    const today = localDateStr();
    return store.habits.filter(h =>
      h.is_active !== false && !store.isHabitDoneForDate(h.id, today)
    );
  },
  stats() {
    const store = useHabitsStore.getState();
    const today = localDateStr();
    const habits = store.habits;
    const completedToday = habits.filter(h => store.isHabitDoneForDate(h.id, today)).length;
    const streaks = habits.map(h => calculateStreak(h.id, store.logs));
    const bestStreak = streaks.length > 0 ? Math.max(...streaks.map(s => s.best)) : 0;
    return { total: habits.length, completedToday, bestStreak };
  },
};
