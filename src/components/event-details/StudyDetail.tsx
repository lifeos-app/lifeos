// ═══════════════════════════════════════════════════════════
// STUDY DETAIL — Education event type
// Pomodoro timer, session notes (auto-saved), focus mode
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, Check, BookOpen, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../Toast';
import type { ScheduleEvent } from '../../types/database';

interface StudyDetailProps {
  event: ScheduleEvent;
}

export function StudyDetail({ event }: StudyDetailProps) {
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [phase, setPhase] = useState<'work' | 'break'>('work');
  const [timerState, setTimerState] = useState<'idle' | 'running' | 'paused'>('idle');
  const [remainingSec, setRemainingSec] = useState(25 * 60);
  const [pomodorosCompleted, setPomodorosCompleted] = useState(0);
  const [sessionNotes, setSessionNotes] = useState('');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Extract topic from title
  const topic = event.title.replace(/^(study|learn|read|course|class|education)\s*[-:]\s*/i, '').trim() || event.title;

  // Initialize remaining time when config changes
  useEffect(() => {
    if (timerState === 'idle') {
      setRemainingSec(phase === 'work' ? workMin * 60 : breakMin * 60);
    }
  }, [workMin, breakMin, phase, timerState]);

  const startTimer = useCallback(() => {
    setTimerState('running');
    intervalRef.current = setInterval(() => {
      setRemainingSec(prev => {
        if (prev <= 1) {
          // Timer done
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimerState('idle');
          
          if (phase === 'work') {
            setPomodorosCompleted(c => c + 1);
            setPhase('break');
            showToast('Break time! ☕', 'success');
            return breakMin * 60;
          } else {
            setPhase('work');
            showToast('Back to work! 📚', 'success');
            return workMin * 60;
          }
        }
        return prev - 1;
      });
    }, 1000);
  }, [phase, workMin, breakMin]);

  const pauseTimer = useCallback(() => {
    setTimerState('paused');
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const stopTimer = useCallback(() => {
    setTimerState('idle');
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRemainingSec(phase === 'work' ? workMin * 60 : breakMin * 60);
  }, [phase, workMin, breakMin]);

  const resetPomodoro = useCallback(() => {
    stopTimer();
    setPhase('work');
    setPomodorosCompleted(0);
    setRemainingSec(workMin * 60);
  }, [stopTimer, workMin]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, []);

  // Auto-save notes (debounced 2s)
  const handleNotesChange = (text: string) => {
    setSessionNotes(text);
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      if (!text.trim()) return;
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user) return;
        
        await supabase.from('event_notes').upsert({
          user_id: user.user.id,
          schedule_event_id: event.id,
          date: new Date().toISOString().split('T')[0],
          content: text.trim(),
        }, { onConflict: 'user_id,schedule_event_id,date' });
        
        setLastSaved(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }));
      } catch {
        // Silent fail for auto-save
      }
    }, 2000);
  };

  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const totalPhaseSec = phase === 'work' ? workMin * 60 : breakMin * 60;
  const progress = totalPhaseSec > 0 ? ((totalPhaseSec - remainingSec) / totalPhaseSec) * 100 : 0;

  const handleComplete = async () => {
    setLogging(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) { showToast('Not logged in', 'error'); return; }

      await supabase.from('event_notes').upsert({
        user_id: user.user.id,
        schedule_event_id: event.id,
        date: new Date().toISOString().split('T')[0],
        content: sessionNotes.trim() || `Study session: ${topic}`,
      }, { onConflict: 'user_id,schedule_event_id,date' });

      // Log as health metric for study tracking
      await supabase.from('health_metrics').insert({
        user_id: user.user.id,
        date: new Date().toISOString().split('T')[0],
        metric_type: 'study',
        value: pomodorosCompleted * workMin || workMin,
        notes: `${topic} — ${pomodorosCompleted} pomodoros completed`,
        schedule_event_id: event.id,
      });

      setLogged(true);
      showToast('Study session logged! 📚', 'success');
      window.dispatchEvent(new Event('lifeos-refresh'));
    } catch {
      showToast('Failed to log session', 'error');
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="ed-study">
      {/* Topic */}
      <div className="ed-card">
        <div className="ed-card-header"><BookOpen size={12} /> Topic</div>
        <h4 style={{ fontSize: 16, color: 'var(--text-primary)', margin: 0 }}>{topic}</h4>
      </div>

      {/* Focus Mode + Phase Indicator */}
      {timerState === 'running' && (
        <div className="ed-focus-indicator">
          <div className="ed-focus-dot" />
          Focus Mode {phase === 'work' ? '— Deep Work' : '— Break'}
        </div>
      )}

      {/* Pomodoro Phase */}
      <div className={`ed-pomodoro-phase ${phase}`}>
        {phase === 'work' ? '📚 Work Phase' : '☕ Break Phase'}
        {pomodorosCompleted > 0 && ` — ${pomodorosCompleted} pomodoro${pomodorosCompleted > 1 ? 's' : ''} done`}
      </div>

      {/* Timer */}
      <div className="ed-card">
        <div className="ed-timer-display">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>
        <div className="ed-timer-label">
          {timerState === 'idle' && 'ready'}
          {timerState === 'running' && (phase === 'work' ? 'focusing...' : 'resting...')}
          {timerState === 'paused' && 'paused'}
        </div>

        <div className="ed-progress-bar" style={{ margin: '12px 0' }}>
          <div className="ed-progress-fill" style={{ width: `${progress}%`, background: phase === 'work' ? '#A855F7' : '#22C55E' }} />
        </div>

        {/* Timer Controls */}
        <div className="ed-timer-controls">
          {timerState === 'idle' && (
            <button className="ed-timer-btn primary" onClick={startTimer}>
              <Play size={16} /> Start
            </button>
          )}
          {timerState === 'running' && (
            <>
              <button className="ed-timer-btn" onClick={pauseTimer}>
                <Pause size={16} /> Pause
              </button>
              <button className="ed-timer-btn stop" onClick={stopTimer}>
                <Square size={14} /> Stop
              </button>
            </>
          )}
          {timerState === 'paused' && (
            <>
              <button className="ed-timer-btn primary" onClick={startTimer}>
                <Play size={16} /> Resume
              </button>
              <button className="ed-timer-btn stop" onClick={stopTimer}>
                <Square size={14} /> Stop
              </button>
            </>
          )}
          {(timerState === 'idle' && pomodorosCompleted > 0) && (
            <button className="ed-timer-btn" onClick={resetPomodoro}>
              <RotateCcw size={14} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Pomodoro Config */}
      <div className="ed-card">
        <div className="ed-card-header">Pomodoro Settings</div>
        <div className="ed-pomodoro-config">
          <div className="ed-pomodoro-setting">
            <label>Work (min)</label>
            <input
              type="number"
              value={workMin}
              onChange={e => setWorkMin(Math.max(1, parseInt(e.target.value) || 25))}
              min={1}
              max={120}
              disabled={timerState !== 'idle'}
            />
          </div>
          <div className="ed-pomodoro-setting">
            <label>Break (min)</label>
            <input
              type="number"
              value={breakMin}
              onChange={e => setBreakMin(Math.max(1, parseInt(e.target.value) || 5))}
              min={1}
              max={30}
              disabled={timerState !== 'idle'}
            />
          </div>
        </div>
      </div>

      {/* Session Notes */}
      <div className="ed-card ed-study-notes">
        <div className="ed-card-header">Session Notes</div>
        <textarea
          placeholder="Type your notes, insights, key takeaways..."
          value={sessionNotes}
          onChange={e => handleNotesChange(e.target.value)}
          rows={5}
        />
        {lastSaved && (
          <div className="ed-auto-save">Auto-saved at {lastSaved}</div>
        )}
      </div>

      {/* Complete */}
      <button
        className="ed-action-btn"
        onClick={handleComplete}
        disabled={logging || logged}
        style={logged ? { background: 'rgba(34,197,94,0.15)', color: '#22C55E', borderColor: 'rgba(34,197,94,0.3)' } : undefined}
      >
        {logged ? (
          <><Check size={16} /> Session Logged!</>
        ) : logging ? (
          <>Logging...</>
        ) : (
          <><Check size={16} /> Complete Study Session</>
        )}
      </button>
    </div>
  );
}
