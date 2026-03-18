// ═══════════════════════════════════════════════════════════
// EventDrawer v4 — Tabbed Mission Control Side Panel
// 3 tabs when active event: ⏱ NOW | 📋 DETAILS | 🔮 CONTEXT
// Falls back to single-view when free/approaching
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Zap,
  ChevronRight, Timer, BarChart3, CalendarDays,
  Flame, Plus,
  Eye, TreePine, Calendar, Shield,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCurrentEvent, type ScheduleEvent } from '../hooks/useCurrentEvent';
import { useSmartSuggestions } from '../hooks/useSmartSuggestions';
import { useGamificationContext } from '../lib/gamification/context';
import { EventDrawerHandle } from './EventDrawerHandle';
import { LiveActivityCard } from './LiveActivityCard';
import { EventExpiryNudge } from './EventExpiryNudge';
import { TravelDetailPanel } from './TravelDetailPanel';
import { useEventOverlay } from './EventOverlay';
import { showToast } from './Toast';
import { useLiveActivityStore } from '../stores/useLiveActivityStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useUserStore } from '../stores/useUserStore';
import { createScheduleEvent } from '../lib/schedule-events';
import './EventDrawer.css';
import '../pages/Junction.css';
import { logger } from '../utils/logger';

// ═══ Extracted sub-modules ═══
import type { TabId } from './event-drawer/helpers';
import { useWeeklyStats, useDailyPulse } from './event-drawer/hooks';
import { NowCard, FreeCard, ApproachingCard, CompletedView } from './event-drawer/EventDrawerCards';
import { DetailsTab } from './event-drawer/DetailsTab';
import { DailyPulseStrip, InlineEventDetail, QuickAddForm, MiniTimeline } from './event-drawer/EventDrawerWidgets';
import { SacredNowTab, JourneyTab } from './event-drawer/SacredTab';
import { EventDrawerFocus } from './event-drawer/EventDrawerFocus';
import { RealmDrawerContent } from './event-drawer/RealmDrawerContent';
import type { ActiveEvent } from './event-overlay/types';

