/**
 * useScheduleDragHandlers — Drag/drop, resize, swipe-to-delete, and touch-drag
 * handlers for the Schedule day timeline.
 *
 * All mutableRefs and state for drag interactions are encapsulated here.
 */
import { useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/data-access';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { snap15 } from './utils';
import type { ScheduleEvent } from './types';
import { logger } from '../../utils/logger';

interface UseScheduleDragHandlersArgs {
  events: ScheduleEvent[];
  selectedDate: Date;
  hourH: number;
  showAllHours: boolean;
  effectiveStart: number;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  view: string;
  fetchDayEvents: () => void;
  fetchWeekEvents: () => void;
  fetchMonthEvents: () => void;
  setEvents: React.Dispatch<React.SetStateAction<ScheduleEvent[]>>;
  confirmDelete: (title: string, message: string, action: () => void) => void;
  deleteEvent: (id: string) => void;
}

export function useScheduleDragHandlers({
  events,
  selectedDate,
  hourH,
  showAllHours,
  effectiveStart,
  timelineRef,
  view,
  fetchDayEvents,
  fetchWeekEvents,
  fetchMonthEvents,
  setEvents,
  confirmDelete,
  deleteEvent,
}: UseScheduleDragHandlersArgs) {
  // Desktop HTML5 drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragGhostTop, setDragGhostTop] = useState<number | null>(null);
  const [dropHour, setDropHour] = useState<number | null>(null);

  // Touch drag state (mobile long-press + vertical drag)
  const [touchDragId, setTouchDragId] = useState<string | null>(null);
  const [touchDragTopPx, setTouchDragTopPx] = useState<number | null>(null);
  const touchDragStartY = useRef(0);
  const touchDragOrigTop = useRef(0);
  const touchDragActive = useRef(false);
  const touchDragTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchDragJustEnded = useRef(false);

  // Resize state
  const [resizeId, setResizeId] = useState<string | null>(null);
  const [resizeH, setResizeH] = useState<number | null>(null);
  const resizeStartY = useRef(0);
  const resizeStartH = useRef(0);

  // Swipe-to-delete state
  const [swipeId, setSwipeId] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const swipeThreshold = -80;

  // No-op touch start/end (detail opens on tap, not long-press)
  const handleEventTouchStart = (_ev: ScheduleEvent) => {};
  const handleEventTouchEnd = () => {};

  // ── Helper: convert clientY to minutes ──
  const getMinutesFromY = useCallback((clientY: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const y = clientY - rect.top + timelineRef.current.scrollTop;
    const fh = showAllHours ? 0 : effectiveStart;
    const rawMin = (y / hourH) * 60 + fh * 60;
    return snap15(Math.max(0, Math.min(rawMin, 1439)));
  }, [hourH, showAllHours, effectiveStart]);

  // ── Desktop drag-to-move ──
  const handleDragStart = (e: React.DragEvent, eventId: string) => {
    setDragId(eventId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', eventId);
    const el = e.currentTarget as HTMLElement;
    if (el) {
      const ghost = el.cloneNode(true) as HTMLElement;
      ghost.style.opacity = '0.7';
      ghost.style.position = 'absolute';
      ghost.style.top = '-9999px';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 10);
      setTimeout(() => document.body.removeChild(ghost), 0);
    }
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragGhostTop(null);
    setDropHour(null);
  };

  const handleTimelineDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setDragGhostTop(y);
    const minutes = getMinutesFromY(e.clientY);
    setDropHour(Math.floor(minutes / 60));
  };

  const handleTimelineDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData('text/plain');
    if (!eventId) return;

    const ev = events.find(ev => ev.id === eventId);
    if (!ev) return;

    const newStartMin = getMinutesFromY(e.clientY);
    const oldStart = new Date(ev.start_time);
    const oldEnd = new Date(ev.end_time);
    const durationMs = oldEnd.getTime() - oldStart.getTime();

    const newStart = new Date(selectedDate);
    newStart.setHours(0, 0, 0, 0);
    newStart.setMinutes(newStartMin);
    const newEnd = new Date(newStart.getTime() + durationMs);

    const newStartISO = newStart.toISOString();
    const newEndISO = newEnd.toISOString();

    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, start_time: newStartISO, end_time: newEndISO } : e));
    setDragId(null);
    setDragGhostTop(null);
    setDropHour(null);

    const { error } = await supabase.from('schedule_events').update({
      start_time: newStartISO,
      end_time: newEndISO,
      updated_at: new Date().toISOString(),
    }).eq('id', eventId);

    if (error) {
      logger.error('[Schedule] drop save error:', error);
      fetchDayEvents();
    }
    if (view === 'week') fetchWeekEvents();
    if (view === 'month') fetchMonthEvents();
  };

  // ── Resize handlers (pointer events) ──
  const handleResizeStart = (e: React.PointerEvent, eventId: string, currentHeight: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizeId(eventId);
    resizeStartY.current = e.clientY;
    resizeStartH.current = currentHeight;
    setResizeH(currentHeight);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeId) return;
    const dy = e.clientY - resizeStartY.current;
    const newH = Math.max(hourH / 4, resizeStartH.current + dy);
    setResizeH(newH);
  }, [resizeId, hourH]);

  const handleResizeEnd = useCallback(async (e: React.PointerEvent) => {
    if (!resizeId || resizeH === null) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    const ev = events.find(ev => ev.id === resizeId);
    if (!ev) { setResizeId(null); setResizeH(null); return; }

    const newDurationMin = snap15(Math.max(15, (resizeH / hourH) * 60));
    const start = new Date(ev.start_time);
    const newEnd = new Date(start.getTime() + newDurationMin * 60000);
    const newEndISO = newEnd.toISOString();
    const eventId = resizeId;

    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, end_time: newEndISO } : e));
    setResizeId(null);
    setResizeH(null);

    const { error } = await supabase.from('schedule_events').update({
      end_time: newEndISO,
      updated_at: new Date().toISOString(),
    }).eq('id', eventId);

    if (error) {
      logger.error('[Schedule] resize save error:', error);
      fetchDayEvents();
    }
    if (view === 'week') fetchWeekEvents();
    if (view === 'month') fetchMonthEvents();
  }, [resizeId, resizeH, events, hourH, view, fetchDayEvents, fetchWeekEvents, fetchMonthEvents]);

  // ── Swipe-to-delete / touch-drag handlers ──
  const handleSwipeStart = (e: React.TouchEvent, eventId: string) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    setSwipeId(eventId);
    setSwipeX(0);
    touchDragActive.current = false;

    if (touchDragTimer.current) clearTimeout(touchDragTimer.current);
    touchDragTimer.current = setTimeout(() => {
      touchDragActive.current = true;
      setTouchDragId(eventId);
      const evEl = (e.target as HTMLElement).closest('.stl-event') as HTMLElement;
      if (evEl) {
        touchDragOrigTop.current = parseFloat(evEl.style.top) || 0;
        touchDragStartY.current = swipeStartY.current;
        setTouchDragTopPx(touchDragOrigTop.current);
      }
      if (navigator.vibrate) navigator.vibrate(50);
    }, 800);
  };

  const handleSwipeMove = (e: React.TouchEvent) => {
    if (!swipeId) return;
    const deltaX = e.touches[0].clientX - swipeStartX.current;
    const deltaY = e.touches[0].clientY - swipeStartY.current;

    if (touchDragActive.current && touchDragId) {
      e.preventDefault();
      const dy = e.touches[0].clientY - touchDragStartY.current;
      const newTop = touchDragOrigTop.current + dy;
      setTouchDragTopPx(Math.max(0, newTop));
      return;
    }

    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      if (touchDragTimer.current) {
        clearTimeout(touchDragTimer.current);
        touchDragTimer.current = null;
      }
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault();
      setSwipeX(Math.min(0, deltaX));
    }
  };

  const handleSwipeEnd = async () => {
    if (touchDragTimer.current) {
      clearTimeout(touchDragTimer.current);
      touchDragTimer.current = null;
    }

    if (touchDragActive.current && touchDragId && touchDragTopPx !== null) {
      const ev = events.find(e => e.id === touchDragId);
      if (ev && timelineRef.current) {
        const fh = showAllHours ? 0 : effectiveStart;
        const newStartMin = snap15(Math.max(0, Math.min((touchDragTopPx / hourH) * 60 + fh * 60, 1439)));
        const oldStart = new Date(ev.start_time);
        const oldEnd = new Date(ev.end_time);
        const durationMs = oldEnd.getTime() - oldStart.getTime();

        const newStart = new Date(selectedDate);
        newStart.setHours(0, 0, 0, 0);
        newStart.setMinutes(newStartMin);
        const newEnd = new Date(newStart.getTime() + durationMs);

        const newStartISO = newStart.toISOString();
        const newEndISO = newEnd.toISOString();

        setEvents(prev => prev.map(e => e.id === touchDragId ? { ...e, start_time: newStartISO, end_time: newEndISO } : e));

        const { error } = await supabase.from('schedule_events').update({
          start_time: newStartISO,
          end_time: newEndISO,
          updated_at: new Date().toISOString(),
        }).eq('id', touchDragId);

        if (error) {
          logger.error('[Schedule] touch drag save error:', error);
          fetchDayEvents();
        }
      }

      setTouchDragId(null);
      setTouchDragTopPx(null);
      touchDragActive.current = false;
      touchDragJustEnded.current = true;
      setTimeout(() => { touchDragJustEnded.current = false; }, 300);
      setSwipeId(null);
      setSwipeX(0);
      return;
    }

    if (swipeId && swipeX < swipeThreshold) {
      const ev = events.find(e => e.id === swipeId);
      if (ev) {
        confirmDelete(
          'Delete Event',
          `Delete "${ev.title}"?`,
          () => deleteEvent(swipeId)
        );
      }
    }

    touchDragActive.current = false;
    setTouchDragId(null);
    setTouchDragTopPx(null);
    setSwipeId(null);
    setSwipeX(0);
  };

  return {
    // State
    dragId,
    dragGhostTop,
    dropHour,
    touchDragId,
    touchDragTopPx,
    touchDragActive,
    touchDragJustEnded,
    resizeId,
    resizeH,
    swipeId,
    swipeX,
    // Handlers
    handleEventTouchStart,
    handleEventTouchEnd,
    handleDragStart,
    handleDragEnd,
    handleTimelineDragOver,
    handleTimelineDrop,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
    handleSwipeStart,
    handleSwipeMove,
    handleSwipeEnd,
  };
}