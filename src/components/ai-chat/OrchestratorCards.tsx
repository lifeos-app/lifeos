import {
  Activity, Target, Coffee, Zap, Calendar, Sun,
  CheckSquare,
} from 'lucide-react';
import type { BalanceStatus } from '../../lib/llm/balance-engine';
import type { GoalCoachResult } from '../../lib/llm/goal-coach';
import type { MealSuggestionsResult, MealSuggestion } from '../../lib/llm/meal-suggestions';
import type { GeneratedWorkout } from '../../lib/llm/workout-ai';
import type { WeeklyInsightsData } from '../../lib/llm/weekly-insights';
import type { LLMMorningBrief } from '../../lib/llm/morning-brief';
import type { RescheduleResult } from '../../lib/llm/reschedule';
import type { OptimizerResult } from '../../lib/llm/schedule-optimizer';
import type { OrchestratorToolResult } from '../../lib/llm/orchestrator';

// ─── Rich Card Components for Orchestrator Results ───────────────

export function BalanceIndicator({ status }: { status: BalanceStatus }) {
  const maxXP = Math.max(...status.domains.map(d => d.xp), 1);
  return (
    <div className="ai-orch-card ai-balance-card">
      <div className="ai-orch-card-header">
        <Activity size={16} style={{ color: '#7C5CFC' }} />
        <span>Life Balance</span>
        <span className="ai-balance-score" style={{
          color: status.score >= 70 ? '#22C55E' : status.score >= 40 ? '#F97316' : '#EF4444'
        }}>{status.score}/100</span>
      </div>
      <div className="ai-balance-bars">
        {status.domains.map(d => (
          <div key={d.domain} className="ai-balance-row">
            <span className="ai-balance-icon">{d.icon}</span>
            <span className="ai-balance-label">{d.label}</span>
            <div className="ai-balance-bar-track">
              <div
                className="ai-balance-bar-fill"
                style={{
                  width: `${maxXP > 0 ? Math.max(2, (d.xp / maxXP) * 100) : 2}%`,
                  backgroundColor: d.color,
                }}
              />
            </div>
            <span className="ai-balance-xp">{d.xp.toLocaleString()}</span>
          </div>
        ))}
      </div>
      {status.suggestions.length > 0 && (
        <div className="ai-orch-suggestions">
          {status.suggestions.slice(0, 2).map((s, i) => (
            <div key={i} className="ai-orch-suggestion">{s}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GoalCoachCard({ result }: { result: GoalCoachResult }) {
  return (
    <div className="ai-orch-card">
      <div className="ai-orch-card-header">
        <Target size={16} style={{ color: '#3B82F6' }} />
        <span>Goal Analysis</span>
        <span className="ai-orch-badge">{result.insights.length} goals</span>
      </div>
      <div className="ai-orch-list">
        {result.insights.slice(0, 5).map(g => (
          <div key={g.goalId} className="ai-orch-item" style={{ borderLeftColor: g.goalColor }}>
            <span className="ai-orch-item-icon">{g.goalIcon}</span>
            <div className="ai-orch-item-body">
              <span className="ai-orch-item-title">{g.goalTitle}</span>
              <span className="ai-orch-item-detail">
                {g.progressPct}% done · {g.nudge}
              </span>
            </div>
            <span className={`ai-orch-status ai-orch-status--${g.status}`}>
              {g.status.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MealSuggestionsCard({ result }: { result: MealSuggestionsResult }) {
  return (
    <div className="ai-orch-card">
      <div className="ai-orch-card-header">
        <Coffee size={16} style={{ color: '#FDCB6E' }} />
        <span>Meal Suggestions</span>
      </div>
      <div className="ai-orch-list">
        {result.suggestions.slice(0, 4).map((m: MealSuggestion) => (
          <div key={m.id} className="ai-orch-item">
            <span className="ai-orch-item-icon">{m.emoji}</span>
            <div className="ai-orch-item-body">
              <span className="ai-orch-item-title">{m.name}</span>
              <span className="ai-orch-item-detail">
                {m.meal_type} · {m.calories} cal · {m.prep_time_min}min prep
              </span>
            </div>
          </div>
        ))}
      </div>
      {result.nutrient_gaps.length > 0 && (
        <div className="ai-orch-suggestions">
          <div className="ai-orch-suggestion">⚠️ Nutrient gaps: {result.nutrient_gaps.join(', ')}</div>
        </div>
      )}
    </div>
  );
}

export function WorkoutCard({ workout }: { workout: GeneratedWorkout }) {
  return (
    <div className="ai-orch-card">
      <div className="ai-orch-card-header">
        <Zap size={16} style={{ color: '#39FF14' }} />
        <span>{workout.icon} {workout.name}</span>
        <span className="ai-orch-badge">{workout.estimated_duration_min}min</span>
      </div>
      <div className="ai-orch-list">
        {workout.exercises.slice(0, 6).map((ex, i) => (
          <div key={i} className="ai-orch-item ai-orch-item--compact">
            <span className="ai-orch-item-num">{i + 1}</span>
            <div className="ai-orch-item-body">
              <span className="ai-orch-item-title">{ex.name}</span>
              <span className="ai-orch-item-detail">
                {ex.sets}×{ex.reps}{ex.weight_kg ? ` @ ${ex.weight_kg}kg` : ''} · {ex.rest_seconds}s rest
              </span>
            </div>
          </div>
        ))}
        {workout.exercises.length > 6 && (
          <div className="ai-orch-more">+{workout.exercises.length - 6} more exercises</div>
        )}
      </div>
    </div>
  );
}

export function WeeklyInsightsCard({ data }: { data: WeeklyInsightsData }) {
  return (
    <div className="ai-orch-card">
      <div className="ai-orch-card-header">
        <Calendar size={16} style={{ color: '#A855F7' }} />
        <span>Weekly Review</span>
        <span className="ai-orch-badge">{data.weekLabel}</span>
      </div>
      <div className="ai-orch-stats">
        <div className="ai-orch-stat">
          <span className="ai-orch-stat-value">{data.taskCompletion.rate}%</span>
          <span className="ai-orch-stat-label">Tasks Done</span>
        </div>
        <div className="ai-orch-stat">
          <span className="ai-orch-stat-value">{data.habitStreaks.overallRate}%</span>
          <span className="ai-orch-stat-label">Habit Rate</span>
        </div>
        <div className="ai-orch-stat">
          <span className="ai-orch-stat-value">{data.goalProgress.avgProgress}%</span>
          <span className="ai-orch-stat-label">Goal Progress</span>
        </div>
        {data.financeSummary && (
          <div className="ai-orch-stat">
            <span className="ai-orch-stat-value" style={{ color: data.financeSummary.net >= 0 ? '#22C55E' : '#EF4444' }}>
              ${Math.abs(data.financeSummary.net).toFixed(0)}
            </span>
            <span className="ai-orch-stat-label">{data.financeSummary.net >= 0 ? 'Net Saved' : 'Net Spent'}</span>
          </div>
        )}
      </div>
      {data.productiveDay && (
        <div className="ai-orch-suggestions">
          <div className="ai-orch-suggestion">🏆 Most productive: {data.productiveDay.day} ({data.productiveDay.tasksCompleted} tasks)</div>
        </div>
      )}
    </div>
  );
}

export function MorningBriefCard({ brief }: { brief: LLMMorningBrief }) {
  return (
    <div className="ai-orch-card">
      <div className="ai-orch-card-header">
        <Sun size={16} style={{ color: '#FFD700' }} />
        <span>Morning Brief</span>
      </div>
      <div className="ai-orch-stats">
        <div className="ai-orch-stat">
          <span className="ai-orch-stat-value">{brief.stats.tasksToday}</span>
          <span className="ai-orch-stat-label">Tasks</span>
        </div>
        <div className="ai-orch-stat">
          <span className="ai-orch-stat-value">{brief.stats.habitsNotLogged}</span>
          <span className="ai-orch-stat-label">Habits Left</span>
        </div>
        <div className="ai-orch-stat">
          <span className="ai-orch-stat-value">{brief.stats.upcomingEvents}</span>
          <span className="ai-orch-stat-label">Events</span>
        </div>
        <div className="ai-orch-stat">
          <span className="ai-orch-stat-value">🔥{brief.streakStatus.days}</span>
          <span className="ai-orch-stat-label">Streak</span>
        </div>
      </div>
      {brief.todaySchedule.length > 0 && (
        <div className="ai-orch-list">
          {brief.todaySchedule.slice(0, 4).map(s => (
            <div key={s.id} className="ai-orch-item ai-orch-item--compact">
              <span className="ai-orch-item-icon">📅</span>
              <div className="ai-orch-item-body">
                <span className="ai-orch-item-title">{s.title}</span>
                <span className="ai-orch-item-detail">{s.time}{s.location ? ` @ ${s.location}` : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {brief.suggestedFocus && (
        <div className="ai-orch-suggestions">
          <div className="ai-orch-suggestion">🎯 Focus: {brief.suggestedFocus}</div>
        </div>
      )}
    </div>
  );
}

export function RescheduleCard({ result }: { result: RescheduleResult }) {
  if (!result.suggestions || result.suggestions.length === 0) {
    return (
      <div className="ai-orch-card">
        <div className="ai-orch-card-header">
          <CheckSquare size={16} style={{ color: '#22C55E' }} />
          <span>All caught up! 🎉</span>
        </div>
      </div>
    );
  }
  return (
    <div className="ai-orch-card">
      <div className="ai-orch-card-header">
        <Calendar size={16} style={{ color: '#FACC15' }} />
        <span>Reschedule Suggestions</span>
        <span className="ai-orch-badge">{result.suggestions.length} items</span>
      </div>
      <div className="ai-orch-list">
        {result.suggestions.slice(0, 5).map(s => (
          <div key={s.itemId} className="ai-orch-item">
            <span className="ai-orch-item-icon">{s.itemType === 'task' ? '✅' : '📅'}</span>
            <div className="ai-orch-item-body">
              <span className="ai-orch-item-title">{s.itemTitle}</span>
              <span className="ai-orch-item-detail">
                {s.originalDate} → {s.suggestedDate} · {s.reason}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScheduleOptimizerCard({ result }: { result: OptimizerResult }) {
  return (
    <div className="ai-orch-card">
      <div className="ai-orch-card-header">
        <Calendar size={16} style={{ color: '#A855F7' }} />
        <span>Schedule Analysis</span>
      </div>
      <div className="ai-orch-stats">
        <div className="ai-orch-stat">
          <span className="ai-orch-stat-value">{result.gaps.length}</span>
          <span className="ai-orch-stat-label">Free Slots</span>
        </div>
        <div className="ai-orch-stat">
          <span className="ai-orch-stat-value">{result.conflicts.length}</span>
          <span className="ai-orch-stat-label">Conflicts</span>
        </div>
        <div className="ai-orch-stat">
          <span className="ai-orch-stat-value">{result.suggestions.length}</span>
          <span className="ai-orch-stat-label">Suggestions</span>
        </div>
      </div>
      {result.suggestions.length > 0 && (
        <div className="ai-orch-list">
          {result.suggestions.slice(0, 4).map(s => (
            <div key={s.id} className="ai-orch-item ai-orch-item--compact">
              <span className="ai-orch-item-icon">{s.icon}</span>
              <div className="ai-orch-item-body">
                <span className="ai-orch-item-title">{s.title}</span>
                <span className="ai-orch-item-detail">{s.description}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Render the appropriate rich card based on orchestrator tool type */
export function OrchestratorCard({ result }: { result: OrchestratorToolResult }) {
  if (!result.success || !result.data) return null;

  switch (result.tool) {
    case 'check_balance':
      return <BalanceIndicator status={result.data as BalanceStatus} />;
    case 'analyze_goals':
      return <GoalCoachCard result={result.data as GoalCoachResult} />;
    case 'meal_suggestions':
      return <MealSuggestionsCard result={result.data as MealSuggestionsResult} />;
    case 'generate_workout':
      return <WorkoutCard workout={result.data as GeneratedWorkout} />;
    case 'weekly_insights':
      return <WeeklyInsightsCard data={result.data as WeeklyInsightsData} />;
    case 'morning_brief':
      return <MorningBriefCard brief={result.data as LLMMorningBrief} />;
    case 'reschedule_overdue':
      return <RescheduleCard result={result.data as RescheduleResult} />;
    case 'optimize_schedule':
      return <ScheduleOptimizerCard result={result.data as OptimizerResult} />;
    default:
      return null;
  }
}
