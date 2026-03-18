import { useScheduleStore } from '../../stores/useScheduleStore';
import { useLiveActivityStore } from '../../stores/useLiveActivityStore';
import { localDateStr } from '../../utils/date';
import { getEffectiveUserId } from '../local-db';

export const ScheduleService = {
  current() {
    return useLiveActivityStore.getState().activeEvent;
  },
  today() {
    const today = localDateStr();
    const store = useScheduleStore.getState();
    return { events: store.getEventsForDate(today), tasks: store.getTasksForDate(today) };
  },
  createTask(title: string, priority?: string, extra?: Record<string, any>) {
    return useScheduleStore.getState().createTask(getEffectiveUserId(), title, priority, extra);
  },
  completeTask(taskId: string) {
    const task = useScheduleStore.getState().tasks.find(t => t.id === taskId);
    if (!task) return Promise.resolve();
    return useScheduleStore.getState().toggleTask(taskId, task.status);
  },
  overdue() {
    return useScheduleStore.getState().getOverdueTasks();
  },
  stats() {
    const today = localDateStr();
    const store = useScheduleStore.getState();
    const todayEvents = store.getEventsForDate(today);
    const todayTasks = store.getTasksForDate(today);
    const overdue = store.getOverdueTasks();
    const active = useLiveActivityStore.getState().activeEvent;
    return {
      todayEvents: todayEvents.length,
      todayTasks: todayTasks.length,
      overdueCount: overdue.length,
      currentActivity: active?.title ?? null,
    };
  },
};
