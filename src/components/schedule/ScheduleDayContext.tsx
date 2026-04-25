import { CheckCircle2, Circle, Clock, ChevronDown, ChevronUp, DollarSign, Flame, Receipt, Target, Trash2 } from 'lucide-react';
import { EmojiIcon } from '../../lib/emoji-icon';
import { VirtualizedList, VIRTUALIZATION_THRESHOLD } from '../ui/VirtualizedList';
import type { HabitLog } from '../../stores/useHabitsStore';
import type { ScheduleEvent, ScheduleTask, ScheduleHabit, ScheduleBill } from './types';

interface ScheduleDayContextProps {
  contextCollapsed: boolean;
  setContextCollapsed: (v: boolean) => void;
  dayTasks: ScheduleTask[];
  dayActiveTasks: ScheduleTask[];
  dayDoneTasks: ScheduleTask[];
  dayHabitsDone: number;
  totalHabits: number;
  dayBills: ScheduleBill[];
  habits: ScheduleHabit[];
  dayHabitLogs: HabitLog[];
  events: ScheduleEvent[];
  filteredEvents: ScheduleEvent[];
  undoStack: Array<{ id: string; title: string }>;
  // Actions
  toggleTask: (id: string, status: string) => void;
  toggleHabit: (habitId: string) => void;
  getChain: (goalId: string | null) => string;
  setDetailTaskId: (id: string) => void;
  setDetailEvent: (ev: any) => void;
  deleteEvent: (id: string) => void;
  undoLastDelete: () => void;
  confirmDelete: (title: string, msg: string, action: () => void) => void;
  massDeleteDayEvents: () => void;
}

export function ScheduleDayContext({
  contextCollapsed,
  setContextCollapsed,
  dayTasks,
  dayActiveTasks,
  dayDoneTasks,
  dayHabitsDone,
  totalHabits,
  dayBills,
  habits,
  dayHabitLogs,
  events,
  filteredEvents,
  undoStack,
  toggleTask,
  toggleHabit,
  getChain,
  setDetailTaskId,
  setDetailEvent,
  deleteEvent,
  undoLastDelete,
  confirmDelete,
  massDeleteDayEvents,
}: ScheduleDayContextProps) {
  return (
    <div className={`sched-day-context ${contextCollapsed ? 'collapsed' : ''}`}>
      <div className="sched-context-header" onClick={() => setContextCollapsed(!contextCollapsed)}>
        <div className="sched-day-pills">
          <span className="sd-pill"><CheckCircle2 size={11} /> {dayDoneTasks.length}/{dayTasks.length} tasks</span>
          <span className="sd-pill"><Flame size={11} /> {dayHabitsDone}/{totalHabits} habits</span>
          {dayBills.length > 0 && <span className="sd-pill bill"><Receipt size={11} /> {dayBills.length} bill{dayBills.length !== 1 ? 's' : ''} · ${dayBills.reduce((s: number, b: ScheduleBill) => s + b.amount, 0).toFixed(0)}</span>}
          <span className="sd-pill"><Clock size={11} /> {events.length} event{events.length !== 1 ? 's' : ''}</span>
        </div>
        <button aria-label="Toggle day context" className="sched-context-toggle" title={contextCollapsed ? 'Expand' : 'Collapse'}>
          {contextCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      <div className="sched-context-body">
        {dayBills.length > 0 && (
          <div className="sched-day-section">
            <div className="sched-day-label"><Receipt size={11} /> Bills Due</div>
            {dayBills.map((b: ScheduleBill) => (
              <div key={b.id} className="sd-item sd-bill">
                <span className="sd-icon"><DollarSign size={14} /></span>
                <span className="sd-title">{b.title}</span>
                <span className="sd-tag bill">${b.amount}</span>
              </div>
            ))}
          </div>
        )}

        {dayTasks.length > 0 && (
          <div className="sched-day-section">
            <div className="sched-day-label"><Target size={11} /> Tasks</div>
            {dayActiveTasks.map(t => {
              const chain = getChain(t.goal_id);
              return (
                <div key={t.id} className="sd-item sd-task">
                  <button className="sd-chk" onClick={() => toggleTask(t.id, t.status)} aria-label="Mark task complete"><Circle size={15} /></button>
                  <div className="sd-task-info">
                    <span className="sd-title" onClick={() => setDetailTaskId(t.id)} style={{ cursor: 'pointer' }}>{t.title}</span>
                    {chain && <span className="sd-chain">{chain}</span>}
                  </div>
                  {t.priority && <span className="sd-tag" data-priority={t.priority}>{t.priority}</span>}
                </div>
              );
            })}
            {dayDoneTasks.length > 0 && (
              <details className="sd-done-group">
                <summary className="sd-done-toggle">✓ {dayDoneTasks.length} completed</summary>
                {dayDoneTasks.map(t => (
                  <div key={t.id} className="sd-item sd-task done">
                    <button className="sd-chk checked" onClick={() => toggleTask(t.id, t.status)} aria-label="Mark task incomplete"><CheckCircle2 size={15} /></button>
                    <span className="sd-title">{t.title}</span>
                  </div>
                ))}
              </details>
            )}
          </div>
        )}

        {habits.length > 0 && (
          <div className="sched-day-section">
            <div className="sched-day-label"><Flame size={11} /> Habits</div>
            <div className="sd-habits-grid">
              {habits.map(h => {
                const hLogs = dayHabitLogs.filter(l => l.habit_id === h.id);
                const done = hLogs.reduce((s: number, l: HabitLog) => s + (l.count || 1), 0) >= (h.target_count || 1);
                return (
                  <div key={h.id} className={`sd-habit ${done ? 'done' : ''}`} onClick={() => toggleHabit(h.id)}>
                    <span className="sd-habit-icon"><EmojiIcon emoji={h.icon || '💪'} size={16} fallbackAsText /></span>
                    <span className="sd-habit-name">{h.title}</span>
                    <div className={`sd-habit-chk ${done ? 'checked' : ''}`}>{done ? <CheckCircle2 size={14} /> : <Circle size={14} />}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filteredEvents.length > 0 && (
          <div className="sched-day-section">
            <div className="sched-day-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><Clock size={11} /> Events ({filteredEvents.length})</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {undoStack.length > 0 && (
                  <button className="sd-mass-action" onClick={undoLastDelete} title="Undo last delete" style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: 4, color: '#39FF14', cursor: 'pointer' }}>
                    Undo
                  </button>
                )}
                <button className="sd-mass-action" onClick={() => confirmDelete('Clear all events', `Delete all ${filteredEvents.filter(e => e.source !== 'google').length} events for this day?`, massDeleteDayEvents)} title="Delete all events for this day" style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 4, color: '#F43F5E', cursor: 'pointer' }}>
                  Clear All
                </button>
              </div>
            </div>
            <VirtualizedList
              items={filteredEvents}
              renderItem={(ev) => (
                <div key={ev.id} className="sd-item sd-event" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="sd-title" onClick={() => setDetailEvent(ev)} style={{ flex: 1, cursor: 'pointer', fontSize: 12 }}>{ev.title}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {ev.start_time ? new Date(ev.start_time).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : ''}
                  </span>
                  {ev.source !== 'google' && (
                    <button onClick={() => deleteEvent(ev.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, opacity: 0.5 }} title="Delete">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}
              itemHeight={40}
              className="sd-events-vlist"
              emptyMessage=""
              style={{ maxHeight: 240 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
