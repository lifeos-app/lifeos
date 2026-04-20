/**
 * useGoalsActions — All action handlers for the Goals page.
 *
 * Includes: delete, cycle status, duplicate, archive,
 * drag/drop, touch swipe, context menu, inline editing, quick add,
 * popular goals, linked tasks.
 *
 * Form creation is delegated to GoalsForm + Goals orchestrator.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/data-access';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useGamificationContext } from '../lib/gamification/context';
import { showToast } from '../components/Toast';
import { recalcProgression } from '../lib/progression';
import type { GoalNode, GoalTask } from '../components/goals/types';
import { STATUS_CYCLE } from '../components/goals/utils';

export interface GoalsActionsReturn {
  // Inline editing state
  editingTitle: string | null;
  setEditingTitle: React.Dispatch<React.SetStateAction<string | null>>;
  editTitleVal: string;
  setEditTitleVal: React.Dispatch<React.SetStateAction<string>>;
  newLinkedTask: string | null;
  setNewLinkedTask: React.Dispatch<React.SetStateAction<string | null>>;
  newLinkedTaskTitle: string;
  setNewLinkedTaskTitle: React.Dispatch<React.SetStateAction<string>>;
  creatingLinkedTask: boolean;

  // Drag state
  dragId: string | null;
  dragOverId: string | null;
  dragPosition: 'above' | 'below' | null;

  // Swipe state
  swipeId: string | null;
  swipeX: number;
  swipeStartX: React.RefObject<number>;
  swipeStartY: React.RefObject<number>;
  swiping: React.MutableRefObject<boolean>;

  // Context menu
  contextMenuId: string | null;
  setContextMenuId: React.Dispatch<React.SetStateAction<string | null>>;
  contextMenuPos: { x: number; y: number } | null;
  setContextMenuPos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  contextMenuRef: React.RefObject<HTMLDivElement>;

  // Confirm dialog
  confirmAction: (() => void) | null;
  setConfirmAction: React.Dispatch<React.SetStateAction<(() => void) | null>>;
  confirmMsg: { title: string; message: string };
  setConfirmMsg: React.Dispatch<React.SetStateAction<{ title: string; message: string }>>;
  celebrateGoalId: string | null;
  setCelebrateGoalId: React.Dispatch<React.SetStateAction<string | null>>;

  // Detail modals
  detailNodeId: string | null;
  setDetailNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  detailTaskId: string | null;
  setDetailTaskId: React.Dispatch<React.SetStateAction<string | null>>;

  // Add menu & NLP
  showAddMenu: boolean;
  setShowAddMenu: React.Dispatch<React.SetStateAction<boolean>>;
  showNLPDecomposer: boolean;
  setShowNLPDecomposer: React.Dispatch<React.SetStateAction<boolean>>;

  // Quick add
  quickAddTitle: string;
  setQuickAddTitle: React.Dispatch<React.SetStateAction<string>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;

  // Form visibility
  showForm: boolean;
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>;
  createCategory: string;
  setCreateCategory: React.Dispatch<React.SetStateAction<string>>;
  createParent: string | null;
  setCreateParent: React.Dispatch<React.SetStateAction<string | null>>;

  // Partner tabs
  setViewTab: React.Dispatch<React.SetStateAction<'my' | 'partner'>>;
  setSelectedPartner: React.Dispatch<React.SetStateAction<any>>;

  // Actions
  confirmDelete: (title: string, message: string, action: () => void) => void;
  getAllDescendants: (parentId: string, allGoals: GoalNode[]) => GoalNode[];
  deleteGoal: (id: string) => Promise<void>;
  cycleStatus: (id: string, currentStatus: string) => Promise<void>;
  duplicateGoal: (goalId: string) => Promise<void>;
  archiveGoal: (goalId: string) => Promise<void>;
  handleDragStart: (e: React.DragEvent, goalId: string) => void;
  handleDragEnd: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent, goalId: string) => void;
  handleDrop: (e: React.DragEvent, targetId: string) => Promise<void>;
  handleTouchStart: (e: React.TouchEvent, goalId: string) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: () => void;
  handleContextMenu: (e: React.MouseEvent, goalId: string) => void;
  saveTitle: (goalId: string) => Promise<void>;
  createLinkedTask: (goalId: string) => Promise<void>;
  toggleLinkedTask: (taskId: string, currentStatus: string, goalId: string) => Promise<void>;
  deleteTask: (taskId: string, goalId?: string | null) => Promise<void>;
  handleCreateNode: (parentId: string | null, category: string) => void;
  handleMoveGoal: (goalId: string, newParentId: string | null) => Promise<void>;
  handleQuickAdd: () => Promise<void>;
  handlePopularGoal: (title: string, icon: string) => Promise<void>;
  createGoalFromForm: (form: {
    title: string; icon: string; color: string; targetDate: string;
    createCategory: string; createParent: string | null; createPriority: string;
    createDomain: string; createBudget: string; createBusinessId: string;
    createDesc: string; createHours: string; createDeadlineType: string;
    createSuccessCriteria: string; createFinType: string;
  }) => Promise<void>;
  createTaskFromForm: (form: {
    title: string; targetDate: string;
    createParent: string | null; newTaskPriority: string;
  }) => Promise<void>;
}

export function useGoalsActions(
  user: any,
  goals: GoalNode[],
  fetchGoals: (isRefresh?: boolean) => Promise<void>,
  fetchAllTaskCounts: () => void,
  fetchTaskChartData: (goalId: string) => Promise<void>,
  setLinkedTasks: React.Dispatch<React.SetStateAction<Record<string, GoalTask[]>>>,
  resetCreateForm: () => void,
): GoalsActionsReturn {
  const { awardXP } = useGamificationContext();

  // Form visibility
  const [showForm, setShowForm] = useState(false);
  const [createCategory, setCreateCategory] = useState<string>('goal');
  const [createParent, setCreateParent] = useState<string | null>(null);

  // Inline editing
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editTitleVal, setEditTitleVal] = useState('');
  const [newLinkedTask, setNewLinkedTask] = useState<string | null>(null);
  const [newLinkedTaskTitle, setNewLinkedTaskTitle] = useState('');
  const [creatingLinkedTask, setCreatingLinkedTask] = useState(false);

  // Drag
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<'above' | 'below' | null>(null);

  // Swipe
  const [swipeId, setSwipeId] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const swiping = useRef(false);

  // Context menu
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState({ title: '', message: '' });
  const [celebrateGoalId, setCelebrateGoalId] = useState<string | null>(null);

  // Detail modals
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  // Menus
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showNLPDecomposer, setShowNLPDecomposer] = useState(false);

  // Quick add
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [saving, setSaving] = useState(false);

  // Partner tabs
  const [viewTab, setViewTab] = useState<'my' | 'partner'>('my');
  const [selectedPartner, setSelectedPartner] = useState<any>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenuId) return;
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenuId]);

  const confirmDelete = (title: string, message: string, action: () => void) => {
    setConfirmMsg({ title, message });
    setConfirmAction(() => action);
  };

  const getAllDescendants = useCallback((parentId: string, allGoals: GoalNode[]): GoalNode[] => {
    const children = allGoals.filter(g => g.parent_goal_id === parentId);
    return children.flatMap(c => [c, ...getAllDescendants(c.id, allGoals)]);
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    const descendants = getAllDescendants(id, goals);
    const allIds = [id, ...descendants.map(d => d.id)];
    for (const goalId of allIds) await useGoalsStore.getState().deleteGoal(goalId);
    const linkedTasksList = useScheduleStore.getState().tasks.filter(t => t.goal_id && allIds.includes(t.goal_id));
    for (const task of linkedTasksList) await useScheduleStore.getState().deleteTask(task.id);
    setConfirmAction(null);
    fetchGoals(true);
  }, [goals, getAllDescendants, fetchGoals]);

  const cycleStatus = useCallback(async (id: string, currentStatus: string) => {
    const idx = STATUS_CYCLE.indexOf(currentStatus as any);
    const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    const updates: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === 'done') {
      updates.progress = 1;
      setCelebrateGoalId(id);
      showToast('Goal completed! 🎉', '🏆', '#39FF14');
      setTimeout(() => setCelebrateGoalId(null), 3000);
      const goal = goals.find(g => g.id === id);
      awardXP('goal_complete', { description: `Goal completed: ${goal?.title || 'Goal'}` });
    }
    await useGoalsStore.getState().updateGoal(id, updates as any);
    fetchGoals();
  }, [goals, fetchGoals, awardXP]);

  const duplicateGoal = useCallback(async (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    const newId = await useGoalsStore.getState().createGoal({
      user_id: user?.id, title: `${goal.title} (copy)`, icon: goal.icon, color: goal.color,
      status: 'active', progress: 0, sort_order: goals.length, category: goal.category,
      parent_goal_id: goal.parent_goal_id, priority: goal.priority, description: goal.description, target_date: goal.target_date,
    });
    if (newId) { showToast('Duplicated!', '📋', '#00D4FF'); fetchGoals(); }
    setContextMenuId(null);
  }, [goals, user?.id, fetchGoals]);

  const archiveGoal = useCallback(async (goalId: string) => {
    await useGoalsStore.getState().updateGoal(goalId, { status: 'archived' });
    showToast('Archived', '📦', '#5A7A9A');
    fetchGoals();
    setContextMenuId(null);
  }, [fetchGoals]);

  // ── Drag & Drop ──
  const handleDragStart = useCallback((e: React.DragEvent, goalId: string) => {
    setDragId(goalId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', goalId);
    (e.target as HTMLElement).classList.add('dragging');
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.target as HTMLElement).classList.remove('dragging');
    setDragId(null); setDragOverId(null); setDragPosition(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, goalId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOverId(goalId);
    setDragPosition(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below');
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); setDragPosition(null); return; }
    const draggedGoal = goals.find(g => g.id === dragId);
    const targetGoal = goals.find(g => g.id === targetId);
    if (!draggedGoal || !targetGoal) return;
    if (draggedGoal.parent_goal_id !== targetGoal.parent_goal_id) { setDragId(null); setDragOverId(null); setDragPosition(null); return; }
    const siblings = goals.filter(g => g.parent_goal_id === targetGoal.parent_goal_id && g.category === targetGoal.category).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const filtered = siblings.filter(g => g.id !== dragId);
    const targetIdx = filtered.findIndex(g => g.id === targetId);
    filtered.splice(dragPosition === 'above' ? targetIdx : targetIdx + 1, 0, draggedGoal);
    for (const u of filtered.map((g, i) => ({ id: g.id, sort_order: i }))) {
      await useGoalsStore.getState().updateGoal(u.id, { sort_order: u.sort_order });
    }
    setDragId(null); setDragOverId(null); setDragPosition(null);
    fetchGoals();
  }, [dragId, dragPosition, goals, fetchGoals]);

  // ── Touch swipe ──
  const handleTouchStart = useCallback((e: React.TouchEvent, goalId: string) => {
    const touch = e.touches[0];
    swipeStartX.current = touch.clientX; swipeStartY.current = touch.clientY;
    swiping.current = false; setSwipeId(goalId); setSwipeX(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeId) return;
    const touch = e.touches[0];
    const dx = touch.clientX - swipeStartX.current;
    const dy = touch.clientY - swipeStartY.current;
    if (!swiping.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) swiping.current = true;
    if (swiping.current && dx < 0) setSwipeX(Math.max(dx, -120));
  }, [swipeId]);

  const handleTouchEnd = useCallback(() => {
    if (swipeX < -80 && swipeId) {
      const goal = goals.find(g => g.id === swipeId);
      if (goal) {
        const childCount = getAllDescendants(swipeId, goals).length;
        confirmDelete(`Delete ${goal.title}?`, childCount > 0 ? `This will also delete ${childCount} sub-item${childCount > 1 ? 's' : ''} and their tasks.` : 'This will permanently remove this item.', () => deleteGoal(swipeId!));
      }
    }
    setSwipeId(null); setSwipeX(0); swiping.current = false;
  }, [swipeX, swipeId, goals, getAllDescendants, deleteGoal]);

  const handleContextMenu = useCallback((e: React.MouseEvent, goalId: string) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenuId(goalId); setContextMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  const saveTitle = useCallback(async (goalId: string) => {
    if (!editTitleVal.trim()) { setEditingTitle(null); return; }
    await useGoalsStore.getState().updateGoal(goalId, { title: editTitleVal.trim() });
    setEditingTitle(null); fetchGoals();
  }, [editTitleVal, fetchGoals]);

  const createLinkedTask = useCallback(async (goalId: string) => {
    if (!newLinkedTaskTitle.trim()) return;
    setCreatingLinkedTask(true);
    const parentGoal = goals.find(g => g.id === goalId);
    const dueDate = parentGoal?.target_date || new Date().toISOString().split('T')[0];
    const ok = await useScheduleStore.getState().createTask(user?.id || '', newLinkedTaskTitle.trim(), 'medium', { goal_id: goalId, due_date: dueDate });
    if (ok) {
      setNewLinkedTaskTitle(''); setNewLinkedTask(null);
      const refreshedTasks = useScheduleStore.getState().tasks.filter(t => t.goal_id === goalId && !t.is_deleted).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      setLinkedTasks(prev => ({ ...prev, [goalId]: refreshedTasks as unknown as GoalTask[] }));
      fetchTaskChartData(goalId); fetchGoals();
      window.dispatchEvent(new Event('lifeos-refresh'));
    }
    setCreatingLinkedTask(false);
  }, [goals, user?.id, newLinkedTaskTitle, fetchGoals, fetchTaskChartData, setLinkedTasks]);

  const toggleLinkedTask = useCallback(async (taskId: string, currentStatus: string, goalId: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    await useScheduleStore.getState().updateTask(taskId, { status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null });
    if (newStatus === 'done') awardXP('task_complete', { description: 'Task completed: Linked task' });
    const { milestones } = await recalcProgression(goalId, supabase);
    if (milestones.length > 0) milestones.forEach(m => showToast(`${m.title} completed!`, '🎉', m.color));
    const refreshedTasks = useScheduleStore.getState().tasks.filter(t => t.goal_id === goalId && !t.is_deleted).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    setLinkedTasks(prev => ({ ...prev, [goalId]: refreshedTasks as unknown as GoalTask[] }));
    fetchGoals();
  }, [fetchGoals, awardXP, setLinkedTasks]);

  const deleteTask = useCallback(async (taskId: string, goalId?: string | null) => {
    await useScheduleStore.getState().deleteTask(taskId);
    setConfirmAction(null);
    if (goalId) {
      const refreshedTasks = useScheduleStore.getState().tasks.filter(t => t.goal_id === goalId && !t.is_deleted).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      setLinkedTasks(prev => ({ ...prev, [goalId]: refreshedTasks as unknown as GoalTask[] }));
    }
    fetchGoals();
  }, [fetchGoals, setLinkedTasks]);

  const handleCreateNode = useCallback((parentId: string | null, category: string) => {
    setCreateParent(parentId); setCreateCategory(category); setShowForm(true);
  }, []);

  const handleMoveGoal = useCallback(async (goalId: string, newParentId: string | null) => {
    await useGoalsStore.getState().updateGoal(goalId, { parent_goal_id: newParentId, category: 'goal' });
    fetchGoals(); fetchAllTaskCounts();
  }, [fetchGoals, fetchAllTaskCounts]);

  const handleQuickAdd = useCallback(async () => {
    if (!quickAddTitle.trim()) return;
    setSaving(true);
    const newId = await useGoalsStore.getState().createGoal({
      user_id: user?.id, title: quickAddTitle.trim(), icon: '🎯', color: '#00D4FF',
      status: 'active', progress: 0, sort_order: goals.length, category: 'goal', priority: 'medium',
    } as Record<string, unknown>);
    if (newId) { showToast('Goal created!', '🎯', '#00D4FF'); setQuickAddTitle(''); fetchGoals(); }
    setSaving(false);
  }, [quickAddTitle, user?.id, goals.length, fetchGoals]);

  const handlePopularGoal = useCallback(async (title: string, icon: string) => {
    const newId = await useGoalsStore.getState().createGoal({
      user_id: user?.id, title, icon, color: '#00D4FF',
      status: 'active', progress: 0, sort_order: goals.length, category: 'goal', priority: 'medium',
    } as Record<string, unknown>);
    if (newId) { showToast('Goal created!', '🎯', '#00D4FF'); fetchGoals(); }
  }, [user?.id, goals.length, fetchGoals]);

  const createGoalFromForm = useCallback(async (form: {
    title: string; icon: string; color: string; targetDate: string;
    createCategory: string; createParent: string | null; createPriority: string;
    createDomain: string; createBudget: string; createBusinessId: string;
    createDesc: string; createHours: string; createDeadlineType: string;
    createSuccessCriteria: string; createFinType: string;
  }) => {
    if (!form.title.trim()) { showToast('Enter a goal name', undefined, '#F97316'); return; }
    setSaving(true);
    const defaultIcon = form.createCategory === 'objective' ? '🎯' : form.createCategory === 'epic' ? '⚡' : '🏁';
    const defaultColor = form.createCategory === 'objective' ? '#00D4FF' : form.createCategory === 'epic' ? '#FACC15' : '#39FF14';
    const row: Record<string, unknown> = {
      user_id: user?.id, title: form.title.trim(), icon: form.icon || defaultIcon,
      color: form.color || defaultColor, status: 'active', progress: 0,
      sort_order: goals.length, category: form.createCategory,
      parent_goal_id: form.createParent, priority: form.createPriority || 'medium',
    };
    if (form.targetDate) row.target_date = form.targetDate;
    if (form.createDomain) row.domain = form.createDomain;
    if (form.createBudget && parseFloat(form.createBudget) > 0) row.budget_allocated = parseFloat(form.createBudget);
    if (form.createBusinessId) row.business_id = form.createBusinessId;
    if (form.createDesc.trim()) row.description = form.createDesc.trim();
    if (form.createHours && parseInt(form.createHours) > 0) row.estimated_hours = parseInt(form.createHours);
    if (form.createDeadlineType !== 'soft') row.deadline_type = form.createDeadlineType;
    if (form.createSuccessCriteria.trim()) row.success_criteria = form.createSuccessCriteria.trim();
    if (form.createFinType) row.financial_type = form.createFinType;
    const newId = await useGoalsStore.getState().createGoal(row as Record<string, unknown>);
    if (newId) { resetCreateForm(); setShowForm(false); fetchGoals(); }
    setSaving(false);
  }, [user?.id, goals.length, fetchGoals, resetCreateForm]);

  const createTaskFromForm = useCallback(async (form: {
    title: string; targetDate: string; createParent: string | null; newTaskPriority: string;
  }) => {
    if (!form.title.trim()) { showToast('Enter a task name', undefined, '#F97316'); return; }
    setSaving(true);
    const ok = await useScheduleStore.getState().createTask(user?.id || '', form.title.trim(), form.newTaskPriority, {
      due_date: form.targetDate || null, goal_id: form.createParent || null,
    });
    if (ok) { resetCreateForm(); setShowForm(false); fetchGoals(); }
    setSaving(false);
  }, [user?.id, fetchGoals, resetCreateForm]);

  return {
    editingTitle, setEditingTitle, editTitleVal, setEditTitleVal,
    newLinkedTask, setNewLinkedTask, newLinkedTaskTitle, setNewLinkedTaskTitle,
    creatingLinkedTask,
    dragId, dragOverId, dragPosition,
    swipeId, swipeX, swipeStartX, swipeStartY, swiping,
    contextMenuId, setContextMenuId, contextMenuPos, setContextMenuPos, contextMenuRef,
    confirmAction, setConfirmAction, confirmMsg, setConfirmMsg,
    celebrateGoalId, setCelebrateGoalId,
    detailNodeId, setDetailNodeId, detailTaskId, setDetailTaskId,
    showAddMenu, setShowAddMenu, showNLPDecomposer, setShowNLPDecomposer,
    quickAddTitle, setQuickAddTitle, saving, setSaving,
    showForm, setShowForm, createCategory, setCreateCategory,
    createParent, setCreateParent,
    setViewTab, setSelectedPartner,
    confirmDelete, getAllDescendants, deleteGoal, cycleStatus, duplicateGoal, archiveGoal,
    handleDragStart, handleDragEnd, handleDragOver, handleDrop,
    handleTouchStart, handleTouchMove, handleTouchEnd,
    handleContextMenu, saveTitle, createLinkedTask, toggleLinkedTask, deleteTask,
    handleCreateNode, handleMoveGoal, handleQuickAdd, handlePopularGoal,
    createGoalFromForm, createTaskFromForm,
  };
}