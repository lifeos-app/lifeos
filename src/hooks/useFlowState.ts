/**
 * useFlowState — React hook for Flow State detection and insights.
 *
 * Provides: { flowStates, insights, currentFlowState, logFlow, isLikelyInFlow }
 * Reactive: updates on storage events and periodic checks.
 *
 * Passive integration: reads from existing stores (goals, journal, habits, tasks)
 * to detect flow patterns without modifying store code.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  type FlowStateRecord,
  type FlowInsight,
  type ActivityEntry,
  detectFlowState,
  detectCurrentFlow,
  getFlowInsights,
  logFlowState as engineLogFlow,
  getFlowStates as engineGetFlowStates,
  getUltradianPhase,
} from '../lib/flow-state-engine';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useHabitsStore } from '../stores/useHabitsStore';

export type { FlowStateRecord, FlowInsight, ActivityEntry };

export interface UseFlowStateReturn {
  flowStates: FlowStateRecord[];
  insights: FlowInsight;
  currentFlowState: FlowStateRecord | null;
  logFlow: (record: FlowStateRecord) => void;
  isLikelyInFlow: boolean;
  ultradianPhase: { phase: 'focus' | 'rest'; minutesLeft: number };
}

/**
 * Build activity entries from store data for flow detection.
 * Merges completed tasks and habit logs into a unified timeline.
 */
function buildActivityEntries(
  tasks: { id: string; completed_at: string | null; title?: string; goal_id?: string; status?: string }[],
  habitLogs: { id: string; date: string; created_at?: string; habit_id: string }[],
): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  // Completed tasks → activity entries
  for (const t of tasks) {
    if (t.completed_at && t.status === 'done') {
      entries.push({
        id: `task-${t.id}`,
        timestamp: t.completed_at,
        tag: t.goal_id ? 'goal_work' : t.title?.toLowerCase(),
        type: 'task',
      });
    }
  }

  // Habit logs → activity entries
  for (const l of habitLogs) {
    const ts = l.created_at || `${l.date}T08:00:00`;
    entries.push({
      id: `habit-${l.id}`,
      timestamp: ts,
      tag: 'habit_routine',
      type: 'habit',
    });
  }

  return entries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

const REFRESH_INTERVAL = 60_000; // 1 minute

export function useFlowState(): UseFlowStateReturn {
  const [flowStates, setFlowStates] = useState<FlowStateRecord[]>(() => engineGetFlowStates());
  const [currentFlowState, setCurrentFlowState] = useState<FlowStateRecord | null>(null);
  const [tick, setTick] = useState(0);

  const tasks = useScheduleStore(s => s.tasks);
  const habitLogs = useHabitsStore(s => s.logs);

  // Track previous task count to detect newly completed goals/tasks
  const prevDoneCountRef = useRef(0);

  // Trigger re-evaluation on storage changes (e.g. from another tab)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'lifeos:flow-states') {
        setFlowStates(engineGetFlowStates());
        setTick(t => t + 1);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Periodic refresh to update ultradian phase and re-check flow
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Compute insights from stored flow states
  const insights = useMemo(() => getFlowInsights(), [flowStates, tick]);

  // Build activity entries from current store data
  const activityEntries = useMemo(
    () => buildActivityEntries(
      tasks,
      habitLogs,
    ),
    [tasks, habitLogs],
  );

  // Detect current flow state (from last 2 hours of activity)
  const detectedFlow = useMemo(() => {
    const detected = detectCurrentFlow(activityEntries);
    return detected;
  }, [activityEntries, tick]);

  // Track when a flow is detected to avoid over-writing manual sessions
  useEffect(() => {
    if (detectedFlow) {
      setCurrentFlowState(detectedFlow);
    }
  }, [detectedFlow]);

  // Check if goal was completed → try auto-detect and log flow
  // This is the passive integration with useGoalsStore (reading completed tasks)
  useEffect(() => {
    const doneCount = tasks.filter(t => t.status === 'done' && t.completed_at).length;
    const prevCount = prevDoneCountRef.current;

    // If new tasks were completed, check for flow conditions
    if (doneCount > prevCount && prevCount > 0) {
      const recentFlow = detectCurrentFlow(activityEntries);
      if (recentFlow && recentFlow.depth_score >= 0.5) {
        // Auto-log a detected flow state (subtle — no notifications)
        engineLogFlow(recentFlow);
        setFlowStates(engineGetFlowStates());
      }
    }
    prevDoneCountRef.current = doneCount;
  }, [tasks, activityEntries]);

  const isLikelyInFlow = useMemo(() => {
    return detectedFlow !== null && detectedFlow.depth_score > 0.4;
  }, [detectedFlow]);

  // Get ultradian phase
  const ultradianPhase = useMemo(() => getUltradianPhase(), [tick]);

  // Log a flow state
  const logFlow = useCallback((record: FlowStateRecord) => {
    engineLogFlow(record);
    setFlowStates(engineGetFlowStates());
  }, []);

  return {
    flowStates,
    insights,
    currentFlowState,
    logFlow,
    isLikelyInFlow,
    ultradianPhase,
  };
}