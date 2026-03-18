// ═══════════════════════════════════════════════════════════
// WORKOUT DETAIL — Exercise event type
// Parses exercises from notes, checklist, rest timer, progress
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { Check, Play, Pause, SkipForward, Dumbbell, Clock, Trophy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../Toast';
import type { ScheduleEvent } from '../../types/database';

interface Exercise {
  name: string;
  sets: number;
  reps: number;
  completed: boolean;
}

interface WorkoutDetailProps {
  event: ScheduleEvent;
}

/** Parse exercise data from notes/description */
function parseExercises(text: string): Exercise[] {
  if (!text) return [];
  
  const exercises: Exercise[] = [];
  
  // Format: "AI-generated: Exercise1, Exercise2, ..."
  const aiMatch = text.match(/AI-generated:\s*(.+)/i);
  if (aiMatch) {
    const names = aiMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    names.forEach(name => {
      exercises.push({ name, sets: 3, reps: 10, completed: false });
    });
    return exercises;
  }
  
  // Format: lines like "Push-ups 3x12" or "Squats - 4 sets x 10 reps"
  const lines = text.split('\n').filter(l => l.trim());
  for (const line of lines) {
    const cleaned = line.replace(/^[-•*\d.)\s]+/, '').trim();
    if (!cleaned || cleaned.length < 2) continue;
    
    // Try to match "Exercise Name 3x12" or "Exercise Name - 3 x 12"
    const setsRepsMatch = cleaned.match(/^(.+?)\s*[-:]?\s*(\d+)\s*[x×]\s*(\d+)/i);
    if (setsRepsMatch) {
      exercises.push({
        name: setsRepsMatch[1].trim(),
        sets: parseInt(setsRepsMatch[2]),
        reps: parseInt(setsRepsMatch[3]),
        completed: false,
      });
      continue;
    }
    
    // Try "Exercise Name (3 sets, 12 reps)"
    const parenMatch = cleaned.match(/^(.+?)\s*\((\d+)\s*sets?,?\s*(\d+)\s*reps?\)/i);
    if (parenMatch) {
      exercises.push({
        name: parenMatch[1].trim(),
        sets: parseInt(parenMatch[2]),
        reps: parseInt(parenMatch[3]),
        completed: false,
      });
      continue;
    }
    
    // Plain exercise name (default 3x10)
    if (cleaned.length > 2 && cleaned.length < 60 && !/^(ai[- ]generated|workout|notes?|description)/i.test(cleaned)) {
      exercises.push({ name: cleaned, sets: 3, reps: 10, completed: false });
    }
  }
  
  return exercises;
}

const REST_OPTIONS = [30, 60, 90, 120];

