/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, lazy, Suspense } from 'react';
import {
  Dumbbell, Plus, Check, X, Clock, Trash2,
  Play, Activity, Flame, Wind, Sparkles,
  AlertTriangle, Trophy, Search, Edit3, RefreshCw,
  ChevronRight, ChevronDown, Calendar,
} from 'lucide-react';
import { EmojiIcon } from '../../lib/emoji-icon';
import { DonutChart } from '../../components/charts';
import { DatePicker } from './components';
import { supabase } from '../../lib/supabase';
import { createScheduleEvent } from '../../lib/schedule-events';

const WorkoutGenerator = lazy(() => import('../../components/WorkoutGenerator').then(m => ({ default: m.WorkoutGenerator })));
import type { GeneratedWorkout } from '../../lib/llm/workout-ai';
import { COMMON_EXERCISES, type WorkoutTemplate, type TemplateExercise, type ExerciseLogSet, type CSSVarStyle } from './types';
import { logger } from '../../utils/logger';

/* ── Time Preset Picker ── */
interface TimePreset { label: string; icon: string; time: string }
const TIME_PRESETS: TimePreset[] = [
  { label: 'Morning', icon: '🌅', time: '06:00' },
  { label: 'Midday', icon: '☀️', time: '12:00' },
  { label: 'Afternoon', icon: '🌤️', time: '15:00' },
  { label: 'Evening', icon: '🌙', time: '18:00' },
];

interface SchedulePromptData {
  workoutName: string;
  durationMin: number;
  exercises: { name: string; muscle_group: string }[];
  /** Which days to schedule (0=Sun..6=Sat). Empty = just today */
  days: number[];
  mode: 'start' | 'save';
}

