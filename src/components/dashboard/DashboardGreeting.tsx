/**
 * DashboardGreeting — Personalized header with time-aware gradient + level badge.
 *
 * Time-aware: sunrise gradient (morning), warm (afternoon), cool (evening).
 * Shows today's focus: # tasks due, next habit, financial summary.
 */

import { useState, lazy, Suspense, useMemo } from 'react';
import { Moon, Sun, Flame, Settings, CheckCircle2, Target, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../stores/useUserStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useGamificationContext } from '../../lib/gamification/context';
import { useDashboardLayout } from '../../hooks/useDashboardLayout';
import { GamificationModal } from '../GamificationModal';
import { localDateStr } from '../../utils/date';
import { useShallow } from 'zustand/react/shallow';

const MiniCharacter = lazy(() => import('../../realm/ui/MiniCharacter').then(m => ({ default: m.MiniCharacter })));

interface DashboardGreetingProps {
  selectedDate: string;
  bestHabitStreak: number;
  todayMood: string | null;
  onEditLayout?: () => void;
}

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h < 6) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const TIME_CONFIG: Record<TimeOfDay, { icon: React.ReactNode; gradient: string; greeting: string; nameGradient: string }> = {
  morning: {
    icon: <Sun size={16} style={{ color: '#FACC15' }} />,
    gradient: 'linear-gradient(135deg, rgba(250,204,21,0.08) 0%, rgba(249,115,22,0.05) 50%, rgba(239,68,68,0.03) 100%)',
    greeting: 'Good morning',
    nameGradient: 'linear-gradient(135deg, #F9FAFB 20%, #FACC15 60%, #F97316 100%)',
  },
  afternoon: {
    icon: <Flame size={16} style={{ color: '#F97316' }} />,
    gradient: 'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(234,179,8,0.05) 50%, rgba(250,204,21,0.03) 100%)',
    greeting: 'Good afternoon',
    nameGradient: 'linear-gradient(135deg, #F9FAFB 20%, #F97316 60%, #EAB308 100%)',
  },
  evening: {
    icon: <Moon size={16} style={{ color: '#A78BFA' }} />,
    gradient: 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(59,130,246,0.05) 50%, rgba(0,212,255,0.03) 100%)',
    greeting: 'Good evening',
    nameGradient: 'linear-gradient(135deg, #F9FAFB 20%, #A78BFA 60%, #3B82F6 100%)',
  },
  night: {
    icon: <Moon size={16} style={{ color: '#6366F1' }} />,
    gradient: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 50%, rgba(167,139,250,0.03) 100%)',
    greeting: 'Night owl mode',
    nameGradient: 'linear-gradient(135deg, #F9FAFB 20%, #6366F1 60%, #A78BFA 100%)',
  },
};

