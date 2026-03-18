import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart, Brain, TrendingUp, Coins, BookOpen, Users,
  ChevronRight, AlertCircle,
} from 'lucide-react';
import { useGamificationContext } from '../../lib/gamification/context';
import { useHealthStore } from '../../stores/useHealthStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useJournalStore } from '../../stores/useJournalStore';

interface StatCardData {
  name: string;
  icon: typeof Heart;
  color: string;
  value: number;
  recommendations: { text: string; path: string }[];
}

export function StatsTab() {
  const navigate = useNavigate();
  const gam = useGamificationContext();
  const todayMetrics = useHealthStore(s => s.todayMetrics);
  const getOverdueTasks = useScheduleStore(s => s.getOverdueTasks);
  const { habits, logs: habitLogs } = useHabitsStore();
  const netCashflow = useFinanceStore(s => s.netCashflow);
  const { goals } = useGoalsStore();
  const { entries: journalEntries } = useJournalStore();

  const stats = gam.stats || { productivity: 0, consistency: 0, health: 0, finance: 0, knowledge: 0, social: 0 };

  const statCards: StatCardData[] = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const overdueTasks = getOverdueTasks();
    const todayLogs = habitLogs.filter(l => l.date === today);
    const habitsNotDone = habits.length - todayLogs.length;
    const cashflow = netCashflow();
    const hasRecentJournal = journalEntries.some(e => e.date === today);
    const staleGoals = goals.filter(g => g.status === 'active' && g.progress !== undefined && g.progress < 50);

    return [
      {
        name: 'Health',
        icon: Heart,
        color: '#F43F5E',
        value: stats.health,
        recommendations: !todayMetrics
          ? [{ text: 'Log your health today', path: '/health' }]
          : [{ text: 'View health dashboard', path: '/health' }],
      },
      {
        name: 'Productivity',
        icon: TrendingUp,
        color: '#F97316',
        value: stats.productivity,
        recommendations: overdueTasks.length > 0
          ? [{ text: `${overdueTasks.length} task${overdueTasks.length !== 1 ? 's' : ''} overdue`, path: '/schedule' }]
          : [{ text: 'View schedule', path: '/schedule' }],
      },
      {
        name: 'Consistency',
        icon: AlertCircle,
        color: '#EAB308',
        value: stats.consistency,
        recommendations: habitsNotDone > 0
          ? [{ text: `${habitsNotDone} habit${habitsNotDone !== 1 ? 's' : ''} to log today`, path: '/habits' }]
          : [{ text: 'All habits done today!', path: '/habits' }],
      },
      {
        name: 'Finance',
        icon: Coins,
        color: '#39FF14',
        value: stats.finance,
        recommendations: cashflow < 0
          ? [{ text: `Cashflow: -$${Math.abs(cashflow).toLocaleString()}`, path: '/finances' }]
          : [{ text: cashflow > 0 ? `+$${cashflow.toLocaleString()} this month` : 'Track finances', path: '/finances' }],
      },
      {
        name: 'Knowledge',
        icon: BookOpen,
        color: '#A855F7',
        value: stats.knowledge,
        recommendations: [
          ...(!hasRecentJournal ? [{ text: 'Write in your journal', path: '/reflect?tab=journal' }] : []),
          ...(staleGoals.length > 0 ? [{ text: `${staleGoals.length} goal${staleGoals.length !== 1 ? 's' : ''} need attention`, path: '/goals' }] : []),
          ...(hasRecentJournal && staleGoals.length === 0 ? [{ text: 'Review your goals', path: '/goals' }] : []),
        ].slice(0, 2),
      },
      {
        name: 'Social',
        icon: Users,
        color: '#00D4FF',
        value: stats.social,
        recommendations: [{ text: 'Connect with friends', path: '/social' }],
      },
    ];
  }, [stats, todayMetrics, getOverdueTasks, habits, habitLogs, netCashflow, goals, journalEntries]);

  return (
    <div className="ch-stats-tab">
      <div className="ch-stats-header">
        <h2 className="ch-stats-title">Level {gam.level} — {gam.title}</h2>
        <div className="ch-xp-bar">
          <div className="ch-xp-fill" style={{ width: `${(gam.xpProgress || 0) * 100}%` }} />
        </div>
        <div className="ch-xp-label">{gam.xp} XP — {gam.xpToNext} to next level</div>
      </div>

      <div className="ch-stat-cards">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.name} className="ch-stat-card" style={{ '--stat-color': card.color } as React.CSSProperties}>
              <div className="ch-stat-card-header">
                <Icon size={18} style={{ color: card.color }} />
                <span className="ch-stat-card-name">{card.name}</span>
                <span className="ch-stat-card-value" style={{ color: card.color }}>{card.value}</span>
              </div>
              <div className="ch-stat-card-bar">
                <div className="ch-stat-card-fill" style={{ width: `${card.value}%`, background: card.color }} />
              </div>
              {card.recommendations.map((rec, i) => (
                <button
                  key={i}
                  className="ch-stat-rec"
                  onClick={() => navigate(rec.path)}
                >
                  <span>{rec.text}</span>
                  <ChevronRight size={12} />
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
