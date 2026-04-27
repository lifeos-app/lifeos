import { useState, useEffect, useMemo, useRef } from 'react';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useHealthStore } from '../../stores/useHealthStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useAgentStore } from '../../stores/useAgentStore';
import { useUserStore } from '../../stores/useUserStore';
import type { GoalRecord, TaskRecord, KeyResult, Resource } from './types';

export type TabKey = 'overview' | 'tasks' | 'progress' | 'resources';

export interface NodeDetailStateReturn {
  // Identity
  nodeId: string;
  allGoals: GoalRecord[];
  allTasks: TaskRecord[];
  // Editing
  editingDesc: boolean;
  setEditingDesc: (v: boolean) => void;
  editDesc: string;
  setEditDesc: (v: string) => void;
  editingTitle: boolean;
  setEditingTitle: (v: boolean) => void;
  editTitle: string;
  setEditTitle: (v: string) => void;
  // Sections open
  sectionsOpen: Record<string, boolean>;
  toggleSection: (key: string) => void;
  // Add child
  showAddChild: boolean;
  setShowAddChild: (v: boolean) => void;
  newChildTitle: string;
  setNewChildTitle: (v: string) => void;
  addingChild: boolean;
  // Key results & resources local state
  newKeyResult: string;
  setNewKeyResult: (v: string) => void;
  newResource: Resource;
  setNewResource: (v: Resource) => void;
  // Tabs
  activeTab: TabKey;
  setActiveTab: (v: TabKey) => void;
  // Touch
  touchStart: number;
  touchCurrent: number;
  isDragging: boolean;
  sheetRef: React.RefObject<HTMLDivElement | null>;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: () => void;
  dragOffset: number;
  // Derived
  node: GoalRecord | undefined;
  children: GoalRecord[];
  linkedTasks: TaskRecord[];
  activeTasks: TaskRecord[];
  doneTasks: TaskRecord[];
  ancestorChain: GoalRecord[];
  cat: string;
  color: string;
  pct: number;
  actualHours: number;
  budgetSpent: number;
  keyResults: KeyResult[];
  resources: Resource[];
  businesses: Business[];
  relatedExpenses: ReturnType<typeof useFinanceStore>['expenses'];
  goalBudget: { allocated: number; spent: number; remaining: number } | null;
  linkedHabits: ReturnType<typeof useHabitsStore>['habits'];
  showHealth: boolean;
  todayMetrics: ReturnType<typeof useHealthStore>['todayMetrics'];
  description: string;
  mainDesc: string;
  resourcesMatch: RegExpMatchArray | null;
  catLabel: string;
  childLabel: string;
  priorityColors: Record<string, string>;
  domainColors: Record<string, string>;
  budgetPct: number;
  budgetBarColor: string;
  timePct: number;
  timeBarColor: string;
  // Actions
  saveField: (field: string, value: string | number | null) => Promise<void>;
  saveTitle: () => Promise<void>;
  saveDesc: () => Promise<void>;
  saveKeyResults: (results: KeyResult[]) => Promise<void>;
  saveResources: (res: Resource[]) => Promise<void>;
  toggleTask: (taskId: string, currentStatus: string) => Promise<void>;
  createChild: () => Promise<void>;
  handleZeroClawClick: () => Promise<void>;
  inputClass: string;
  sendMessage: ReturnType<typeof useAgentStore>['sendMessage'];
  getLogsForHabit: (id: string) => unknown[];
}

interface Business {
  id: string;
  name: string;
}

