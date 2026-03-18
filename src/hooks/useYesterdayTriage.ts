/**
 * useYesterdayTriage — Shows yesterday's tasks/events for quick triage.
 *
 * Philosophy: The system does NOT assume you missed anything.
 * Instead, it shows yesterday's items and lets YOU decide:
 *   ✅ Done  — mark complete, award XP
 *   ❌ Missed — stays as genuinely overdue
 *   ➡️ Moved — reschedule to a new date
 *
 * Items are only shown once. Once triaged (done/missed/moved),
 * they don't come back. Triage state is stored in localStorage
 * keyed by date, and cleaned up after 7 days.
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useScheduleStore } from '../stores/useScheduleStore';
import { localDateStr, todayStr } from '../utils/date';
import { supabase } from '../lib/supabase';
import { localUpdate } from '../lib/local-db';
import { useUserStore } from '../stores/useUserStore';
import { showToast } from '../components/Toast';
import { logger } from '../utils/logger';
import type { Task, ScheduleEvent } from '../types/database';

export interface TriageItem {
  id: string;
  title: string;
  type: 'task' | 'event';
  date: string;       // due_date or start_time date
  time?: string;      // start time for events
  priority?: string;
  event_type?: string;
}

export type TriageAction = 'done' | 'missed' | 'moved';

const TRIAGE_STORAGE_KEY = 'lifeos_triage_state';

interface TriageState {
  [date: string]: {
    [itemId: string]: TriageAction;
  };
}

function loadTriageState(): TriageState {
  try {
    const raw = localStorage.getItem(TRIAGE_STORAGE_KEY);
    if (!raw) return {};
    const state = JSON.parse(raw) as TriageState;
    // Clean up entries older than 7 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = localDateStr(cutoff);
    const cleaned: TriageState = {};
    for (const [date, items] of Object.entries(state)) {
      if (date >= cutoffStr) cleaned[date] = items;
    }
    return cleaned;
  } catch {
    return {};
  }
}

function saveTriageState(state: TriageState) {
  try {
    localStorage.setItem(TRIAGE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Safari private browsing
  }
}

export function useYesterdayTriage() {
  const tasks = useScheduleStore(s => s.tasks);
  const events = useScheduleStore(s => s.events);
  const storeLoading = useScheduleStore(s => s.loading);
  const userId = useUserStore(s => s.user?.id);

  const [triageState, setTriageState] = useState<TriageState>(loadTriageState);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const today = todayStr();
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return localDateStr(d);
  }, []);

  // Get items from yesterday that haven't been triaged
  const triageItems = useMemo(() => {
    const alreadyTriaged = triageState[yesterday] || {};
    const items: TriageItem[] = [];

    // Yesterday's tasks (due_date === yesterday, not done)
    tasks.forEach(t => {
      if (t.is_deleted) return;
      if (t.status === 'done') return;
      if (t.due_date !== yesterday) return;
      if (alreadyTriaged[t.id]) return;
      items.push({
        id: t.id,
        title: t.title,
        type: 'task',
        date: t.due_date!,
        priority: t.priority || 'medium',
      });
    });

    // Yesterday's events (start_time on yesterday, not completed/cancelled)
    events.forEach(e => {
      if (e.is_deleted) return;
      if (e.status === 'completed' || e.status === 'cancelled') return;
      if (e.is_recurring || e.recurrence_rule) return;
      if (e.event_type === 'block') return;
      if (!e.start_time) return;
      const eventDate = e.start_time.split('T')[0];
      if (eventDate !== yesterday) return;
      if (alreadyTriaged[e.id]) return;
      items.push({
        id: e.id,
        title: e.title,
        type: 'event',
        date: eventDate,
        time: new Date(e.start_time).toLocaleTimeString('en-AU', {
          hour: 'numeric', minute: '2-digit', hour12: true,
        }),
        event_type: e.event_type,
      });
    });

    return items;
  }, [tasks, events, yesterday, triageState]);

  const markItem = useCallback(async (itemId: string, action: TriageAction, newDate?: string) => {
    setProcessingId(itemId);
    const item = triageItems.find(i => i.id === itemId);
    if (!item) { setProcessingId(null); return; }

    try {
      if (action === 'done') {
        if (item.type === 'task') {
          const updateData = { status: 'done' as const, updated_at: new Date().toISOString() };
          await supabase.from('tasks').update(updateData).eq('id', itemId);
          await localUpdate('tasks', itemId, updateData).catch(e => logger.warn('[triage] localUpdate failed:', e));
        } else {
          const updateData = { status: 'completed', completed: true, updated_at: new Date().toISOString() };
          await supabase.from('schedule_events').update(updateData).eq('id', itemId);
          await localUpdate('events', itemId, updateData).catch(e => logger.warn('[triage] localUpdate failed:', e));
        }
      } else if (action === 'moved' && newDate) {
        if (item.type === 'task') {
          const updateData = { due_date: newDate, updated_at: new Date().toISOString() };
          await supabase.from('tasks').update(updateData).eq('id', itemId);
          await localUpdate('tasks', itemId, updateData).catch(e => logger.warn('[triage] localUpdate failed:', e));
        } else {
          // Shift event to new date keeping same time
          const { data: evt } = await supabase.from('schedule_events')
            .select('start_time, end_time').eq('id', itemId).single();
          if (evt) {
            const origStart = new Date(evt.start_time);
            const timeStr = origStart.toTimeString().slice(0, 5);
            const newStart = new Date(newDate + 'T' + timeStr + ':00');
            const updateData: any = { start_time: newStart.toISOString(), updated_at: new Date().toISOString() };
            if (evt.end_time) {
              const duration = new Date(evt.end_time).getTime() - origStart.getTime();
              updateData.end_time = new Date(newStart.getTime() + duration).toISOString();
            }
            await supabase.from('schedule_events').update(updateData).eq('id', itemId);
            await localUpdate('events', itemId, updateData).catch(e => logger.warn('[triage] localUpdate failed:', e));
          }
        }
      }
      // For 'missed' — we don't change anything in the DB.
      // The item stays as-is and will show up in the overdue list.

      // Save triage decision
      const newState = { ...triageState };
      if (!newState[yesterday]) newState[yesterday] = {};
      newState[yesterday][itemId] = action;
      setTriageState(newState);
      saveTriageState(newState);

      // Refresh the store
      useScheduleStore.setState({ lastFetched: null });
      await useScheduleStore.getState().fetchAll();
    } catch (err) {
      logger.error('[triage] Failed to process item:', err);
      showToast('Failed to update item', '⚠️', '#F43F5E');
    } finally {
      setProcessingId(null);
      setMovingId(null);
    }
  }, [triageItems, triageState, yesterday]);

  const markAllDone = useCallback(async () => {
    setProcessingId('all');
    const newState = { ...triageState };
    if (!newState[yesterday]) newState[yesterday] = {};

    // Batch update all tasks
    const taskIds = triageItems.filter(i => i.type === 'task').map(i => i.id);
    const eventIds = triageItems.filter(i => i.type === 'event').map(i => i.id);

    try {
      if (taskIds.length > 0) {
        await supabase.from('tasks')
          .update({ status: 'done', updated_at: new Date().toISOString() })
          .in('id', taskIds);
        for (const id of taskIds) {
          await localUpdate('tasks', id, { status: 'done', updated_at: new Date().toISOString() }).catch(e => logger.warn('[triage] localUpdate failed:', e));
        }
      }
      if (eventIds.length > 0) {
        await supabase.from('schedule_events')
          .update({ status: 'completed', completed: true, updated_at: new Date().toISOString() })
          .in('id', eventIds);
        for (const id of eventIds) {
          await localUpdate('events', id, { status: 'completed', completed: true, updated_at: new Date().toISOString() }).catch(e => logger.warn('[triage] localUpdate failed:', e));
        }
      }

      // Mark all as triaged
      for (const item of triageItems) {
        newState[yesterday][item.id] = 'done';
      }
      setTriageState(newState);
      saveTriageState(newState);

      // Refresh store
      useScheduleStore.setState({ lastFetched: null });
      await useScheduleStore.getState().fetchAll();

      showToast(`All ${triageItems.length} items marked done`, '🎉', '#39FF14');
    } catch (err) {
      logger.error('[triage] markAllDone failed:', err);
      showToast('Failed to update items', '⚠️', '#F43F5E');
    } finally {
      setProcessingId(null);
    }
  }, [triageItems, triageState, yesterday]);

  return {
    triageItems,
    triageCount: triageItems.length,
    loading: storeLoading,
    markItem,
    markAllDone,
    movingId,
    setMovingId,
    processingId,
    yesterday,
  };
}
