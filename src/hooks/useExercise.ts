// ═══════════════════════════════════════════════════════════
// Exercise Hooks — workout templates, exercise logs, body markers
// ═══════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/data-access';
import { createScheduleEvent } from '../lib/schedule-events';
import { logUnifiedEvent } from '../lib/events';
import { logger } from '../utils/logger';
import type { WorkoutTemplate, TemplateExercise, ExerciseLog, ExerciseLogSet, BodyMarker } from './useHealthTypes';

// ═══════════════════════════════════════════════════════════
// Workout Templates Hook
// ═══════════════════════════════════════════════════════════
export function useWorkoutTemplates() {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from('workout_templates')
        .select('*, template_exercises(*)')
        .eq('is_deleted', false)
        .order('sort_order');
      if (!cancelled) {
        if (error) logger.error('[useWorkoutTemplates]', error.message);
        type TemplateRow = WorkoutTemplate & { template_exercises?: (TemplateExercise & { is_deleted?: boolean })[] };
        setTemplates(((rows as TemplateRow[]) ?? []).map(r => ({
          ...r,
          exercises: r.template_exercises?.filter(e => !e.is_deleted).sort((a, b) => a.sort_order - b.sort_order) || [],
        })));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  const saveTemplate = async (template: Partial<WorkoutTemplate>) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    const { exercises, ...tmpl } = template as Partial<WorkoutTemplate> & { exercises?: TemplateExercise[] };
    let savedTemplateId = template.id;

    if (template.id) {
      // Update existing template
      await supabase.from('workout_templates').update({ ...tmpl, updated_at: new Date().toISOString() }).eq('id', template.id);
      
      // If exercises provided, sync them
      if (exercises) {
        // Soft-delete existing exercises
        await supabase.from('template_exercises').update({ is_deleted: true }).eq('template_id', template.id);
        // Insert new ones
        if (exercises.length > 0) {
          await supabase.from('template_exercises').insert(
            exercises.map((e: TemplateExercise, i: number) => ({
              template_id: template.id,
              name: e.name,
              muscle_group: e.muscle_group,
              sets: e.sets,
              reps: e.reps,
              weight_kg: e.weight_kg,
              duration_min: e.duration_min,
              rest_seconds: e.rest_seconds,
              notes: e.notes,
              sort_order: i,
            }))
          );
        }
      }
    } else {
      const { data: newTmpl } = await supabase.from('workout_templates').insert({ ...tmpl, user_id: user.user.id }).select().single();
      savedTemplateId = newTmpl?.id;
      if (newTmpl && exercises?.length) {
        await supabase.from('template_exercises').insert(
          exercises.map((e: TemplateExercise, i: number) => ({
            template_id: newTmpl.id,
            name: e.name,
            muscle_group: e.muscle_group,
            sets: e.sets,
            reps: e.reps,
            weight_kg: e.weight_kg,
            duration_min: e.duration_min,
            rest_seconds: e.rest_seconds,
            notes: e.notes,
            sort_order: i,
          }))
        );
      }
    }
    refresh();

    // Auto-sync to schedule if enabled and day_of_week is populated
    if (template.auto_sync && template.day_of_week && template.day_of_week.length > 0 && savedTemplateId) {
      const fullTemplate: WorkoutTemplate = {
        ...template,
        id: savedTemplateId,
        name: template.name || '',
        color: template.color || '#39FF14',
        icon: template.icon || '',
        estimated_duration_min: template.estimated_duration_min || 60,
        day_of_week: template.day_of_week,
        preferred_time: template.preferred_time || '06:00',
        is_active: template.is_active ?? true,
      };
      await syncToSchedule(fullTemplate);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    // Remove linked schedule events first
    await removeScheduleEvents(templateId);
    await supabase.from('workout_templates').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', templateId);
    refresh();
  };

  // Sync workout templates to schedule_events
  // Creates one recurring schedule_event per day_of_week entry, linked by workout_template_id
  const syncToSchedule = async (template: WorkoutTemplate) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user || !template.id) return;

    // Remove existing schedule events for this template (will re-create below)
    const { data: existing } = await supabase
      .from('schedule_events')
      .select('id')
      .eq('user_id', user.user.id)
      .eq('workout_template_id', template.id)
      .eq('is_deleted', false);

    if (existing && existing.length > 0) {
      await supabase
        .from('schedule_events')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .in('id', existing.map((e: { id: string }) => e.id));
    }

    // Create a recurring schedule event for each day_of_week
    for (const dow of template.day_of_week) {
      const nextDate = getNextDayOfWeek(dow);
      const startTime = `${nextDate}T${template.preferred_time || '06:00'}:00`;
      const endMins = template.estimated_duration_min || 60;
      const endTime = new Date(new Date(startTime).getTime() + endMins * 60000).toISOString();
      const title = template.name;

      await createScheduleEvent(supabase, {
        userId: user.user.id,
        title,
        startTime,
        endTime,
        color: template.color,
        category: 'health',
        eventType: 'exercise',
        scheduleLayer: 'primary',
        isTemplate: true,
        recurrenceRule: `FREQ=WEEKLY;BYDAY=${['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dow]}`,
        description: template.description || `${template.name} -- ${template.exercises?.length || 0} exercises`,
        workoutTemplateId: template.id,
      });
    }

    // Dispatch refresh so Schedule page picks up new events
    window.dispatchEvent(new CustomEvent('lifeos-refresh'));
  };

  // Remove schedule events linked to a workout template (call on template delete)
  const removeScheduleEvents = async (templateId: string) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    const { data: existing } = await supabase
      .from('schedule_events')
      .select('id')
      .eq('user_id', user.user.id)
      .eq('workout_template_id', templateId)
      .eq('is_deleted', false);

    if (existing && existing.length > 0) {
      await supabase
        .from('schedule_events')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .in('id', existing.map((e: { id: string }) => e.id));
    }

    window.dispatchEvent(new CustomEvent('lifeos-refresh'));
  };

  return { templates, loading, refresh, saveTemplate, deleteTemplate, syncToSchedule, removeScheduleEvents };
}