export function useNodeDetailState(
  nodeId: string,
  allGoals: GoalRecord[],
  allTasks: TaskRecord[],
  onClose: () => void,
  onNavigate?: (nodeId: string) => void,
) {
  const node = allGoals.find((g) => g.id === nodeId);

  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const businesses = useGoalsStore(s => s.businesses) as Business[];
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    header: true,
    statusPriority: true,
    description: true,
    timeline: true,
    financial: false,
    success: false,
    resources: false,
    children: true,
    finance: false,
    habits: false,
    health: false,
  });
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildTitle, setNewChildTitle] = useState('');
  const [addingChild, setAddingChild] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState('');
  const [newResource, setNewResource] = useState<Resource>({ name: '', cost: 0, status: 'needed' });
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Touch gesture state
  const [touchStart, setTouchStart] = useState(0);
  const [touchCurrent, setTouchCurrent] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Store hooks
  const { expenses, budgets } = useFinanceStore();
  const { habits, getLogsForHabit } = useHabitsStore();
  const { todayMetrics } = useHealthStore();
  const { sendMessage } = useAgentStore();

  const cat = node?.category || 'goal';
  const color = node?.color || '#00D4FF';
  const pct = Math.round((node?.progress || 0) * 100);

  const children = allGoals.filter((g) => g.parent_goal_id === nodeId);
  const linkedTasks = allTasks.filter((t) => t.goal_id === nodeId);
  const activeTasks = linkedTasks.filter((t) => t.status !== 'done');
  const doneTasks = linkedTasks.filter((t) => t.status === 'done');

  const ancestorChain = useMemo(() => {
    const chain: GoalRecord[] = [];
    let currentId: string | null | undefined = node?.parent_goal_id;
    while (currentId) {
      const parent = allGoals.find(g => g.id === currentId);
      if (!parent) break;
      chain.unshift(parent);
      currentId = parent.parent_goal_id;
    }
    return chain;
  }, [node?.parent_goal_id, allGoals]);

  const actualHours = useMemo(() => {
    const getDescendantTasks = (goalId: string): TaskRecord[] => {
      const directTasks = allTasks.filter((t) => t.goal_id === goalId);
      const childGoals = allGoals.filter((g) => g.parent_goal_id === goalId);
      const childTasks = childGoals.flatMap((c) => getDescendantTasks(c.id));
      return [...directTasks, ...childTasks];
    };
    const allDesc = getDescendantTasks(nodeId);
    const totalMins = allDesc.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
    return Math.round(totalMins / 60 * 10) / 10;
  }, [nodeId, allGoals, allTasks]);

  const budgetSpent = useMemo(() => {
    const getDescendantTasks = (goalId: string): TaskRecord[] => {
      const directTasks = allTasks.filter((t) => t.goal_id === goalId);
      const childGoals = allGoals.filter((g) => g.parent_goal_id === goalId);
      const childTasks = childGoals.flatMap((c) => getDescendantTasks(c.id));
      return [...directTasks, ...childTasks];
    };
    const allDesc = getDescendantTasks(nodeId);
    return allDesc
      .filter((t) => t.financial_type === 'expense')
      .reduce((sum, t) => sum + (parseFloat(String(t.financial_amount)) || 0), 0);
  }, [nodeId, allGoals, allTasks]);

  const keyResults = useMemo((): KeyResult[] => {
    try { return node?.key_results ? JSON.parse(node.key_results) : []; }
    catch { return []; }
  }, [node?.key_results]);

  const resources = useMemo((): Resource[] => {
    try { return node?.resources ? JSON.parse(node.resources) : []; }
    catch { return []; }
  }, [node?.resources]);

  const relatedExpenses = useMemo(() => {
    if (cat !== 'goal' || !node?.business_id) return [];
    return expenses.filter(e => e.business_id === node.business_id).slice(0, 5);
  }, [cat, node?.business_id, expenses]);

  const goalBudget = useMemo(() => {
    if (!node?.budget_allocated) return null;
    return {
      allocated: node.budget_allocated,
      spent: budgetSpent,
      remaining: node.budget_allocated - budgetSpent,
    };
  }, [node?.budget_allocated, budgetSpent]);

  const linkedHabits = useMemo(() => {
    if (cat !== 'goal') return [];
    return habits.filter(h => h.goal_id === nodeId);
  }, [cat, nodeId, habits]);

  const showHealth = cat === 'goal' && (node?.domain === 'health' || node?.category === 'health');

  useEffect(() => {
    if (node) {
      setEditDesc(node.description || '');
      setEditTitle(node.title || '');
      setSectionsOpen(prev => ({
        ...prev,
        financial: !!(node.budget_allocated || node.financial_type || node.business_id),
        success: !!(node.success_criteria || node.key_results),
        finance: !!(node.budget_allocated || node.business_id),
        habits: !!(cat === 'goal'),
        health: !!(cat === 'goal' && node.domain === 'health'),
      }));
    }
    setShowAddChild(false);
    setNewChildTitle('');
  }, [node]);

  if (!node) {
    // Caller must handle null – the hook returns node which may be undefined
  }

  const description = node?.description || '';
  const resourcesMatch = description.match(/📦 Resources[^:]*:([\s\S]*?)(?=\n⏱|$)/);
  const mainDesc = description.split(/\n\n📦/)[0] || description;

  const toggleSection = (key: string) => setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const { updateGoal, createGoal: storeCreateGoal } = useGoalsStore.getState();
  const { updateTask: storeUpdateTask, createTask: storeCreateTask } = useScheduleStore.getState();

  const saveField = async (field: string, value: string | number | null) => {
    await updateGoal(nodeId, { [field]: value } as React.CSSProperties);
  };

  const saveTitle = async () => {
    await saveField('title', editTitle.trim() || node?.title || '');
    setEditingTitle(false);
  };

  const saveDesc = async () => {
    await saveField('description', editDesc.trim() || null);
    setEditingDesc(false);
  };

  const saveKeyResults = async (results: KeyResult[]) => {
    await saveField('key_results', JSON.stringify(results));
  };

  const saveResources = async (res: Resource[]) => {
    await saveField('resources', JSON.stringify(res));
  };

  const toggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    await storeUpdateTask(taskId, {
      status: newStatus as string,
      completed_at: newStatus === 'done' ? new Date().toISOString() : undefined,
    });
  };

  const createChild = async () => {
    if (!newChildTitle.trim()) return;
    setAddingChild(true);
    if (cat === 'goal') {
      await storeCreateTask(node!.user_id, newChildTitle.trim(), 'medium', {
        goal_id: nodeId,
      });
    } else {
      const childCat = cat === 'objective' ? 'epic' : 'goal';
      const childIcon = childCat === 'epic' ? '⚡' : '🏁';
      const childColor = childCat === 'epic' ? '#FACC15' : '#39FF14';
      await storeCreateGoal({
        user_id: node!.user_id,
        title: newChildTitle.trim(),
        category: childCat,
        parent_goal_id: nodeId,
        status: 'active',
        progress: 0,
        icon: childIcon,
        color: childColor,
        sort_order: children.length,
      } as React.CSSProperties);
    }
    setNewChildTitle('');
    setShowAddChild(false);
    setAddingChild(false);
    window.dispatchEvent(new Event('lifeos-refresh'));
  };

  const handleZeroClawClick = async () => {
    const contextMessage = `Tell me about my progress on "${node?.title}". What should I focus on?`;
    
    const { data: { session } } = await useUserStore.getState().getSessionCached();
    if (session?.user) {
      await sendMessage(session.user.id, contextMessage, {
        currentPage: 'goals',
        activeGoalId: nodeId,
      });
    }
    
    onClose();
    window.dispatchEvent(new CustomEvent('lifeos-open-agent-chat'));
  };

  // Touch gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setTouchCurrent(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const deltaY = touchCurrent - touchStart;
    if (deltaY > 100) {
      onClose();
    }
    
    setTouchStart(0);
    setTouchCurrent(0);
  };

  const dragOffset = isDragging && touchCurrent > touchStart ? touchCurrent - touchStart : 0;

  const catLabel = cat === 'objective' ? 'Objective' : cat === 'epic' ? 'Epic' : 'Goal';
  const childLabel = cat === 'objective' ? 'Epics' : cat === 'epic' ? 'Goals' : 'Tasks';

  const priorityColors: Record<string, string> = {
    critical: '#F43F5E', high: '#F97316', medium: '#FACC15', low: '#39FF14',
  };
  const domainColors: Record<string, string> = {
    education: '#00D4FF', business: '#FACC15', health: '#39FF14',
    personal: '#A855F7', spiritual: '#F97316', creative: '#EC4899',
  };

  const budgetPct = node?.budget_allocated ? (budgetSpent / node.budget_allocated) * 100 : 0;
  const budgetBarColor = budgetPct > 90 ? '#F43F5E' : budgetPct > 75 ? '#FACC15' : '#39FF14';
  const timePct = node?.estimated_hours ? (actualHours / node.estimated_hours) * 100 : 0;
  const timeBarColor = timePct > 90 ? '#F43F5E' : timePct > 75 ? '#FACC15' : '#39FF14';

  const inputClass = 'px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded-md text-white text-xs font-[inherit] outline-none w-full';

  return {
    // Identity
    nodeId, allGoals, allTasks,
    // Editing
    editingDesc, setEditingDesc, editDesc, setEditDesc,
    editingTitle, setEditingTitle, editTitle, setEditTitle,
    // Sections
    sectionsOpen, toggleSection,
    // Add child
    showAddChild, setShowAddChild, newChildTitle, setNewChildTitle, addingChild,
    // Key results & resources local state
    newKeyResult, setNewKeyResult,
    newResource, setNewResource,
    // Tabs
    activeTab, setActiveTab,
    // Touch
    touchStart, touchCurrent, isDragging, sheetRef,
    handleTouchStart, handleTouchMove, handleTouchEnd, dragOffset,
    // Derived
    node, children, linkedTasks, activeTasks, doneTasks,
    ancestorChain, cat, color, pct,
    actualHours, budgetSpent, keyResults, resources,
    businesses, relatedExpenses, goalBudget,
    linkedHabits, showHealth, todayMetrics,
    description, mainDesc, resourcesMatch,
    catLabel, childLabel,
    priorityColors, domainColors,
    budgetPct, budgetBarColor, timePct, timeBarColor,
    // Actions
    saveField, saveTitle, saveDesc,
    saveKeyResults, saveResources,
    toggleTask, createChild, handleZeroClawClick,
    inputClass,
    // Store refs for sub-components
    onClose, onNavigate,
    sendMessage, getLogsForHabit,
  };
}