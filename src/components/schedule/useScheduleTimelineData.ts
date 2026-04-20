/**
 * useScheduleTimelineData — Computed timeline layout data
 *
 * Calculates event/task/habit block positions, overlap columns,
 * layer columns for multi-col mode, live event layout, and filtered events.
 */
import { useMemo } from 'react';
import { localDateStr } from '../../utils/date';
import { snap15, WAKE_START, WAKE_END } from './utils';
import type { ScheduleEvent } from './types';

interface UseScheduleTimelineDataArgs {
  events: ScheduleEvent[];
  allEvents: ScheduleEvent[];
  selectedDate: Date;
  layerFilter: import('./types').LayerFilter;
  googleEvents: Array<{ date: string; [key: string]: unknown }>;
  userId?: string;
  showAllHours: boolean;
  isTodaySel: boolean;
  liveActiveEvent: import('../../stores/useLiveActivityStore').LiveEvent | null;
  liveElapsedSeconds: number;
  isMultiCol: boolean;
  dayTasks: any[];
  filteredEvents: ScheduleEvent[];
  habits: any[];
  dayHabitLogs: any[];
  habitFrequency?: string;
}

export function useScheduleTimelineData({
  events,
  allEvents,
  selectedDate,
  layerFilter,
  googleEvents,
  userId,
  showAllHours,
  isTodaySel,
  liveActiveEvent,
  liveElapsedSeconds,
  isMultiCol,
  dayTasks,
  filteredEvents,
  habits,
  dayHabitLogs,
}: UseScheduleTimelineDataArgs) {
  const nowDate = new Date();

  // Effective start hour
  const effectiveStart = useMemo(() => {
    if (showAllHours) return 0;
    let start = WAKE_START;
    if (liveActiveEvent) { const liveHour = new Date(liveActiveEvent.start_time).getHours(); start = Math.min(start, liveHour); }
    events.forEach(ev => { const h = new Date(ev.start_time).getHours(); if (h < start) start = h; });
    if (isTodaySel) { const nowHour = new Date().getHours(); if (nowHour < start) start = nowHour; }
    return start;
  }, [showAllHours, liveActiveEvent, events, isTodaySel]);

  const hours = useMemo(() => {
    if (showAllHours) return Array.from({ length: 24 }, (_, i) => i);
    return Array.from({ length: WAKE_END - effectiveStart }, (_, i) => i + effectiveStart);
  }, [showAllHours, effectiveStart]);

  const hasOutsideWaking = useMemo(() =>
    events.some(ev => { const h = new Date(ev.start_time).getHours(); return h < effectiveStart || h >= WAKE_END; }),
  [events, effectiveStart]);

  // Task blocks
  const taskBlocks = useMemo(() => {
    const scheduledTaskIds = new Set(
      filteredEvents
        .map(ev => (ev as any).description?.match(/\[task:([^\]]+)\]/)?.[1])
        .filter(Boolean)
    );
    return dayTasks
      .filter((t: any) => t.status !== 'done')
      .filter((t: any) => !scheduledTaskIds.has(t.id))
      .map((t: any) => {
        const taskHour = t.scheduled_start ? new Date(t.scheduled_start).getHours() : getPreferredHourForTask(t);
        const duration = t.estimated_duration || 30;
        const startMin = taskHour * 60;
        const endMin = startMin + duration;
        return { ...t, startMin, endMin, col: 0, totalCols: 1, _type: 'task' as const };
      });
  }, [dayTasks, filteredEvents]);

  // Habit blocks
  const habitBlocks = useMemo(() =>
    habits
      .filter((h: any) => h.is_active && h.frequency === 'daily')
      .map((h: any, idx: number) => {
        const startMin = 8 * 60 + (idx * 30);
        const endMin = startMin + 30;
        const hLogs = dayHabitLogs.filter((l: any) => l.habit_id === h.id);
        const isDone = hLogs.reduce((s: number, l: any) => s + (l.count || 1), 0) >= (h.target_count || 1);
        return { ...h, startMin, endMin, col: 0, totalCols: 1, _type: 'habit' as const, _isDone: isDone };
      }),
  [habits, dayHabitLogs]);

  // Event blocks
  const evBlocks = useMemo(() => {
    const blocks = filteredEvents
      .filter(ev => {
        if ((ev as any).is_live || ev.status === 'live') return false;
        if (!ev.end_time) return false;
        return true;
      })
      .map(ev => {
        const s = new Date(ev.start_time);
        const e = new Date(ev.end_time);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
        const selDateStr = localDateStr(selectedDate);
        const evStartDate = localDateStr(s);
        const evEndDate = localDateStr(e);
        let startMin: number; let endMin: number;
        if (evStartDate < selDateStr && evEndDate > selDateStr) { startMin = 0; endMin = 1440; }
        else if (evStartDate < selDateStr) { startMin = 0; endMin = e.getHours() * 60 + e.getMinutes(); }
        else if (evEndDate > selDateStr) { startMin = s.getHours() * 60 + s.getMinutes(); endMin = 1440; }
        else { startMin = s.getHours() * 60 + s.getMinutes(); endMin = e.getHours() * 60 + e.getMinutes(); if (endMin <= startMin) endMin += 1440; }
        const continuesFromBefore = evStartDate < selDateStr;
        const continuesAfter = evEndDate > selDateStr;
        return { ...ev, startMin, endMin, col: 0, totalCols: 1, _type: 'event' as const, _continuesFromBefore: continuesFromBefore, _continuesAfter: continuesAfter };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));

    // Overlap column calculation
    for (let i = 0; i < blocks.length; i++) {
      const overlapping = blocks.filter((b, j) => j < i && b.endMin > blocks[i].startMin && b.startMin < blocks[i].endMin);
      const usedCols = new Set(overlapping.map(b => b.col));
      let col = 0;
      while (usedCols.has(col)) col++;
      blocks[i].col = col;
    }
    for (const block of blocks) {
      const group = blocks.filter(b => b.endMin > block.startMin && b.startMin < block.endMin);
      const maxCol = Math.max(...group.map(b => b.col)) + 1;
      for (const b of group) b.totalCols = Math.max(b.totalCols, maxCol);
    }
    return blocks;
  }, [filteredEvents, selectedDate]);

  // Merged all blocks
  const allBlocks = useMemo(() => {
    const merged = [...evBlocks, ...taskBlocks, ...habitBlocks]
      .sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));
    for (let i = 0; i < merged.length; i++) {
      const overlapping = merged.filter((b, j) => j < i && b.endMin > merged[i].startMin && b.startMin < merged[i].endMin);
      const usedCols = new Set(overlapping.map(b => b.col));
      let col = 0;
      while (usedCols.has(col)) col++;
      merged[i].col = col;
    }
    for (const block of merged) {
      const group = merged.filter(b => b.endMin > block.startMin && b.startMin < block.endMin);
      const maxCol = Math.max(...group.map(b => b.col)) + 1;
      for (const b of group) b.totalCols = Math.max(b.totalCols, maxCol);
    }
    return merged;
  }, [evBlocks, taskBlocks, habitBlocks]);

  // Layer columns for multi-col desktop
  const layerColumns = useMemo(() => {
    if (!isMultiCol) return null;
    const layers = ['primary', 'operations', 'sacred'] as const;
    const layerLabels: Record<string, { label: string; icon: string }> = {
      primary: { label: 'Primary', icon: '📋' },
      operations: { label: 'Ops', icon: '⚙️' },
      sacred: { label: 'Sacred', icon: '✝' },
    };
    return layers.map(layer => {
      const blocks = allBlocks.filter((b: any) => {
        if (b._type === 'event') return ((b).schedule_layer || 'primary') === layer;
        if (b._type === 'task') return layer === 'primary';
        if (b._type === 'habit') return layer === 'primary';
        return false;
      });
      for (let i = 0; i < blocks.length; i++) {
        const overlapping = blocks.filter((b, j) => j < i && b.endMin > blocks[i].startMin && b.startMin < blocks[i].endMin);
        const usedCols = new Set(overlapping.map(b => b.col));
        let col = 0;
        while (usedCols.has(col)) col++;
        blocks[i] = { ...blocks[i], col };
      }
      for (const block of blocks) {
        const group = blocks.filter(b => b.endMin > block.startMin && b.startMin < block.endMin);
        const maxCol = Math.max(...group.map(b => b.col)) + 1;
        for (const b of group) b.totalCols = Math.max(b.totalCols, maxCol);
      }
      return { layer, ...layerLabels[layer], blocks };
    }).filter(col => col.blocks.length > 0);
  }, [isMultiCol, allBlocks]);

  // Live event block
  const selStr = localDateStr(selectedDate);
  const liveBlock = useMemo(() => {
    if (!liveActiveEvent) return null;
    const startDate = new Date(liveActiveEvent.start_time);
    if (localDateStr(startDate) !== selStr) return null;
    const startMin = startDate.getHours() * 60 + startDate.getMinutes();
    const elapsedMin = Math.ceil(liveElapsedSeconds / 60);
    const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    const rawEndMin = startMin + Math.max(elapsedMin, 5);
    const endMin = isTodaySel ? Math.min(rawEndMin, nowMinutes + 1) : rawEndMin;
    return { startMin, endMin, elapsedMin };
  }, [liveActiveEvent, liveElapsedSeconds, selStr, isTodaySel]);

  // Adjusted all blocks for live event overlap
  const adjustedAllBlocks = useMemo(() => {
    if (!liveBlock) return allBlocks;
    const overlapping = allBlocks.filter(item => {
      if (item._type === 'event' && liveActiveEvent && item.id === liveActiveEvent.id) return false;
      return item.endMin > liveBlock.startMin && item.startMin < liveBlock.endMin;
    });
    if (overlapping.length === 0) return allBlocks;
    return allBlocks.map(item => {
      if (item._type === 'event' && liveActiveEvent && item.id === liveActiveEvent.id) return { ...item, _hiddenByLive: true };
      const isOverlapping = overlapping.some(o => o.id === item.id);
      if (isOverlapping) return { ...item, col: item.col, totalCols: Math.max(item.totalCols, 2), _dimmable: true };
      return item;
    });
  }, [allBlocks, liveBlock, liveActiveEvent]);

  // Live event layout
  const liveLayout = useMemo(() => {
    if (!liveBlock) return null;
    const hasOverlap = evBlocks.some(ev => {
      if (liveActiveEvent && ev.id === liveActiveEvent.id) return false;
      return ev.endMin > liveBlock.startMin && ev.startMin < liveBlock.endMin;
    });
    if (hasOverlap) return { leftPct: 10 + 43, widthPct: 43 };
    return { leftPct: 10, widthPct: 86 };
  }, [liveBlock, evBlocks, liveActiveEvent]);

  return {
    effectiveStart,
    hours,
    hasOutsideWaking,
    taskBlocks,
    habitBlocks,
    evBlocks,
    allBlocks,
    layerColumns,
    liveBlock,
    adjustedAllBlocks,
    liveLayout,
  };
}

// ── Helper ──

function inferDomainFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (/study|learn|read|course|exam|lesson/.test(t)) return 'education';
  if (/workout|exercise|run|gym|lift|stretch/.test(t)) return 'exercise';
  if (/pray|meditat|quran|bible/.test(t)) return 'prayer';
  if (/budget|invest|tax|save|financ/.test(t)) return 'financial';
  if (/cook|meal|eat|diet|nutrition/.test(t)) return 'health';
  return 'general';
}

function getPreferredHourForTask(task: { title: string; domain?: string }): number {
  const domain = (task as any).domain || inferDomainFromTitle(task.title);
  const defaults: Record<string, number> = {
    education: 6, exercise: 7, prayer: 5, meditation: 6,
    work: 10, financial: 14, health: 15, social: 18,
    personal: 16, creative: 9, general: 9,
  };
  return defaults[domain] || 9;
}