export function ExerciseTab({ templates, logs, onSaveTemplate, onDeleteTemplate, onSyncToSchedule, onLogWorkout, onUpdateLog: _onUpdateLog, onDeleteLog, markers }: any) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [showLogWorkout, setShowLogWorkout] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [logSets, setLogSets] = useState<Partial<ExerciseLogSet>[]>([]);
  const [logNotes, setLogNotes] = useState('');
  const [logDuration, setLogDuration] = useState(30);
  const [logTemplateId, setLogTemplateId] = useState<string | undefined>();
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  /* ── Scheduler prompt state ── */
  const [schedulePrompt, setSchedulePrompt] = useState<SchedulePromptData | null>(null);
  const [scheduleTime, setScheduleTime] = useState('06:00');
  const [schedulingInProgress, setSchedulingInProgress] = useState(false);

  const [newTemplate, setNewTemplate] = useState<Partial<WorkoutTemplate> & { exercises: Partial<TemplateExercise>[] }>({
    name: '', color: '#39FF14', icon: '💪', estimated_duration_min: 60,
    day_of_week: [], preferred_time: '06:00', is_active: true, exercises: [],
  });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const selectedDayOfWeek = new Date(selectedDate + 'T12:00:00').getDay();
  const today = new Date().toISOString().split('T')[0];
  const selectedDateTemplates = templates.filter((t: any) => t.day_of_week.includes(selectedDayOfWeek));
  const selectedDateLogs = logs.filter((l: any) => l.date === selectedDate);
  const workoutWarnings = markers.filter((m: any) => m.affects_workout && !m.resolved);

  const streak = useMemo(() => {
    let count = 0;
    const d = new Date();
    for (let i = 0; i < 30; i++) {
      const dateStr = d.toISOString().split('T')[0];
      const hasLog = logs.some((l: any) => l.date === dateStr && l.completed);
      if (hasLog) count++;
      else if (i > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [logs]);

  const heatmapWeeks = useMemo(() => {
    const weeks: { date: string; intensity: number }[][] = [];
    for (let w = 3; w >= 0; w--) {
      const week: { date: string; intensity: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date();
        date.setDate(date.getDate() - (w * 7) - (6 - d));
        const dateStr = date.toISOString().split('T')[0];
        const dayLogs = logs.filter((l: any) => l.date === dateStr && l.completed);
        const totalDuration = dayLogs.reduce((s: any, l: any) => s + (l.duration_min || 0), 0);
        week.push({ date: dateStr, intensity: totalDuration > 0 ? Math.min(totalDuration / 60, 1) : 0 });
      }
      weeks.push(week);
    }
    return weeks;
  }, [logs]);

  const muscleGroups = useMemo(() => {
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekLogs = logs.filter((l: any) => l.date >= weekStartStr && l.completed);
    const groups: Record<string, number> = {};
    weekLogs.forEach((log: any) => {
      (log.sets || []).forEach((s: any) => {
        const g = s.muscle_group || 'other';
        groups[g] = (groups[g] || 0) + (s.completed ? 1 : 0);
      });
    });
    const MUSCLE_COLORS: Record<string, string> = {
      chest: '#F97316', back: '#00D4FF', legs: '#39FF14', arms: '#FACC15',
      shoulders: '#A855F7', core: '#F43F5E', cardio: '#38BDF8', full_body: '#818CF8', other: '#64748B',
    };
    return Object.entries(groups)
      .filter(([, v]) => v > 0)
      .map(([label, value]) => ({ label, value, color: MUSCLE_COLORS[label] || '#64748B' }));
  }, [logs]);

  const filteredCommonExercises = exerciseSearch
    ? COMMON_EXERCISES.filter((e: any) => e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) || e.muscle_group.includes(exerciseSearch.toLowerCase()))
    : COMMON_EXERCISES;

  const addSetToLog = (exerciseName: string, muscleGroup?: string) => {
    const existingSets = logSets.filter(s => s.exercise_name === exerciseName);
    setLogSets(prev => [...prev, {
      exercise_name: exerciseName, muscle_group: muscleGroup,
      set_number: existingSets.length + 1, reps: 10,
      weight_kg: existingSets.length > 0 ? existingSets[existingSets.length - 1].weight_kg : undefined,
      completed: true,
    }]);
  };

  const updateSet = (index: number, updates: Partial<ExerciseLogSet>) => {
    setLogSets(prev => prev.map((s: any, i: any) => i === index ? { ...s, ...updates } : s));
  };

  const removeSet = (index: number) => {
    setLogSets(prev => prev.filter((_, i) => i !== index));
  };

  const handleLogWorkout = async () => {
    await onLogWorkout({
      template_id: logTemplateId || null,
      date: selectedDate, completed: true,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_min: logDuration,
      notes: logNotes || null,
    }, logSets.length > 0 ? logSets : undefined);
    setShowLogWorkout(false);
    setLogSets([]); setLogNotes(''); setLogDuration(30); setLogTemplateId(undefined);
  };

  /* ── Schedule creation helper ── */
  const handleScheduleWorkout = async () => {
    if (!schedulePrompt) return;
    setSchedulingInProgress(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('Not logged in');

      const daysToSchedule = schedulePrompt.days.length > 0 ? schedulePrompt.days : [new Date().getDay()];

      for (const dayIdx of daysToSchedule) {
        // Find the next occurrence of this day of week
        const eventDate = new Date();
        const currentDay = eventDate.getDay();
        let daysUntil = dayIdx - currentDay;
        if (daysUntil < 0) daysUntil += 7;
        if (daysUntil === 0 && schedulePrompt.days.length > 0) {
          // If it's today and we have specific days, keep it for today
        }
        eventDate.setDate(eventDate.getDate() + daysUntil);

        const [hours, minutes] = scheduleTime.split(':').map(Number);
        eventDate.setHours(hours, minutes, 0, 0);

        const notes = `AI-generated: ${schedulePrompt.exercises.map(e => e.name).join(', ')}`;

        await createScheduleEvent(supabase, {
          userId,
          title: `💪 ${schedulePrompt.workoutName}`,
          startTime: eventDate.toISOString(),
          endTime: new Date(eventDate.getTime() + schedulePrompt.durationMin * 60 * 1000).toISOString(),
          eventType: 'exercise',
          scheduleLayer: 'primary',
          source: 'webapp',
          description: notes,
        });
      }

      // Dispatch refresh event so Schedule page updates
      window.dispatchEvent(new CustomEvent('lifeos-refresh'));

      // Show toast-like feedback
      const dayLabels = daysToSchedule.map(d => dayNames[d]).join(', ');
      const msg = daysToSchedule.length > 1
        ? `Workout scheduled for ${dayLabels} at ${scheduleTime}`
        : `Workout scheduled for ${scheduleTime}`;
      alert(msg); // Simple alert; could be a toast later
    } catch (err: any) {
      logger.error('[ExerciseTab] Schedule error:', err);
      alert('Failed to schedule workout: ' + (err.message || 'Unknown error'));
    } finally {
      setSchedulingInProgress(false);
      setSchedulePrompt(null);
    }
  };

  const handleStartAIWorkout = (workout: GeneratedWorkout) => {
    // Show schedule prompt before starting
    setSchedulePrompt({
      workoutName: workout.name,
      durationMin: workout.estimated_duration_min,
      exercises: workout.exercises.map(e => ({ name: e.name, muscle_group: e.muscle_group })),
      days: [],
      mode: 'start',
    });

    // Also prep the log workout form in background
    setLogTemplateId(undefined);
    setLogDuration(workout.estimated_duration_min);
    setLogNotes(workout.name);
    const sets: Partial<ExerciseLogSet>[] = [];
    (workout.exercises || []).forEach((ex) => {
      for (let s = 1; s <= ex.sets; s++) {
        sets.push({
          exercise_name: ex.name,
          muscle_group: ex.muscle_group,
          set_number: s,
          reps: ex.reps,
          weight_kg: ex.weight_kg || undefined,
          duration_seconds: ex.duration_min ? ex.duration_min * 60 : undefined,
          completed: false,
        });
      }
    });
    setLogSets(sets);
  };

  /** After scheduling (or skipping), open the log workout form */
  const proceedAfterSchedule = () => {
    if (schedulePrompt?.mode === 'start') {
      setShowLogWorkout(true);
      setShowGenerator(false);
    }
    setSchedulePrompt(null);
  };

  const handleSaveAITemplates = async (tmplList: any[], workout?: GeneratedWorkout) => {
    for (const tmpl of tmplList) await onSaveTemplate(tmpl);
    // Show schedule prompt for saved template
    if (workout) {
      setSchedulePrompt({
        workoutName: workout.name,
        durationMin: workout.estimated_duration_min,
        exercises: workout.exercises.map(e => ({ name: e.name, muscle_group: e.muscle_group })),
        days: [],
        mode: 'save',
      });
    }
  };

  const startFromTemplate = (template: WorkoutTemplate) => {
    setShowLogWorkout(true);
    setLogTemplateId(template.id);
    setLogDuration(template.estimated_duration_min);
    const sets: Partial<ExerciseLogSet>[] = [];
    (template.exercises || []).forEach((ex: TemplateExercise) => {
      for (let s = 1; s <= ex.sets; s++) {
        sets.push({
          exercise_name: ex.name, muscle_group: ex.muscle_group,
          set_number: s, reps: ex.reps, weight_kg: ex.weight_kg,
          duration_seconds: ex.duration_min ? ex.duration_min * 60 : undefined, completed: false,
        });
      }
    });
    setLogSets(sets);
  };

  const resetTemplateForm = () => {
    setNewTemplate({ name: '', color: '#39FF14', icon: '💪', estimated_duration_min: 60, day_of_week: [], preferred_time: '06:00', is_active: true, exercises: [] });
    setEditingTemplate(null);
    setShowNewTemplate(false);
  };

  const startEditTemplate = (t: WorkoutTemplate) => {
    setEditingTemplate(t);
    setNewTemplate({ ...t, exercises: (t.exercises || []).map(e => ({ ...e })) });
    setShowNewTemplate(true);
  };

  const addExerciseToTemplate = (exercise?: (typeof COMMON_EXERCISES)[number]) => {
    const ex = exercise || { name: '', muscle_group: '', sets: 3, reps: 10, rest_seconds: 60 };
    setNewTemplate(p => ({ ...p, exercises: [...p.exercises, { ...ex, sort_order: p.exercises.length }] }));
  };

  const removeExerciseFromTemplate = (index: number) => {
    setNewTemplate(p => ({ ...p, exercises: p.exercises.filter((_, i) => i !== index) }));
  };

  const updateTemplateExercise = (index: number, updates: Partial<TemplateExercise>) => {
    setNewTemplate(p => ({ ...p, exercises: p.exercises.map((e, i) => i === index ? { ...e, ...updates } : e) }));
  };

  const handleSaveTemplate = async () => {
    if (!newTemplate.name) return;
    if (editingTemplate) { await onSaveTemplate({ ...newTemplate, id: editingTemplate.id }); }
    else { await onSaveTemplate(newTemplate); }
    resetTemplateForm();
  };

  const groupedSets = useMemo(() => {
    const groups: Record<string, (Partial<ExerciseLogSet> & { _idx: number })[]> = {};
    logSets.forEach((s, idx) => {
      const key = s.exercise_name || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push({ ...s, _idx: idx });
    });
    return groups;
  }, [logSets]);

  /** Format time for display in history */
  const formatTime = (iso: string | null | undefined) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch { return null; }
  };

  return (
    <div className="exercise-tab h-fade-up">
      {/* Streak + Warnings */}
      {(streak > 0 || workoutWarnings.length > 0) && (
        <div className="hv2-exercise-top">
          {streak > 0 && (
            <div className="hv2-streak-card glass-card">
              <Flame size={22} className="streak-flame" />
              <div className="streak-info">
                <span className="streak-count">{streak}</span>
                <span className="streak-label">day streak</span>
              </div>
            </div>
          )}
          {workoutWarnings.length > 0 && (
            <div className="hv2-warning-card glass-card">
              <AlertTriangle size={14} />
              <span>Issues affecting workouts: {workoutWarnings.map((m: any) => m.body_part.replace(/_/g, ' ')).join(', ')}</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ AI Workout Generator — Top-Level Collapsible Card ═══ */}
      <div className="hv2-section-label">AI WORKOUT</div>
      <div className="hv2-ai-generator-card glass-card">
        <button
          className="hv2-ai-gen-toggle"
          onClick={() => setShowGenerator(!showGenerator)}
        >
          <div className="hv2-ai-gen-toggle-left">
            <span className="hv2-ai-gen-icon"><Sparkles size={16} /></span>
            <div className="hv2-ai-gen-toggle-text">
              <span className="hv2-ai-gen-title">Generate AI Workout</span>
              <span className="hv2-ai-gen-sub">Quick presets or fully customised workouts</span>
            </div>
          </div>
          <ChevronDown size={16} className={`hv2-ai-gen-chevron ${showGenerator ? 'open' : ''}`} />
        </button>
        {showGenerator && (
          <div className="hv2-ai-gen-body h-fade-up">
            <Suspense fallback={<div style={{ padding: 24, textAlign: 'center', color: '#8BA4BE' }}>Loading workout generator…</div>}>
              <WorkoutGenerator
                onSaveTemplates={handleSaveAITemplates}
                onStartWorkout={handleStartAIWorkout}
                onClose={() => setShowGenerator(false)}
              />
            </Suspense>
          </div>
        )}
      </div>

      {/* ═══ Schedule Time Picker Prompt ═══ */}
      {schedulePrompt && (
        <div className="hv2-schedule-prompt-overlay">
          <div className="hv2-schedule-prompt glass-card h-fade-up">
            <div className="hv2-sp-header">
              <Calendar size={16} className="text-green-400" />
              <h4>Schedule Workout</h4>
              <button className="btn-icon-xs" onClick={() => { proceedAfterSchedule(); }} aria-label="Skip scheduling"><X size={14} /></button>
            </div>
            <p className="hv2-sp-name">💪 {schedulePrompt.workoutName} — {schedulePrompt.durationMin}min</p>

            {/* Time Presets */}
            <div className="hv2-sp-presets">
              {TIME_PRESETS.map(tp => (
                <button
                  key={tp.time}
                  className={`hv2-sp-preset ${scheduleTime === tp.time ? 'active' : ''}`}
                  onClick={() => setScheduleTime(tp.time)}
                >
                  <span>{tp.icon}</span>
                  <span>{tp.label}</span>
                  <span className="hv2-sp-preset-time">{tp.time}</span>
                </button>
              ))}
            </div>

            {/* Custom time */}
            <div className="hv2-sp-custom">
              <label>Custom time</label>
              <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
            </div>

            {/* Day selector (for recurring) */}
            {schedulePrompt.mode === 'save' && (
              <div className="hv2-sp-days">
                <label>Schedule on days</label>
                <div className="day-pill-row">
                  {dayNames.map((day, i) => (
                    <button key={day} className={`day-pill ${schedulePrompt.days.includes(i) ? 'active' : ''}`}
                      onClick={() => setSchedulePrompt(prev => {
                        if (!prev) return prev;
                        const has = prev.days.includes(i);
                        return { ...prev, days: has ? prev.days.filter(d => d !== i) : [...prev.days, i] };
                      })}>{day}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="hv2-sp-actions">
              <button className="btn-glow" onClick={handleScheduleWorkout} disabled={schedulingInProgress}>
                {schedulingInProgress ? <Clock size={13} className="spin" /> : <Calendar size={13} />}
                {schedulingInProgress ? 'Scheduling...' : 'Schedule'}
              </button>
              <button className="btn-ghost" onClick={() => proceedAfterSchedule()}>
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Log */}
      <div className="hv2-section-label">QUICK LOG</div>
      <div className="hv2-quick-workout-grid glass-card">
        {[
          { name: 'Run', icon: <Activity size={18} />, duration: 30, color: '#F97316' },
          { name: 'Walk', icon: <Wind size={18} />, duration: 30, color: '#39FF14' },
          { name: 'Gym', icon: <Dumbbell size={18} />, duration: 60, color: '#00D4FF' },
          { name: 'Clean', icon: <Flame size={18} />, duration: 120, color: '#FACC15' },
        ].map(workout => (
          <button key={workout.name} className="hv2-quick-workout-btn"
            style={{ '--workout-color': workout.color } as CSSVarStyle}
            onClick={() => onLogWorkout({
              date: selectedDate, completed: true,
              started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
              duration_min: workout.duration, notes: workout.name,
            })}>
            <span className="hv2-qw-icon">{workout.icon}</span>
            <span className="hv2-qw-name">{workout.name}</span>
            <span className="hv2-qw-duration">{workout.duration}min</span>
          </button>
        ))}
      </div>

      {/* Weekly Heatmap */}
      <div className="hv2-section-label">WEEKLY ACTIVITY</div>
      <div className="glass-card hv2-heatmap-card">
        <div className="hv2-card-header"><Activity size={14} className="text-green-400" /><span>Last 4 weeks — intensity per day</span></div>
        <div className="hv2-heatmap-grid">
          {dayNames.map(d => <span key={d} className="hv2-heatmap-day">{d}</span>)}
          {heatmapWeeks.flat().map(({ date, intensity }, i) => (
            <div key={i} className="hv2-heatmap-cell" title={date}
              style={{
                background: intensity > 0 ? `rgba(57,255,20,${0.1 + intensity * 0.85})` : 'rgba(255,255,255,0.03)',
                border: date === today ? '1px solid rgba(57,255,20,0.6)' : '1px solid rgba(255,255,255,0.05)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Muscle Group Donut */}
      {muscleGroups.length > 0 && (
        <>
          <div className="hv2-section-label">MUSCLE GROUPS THIS WEEK</div>
          <div className="glass-card hv2-muscle-donut-card">
            <div className="hv2-muscle-donut-inner">
              <DonutChart segments={muscleGroups} size={140} strokeWidth={20} centerLabel="muscles" centerValue={`${muscleGroups.length}`} />
              <div className="hv2-muscle-legend">
                {muscleGroups.map(g => (
                  <div key={g.label} className="hv2-muscle-legend-item">
                    <span className="hv2-legend-dot" style={{ background: g.color }} />
                    <span>{g.label}</span>
                    <span className="hv2-legend-val">{g.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Today's Workouts */}
      <div className="hv2-section-label">WORKOUTS</div>
      <div className="glass-card hv2-workouts-card">
        <div className="hv2-card-header">
          <DatePicker value={selectedDate} onChange={setSelectedDate} />
          <button className="btn-glow-sm" onClick={() => { setShowLogWorkout(true); setLogTemplateId(undefined); setLogSets([]); }}>
            <Plus size={13} /> Log
          </button>
        </div>

        {selectedDateTemplates.length > 0 && (
          <div className="hv2-template-workouts">
            {selectedDateTemplates.map((t: any) => {
              const dayLog = selectedDateLogs.find((l: any) => l.template_id === t.id);
              return (
                <div key={t.id} className={`hv2-workout-card ${dayLog?.completed ? 'completed' : dayLog?.skipped ? 'skipped' : ''}`}
                  style={{ '--workout-color': t.color } as CSSVarStyle}>
                  <div className="hv2-wc-header">
                    <span className="hv2-wc-icon">{t.icon}</span>
                    <div className="hv2-wc-info">
                      <span className="hv2-wc-name">{t.name}</span>
                      <span className="hv2-wc-meta"><Clock size={11} /> {t.estimated_duration_min}min · {t.exercises?.length || 0} exercises</span>
                    </div>
                    {dayLog?.completed && <span className="hv2-done-badge"><Trophy size={13} /></span>}
                    {dayLog?.skipped && <span className="hv2-skip-badge"><X size={13} /></span>}
                    {dayLog && (
                      <button aria-label="Delete workout log" className="btn-icon-xs danger" onClick={() => { if (confirm('Delete log?')) onDeleteLog(dayLog.id); }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  {/* Scheduled vs Actual time */}
                  {dayLog?.completed && (dayLog.scheduled_time || dayLog.started_at || dayLog.completed_at) && (
                    <div className="hv2-scheduled-actual">
                      {dayLog.scheduled_time && (
                        <span className="hv2-sa-badge scheduled">
                          <Calendar size={10} /> Scheduled: {formatTime(dayLog.scheduled_time)}
                        </span>
                      )}
                      {dayLog.completed_at && (
                        <span className="hv2-sa-badge completed">
                          <Check size={10} /> Completed: {formatTime(dayLog.completed_at)}
                        </span>
                      )}
                    </div>
                  )}
                  {dayLog?.sets && dayLog.sets.length > 0 && (
                    <div className="hv2-logged-sets">
                      {(Object.entries(dayLog.sets.reduce((acc: Record<string, any[]>, s: any) => {
                        if (!acc[s.exercise_name]) acc[s.exercise_name] = [];
                        acc[s.exercise_name].push(s);
                        return acc;
                      }, {} as Record<string, any[]>)) as [string, any][]).map(([name, sets]) => (
                        <div key={name} className="hv2-ler">
                          <span className="hv2-ler-name">{name}</span>
                          <div className="hv2-ler-sets">
                            {sets.map((s: ExerciseLogSet) => (
                              <span key={s.id} className={`hv2-ler-set ${s.completed ? 'done' : ''}`}>
                                {s.weight_kg ? `${s.weight_kg}kg×${s.reps}` : s.duration_seconds ? `${Math.round(s.duration_seconds / 60)}min` : `${s.reps} reps`}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!dayLog && (
                    <div className="hv2-wc-actions">
                      <button className="btn-glow-sm" onClick={() => startFromTemplate(t)}><Play size={13} /> Start</button>
                      <button className="btn-ghost-sm" onClick={() => onLogWorkout({
                        template_id: t.id, date: selectedDate, completed: true,
                        started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
                        duration_min: t.estimated_duration_min,
                      })}><Check size={13} /> Quick Done</button>
                      <button className="btn-ghost-sm" onClick={() => {
                        const reason = prompt('Why skip?');
                        if (reason) onLogWorkout({ template_id: t.id, date: selectedDate, skipped: true, skip_reason: reason, completed: false });
                      }}><X size={13} /> Skip</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {selectedDateLogs.filter((l: any) => !l.template_id).length > 0 && (
          <div className="hv2-free-workouts">
            <div className="hv2-section-label mt-3">CUSTOM WORKOUTS</div>
            {selectedDateLogs.filter((l: any) => !l.template_id).map((log: any) => (
              <div key={log.id} className={`hv2-workout-card ${log.completed ? 'completed' : ''}`} style={{ '--workout-color': '#00D4FF' } as CSSVarStyle}>
                <div className="hv2-wc-header">
                  <span className="hv2-wc-icon"><Dumbbell size={16} /></span>
                  <div className="hv2-wc-info">
                    <span className="hv2-wc-name">{log.notes || 'Custom Workout'}</span>
                    <span className="hv2-wc-meta"><Clock size={11} /> {log.duration_min}min</span>
                  </div>
                  {log.completed && <span className="hv2-done-badge"><Check size={13} /></span>}
                  <button aria-label="Delete workout log" className="btn-icon-xs danger" onClick={() => { if (confirm('Delete?')) onDeleteLog(log.id); }}><Trash2 size={12} /></button>
                </div>
                {/* Scheduled vs Actual for custom workouts too */}
                {log.completed && (log.scheduled_time || log.completed_at) && (
                  <div className="hv2-scheduled-actual">
                    {log.scheduled_time && (
                      <span className="hv2-sa-badge scheduled">
                        <Calendar size={10} /> Scheduled: {formatTime(log.scheduled_time)}
                      </span>
                    )}
                    {log.completed_at && (
                      <span className="hv2-sa-badge completed">
                        <Check size={10} /> Completed: {formatTime(log.completed_at)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {selectedDateTemplates.length === 0 && selectedDateLogs.length === 0 && (
          <div className="hv2-empty-day">
            <Dumbbell size={20} className="opacity-20" />
            <span>Rest day or no workouts scheduled</span>
          </div>
        )}
      </div>

      {/* Log Workout Modal */}
      {showLogWorkout && (
        <div className="hv2-log-modal glass-card h-fade-up">
          <div className="hv2-card-header">
            <h3><Dumbbell size={14} /> Log Workout</h3>
            <button className="btn-icon-xs" onClick={() => setShowLogWorkout(false)} aria-label="Close workout form"><X size={14} /></button>
          </div>
          <div className="hv2-log-meta-row">
            <div className="hv2-log-field">
              <label>Duration (min)</label>
              <input type="number" value={logDuration} onChange={e => setLogDuration(parseInt(e.target.value))} min={1} />
            </div>
            <div className="hv2-log-field">
              <label>Notes</label>
              <input type="text" value={logNotes} onChange={e => setLogNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>

          {Object.keys(groupedSets).length > 0 && (
            <div className="hv2-log-sets-section">
              {Object.entries(groupedSets).map(([name, sets]) => (
                <div key={name} className="hv2-log-exercise-group">
                  <div className="hv2-leg-header">{name}</div>
                  {sets.map((s: any) => (
                    <div key={s._idx} className="hv2-log-set-row">
                      <span className="hv2-lsr-num">Set {s.set_number}</span>
                      <input type="number" placeholder="kg" value={s.weight_kg || ''} step="0.5"
                        onChange={e => updateSet(s._idx, { weight_kg: parseFloat(e.target.value) || undefined })} className="hv2-lsr-input" />
                      <span>×</span>
                      <input type="number" placeholder="reps" value={s.reps || ''} min={1}
                        onChange={e => updateSet(s._idx, { reps: parseInt(e.target.value) })} className="hv2-lsr-input" />
                      <button className={`hv2-set-check ${s.completed ? 'done' : ''}`}
                        onClick={() => updateSet(s._idx, { completed: !s.completed })}>
                        <Check size={12} />
                      </button>
                      <button aria-label="Remove set" className="btn-icon-xs danger" onClick={() => removeSet(s._idx)}><X size={10} /></button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="hv2-log-add-section">
            <div className="hv2-log-search">
              <Search size={13} />
              <input type="text" placeholder="Search exercises..." value={exerciseSearch}
                onChange={e => setExerciseSearch(e.target.value)} />
            </div>
            <div className="hv2-exercise-pills">
              {filteredCommonExercises.slice(0, 12).map(ex => (
                <button key={ex.name} className="hv2-ex-pill" onClick={() => addSetToLog(ex.name, ex.muscle_group)}>
                  <Plus size={9} /> {ex.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mf-actions">
            <button className="btn-glow" onClick={handleLogWorkout}><Check size={14} /> Save Workout</button>
            <button className="btn-ghost" onClick={() => setShowLogWorkout(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Weekly Schedule */}
      <div className="hv2-section-label">WEEKLY SCHEDULE</div>
      <div className="glass-card hv2-schedule-card">
        <div className="hv2-week-grid">
          {dayNames.map((day, i) => {
            const dayTemplates = templates.filter((t: any) => t.day_of_week.includes(i));
            const isCurrent = i === new Date().getDay();
            return (
              <div key={day} className={`hv2-week-day ${isCurrent ? 'today' : ''}`}>
                <span className="hv2-wd-name">{day}</span>
                {dayTemplates.length > 0 ? dayTemplates.map((t: any) => (
                  <div key={t.id} className="hv2-wd-workout" style={{ background: t.color + '22', borderLeft: `2px solid ${t.color}60` }}>
                    {t.icon}
                  </div>
                )) : <span className="hv2-wd-rest">—</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Templates — AI toggle removed, generator is now top-level */}
      <div className="hv2-section-label">TEMPLATES</div>
      <div className="glass-card hv2-templates-card">
        <div className="hv2-card-header">
          <span>Workout Templates</span>
          <div className="hv2-header-actions">
            <button className="btn-ghost-sm" onClick={() => { resetTemplateForm(); setShowNewTemplate(true); }}><Plus size={13} /> New</button>
          </div>
        </div>
        <div className="hv2-templates-grid">
          {templates.map((t: any) => (
            <div key={t.id} className="hv2-tmpl-card" style={{ '--t-color': t.color } as CSSVarStyle}>
              <div className="hv2-tmpl-top">
                <span className="hv2-tmpl-icon">{t.icon}</span>
                <span className="hv2-tmpl-name">{t.name}</span>
              </div>
              {t.exercises && t.exercises.length > 0 && (
                <div className="hv2-tmpl-exs">
                  {t.exercises.slice(0, 3).map((e: TemplateExercise, i: number) => (
                    <span key={i} className="hv2-tmpl-ex">{e.name}</span>
                  ))}
                  {t.exercises.length > 3 && <span className="hv2-tmpl-more">+{t.exercises.length - 3}</span>}
                </div>
              )}
              <span className="hv2-tmpl-sched">{t.day_of_week.map((d: any) => dayNames[d]).join(', ')}</span>
              <span className="hv2-tmpl-dur">{t.estimated_duration_min}min @ {t.preferred_time}</span>
              <div className="hv2-tmpl-actions">
                <button className="btn-icon-sm" onClick={() => startEditTemplate(t)} aria-label="Edit template"><Edit3 size={11} /></button>
                <button className="btn-icon-sm" onClick={() => onSyncToSchedule(t)} aria-label="Sync to schedule"><RefreshCw size={11} /></button>
                <button aria-label="Delete template" className="btn-icon-sm danger" onClick={() => { if (confirm(`Delete "${t.name}"?`)) onDeleteTemplate(t.id); }}><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
          {templates.length === 0 && <div className="hv2-empty-templates">No templates yet. Create one or use AI Generate above.</div>}
        </div>

        {showNewTemplate && (
          <div className="new-template-form h-fade-up">
            <h4>{editingTemplate ? 'Edit Template' : 'New Workout Template'}</h4>
            <div className="ntf-basic-row">
              <input type="text" placeholder="Template name" value={newTemplate.name}
                onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))} />
              <div className="icon-picker">
                {['💪', '🏃', '🚴', '🧘', '🥊', '🏊', '⚡', '🔥'].map(icon => (
                  <button key={icon} className={`icon-opt ${newTemplate.icon === icon ? 'active' : ''}`}
                    onClick={() => setNewTemplate(p => ({ ...p, icon }))}><EmojiIcon emoji={icon} size={15} fallbackAsText /></button>
                ))}
              </div>
            </div>
            <div className="day-pill-row">
              {dayNames.map((day, i) => (
                <button key={day} className={`day-pill ${newTemplate.day_of_week?.includes(i) ? 'active' : ''}`}
                  onClick={() => setNewTemplate(p => ({
                    ...p, day_of_week: p.day_of_week?.includes(i) ? p.day_of_week.filter(d => d !== i) : [...(p.day_of_week || []), i],
                  }))}>{day}</button>
              ))}
            </div>
            <div className="form-row-2">
              <input type="time" value={newTemplate.preferred_time} onChange={e => setNewTemplate(p => ({ ...p, preferred_time: e.target.value }))} />
              <input type="number" placeholder="Duration (min)" value={newTemplate.estimated_duration_min}
                onChange={e => setNewTemplate(p => ({ ...p, estimated_duration_min: parseInt(e.target.value) }))} />
              <div className="color-picker-mini">
                {['#39FF14', '#00D4FF', '#F97316', '#A855F7', '#FACC15', '#818CF8'].map(c => (
                  <button key={c} className={`color-dot ${newTemplate.color === c ? 'active' : ''}`}
                    style={{ background: c }} onClick={() => setNewTemplate(p => ({ ...p, color: c }))} />
                ))}
              </div>
            </div>
            <div className="template-exercises-section">
              <div className="tes-header">
                <h5>Exercises</h5>
                <button className="btn-ghost-xs" onClick={() => addExerciseToTemplate()}><Plus size={10} /> Custom</button>
              </div>
              <div className="quick-exercise-pills compact">
                {COMMON_EXERCISES.slice(0, 10).map(ex => (
                  <button key={ex.name} className="exercise-pill-sm" onClick={() => addExerciseToTemplate(ex)}>
                    <Plus size={9} /> {ex.name}
                  </button>
                ))}
              </div>
              {newTemplate.exercises.map((ex, i) => (
                <div key={i} className="template-exercise-row">
                  <input type="text" placeholder="Exercise" value={ex.name || ''}
                    onChange={e => updateTemplateExercise(i, { name: e.target.value })} className="tex-name" />
                  <input type="text" placeholder="Muscle" value={ex.muscle_group || ''}
                    onChange={e => updateTemplateExercise(i, { muscle_group: e.target.value })} className="tex-muscle" />
                  <input type="number" placeholder="Sets" value={ex.sets || ''} min={1}
                    onChange={e => updateTemplateExercise(i, { sets: parseInt(e.target.value) })} className="tex-num" />
                  <input type="number" placeholder="Reps" value={ex.reps || ''} min={1}
                    onChange={e => updateTemplateExercise(i, { reps: parseInt(e.target.value) })} className="tex-num" />
                  <input type="number" placeholder="kg" value={ex.weight_kg || ''} step={0.5}
                    onChange={e => updateTemplateExercise(i, { weight_kg: parseFloat(e.target.value) || undefined })} className="tex-num" />
                  <input type="number" placeholder="Rest(s)" value={ex.rest_seconds || ''} min={0}
                    onChange={e => updateTemplateExercise(i, { rest_seconds: parseInt(e.target.value) })} className="tex-num" />
                  <button aria-label="Remove exercise" className="btn-icon-xs danger" onClick={() => removeExerciseFromTemplate(i)}><X size={10} /></button>
                </div>
              ))}
            </div>
            <div className="mf-actions">
              <button className="btn-glow" onClick={handleSaveTemplate}>{editingTemplate ? 'Update' : 'Create'}</button>
              <button className="btn-ghost" onClick={resetTemplateForm}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="hv2-section-label">RECENT HISTORY</div>
      <div className="glass-card hv2-history-card">
        {logs.slice(0, 10).map((log: any) => (
          <div key={log.id} className={`hv2-history-item ${log.completed ? '' : 'skipped'}`}>
            <div className="hv2-hi-date">{new Date(log.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
            <span className="hv2-hi-icon"><EmojiIcon emoji={log.template?.icon || '💪'} size={18} fallbackAsText /></span>
            <div className="hv2-hi-name">{log.template?.name || 'Custom Workout'}</div>
            {log.completed && <span className="hv2-hi-meta">{log.duration_min}min</span>}
            {log.sets && log.sets.length > 0 && <span className="hv2-hi-meta">{log.sets.length} sets</span>}
            {/* Scheduled vs Actual in history */}
            {log.scheduled_time && log.completed_at && (
              <span className="hv2-hi-meta hv2-hi-times">
                {formatTime(log.scheduled_time)} → {formatTime(log.completed_at)}
              </span>
            )}
            {log.skipped && <span className="hv2-hi-skip">Skipped</span>}
            {log.completed && <Check size={11} className="text-green-400 shrink-0" />}
            <button aria-label="Delete workout log" className="btn-icon-xs danger" onClick={() => { if (confirm('Delete?')) onDeleteLog(log.id); }}><Trash2 size={11} /></button>
            {log.sets && log.sets.length > 0 && (
              <button className="btn-icon-xs" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                <ChevronRight size={11} className={`transition-transform duration-200 ${expandedLog === log.id ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>
        ))}
        {logs.length === 0 && <div className="hv2-empty-day">No exercise history yet. Start logging!</div>}
      </div>
    </div>
  );
}
