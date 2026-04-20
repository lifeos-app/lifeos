/**
 * useGoalsEffects — Data fetching, effects, and derived state for Goals page.
 *
 * Extracted from Goals.tsx to isolate side-effects and computed values.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useUserStore } from '../stores/useUserStore';
import { getPartners } from '../lib/social/partnerships';
import type { PartnerWithProfile } from '../lib/social/types';
import type { GoalNode, GoalTask } from '../components/goals/types';
import { safeScrollIntoView } from '../utils/scroll';

export interface GoalsEffectsReturn {
  goals: GoalNode[];
  setGoals: React.Dispatch<React.SetStateAction<GoalNode[]>>;
  loading: boolean;
  allTasks: GoalTask[];
  setAllTasks: React.Dispatch<React.SetStateAction<GoalTask[]>>;
  businesses: any[];
  expandedIds: Set<string>;
  setExpandedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  highlightedNodeId: string | null;
  setHighlightedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  linkedTasks: Record<string, GoalTask[]>;
  setLinkedTasks: React.Dispatch<React.SetStateAction<Record<string, GoalTask[]>>>;
  allTaskCounts: Record<string, { total: number; done: number }>;
  taskChartData: Record<string, { data: number[]; labels: string[] }>;
  ringsAnimated: boolean;
  partners: PartnerWithProfile[];
  fetchGoals: (isRefresh?: boolean) => Promise<void>;
  fetchAllTaskCounts: () => void;
  fetchTaskChartData: (goalId: string) => Promise<void>;
  toggleExpand: (id: string) => Promise<void>;
  getHierarchy: (goalId: string | null) => { id: string; title: string; icon: string; category: string }[];
  activeGoals: GoalNode[];
  completedGoals: GoalNode[];
  overallProgress: number;
  getTimeRange: (filter: string) => { start: string; end: string } | null;
}

export function useGoalsEffects(
  viewMode: string,
  timeFilter: string,
): GoalsEffectsReturn {
  const user = useUserStore(s => s.user);
  const [searchParams, setSearchParams] = useSearchParams();

  const [goals, setGoals] = useState<GoalNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [linkedTasks, setLinkedTasks] = useState<Record<string, GoalTask[]>>({});
  const [allTasks, setAllTasks] = useState<GoalTask[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [allTaskCounts, setAllTaskCounts] = useState<Record<string, { total: number; done: number }>>({});
  const [taskChartData, setTaskChartData] = useState<Record<string, { data: number[]; labels: string[] }>>({});
  const [ringsAnimated, setRingsAnimated] = useState(false);
  const [partners, setPartners] = useState<PartnerWithProfile[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setRingsAnimated(true), 100);
    return () => clearTimeout(t);
  }, [goals]);

  const fetchGoals = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    await Promise.all([
      useGoalsStore.getState().fetchAll(),
      useScheduleStore.getState().fetchAll(),
    ]);
    setGoals(useGoalsStore.getState().goals as unknown as GoalNode[]);
    setAllTasks(useScheduleStore.getState().tasks as unknown as GoalTask[]);
    if (!isRefresh) setLoading(false);
  }, []);

  useEffect(() => {
    fetchGoals().then(() => setBusinesses(useGoalsStore.getState().businesses));
    if (user?.id) {
      getPartners(user.id).then(p => setPartners(p));
    }
  }, [user?.id]);

  useEffect(() => {
    const handler = () => fetchGoals(true);
    window.addEventListener('lifeos-refresh', handler);
    return () => window.removeEventListener('lifeos-refresh', handler);
  }, []);

  useEffect(() => {
    const nodeId = searchParams.get('node');
    if (!nodeId || goals.length === 0) return;
    const expandPath = new Set<string>();
    let current: GoalNode | undefined = goals.find((g: GoalNode) => g.id === nodeId);
    while (current) {
      expandPath.add(current.id);
      current = current.parent_goal_id ? goals.find((g: GoalNode) => g.id === current!.parent_goal_id) : undefined;
    }
    if (expandPath.size > 0) {
      setExpandedIds(prev => new Set([...prev, ...expandPath]));
      setHighlightedNodeId(nodeId);
      setTimeout(() => {
        const el = document.querySelector(`[data-goal-id="${nodeId}"]`) as HTMLElement;
        if (el) safeScrollIntoView(el, { behavior: 'smooth', block: 'center' });
      }, 300);
      setSearchParams({}, { replace: true });
      setTimeout(() => setHighlightedNodeId(null), 3000);
    }
  }, [searchParams, goals]);

  const fetchTaskChartData = useCallback(async (goalId: string) => {
    const days: { date: string; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString().split('T')[0], label: d.toLocaleDateString('en', { weekday: 'short' }) });
    }
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const storeTasks = useScheduleStore.getState().tasks.filter(t =>
      t.goal_id === goalId && !t.is_deleted && t.status === 'done' &&
      t.completed_at && t.completed_at >= sevenDaysAgo.toISOString()
    );
    const counts = days.map(day => ({
      ...day,
      count: storeTasks.filter(t => t.completed_at?.startsWith(day.date)).length,
    }));
    setTaskChartData(prev => ({ ...prev, [goalId]: { data: counts.map(c => c.count), labels: counts.map(c => c.label) } }));
  }, []);

  const toggleExpand = useCallback(async (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
      if (!linkedTasks[id]) {
        const storeTasks = useScheduleStore.getState().tasks;
        const goalTasks = storeTasks.filter(t => t.goal_id === id && !t.is_deleted).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
        setLinkedTasks(prev => ({ ...prev, [id]: goalTasks as unknown as GoalTask[] }));
        if (goalTasks.length > 0) {
          setAllTasks(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const newTasks = (goalTasks as unknown as GoalTask[]).filter(t => !existingIds.has(t.id));
            return newTasks.length > 0 ? [...prev, ...newTasks] : prev;
          });
        }
      }
      fetchTaskChartData(id);
    }
    setExpandedIds(newExpanded);
  }, [expandedIds, linkedTasks, fetchTaskChartData]);

  const getHierarchy = useCallback((goalId: string | null): { id: string; title: string; icon: string; category: string }[] => {
    const chain: { id: string; title: string; icon: string; category: string }[] = [];
    let current = goalId;
    while (current) {
      const g = goals.find(x => x.id === current);
      if (!g) break;
      chain.unshift({ id: g.id, title: g.title, icon: g.icon || '🎯', category: g.category || 'goal' });
      current = g.parent_goal_id;
    }
    return chain;
  }, [goals]);

  const fetchAllTaskCounts = useCallback(() => {
    const tasks = useScheduleStore.getState().tasks;
    const counts: Record<string, { total: number; done: number }> = {};
    for (const t of tasks) {
      if (!t.goal_id || t.is_deleted) continue;
      if (!counts[t.goal_id]) counts[t.goal_id] = { total: 0, done: 0 };
      counts[t.goal_id].total++;
      if (t.status === 'done') counts[t.goal_id].done++;
    }
    setAllTaskCounts(counts);
  }, []);

  useEffect(() => { fetchAllTaskCounts(); }, [viewMode, allTasks]);

  const activeGoals = useMemo(() => goals.filter(g => g.status === 'active' || g.status === 'in_progress'), [goals]);
  const completedGoals = useMemo(() => goals.filter(g => (g.progress || 0) >= 1), [goals]);
  const overallProgress = useMemo(() => goals.length > 0 ? goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length : 0, [goals]);

  const getTimeRange = (filter: string): { start: string; end: string } | null => {
    if (filter === 'all') return null;
    const now = new Date(); const y = now.getFullYear(); const m = now.getMonth(); const q = Math.floor(m / 3);
    if (filter === 'thisMonth') return { start: `${y}-${String(m + 1).padStart(2, '0')}-01`, end: `${y}-${String(m + 2 > 12 ? 1 : m + 2).padStart(2, '0')}-01` };
    if (filter === 'thisQuarter') return { start: `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`, end: `${y}-${String(q * 3 + 4 > 12 ? q * 3 + 4 - 12 : q * 3 + 4).padStart(2, '0')}-01` };
    if (filter === 'nextQuarter') { const nq = q + 1; const ny = nq > 3 ? y + 1 : y; const nqm = (nq % 4) * 3; return { start: `${ny}-${String(nqm + 1).padStart(2, '0')}-01`, end: `${ny}-${String(nqm + 4 > 12 ? nqm + 4 - 12 : nqm + 4).padStart(2, '0')}-01` }; }
    if (filter === 'thisYear') return { start: `${y}-01-01`, end: `${y + 1}-01-01` };
    return null;
  };

  return {
    goals, setGoals, loading, allTasks, setAllTasks, businesses,
    expandedIds, setExpandedIds, highlightedNodeId, setHighlightedNodeId,
    linkedTasks, setLinkedTasks, allTaskCounts, taskChartData, ringsAnimated,
    partners,
    fetchGoals, fetchAllTaskCounts, fetchTaskChartData, toggleExpand, getHierarchy,
    activeGoals, completedGoals, overallProgress, getTimeRange,
  };
}