// ═══ Main EventDrawer Component ═══
export function EventDrawer() {
  const user = useUserStore(s => s.user);
  const [isOpen, setIsOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState<string | null>(null);
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState<ScheduleEvent | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('now');
  // ── Focus mode state ──
  const [focusMode, setFocusMode] = useState(false);
  const [focusEvent, setFocusEvent] = useState<ActiveEvent | null>(null);

  const [drawerMode, setDrawerMode] = useState<'daily' | 'sacred'>(() => {
    try {
      const stored = localStorage.getItem('lifeos-drawer-mode');
      return (stored === 'sacred' ? 'sacred' : 'daily');
    } catch {
      return 'daily';
    }
  });
  // ── Realm mode detection ──
  const [isRealmActive, setIsRealmActive] = useState(false);
  useEffect(() => {
    const check = () => setIsRealmActive(document.body.classList.contains('realm-active'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Persist completed prayers to localStorage (keyed by date)
  const [completedPrayers, setCompletedPrayers] = useState<Set<string>>(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const saved = localStorage.getItem(`lifeos-prayers-${today}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const drawerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const navigate = useNavigate();

  // Try gamification context, fall back gracefully
  let gamification: any = null;
  try { gamification = useGamificationContext(); } catch { /* not in provider */ }

  const { setDrawerOpen } = useEventOverlay();

  const state = useCurrentEvent();
  const { currentEvent, nextEvent, expiredEvent, timeRemaining, progress, freeUntil, approaching, minutesToNext, todayEvents } = state;

  // Get live event from store
  const liveEvent = useLiveActivityStore(s => s.activeEvent);

  const isFree = !currentEvent && !liveEvent;
  const { suggestions } = useSmartSuggestions(isFree && isOpen);
  const { pulse, loading: pulseLoading } = useDailyPulse(isOpen);

  // Weekly stats for DETAILS tab
  const weeklyStats = useWeeklyStats(currentEvent, isOpen && !!currentEvent);

  // Always show tabs
  const showTabs = true;

  // Reset to NOW tab when event changes or goes away
  useEffect(() => {
    if (!currentEvent) {
      setActiveTab('now');
    }
  }, [currentEvent?.id]);

  // When tapping a timeline event, switch to details tab
  const handleTimelineEventTap = useCallback((event: ScheduleEvent) => {
    if (currentEvent && event.id === currentEvent.id) {
      // Tapping current event → switch to details tab
      setActiveTab('details');
    } else {
      // Tapping different event → show inline detail overlay
      setSelectedTimelineEvent(event);
    }
  }, [currentEvent]);

  // Sync drawer open state to overlay context
  useEffect(() => {
    setDrawerOpen(isOpen);
  }, [isOpen, setDrawerOpen]);

  // Auto-open drawer when a current event starts
  useEffect(() => {
    if (!currentEvent) return;
    const dismissed = sessionStorage.getItem(`drawer-dismissed-${currentEvent.id}`);
    if (dismissed) return;
    setIsOpen(true);
    sessionStorage.setItem(`drawer-dismissed-${currentEvent.id}`, '1');
  }, [currentEvent]);

  // ── Swipe to close ──
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (dx > 60 && Math.abs(dx) > Math.abs(dy)) setIsOpen(false);
    touchStartX.current = null;
    touchStartY.current = null;
  }, []);

  // ── Keyboard close ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedTimelineEvent) setSelectedTimelineEvent(null);
        else setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedTimelineEvent]);

  // ── Listen for focus mode custom event ──
  useEffect(() => {
    const handler = (e: Event) => {
      const event = (e as CustomEvent).detail as ActiveEvent;
      if (event) {
        setFocusEvent(event);
        setFocusMode(true);
        setIsOpen(true);
        // Auto-start live activity
        const liveStore = useLiveActivityStore.getState();
        if (!liveStore.activeEvent) {
          liveStore.startActivity(event.title, event.event_type || 'focus', event.start_time);
        }
      }
    };
    window.addEventListener('lifeos-focus-event', handler);
    return () => window.removeEventListener('lifeos-focus-event', handler);
  }, []);

  // ── Body scroll lock ──
  useEffect(() => {
    document.body.style.overflow = (isOpen || focusMode) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, focusMode]);

  // ── Complete event ──
  const handleComplete = async () => {
    if (!currentEvent) return;
    // Prevent double-completion
    if (currentEvent.status === 'completed' || completed === currentEvent.id) return;
    setCompleting(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (user?.user) {
        const now = new Date().toISOString();
        const durationMin = Math.round(
          (Date.now() - new Date(currentEvent.start_time).getTime()) / 60000
        );

        // ── CRITICAL: Mark event as completed in DB ──
        // This prevents re-pickup by hydrate and stops the slider showing it
        const { error: updateError } = await supabase.from('schedule_events').update({
          status: 'completed',
          is_live: false,
          end_time: now,
          updated_at: now,
        }).eq('id', currentEvent.id);

        if (updateError) {
          logger.error('Failed to mark event completed:', updateError.message);
          showToast('Failed to complete event', 'error');
          setCompleting(false);
          return;
        }

        // Optimistic local update — shrink the block immediately
        const scheduleStore = useScheduleStore.getState();
        const updatedEvents = scheduleStore.events.map(e =>
          e.id === currentEvent.id
            ? { ...e, status: 'completed' as const, is_live: false, end_time: now, updated_at: now }
            : e
        );
        useScheduleStore.setState({ events: updatedEvents });

        // Stop live activity store if this is the active live event
        const liveStore = useLiveActivityStore.getState();
        if (liveStore.activeEvent?.id === currentEvent.id) {
          await liveStore.stopActivity(now);
        }

        // XP Anti-Abuse Guards
        let xpAwarded = 0;
        let xpMessage = '';

        // Guard 1: Minimum duration (5 minutes)
        if (durationMin < 5) {
          logger.log(`⚠️ XP denied: event too short (${durationMin}min, need 5min minimum)`);
          xpMessage = 'Event completed (no XP: minimum 5min required)';
        } else {
          // Guard 2: Rate limiting - check recent completions
          const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
          const { data: recentCompletions } = await supabase
            .from('event_completions')
            .select('id, xp_awarded')
            .eq('user_id', user.user.id)
            .gte('completed_at', oneHourAgo);

          const recentXP = (recentCompletions || []).reduce((sum, c) => sum + (c.xp_awarded || 0), 0);
          const recentCount = (recentCompletions || []).length;

          // Guard 3: Max 200 XP per hour, max 10 completions per hour
          if (recentXP >= 200) {
            logger.log(`⚠️ XP denied: hourly XP cap reached (${recentXP}/200)`);
            xpMessage = 'Event completed (no XP: hourly cap reached)';
          } else if (recentCount >= 10) {
            logger.log(`⚠️ XP denied: hourly completion cap reached (${recentCount}/10)`);
            xpMessage = 'Event completed (no XP: hourly completion limit)';
          } else {
            // Guard 4: Cap XP to remaining hourly budget
            const baseXP = 25;
            xpAwarded = Math.min(200 - recentXP, baseXP);
            xpMessage = `Event completed! +${xpAwarded} XP 🏆`;
          }
        }

        // Insert completion record (even if no XP awarded)
        await supabase.from('event_completions').insert({
          user_id: user.user.id,
          schedule_event_id: currentEvent.id,
          event_type: currentEvent.event_type || currentEvent.category || 'generic',
          duration_min: durationMin,
          xp_awarded: xpAwarded,
          metadata: { title: currentEvent.title },
        });

        if (gamification && xpAwarded > 0) {
          try {
            await gamification.awardXP('schedule_event', {
              description: `Completed: ${currentEvent.title}`,
            });
          } catch (xpErr) {
            logger.warn('XP award error (non-fatal):', xpErr);
          }
        }
        window.dispatchEvent(new Event('lifeos-refresh'));
        setCompleted(currentEvent.id);
        showToast(xpMessage, xpAwarded > 0 ? 'success' : 'info');
        setTimeout(() => { setCompleted(null); setIsOpen(false); }, 2000);
      }
    } catch (e) {
      logger.warn('EventDrawer complete error:', e);
      showToast('Failed to complete event', 'error');
    } finally {
      setCompleting(false);
    }
  };

  const handleSuggestionTap = (target?: string) => {
    if (target) { navigate(target); setIsOpen(false); }
  };

  const handleQuickAddEvent = async (title: string, startTime: string, duration: number) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;
      const start = new Date(startTime);
      const end = new Date(start.getTime() + duration * 60000);
      await createScheduleEvent(supabase, {
        userId: user.user.id,
        title: title.trim(),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });
      showToast('Event created!', 'success');
      setShowQuickAdd(false);
      state.refresh();
      window.dispatchEvent(new Event('lifeos-refresh'));
    } catch (e) {
      logger.warn('Quick add error:', e);
      showToast('Failed to create event', 'error');
    }
  };

  const handlePulseNav = useCallback((path: string) => {
    navigate(path);
    setIsOpen(false);
  }, [navigate]);

  // ── Focus mode handlers ──
  const handleFocusComplete = useCallback(async () => {
    setFocusMode(false);
    setFocusEvent(null);
    // Stop live activity if running
    const liveStore = useLiveActivityStore.getState();
    if (liveStore.activeEvent) {
      await liveStore.stopActivity();
    }
    // Complete the current event if it matches
    if (currentEvent) {
      await handleComplete();
    } else {
      showToast('Session completed!', 'success');
      window.dispatchEvent(new Event('lifeos-refresh'));
    }
  }, [currentEvent]);

  const handleFocusMinimize = useCallback(() => {
    setFocusMode(false);
    // Keep drawer open in compact mode, live activity keeps running
    setIsOpen(true);
  }, []);

  const handleFocusClose = useCallback(() => {
    setFocusMode(false);
    setFocusEvent(null);
    setIsOpen(false);
  }, []);

  const toggleMode = useCallback(() => {
    const next = drawerMode === 'daily' ? 'sacred' : 'daily';
    setDrawerMode(next);
    try {
      localStorage.setItem('lifeos-drawer-mode', next);
    } catch { /* ignore */ }
  }, [drawerMode]);

  // ── Focus mode fullscreen ──
  if (focusMode && focusEvent) {
    return (
      <div className="edf-portal">
        <EventDrawerFocus
          event={focusEvent}
          onMinimize={handleFocusMinimize}
          onComplete={handleFocusComplete}
          onClose={handleFocusClose}
        />
      </div>
    );
  }

  return (
    <>
      {/* ── Edge Handle ── */}
      <EventDrawerHandle
        state={state}
        onOpen={() => setIsOpen(true)}
        drawerMode={drawerMode}
        onToggleMode={toggleMode}
        isDrawerOpen={isOpen}
        isRealmActive={isRealmActive}
      />

      {/* ── Scrim ── */}
      {isOpen && (
        <div className="ed-scrim" onClick={() => setIsOpen(false)} aria-hidden="true" />
      )}

      {/* ── Drawer Panel ── */}
      {isOpen && (
      <div
        ref={drawerRef}
        className={`ed-drawer ${isOpen ? 'ed-drawer--open' : ''} ${isRealmActive ? 'ed-drawer--realm' : drawerMode === 'sacred' ? 'ed-drawer--sacred' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-label={isRealmActive ? 'Realm Command Panel' : drawerMode === 'sacred' ? 'The Junction' : 'Mission Control panel'}
        aria-modal="true"
      >
        {isRealmActive ? (
          <>
            {/* ── Realm Header ── */}
            <div className="ed-header realm-cmd-header">
              <div className="ed-header-left">
                <span className="ed-header-icon"><Shield size={13} /></span>
                <span className="ed-header-title">Command Panel</span>
              </div>
              <button className="ed-close-btn" onClick={() => setIsOpen(false)} aria-label="Close">
                <X size={15} />
              </button>
            </div>
            <RealmDrawerContent onClose={() => setIsOpen(false)} />
          </>
        ) : (
        <>
        {/* ── Header ── */}
        <div className="ed-header">
          <div className="ed-header-left">
            <span className="ed-header-icon">{drawerMode === 'daily' ? <Zap size={13} /> : <Flame size={13} />}</span>
            <span className="ed-header-title">{drawerMode === 'daily' ? 'Mission Control' : 'The Junction'}</span>
          </div>
          <button className="ed-close-btn" onClick={() => setIsOpen(false)} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        {/* ── Tab Bar ── */}
        {showTabs && (
          <div className="ed-tab-bar">
            <button
              className={`ed-tab ${activeTab === 'now' ? 'ed-tab--active' : ''}`}
              onClick={() => setActiveTab('now')}
            >
              {drawerMode === 'daily' ? <Timer size={13} /> : <Flame size={13} />}
              <span>Now</span>
            </button>
            <button
              className={`ed-tab ${activeTab === 'details' ? 'ed-tab--active' : ''}`}
              onClick={() => setActiveTab('details')}
            >
              {drawerMode === 'daily' ? <Eye size={13} /> : <TreePine size={13} />}
              <span>{drawerMode === 'daily' ? 'Details' : 'Journey'}</span>
            </button>
          </div>
        )}

        {/* ── Live Activity Card (always visible at top when live) ── */}
        <LiveActivityCard />

        {/* ── Expiry Nudge: "Still going?" when event just ended ── */}
        {expiredEvent && !liveEvent && (
          <EventExpiryNudge
            event={expiredEvent}
            onDismiss={() => {}}
            onRefresh={state.refresh}
          />
        )}

        {/* ── Tab Content ── */}
        <div className="ed-tab-content">
          {/* === TAB: NOW === */}
          {activeTab === 'now' && (
            <div className="ed-segments ed-tab-panel ed-tab-panel--active">
              {drawerMode === 'sacred' ? (
                <SacredNowTab completedPrayers={completedPrayers} onTogglePrayer={(id) => {
                  setCompletedPrayers(prev => {
                    const next = new Set(prev);
                    const wasCompleted = next.has(id);
                    if (wasCompleted) next.delete(id);
                    else next.add(id);
                    // Persist to localStorage
                    try {
                      const today = new Date().toISOString().slice(0, 10);
                      localStorage.setItem(`lifeos-prayers-${today}`, JSON.stringify([...next]));
                    } catch {}
                    // Log completion to Supabase (fire-and-forget)
                    if (!wasCompleted && user?.id) {
                      const today = new Date().toISOString().slice(0, 10);
                      supabase.from('user_junction_log').insert({
                        user_id: user.id,
                        practice_id: id,
                        tradition_id: null, // filled by trigger or we could get it
                        date: today,
                        duration_min: 15,
                        xp_earned: 10,
                        notes: 'Prayer completed via Sacred mode',
                      }).then(({ error }) => {
                        if (error) logger.warn('[Sacred] Log prayer error:', error.message);
                      });
                      // Also increment junction XP
                      supabase.from('user_junction')
                        .select('junction_xp')
                        .eq('user_id', user.id)
                        .maybeSingle()
                        .then(({ data }) => {
                          if (data) {
                            supabase.from('user_junction')
                              .update({ junction_xp: (data.junction_xp || 0) + 10 })
                              .eq('user_id', user.id)
                              .then(() => {});
                          }
                        });
                    }
                    return next;
                  });
                }} />
              ) : (
                <>
                  <div className="ed-seg-now">
                    <div className="ed-seg-label">
                      <Timer size={11} />
                      <span>NOW</span>
                    </div>
                    {completed ? (
                      <CompletedView />
                    ) : currentEvent ? (
                      <NowCard
                        event={currentEvent}
                        timeRemaining={timeRemaining}
                        progress={progress}
                        completing={completing}
                        onComplete={handleComplete}
                        onTitleTap={() => setActiveTab('details')}
                      />
                    ) : approaching && nextEvent ? (
                      <ApproachingCard
                        event={nextEvent}
                        minutesToNext={minutesToNext}
                        suggestions={suggestions}
                        onSuggestionTap={handleSuggestionTap}
                      />
                    ) : (
                      <FreeCard
                        freeUntil={freeUntil}
                        nextEvent={nextEvent}
                        suggestions={suggestions}
                        onSuggestionTap={handleSuggestionTap}
                      />
                    )}
                  </div>

                  <div className="ed-divider" />

                  <div className="ed-seg-pulse">
                    <div className="ed-seg-label">
                      <BarChart3 size={11} />
                      <span>DAILY PULSE</span>
                    </div>
                    <DailyPulseStrip pulse={pulse} loading={pulseLoading} onNavigate={handlePulseNav} />
                  </div>

                  <div className="ed-divider" />

                  <div className="ed-seg-timeline">
                    <div className="ed-seg-label">
                      <CalendarDays size={11} />
                      <span>TIMELINE</span>
                      <button
                        className="ed-timeline-add-btn"
                        onClick={() => setShowQuickAdd(prev => !prev)}
                        title="Add event"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    {showQuickAdd && (
                      <QuickAddForm
                        onAdd={handleQuickAddEvent}
                        onCancel={() => setShowQuickAdd(false)}
                      />
                    )}
                    <MiniTimeline
                      events={todayEvents}
                      currentEvent={currentEvent}
                      onEventTap={handleTimelineEventTap}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* === TAB: DETAILS / JOURNEY === */}
          {activeTab === 'details' && (
            <div className="ed-tab-panel ed-tab-panel--active">
              {drawerMode === 'sacred' ? (
                <JourneyTab />
              ) : (currentEvent || liveEvent) ? (
                <>
                  {/* Travel Detail Panel — shows map + vehicle when event is travel type */}
                  {(((currentEvent || liveEvent) as ScheduleEvent)?.event_type === 'travel' ||
                    ((currentEvent || liveEvent) as ScheduleEvent)?.metadata?.category === 'travel' ||
                    ((currentEvent || liveEvent) as ScheduleEvent)?.category === 'travel') && (
                    <TravelDetailPanel event={(currentEvent || liveEvent) as ScheduleEvent} />
                  )}
                  <DetailsTab
                    event={(currentEvent || liveEvent) as ScheduleEvent}
                    weeklyStats={weeklyStats}
                    onUpdate={() => state.refresh()}
                  />
                </>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.4)' }}>
                    Select an event from the timeline to view details
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="ed-footer">
          <button
            className="ed-footer-btn"
            onClick={() => { navigate('/schedule'); setIsOpen(false); }}
          >
            <Calendar size={12} />
            Full Schedule
            <ChevronRight size={12} />
          </button>
        </div>

        {/* ── Inline Event Detail for NON-CURRENT timeline events ── */}
        {selectedTimelineEvent && (
          <InlineEventDetail
            event={selectedTimelineEvent}
            onClose={() => setSelectedTimelineEvent(null)}
            onUpdate={() => {
              setSelectedTimelineEvent(null);
              state.refresh();
            }}
          />
        )}
        </>
        )}
      </div>
      )}
    </>
  );
}
