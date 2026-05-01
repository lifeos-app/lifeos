/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import {
  Dumbbell, Brain, Moon, Apple,
  Scale, Droplets, Zap, Activity, Flame,
  AlertTriangle, ChevronRight, Sun, Calendar,
} from 'lucide-react';
import { ProgressRing, SparkLine } from '../../components/charts';
import { InsightsBanner, SnapCard } from './components';
import { MOOD_COLORS, calculateHealthScore, type Meal, type WorkoutTemplate, type CSSVarStyle, type OverviewTabProps, type ExerciseLog, type MeditationLog, type GratitudeEntry, type BodyMarker, type HealthMetrics } from './types';
import { EmptyState } from '../../components/EmptyState';

// ── Emoji Mood Scale config ──
const MOOD_EMOJIS = ['😢', '😕', '😐', '🙂', '😄'];
const MOOD_EMOJI_COLORS = ['#EF4444', '#F43F5E', '#FACC15', '#6BCB77', '#39FF14'];
const ENERGY_EMOJIS = ['😴', '🥱', '😐', '💪', '⚡'];
const ENERGY_EMOJI_COLORS = ['#EF4444', '#F43F5E', '#FACC15', '#39FF14', '#00D4FF'];

export function OverviewTab({ metrics, exerciseLogs, meditationLogs, gratitudeEntries, templates, markers, allMetrics, onUpdateMetrics, meals, onTabChange, onSyncToSchedule, scheduleEvents }: OverviewTabProps) {
  const today = new Date().toISOString().split('T')[0];
  const todayWorkouts = exerciseLogs.filter((l: ExerciseLog) => l.date === today && l.completed);
  const todayMeditation = meditationLogs.filter((l: MeditationLog) => l.date === today);
  const todayGratitude = gratitudeEntries.filter((e: GratitudeEntry) => e.date === today);
  const todayMeals = (meals || []).filter((m: Meal) => m.date === today);
  const activeMarkers = markers.filter((m: BodyMarker) => !m.resolved);
  const meditationMins = todayMeditation.reduce((s: number, m: MeditationLog) => s + (m.duration_min || 0), 0);
  const todayCalories = todayMeals.reduce((s: number, m: Meal) => s + (m.calories || 0), 0);

  const latestWeightEntry = allMetrics.find((m: HealthMetrics) => m.weight_kg);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekWorkoutDays = new Set(
    exerciseLogs.filter((l: ExerciseLog) => l.completed && l.date >= weekStartStr).map((l: ExerciseLog) => l.date)
  ).size;
  const currentDayOfWeek = new Date().getDay();
  const todayPlanned = templates.filter((t: WorkoutTemplate) => t.day_of_week.includes(currentDayOfWeek));

  // Detect templates scheduled for today that have no matching schedule events
  const unsyncedTemplates = todayPlanned.filter((t: WorkoutTemplate) => {
    if (!t.id) return false;
    const hasScheduleEvent = (scheduleEvents || []).some(
      (e: { workout_template_id?: string; event_type?: string; is_deleted?: boolean }) =>
        e.workout_template_id === t.id && !e.is_deleted
    );
    return !hasScheduleEvent;
  });

  const healthScore = calculateHealthScore(metrics, todayWorkouts.length, meditationMins, todayGratitude.length);

  const last7 = Array.from({ length: 7 }, (_, i: number) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
  const moodSpark = last7.map((date: string) => allMetrics.find((m: HealthMetrics) => m.date === date)?.mood_score || 0);
  const energySpark = last7.map((date: string) => allMetrics.find((m: HealthMetrics) => m.date === date)?.energy_score || 0);

  const lowSleep = (metrics?.sleep_hours || 0) > 0 && (metrics?.sleep_hours || 0) < 7;
  const noWorkout = todayPlanned.length > 0 && todayWorkouts.length === 0;
  const weightTrend = useMemo(() => {
    const withWeight = allMetrics.filter((m: HealthMetrics) => m.weight_kg).slice(0, 14);
    if (withWeight.length < 2) return null;
    const first = withWeight[withWeight.length - 1].weight_kg;
    const last = withWeight[0].weight_kg;
    return last && first ? last - first : null;
  }, [allMetrics]);

  const handleQuickMood = (score: number) => onUpdateMetrics({ mood_score: score });
  const handleQuickEnergy = (score: number) => onUpdateMetrics({ energy_score: score });

  const insights: { text: string; type: 'positive' | 'warning' | 'insight' }[] = [];
  if (lowSleep) insights.push({ text: 'You slept less than 7 hours. Prioritize recovery.', type: 'warning' });
  if (noWorkout && todayPlanned.length > 0) insights.push({ text: `You have ${todayPlanned.length} workout${todayPlanned.length > 1 ? 's' : ''} scheduled today.`, type: 'insight' });
  if (activeMarkers.length > 0) insights.push({ text: `${activeMarkers.length} body issue${activeMarkers.length > 1 ? 's' : ''} may affect training.`, type: 'warning' });
  if ((metrics?.water_intake || 0) < 2000) insights.push({ text: 'Hydration looks low—aim for 2L+ today.', type: 'positive' });

  // Snapshot metric helpers
  const waterGlasses = metrics?.water_glasses || 0;
  const waterTarget = 8;
  const sleepHours = metrics?.sleep_hours || 0;
  const sleepTarget = 8;
  const meditationTarget = 15;

  const hasAnyData = allMetrics.length > 0 || exerciseLogs.length > 0 || meditationLogs.length > 0 || gratitudeEntries.length > 0;

  return (
    <div className="overview-tab h-fade-up">
      {!hasAnyData && (
        <EmptyState
          variant="health"
          action={{ label: 'Log First Entry', onClick: () => onUpdateMetrics({ mood_score: 3 }) }}
        />
      )}
      {insights.length > 0 && <InsightsBanner insights={insights} />}

      {unsyncedTemplates.length > 0 && onSyncToSchedule && (
        <div className="hv2-sync-banner glass-card">
          <div className="hv2-sync-banner-content">
            <Calendar size={16} className="text-amber-400" />
            <div className="hv2-sync-banner-text">
              <span className="hv2-sync-banner-title">Workout not synced</span>
              <span className="hv2-sync-banner-desc">
                {unsyncedTemplates.map(t => t.name).join(', ')} {unsyncedTemplates.length === 1 ? 'is' : 'are'} scheduled for today but not in your calendar.
              </span>
            </div>
          </div>
          <div className="hv2-sync-banner-actions">
            {unsyncedTemplates.map(t => (
              <button key={t.id} className="btn-glow-sm" onClick={() => onSyncToSchedule(t)}>
                Sync {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="hv2-score-hero glass-card">
        <div className="hv2-score-left">
          <ProgressRing
            value={healthScore} size={110} strokeWidth={10}
            color={healthScore >= 80 ? '#39FF14' : healthScore >= 60 ? '#FACC15' : '#F97316'}
            centerContent={
              <div className="hv2-ring-center">
                <span className="text-[22px] font-bold font-[var(--font-display)] text-white">{healthScore}</span>
                <span className="text-[9px] text-white/40 uppercase">Score</span>
              </div>
            }
          />
        </div>
        <div className="hv2-score-right">
          <h2>Health Score</h2>
          <p>Based on sleep, activity, mood & nutrition.</p>
          <div className="hv2-score-pills">
            <span className="hv2-score-pill" style={{ background: todayWorkouts.length ? 'rgba(57,255,20,0.2)' : 'rgba(255,255,255,0.1)' }}>
              <Dumbbell size={10} /> {todayWorkouts.length} workout{todayWorkouts.length !== 1 ? 's' : ''}
            </span>
            <span className="hv2-score-pill" style={{ background: meditationMins ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.1)' }}>
              <Brain size={10} /> {meditationMins}m mindful
            </span>
            <span className="hv2-score-pill" style={{ background: todayGratitude.length ? 'rgba(233,196,106,0.2)' : 'rgba(255,255,255,0.1)' }}>
              <Sun size={10} /> {todayGratitude.length} gratitude
            </span>
          </div>
        </div>
      </div>

      {/* ── Emoji Mood & Energy Quick-Log ── */}
      <div className="hv2-quick-log-row">
        <div className="hv2-quick-log-col">
          <div className="hv2-section-label">QUICK MOOD</div>
          <div className="hv2-emoji-quick glass-card">
            <div className="hv2-emoji-scale">
              {MOOD_EMOJIS.map((emoji, i) => (
                <button
                  key={i}
                  className={`hv2-emoji-btn ${metrics?.mood_score === i + 1 ? 'active' : ''}`}
                  onClick={() => handleQuickMood(i + 1)}
                  style={{ '--emoji-color': MOOD_EMOJI_COLORS[i] } as CSSVarStyle}
                  aria-label={`Mood ${i + 1}`}
                >
                  <span className="hv2-emoji-icon">{emoji}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="hv2-quick-log-col">
          <div className="hv2-section-label">ENERGY LEVEL</div>
          <div className="hv2-emoji-quick glass-card">
            <div className="hv2-emoji-scale">
              {ENERGY_EMOJIS.map((emoji, i) => (
                <button
                  key={i}
                  className={`hv2-emoji-btn ${metrics?.energy_score === i + 1 ? 'active' : ''}`}
                  onClick={() => handleQuickEnergy(i + 1)}
                  style={{ '--emoji-color': ENERGY_EMOJI_COLORS[i] } as CSSVarStyle}
                  aria-label={`Energy ${i + 1}`}
                >
                  <span className="hv2-emoji-icon">{emoji}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Enhanced Today's Snapshot ── */}
      <div className="hv2-section-label">TODAY'S SNAPSHOT</div>
      <div className="hv2-snap-grid hv2-snap-grid-enhanced">
        <SnapCard className="hv2-snap-card hv2-snap-enhanced" onClick={() => onTabChange('sleep')}>
          <div className="hv2-snap-icon-row">
            <span className="hv2-snap-emoji"><Moon size={16} /></span>
            <Moon size={14} color="#818CF8" />
          </div>
          <span className="hv2-snap-value">{sleepHours ? `${sleepHours}h` : '—'}</span>
          <span className="hv2-snap-label">Sleep</span>
          {sleepHours > 0 && (
            <div className="hv2-snap-progress">
              <div className="hv2-snap-progress-bar" style={{
                width: `${Math.min((sleepHours / sleepTarget) * 100, 100)}%`,
                background: sleepHours >= sleepTarget ? '#818CF8' : sleepHours >= 7 ? '#FACC15' : '#F43F5E'
              }} />
            </div>
          )}
          <span className="hv2-snap-sub">{sleepHours > 0 ? `${sleepHours}/${sleepTarget}h target` : 'Log sleep'}</span>
        </SnapCard>

        <SnapCard className="hv2-snap-card hv2-snap-enhanced" onClick={() => onTabChange('body')}>
          <div className="hv2-snap-icon-row">
            <span className="hv2-snap-emoji"><Scale size={16} /></span>
            <Scale size={14} color="#00D4FF" />
          </div>
          <span className="hv2-snap-value">{latestWeightEntry?.weight_kg ? `${latestWeightEntry.weight_kg}kg` : '—'}</span>
          <span className="hv2-snap-label">Weight</span>
          {weightTrend !== null && (
            <span className="hv2-snap-sub">{weightTrend > 0 ? '+' : ''}{weightTrend?.toFixed(1)}kg 14d</span>
          )}
        </SnapCard>

        <SnapCard className="hv2-snap-card hv2-snap-enhanced" onClick={() => onTabChange('exercise')}>
          <div className="hv2-snap-icon-row">
            <span className="hv2-snap-emoji"><Dumbbell size={16} /></span>
            <Dumbbell size={14} color="#39FF14" />
          </div>
          <span className="hv2-snap-value">{todayWorkouts.length}/{todayPlanned.length}</span>
          <span className="hv2-snap-label">Exercise</span>
          {todayPlanned.length > 0 && (
            <div className="hv2-snap-progress">
              <div className="hv2-snap-progress-bar" style={{
                width: `${Math.min((todayWorkouts.length / todayPlanned.length) * 100, 100)}%`,
                background: todayWorkouts.length >= todayPlanned.length ? '#39FF14' : '#FACC15'
              }} />
            </div>
          )}
          <span className="hv2-snap-sub">{todayWorkouts.length >= todayPlanned.length && todayPlanned.length > 0 ? 'Complete' : todayPlanned.length > 0 ? `${todayPlanned.length - todayWorkouts.length} remaining` : 'Rest day'}</span>
        </SnapCard>

        <SnapCard className="hv2-snap-card hv2-snap-enhanced" onClick={() => onTabChange('mind')}>
          <div className="hv2-snap-icon-row">
            <span className="hv2-snap-emoji"><Brain size={16} /></span>
            <Brain size={14} color="#A855F7" />
          </div>
          <span className="hv2-snap-value">{meditationMins}m</span>
          <span className="hv2-snap-label">Meditation</span>
          {meditationTarget > 0 && (
            <div className="hv2-snap-progress">
              <div className="hv2-snap-progress-bar" style={{
                width: `${Math.min((meditationMins / meditationTarget) * 100, 100)}%`,
                background: meditationMins >= meditationTarget ? '#A855F7' : 'rgba(168,85,247,0.5)'
              }} />
            </div>
          )}
          <span className="hv2-snap-sub">{meditationMins >= meditationTarget ? 'Goal met ✓' : `${meditationTarget - meditationMins}m to goal`}</span>
        </SnapCard>

        <SnapCard className="hv2-snap-card hv2-snap-enhanced" onClick={() => onTabChange('diet')}>
          <div className="hv2-snap-icon-row">
            <span className="hv2-snap-emoji"><Apple size={16} /></span>
            <Apple size={14} color="#FACC15" />
          </div>
          <span className="hv2-snap-value">{todayCalories > 0 ? todayCalories : '—'}</span>
          <span className="hv2-snap-label">Nutrition</span>
          <span className="hv2-snap-sub">{todayCalories > 0 ? 'kcal today' : 'Log a meal'}</span>
        </SnapCard>

        <SnapCard className="hv2-snap-card hv2-snap-enhanced" onClick={() => onTabChange('body')}>
          <div className="hv2-snap-icon-row">
            <span className="hv2-snap-emoji"><Droplets size={16} /></span>
            <Droplets size={14} color="#38BDF8" />
          </div>
          <span className="hv2-snap-value">{waterGlasses > 0 ? waterGlasses : '—'}</span>
          <span className="hv2-snap-label">Water</span>
          {waterGlasses > 0 && (
            <div className="hv2-snap-progress">
              <div className="hv2-snap-progress-bar" style={{
                width: `${Math.min((waterGlasses / waterTarget) * 100, 100)}%`,
                background: waterGlasses >= waterTarget ? '#38BDF8' : 'rgba(56,189,248,0.5)'
              }} />
            </div>
          )}
          <span className="hv2-snap-sub">{waterGlasses > 0 ? `${waterGlasses}/${waterTarget} glasses` : 'Stay hydrated'}</span>
        </SnapCard>
      </div>

      {activeMarkers.length > 0 && (
        <>
          <div className="hv2-section-label">BODY CHECK</div>
          <div className="glass-card hv2-bodycheck-card">
            <div className="hv2-card-header"><AlertTriangle size={14} className="text-rose-500" />
              <span>{activeMarkers.length} active issue{activeMarkers.length > 1 ? 's' : ''}</span>
            </div>
            {activeMarkers.slice(0, 3).map((m: BodyMarker) => (
              <div key={m.id} className="hv2-bodycheck-item" onClick={() => onTabChange('body')}>
                <span className="severity-pip s{m.severity}" />
                <span>{m.body_part.replace(/_/g, ' ')}</span>
                <ChevronRight size={14} className="opacity-40" />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="hv2-section-label">WEEKLY TRENDS</div>
      <div className="glass-card hv2-trends-card">
        <div className="hv2-trend-row">
          <div className="hv2-trend-label"><Zap size={12} /> Mood</div>
          <div className="hv2-trend-bar">
            {moodSpark.some((v: number) => v > 0) ? <SparkLine data={moodSpark} color="#F43F5E" width="100%" height={24} filled /> : <span className="hv2-empty-trend">No data</span>}
          </div>
        </div>
        <div className="hv2-trend-row">
          <div className="hv2-trend-label"><Flame size={12} /> Energy</div>
          <div className="hv2-trend-bar">
            {energySpark.some((v: number) => v > 0) ? <SparkLine data={energySpark} color="#FACC15" width="100%" height={24} filled /> : <span className="hv2-empty-trend">No data</span>}
          </div>
        </div>
        <div className="hv2-trend-row">
          <div className="hv2-trend-label"><Activity size={12} /> Workout days</div>
          <div className="hv2-trend-val">{weekWorkoutDays}/7</div>
        </div>
      </div>
    </div>
  );
}
