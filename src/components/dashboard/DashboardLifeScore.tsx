import './DashboardLifeScore.css';

// ═══════════════════════════════════════════════════════════
// DashboardLifeScore — Aggregate life quality score (0-100)
// Fuses habits, goals, health, finances, schedule into one
// glanceable metric. Inspired by VISION-v2 "Personal Intelligence
// Platform" — a single number that represents your whole life state.
// ═══════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart, Flame, Target, Receipt, CalendarCheck, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { ProgressRing } from '../ui/ProgressRing';

// ═══ Domain Score Input ═══
interface LifeScoreInput {
  /** 0-1: fraction of today's habits completed */
  habitCompletion: number;
  /** 0-1: average goal progress */
  goalProgress: number;
  /** 0-5: today's mood score (null if not logged) */
  mood: number | null;
  /** 0-5: today's energy score (null if not logged) */
  energy: number | null;
  /** hours of sleep last night (null if not logged) */
  sleepHours: number | null;
  /** 0-1: fraction of today's tasks completed */
  taskCompletion: number;
  /** number: net income this month (positive = good) */
  netIncome: number;
  /** number: overdue bills count */
  overdueBills: number;
  /** 0-1: fraction of today's events attended/completed */
  scheduleCompletion: number;
  /** number: best current habit streak in days */
  bestStreak: number;
  /** yesterday's life score (for trend comparison) */
  yesterdayScore: number | null;
}

// ═══ Weight Config ═══
// These weights determine how much each domain contributes to the overall score.
// They sum to 1.0. Adjust based on what LifeOS values most.
const WEIGHTS = {
  habits: 0.20,
  goals: 0.15,
  health: 0.20,
  tasks: 0.15,
  finances: 0.15,
  schedule: 0.10,
  streak: 0.05,
} as const;

// ═══ Score Calculation ═══
function calcHabitScore(completion: number): number {
  // Diminishing returns: 50% completion = 70 score, 100% = 100
  return Math.round(Math.pow(completion, 0.7) * 100);
}

function calcGoalScore(progress: number): number {
  return Math.round(progress * 100);
}

