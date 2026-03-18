// ═══ Activity Body Components — EventOverlay System ═══
// Type-specific overlay bodies for each event type.

import { useState, useEffect, useRef } from 'react';
import {
  Check, Play, Pause, SkipForward,
  Dumbbell, BookOpen, Droplets,
  StickyNote, Zap, Wind, RotateCcw, AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ActiveEvent } from './types';

// ═══════════════════════════════════════════════════════════
// WORKOUT OVERLAY BODY
// ═══════════════════════════════════════════════════════════
export function WorkoutOverlayBody({ event }: { event: ActiveEvent }) {
  const template = event.workoutTemplate;
  const exercises = template?.exercises || [];
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [completedSets, setCompletedSets] = useState<Record<string, number[]>>({});
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const restIntervalRef = useRef<number | null>(null);

  const currentExercise = exercises[currentExIdx];
  const totalExercises = exercises.length;
  const totalSetsAll = exercises.reduce((s, e) => s + e.sets, 0);
  const completedSetsAll = Object.values(completedSets).reduce((s, sets) => s + sets.length, 0);
  const overallProgress = totalSetsAll > 0 ? (completedSetsAll / totalSetsAll) * 100 : 0;

  // Rest timer countdown
  useEffect(() => {
    if (restTimer !== null && restTimer > 0 && !isPaused) {
      restIntervalRef.current = window.setInterval(() => {
        setRestTimer(prev => {
          if (prev !== null && prev <= 1) {
            clearInterval(restIntervalRef.current!);
            return null;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
      return () => { if (restIntervalRef.current) clearInterval(restIntervalRef.current); };
    }
  }, [restTimer, isPaused]);

  const completeSet = () => {
    if (!currentExercise) return;
    const key = `${currentExIdx}`;
    const done = completedSets[key] || [];
    const newDone = [...done, currentSet];
    setCompletedSets(prev => ({ ...prev, [key]: newDone }));

    if (currentSet < currentExercise.sets) {
      // More sets remaining — start rest timer
      setCurrentSet(currentSet + 1);
      if (currentExercise.rest_seconds > 0) {
        setRestTimer(currentExercise.rest_seconds);
      }
    } else {
      // All sets done for this exercise → move to next
      nextExercise();
    }
  };

  const nextExercise = () => {
    if (currentExIdx < totalExercises - 1) {
      setCurrentExIdx(currentExIdx + 1);
      setCurrentSet(1);
      setRestTimer(null);
    }
  };

  const prevExercise = () => {
    if (currentExIdx > 0) {
      setCurrentExIdx(currentExIdx - 1);
      setCurrentSet(1);
      setRestTimer(null);
    }
  };

  const skipRest = () => {
    setRestTimer(null);
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
  };

  if (!template || exercises.length === 0) {
    return (
      <div className="eo-workout-empty">
        <Dumbbell size={32} />
        <p>No exercises defined for this workout.</p>
        <p className="eo-hint">Start logging your sets manually below.</p>
      </div>
    );
  }

  return (
    <div className="eo-workout">
      {/* Overall Progress */}
      <div className="eo-progress-section">
        <div className="eo-progress-bar">
          <div className="eo-progress-fill" style={{ width: `${overallProgress}%` }} />
        </div>
        <div className="eo-progress-info">
          <span>{completedSetsAll}/{totalSetsAll} sets</span>
          <span>Exercise {currentExIdx + 1}/{totalExercises}</span>
        </div>
      </div>

      {/* Rest Timer Overlay */}
      {restTimer !== null && (
        <div className="eo-rest-timer">
          <Wind size={20} />
          <div className="eo-rest-countdown">
            <span className="eo-rest-number">{restTimer}</span>
            <span className="eo-rest-label">seconds rest</span>
          </div>
          <div className="eo-rest-actions">
            <button className="eo-rest-btn" onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? <Play size={14} /> : <Pause size={14} />}
            </button>
            <button className="eo-rest-btn skip" onClick={skipRest}>
              <SkipForward size={14} /> Skip
            </button>
          </div>
          <div className="eo-rest-bar">
            <div className="eo-rest-bar-fill" style={{
              width: `${((currentExercise?.rest_seconds || 60) - restTimer) / (currentExercise?.rest_seconds || 60) * 100}%`
            }} />
          </div>
          <div className="eo-rest-hydrate">
            <Droplets size={14} /> Don't forget to hydrate!
          </div>
        </div>
      )}

      {/* Current Exercise Card */}
      {currentExercise && restTimer === null && (
        <div className="eo-exercise-card">
          <div className="eo-exercise-header">
            <h4 className="eo-exercise-name">{currentExercise.name}</h4>
            {currentExercise.muscle_group && (
              <span className="eo-muscle-tag">{currentExercise.muscle_group}</span>
            )}
          </div>

          <div className="eo-exercise-details">
            <div className="eo-detail-item">
              <span className="eo-detail-label">Set</span>
              <span className="eo-detail-value">{currentSet} / {currentExercise.sets}</span>
            </div>
            {currentExercise.reps > 0 && !currentExercise.duration_min && (
              <div className="eo-detail-item">
                <span className="eo-detail-label">Reps</span>
                <span className="eo-detail-value">{currentExercise.reps}</span>
              </div>
            )}
            {currentExercise.duration_min && (
              <div className="eo-detail-item">
                <span className="eo-detail-label">Duration</span>
                <span className="eo-detail-value">{currentExercise.duration_min} min</span>
              </div>
            )}
            {currentExercise.weight_kg && (
              <div className="eo-detail-item">
                <span className="eo-detail-label">Weight</span>
                <span className="eo-detail-value">{currentExercise.weight_kg} kg</span>
              </div>
            )}
            {(currentExercise as any).equipment && (
              <div className="eo-detail-item">
                <span className="eo-detail-label">Equipment</span>
                <span className="eo-detail-value">{(currentExercise as any).equipment}</span>
              </div>
            )}
            <div className="eo-detail-item">
              <span className="eo-detail-label">Rest</span>
              <span className="eo-detail-value">{currentExercise.rest_seconds}s</span>
            </div>
          </div>

          {/* Set progress dots */}
          <div className="eo-set-dots">
            {Array.from({ length: currentExercise.sets }, (_, i) => {
              const isDone = (completedSets[`${currentExIdx}`] || []).includes(i + 1);
              const isCurrent = i + 1 === currentSet;
              return (
                <div key={i} className={`eo-set-dot ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                  {isDone ? <Check size={10} /> : i + 1}
                </div>
              );
            })}
          </div>

          <button className="eo-complete-set-btn" onClick={completeSet}>
            <Check size={16} /> Complete Set {currentSet}
          </button>
        </div>
      )}

      {/* Exercise List (scrollable) */}
      <div className="eo-exercise-list">
        <h5>All Exercises</h5>
        {exercises.map((ex, idx) => {
          const isDone = (completedSets[`${idx}`] || []).length >= ex.sets;
          const isCurrent = idx === currentExIdx;
          return (
            <div key={idx}
              className={`eo-ex-item ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
              onClick={() => { setCurrentExIdx(idx); setCurrentSet(1); setRestTimer(null); }}
            >
              <span className="eo-ex-num">{idx + 1}</span>
              <span className="eo-ex-name">{ex.name}</span>
              <span className="eo-ex-meta">
                {ex.duration_min ? `${ex.duration_min}min` : `${ex.sets}×${ex.reps}`}
              </span>
              {isDone && <Check size={12} className="eo-ex-check" />}
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="eo-nav-row">
        <button className="eo-nav-btn" onClick={prevExercise} disabled={currentExIdx === 0}>
          <RotateCcw size={14} /> Previous
        </button>
        <button className="eo-nav-btn primary" onClick={nextExercise} disabled={currentExIdx >= totalExercises - 1}>
          Next <SkipForward size={14} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// READING OVERLAY BODY
// ═══════════════════════════════════════════════════════════
export function ReadingOverlayBody({ event }: { event: ActiveEvent }) {
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  const saveNotes = async () => {
    if (!notes.trim()) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    await supabase.from('event_notes').insert({
      user_id: user.user.id,
      schedule_event_id: event.id,
      date: new Date().toISOString().split('T')[0],
      content: notes.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="eo-reading">
      <div className="eo-reading-info">
        <BookOpen size={20} />
        <div>
          <h4>{event.title}</h4>
          {event.description && <p className="eo-reading-desc">{event.description}</p>}
        </div>
      </div>

      <div className="eo-notes-section">
        <label className="eo-notes-label">
          <StickyNote size={14} /> Session Notes
        </label>
        <textarea
          className="eo-notes-textarea"
          placeholder="Type your notes, insights, or highlights..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={6}
        />
        <div className="eo-notes-actions">
          <button className="eo-save-notes-btn" onClick={saveNotes} disabled={!notes.trim()}>
            {saved ? <><Check size={14} /> Saved!</> : <><StickyNote size={14} /> Save Notes</>}
          </button>
        </div>
      </div>

      <div className="eo-reading-tips">
        <h5>Reading Tips</h5>
        <div className="eo-tip">📝 Capture key insights as you read</div>
        <div className="eo-tip">🎯 Connect ideas to your goals</div>
        <div className="eo-tip">💧 Stay hydrated</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MEAL OVERLAY BODY
// ═══════════════════════════════════════════════════════════
export function MealOverlayBody({ event }: { event: ActiveEvent }) {
  const [logged, setLogged] = useState(false);
  const noteText = event.description || '';

  // Quick macro parse
  const calMatch = noteText.match(/(\d+)\s*(?:k?cal)/i);
  const proteinMatch = noteText.match(/(\d+)\s*g?\s*protein/i);
  const carbsMatch = noteText.match(/(\d+)\s*g?\s*carb/i);
  const fatMatch = noteText.match(/(\d+)\s*g?\s*fat/i);
  const calories = calMatch ? parseInt(calMatch[1]) : 0;
  const protein = proteinMatch ? parseInt(proteinMatch[1]) : 0;
  const carbs = carbsMatch ? parseInt(carbsMatch[1]) : 0;
  const fat = fatMatch ? parseInt(fatMatch[1]) : 0;
  const maxMacro = Math.max(protein, carbs, fat, 1);

  // Meal type from time
  const hour = new Date(event.start_time).getHours();
  const mealLabel = hour < 11 ? '🌅 Breakfast' : hour < 14 ? '☀️ Lunch' : hour < 17 ? '🍎 Snack' : '🌙 Dinner';

  const logMeal = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;
    await supabase.from('health_metrics').insert({
      user_id: user.user.id,
      date: new Date().toISOString().split('T')[0],
      metric_type: 'meal',
      value: calories || 0,
      notes: `${mealLabel}: ${event.title}. P:${protein}g C:${carbs}g F:${fat}g`,
    });
    setLogged(true);
    window.dispatchEvent(new Event('lifeos-refresh'));
  };

  return (
    <div className="eo-meal-activity" style={{ padding: 16 }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: 'rgba(249,115,22,0.12)', color: '#F97316' }}>
          {mealLabel}
        </span>
      </div>

      {calories > 0 && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#F97316' }}>{calories}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Calories</div>
        </div>
      )}

      {(protein > 0 || carbs > 0 || fat > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Protein', value: protein, color: '#F97316' },
            { label: 'Carbs', value: carbs, color: '#EAB308' },
            { label: 'Fat', value: fat, color: '#3B82F6' },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, width: 54, color: m.color }}>{m.label}</span>
              <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${(m.value / maxMacro) * 100}%`, height: '100%', borderRadius: 3, background: m.color }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 36, textAlign: 'right' }}>{m.value}g</span>
            </div>
          ))}
        </div>
      )}

      {event.description && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>{event.description}</p>
      )}

      <button
        className="eo-save-notes-btn"
        onClick={logMeal}
        disabled={logged}
        style={{ width: '100%', justifyContent: 'center', padding: 10 }}
      >
        {logged ? <><Check size={14} /> Meal Logged!</> : <><Zap size={14} /> Log Meal</>}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SLEEP OVERLAY BODY
// ═══════════════════════════════════════════════════════════
export function SleepOverlayBody({ event }: { event: ActiveEvent }) {
  const [quality, setQuality] = useState(0);
  const [logged, setLogged] = useState(false);
  const stars = ['😫', '😐', '🙂', '😊', '😴'];

  const bedtime = new Date(event.start_time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
  const wakeTime = new Date(event.end_time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
  const hours = ((new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 3600000).toFixed(1);

  const logSleep = async () => {
    if (!quality) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;
    await supabase.from('health_metrics').upsert({
      user_id: user.user.id,
      date: new Date(event.start_time).toISOString().split('T')[0],
      metric_type: 'sleep',
      value: parseFloat(hours),
      notes: `quality: ${quality}/5, bedtime: ${bedtime}, wake: ${wakeTime}`,
    }, { onConflict: 'user_id,date,metric_type' });
    setLogged(true);
    window.dispatchEvent(new Event('lifeos-refresh'));
  };

  return (
    <div className="eo-sleep-activity" style={{ padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <div style={{ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.12)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#818CF8' }}>{bedtime}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>🌙 Bedtime</div>
        </div>
        <div style={{ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.12)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#818CF8' }}>{wakeTime}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>☀️ Wake Up</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Target: <strong style={{ color: '#818CF8' }}>{hours} hours</strong>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Sleep Quality</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {stars.map((emoji, i) => (
            <span
              key={i}
              onClick={() => setQuality(i + 1)}
              style={{ fontSize: 26, cursor: 'pointer', opacity: quality >= i + 1 ? 1 : 0.3, filter: quality >= i + 1 ? 'none' : 'grayscale(1)', transition: 'transform 0.15s', transform: quality >= i + 1 ? 'scale(1.1)' : 'scale(1)' }}
            >{emoji}</span>
          ))}
        </div>
      </div>

      <button
        className="eo-save-notes-btn"
        onClick={logSleep}
        disabled={logged || quality === 0}
        style={{ width: '100%', justifyContent: 'center', padding: 10, marginTop: 12 }}
      >
        {logged ? <><Check size={14} /> Sleep Logged!</> : <>😴 Log Sleep</>}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MEDITATION OVERLAY BODY
// ═══════════════════════════════════════════════════════════
export function MeditationOverlayBody({ event }: { event: ActiveEvent }) {
  const targetMin = Math.round((new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 60000);
  const targetSec = targetMin * 60;
  const [timerState, setTimerState] = useState<'idle' | 'running' | 'paused'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [breathe, setBreathe] = useState(false);
  const [logged, setLogged] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerState === 'running') {
      intervalRef.current = window.setInterval(() => setElapsed(p => p + 1), 1000);
      const breatheInt = setInterval(() => setBreathe(p => !p), 4000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); clearInterval(breatheInt); };
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerState]);

  const remaining = Math.max(0, targetSec - elapsed);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  const logSession = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;
    await supabase.from('health_metrics').insert({
      user_id: user.user.id,
      date: new Date().toISOString().split('T')[0],
      metric_type: 'meditation',
      value: Math.floor(elapsed / 60) || targetMin,
      notes: `${event.title} — ${Math.floor(elapsed / 60) || targetMin} minutes`,
    });
    setLogged(true);
    window.dispatchEvent(new Event('lifeos-refresh'));
  };

  return (
    <div className="eo-meditation-activity" style={{ padding: 16, textAlign: 'center' }}>
      {/* Breathing circle */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
        <div style={{ width: 100, height: 100, borderRadius: '50%', border: '3px solid rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: breathe ? 70 : 30, height: breathe ? 70 : 30, borderRadius: '50%', background: `rgba(212,175,55,${breathe ? 0.35 : 0.15})`, transition: 'all 4s ease-in-out' }} />
        </div>
      </div>
      {timerState === 'running' && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{breathe ? 'Breathe out...' : 'Breathe in...'}</div>
      )}

      <div style={{ fontSize: 42, fontWeight: 700, color: '#D4AF37', fontVariantNumeric: 'tabular-nums' }}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
        {timerState === 'idle' ? `${targetMin} min target` : timerState === 'paused' ? 'paused' : 'remaining'}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
        {timerState === 'idle' && (
          <button className="eo-save-notes-btn" onClick={() => setTimerState('running')}>
            <Play size={14} /> {elapsed > 0 ? 'Resume' : 'Start'}
          </button>
        )}
        {timerState === 'running' && (
          <button className="eo-save-notes-btn" onClick={() => { setTimerState('paused'); if (intervalRef.current) clearInterval(intervalRef.current); }}>
            <Pause size={14} /> Pause
          </button>
        )}
        {timerState === 'paused' && (
          <button className="eo-save-notes-btn" onClick={() => setTimerState('running')}>
            <Play size={14} /> Resume
          </button>
        )}
      </div>

      <button
        className="eo-save-notes-btn"
        onClick={logSession}
        disabled={logged}
        style={{ width: '100%', justifyContent: 'center', padding: 10 }}
      >
        {logged ? <><Check size={14} /> Logged!</> : <>🧘 Log Session</>}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STUDY OVERLAY BODY
// ═══════════════════════════════════════════════════════════
export function StudyOverlayBody({ event }: { event: ActiveEvent }) {
  const [phase, setPhase] = useState<'work' | 'break'>('work');
  const [timerState, setTimerState] = useState<'idle' | 'running' | 'paused'>('idle');
  const [remaining, setRemaining] = useState(25 * 60);
  const [pomodoros, setPomodoros] = useState(0);
  const [notes, setNotes] = useState('');
  const intervalRef = useRef<number | null>(null);
  const workMin = 25;
  const breakMin = 5;

  useEffect(() => {
    if (timerState === 'running') {
      intervalRef.current = window.setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setTimerState('idle');
            if (phase === 'work') { setPomodoros(p => p + 1); setPhase('break'); return breakMin * 60; }
            else { setPhase('work'); return workMin * 60; }
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }
  }, [timerState, phase]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="eo-study-activity" style={{ padding: 16 }}>
      {timerState === 'running' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, color: '#A855F7', marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#A855F7', animation: 'ed-pulse 2s ease-in-out infinite' }} />
          Focus Mode
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12, background: phase === 'work' ? 'rgba(168,85,247,0.1)' : 'rgba(34,197,94,0.1)', color: phase === 'work' ? '#A855F7' : '#22C55E' }}>
        {phase === 'work' ? '📚 Work Phase' : '☕ Break'}{pomodoros > 0 ? ` — ${pomodoros} done` : ''}
      </div>

      <div style={{ textAlign: 'center', fontSize: 42, fontWeight: 700, color: '#A855F7', fontVariantNumeric: 'tabular-nums' }}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '12px 0' }}>
        {timerState === 'idle' && (
          <button className="eo-save-notes-btn" onClick={() => setTimerState('running')}>
            <Play size={14} /> Start
          </button>
        )}
        {timerState === 'running' && (
          <button className="eo-save-notes-btn" onClick={() => { setTimerState('paused'); if (intervalRef.current) clearInterval(intervalRef.current); }}>
            <Pause size={14} /> Pause
          </button>
        )}
        {timerState === 'paused' && (
          <button className="eo-save-notes-btn" onClick={() => setTimerState('running')}>
            <Play size={14} /> Resume
          </button>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <StickyNote size={12} style={{ display: 'inline', marginRight: 4 }} />
          Session Notes
        </label>
        <textarea
          className="eo-notes-textarea"
          rows={3}
          placeholder="Key takeaways, insights..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// GENERIC OVERLAY BODY
// ═══════════════════════════════════════════════════════════
export function GenericOverlayBody({ event }: { event: ActiveEvent }) {
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [checkedHabits, setCheckedHabits] = useState<Set<string>>(new Set());

  const saveNotes = async () => {
    if (!notes.trim()) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    await supabase.from('event_notes').insert({
      user_id: user.user.id,
      schedule_event_id: event.id,
      date: new Date().toISOString().split('T')[0],
      content: notes.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const quickHabits = ['💧 Drink water', '🧘 Stretch break', '👁️ Eye rest', '🚶 Walk break'];

  return (
    <div className="eo-generic">
      {event.description && (
        <div className="eo-generic-desc">
          <AlertCircle size={14} />
          <p>{event.description}</p>
        </div>
      )}

      <div className="eo-habits-section">
        <h5>Quick Habits</h5>
        <div className="eo-habits-grid">
          {quickHabits.map(habit => (
            <button
              key={habit}
              className={`eo-habit-btn ${checkedHabits.has(habit) ? 'checked' : ''}`}
              onClick={() => setCheckedHabits(prev => {
                const next = new Set(prev);
                if (next.has(habit)) next.delete(habit);
                else next.add(habit);
                return next;
              })}
            >
              {checkedHabits.has(habit) ? <Check size={14} /> : null}
              <span>{habit}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="eo-notes-section">
        <label className="eo-notes-label">
          <StickyNote size={14} /> Notes
        </label>
        <textarea
          className="eo-notes-textarea"
          placeholder="Capture thoughts, progress, or ideas..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
        />
        <div className="eo-notes-actions">
          <button className="eo-save-notes-btn" onClick={saveNotes} disabled={!notes.trim()}>
            {saved ? <><Check size={14} /> Saved!</> : <><StickyNote size={14} /> Save Notes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