// ═══════════════════════════════════════════════════════════
// Exercise Logs Hook (with sets)
// ═══════════════════════════════════════════════════════════
export function useExerciseLogs(dateRange?: { from: string; to: string }) {
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase.from('exercise_logs')
        .select('*, workout_templates(name, icon, color), exercise_log_sets(*)')
        .eq('is_deleted', false)
        .order('date', { ascending: false });
      if (dateRange) query = query.gte('date', dateRange.from).lte('date', dateRange.to);
      else query = query.limit(60);
      const { data: rows, error } = await query;
      if (!cancelled) {
        if (error) logger.error('[useExerciseLogs]', error.message);
        type LogRow = ExerciseLog & { workout_templates?: WorkoutTemplate; exercise_log_sets?: ExerciseLogSet[] };
        setLogs(((rows as LogRow[]) ?? []).map(r => ({
          ...r,
          template: r.workout_templates,
          sets: r.exercise_log_sets || [],
        })));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick, dateRange?.from, dateRange?.to]);

  const logWorkout = async (log: Partial<ExerciseLog>, sets?: Partial<ExerciseLogSet>[]) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;
    const { sets: _s, template: _t, ...logData } = log as Partial<ExerciseLog>;
    const { data: newLog, error } = await supabase.from('exercise_logs')
      .insert({ ...logData, user_id: user.user.id })
      .select()
      .single();
    if (error) { logger.error('[logWorkout]', error.message); return; }
    
    // Insert sets if provided
    if (newLog && sets && sets.length > 0) {
      await supabase.from('exercise_log_sets').insert(
        sets.map(s => ({ ...s, exercise_log_id: newLog.id }))
      );
    }

    // Log to unified events
    if (newLog && user.user) {
      const exerciseDate = newLog.date || new Date().toISOString().split('T')[0];
      logUnifiedEvent({
        user_id: user.user.id,
        timestamp: `${exerciseDate}T${newLog.start_time || '08:00'}:00`,
        end_timestamp: newLog.end_time ? `${exerciseDate}T${newLog.end_time}:00` : undefined,
        type: 'exercise',
        title: log.template?.name || 'Workout',
        details: {
          exercise_log_id: newLog.id,
          template_id: log.template_id,
          sets: sets?.length || 0,
        },
        module_source: 'health',
        duration_minutes: newLog.duration_minutes || undefined,
      });
    }
    
    refresh();
    return newLog;
  };

  const updateLog = async (logId: string, updates: Partial<ExerciseLog>) => {
    const { sets: _s, template: _t, ...logData } = updates as Partial<ExerciseLog>;
    const { error } = await supabase.from('exercise_logs').update(logData).eq('id', logId);
    if (error) logger.error('[updateLog]', error.message);
    else refresh();
  };

  const deleteLog = async (logId: string) => {
    await supabase.from('exercise_logs').update({ is_deleted: true }).eq('id', logId);
    refresh();
  };

  const skipWorkout = async (scheduleEventId: string, reason: string) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('exercise_logs').insert({
      user_id: user.user.id,
      schedule_event_id: scheduleEventId,
      date: today,
      skipped: true,
      skip_reason: reason,
      completed: false,
    });
    refresh();
  };

  return { logs, loading, refresh, logWorkout, updateLog, deleteLog, skipWorkout };
}

// ═══════════════════════════════════════════════════════════
// Body Markers Hook
// ═══════════════════════════════════════════════════════════
export function useBodyMarkers() {
  const [markers, setMarkers] = useState<BodyMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from('body_markers')
        .select('*')
        .eq('is_deleted', false)
        .eq('resolved', false)
        .order('date', { ascending: false });
      if (!cancelled) {
        if (error) logger.error('[useBodyMarkers]', error.message);
        setMarkers((rows as BodyMarker[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  const addMarker = async (marker: Partial<BodyMarker>) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;
    await supabase.from('body_markers').insert({ ...marker, user_id: user.user.id });
    refresh();
  };

  const resolveMarker = async (id: string) => {
    await supabase.from('body_markers').update({ resolved: true, resolved_at: new Date().toISOString().split('T')[0] }).eq('id', id);
    refresh();
  };

  const updateMarker = async (id: string, updates: Partial<BodyMarker>) => {
    const { error } = await supabase.from('body_markers').update(updates).eq('id', id);
    if (error) logger.error('[updateMarker]', error.message);
    else refresh();
  };

  const deleteMarker = async (id: string) => {
    await supabase.from('body_markers').update({ is_deleted: true }).eq('id', id);
    refresh();
  };

  return { markers, loading, refresh, addMarker, resolveMarker, updateMarker, deleteMarker };
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════
function getNextDayOfWeek(dayOfWeek: number): string {
  const today = new Date();
  const diff = (dayOfWeek - today.getDay() + 7) % 7 || 7;
  const next = new Date(today);
  next.setDate(today.getDate() + diff);
  return next.toISOString().split('T')[0];
}
