// ═══════════════════════════════════════════════════════════
// EventDrawerHandle v4 — Draggable Right-Edge Tab
// Wider, context-aware icons, vertical drag to reposition
// Constrained: 40% – 85% of viewport (avoids AI widget at top)
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Clock, Activity, Dumbbell, BookOpen, Coffee, Moon, Briefcase, Target,
  Zap, ChevronLeft, Flame, Sparkles, Shield,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import type { CurrentEventState } from '../hooks/useCurrentEvent';
import { useLiveActivityStore } from '../stores/useLiveActivityStore';
import { usePrayerTimes } from '../hooks/usePrayerTimes';
import { useCharacterAppearanceStore } from '../stores/useCharacterAppearanceStore';
import { getUIState, setUIState } from '../utils/ui-state';

interface EventDrawerHandleProps {
  state: CurrentEventState;
  onOpen: () => void;
  drawerMode: 'daily' | 'sacred';
  onToggleMode: () => void;
  isDrawerOpen: boolean;
  isRealmActive?: boolean;
}

// Vertical position constraints (% of viewport)
const MIN_Y_PCT = 15;  // Below header + 20px buffer
const MAX_Y_PCT = 62;  // Stop above voice button + AI FAB area
const DEFAULT_Y_PCT = 50;
const STORAGE_KEY = 'ed-handle-y-pct';
const DRAG_THRESHOLD_Y = 8;  // px before vertical drag activates
const DRAG_THRESHOLD_X = 20; // px before horizontal drag-to-open activates

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

function getEventIcon(category?: string, eventType?: string, title?: string, size = 14) {
  const t = (eventType || category || '').toLowerCase();
  const ti = (title || '').toLowerCase();
  if (t === 'health' || ti.includes('gym') || ti.includes('workout') || ti.includes('exercise')) return <Dumbbell size={size} />;
  if (ti.includes('read') || ti.includes('book') || ti.includes('bible') || ti.includes('study')) return <BookOpen size={size} />;
  if (t === 'work' || ti.includes('clean') || ti.includes('security')) return <Briefcase size={size} />;
  if (ti.includes('sleep') || ti.includes('bed')) return <Moon size={size} />;
  if (ti.includes('coffee') || ti.includes('break')) return <Coffee size={size} />;
  return <Activity size={size} />;
}

