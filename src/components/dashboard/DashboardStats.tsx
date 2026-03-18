/**
 * DashboardStats — Quick stat cards + insights section with progress rings.
 */

import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Flame, Clock, TrendingUp, TrendingDown, Receipt, BarChart3,
} from 'lucide-react';
import { ProgressRing } from '../ui/ProgressRing';
import { MiniChart } from '../MiniChart';
import type { Task, ScheduleEvent, Bill } from '../../types/database';

interface DashboardStatsProps {
  selectedDate: string;
  isToday: boolean;
  todayStr: string;
  dayTasks: Task[];
  dayDoneTasks: Task[];
  dayActiveTasks: Task[];
  dayHabitsDone: number;
  totalHabits: number;
  dayEvents: ScheduleEvent[];
  dayBills: Bill[];
  net: number;
  dayTaskProgress: number;
  bestHabitStreak: number;
  avgGoalProgress: number;
  activeGoalCount: number;
  weeklyChartData: { label: string; count: number }[];
  onScrollToTasks: () => void;
  onScrollToHabits: () => void;
  onSetTaskFilter: (filter: string) => void;
  onSetTaskView: (view: 'list' | 'board') => void;
}

function fmtCurrency(n: number) { return `$${Math.abs(n).toFixed(0)}`; }

export function DashboardStatsRow({
  dayTasks, dayDoneTasks, dayActiveTasks, dayHabitsDone, totalHabits,
  dayEvents, dayBills, net,
  onScrollToTasks, onScrollToHabits, onSetTaskFilter,
}: Pick<DashboardStatsProps,
  'dayTasks' | 'dayDoneTasks' | 'dayActiveTasks' | 'dayHabitsDone' | 'totalHabits' |
  'dayEvents' | 'dayBills' | 'net' | 'onScrollToTasks' | 'onScrollToHabits' | 'onSetTaskFilter'
>) {
  const navigate = useNavigate();

  return (
    <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
      <div className="stat-card clickable" onClick={() => { onScrollToTasks(); onSetTaskFilter('all'); }}>
        <div className="stat-icon" style={{ background: 'rgba(57,255,20,0.1)' }}><CheckCircle2 size={18} color="#39FF14" /></div>
        <div>
          <span className="stat-val">{dayDoneTasks.length}<span className="stat-dim">/{dayTasks.length}</span></span>
          <span className="stat-lbl">{dayActiveTasks.length > 0 ? `${dayActiveTasks.length} remaining` : dayTasks.length > 0 ? '✓ All done!' : 'No tasks'}</span>
        </div>
      </div>
      <div className="stat-card clickable" onClick={onScrollToHabits}>
        <div className="stat-icon" style={{ background: 'rgba(249,115,22,0.1)' }}><Flame size={18} color="#F97316" /></div>
        <div>
          <span className="stat-val">{dayHabitsDone}<span className="stat-dim">/{totalHabits}</span></span>
          <span className="stat-lbl">Habits done</span>
        </div>
      </div>
      <div className="stat-card clickable" onClick={() => navigate('/finances')}>
        <div className="stat-icon" style={{ background: dayBills.length > 0 ? 'rgba(244,63,94,0.1)' : net >= 0 ? 'rgba(57,255,20,0.1)' : 'rgba(244,63,94,0.1)' }}>
          {dayBills.length > 0 ? <Receipt size={18} color="#F43F5E" /> : net >= 0 ? <TrendingUp size={18} color="#39FF14" /> : <TrendingDown size={18} color="#F43F5E" />}
        </div>
        <div>
          <span className="stat-val">{dayBills.length > 0 ? `${dayBills.length} bill${dayBills.length > 1 ? 's' : ''}` : `${net >= 0 ? '+' : '-'}${fmtCurrency(net)}`}</span>
          <span className="stat-lbl">{dayBills.length > 0 ? `$${dayBills.reduce((s: number, b: Bill) => s + b.amount, 0).toFixed(0)} due` : 'Net this month'}</span>
        </div>
      </div>
      <div className="stat-card clickable" onClick={() => navigate('/schedule')}>
        <div className="stat-icon" style={{ background: 'rgba(0,212,255,0.1)' }}><Clock size={18} color="#00D4FF" /></div>
        <div>
          <span className="stat-val">{dayEvents.length}</span>
          <span className="stat-lbl">Events</span>
        </div>
      </div>
    </div>
  );
}

export function DashboardInsights({
  isToday, todayStr, dayTaskProgress, dayDoneTasks, dayTasks,
  dayHabitsDone, totalHabits, bestHabitStreak,
  avgGoalProgress, activeGoalCount, weeklyChartData,
  onScrollToTasks, onScrollToHabits, onSetTaskView,
}: Pick<DashboardStatsProps,
  'isToday' | 'todayStr' | 'dayTaskProgress' | 'dayDoneTasks' | 'dayTasks' |
  'dayHabitsDone' | 'totalHabits' | 'bestHabitStreak' |
  'avgGoalProgress' | 'activeGoalCount' | 'weeklyChartData' |
  'onScrollToTasks' | 'onScrollToHabits' | 'onSetTaskView'
>) {
  const navigate = useNavigate();

  return (
    <div className="insights-section">
      <div className="insights-header">
        <h2><BarChart3 size={16} /> {isToday ? 'Insights' : `${todayStr} overview`}</h2>
      </div>
      <div className="insights-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div className="insight-card glass clickable card-hover" onClick={() => { onScrollToTasks(); onSetTaskView('board'); }}>
          <ProgressRing progress={dayTaskProgress} size={window.innerWidth < 600 ? 70 : 110} color="#39FF14" label="Day Tasks" sublabel={`${dayDoneTasks.length}/${dayTasks.length} done`} />
        </div>
        <div className="insight-card glass clickable card-hover" onClick={onScrollToHabits}>
          <ProgressRing progress={totalHabits > 0 ? dayHabitsDone / totalHabits : 0} size={window.innerWidth < 600 ? 70 : 110} color="#F97316" label="Habits" sublabel={`${bestHabitStreak}d streak`} />
        </div>
        <div className="insight-card glass clickable card-hover" onClick={() => navigate('/goals')}>
          <ProgressRing progress={avgGoalProgress} size={window.innerWidth < 600 ? 70 : 110} color="#A855F7" label="Goals" sublabel={`${activeGoalCount} active`} />
        </div>
        <div className="insight-card glass chart-card">
          <MiniChart data={weeklyChartData.map(d => d.count)} labels={weeklyChartData.map(d => d.label)} color="#00D4FF" height={80} title="Tasks this week" />
        </div>
      </div>
    </div>
  );
}
