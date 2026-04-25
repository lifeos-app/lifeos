/**
 * Year in Review — Annual recap page with SVG charts and stats
 */
import { useState, useMemo, type JSX } from 'react';
import {
  Calendar, Trophy, Flame, Heart, DollarSign, Star, Sparkles,
  TrendingUp, Copy, Check, ChevronDown,
} from 'lucide-react';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useHealthStore } from '../stores/useHealthStore';
import { useJournalStore } from '../stores/useJournalStore';
import { useGamificationContext } from '../lib/gamification/context';
import { generateYearInReview, type YearInReviewData } from '../lib/year-in-review';

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const glass = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
};

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: JSX.Element; color: string }) {
  return (
    <div style={{ ...glass, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      </div>
      <span style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{value}</span>
    </div>
  );
}

function BarChart({ data, color, height = 120 }: { data: number[]; color: string; height?: number }) {
  const max = Math.max(1, ...data);
  const barW = 100 / 12;
  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {data.map((val, i) => {
        const barH = (val / max) * (height - 20);
        return (
          <g key={i}>
            <rect
              x={i * barW + barW * 0.15}
              y={height - 16 - barH}
              width={barW * 0.7}
              height={Math.max(0, barH)}
              fill={color}
              rx={1.5}
              opacity={0.85}
            />
            <text x={i * barW + barW / 2} y={height - 3} textAnchor="middle" fontSize="3.5" fill="rgba(255,255,255,0.4)">
              {MONTH_LABELS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function GroupedBarChart({ data1, data2, color1, color2, height = 120 }: {
  data1: number[]; data2: number[]; color1: string; color2: string; height?: number;
}) {
  const max = Math.max(1, ...data1, ...data2);
  const barW = 100 / 12;
  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {data1.map((val1, i) => {
        const val2 = data2[i] || 0;
        const h1 = (val1 / max) * (height - 20);
        const h2 = (val2 / max) * (height - 20);
        const halfBar = barW * 0.35;
        return (
          <g key={i}>
            <rect x={i * barW + barW * 0.1} y={height - 16 - h1} width={halfBar} height={Math.max(0, h1)} fill={color1} rx={1} opacity={0.85} />
            <rect x={i * barW + barW * 0.1 + halfBar + 1} y={height - 16 - h2} width={halfBar} height={Math.max(0, h2)} fill={color2} rx={1} opacity={0.85} />
            <text x={i * barW + barW / 2} y={height - 3} textAnchor="middle" fontSize="3.5" fill="rgba(255,255,255,0.4)">
              {MONTH_LABELS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MoodTrendLine({ data, height = 80 }: { data: number[]; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(5, ...data);
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 96 + 2;
    const y = height - 10 - ((val / max) * (height - 20));
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke="#EC4899" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function HabitHeatmap({ data }: { data: number[] }) {
  // 12 months as a simple grid
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
      {data.map((val, i) => {
        const maxVal = Math.max(1, ...data);
        const intensity = val / maxVal;
        const bg = intensity > 0.7 ? '#39FF14' : intensity > 0.4 ? '#1A6A2E' : intensity > 0 ? '#0D3B16' : 'rgba(255,255,255,0.04)';
        return (
          <div key={i} style={{
            width: '100%', aspectRatio: '1', borderRadius: 4, background: bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, color: 'rgba(255,255,255,0.5)',
          }} title={`${MONTH_LABELS[i]}: ${val} logs`}>
            {MONTH_LABELS[i]}
          </div>
        );
      })}
    </div>
  );
}

function WordCloud({ words }: { words: Array<{ word: string; count: number }> }) {
  if (words.length === 0) return <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No journal data for word cloud</p>;
  const maxCount = Math.max(1, ...words.map(w => w.count));
  const colors = ['#00D4FF', '#39FF14', '#D4AF37', '#C084FC', '#EC4899', '#F97316'];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {words.map((w, i) => {
        const size = 12 + (w.count / maxCount) * 24;
        return (
          <span key={w.word} style={{
            fontSize: size, fontWeight: size > 24 ? 700 : 500,
            color: colors[i % colors.length], opacity: 0.6 + (w.count / maxCount) * 0.4,
          }}>
            {w.word}
          </span>
        );
      })}
    </div>
  );
}

export default function YearInReview(): JSX.Element {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [copied, setCopied] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);

  // Gather all store data
  const tasks = useScheduleStore(s => s.tasks);
  const habits = useHabitsStore(s => s.habits);
  const habitLogs = useHabitsStore(s => s.logs);
  const goals = useGoalsStore(s => s.goals);
  const income = useFinanceStore(s => s.income);
  const expenses = useFinanceStore(s => s.expenses);
  const journalEntries = useJournalStore(s => s.entries);
  const healthMetrics = useHealthStore(s => s.todayMetrics);
  const gam = useGamificationContext();

  // Available years (from journal + task dates)
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    for (const e of journalEntries) {
      const y = parseInt(e.date?.slice(0, 4), 10);
      if (y > 2000 && y <= currentYear) years.add(y);
    }
    for (const t of tasks) {
      const d = t.created_at || t.scheduled_date || '';
      const y = parseInt(d.slice(0, 4), 10);
      if (y > 2000 && y <= currentYear) years.add(y);
    }
    return [...years].sort((a, b) => b - a);
  }, [journalEntries, tasks, currentYear]);

  const reviewData: YearInReviewData = useMemo(() => {
    return generateYearInReview(selectedYear, {
      tasks: tasks as any,
      habits: habits as any,
      habitLogs: habitLogs as any,
      goals: goals as any,
      income: income as any,
      expenses: expenses as any,
      journalEntries: journalEntries as any,
      healthMetrics: healthMetrics ? [healthMetrics] : [],
      xpTotal: gam.xp || 0,
      level: gam.level || 1,
      achievements: 0,
    });
  }, [selectedYear, tasks, habits, habitLogs, goals, income, expenses, journalEntries, healthMetrics, gam.xp, gam.level]);

  const handleCopyShare = () => {
    const summary = [
      `My ${selectedYear} Year in Review`,
      `Tasks Completed: ${reviewData.tasksCompleted}`,
      `Habit Logs: ${reviewData.totalHabitLogs}`,
      `Best Streak: ${reviewData.bestStreak} days`,
      `Journal Entries: ${reviewData.journalEntriesWritten}`,
      `Goals Completed: ${reviewData.goalsCompleted}`,
      reviewData.totalIncome > 0 ? `Savings Rate: ${reviewData.savingsRate}%` : '',
      '',
      ...reviewData.topHighlights,
      '',
      'Generated with LifeOS',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const sectionStyle = {
    ...glass,
    padding: 24,
    marginBottom: 16,
  };

  const sectionHeader = (icon: JSX.Element, title: string, color: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, color }}>
      {icon}
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fff' }}>{title}</h2>
    </div>
  );

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px 80px', fontFamily: "'Poppins', sans-serif" }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
          <button
            onClick={() => setYearDropdownOpen(!yearDropdownOpen)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, padding: 0,
            }}
          >
            <h1 style={{ margin: 0, fontSize: 42, fontWeight: 800, color: '#D4AF37', letterSpacing: -1 }}>
              {selectedYear}
            </h1>
            <ChevronDown size={20} color="#D4AF37" />
          </button>
          {yearDropdownOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
              ...glass, padding: 8, zIndex: 10, minWidth: 100,
            }}>
              {availableYears.map(y => (
                <button key={y} onClick={() => { setSelectedYear(y); setYearDropdownOpen(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '8px 16px', background: y === selectedYear ? 'rgba(212,175,55,0.15)' : 'transparent',
                    border: 'none', color: y === selectedYear ? '#D4AF37' : '#fff', cursor: 'pointer',
                    borderRadius: 6, fontSize: 15, fontWeight: y === selectedYear ? 600 : 400, textAlign: 'center',
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>
        <p style={{ color: '#D4AF37', fontSize: 18, fontWeight: 500, margin: '4px 0 0' }}>Your Year in Review</p>
      </div>

      {/* Hero Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Tasks Done" value={reviewData.tasksCompleted} icon={<Check size={16} />} color="#00D4FF" />
        <StatCard label="Habit Logs" value={reviewData.totalHabitLogs} icon={<Flame size={16} />} color="#F97316" />
        <StatCard label="Best Streak" value={`${reviewData.bestStreak}d`} icon={<TrendingUp size={16} />} color="#39FF14" />
      </div>

      {/* Productivity */}
      <div style={sectionStyle}>
        {sectionHeader(<Trophy size={20} />, 'Productivity', '#00D4FF')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Most Productive</span>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600, color: '#fff' }}>{reviewData.mostProductiveMonth}</p>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Focus Time</span>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600, color: '#fff' }}>{Math.round(reviewData.totalFocusMinutes / 60)}h</p>
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Tasks completed by month</p>
        <BarChart data={reviewData.tasksByMonth} color="#00D4FF" />
      </div>

      {/* Habits */}
      <div style={sectionStyle}>
        {sectionHeader(<Flame size={20} />, 'Habits', '#F97316')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Most Consistent</span>
            <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 600, color: '#fff' }}>{reviewData.mostConsistentHabit}</p>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Completion Rate</span>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600, color: '#fff' }}>{reviewData.habitCompletionRate}%</p>
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Habit activity by month</p>
        <HabitHeatmap data={reviewData.habitLogsByMonth} />
      </div>

      {/* Health */}
      <div style={sectionStyle}>
        {sectionHeader(<Heart size={20} />, 'Health', '#EC4899')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Avg Sleep</span>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600, color: '#fff' }}>{reviewData.avgSleep}h</p>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Avg Mood</span>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600, color: '#fff' }}>{reviewData.avgMood}/5</p>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Workouts</span>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600, color: '#fff' }}>{reviewData.workoutsLogged}</p>
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>Best wellness month: {reviewData.bestWellnessMonth}</p>
      </div>

      {/* Finances */}
      <div style={sectionStyle}>
        {sectionHeader(<DollarSign size={20} />, 'Finances', '#FACC15')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Total Income</span>
            <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 600, color: '#39FF14' }}>${reviewData.totalIncome.toLocaleString()}</p>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Total Expenses</span>
            <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 600, color: '#F43F5E' }}>${reviewData.totalExpenses.toLocaleString()}</p>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Savings Rate</span>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600, color: '#D4AF37' }}>{reviewData.savingsRate}%</p>
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Income vs Expenses by month</p>
        <GroupedBarChart data1={reviewData.incomeByMonth} data2={reviewData.expensesByMonth} color1="#39FF14" color2="#F43F5E" />
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#39FF14', marginRight: 4 }} />Income
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#F43F5E', marginLeft: 12, marginRight: 4 }} />Expenses
        </p>
      </div>

      {/* Growth */}
      <div style={sectionStyle}>
        {sectionHeader(<Star size={20} />, 'Growth', '#D4AF37')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Total XP</span>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600, color: '#D4AF37' }}>{reviewData.xpEarned.toLocaleString()}</p>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Level</span>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600, color: '#fff' }}>{reviewData.levelsGained}</p>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Journal Entries</span>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600, color: '#fff' }}>{reviewData.journalEntriesWritten}</p>
          </div>
        </div>
      </div>

      {/* Goals */}
      <div style={sectionStyle}>
        {sectionHeader(<Calendar size={20} />, 'Goals', '#39FF14')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Completed</span>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600, color: '#39FF14' }}>{reviewData.goalsCompleted}</p>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Completion %</span>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600, color: '#fff' }}>{reviewData.goalCompletionPercent}%</p>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Most Progress</span>
            <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reviewData.mostProgressedGoal}</p>
          </div>
        </div>
      </div>

      {/* Highlights */}
      {reviewData.topHighlights.length > 0 && (
        <div style={sectionStyle}>
          {sectionHeader(<Sparkles size={20} />, 'Highlights', '#D4AF37')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reviewData.topHighlights.map((h, i) => (
              <div key={i} style={{
                ...glass, padding: '12px 16px', fontSize: 15, fontWeight: 500,
                color: '#D4AF37', background: 'rgba(212,175,55,0.06)',
              }}>
                {h}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Word Cloud */}
      <div style={sectionStyle}>
        {sectionHeader(<Star size={20} />, 'Journal Word Cloud', '#C084FC')}
        <WordCloud words={reviewData.wordCloud} />
      </div>

      {/* Share */}
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button
          onClick={handleCopyShare}
          style={{
            padding: '12px 32px', background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)',
            borderRadius: 8, color: '#D4AF37', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Share Summary</>}
        </button>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 8 }}>
          Copies a text summary to your clipboard. PDF export coming soon.
        </p>
      </div>
    </div>
  );
}
