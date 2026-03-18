// ═══════════════════════════════════════════════════════════
// MEDITATION DETAIL — Meditation/Prayer event type
// Timer, breathing guide, session logging
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, Check, Brain } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../Toast';
import type { ScheduleEvent } from '../../types/database';

interface MeditationDetailProps {
  event: ScheduleEvent;
}

function durationMinutes(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

export function MeditationDetail({ event }: MeditationDetailProps) {
  const targetMin = event.end_time ? durationMinutes(event.start_time, event.end_time) : 15;
  const targetSec = targetMin * 60;

  const [timerState, setTimerState] = useState<'idle' | 'running' | 'paused'>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [breatheExpanded, setBreatheExpanded] = useState(false);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breatheRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Count sessions this week
  useEffect(() => {
    const fetchSessions = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;
      
      const now = new Date();
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('health_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .eq('metric_type', 'meditation')
        .gte('date', monday.toISOString().split('T')[0]);
      
      setSessionsThisWeek(count || 0);
    };
    fetchSessions();
  }, []);

  // Breathing animation
  useEffect(() => {
    if (timerState === 'running') {
      // 4s breathe in, 4s breathe out
      breatheRef.current = setInterval(() => {
        setBreatheExpanded(prev => !prev);
      }, 4000);
      return () => { if (breatheRef.current) clearInterval(breatheRef.current); };
    } else {
      setBreatheExpanded(false);
    }
  }, [timerState]);

  const startTimer = useCallback(() => {
    setTimerState('running');
    intervalRef.current = setInterval(() => {
      setElapsedSec(prev => prev + 1);
    }, 1000);
  }, []);

  const pauseTimer = useCallback(() => {
    setTimerState('paused');
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const stopTimer = useCallback(() => {
    setTimerState('idle');
    if (intervalRef.current) clearInterval(intervalRef.current);
    // Don't reset elapsed — keep for logging
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (breatheRef.current) clearInterval(breatheRef.current);
    };
  }, []);

  const remaining = Math.max(0, targetSec - elapsedSec);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = targetSec > 0 ? Math.min((elapsedSec / targetSec) * 100, 100) : 0;
  const elapsedMins = Math.floor(elapsedSec / 60);

  const handleLogSession = async () => {
    setLogging(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) { showToast('Not logged in', 'error'); return; }

      const today = new Date().toISOString().split('T')[0];

      await supabase.from('health_metrics').insert({
        user_id: user.user.id,
        date: today,
        metric_type: 'meditation',
        value: elapsedMins || targetMin,
        notes: `${event.title} — ${elapsedMins || targetMin} minutes`,
        schedule_event_id: event.id,
      });

      setLogged(true);
      setSessionsThisWeek(prev => prev + 1);
      showToast('Session logged! 🧘', 'success');
      window.dispatchEvent(new Event('lifeos-refresh'));
    } catch {
      showToast('Failed to log session', 'error');
    } finally {
      setLogging(false);
    }
  };

  const isPrayer = (event as Record<string, unknown>).event_type === 'prayer' ||
    event.title.toLowerCase().includes('pray');

  return (
    <div className="ed-meditation">
      {/* Session Counter */}
      <div className="ed-session-counter">
        <Brain size={14} /> Session <strong>#{sessionsThisWeek + 1}</strong> this week
      </div>

      {/* Breathing Circle + Timer */}
      <div className="ed-card">
        <div className="ed-breathing-circle">
          <div className="ed-breathing-ring">
            <div className={`ed-breathing-inner ${breatheExpanded ? 'expand' : ''}`} />
            {timerState === 'running' && (
              <span className="ed-breathing-label">
                {breatheExpanded ? 'Breathe out...' : 'Breathe in...'}
              </span>
            )}
          </div>
        </div>

        <div className="ed-timer-display">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>
        <div className="ed-timer-label">
          {timerState === 'idle' && elapsedSec === 0 && `${targetMin} min target`}
          {timerState === 'idle' && elapsedSec > 0 && `${elapsedMins} min completed`}
          {timerState === 'running' && 'remaining'}
          {timerState === 'paused' && 'paused'}
        </div>

        {/* Progress */}
        <div className="ed-progress-bar" style={{ margin: '12px 0' }}>
          <div className="ed-progress-fill" style={{ width: `${progress}%`, background: '#D4AF37' }} />
        </div>

        {/* Timer Controls */}
        <div className="ed-timer-controls">
          {timerState === 'idle' && (
            <button className="ed-timer-btn primary" onClick={startTimer}>
              <Play size={16} /> {elapsedSec > 0 ? 'Resume' : 'Start'}
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
        </div>
      </div>

      {/* Notes */}
      {(event.notes || event.description) && (
        <div className="ed-card">
          <div className="ed-card-header"><Brain size={14} /> {isPrayer ? 'Prayer' : 'Session'} Notes</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
            {(event.notes || event.description || '').replace(/^\[.*?\]\s*/g, '').trim()}
          </p>
        </div>
      )}

      {/* Log Session */}
      <button
        className="ed-action-btn"
        onClick={handleLogSession}
        disabled={logging || logged}
        style={logged ? { background: 'rgba(34,197,94,0.15)', color: '#22C55E', borderColor: 'rgba(34,197,94,0.3)' } : undefined}
      >
        {logged ? (
          <><Check size={16} /> Session Logged!</>
        ) : logging ? (
          <>Logging...</>
        ) : (
          <><Check size={16} /> Log Session</>
        )}
      </button>
    </div>
  );
}