export function DashboardGreeting({ selectedDate, bestHabitStreak, todayMood, onEditLayout }: DashboardGreetingProps) {
  const firstName = useUserStore(s => s.firstName);
  const gam = useGamificationContext();
  const layout = useDashboardLayout();
  const navigate = useNavigate();
  const [gamModalOpen, setGamModalOpen] = useState(false);

  const today = localDateStr();
  const time = getTimeOfDay();
  const config = TIME_CONFIG[time];

  // Today's focus data
  const tasks = useScheduleStore(s => s.tasks);
  const habits = useHabitsStore(s => s.habits);
  const logs = useHabitsStore(s => s.logs);
  const { income, expenses } = useFinanceStore(useShallow(s => ({ income: s.income, expenses: s.expenses })));

  const focusData = useMemo(() => {
    const todayTasks = tasks.filter(t => t.due_date === today && t.status !== 'done');
    const taskCount = todayTasks.length;

    // Next unlogged habit
    const todayLogs = logs.filter(l => l.date === today);
    const nextHabit = habits.find(h => {
      const hLogs = todayLogs.filter(l => l.habit_id === h.id);
      const total = hLogs.reduce((s: number, l: any) => s + (l.count || 1), 0);
      return total < (h.target_count || 1);
    });

    // Month financials
    const somStr = (() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; })();
    const mIncome = income.filter(i => i.date >= somStr).reduce((s, i) => s + i.amount, 0);
    const mExpenses = expenses.filter(e => e.date >= somStr).reduce((s, e) => s + e.amount, 0);

    return { taskCount, nextHabit, net: mIncome - mExpenses };
  }, [tasks, habits, logs, income, expenses, today]);

  const todayStr = (() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  })();

  return (
    <>
      <div className="dash-header animate-fadeUp" style={{
        background: config.gradient,
        borderRadius: 16,
        padding: '16px 18px',
        margin: '0 0 10px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 0.8s ease',
      }}>
        {/* Subtle ambient glow */}
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 100, height: 100, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <p className="dash-greeting" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {config.icon}{config.greeting}, {firstName}
            </p>
            <h1 className="dash-name" style={{
              background: config.nameGradient,
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'gradient-shift 8s ease infinite',
            }}>
              {firstName}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
              <p className="dash-date">{todayStr}{todayMood && <span className="dash-mood"> {todayMood}</span>}</p>
              {bestHabitStreak > 0 && (
                <span role="status" aria-label={`${bestHabitStreak} day streak`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
                  borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                  color: '#F97316', transition: 'all 0.2s',
                }}>
                  <Flame size={12} style={{ marginRight: 2, verticalAlign: 'middle' }} />{bestHabitStreak}d streak
                </span>
              )}
            </div>

            {/* Today's Focus pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {focusData.taskCount > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.15)',
                  borderRadius: 12, padding: '3px 8px', color: '#39FF14',
                }}>
                  <CheckCircle2 size={10} /> {focusData.taskCount} task{focusData.taskCount !== 1 ? 's' : ''} due
                </span>
              )}
              {focusData.nextHabit && (
                <span style={{
                  fontSize: 10, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)',
                  borderRadius: 12, padding: '3px 8px', color: '#F97316',
                }}>
                  <Target size={10} /> {focusData.nextHabit.title}
                </span>
              )}
              <span style={{
                fontSize: 10, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4,
                background: focusData.net >= 0 ? 'rgba(57,255,20,0.08)' : 'rgba(244,63,94,0.08)',
                border: `1px solid ${focusData.net >= 0 ? 'rgba(57,255,20,0.15)' : 'rgba(244,63,94,0.15)'}`,
                borderRadius: 12, padding: '3px 8px',
                color: focusData.net >= 0 ? '#39FF14' : '#F43F5E',
              }}>
                <DollarSign size={10} />
                {focusData.net >= 0 ? '+' : '-'}${Math.abs(focusData.net).toFixed(0)} net
              </span>
            </div>
          </div>

          <div className="dash-header-actions" style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexShrink: 0, marginLeft: 'auto' }}>
            {/* Mini character — desktop only */}
            <Suspense fallback={null}>
              <div
                className="dash-character-btn"
                role="button"
                tabIndex={0}
                onClick={() => navigate('/character')}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('/character'); }}
                aria-label="View character"
                title="Character"
                style={{
                  cursor: 'pointer', borderRadius: 8,
                  border: '1px solid rgba(212,175,55,0.2)',
                  background: 'rgba(212,175,55,0.06)', padding: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <MiniCharacter size={32} animate fps={10} />
              </div>
            </Suspense>
            {!gam.loading && (
              <button
                className="dash-level-btn"
                onClick={() => setGamModalOpen(true)}
                aria-label={`Level ${gam.level}, ${gam.title}, ${gam.xp} XP total`}
                title={`Level ${gam.level} — ${gam.title} — ${gam.xp} XP total`}
                style={{
                  background: 'linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(255,215,0,0.08) 100%)',
                  border: '1px solid rgba(212,175,55,0.3)',
                  borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)')}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #D4AF37, #FFD700)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Orbitron', monospace", fontWeight: 900,
                  fontSize: 10, color: '#0A0E1A', flexShrink: 0,
                  boxShadow: '0 0 8px rgba(212,175,55,0.4)',
                }}>
                  {gam.level}
                </div>
                <div className="dash-level-detail" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <span style={{ fontSize: 9, color: '#D4AF37', fontWeight: 700, lineHeight: 1 }}>{gam.title}</span>
                  <div style={{ width: 48, height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${Math.round(gam.xpProgress * 100)}%`,
                      background: 'linear-gradient(90deg, #D4AF37, #FFD700)',
                      borderRadius: 2, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
                    }} />
                  </div>
                </div>
              </button>
            )}
            <button className="dash-icon-btn dash-layout-btn" onClick={() => onEditLayout ? onEditLayout() : layout.setEditing(true)} aria-label="Customise dashboard layout" title="Customise Dashboard" style={{
              background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)',
              borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#00D4FF',
              fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4,
              transition: 'all 0.2s',
            }}>
              <Settings size={13} /><span className="dash-layout-label" style={{ fontSize: 11 }}>Layout</span>
            </button>
          </div>
        </div>
      </div>

      <GamificationModal open={gamModalOpen} onClose={() => setGamModalOpen(false)} />
    </>
  );
}