function calcHealthScore(mood: number | null, energy: number | null, sleepHours: number | null): number {
  let score = 50; // baseline — no data = neutral
  let factors = 0;

  if (mood !== null) {
    score += (mood / 5) * 25 - 12.5; // -12.5 to +12.5
    factors++;
  }
  if (energy !== null) {
    score += (energy / 5) * 25 - 12.5;
    factors++;
  }
  if (sleepHours !== null) {
    // Optimal: 7-9 hours. Below 6 or above 10 = penalty
    const optimal = Math.min(sleepHours, 9);
    const sleepScore = sleepHours < 6 ? 0.3 : sleepHours > 10 ? 0.7 : (optimal - 5) / 4;
    score += sleepScore * 25 - 12.5;
    factors++;
  }

  // If no health data at all, return 50 (neutral)
  if (factors === 0) return 50;

  // Normalize back to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

function calcTaskScore(completion: number): number {
  return Math.round(Math.pow(completion, 0.8) * 100);
}

function calcFinanceScore(netIncome: number, overdueBills: number): number {
  let score = 50; // baseline
  // Positive income boosts, negative hurts
  if (netIncome > 0) {
    score += Math.min(30, netIncome / 100); // Cap at +30
  } else if (netIncome < 0) {
    score -= Math.min(30, Math.abs(netIncome) / 100);
  }
  // Overdue bills are a penalty
  score -= overdueBills * 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function calcScheduleScore(completion: number): number {
  return Math.round(completion * 100);
}

function calcStreakScore(streak: number): number {
  // 7-day streak = 70, 14-day = 85, 30-day = 100
  if (streak <= 0) return 0;
  return Math.min(100, Math.round(Math.pow(streak / 30, 0.6) * 100));
}

function computeLifeScore(input: LifeScoreInput): {
  total: number;
  domains: { name: string; score: number; weight: number; icon: typeof Heart }[];
  trend: 'up' | 'down' | 'stable';
} {
  const habitScore = calcHabitScore(input.habitCompletion);
  const goalScore = calcGoalScore(input.goalProgress);
  const healthScore = calcHealthScore(input.mood, input.energy, input.sleepHours);
  const taskScore = calcTaskScore(input.taskCompletion);
  const financeScore = calcFinanceScore(input.netIncome, input.overdueBills);
  const scheduleScore = calcScheduleScore(input.scheduleCompletion);
  const streakScore = calcStreakScore(input.bestStreak);

  const domains = [
    { name: 'Habits', score: habitScore, weight: WEIGHTS.habits, icon: Flame },
    { name: 'Health', score: healthScore, weight: WEIGHTS.health, icon: Heart },
    { name: 'Goals', score: goalScore, weight: WEIGHTS.goals, icon: Target },
    { name: 'Tasks', score: taskScore, weight: WEIGHTS.tasks, icon: CalendarCheck },
    { name: 'Finances', score: financeScore, weight: WEIGHTS.finances, icon: Receipt },
    { name: 'Schedule', score: scheduleScore, weight: WEIGHTS.schedule, icon: CalendarCheck },
    { name: 'Streak', score: streakScore, weight: WEIGHTS.streak, icon: TrendingUp },
  ];

  const total = Math.round(
    domains.reduce((sum, d) => sum + d.score * d.weight, 0)
  );

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (input.yesterdayScore !== null) {
    const diff = total - input.yesterdayScore;
    if (diff > 2) trend = 'up';
    else if (diff < -2) trend = 'down';
  }

  return { total, domains, trend };
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Thriving';
  if (score >= 75) return 'Flourishing';
  if (score >= 60) return 'Progressing';
  if (score >= 45) return 'Stable';
  if (score >= 30) return 'Drifting';
  if (score >= 15) return 'Struggling';
  return 'Critical';
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#39FF14'; // green
  if (score >= 50) return '#00D4FF'; // cyan
  if (score >= 30) return '#EAB308'; // yellow
  return '#F43F5E'; // red
}

// ═══ Component ═══
export interface DashboardLifeScoreProps {
  input: LifeScoreInput;
}

export function DashboardLifeScore({ input }: DashboardLifeScoreProps) {
  const navigate = useNavigate();
  const { total, domains, trend } = useMemo(() => computeLifeScore(input), [input]);
  const color = getScoreColor(total);
  const label = getScoreLabel(total);

  // Find weakest domain for the "focus here" nudge
  const weakest = [...domains].sort((a, b) => a.score - b.score)[0];

  return (
    <section className="dash-card life-score-card" aria-label="Life Score overview">
      <div className="card-top">
        <h2><Heart size={16} /> Life Score</h2>
        <span className="life-score-trend" aria-label={`Trend: ${trend}`}>
          {trend === 'up' && <TrendingUp size={14} color="#39FF14" />}
          {trend === 'down' && <TrendingDown size={14} color="#F43F5E" />}
          {trend === 'stable' && <Minus size={14} color="#666" />}
        </span>
      </div>

      <div className="life-score-main" onClick={() => navigate('/health')} role="button" tabIndex={0} aria-label={`Life score: ${total} out of 100. ${label}`}>
        <div className="life-score-ring">
          <ProgressRing
            progress={total / 100}
            size={window.innerWidth < 600 ? 120 : 150}
            color={color}
            label={String(total)}
            sublabel={label}
          />
        </div>
      </div>

      {/* Domain breakdown bars */}
      <div className="life-score-domains" role="list" aria-label="Life score domain breakdown">
        {domains.map(domain => {
          const DomainIcon = domain.icon;
          const barColor = getScoreColor(domain.score);
          return (
            <div
              key={domain.name}
              className="life-score-domain"
              role="listitem"
              aria-label={`${domain.name}: ${domain.score} out of 100`}
            >
              <div className="domain-label">
                <DomainIcon size={12} color={barColor} />
                <span className="domain-name">{domain.name}</span>
                <span className="domain-value" style={{ color: barColor }}>{domain.score}</span>
              </div>
              <div className="domain-bar-track">
                <div
                  className="domain-bar-fill"
                  style={{
                    width: `${domain.score}%`,
                    background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Weakest domain nudge */}
      {weakest.score < 50 && (
        <div className="life-score-nudge glass" role="status">
          <TrendingUp size={14} color="#EAB308" />
          <span>Focus area: <strong>{weakest.name}</strong> ({weakest.score}/100)</span>
        </div>
      )}
    </section>
  );
}

export { computeLifeScore, getScoreColor, getScoreLabel };
export type { LifeScoreInput };