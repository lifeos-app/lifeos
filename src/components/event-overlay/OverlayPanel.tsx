// ═══ OverlayPanel & supporting UI components ═══

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Minimize2, Maximize2, Check,
  Clock, Dumbbell, BookOpen, Trophy, Target,
  StickyNote, Zap, Wind, AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEventOverlay } from './EventOverlayContext';
import { detectEventType } from './types';
import type { ActiveEvent, OverlayEventType, OverlayTab } from './types';
import {
  WorkoutOverlayBody, ReadingOverlayBody, MealOverlayBody,
  SleepOverlayBody, MeditationOverlayBody, StudyOverlayBody,
  GenericOverlayBody,
} from './ActivityBodies';
import { LogTab, DetailsTab } from './OverlayTabs';

// ═══ Portal Entry ═══
export function EventOverlayPortal() {
  const { overlayState, closeOverlay, toggleMinimize } = useEventOverlay();
  const { activeEvent, isMinimized, isVisible } = overlayState;

  if (!activeEvent) return null;

  const eventType = detectEventType(activeEvent);

  return createPortal(
    <div className={`eo-container ${isVisible ? 'visible' : ''} ${isMinimized ? 'minimized' : ''}`}>
      {isMinimized ? (
        <MinimizedPill event={activeEvent} onMaximize={toggleMinimize} onClose={closeOverlay} />
      ) : (
        <OverlayPanel event={activeEvent} eventType={eventType} onMinimize={toggleMinimize} onClose={closeOverlay} />
      )}
    </div>,
    document.body
  );
}

// ═══ Minimized Pill ═══
function MinimizedPill({ event, onMaximize, onClose }: { event: ActiveEvent; onMaximize: () => void; onClose: () => void }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(event.start_time).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [event.start_time]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div className="eo-pill" onClick={onMaximize}>
      <div className="eo-pill-dot" style={{ background: event.color || '#00D4FF' }} />
      <span className="eo-pill-title">{event.title}</span>
      <span className="eo-pill-timer">{mins}:{String(secs).padStart(2, '0')}</span>
      <button className="eo-pill-btn" onClick={(e) => { e.stopPropagation(); onMaximize(); }}>
        <Maximize2 size={12} />
      </button>
      <button className="eo-pill-btn close" onClick={(e) => { e.stopPropagation(); onClose(); }}>
        <X size={12} />
      </button>
    </div>
  );
}

// ═══ Main Overlay Panel ═══
function OverlayPanel({ event, eventType, onMinimize, onClose }: {
  event: ActiveEvent; eventType: OverlayEventType; onMinimize: () => void; onClose: () => void;
}) {
  const [completed, setCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState<OverlayTab>('activity');

  const handleComplete = async () => {
    setCompleted(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    const durationMin = Math.round((Date.now() - new Date(event.start_time).getTime()) / 60000);

    const xpMap: Record<string, number> = { workout: 50, study: 40, meditation: 35, reading: 30, meal: 15, sleep: 15 };
    const xp = xpMap[eventType] || 20;

    await supabase.from('event_completions').insert({
      user_id: user.user.id,
      schedule_event_id: event.id,
      event_type: eventType,
      duration_min: durationMin,
      xp_awarded: xp,
      metadata: { title: event.title },
    });

    // Dispatch refresh event
    window.dispatchEvent(new Event('lifeos-refresh'));

    setTimeout(() => onClose(), 2000);
  };

  return (
    <div className="eo-panel">
      {/* Header */}
      <div className="eo-header" style={{ '--eo-color': event.color || '#00D4FF' } as any}>
        <div className="eo-header-info">
          <div className="eo-header-icon">
            {eventType === 'workout' && <Dumbbell size={18} />}
            {eventType === 'meal' && <Target size={18} />}
            {eventType === 'sleep' && <Clock size={18} />}
            {eventType === 'meditation' && <Wind size={18} />}
            {eventType === 'study' && <BookOpen size={18} />}
            {eventType === 'reading' && <BookOpen size={18} />}
            {eventType === 'generic' && <Target size={18} />}
          </div>
          <div>
            <h3 className="eo-title">{event.title}</h3>
            <EventTimer startTime={event.start_time} endTime={event.end_time} />
          </div>
        </div>
        <div className="eo-header-actions">
          <button className="eo-btn" onClick={onMinimize} title="Minimize" aria-label="Minimize"><Minimize2 size={14} /></button>
          <button className="eo-btn close" onClick={() => {
            sessionStorage.setItem(`overlay-dismissed-${event.id}`, '1');
            onClose();
          }} title="Close" aria-label="Close"><X size={16} /></button>
        </div>
      </div>

      {/* Tab Bar */}
      {!completed && (
        <div className="eo-tab-bar">
          <button
            className={`eo-tab ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <Zap size={14} /> Activity
          </button>
          <button
            className={`eo-tab ${activeTab === 'log' ? 'active' : ''}`}
            onClick={() => setActiveTab('log')}
          >
            <StickyNote size={14} /> Log
          </button>
          <button
            className={`eo-tab ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            <AlertCircle size={14} /> Details
          </button>
        </div>
      )}

      {/* Body — type-specific */}
      <div className="eo-body">
        {completed ? (
          <CompletedView eventType={eventType} />
        ) : (
          <>
            {activeTab === 'activity' && (
              <>
                {eventType === 'workout' && <WorkoutOverlayBody event={event} />}
                {eventType === 'meal' && <MealOverlayBody event={event} />}
                {eventType === 'sleep' && <SleepOverlayBody event={event} />}
                {eventType === 'meditation' && <MeditationOverlayBody event={event} />}
                {eventType === 'study' && <StudyOverlayBody event={event} />}
                {eventType === 'reading' && <ReadingOverlayBody event={event} />}
                {eventType === 'generic' && <GenericOverlayBody event={event} />}
              </>
            )}
            {activeTab === 'log' && <LogTab event={event} eventType={eventType} />}
            {activeTab === 'details' && <DetailsTab event={event} />}
          </>
        )}
      </div>

      {/* Footer */}
      {!completed && (
        <div className="eo-footer">
          <button className="eo-complete-btn" onClick={handleComplete}>
            <Trophy size={16} /> Complete Event
          </button>
        </div>
      )}
    </div>
  );
}

// ═══ Event Timer ═══
function EventTimer({ startTime, endTime }: { startTime: string; endTime: string }) {
  const [elapsed, setElapsed] = useState(0);
  const totalDuration = useMemo(() =>
    Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000),
    [startTime, endTime]
  );

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const progress = Math.min((elapsed / totalDuration) * 100, 100);
  const remaining = Math.max(0, totalDuration - elapsed);
  const remMins = Math.floor(remaining / 60);
  const remSecs = remaining % 60;

  return (
    <div className="eo-timer">
      <div className="eo-timer-bar">
        <div className="eo-timer-fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="eo-timer-text">
        <Clock size={11} /> {remMins}:{String(remSecs).padStart(2, '0')} remaining
      </span>
    </div>
  );
}

// ═══ Completed View ═══
function CompletedView({ eventType }: { eventType: string }) {
  return (
    <div className="eo-completed">
      <div className="eo-completed-icon">
        <Trophy size={40} />
      </div>
      <h3>Event Complete!</h3>
      <div className="eo-xp-badge">
        <Zap size={14} /> +{({ workout: 50, study: 40, meditation: 35, reading: 30, meal: 15, sleep: 15 } as Record<string, number>)[eventType] || 20} XP
      </div>
      <p>Great job — logged to your activity feed.</p>
    </div>
  );
}
