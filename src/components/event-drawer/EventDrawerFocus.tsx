// ═══ EventDrawer Focus Mode — Fullscreen Activity UI ═══
// Detects event type, renders appropriate ActivityBodies component,
// shows timer, and provides minimize/complete/extend controls.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Minimize2, Check, Clock,
  Dumbbell, BookOpen, Moon, Brain, GraduationCap, Zap,
} from 'lucide-react';
import { detectEventType, type ActiveEvent, type OverlayEventType } from '../event-overlay/types';
import {
  WorkoutOverlayBody,
  ReadingOverlayBody,
  MealOverlayBody,
  SleepOverlayBody,
  MeditationOverlayBody,
  StudyOverlayBody,
  GenericOverlayBody,
} from '../event-overlay/ActivityBodies';
import { FocusAutoComplete } from './FocusAutoComplete';

interface EventDrawerFocusProps {
  event: ActiveEvent;
  onMinimize: () => void;
  onComplete: () => void;
  onClose: () => void;
}

const TYPE_META: Record<OverlayEventType, { icon: React.ReactNode; label: string; color: string }> = {
  workout:    { icon: <Dumbbell size={16} />,      label: 'Workout',    color: '#22C55E' },
  reading:    { icon: <BookOpen size={16} />,       label: 'Reading',    color: '#3B82F6' },
  meal:       { icon: <Zap size={16} />,            label: 'Meal',       color: '#F97316' },
  sleep:      { icon: <Moon size={16} />,           label: 'Sleep',      color: '#818CF8' },
  meditation: { icon: <Brain size={16} />,          label: 'Meditation', color: '#D4AF37' },
  study:      { icon: <GraduationCap size={16} />,  label: 'Study',      color: '#A855F7' },
  generic:    { icon: <Zap size={16} />,            label: 'Focus',      color: '#00D4FF' },
};

export function EventDrawerFocus({ event, onMinimize, onComplete, onClose }: EventDrawerFocusProps) {
  const eventType = detectEventType(event);
  const meta = TYPE_META[eventType];

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const [showAutoComplete, setShowAutoComplete] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const durationMs = new Date(event.end_time).getTime() - new Date(event.start_time).getTime();
  const durationMin = Math.round(durationMs / 60000);
  const elapsedSinceStart = Math.max(0, Math.floor((Date.now() - new Date(event.start_time).getTime()) / 1000));

  useEffect(() => {
    setElapsed(elapsedSinceStart);
    intervalRef.current = window.setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [event.id]);

  const remainingSec = Math.max(0, Math.floor(durationMs / 1000) - elapsed);
  const isOvertime = remainingSec <= 0;

  // Show auto-complete when time's up
  useEffect(() => {
    if (isOvertime && !showAutoComplete) {
      setShowAutoComplete(true);
    }
  }, [isOvertime]);

  const handleExtend = useCallback((minutes: number) => {
    // Extend by adding minutes to the remaining calc
    setElapsed(prev => prev - minutes * 60);
    setShowAutoComplete(false);
  }, []);

  const handleKeepGoing = useCallback(() => {
    setShowAutoComplete(false);
  }, []);

  const fmtTimer = (secs: number) => {
    const m = Math.floor(Math.abs(secs) / 60);
    const s = Math.abs(secs) % 60;
    return `${isOvertime ? '+' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const progress = Math.min(100, (elapsed / Math.max(1, durationMs / 1000)) * 100);

  return (
    <div className="edf-root">
      {/* Header */}
      <div className="edf-header">
        <div className="edf-header-type" style={{ color: meta.color }}>
          {meta.icon}
          <span>{meta.label}</span>
        </div>
        <h2 className="edf-header-title">{event.title}</h2>
        <div className="edf-header-actions">
          <button className="edf-icon-btn" onClick={onMinimize} title="Minimize">
            <Minimize2 size={16} />
          </button>
          <button className="edf-icon-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Timer Bar */}
      <div className="edf-timer-section">
        <div className="edf-timer-display" style={{ color: isOvertime ? '#EF4444' : meta.color }}>
          <Clock size={14} />
          <span className="edf-timer-value">{isOvertime ? fmtTimer(elapsed - Math.floor(durationMs / 1000)) : fmtTimer(remainingSec)}</span>
          <span className="edf-timer-label">{isOvertime ? 'overtime' : 'remaining'}</span>
        </div>
        <div className="edf-progress-bar">
          <div
            className="edf-progress-fill"
            style={{ width: `${Math.min(100, progress)}%`, background: isOvertime ? '#EF4444' : meta.color }}
          />
        </div>
        <div className="edf-timer-meta">
          <span>{durationMin} min session</span>
          <span>{Math.floor(elapsed / 60)} min elapsed</span>
        </div>
      </div>

      {/* Activity Body */}
      <div className="edf-activity-body">
        {eventType === 'workout' && <WorkoutOverlayBody event={event} />}
        {eventType === 'reading' && <ReadingOverlayBody event={event} />}
        {eventType === 'meal' && <MealOverlayBody event={event} />}
        {eventType === 'sleep' && <SleepOverlayBody event={event} />}
        {eventType === 'meditation' && <MeditationOverlayBody event={event} />}
        {eventType === 'study' && <StudyOverlayBody event={event} />}
        {eventType === 'generic' && <GenericOverlayBody event={event} />}
      </div>

      {/* Complete Button */}
      <div className="edf-footer">
        <button className="edf-complete-btn" onClick={onComplete} style={{ borderColor: meta.color, color: meta.color }}>
          <Check size={16} /> Complete Session
        </button>
      </div>

      {/* Auto-complete overlay */}
      {showAutoComplete && (
        <FocusAutoComplete
          event={event}
          onComplete={onComplete}
          onExtend={handleExtend}
          onKeepGoing={handleKeepGoing}
          color={meta.color}
        />
      )}
    </div>
  );
}