export function WorkoutDetail({ event }: WorkoutDetailProps) {
  const noteText = event.notes || event.description || '';
  const [exercises, setExercises] = useState<Exercise[]>(() => parseExercises(noteText));
  const [restDuration, setRestDuration] = useState(60);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [logging, setLogging] = useState(false);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed workout timer
  useEffect(() => {
    const start = new Date(event.start_time).getTime();
    const tick = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [event.start_time]);

  // Rest timer countdown
  useEffect(() => {
    if (restTimer !== null && restTimer > 0 && !isPaused) {
      restRef.current = setInterval(() => {
        setRestTimer(prev => {
          if (prev !== null && prev <= 1) {
            if (restRef.current) clearInterval(restRef.current);
            return null;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
      return () => { if (restRef.current) clearInterval(restRef.current); };
    }
  }, [restTimer, isPaused]);

  const toggleExercise = (idx: number) => {
    setExercises(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], completed: !next[idx].completed };
      // Start rest timer when completing an exercise
      if (next[idx].completed && restDuration > 0) {
        setRestTimer(restDuration);
        setIsPaused(false);
      }
      return next;
    });
  };

  const completedCount = exercises.filter(e => e.completed).length;
  const totalCount = exercises.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const totalVolume = exercises.filter(e => e.completed).reduce((sum, e) => sum + (e.sets * e.reps), 0);
  const elapsedMin = Math.floor(elapsedSec / 60);
  const elapsedSecRem = elapsedSec % 60;

  const handleCompleteWorkout = async () => {
    setLogging(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) { showToast('Not logged in', 'error'); return; }

      await supabase.from('exercise_logs').insert({
        user_id: user.user.id,
        date: new Date().toISOString().split('T')[0],
        exercise_type: event.title,
        duration_minutes: elapsedMin,
        notes: `Completed ${completedCount}/${totalCount} exercises. Total volume: ${totalVolume} reps.`,
        schedule_event_id: event.id,
      });

      showToast('Workout logged! 💪', 'success');
      window.dispatchEvent(new Event('lifeos-refresh'));
    } catch {
      showToast('Failed to log workout', 'error');
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="ed-workout">
      {/* Stats Row */}
      <div className="ed-card">
        <div className="ed-workout-stats">
          <div className="ed-stat-card">
            <div className="ed-stat-value">{completedCount}/{totalCount}</div>
            <div className="ed-stat-label">Exercises</div>
          </div>
          <div className="ed-stat-card">
            <div className="ed-stat-value">{totalVolume}</div>
            <div className="ed-stat-label">Total Reps</div>
          </div>
          <div className="ed-stat-card">
            <div className="ed-stat-value">{elapsedMin}:{String(elapsedSecRem).padStart(2, '0')}</div>
            <div className="ed-stat-label">Elapsed</div>
          </div>
          <div className="ed-stat-card">
            <div className="ed-stat-value" style={{ color: '#22C55E' }}>{Math.round(progress)}%</div>
            <div className="ed-stat-label">Progress</div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="ed-progress-bar" style={{ marginBottom: 12 }}>
        <div className="ed-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Rest Timer (if active) */}
      {restTimer !== null && (
        <div className="ed-rest-timer">
          <div className="ed-timer-display">{restTimer}s</div>
          <div className="ed-timer-label">Rest Timer</div>
          <div className="ed-timer-controls">
            <button className="ed-timer-btn" onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? <Play size={14} /> : <Pause size={14} />}
            </button>
            <button className="ed-timer-btn" onClick={() => { setRestTimer(null); if (restRef.current) clearInterval(restRef.current); }}>
              <SkipForward size={14} /> Skip
            </button>
          </div>
        </div>
      )}

      {/* Rest Duration Options */}
      <div className="ed-card">
        <div className="ed-card-header"><Clock size={12} /> Rest Timer</div>
        <div className="ed-rest-options">
          {REST_OPTIONS.map(sec => (
            <button
              key={sec}
              className={`ed-rest-option ${restDuration === sec ? 'active' : ''}`}
              onClick={() => setRestDuration(sec)}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>

      {/* Exercise Checklist */}
      <div className="ed-card">
        <div className="ed-card-header"><Dumbbell size={12} /> Exercises</div>
        {exercises.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
            No exercises parsed from notes. Add them to the event description.
          </p>
        ) : (
          <div className="ed-exercise-list">
            {exercises.map((ex, i) => (
              <div
                key={i}
                className={`ed-exercise-item ${ex.completed ? 'completed' : ''}`}
                onClick={() => toggleExercise(i)}
              >
                <div className="ed-exercise-check">
                  {ex.completed && <Check size={12} />}
                </div>
                <span className="ed-exercise-name">{ex.name}</span>
                <span className="ed-exercise-meta">{ex.sets}×{ex.reps}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complete Workout */}
      <button
        className="ed-action-btn success"
        onClick={handleCompleteWorkout}
        disabled={logging}
      >
        {logging ? (
          <>Logging...</>
        ) : (
          <><Trophy size={16} /> Complete Workout</>
        )}
      </button>
    </div>
  );
}