export function EventDrawerHandle({ state, onOpen, drawerMode, onToggleMode, isDrawerOpen, isRealmActive }: EventDrawerHandleProps) {
  const { currentEvent, nextEvent, timeRemaining, minutesToNext, approaching } = state;
  const liveEvent = useLiveActivityStore(s => s.activeEvent);
  const { pathname } = useLocation();
  const isSchedulePage = pathname === '/' || pathname.startsWith('/schedule') || pathname.startsWith('/dashboard');
  const [pulseKey, setPulseKey] = useState(0);
  const { nextPrayer } = usePrayerTimes();

  // ── Prayer proximity: glow the toggle when prayer is within 15 minutes ──
  const prayerProximity = useMemo(() => {
    if (!nextPrayer) return { isNear: false, isNow: false, minutesAway: Infinity };
    const now = new Date();
    const diffMin = Math.round((nextPrayer.time.getTime() - now.getTime()) / 60000);
    return {
      isNear: diffMin > 0 && diffMin <= 15,
      isNow: diffMin >= -5 && diffMin <= 2, // prayer is happening right now (±5min)
      minutesAway: diffMin,
      name: nextPrayer.name,
    };
  }, [nextPrayer]);

  // ── Discovery hint: show once for new users, then fade away ──
  const [showDiscovery, setShowDiscovery] = useState(() => {
    return !getUIState('event_drawer_discovered');
  });

  // Auto-dismiss discovery after 8 seconds or on toggle use
  useEffect(() => {
    if (!showDiscovery) return;
    const timer = setTimeout(() => {
      setShowDiscovery(false);
      setUIState('event_drawer_discovered');
    }, 8000);
    return () => clearTimeout(timer);
  }, [showDiscovery]);

  const handleToggleMode = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleMode();
    // Mark as discovered
    if (showDiscovery) {
      setShowDiscovery(false);
      setUIState('event_drawer_discovered');
    }
  }, [onToggleMode, showDiscovery]);

  // ── Vertical position (persisted) ──
  const [yPct, setYPct] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const val = parseFloat(stored);
        if (val >= MIN_Y_PCT && val <= MAX_Y_PCT) return val;
      }
    } catch { /* ignore */ }
    return DEFAULT_Y_PCT;
  });

  // ── Drag state ──
  const handleRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    mode: 'none' | 'vertical' | 'horizontal';
    startX: number;
    startY: number;
    startPct: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Retrigger dot pulse when event changes
  useEffect(() => {
    setPulseKey(k => k + 1);
  }, [currentEvent?.id, liveEvent?.id]);

  // ── Touch drag handlers ──
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Prevent browser pull-to-refresh from hijacking handle drags
    e.preventDefault();
    const touch = e.touches[0];
    dragState.current = {
      mode: 'none',
      startX: touch.clientX,
      startY: touch.clientY,
      startPct: yPct,
    };
  }, [yPct]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragState.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragState.current.startX;
    const deltaY = touch.clientY - dragState.current.startY;

    // Determine drag mode on first significant movement
    if (dragState.current.mode === 'none') {
      if (Math.abs(deltaX) > DRAG_THRESHOLD_X && deltaX < 0 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        // Dragging LEFT → open drawer
        dragState.current.mode = 'horizontal';
      } else if (Math.abs(deltaY) > DRAG_THRESHOLD_Y && Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
        // Dragging vertically → reposition
        dragState.current.mode = 'vertical';
        setIsDragging(true);
      }
    }

    if (dragState.current.mode === 'vertical') {
      e.preventDefault();
      const vh = window.innerHeight;
      const deltaPct = (deltaY / vh) * 100;
      const newPct = Math.min(MAX_Y_PCT, Math.max(MIN_Y_PCT, dragState.current.startPct + deltaPct));
      setYPct(newPct);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!dragState.current) return;
    const mode = dragState.current.mode;

    if (mode === 'vertical') {
      // Save position
      try { localStorage.setItem(STORAGE_KEY, yPct.toString()); } catch { /* ignore */ }
    } else if (mode === 'horizontal') {
      // Horizontal swipe left → open
      onOpen();
    } else {
      // No significant movement → tap to open
      onOpen();
    }
    dragState.current = null;
    setIsDragging(false);
  }, [yPct, onOpen]);

  // ── Mouse drag handlers (desktop) ──
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = {
      mode: 'none',
      startX: e.clientX,
      startY: e.clientY,
      startPct: yPct,
    };

    const onMouseMove = (me: MouseEvent) => {
      if (!dragState.current) return;
      const deltaX = me.clientX - dragState.current.startX;
      const deltaY = me.clientY - dragState.current.startY;

      if (dragState.current.mode === 'none') {
        if (Math.abs(deltaX) > DRAG_THRESHOLD_X && deltaX < 0 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
          dragState.current.mode = 'horizontal';
        } else if (Math.abs(deltaY) > DRAG_THRESHOLD_Y && Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
          dragState.current.mode = 'vertical';
          setIsDragging(true);
        }
      }

      if (dragState.current.mode === 'vertical') {
        const vh = window.innerHeight;
        const deltaPct = (deltaY / vh) * 100;
        const newPct = Math.min(MAX_Y_PCT, Math.max(MIN_Y_PCT, dragState.current.startPct + deltaPct));
        setYPct(newPct);
      }
    };

    const onMouseUp = () => {
      if (!dragState.current) return;
      const mode = dragState.current.mode;

      if (mode === 'vertical') {
        try { localStorage.setItem(STORAGE_KEY, yPct.toString()); } catch { /* ignore */ }
      } else if (mode === 'horizontal') {
        onOpen();
      } else {
        onOpen();
      }
      dragState.current = null;
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [yPct, onOpen]);

  // Determine dot color, labels, icon
  let dotColor = 'rgba(100, 116, 139, 0.7)';
  let label = '';
  let subLabel = '';
  let icon = drawerMode === 'daily' ? <Zap size={14} /> : <Flame size={14} />;

  // Effective active event: scheduled event takes priority, then live activity
  const effectiveEvent = currentEvent || liveEvent;
  const isLiveOnly = !currentEvent && !!liveEvent;

  // ── Realm mode overrides ──
  if (isRealmActive) {
    const charStore = useCharacterAppearanceStore.getState();
    dotColor = '#FFD700';
    icon = <Shield size={14} />;
    label = charStore.name || 'Hero';
    subLabel = `Lv.${charStore.level || 1}`;
  } else if (effectiveEvent) {
    const evTitle = effectiveEvent.title || 'Activity';
    const evCategory = effectiveEvent.category || effectiveEvent.event_type;
    dotColor = effectiveEvent.color || (drawerMode === 'sacred' ? '#D4A017' : '#39FF14');
    icon = getEventIcon(evCategory, effectiveEvent.event_type, evTitle, 14);
    label = evTitle.length > 13 ? evTitle.slice(0, 12) + '…' : evTitle;
    if (isLiveOnly) {
      // Live activity — show elapsed time
      const elapsedMs = Date.now() - new Date(effectiveEvent.start_time).getTime();
      const elapsedMin = Math.max(0, Math.floor(elapsedMs / 60000));
      subLabel = formatMinutes(elapsedMin);
    } else if (timeRemaining !== null) {
      subLabel = formatMinutes(timeRemaining);
    }
  } else if (approaching && nextEvent) {
    dotColor = nextEvent.color || (drawerMode === 'sacred' ? '#D4A017' : '#FACC15');
    icon = getEventIcon(nextEvent.category, nextEvent.event_type, nextEvent.title, 14);
    label = `In ${minutesToNext}m`;
    subLabel = nextEvent.title.length > 10 ? nextEvent.title.slice(0, 9) + '…' : nextEvent.title;
  } else if (nextEvent) {
    dotColor = 'rgba(100, 116, 139, 0.55)';
    icon = <Clock size={14} />;
    label = 'Free';
    const freeUntil = state.freeUntil;
    if (minutesToNext !== null && minutesToNext < 480 && freeUntil) {
      subLabel = formatTime(freeUntil);
    }
  } else {
    icon = <Target size={14} />;
    label = 'Free';
    subLabel = drawerMode === 'sacred' ? 'In grace' : 'No events';
  }

  return (
    <div
      ref={handleRef}
      className={`ed-handle${isDragging ? ' ed-handle--dragging' : ''}${drawerMode === 'sacred' ? ' ed-handle--sacred' : ''}${isDrawerOpen ? ' ed-handle--drawer-open' : ''}`}
      style={{ top: `${yPct}%` }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      role="button"
      tabIndex={0}
      aria-label="Open event drawer"
      title={currentEvent ? `Active: ${currentEvent.title}` : 'Open mission control'}
    >
      {/* ── Chevron pull hint ── */}
      <span className="ed-handle-chevron">
        <ChevronLeft size={12} />
      </span>

      {/* ── Status dot (pulses when active) ── */}
      <span
        className={`ed-handle-dot${effectiveEvent ? ' active' : approaching ? ' approaching' : ''}`}
        key={pulseKey}
        style={{
          background: dotColor,
          '--dot-color': dotColor,
        } as React.CSSProperties}
      />

      {/* ── Icon (context-aware) ── */}
      <span className="ed-handle-icon" style={{ color: dotColor }}>{icon}</span>

      {/* ── Labels (vertical) ── */}
      {(isSchedulePage || effectiveEvent) && (
        <div className="ed-handle-labels">
          {label && <span className="ed-handle-label">{label}</span>}
          {subLabel && <span className="ed-handle-sublabel">{subLabel}</span>}
        </div>
      )}

      {/* ── Progress arc for active event ── */}
      {effectiveEvent && (
        <svg className="ed-handle-arc" width="10" height="50" viewBox="0 0 10 50">
          <rect x="2" y="0" width="6" height="50" rx="3" fill="rgba(255,255,255,0.06)" />
          <rect
            x="2"
            y={50 - (state.progress / 100) * 50}
            width="6"
            height={(state.progress / 100) * 50}
            rx="3"
            fill={dotColor}
            opacity="0.85"
            style={{ transition: 'height 1s linear, y 1s linear' }}
          />
        </svg>
      )}

      {/* ── Mode toggle button — glows near prayer time, hidden in Realm ── */}
      {!isRealmActive && <div className="ed-handle-toggle-wrap">
        {showDiscovery && (
          <span className="ed-handle-discovery">
            tap to switch
          </span>
        )}
        <button
          className={`ed-handle-toggle${prayerProximity.isNow ? ' ed-handle-toggle--holy' : prayerProximity.isNear ? ' ed-handle-toggle--approaching' : ''}`}
          onClick={handleToggleMode}
          onTouchEnd={(e) => {
            e.stopPropagation();
          }}
          title={drawerMode === 'daily' ? 'Switch to Sacred mode' : 'Switch to Daily mode'}
          aria-label={drawerMode === 'daily' ? 'Switch to Sacred mode' : 'Switch to Daily mode'}
        >
          {drawerMode === 'daily' ? (
            <>
              <Zap size={9} />
              <span className="ed-handle-toggle-arrow">↔</span>
              <Flame size={9} className={prayerProximity.isNear || prayerProximity.isNow ? 'ed-flame-glow' : ''} />
            </>
          ) : (
            <>
              <Flame size={9} className={prayerProximity.isNear || prayerProximity.isNow ? 'ed-flame-glow' : ''} />
              <span className="ed-handle-toggle-arrow">↔</span>
              <Zap size={9} />
            </>
          )}
        </button>
      </div>}
    </div>
  );
}
